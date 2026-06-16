import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getPlugin } from "@/lib/exclusive-plugins";
import { fireAndForgetCommand } from "@/server/rcon/service";

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

  const pluginName = plugin.filename.replace(/\.cs$/i, "");
  const logs: string[] = [];

  // Carbon/Oxide may not send a response to reload commands — fire and forget,
  // don't wait for a reply that may never come.
  for (const cmd of [`oxide.reload ${pluginName}`, `c.reload ${pluginName}`]) {
    logs.push(`> ${cmd}`);
    await fireAndForgetCommand(server, cmd);
  }

  logs.push(`Commands sent — plugin should reload within a few seconds`);

  return NextResponse.json({ success: true, command: `oxide.reload / c.reload ${pluginName}`, logs });
}
