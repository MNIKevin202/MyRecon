import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { response } = await requireUser(request);
  if (response) return response;

  const serverId = request.nextUrl.searchParams.get("serverId");

  const runs = await prisma.commandRun.findMany({
    where: serverId ? { serverId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      server: { select: { name: true } },
    },
  });

  return NextResponse.json({ runs });
}
