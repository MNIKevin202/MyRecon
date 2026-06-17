import { NextRequest, NextResponse } from "next/server";
import { canManage, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { EXCLUSIVE_PLUGINS } from "@/lib/exclusive-plugins";
import { downloadPluginFiles, resolvePluginDir, uploadBuffer, joinRemotePath } from "@/server/sftp/service";
import type { PluginManifest } from "@/app/api/exclusive-plugins/manifest/route";

type Params = { params: Promise<{ serverId: string }> };

const MANIFEST_URL =
  "https://raw.githubusercontent.com/MNIKevin202/MyRecon/main/plugins/manifest.json";

// POST /api/servers/[serverId]/copy-plugins  body: { targetServerId }
// Mirrors every .cs plugin in the source server's plugin directory
// (MyRcon exclusive + uMod/Oxide + anything else) to the target server's
// plugin directory over SFTP. The framework's file watcher auto-loads them.
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
  if (!source.sftpEnabled) {
    return NextResponse.json(
      { error: "SFTP is not enabled for the source server. Enable it in Server Settings." },
      { status: 400 },
    );
  }
  if (!target.sftpEnabled) {
    return NextResponse.json(
      { error: "SFTP is not enabled for the target server. Enable it in Server Settings." },
      { status: 400 },
    );
  }

  const logs: string[] = [];

  // Read every plugin off the source server
  let files: { name: string; data: Buffer }[];
  logs.push(`Reading plugins from ${source.name}…`);
  try {
    files = await downloadPluginFiles(source);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read source plugins", logs },
      { status: 502 },
    );
  }
  if (files.length === 0) {
    return NextResponse.json(
      { error: "No .cs plugins found on the source server.", logs },
      { status: 400 },
    );
  }
  logs.push(`Found ${files.length} plugin file(s)`);

  let targetDir: string;
  try {
    targetDir = resolvePluginDir(target);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Target plugin path not configured", logs },
      { status: 400 },
    );
  }

  // Map exclusive-plugin filenames → id so we can keep the install registry in
  // sync for plugins that show on the Exclusive Plugins page.
  const manifest = await fetch(MANIFEST_URL, { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<PluginManifest>) : null))
    .catch(() => null);
  const filenameToId = new Map<string, string>();
  for (const p of EXCLUSIVE_PLUGINS) filenameToId.set(p.filename.toLowerCase(), p.id);
  if (manifest) {
    for (const [id, m] of Object.entries(manifest)) {
      if (m.filename) filenameToId.set(m.filename.toLowerCase(), id);
    }
  }

  const copied: string[] = [];
  const failed: string[] = [];

  for (const file of files) {
    const installPath = joinRemotePath(targetDir, file.name);
    try {
      await uploadBuffer(target, installPath, file.data);
      copied.push(file.name);

      // Keep the exclusive-plugin install registry in sync where applicable
      const pluginId = filenameToId.get(file.name.toLowerCase());
      if (pluginId) {
        const text = file.data.toString("utf8");
        const match = text.match(/\[Info\([^,]+,\s*[^,]+,\s*"([^"]+)"\s*\)\]/);
        const version = match?.[1] ?? "unknown";
        await prisma.appSetting.upsert({
          where:  { key: `plugin_installed:${pluginId}:${target.id}` },
          update: { value: `${version}|${installPath}` },
          create: { key: `plugin_installed:${pluginId}:${target.id}`, value: `${version}|${installPath}` },
        });
      }
    } catch (err) {
      logs.push(`ERROR: ${file.name} — ${err instanceof Error ? err.message : String(err)}`);
      failed.push(file.name);
    }
  }

  logs.push(`Done — ${copied.length} copied, ${failed.length} failed`);
  logs.push("The target server's framework will auto-load the new plugins.");

  return NextResponse.json({
    success: failed.length === 0,
    copied,
    failed,
    logs,
  });
}
