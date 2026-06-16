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
    return NextResponse.json({ error: "SFTP is not enabled for this server. Enable it in Server Settings." }, { status: 400 });
  }

  // Resolve install path: prefer sftpDefaultPluginPath, fall back to sftpRootPath + defaultPath
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

  try {
    await writeTextFile(server, installPath, plugin.content);
    await prisma.appSetting.upsert({
      where: { key: `plugin_installed:${pluginId}:${body.serverId}` },
      update: { value: installPath },
      create: { key: `plugin_installed:${pluginId}:${body.serverId}`, value: installPath },
    });
    return NextResponse.json({ success: true, path: installPath });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SFTP write failed" },
      { status: 502 },
    );
  }
}
