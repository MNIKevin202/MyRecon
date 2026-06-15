import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canManage, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { executeServerCommand } from "@/server/rcon/service";

type Params = { params: Promise<{ serverId: string }> };

const actionSchema = z.object({
  action: z.enum(["kick", "ban", "kill", "heal", "custom"]),
  steamId: z.string().trim().regex(/^\d{15,20}$/),
  reason: z.string().trim().max(200).optional().default(""),
  command: z.string().trim().max(500).optional().default(""),
});

function quote(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function commandForAction(input: z.infer<typeof actionSchema>) {
  switch (input.action) {
    case "kick":
      return `kick ${quote(input.steamId)} ${quote(input.reason || "Kicked by admin")}`;
    case "ban":
      return `banid ${quote(input.steamId)} ${quote(input.reason || "Banned by admin")}`;
    case "kill":
      return `killplayer ${quote(input.steamId)}`;
    case "heal":
      return `healplayer ${quote(input.steamId)}`;
    case "custom":
      if (!input.command) throw new Error("Custom command is required.");
      return input.command.replaceAll("{steamId}", input.steamId).replaceAll("{reason}", input.reason || "");
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { user, response } = await requireUser(request);
  if (response) return response;
  if (!canManage(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid player action" }, { status: 400 });
  }

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  try {
    const command = commandForAction(parsed.data);
    const raw = await executeServerCommand(server, command);
    return NextResponse.json({ ok: true, command, raw });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Player action failed",
        details: typeof error === "object" && error && "details" in error ? error.details : undefined,
      },
      { status: 502 },
    );
  }
}
