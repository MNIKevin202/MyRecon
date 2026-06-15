import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { commandSchema } from "@/lib/validators";
import { executeServerCommand } from "@/server/rcon/service";

type Params = { params: Promise<{ serverId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const events = await prisma.serverEvent.findMany({
    where: { serverId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ logs: events.reverse() });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const parsed = commandSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Command is required" }, { status: 400 });
  }

  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  try {
    const output = await executeServerCommand(server, parsed.data.command);
    return NextResponse.json({ output });
  } catch (error) {
    if (typeof error === "object" && error && "details" in error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Command failed",
          details: error.details,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Command failed" },
      { status: 502 },
    );
  }
}
