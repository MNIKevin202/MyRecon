import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { executeServerCommand } from "@/server/rcon/service";
import { KnownPlayer, listKnownPlayers } from "@/server/plugins/permissions";

type Params = { params: Promise<{ serverId: string }> };

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function normalizeConnectedPlayer(entry: Record<string, unknown>) {
  const steamId = stringValue(entry.SteamID ?? entry.SteamId ?? entry.steamid ?? entry.UserID ?? entry.userid ?? entry.id).trim();
  return {
    steamId,
    name: stringValue(entry.DisplayName ?? entry.Name ?? entry.name ?? entry.Username ?? entry.username).trim() || "Unnamed",
    ping: numberValue(entry.Ping ?? entry.ping),
    connectedSeconds: numberValue(entry.ConnectedSeconds ?? entry.connectedSeconds ?? entry.Connected),
    address: stringValue(entry.Address ?? entry.addr ?? entry.IpAddress).trim(),
    violationLevel: numberValue(entry.VoiationLevel ?? entry.ViolationLevel ?? entry.violationLevel),
    raw: entry,
  };
}

function parseAliases(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function mergeAliases(existingJson: string | null | undefined, nextName: string) {
  const names = new Set(parseAliases(existingJson));
  const clean = nextName.trim();
  if (clean && clean !== "Unnamed") names.add(clean);
  return JSON.stringify([...names].sort((a, b) => a.localeCompare(b)));
}

async function upsertConnectedPlayers(serverId: string, players: ReturnType<typeof normalizeConnectedPlayer>[]) {
  const now = new Date();
  const connectedSteamIds = players.map((player) => player.steamId);

  await prisma.serverPlayer.updateMany({
    where: {
      serverId,
      online: true,
      steamId: { notIn: connectedSteamIds.length ? connectedSteamIds : [""] },
    },
    data: {
      online: false,
      lastDisconnectedAt: now,
    },
  });

  for (const player of players) {
    const existing = await prisma.serverPlayer.findUnique({
      where: { serverId_steamId: { serverId, steamId: player.steamId } },
    });
    const aliasesJson = mergeAliases(existing?.aliasesJson, player.name);
    const bestPing =
      player.ping == null
        ? existing?.bestPing ?? null
        : existing?.bestPing == null
          ? player.ping
          : Math.min(existing.bestPing, player.ping);
    const maxConnectedSeconds =
      player.connectedSeconds == null
        ? existing?.maxConnectedSeconds ?? null
        : Math.max(existing?.maxConnectedSeconds ?? 0, player.connectedSeconds);

    await prisma.serverPlayer.upsert({
      where: { serverId_steamId: { serverId, steamId: player.steamId } },
      update: {
        name: player.name || existing?.name || "Unnamed",
        aliasesJson,
        online: true,
        source: "playerlist",
        lastSeenAt: now,
        lastConnectedAt: existing?.online && existing.lastConnectedAt ? existing.lastConnectedAt : now,
        timesSeen: { increment: 1 },
        lastPing: player.ping,
        bestPing,
        lastAddress: player.address || existing?.lastAddress || null,
        lastConnectedSeconds: player.connectedSeconds,
        maxConnectedSeconds,
        violationLevel: player.violationLevel,
        rawJson: JSON.stringify(player.raw),
      },
      create: {
        serverId,
        steamId: player.steamId,
        name: player.name || "Unnamed",
        aliasesJson,
        online: true,
        source: "playerlist",
        firstSeenAt: now,
        lastSeenAt: now,
        lastConnectedAt: now,
        timesSeen: 1,
        lastPing: player.ping,
        bestPing,
        lastAddress: player.address || null,
        lastConnectedSeconds: player.connectedSeconds,
        maxConnectedSeconds,
        violationLevel: player.violationLevel,
        rawJson: JSON.stringify(player.raw),
      },
    });
  }
}

async function upsertKnownPlayers(serverId: string, players: KnownPlayer[]) {
  const now = new Date();
  for (const player of players) {
    const existing = await prisma.serverPlayer.findUnique({
      where: { serverId_steamId: { serverId, steamId: player.steamId } },
    });
    if (existing?.online) continue;

    await prisma.serverPlayer.upsert({
      where: { serverId_steamId: { serverId, steamId: player.steamId } },
      update: {
        name: player.name || existing?.name || "Unnamed",
        aliasesJson: mergeAliases(existing?.aliasesJson, player.name),
        online: player.connected,
        source: player.source,
        lastSeenAt: now,
        lastConnectedAt: player.connected ? now : existing?.lastConnectedAt,
        timesSeen: { increment: 1 },
      },
      create: {
        serverId,
        steamId: player.steamId,
        name: player.name || "Unnamed",
        aliasesJson: mergeAliases(null, player.name),
        online: player.connected,
        source: player.source,
        firstSeenAt: now,
        lastSeenAt: now,
        lastConnectedAt: player.connected ? now : null,
        timesSeen: 1,
      },
    });
  }
}

async function getPlayerHistory(serverId: string) {
  const players = await prisma.serverPlayer.findMany({
    where: { serverId },
    orderBy: [{ online: "desc" }, { lastSeenAt: "desc" }, { name: "asc" }],
  });

  return players.map((player) => ({
    steamId: player.steamId,
    name: player.name,
    aliases: parseAliases(player.aliasesJson),
    connected: player.online,
    source: player.source,
    firstSeenAt: player.firstSeenAt.toISOString(),
    lastSeenAt: player.lastSeenAt.toISOString(),
    lastConnectedAt: player.lastConnectedAt?.toISOString() ?? null,
    lastDisconnectedAt: player.lastDisconnectedAt?.toISOString() ?? null,
    timesSeen: player.timesSeen,
    ping: player.lastPing,
    bestPing: player.bestPing,
    connectedSeconds: player.lastConnectedSeconds,
    maxConnectedSeconds: player.maxConnectedSeconds,
    address: player.lastAddress ?? "",
    violationLevel: player.violationLevel,
  }));
}

export async function GET(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  try {
    const raw = await executeServerCommand(server, "playerlist");
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    const players = Array.isArray(parsed)
      ? parsed.map(normalizeConnectedPlayer).filter((player) => player.steamId)
      : [];
    const known = await listKnownPlayers(server);
    await upsertConnectedPlayers(serverId, players);
    await upsertKnownPlayers(serverId, known.players);
    const history = await getPlayerHistory(serverId);
    return NextResponse.json({
      players,
      connectedPlayers: players,
      knownPlayers: history,
      errors: known.errors,
      stats: {
        totalPlayers: history.length,
        connectedPlayers: history.filter((player) => player.connected).length,
      },
      raw,
    });
  } catch (error) {
    const known = await listKnownPlayers(server).catch(() => ({ players: [], errors: [] as string[] }));
    await upsertKnownPlayers(serverId, known.players);
    const history = await getPlayerHistory(serverId);
    return NextResponse.json({
      players: [],
      connectedPlayers: [],
      knownPlayers: history,
      errors: [
        error instanceof Error ? error.message : "playerlist failed",
        ...known.errors,
      ],
      stats: {
        totalPlayers: history.length,
        connectedPlayers: history.filter((player) => player.connected).length,
      },
      raw: "",
    });
  }
}
