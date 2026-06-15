import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { testWebRconConnection } from "@/server/rcon/service";

type Params = { params: Promise<{ serverId: string }> };
const testSchema = z.object({
  password: z.string().max(512).optional(),
});

export async function POST(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const parsed = testSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid test payload" }, { status: 400 });
  }

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  const passwordOverride = parsed.data.password?.trim() || undefined;
  const result = await testWebRconConnection(server, passwordOverride);
  return NextResponse.json(result);
}
