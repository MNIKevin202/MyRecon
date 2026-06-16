import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { response } = await requireUser(request);
  if (response) return response;

  const notifications = await prisma.appNotification.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const unreadCount = await prisma.appNotification.count({ where: { read: false } });

  return NextResponse.json({ notifications, unreadCount });
}

export async function DELETE(request: NextRequest) {
  const { response } = await requireUser(request);
  if (response) return response;

  const url = new URL(request.url);
  const keepSaved = url.searchParams.get("keepSaved") !== "false";

  await prisma.appNotification.deleteMany({
    where: keepSaved ? { saved: false } : {},
  });

  return NextResponse.json({ ok: true });
}
