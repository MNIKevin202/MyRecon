import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

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

export async function POST(request: NextRequest) {
  const { response } = await requireUser(request);
  if (response) return response;

  const body = await request.json() as CheckPayload;
  const { serverId, serverName, online, fps, memoryMb } = body;

  const rules = await prisma.notificationRule.findMany();
  const ruleMap = new Map(rules.map((r) => [r.type, r]));

  function isEnabled(type: string, defaultEnabled: boolean, defaultThreshold?: number | null) {
    const rule = ruleMap.get(type);
    return {
      enabled: rule ? rule.enabled : defaultEnabled,
      threshold: rule ? rule.threshold : (defaultThreshold ?? null),
    };
  }

  const wasOnline = await prisma.appNotification
    .findFirst({ where: { type: "server_online", serverId }, orderBy: { createdAt: "desc" } });
  const wasOffline = await prisma.appNotification
    .findFirst({ where: { type: "server_offline", serverId }, orderBy: { createdAt: "desc" } });

  if (!online) {
    const cfg = isEnabled("server_offline", true);
    if (cfg.enabled && !(await recentExists("server_offline", serverId))) {
      await create("server_offline", "Server offline", `${serverName} is not responding`, serverId);
    }
  } else {
    const cfg = isEnabled("server_online", true);
    if (cfg.enabled && wasOffline && (!wasOnline || wasOffline.createdAt > wasOnline.createdAt)) {
      if (!(await recentExists("server_online", serverId))) {
        await create("server_online", "Server online", `${serverName} is back online`, serverId);
      }
    }
  }

  if (online && fps != null) {
    const cfg = isEnabled("fps_low", true, 10);
    if (cfg.enabled && cfg.threshold != null && fps < cfg.threshold) {
      if (!(await recentExists("fps_low", serverId))) {
        await create("fps_low", "Low FPS warning", `${serverName} FPS is ${fps.toFixed(0)} (threshold: ${cfg.threshold})`, serverId);
      }
    }
  }

  if (online && memoryMb != null) {
    const cfg = isEnabled("high_memory", false, 3000);
    if (cfg.enabled && cfg.threshold != null && memoryMb > cfg.threshold) {
      if (!(await recentExists("high_memory", serverId))) {
        await create("high_memory", "High memory usage", `${serverName} memory is ${memoryMb.toFixed(0)} MB (threshold: ${cfg.threshold} MB)`, serverId);
      }
    }
  }

  const unreadCount = await prisma.appNotification.count({ where: { read: false } });
  const latest = await prisma.appNotification.findFirst({ where: { read: false }, orderBy: { createdAt: "desc" } });

  return NextResponse.json({ unreadCount, latest });
}
