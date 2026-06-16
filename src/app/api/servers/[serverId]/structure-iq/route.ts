import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { executeServerCommand } from "@/server/rcon/service";

type Params = { params: Promise<{ serverId: string }> };

function parse(raw: string) {
  try { return JSON.parse(raw); }
  catch { return { error: "Plugin not responding. Is MyRconStructureIQ installed and loaded?" }; }
}

// GET /api/servers/[serverId]/structure-iq?type=summary|structures|owners|hotspots|limits|protected|notes&page=0&size=100&sort=score&id=<id>
export async function GET(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const sp   = new URL(request.url).searchParams;
  const type = sp.get("type") ?? "summary";
  const page = parseInt(sp.get("page") ?? "0", 10);
  const size = parseInt(sp.get("size") ?? "100", 10);
  const sort = sp.get("sort") ?? "score";
  const id   = sp.get("id") ?? "";

  let command: string;
  switch (type) {
    case "structures": command = `siq.getstructures ${page} ${size} ${sort}`; break;
    case "structure":  command = `siq.getstructure ${id}`;                    break;
    case "owners":     command = `siq.getowners ${page} ${size}`;             break;
    case "hotspots":   command = "siq.gethotspots";                           break;
    case "limits":     command = `siq.getlimits ${page} ${size}`;            break;
    case "protected":  command = "siq.getprotected";                          break;
    case "notes":      command = "siq.getnotes";                              break;
    default:           command = "siq.getsummary";
  }

  try {
    const raw = await executeServerCommand(server, command.trim());
    return NextResponse.json(parse(raw));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "RCON command failed" },
      { status: 502 },
    );
  }
}

// POST /api/servers/[serverId]/structure-iq
// body: { action, id?, message? }
// action: scan | protect | unprotect | ignore | unignore | note | deletenote | refresh
export async function POST(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  let body: { action?: string; id?: string; message?: string };
  try { body = await request.json(); } catch { body = {}; }

  const { action, id, message } = body;
  if (!action) return NextResponse.json({ error: "action required" }, { status: 400 });

  let command: string;
  switch (action) {
    case "scan":       command = "siq.scan";                        break;
    case "protect":    command = `siq.protect ${id}`;              break;
    case "unprotect":  command = `siq.unprotect ${id}`;            break;
    case "ignore":     command = `siq.ignore ${id}`;               break;
    case "unignore":   command = `siq.unignore ${id}`;             break;
    case "note":       command = `siq.note ${id} ${message ?? ""}`; break;
    case "deletenote": command = `siq.deletenote ${id}`;           break;
    case "refresh":    command = `siq.refresh ${id}`;              break;
    default: return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  try {
    const raw = await executeServerCommand(server, command.trim());
    return NextResponse.json(parse(raw));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "RCON command failed" },
      { status: 502 },
    );
  }
}
