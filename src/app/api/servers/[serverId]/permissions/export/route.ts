import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { exportPermissionSetupCommands } from "@/server/plugins/permissions";

type Params = { params: Promise<{ serverId: string }> };

// GET /api/servers/[serverId]/permissions/export
// Returns the full list of commands needed to reproduce this server's
// admin/mod/permission setup (groups, group perms, user perms, user groups).
export async function GET(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  try {
    const result = await exportPermissionSetupCommands(server);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export permissions" },
      { status: 502 },
    );
  }
}
