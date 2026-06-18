import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { executeServerCommand } from "@/server/rcon/service";

type Params = { params: Promise<{ serverId: string }> };

function parse(raw: string) {
  try { return JSON.parse(raw); }
  catch { return { error: "Plugin not responding. Is MyRconBlackMarket installed and loaded?" }; }
}

// GET ?type=markets|analytics|buyers
export async function GET(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const type = new URL(request.url).searchParams.get("type") ?? "markets";
  const command =
    type === "analytics" ? "bm.getanalytics"
    : type === "buyers"  ? "bm.getbuyers"
    : "bm.getmarkets";

  try {
    const raw = await executeServerCommand(server, command);
    return NextResponse.json(parse(raw));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "RCON command failed" }, { status: 502 });
  }
}

// POST { action, ... }
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

  let command: string;
  switch (action) {
    case "additem":     command = `bm.additem ${s(b.market)} ${s(b.shortname)} ${s(b.price)} ${s(b.amount)} ${s(b.displayName)}`.trim(); break;
    case "updateitem":  command = `bm.updateitem ${s(b.market)} ${s(b.item)} ${s(b.price)} ${s(b.amount)} ${s(b.displayName)}`.trim(); break;
    case "removeitem":  command = `bm.removeitem ${s(b.market)} ${s(b.item)}`; break;
    case "setcurrency": command = `bm.setcurrency ${s(b.market)} ${s(b.shortname)} ${s(b.name)}`.trim(); break;
    case "setnpc":      command = `bm.setnpc ${s(b.market)} ${b.showName ? "1" : "0"} ${s(b.name)}`.trim(); break;
    case "setsign":      command = `bm.setsign ${s(b.market)} ${b.sign ? "1" : "0"} ${s(b.text)}`.trim(); break;
    case "setsignimage": command = `bm.setsignimage ${s(b.market)} ${s(b.url)}`.trim(); break;
    case "placenpc":    command = `bm.placenpc ${s(b.x)} ${s(b.y)} ${s(b.z)} ${s(b.yaw ?? "0")}`.trim(); break;
    case "removenpc":   command = `bm.removenpc ${s(b.market)}`; break;
    case "clone":       command = `bm.clone ${s(b.src)} ${s(b.dst)}`; break;
    default: return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  try {
    const raw = await executeServerCommand(server, command.trim());
    return NextResponse.json(parse(raw));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "RCON command failed" }, { status: 502 });
  }
}
