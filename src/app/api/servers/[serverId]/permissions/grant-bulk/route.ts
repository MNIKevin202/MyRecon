import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canManage, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { grantPluginPermissionsBulk } from "@/server/plugins/permissions";

type Params = { params: Promise<{ serverId: string }> };

const schema = z.object({
  steamIds: z.array(z.string().trim().min(15).max(20)).min(1).max(500),
  permission: z.string().trim().min(1).max(160),
  framework: z.enum(["AUTO", "CARBON", "OXIDE"]).optional().default("AUTO"),
  players: z.array(z.object({ steamId: z.string(), name: z.string().optional().nullable() })).optional(),
});

// POST /api/servers/[serverId]/permissions/grant-bulk
// Grants one permission (or "*" for full access) to many players.
export async function POST(request: NextRequest, { params }: Params) {
  const { user, response } = await requireUser(request);
  if (response) return response;
  if (!canManage(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide at least one SteamID and a permission." }, { status: 400 });
  }

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const nameById = new Map((parsed.data.players ?? []).map((p) => [p.steamId, p.name ?? null]));
  const targets = parsed.data.steamIds.map((steamId) => ({ steamId, playerName: nameById.get(steamId) ?? null }));

  try {
    const result = await grantPluginPermissionsBulk(server, targets, parsed.data.permission, parsed.data.framework);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk grant failed" },
      { status: 502 },
    );
  }
}
