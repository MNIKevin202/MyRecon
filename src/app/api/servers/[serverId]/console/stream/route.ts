import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { buildRconErrorDetails, formatRconError } from "@/server/rcon/errors";
import { normalizeRconType } from "@/server/rcon/service";
import { WebRconClient } from "@/server/rcon/web-rcon";

type Params = { params: Promise<{ serverId: string }> };

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) {
    return new Response(sse("error", { message: "Server not found" }), {
      status: 404,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  if (normalizeRconType(server.rconType) !== "WEBRCON") {
    return new Response(
      sse("error", {
        message: "Live streaming is currently available for WebRCON profiles.",
        rconType: server.rconType,
      }),
      { status: 400, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  const encoder = new TextEncoder();
  let client: WebRconClient | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sse(event, data)));
      };

      send("state", { state: "connecting", timestamp: new Date().toISOString() });

      client = new WebRconClient({
        host: server.host,
        port: server.rconPort,
        password: decryptSecret(server.encryptedRconPassword).trim(),
        timeoutMs: 9000,
        onMessage(message) {
          send("message", {
            timestamp: new Date().toISOString(),
            message,
          });
        },
      });

      try {
        await client.connect();
        send("state", { state: "connected", timestamp: new Date().toISOString() });

        request.signal.addEventListener("abort", () => {
          client?.close();
          controller.close();
        });
      } catch (error) {
        const details = buildRconErrorDetails(server, error);
        await prisma.serverEvent.create({
          data: {
            serverId: server.id,
            source: "rcon",
            level: "error",
            message: formatRconError(details),
          },
        });
        send("rcon-error", details);
        controller.close();
      }
    },
    cancel() {
      client?.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
