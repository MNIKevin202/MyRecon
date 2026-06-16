import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getPlugin } from "@/lib/exclusive-plugins";
import { executeServerCommand } from "@/server/rcon/service";

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

  // Plugin name without extension for the reload command
  const pluginName = plugin.filename.replace(/\.cs$/i, "");

  // Try Oxide first, then Carbon — tolerate "unknown command" from whichever isn't installed
  let raw = "";
  let usedCommand = "";
  const errors: string[] = [];

  for (const cmd of [`oxide.reload ${pluginName}`, `c.reload ${pluginName}`]) {
    try {
      raw = await executeServerCommand(server, cmd);
      usedCommand = cmd;
      break;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (!usedCommand) {
    return NextResponse.json(
      { error: `Reload failed on both Oxide and Carbon. Last error: ${errors.at(-1) ?? "unknown"}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true, command: usedCommand, output: raw });
}
