import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { id } = await params;
  const body = await request.json() as { read?: boolean; saved?: boolean };

  const notification = await prisma.appNotification.update({
    where: { id },
    data: {
      ...(body.read !== undefined && { read: body.read }),
      ...(body.saved !== undefined && { saved: body.saved }),
    },
  });

  return NextResponse.json({ notification });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { id } = await params;
  await prisma.appNotification.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
