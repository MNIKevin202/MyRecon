import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { executeServerCommand } from "@/server/rcon/service";

type CheckPayload = {
  serverId: string;
  serverName: string;
  online: boolean;
  fps?: number | null;
  memoryMb?: number | null;
};

const COOLDOWN_MINUTES = 10;

async function recentExists(type: string, serverId: string) {
  const since = new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000);
  const count = await prisma.appNotification.count({
    where: { type, serverId, createdAt: { gte: since } },
  });
  return count > 0;
}

async function create(type: string, title: string, message: string, serverId: string) {
  await prisma.appNotification.create({ data: { type, title, message, serverId } });
}

function isRuleEnabled(
  ruleMap: Map<string, { enabled: boolean; threshold: number | null }>,
  type: string,
  defaultEnabled: boolean,
  defaultThreshold?: number | null,
) {
  const rule = ruleMap.get(type);
  return {
    enabled: rule ? rule.enabled : defaultEnabled,
    threshold: rule ? rule.threshold : (defaultThreshold ?? null),
  };
}

export async function POST(request: NextRequest) {
  const { response } = await requireUser(request);
  if (response) return response;

  const body = await request.json() as CheckPayload;
  const { serverId, serverName, online, fps, memoryMb } = body;

  const rules = await prisma.notificationRule.findMany();
  const ruleMap = new Map(rules.map((r) => [r.type, { enabled: r.enabled, threshold: r.threshold }]));

  // Server down
  if (!online) {
    const cfg = isRuleEnabled(ruleMap, "server_offline", true);
    if (cfg.enabled && !(await recentExists("server_offline", serverId))) {
      await create("server_offline", "Server down", `${serverName} is not responding`, serverId);
    }
  }

  // Server restart (came back after being offline)
  if (online) {
    const cfg = isRuleEnabled(ruleMap, "server_restart", true);
    if (cfg.enabled) {
      const wasOffline = await prisma.appNotification.findFirst({
        where: { type: "server_offline", serverId },
        orderBy: { createdAt: "desc" },
      });
      const lastRestart = await prisma.appNotification.findFirst({
        where: { type: "server_restart", serverId },
        orderBy: { createdAt: "desc" },
      });
      if (wasOffline && (!lastRestart || wasOffline.createdAt > lastRestart.createdAt)) {
        if (!(await recentExists("server_restart", serverId))) {
          await create("server_restart", "Server restarted", `${serverName} is back online`, serverId);
        }
      }
    }
  }

  // Low FPS
  if (online && fps != null) {
    const cfg = isRuleEnabled(ruleMap, "fps_low", true, 10);
    if (cfg.enabled && cfg.threshold != null && fps < cfg.threshold) {
      if (!(await recentExists("fps_low", serverId))) {
        await create(
          "fps_low",
          "Low FPS warning",
          `${serverName} FPS is ${fps.toFixed(0)} (below ${cfg.threshold})`,
          serverId,
        );
      }
    }
  }

  // High memory
  if (online && memoryMb != null) {
    const cfg = isRuleEnabled(ruleMap, "high_memory", false, 3000);
    if (cfg.enabled && cfg.threshold != null && memoryMb > cfg.threshold) {
      if (!(await recentExists("high_memory", serverId))) {
        await create(
          "high_memory",
          "High memory usage",
          `${serverName} memory is ${memoryMb.toFixed(0)} MB (above ${cfg.threshold} MB)`,
          serverId,
        );
      }
    }
  }

  // Player join / leave
  const joinCfg = isRuleEnabled(ruleMap, "player_join", true);
  const leaveCfg = isRuleEnabled(ruleMap, "player_leave", true);

  if (online && (joinCfg.enabled || leaveCfg.enabled)) {
    try {
      const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
      if (server) {
        const raw = await executeServerCommand(server, "playerlist");
        const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;

        function str(v: unknown) { return typeof v === "string" || typeof v === "number" ? String(v).trim() : ""; }

        const currentPlayers = Array.isArray(parsed)
          ? parsed
              .map((p) => ({
                steamId: str(p.SteamID ?? p.SteamId ?? p.steamid ?? p.UserID ?? p.userid ?? p.id),
                name: str(p.DisplayName ?? p.Name ?? p.name ?? p.Username ?? p.username) || "Unknown",
              }))
              .filter((p) => p.steamId)
          : [];

        const currentIds = new Set(currentPlayers.map((p) => p.steamId));

        // Who was online before
        const prevOnline = await prisma.serverPlayer.findMany({
          where: { serverId, online: true },
          select: { steamId: true, name: true },
        });
        const prevIds = new Set(prevOnline.map((p) => p.steamId));

        // Joins: in current but not prev
        if (joinCfg.enabled) {
          for (const p of currentPlayers) {
            if (!prevIds.has(p.steamId)) {
              await create("player_join", "Player joined", `${p.name} joined ${serverName}`, serverId);
            }
          }
        }

        // Leaves: in prev but not current
        if (leaveCfg.enabled) {
          for (const p of prevOnline) {
            if (!currentIds.has(p.steamId)) {
              await create("player_leave", "Player left", `${p.name} left ${serverName}`, serverId);
            }
          }
        }

        // Update ServerPlayer online status
        const now = new Date();
        await prisma.serverPlayer.updateMany({
          where: { serverId, online: true, steamId: { notIn: [...currentIds] } },
          data: { online: false, lastDisconnectedAt: now },
        });
        for (const p of currentPlayers) {
          await prisma.serverPlayer.upsert({
            where: { serverId_steamId: { serverId, steamId: p.steamId } },
            update: { online: true, name: p.name, lastSeenAt: now },
            create: {
              serverId,
              steamId: p.steamId,
              name: p.name,
              online: true,
              source: "notification-check",
              firstSeenAt: now,
              lastSeenAt: now,
              lastConnectedAt: now,
              timesSeen: 1,
            },
          });
        }
      }
    } catch {
      // playerlist failed — skip player notifications this cycle
    }
  }

  const unreadCount = await prisma.appNotification.count({ where: { read: false } });
  const latest = await prisma.appNotification.findFirst({ where: { read: false }, orderBy: { createdAt: "desc" } });

  return NextResponse.json({ unreadCount, latest });
}
