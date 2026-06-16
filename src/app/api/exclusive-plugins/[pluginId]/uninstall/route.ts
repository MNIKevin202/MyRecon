import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getPlugin } from "@/lib/exclusive-plugins";
import { deleteRemotePath } from "@/server/sftp/service";

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
    return NextResponse.json({ error: "SFTP is not enabled for this server." }, { status: 400 });
  }

  const key = `plugin_installed:${pluginId}:${body.serverId}`;
  const setting = await prisma.appSetting.findUnique({ where: { key } });

  // Resolve the file path from the stored setting, or fall back to defaults
  let filePath: string;
  if (setting?.value) {
    const [, ...pathParts] = setting.value.split("|");
    filePath = pathParts.join("|"); // re-join in case path had | chars
  } else if (server.sftpDefaultPluginPath) {
    filePath = `${server.sftpDefaultPluginPath.replace(/\/$/, "")}/${plugin.filename}`;
  } else if (server.sftpRootPath) {
    filePath = `${server.sftpRootPath.replace(/\/$/, "")}/${plugin.defaultPath}`;
  } else {
    return NextResponse.json({ error: "Cannot determine file path — no SFTP root configured." }, { status: 400 });
  }

  const logs: string[] = [];
  logs.push(`Deleting via SFTP → ${filePath}`);

  try {
    await deleteRemotePath(server, filePath);
    logs.push(`File removed`);
  } catch (err) {
    // If the file is already gone, that's fine — still clean up the DB record
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.toLowerCase().includes("no such file") && !msg.toLowerCase().includes("not found")) {
      logs.push(`ERROR: ${msg}`);
      return NextResponse.json({ error: msg, logs }, { status: 502 });
    }
    logs.push(`File already absent — clearing record`);
  }

  await prisma.appSetting.deleteMany({ where: { key } });
  logs.push(`Plugin record removed from database`);

  return NextResponse.json({ success: true, path: filePath, logs });
}
