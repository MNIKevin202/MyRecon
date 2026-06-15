import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { savedCommandSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const { response } = await requireUser(request);
  if (response) return response;

  const commands = await prisma.savedCommand.findMany({
    orderBy: { createdAt: "asc" },
    include: { category: true },
  });

  return NextResponse.json({ commands });
}

export async function POST(request: NextRequest) {
  const { response } = await requireUser(request);
  if (response) return response;

  const parsed = savedCommandSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid command data" }, { status: 400 });
  }

  const command = await prisma.savedCommand.create({
    data: {
      label: parsed.data.label,
      command: parsed.data.command,
      categoryId: parsed.data.categoryId ?? null,
      dangerous: parsed.data.dangerous,
      requiresConfirm: parsed.data.requiresConfirm,
    },
    include: { category: true },
  });

  return NextResponse.json({ command }, { status: 201 });
}
