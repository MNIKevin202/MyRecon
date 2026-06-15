import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { runCommandSchema } from "@/lib/validators";
import { executeServerCommand } from "@/server/rcon/service";

export async function POST(request: NextRequest) {
  const { response } = await requireUser(request);
  if (response) return response;

  const parsed = runCommandSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { serverId, command, label, savedCommandId } = parsed.data;

  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  let output: string | null = null;
  let success = true;
  let errorDetails: unknown = null;

  try {
    output = await executeServerCommand(server, command);
  } catch (error) {
    success = false;
    errorDetails = typeof error === "object" && error !== null && "details" in error ? error.details : null;
    output = error instanceof Error ? error.message : "Command failed";
  }

  await prisma.commandRun.create({
    data: {
      serverId,
      savedCommandId: savedCommandId ?? null,
      command,
      label: label ?? null,
      output,
      success,
    },
  });

  if (!success) {
    return NextResponse.json(
      { error: output, details: errorDetails },
      { status: 502 },
    );
  }

  return NextResponse.json({ output });
}
