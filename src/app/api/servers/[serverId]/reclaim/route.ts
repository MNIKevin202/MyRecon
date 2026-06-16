import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { executeServerCommand } from "@/server/rcon/service";

type Params = { params: Promise<{ serverId: string }> };

function parseReclaimResponse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    // Plugin not installed or command failed
    return { error: "Plugin not responding. Is MyRconReclaim installed and loaded?" };
  }
}

// GET /api/servers/[serverId]/reclaim?type=summary|bases|vehicles|deployables|protected|history&page=0&size=50
export async function GET(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "summary";
  const page = parseInt(searchParams.get("page") ?? "0", 10);
  const size = parseInt(searchParams.get("size") ?? "50", 10);

  let command: string;
  switch (type) {
    case "bases":       command = `reclaim.getbases ${page} ${size}`;       break;
    case "vehicles":    command = `reclaim.getvehicles ${page} ${size}`;    break;
    case "deployables": command = `reclaim.getdeployables ${page} ${size}`; break;
    case "protected":   command = "reclaim.getprotected";                   break;
    case "history":     command = `reclaim.gethistory ${page}`;             break;
    default:            command = "reclaim.getsummary";
  }

  try {
    const raw = await executeServerCommand(server, command);
    return NextResponse.json(parseReclaimResponse(raw));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "RCON command failed" },
      { status: 502 },
    );
  }
}

// POST /api/servers/[serverId]/reclaim
// body: { action, netId? }
// action: "scan" | "protect" | "unprotect" | "ignore" | "unignore" | "delete"
export async function POST(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  let body: { action?: string; netId?: string };
  try { body = await request.json(); } catch { body = {}; }

  const { action, netId } = body;
  if (!action) return NextResponse.json({ error: "action required" }, { status: 400 });

  const requiresNetId = action !== "scan";
  if (requiresNetId && !netId) return NextResponse.json({ error: "netId required" }, { status: 400 });

  const command = action === "scan"
    ? "reclaim.scan"
    : `reclaim.${action} ${netId}`;

  try {
    const raw = await executeServerCommand(server, command);
    return NextResponse.json(parseReclaimResponse(raw));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "RCON command failed" },
      { status: 502 },
    );
  }
}
