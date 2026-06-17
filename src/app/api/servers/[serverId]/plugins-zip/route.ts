import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getPlugin } from "@/lib/exclusive-plugins";
import { createZip } from "@/server/zip";
import type { PluginManifest } from "@/app/api/exclusive-plugins/manifest/route";

type Params = { params: Promise<{ serverId: string }> };

const MANIFEST_URL =
  "https://raw.githubusercontent.com/MNIKevin202/MyRecon/main/plugins/manifest.json";

function resolve(id: string, manifest: PluginManifest | null) {
  const m = manifest?.[id];
  const local = getPlugin(id);
  const filename = m?.filename ?? local?.filename;
  const contentUrl = m?.contentUrl ?? local?.contentUrl;
  if (!filename || !contentUrl) return null;
  return { filename, contentUrl };
}

// GET /api/servers/[serverId]/plugins-zip
// Streams a .zip of every exclusive plugin installed on this server so the
// admin can install them manually.
export async function GET(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const installedSettings = await prisma.appSetting.findMany({
    where: { key: { startsWith: "plugin_installed:" } },
    select: { key: true },
  });
  const pluginIds = installedSettings
    .map((row) => row.key.split(":"))
    .filter(([, , sid]) => sid === serverId)
    .map(([, pluginId]) => pluginId)
    .filter((id): id is string => Boolean(id));

  if (pluginIds.length === 0) {
    return NextResponse.json(
      { error: "No exclusive plugins are installed on this server." },
      { status: 400 },
    );
  }

  const manifest = await fetch(MANIFEST_URL, { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<PluginManifest>) : null))
    .catch(() => null);

  const files: { name: string; data: Buffer }[] = [];
  for (const id of pluginIds) {
    const plugin = resolve(id, manifest);
    if (!plugin) continue;
    try {
      const ghRes = await fetch(plugin.contentUrl, { cache: "no-store" });
      if (!ghRes.ok) continue;
      const text = await ghRes.text();
      files.push({ name: plugin.filename, data: Buffer.from(text, "utf8") });
    } catch {
      // skip unreachable plugin
    }
  }

  if (files.length === 0) {
    return NextResponse.json(
      { error: "Could not fetch any plugin sources from GitHub." },
      { status: 502 },
    );
  }

  const zip = createZip(files);
  const safeName = server.name.replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "") || "server";
  const filename = `myrcon-plugins-${safeName}.zip`;

  return new NextResponse(new Uint8Array(zip), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(zip.length),
    },
  });
}
