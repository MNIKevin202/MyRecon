import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { listPluginPermissionAccess } from "@/server/plugins/permissions";

type Params = { params: Promise<{ serverId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const permission = request.nextUrl.searchParams.get("permission")?.trim();
  const framework = request.nextUrl.searchParams.get("framework")?.trim();
  const syncRcon = request.nextUrl.searchParams.get("sync") === "1";
  if (!permission) {
    return NextResponse.json({ error: "Permission is required" }, { status: 400 });
  }

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  try {
    const result = await listPluginPermissionAccess(server, permission, framework, syncRcon);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load permission access",
        details: typeof error === "object" && error && "details" in error ? error.details : undefined,
      },
      { status: 502 },
    );
  }
}
