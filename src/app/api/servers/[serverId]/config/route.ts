import { NextRequest, NextResponse } from "next/server";
import { canManage, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getServerConfig, setServerConfig } from "@/server/rcon/server-config";

type Params = { params: Promise<{ serverId: string }> };

// GET /api/servers/[serverId]/config — read current server convar values
export async function GET(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  try {
    return NextResponse.json(await getServerConfig(server));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read server config" },
      { status: 502 },
    );
  }
}

// POST /api/servers/[serverId]/config — apply convar values + server.writecfg
export async function POST(request: NextRequest, { params }: Params) {
  const { user, response } = await requireUser(request);
  if (response) return response;
  if (!canManage(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  let body: { values?: Record<string, string> };
  try { body = await request.json(); } catch { body = {}; }
  if (!body.values || typeof body.values !== "object") {
    return NextResponse.json({ error: "values object required" }, { status: 400 });
  }

  try {
    return NextResponse.json(await setServerConfig(server, body.values));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save server config" },
      { status: 502 },
    );
  }
}
