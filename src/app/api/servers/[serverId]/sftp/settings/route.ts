import { NextRequest, NextResponse } from "next/server";
import { canManage, requireUser } from "@/lib/api";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { sftpSettingsSchema } from "@/lib/validators";

type Params = { params: Promise<{ serverId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { user, response } = await requireUser(request);
  if (response) return response;
  if (!canManage(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { serverId } = await params;
  const parsed = sftpSettingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const server = await prisma.serverProfile.update({
    where: { id: serverId },
    data: {
      modFramework: input.modFramework,
      sftpEnabled: input.sftpEnabled,
      sftpProtocol: input.sftpProtocol,
      sftpHost: input.sftpHost || null,
      sftpPort: input.sftpPort,
      sftpUsername: input.sftpUsername || null,
      sftpRootPath: input.sftpRootPath || null,
      sftpDefaultPluginPath: input.sftpDefaultPluginPath || null,
      sftpDefaultConfigPath: input.sftpDefaultConfigPath || null,
      sftpAllowOutsideRoot: input.sftpAllowOutsideRoot,
      ...(input.sftpPassword ? { sftpPasswordEncrypted: encryptSecret(input.sftpPassword) } : {}),
      ...(input.sftpPrivateKey ? { sftpPrivateKeyEncrypted: encryptSecret(input.sftpPrivateKey) } : {}),
    },
    select: {
      id: true,
      modFramework: true,
      sftpEnabled: true,
      sftpProtocol: true,
      sftpHost: true,
      sftpPort: true,
      sftpUsername: true,
      sftpRootPath: true,
      sftpDefaultPluginPath: true,
      sftpDefaultConfigPath: true,
      sftpAllowOutsideRoot: true,
    },
  });

  return NextResponse.json({ server });
}
