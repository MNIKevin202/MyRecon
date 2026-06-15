import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canManage, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveRemotePath } from "@/server/sftp/service";

type Params = { params: Promise<{ serverId: string }> };

const schema = z.object({
  directory: z.string().trim().min(1).max(1000),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  const { user, response } = await requireUser(request);
  if (response) return response;
  if (!canManage(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Plugin directory is required" }, { status: 400 });
  }

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  try {
    const safeDirectory = resolveRemotePath(server, parsed.data.directory);
    const updated = await prisma.serverProfile.update({
      where: { id: serverId },
      data: { sftpDefaultPluginPath: safeDirectory },
      select: {
        id: true,
        name: true,
        isDefault: true,
        sftpEnabled: true,
        sftpRootPath: true,
        sftpDefaultPluginPath: true,
      },
    });

    return NextResponse.json({ server: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save plugin directory" },
      { status: 400 },
    );
  }
}
