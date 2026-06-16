import { NextRequest, NextResponse } from "next/server";
import { canManage, requireUser } from "@/lib/api";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { serverProfileSchema } from "@/lib/validators";

function publicServer(server: {
  id: string;
  name: string;
  host: string;
  gamePort: number;
  rconPort: number;
  rconType: string;
  notes: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return server;
}

export async function GET(request: NextRequest) {
  const { response } = await requireUser(request);
  if (response) return response;

  const servers = await prisma.serverProfile.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      host: true,
      gamePort: true,
      rconPort: true,
      rconType: true,
      modFramework: true,
      sftpEnabled: true,
      sftpHost: true,
      sftpPort: true,
      sftpUsername: true,
      sftpRootPath: true,
      sftpDefaultPluginPath: true,
      sftpDefaultConfigPath: true,
      sftpAllowOutsideRoot: true,
      notes: true,
      isDefault: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ servers });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;
  if (!canManage(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const parsed = serverProfileSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const count = await prisma.serverProfile.count();
  const server = await prisma.serverProfile.create({
    data: {
      name: input.name,
      host: input.host,
      gamePort: input.gamePort,
      rconPort: input.rconPort,
      rconType: input.rconType,
      encryptedRconPassword: encryptSecret(input.rconPassword),
      notes: input.notes,
      isDefault: count === 0,
    },
    select: {
      id: true,
      name: true,
      host: true,
      gamePort: true,
      rconPort: true,
      rconType: true,
      modFramework: true,
      sftpEnabled: true,
      sftpHost: true,
      sftpPort: true,
      sftpUsername: true,
      sftpRootPath: true,
      sftpDefaultPluginPath: true,
      sftpDefaultConfigPath: true,
      sftpAllowOutsideRoot: true,
      notes: true,
      isDefault: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ server: publicServer(server) }, { status: 201 });
}
