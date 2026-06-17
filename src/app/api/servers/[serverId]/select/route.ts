import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { markServerSelected } from "@/lib/active-server";

type Params = { params: Promise<{ serverId: string }> };

// POST /api/servers/[serverId]/select
// Sets the active server for this launch. Marks it as the default profile
// (the app uses isDefault everywhere as "the current server") and flips the
// per-launch selection flag so the startup gate is satisfied.
export async function POST(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.serverProfile.updateMany({ data: { isDefault: false } }),
    prisma.serverProfile.update({ where: { id: serverId }, data: { isDefault: true } }),
  ]);

  markServerSelected();

  return NextResponse.json({ ok: true });
}
