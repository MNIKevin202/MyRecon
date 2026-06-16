import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { executeServerCommand } from "@/server/rcon/service";

type Params = { params: Promise<{ serverId: string }> };

const schema = z.object({
  steamId: z.string().min(1),
  itemShortname: z.string().min(1).max(64),
  amount: z.number().int().min(1).max(100000),
});

export async function POST(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const body = schema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { steamId, itemShortname, amount } = body.data;

  await executeServerCommand(server, `inventory.giveto ${steamId} ${itemShortname} ${amount}`);

  return NextResponse.json({ ok: true });
}
