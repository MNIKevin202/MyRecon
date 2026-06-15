import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ serverId: string }> };

function aliases(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const permission = request.nextUrl.searchParams.get("permission")?.trim().toLowerCase();

  const server = await prisma.serverProfile.findUnique({
    where: { id: serverId },
    select: { id: true },
  });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const [assignments, players] = await Promise.all([
    prisma.pluginPermissionAssignment.findMany({
      where: {
        serverId,
        ...(permission ? { permission } : {}),
      },
      orderBy: [{ permission: "asc" }, { playerName: "asc" }, { steamId: "asc" }],
    }),
    prisma.serverPlayer.findMany({
      where: { serverId },
      orderBy: [{ online: "desc" }, { lastSeenAt: "desc" }, { name: "asc" }],
    }),
  ]);

  const permissionMap = new Map<string, {
    permission: string;
    framework: string;
    count: number;
    pluginNames: Set<string>;
  }>();

  for (const assignment of assignments) {
    const item = permissionMap.get(assignment.permission) ?? {
      permission: assignment.permission,
      framework: assignment.framework,
      count: 0,
      pluginNames: new Set<string>(),
    };
    item.count += 1;
    item.framework = assignment.framework || item.framework;
    if (assignment.pluginName) item.pluginNames.add(assignment.pluginName);
    permissionMap.set(assignment.permission, item);
  }

  return NextResponse.json({
    permissions: [...permissionMap.values()].map((item) => ({
      permission: item.permission,
      framework: item.framework,
      count: item.count,
      pluginNames: [...item.pluginNames].sort((a, b) => a.localeCompare(b)),
    })),
    assignments: assignments.map((assignment) => ({
      id: assignment.id,
      permission: assignment.permission,
      framework: assignment.framework,
      pluginName: assignment.pluginName,
      steamId: assignment.steamId,
      playerName: assignment.playerName,
      source: assignment.source,
      createdAt: assignment.createdAt.toISOString(),
      updatedAt: assignment.updatedAt.toISOString(),
    })),
    players: players.map((player) => ({
      steamId: player.steamId,
      name: player.name,
      aliases: aliases(player.aliasesJson),
      online: player.online,
      lastSeenAt: player.lastSeenAt.toISOString(),
      timesSeen: player.timesSeen,
      lastPing: player.lastPing,
      bestPing: player.bestPing,
    })),
  });
}
