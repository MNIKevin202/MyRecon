import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  const { response } = await requireUser(request);
  if (response) return response;

  const categories = await prisma.commandCategory.findMany({
    orderBy: { name: "asc" },
    include: {
      commands: { orderBy: { createdAt: "asc" } },
    },
  });

  return NextResponse.json({ categories });
}

export async function POST(request: NextRequest) {
  const { response } = await requireUser(request);
  if (response) return response;

  const parsed = categorySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category data" }, { status: 400 });
  }

  const category = await prisma.commandCategory.create({
    data: {
      name: parsed.data.name,
      serverId: parsed.data.serverId ?? null,
    },
    include: { commands: true },
  });

  return NextResponse.json({ category }, { status: 201 });
}
