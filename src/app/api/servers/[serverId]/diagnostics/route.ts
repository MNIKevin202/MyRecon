import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { APP_VERSION, BUILD_STAMP } from "@/lib/version";
import { getRconConnectionDetails, inferConnectionStatus, probeLiveStatus } from "@/server/rcon/service";
import { parseStoredCommandOutput } from "@/server/rcon/status";

type Params = { params: Promise<{ serverId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { response } = await requireUser(request);
    if (response) return response;

    const { serverId } = await params;
    const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    const [liveStatus, lastSuccessfulCommand, lastRconError, lastErrors, inferredStatus] =
      await Promise.all([
        probeLiveStatus(server),
        prisma.serverEvent.findFirst({
          where: { serverId, level: "info", source: "console" },
          orderBy: { createdAt: "desc" },
        }),
        prisma.serverEvent.findFirst({
          where: { serverId, level: "error", source: "rcon" },
          orderBy: { createdAt: "desc" },
        }),
        prisma.serverEvent.findMany({
          where: {
            serverId,
            level: "error",
            source: "rcon",
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        inferConnectionStatus(serverId),
      ]);

    const filteredErrors = lastSuccessfulCommand
      ? lastErrors.filter((event) => event.createdAt > lastSuccessfulCommand.createdAt)
      : lastErrors;

    const lastSuccessfulCommandName = lastSuccessfulCommand
      ? parseStoredCommandOutput(lastSuccessfulCommand.message)?.command ?? "unknown"
      : null;

    return NextResponse.json({
      buildStamp: BUILD_STAMP,
      appVersion: APP_VERSION,
      server: {
        id: server.id,
        name: server.name,
        host: server.host,
        gamePort: server.gamePort,
        rconPort: server.rconPort,
        rconType: server.rconType,
      },
      connectionDetails: {
        ...getRconConnectionDetails(server),
        passwordHasSurroundingWhitespace: (() => {
          const password = decryptSecret(server.encryptedRconPassword);
          return password !== password.trim();
        })(),
        connectionState: liveStatus.online ? "connected" : inferredStatus,
        lastSuccessfulConnectionAt: lastSuccessfulCommand?.createdAt.toISOString() ?? null,
        lastSuccessfulCommandAt: lastSuccessfulCommand?.createdAt.toISOString() ?? null,
        lastSuccessfulCommandName,
        lastErrorAt: lastRconError?.createdAt.toISOString() ?? null,
        lastError: lastRconError?.message ?? null,
      },
      inferredConnectionStatus: inferredStatus,
      lastSuccessfulCommandName,
      lastRconErrorAt: lastRconError?.createdAt.toISOString() ?? null,
      lastRconErrors: filteredErrors.map((event) => ({
        timestamp: event.createdAt.toISOString(),
        message: event.message,
      })),
      staleErrorsHiddenSince: lastSuccessfulCommand?.createdAt.toISOString() ?? null,
      lastSuccessfulCommandAt: lastSuccessfulCommand?.createdAt.toISOString() ?? null,
      liveStatus,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Diagnostics failed",
      },
      { status: 500 },
    );
  }
}
