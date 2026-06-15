import { NextRequest, NextResponse } from "next/server";
import { canManage, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ serverId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { user, response } = await requireUser(request);
  if (response) return response;
  if (!canManage(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { serverId } = await params;
  await prisma.$transaction([
    prisma.serverProfile.updateMany({ data: { isDefault: false } }),
    prisma.serverProfile.update({ where: { id: serverId }, data: { isDefault: true } }),
  ]);

  return NextResponse.json({ ok: true });
}
