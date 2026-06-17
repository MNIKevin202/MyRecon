import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canManage, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { grantServerAdminBulk } from "@/server/plugins/permissions";

type Params = { params: Promise<{ serverId: string }> };

const schema = z.object({
  steamIds: z.array(z.string().trim().min(15).max(20)).min(1).max(500),
  level: z.enum(["owner", "moderator"]).optional().default("owner"),
  players: z.array(z.object({ steamId: z.string(), name: z.string().optional().nullable() })).optional(),
});

// POST /api/servers/[serverId]/permissions/grant-admin
// Sets players as Rust server owner/moderator (ownerid/moderatorid) and writes
// the config (server.writecfg) so it persists in cfg/users.cfg.
export async function POST(request: NextRequest, { params }: Params) {
  const { user, response } = await requireUser(request);
  if (response) return response;
  if (!canManage(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide at least one SteamID." }, { status: 400 });
  }

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const nameById = new Map((parsed.data.players ?? []).map((p) => [p.steamId, p.name ?? null]));
  const targets = parsed.data.steamIds.map((steamId) => ({ steamId, playerName: nameById.get(steamId) ?? null }));

  try {
    const result = await grantServerAdminBulk(server, targets, parsed.data.level);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Grant admin failed" },
      { status: 502 },
    );
  }
}
