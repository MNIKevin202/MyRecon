import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { savedCommandSchema } from "@/lib/validators";

type Params = { params: Promise<{ commandId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { commandId } = await params;
  const parsed = savedCommandSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const command = await prisma.savedCommand.update({
    where: { id: commandId },
    data: {
      label: parsed.data.label,
      command: parsed.data.command,
      categoryId: parsed.data.categoryId ?? null,
      dangerous: parsed.data.dangerous,
      requiresConfirm: parsed.data.requiresConfirm,
    },
    include: { category: true },
  });

  return NextResponse.json({ command });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { commandId } = await params;
  await prisma.savedCommand.delete({ where: { id: commandId } });

  return NextResponse.json({ ok: true });
}
