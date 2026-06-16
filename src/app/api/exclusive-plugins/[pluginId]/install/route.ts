import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getPlugin } from "@/lib/exclusive-plugins";
import { writeTextFile } from "@/server/sftp/service";

type Params = { params: Promise<{ pluginId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { pluginId } = await params;
  const plugin = getPlugin(pluginId);
  if (!plugin) return NextResponse.json({ error: "Plugin not found" }, { status: 404 });

  const body = (await request.json()) as { serverId?: string };
  if (!body.serverId) return NextResponse.json({ error: "serverId required" }, { status: 400 });

  const server = await prisma.serverProfile.findUnique({ where: { id: body.serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });
  if (!server.sftpEnabled) {
    return NextResponse.json(
      { error: "SFTP is not enabled for this server. Enable it in Server Settings." },
      { status: 400 },
    );
  }

  // Resolve install path
  let installPath: string;
  if (server.sftpDefaultPluginPath) {
    installPath = `${server.sftpDefaultPluginPath.replace(/\/$/, "")}/${plugin.filename}`;
  } else if (server.sftpRootPath) {
    installPath = `${server.sftpRootPath.replace(/\/$/, "")}/${plugin.defaultPath}`;
  } else {
    return NextResponse.json(
      { error: "Server has no SFTP root path configured. Set it in Server Settings." },
      { status: 400 },
    );
  }

  const logs: string[] = [];

  // Fetch the latest .cs source from GitHub
  let content: string;
  let version = plugin.version;
  logs.push(`Fetching ${plugin.filename} from GitHub...`);
  try {
    const ghRes = await fetch(plugin.contentUrl, { cache: "no-store" });
    if (!ghRes.ok) throw new Error(`GitHub returned ${ghRes.status}`);
    content = await ghRes.text();

    // Extract version from [Info("...", "...", "x.y.z")] attribute
    const match = content.match(/\[Info\([^,]+,\s*[^,]+,\s*"([^"]+)"\s*\)\]/);
    if (match?.[1]) version = match[1];
    logs.push(`Fetched v${version} (${content.length.toLocaleString()} bytes)`);
  } catch (err) {
    const msg = `Failed to fetch plugin from GitHub: ${err instanceof Error ? err.message : String(err)}`;
    logs.push(`ERROR: ${msg}`);
    return NextResponse.json({ error: msg, logs }, { status: 502 });
  }

  logs.push(`Writing via SFTP → ${installPath}`);
  try {
    await writeTextFile(server, installPath, content);
    await prisma.appSetting.upsert({
      where:  { key: `plugin_installed:${pluginId}:${body.serverId}` },
      update: { value: `${version}|${installPath}` },
      create: { key: `plugin_installed:${pluginId}:${body.serverId}`, value: `${version}|${installPath}` },
    });
    logs.push(`File written successfully`);
    logs.push(`Oxide/Carbon will load ${plugin.filename} automatically — or use Reload`);
    return NextResponse.json({ success: true, path: installPath, version, logs });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "SFTP write failed";
    logs.push(`ERROR: ${msg}`);
    return NextResponse.json({ error: msg, logs }, { status: 502 });
  }
}
