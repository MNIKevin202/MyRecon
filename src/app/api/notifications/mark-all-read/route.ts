import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const { response } = await requireUser(request);
  if (response) return response;

  await prisma.appNotification.updateMany({
    where: { read: false },
    data: { read: true },
  });

  return NextResponse.json({ ok: true });
}
