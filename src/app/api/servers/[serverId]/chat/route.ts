import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { chatMessageSchema } from "@/lib/validators";
import { executeServerCommand } from "@/server/rcon/service";

type Params = { params: Promise<{ serverId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const parsed = chatMessageSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  const sanitized = parsed.data.message.replace(/"/g, "'");

  try {
    const output = await executeServerCommand(server, `say "${sanitized}"`);
    return NextResponse.json({ output });
  } catch (error) {
    if (typeof error === "object" && error && "details" in error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Failed to send message",
          details: error.details,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send message" },
      { status: 502 },
    );
  }
}
