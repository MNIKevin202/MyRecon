import type { ServerProfile } from "@prisma/client";

export type RconConnectionState =
  | "connected"
  | "connecting"
  | "disconnected"
  | "wrong_password"
  | "wrong_rcon_type"
  | "port_unreachable"
  | "timeout"
  | "server_offline"
  | "unsupported_response";

export type RconErrorDetails = {
  message: string;
  timestamp: string;
  serverName: string;
  host: string;
  gamePort: number;
  rconPort: number;
  rconType: string;
  state: RconConnectionState;
  stack?: string;
  suggestedFix?: string;
};

export class RconConnectionError extends Error {
  readonly state: RconConnectionState;
  readonly suggestedFix?: string;

  constructor(message: string, state: RconConnectionState, suggestedFix?: string) {
    super(message);
    this.name = "RconConnectionError";
    this.state = state;
    this.suggestedFix = suggestedFix;
  }
}

export function classifyRconError(error: unknown): {
  message: string;
  state: RconConnectionState;
  stack?: string;
  suggestedFix?: string;
} {
  if (error instanceof RconConnectionError) {
    return {
      message: error.message,
      state: error.state,
      stack: error.stack,
      suggestedFix: error.suggestedFix,
    };
  }

  const message = error instanceof Error ? error.message : "RCON connection failed";
  const stack = error instanceof Error ? error.stack : undefined;
  const lower = message.toLowerCase();

  if (lower.includes("timed out") || lower.includes("timeout")) {
    return {
      message,
      state: "timeout",
      stack,
      suggestedFix: "Verify the host and RCON port, and make sure firewall rules allow the connection.",
    };
  }

  if (
    lower.includes("401") ||
    lower.includes("rejected the password") ||
    lower.includes("wrong password")
  ) {
    return {
      message,
      state: "wrong_password",
      stack,
      suggestedFix: "Verify the RCON password saved in this server profile.",
    };
  }

  if (lower.includes("econnrefused") || lower.includes("enotfound") || lower.includes("ehostunreach")) {
    return {
      message,
      state: "port_unreachable",
      stack,
      suggestedFix: "Verify the server IP and RCON port are reachable from this machine.",
    };
  }

  if (lower.includes("expected http/") || lower.includes("parse error")) {
    return {
      message,
      state: "wrong_rcon_type",
      stack,
      suggestedFix: "The port did not complete a WebSocket handshake. Verify this profile is WebRCON and the Rust server was launched with +rcon.web 1.",
    };
  }

  if (lower.includes("invalid json") || lower.includes("unsupported")) {
    return {
      message,
      state: "unsupported_response",
      stack,
      suggestedFix: "The RCON port responded, but not with a valid Rust RCON message.",
    };
  }

  return {
    message,
    state: "disconnected",
    stack,
    suggestedFix: "Try testing the connection again and verify the selected RCON type.",
  };
}

export function buildRconErrorDetails(
  server: Pick<ServerProfile, "name" | "host" | "gamePort" | "rconPort" | "rconType">,
  error: unknown,
): RconErrorDetails {
  const classified = classifyRconError(error);
  return {
    ...classified,
    timestamp: new Date().toISOString(),
    serverName: server.name,
    host: server.host,
    gamePort: server.gamePort,
    rconPort: server.rconPort,
    rconType: server.rconType,
  };
}

export function formatRconError(details: RconErrorDetails) {
  return [
    `Error: ${details.message}`,
    `Timestamp: ${details.timestamp}`,
    `Server: ${details.serverName}`,
    `Host: ${details.host}`,
    `Game port: ${details.gamePort}`,
    `RCON port: ${details.rconPort}`,
    `RCON type: ${details.rconType}`,
    `State: ${details.state}`,
    details.suggestedFix ? `Suggested fix: ${details.suggestedFix}` : null,
    details.stack ? `Stack:\n${details.stack}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
