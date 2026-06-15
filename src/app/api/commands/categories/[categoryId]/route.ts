import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/validators";

type Params = { params: Promise<{ categoryId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { categoryId } = await params;
  const parsed = categorySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const category = await prisma.commandCategory.update({
    where: { id: categoryId },
    data: { name: parsed.data.name },
    include: { commands: true },
  });

  return NextResponse.json({ category });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { categoryId } = await params;
  await prisma.commandCategory.delete({ where: { id: categoryId } });

  return NextResponse.json({ ok: true });
}
