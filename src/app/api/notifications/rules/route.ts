import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const DEFAULT_RULES = [
  { type: "server_offline",  enabled: true,  threshold: null,  label: "Server goes offline" },
  { type: "server_online",   enabled: true,  threshold: null,  label: "Server comes back online" },
  { type: "fps_low",         enabled: true,  threshold: 10,    label: "FPS drops below threshold" },
  { type: "high_memory",     enabled: false, threshold: 3000,  label: "Memory exceeds threshold (MB)" },
  { type: "player_join",     enabled: false, threshold: null,  label: "Player joins the server" },
  { type: "player_leave",    enabled: false, threshold: null,  label: "Player leaves the server" },
];

export async function GET(request: NextRequest) {
  const { response } = await requireUser(request);
  if (response) return response;

  const saved = await prisma.notificationRule.findMany();
  const savedMap = new Map(saved.map((r) => [r.type, r]));

  const rules = DEFAULT_RULES.map((def) => {
    const s = savedMap.get(def.type);
    return {
      type: def.type,
      label: def.label,
      enabled: s ? s.enabled : def.enabled,
      threshold: s ? s.threshold : def.threshold,
    };
  });

  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  const { response } = await requireUser(request);
  if (response) return response;

  const body = await request.json() as { type: string; enabled: boolean; threshold?: number | null }[];

  await Promise.all(
    body.map((rule) =>
      prisma.notificationRule.upsert({
        where: { type: rule.type },
        create: { type: rule.type, enabled: rule.enabled, threshold: rule.threshold ?? null },
        update: { enabled: rule.enabled, threshold: rule.threshold ?? null, updatedAt: new Date() },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
