import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { attachSessionCookie, createSession } from "@/lib/session";
import { setupSchema } from "@/lib/validators";
import { executeServerCommand } from "@/server/rcon/service";

export async function POST(request: NextRequest) {
  const existingUsers = await prisma.user.count();
  const existingServers = await prisma.serverProfile.count();

  if (existingUsers > 0 && existingServers > 0) {
    return NextResponse.json({ error: "Setup has already been completed" }, { status: 409 });
  }

  const parsed = setupSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const passwordHash = await bcrypt.hash(input.ownerPassword, 12);

  const result = await prisma.$transaction(async (tx) => {
    const user =
      existingUsers === 0
        ? await tx.user.create({
            data: {
              email: input.ownerEmail.toLowerCase(),
              name: input.ownerName,
              passwordHash,
              role: "OWNER",
            },
          })
        : await tx.user.findFirstOrThrow({ where: { role: "OWNER" } });

    const server = await tx.serverProfile.create({
      data: {
        name: input.name,
        host: input.host,
        gamePort: input.gamePort,
        rconPort: input.rconPort,
        rconType: input.rconType,
        encryptedRconPassword: encryptSecret(input.rconPassword),
        notes: input.notes,
        isDefault: true,
        quickActions: {
          create: [
            { label: "Save", command: "server.save" },
            { label: "Status", command: "status" },
            { label: "Restart Warning", command: "say Server restart in 5 minutes", requiresConfirm: true },
          ],
        },
      },
    });

    return { user, server };
  });

  let connection;
  try {
    const server = await prisma.serverProfile.findUniqueOrThrow({ where: { id: result.server.id } });
    const raw = await executeServerCommand(server, "status");
    connection = { ok: true, message: raw };
  } catch (error) {
    connection = {
      ok: false,
      message: error instanceof Error ? error.message : "Configuration saved, but test failed",
    };
  }

  const session = await createSession(result.user.id);
  const response = NextResponse.json({ serverId: result.server.id, connection });
  attachSessionCookie(response, session);
  return response;
}
