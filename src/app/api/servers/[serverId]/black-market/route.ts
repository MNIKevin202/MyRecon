import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { executeServerCommand } from "@/server/rcon/service";

type Params = { params: Promise<{ serverId: string }> };

function parse(raw: string) {
  try { return JSON.parse(raw); }
  catch { return { error: "Plugin not responding. Is MyRconBlackMarket installed and loaded?" }; }
}

// GET /api/servers/[serverId]/black-market?type=config|npcs
export async function GET(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const type = new URL(request.url).searchParams.get("type") ?? "config";
  const command = type === "npcs" ? "bm.getnpcs" : "bm.getconfig";

  try {
    const raw = await executeServerCommand(server, command);
    return NextResponse.json(parse(raw));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "RCON command failed" },
      { status: 502 },
    );
  }
}

// POST /api/servers/[serverId]/black-market
// body: { action, ...fields }
export async function POST(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { b = {}; }
  const action = String(b.action ?? "");

  const s = (v: unknown) => String(v ?? "").trim();
  // Quote-free single tokens; names can contain spaces (plugin joins trailing args)
  let command: string;
  switch (action) {
    case "additem":
      command = `bm.additem ${s(b.shortname)} ${s(b.price)} ${s(b.amount)} ${s(b.displayName)}`.trim();
      break;
    case "updateitem":
      command = `bm.updateitem ${s(b.index)} ${s(b.price)} ${s(b.amount)} ${s(b.displayName)}`.trim();
      break;
    case "removeitem":
      command = `bm.removeitem ${s(b.index)}`;
      break;
    case "setcurrency":
      command = `bm.setcurrency ${s(b.shortname)} ${s(b.name)}`.trim();
      break;
    case "placenpc":
      command = `bm.placenpc ${s(b.x)} ${s(b.y)} ${s(b.z)} ${s(b.yaw ?? "0")}`.trim();
      break;
    case "removenpc":
      command = `bm.removenpc ${s(b.index)}`;
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
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
