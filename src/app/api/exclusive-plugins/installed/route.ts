import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { EXCLUSIVE_PLUGINS } from "@/lib/exclusive-plugins";
import { joinRemotePath, listDirectory, readTextFile, resolvePluginDir } from "@/server/sftp/service";
import type { PluginManifest } from "@/app/api/exclusive-plugins/manifest/route";

const MANIFEST_URL =
  "https://raw.githubusercontent.com/MNIKevin202/MyRecon/main/plugins/manifest.json";

// GET /api/exclusive-plugins/installed?serverId=...
// Checks the server's actual plugin directory over SFTP/FTP and reports which
// exclusive plugins are really present (and their version), so install status
// is accurate regardless of which machine the app runs on.
export async function GET(request: NextRequest) {
  const { response } = await requireUser(request);
  if (response) return response;

  const serverId = new URL(request.url).searchParams.get("serverId");
  if (!serverId) return NextResponse.json({ error: "serverId required" }, { status: 400 });

  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });
  if (!server.sftpEnabled) return NextResponse.json({ installed: {}, sftp: false });

  // filename (lowercase) -> pluginId, from local registry + GitHub manifest
  const manifest = await fetch(MANIFEST_URL, { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<PluginManifest>) : null))
    .catch(() => null);
  const fileToId = new Map<string, string>();
  for (const p of EXCLUSIVE_PLUGINS) fileToId.set(p.filename.toLowerCase(), p.id);
  if (manifest) for (const [id, m] of Object.entries(manifest)) if (m.filename) fileToId.set(m.filename.toLowerCase(), id);

  try {
    const dir = resolvePluginDir(server);
    const listing = await listDirectory(server, dir);
    const present = new Map<string, string>(); // lowercase -> actual filename
    for (const e of listing.entries) if (e.type === "file") present.set(e.name.toLowerCase(), e.name);

    const installed: Record<string, string> = {};
    for (const [fnameLower, pluginId] of fileToId) {
      const actual = present.get(fnameLower);
      if (!actual) continue;
      let version = "installed";
      try {
        const file = await readTextFile(server, joinRemotePath(dir, actual));
        const match = file.content.match(/\[Info\([^,]+,\s*[^,]+,\s*"([^"]+)"\s*\)\]/);
        if (match?.[1]) version = match[1];
      } catch {
        // present but unreadable — still mark installed
      }
      installed[pluginId] = version;
    }

    return NextResponse.json({ installed, sftp: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read server plugins", installed: {} },
      { status: 502 },
    );
  }
}
