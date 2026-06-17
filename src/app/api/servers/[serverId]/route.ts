import { NextRequest, NextResponse } from "next/server";
import { canManage, requireUser } from "@/lib/api";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { serverProfileSchema } from "@/lib/validators";
import { evictPooledConnection } from "@/server/rcon/service";

type Params = { params: Promise<{ serverId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { user, response } = await requireUser(request);
  if (response) return response;
  if (!canManage(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { serverId } = await params;
  const parsed = serverProfileSchema.partial({ rconPassword: true }).safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const server = await prisma.serverProfile.update({
    where: { id: serverId },
    data: {
      name: input.name,
      host: input.host,
      gamePort: input.gamePort,
      rconPort: input.rconPort,
      rconType: input.rconType,
      notes: input.notes,
      ...(input.rconPassword
        ? { encryptedRconPassword: encryptSecret(input.rconPassword) }
        : {}),
    },
    select: {
      id: true,
      name: true,
      host: true,
      gamePort: true,
      rconPort: true,
      rconType: true,
      notes: true,
      isDefault: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Evict any pooled connection so the next command reconnects with new settings
  evictPooledConnection(server);

  return NextResponse.json({ server });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { user, response } = await requireUser(request);
  if (response) return response;
  if (!canManage(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { serverId } = await params;
  await prisma.serverProfile.delete({ where: { id: serverId } });
  const first = await prisma.serverProfile.findFirst({ orderBy: { name: "asc" } });
  if (first) {
    await prisma.serverProfile.update({ where: { id: first.id }, data: { isDefault: true } });
  }

  return NextResponse.json({ ok: true });
}
