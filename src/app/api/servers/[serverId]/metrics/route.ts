import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ serverId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;

  const since = new Date(Date.now() - 30 * 60 * 1000);

  const metrics = await prisma.serverMetric.findMany({
    where: { serverId, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, fps: true, players: true, memoryMb: true },
  });

  return NextResponse.json({ metrics });
}
