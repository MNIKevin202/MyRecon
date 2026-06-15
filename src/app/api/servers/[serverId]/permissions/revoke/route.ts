import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canManage, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { revokePluginPermission } from "@/server/plugins/permissions";

type Params = { params: Promise<{ serverId: string }> };

const schema = z.object({
  steamId: z.string().trim().min(15).max(20),
  permission: z.string().trim().min(1).max(160),
  framework: z.enum(["AUTO", "CARBON", "OXIDE"]).optional().default("AUTO"),
});

export async function POST(request: NextRequest, { params }: Params) {
  const { user, response } = await requireUser(request);
  if (response) return response;
  if (!canManage(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "SteamID and permission are required" }, { status: 400 });
  }

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  try {
    const result = await revokePluginPermission(server, parsed.data.steamId, parsed.data.permission, parsed.data.framework);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Permission revoke failed",
        details: typeof error === "object" && error && "details" in error ? error.details : undefined,
      },
      { status: 502 },
    );
  }
}
