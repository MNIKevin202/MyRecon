import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { inferConnectionStatus, readServerStatus } from "@/server/rcon/service";

type Params = { params: Promise<{ serverId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  const status = await readServerStatus(server);
  const inferredConnectionStatus = status.online ? "connected" : await inferConnectionStatus(serverId);
  const events = await prisma.serverEvent.findMany({
    where: {
      serverId,
      ...(status.online ? { level: { not: "error" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  return NextResponse.json({ status, events, inferredConnectionStatus });
}
