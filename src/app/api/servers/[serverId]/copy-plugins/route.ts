import { NextRequest, NextResponse } from "next/server";
import { canManage, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getPlugin } from "@/lib/exclusive-plugins";
import { writeTextFile } from "@/server/sftp/service";
import { fireAndForgetCommand } from "@/server/rcon/service";
import type { PluginManifest } from "@/app/api/exclusive-plugins/manifest/route";

type Params = { params: Promise<{ serverId: string }> };

const MANIFEST_URL =
  "https://raw.githubusercontent.com/MNIKevin202/MyRecon/main/plugins/manifest.json";

type ResolvedPlugin = {
  id: string;
  filename: string;
  contentUrl: string;
};

// Resolve a plugin's filename + contentUrl from the manifest, falling back to
// the local registry. Mirrors how the Exclusive Plugins page sources data.
function resolvePlugin(id: string, manifest: PluginManifest | null): ResolvedPlugin | null {
  const m = manifest?.[id];
  const local = getPlugin(id);
  const filename = m?.filename ?? local?.filename;
  const contentUrl = m?.contentUrl ?? local?.contentUrl;
  if (!filename || !contentUrl) return null;
  return { id, filename, contentUrl };
}

// POST /api/servers/[serverId]/copy-plugins  body: { targetServerId }
// Copies every exclusive plugin installed on the source server to the target.
export async function POST(request: NextRequest, { params }: Params) {
  const { user, response } = await requireUser(request);
  if (response) return response;
  if (!canManage(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { serverId: sourceServerId } = await params;
  const body = (await request.json()) as { targetServerId?: string };
  if (!body.targetServerId) {
    return NextResponse.json({ error: "targetServerId required" }, { status: 400 });
  }
  if (body.targetServerId === sourceServerId) {
    return NextResponse.json({ error: "Source and target must be different servers." }, { status: 400 });
  }

  const [source, target] = await Promise.all([
    prisma.serverProfile.findUnique({ where: { id: sourceServerId } }),
    prisma.serverProfile.findUnique({ where: { id: body.targetServerId } }),
  ]);
  if (!source) return NextResponse.json({ error: "Source server not found" }, { status: 404 });
  if (!target) return NextResponse.json({ error: "Target server not found" }, { status: 404 });
  if (!target.sftpEnabled) {
    return NextResponse.json(
      { error: "SFTP is not enabled for the target server. Enable it in Server Settings." },
      { status: 400 },
    );
  }

  // Resolve the target install directory once (same priority as the install route)
  let targetDir: string;
  if (target.sftpDefaultPluginPath) {
    targetDir = target.sftpDefaultPluginPath.replace(/\/$/, "");
  } else if (target.sftpRootPath) {
    const framework = (target.modFramework ?? "oxide") as "oxide" | "carbon";
    const frameworkPath = framework === "carbon" ? "carbon/plugins" : "oxide/plugins";
    targetDir = `${target.sftpRootPath.replace(/\/$/, "")}/${frameworkPath}`;
  } else {
    return NextResponse.json(
      { error: "Target server has no SFTP root path configured. Set it in Server Settings." },
      { status: 400 },
    );
  }

  // Find every plugin installed on the source server
  const installedSettings = await prisma.appSetting.findMany({
    where: { key: { startsWith: "plugin_installed:" } },
    select: { key: true, value: true },
  });
  const sourcePluginIds = installedSettings
    .map((row) => row.key.split(":"))
    .filter(([, , sid]) => sid === sourceServerId)
    .map(([, pluginId]) => pluginId)
    .filter((id): id is string => Boolean(id));

  if (sourcePluginIds.length === 0) {
    return NextResponse.json(
      { error: "No exclusive plugins are installed on the source server.", logs: [] },
      { status: 400 },
    );
  }

  // Pull the manifest once for current versions / content URLs
  const manifest = await fetch(MANIFEST_URL, { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<PluginManifest>) : null))
    .catch(() => null);

  const logs: string[] = [];
  const copied: string[] = [];
  const failed: string[] = [];

  logs.push(`Copying ${sourcePluginIds.length} plugin(s) from ${source.name} → ${target.name}`);

  for (const pluginId of sourcePluginIds) {
    const plugin = resolvePlugin(pluginId, manifest);
    if (!plugin) {
      logs.push(`ERROR: ${pluginId} — could not resolve filename/source, skipped`);
      failed.push(pluginId);
      continue;
    }

    const installPath = `${targetDir}/${plugin.filename}`;
    let content: string;
    let version = manifest?.[pluginId]?.version ?? getPlugin(pluginId)?.version ?? "unknown";

    logs.push(`Fetching ${plugin.filename} from GitHub...`);
    try {
      const ghRes = await fetch(plugin.contentUrl, { cache: "no-store" });
      if (!ghRes.ok) throw new Error(`GitHub returned ${ghRes.status}`);
      content = await ghRes.text();
      const match = content.match(/\[Info\([^,]+,\s*[^,]+,\s*"([^"]+)"\s*\)\]/);
      if (match?.[1]) version = match[1];
    } catch (err) {
      logs.push(`ERROR: ${plugin.filename} — ${err instanceof Error ? err.message : String(err)}`);
      failed.push(pluginId);
      continue;
    }

    logs.push(`Writing via SFTP → ${installPath}`);
    try {
      await writeTextFile(target, installPath, content);
      await prisma.appSetting.upsert({
        where:  { key: `plugin_installed:${pluginId}:${target.id}` },
        update: { value: `${version}|${installPath}` },
        create: { key: `plugin_installed:${pluginId}:${target.id}`, value: `${version}|${installPath}` },
      });
      logs.push(`Installed ${plugin.filename} v${version}`);
      copied.push(pluginId);

      // Reload on the target (Oxide + Carbon — only the matching one takes effect)
      const pluginName = plugin.filename.replace(/\.cs$/i, "");
      for (const cmd of [`oxide.reload ${pluginName}`, `c.reload ${pluginName}`]) {
        await fireAndForgetCommand(target, cmd);
      }
    } catch (err) {
      logs.push(`ERROR: ${plugin.filename} — ${err instanceof Error ? err.message : String(err)}`);
      failed.push(pluginId);
    }
  }

  logs.push(`Done — ${copied.length} copied, ${failed.length} failed`);

  return NextResponse.json({
    success: failed.length === 0,
    copied,
    failed,
    logs,
  });
}
