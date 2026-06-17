import { ServerProfile } from "@prisma/client";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import {
  buildRconErrorDetails,
  formatRconError,
  RconConnectionError,
} from "@/server/rcon/errors";
import { SourceRconClient } from "@/server/rcon/source-rcon";
import {
  parseServerInfo,
  parseStatus,
  parseStatusSnapshot,
  parseStoredCommandOutput,
  type ParsedServerStatus,
} from "@/server/rcon/status";
import { WebRconClient } from "@/server/rcon/web-rcon";

export type RconProtocol = "WEBRCON" | "LEGACY" | "EXPERIMENTAL";
export type RconClientImplementation = "WebRconClient" | "SourceRconClient" | "UnsupportedExperimentalRcon";

export type RconConnectionDetails = {
  configuredRconType: string;
  normalizedRconType: RconProtocol;
  actualClientImplementation: RconClientImplementation;
  transport: "websocket" | "source-rcon" | "unsupported";
  websocketUrl?: string;
  passwordHasSurroundingWhitespace?: boolean;
};

export type WebRconTestResult = {
  ok: boolean;
  stage: "socket_open_failed" | "authentication_failed" | "command_failed" | "response_timeout" | "response_received";
  rawResponse: string | null;
  protocolLog: string[];
  connectionDetails: RconConnectionDetails;
  passwordOverrideUsed: boolean;
  passwordOverrideMatchesSaved: boolean | null;
  protocolDetection?: RconProtocolDetection;
  error?: ReturnType<typeof buildRconErrorDetails>;
};

export type RconProtocolDetection = {
  webRcon: {
    ok: boolean;
    error: string | null;
    state: string | null;
  };
  legacy: {
    ok: boolean;
    error: string | null;
    rawResponse: string | null;
  };
  likelyProtocol: "WEBRCON" | "LEGACY" | "UNKNOWN";
  recommendation: string;
};

export function normalizeRconType(type: string | null | undefined): RconProtocol {
  const normalized = String(type ?? "WEBRCON").trim().toUpperCase().replace(/[\s_-]/g, "");
  if (normalized === "WEB" || normalized === "WEBSOCKET" || normalized === "WEBRCON") {
    return "WEBRCON";
  }
  if (normalized === "LEGACY" || normalized === "SOURCERCON" || normalized === "SOURCE") {
    return "LEGACY";
  }
  if (normalized === "EXPERIMENTAL") {
    return "EXPERIMENTAL";
  }
  return "WEBRCON";
}

export function getRconConnectionDetails(server: Pick<ServerProfile, "rconType" | "host" | "rconPort">): RconConnectionDetails {
  const normalizedRconType = normalizeRconType(server.rconType);
  if (normalizedRconType === "WEBRCON") {
    return {
      configuredRconType: server.rconType,
      normalizedRconType,
      actualClientImplementation: "WebRconClient",
      transport: "websocket",
      websocketUrl: `ws://${server.host}:${server.rconPort}/<password hidden>`,
    };
  }

  if (normalizedRconType === "LEGACY") {
    return {
      configuredRconType: server.rconType,
      normalizedRconType,
      actualClientImplementation: "SourceRconClient",
      transport: "source-rcon",
    };
  }

  return {
    configuredRconType: server.rconType,
    normalizedRconType,
    actualClientImplementation: "UnsupportedExperimentalRcon",
    transport: "unsupported",
  };
}

function getRconPassword(server: Pick<ServerProfile, "encryptedRconPassword">, passwordOverride?: string) {
  return (passwordOverride ?? decryptSecret(server.encryptedRconPassword)).trim();
}

function passwordHasSurroundingWhitespace(server: Pick<ServerProfile, "encryptedRconPassword">) {
  const decrypted = decryptSecret(server.encryptedRconPassword);
  return decrypted !== decrypted.trim();
}

function logRconSelection(server: ServerProfile, command: string, details: RconConnectionDetails) {
  const method =
    details.transport === "websocket"
      ? "WebSocket transport"
      : details.transport === "source-rcon"
        ? "Legacy Source RCON transport"
        : "unsupported transport";

  console.info(
    [
      `[RCON] Server: ${server.name}`,
      `[RCON] Type: ${details.normalizedRconType}`,
      `[RCON] Host: ${server.host}`,
      `[RCON] Port: ${server.rconPort}`,
      `[RCON] Command: ${command}`,
      `[RCON] Using ${method}`,
    ].join("\n"),
  );
}

// ── Persistent WebRCON connection pool ───────────────────────────────────────
// Keeps one live WebSocket per server so we don't hammer Rust's rate limiter
// by opening a new connection for every command.
type PoolEntry = { client: WebRconClient; lastUsed: number };
const _pool = new Map<string, PoolEntry>();
const POOL_IDLE_MS = 5 * 60 * 1000; // drop idle connections after 5 minutes

function poolKey(server: Pick<ServerProfile, "host" | "rconPort">) {
  return `${server.host}:${server.rconPort}`;
}

async function getPooledClient(
  server: ServerProfile,
  passwordOverride?: string,
  timeoutMs?: number,
): Promise<WebRconClient> {
  const key = poolKey(server);
  const existing = _pool.get(key);
  if (existing?.client.isConnected()) {
    existing.lastUsed = Date.now();
    return existing.client;
  }

  // Stale entry — remove it
  if (existing) {
    existing.client.close();
    _pool.delete(key);
  }

  const client = new WebRconClient({
    host: server.host,
    port: server.rconPort,
    password: getRconPassword(server, passwordOverride),
    timeoutMs: timeoutMs ?? 8000,
  });
  await client.connect();
  _pool.set(key, { client, lastUsed: Date.now() });
  return client;
}

// Evict a specific server's pooled connection (call after password/host change)
export function evictPooledConnection(server: Pick<ServerProfile, "host" | "rconPort">) {
  const key = poolKey(server);
  _pool.get(key)?.client.close();
  _pool.delete(key);
}

// Evict connections that have been idle longer than POOL_IDLE_MS
function evictIdleConnections() {
  const now = Date.now();
  for (const [key, entry] of _pool) {
    if (now - entry.lastUsed > POOL_IDLE_MS || !entry.client.isConnected()) {
      entry.client.close();
      _pool.delete(key);
    }
  }
}
setInterval(evictIdleConnections, 60_000);

function webClientFor(server: ServerProfile, onDebug?: (message: string) => void, passwordOverride?: string, timeoutMs?: number) {
  return new WebRconClient({
    host: server.host,
    port: server.rconPort,
    password: getRconPassword(server, passwordOverride),
    timeoutMs: timeoutMs ?? 6000,
    onDebug,
  });
}

function sourceClientFor(server: ServerProfile, passwordOverride?: string, timeoutMs?: number) {
  return new SourceRconClient({
    host: server.host,
    port: server.rconPort,
    password: getRconPassword(server, passwordOverride),
    timeoutMs: timeoutMs ?? 9000,
  });
}

async function runServerCommand(
  server: ServerProfile,
  command: string,
  protocol: Exclude<RconProtocol, "EXPERIMENTAL">,
  timeoutMs?: number,
) {
  if (protocol === "WEBRCON") {
    // Use the persistent pool — avoids reconnecting for every command
    let client: WebRconClient;
    try {
      client = await getPooledClient(server, undefined, timeoutMs);
    } catch (error) {
      // If pool connection fails, evict and rethrow
      const key = poolKey(server);
      _pool.get(key)?.client.close();
      _pool.delete(key);
      const details = buildRconErrorDetails(server, error);
      throw Object.assign(new Error(details.message), { details });
    }

    try {
      const result = await client.command(command);
      return typeof result === "string" ? result : result.Message;
    } catch (error) {
      // If the pooled connection died mid-command, evict it so the next call reconnects
      const key = poolKey(server);
      _pool.get(key)?.client.close();
      _pool.delete(key);
      throw error;
    }
  }

  // Legacy (Source RCON) — short-lived connection as before
  const client = sourceClientFor(server, undefined, timeoutMs);
  try {
    return await client.command(command);
  } finally {
    client.close();
  }
}

async function persistRconError(server: ServerProfile, details: ReturnType<typeof buildRconErrorDetails>) {
  await prisma.serverEvent.create({
    data: {
      serverId: server.id,
      source: "rcon",
      level: "error",
      message: formatRconError(details),
    },
  });
}

// Send command and return without waiting for a response — for commands like
// oxide.reload / c.reload where Carbon/Oxide may not send a reply.
export async function fireAndForgetCommand(
  server: ServerProfile,
  command: string,
) {
  const connectionDetails = getRconConnectionDetails(server);
  if (connectionDetails.normalizedRconType === "EXPERIMENTAL") return;

  try {
    // Use a very short timeout — just enough to confirm the socket delivered the frame.
    await runServerCommand(server, command, connectionDetails.normalizedRconType, 3000);
  } catch {
    // Timeout or no-response is expected; swallow it.
  }
}

export async function executeServerCommand(
  server: ServerProfile,
  command: string,
  timeoutMs?: number,
) {
  const connectionDetails = getRconConnectionDetails(server);
  logRconSelection(server, command, connectionDetails);

  if (connectionDetails.normalizedRconType === "EXPERIMENTAL") {
    const error = new RconConnectionError(
      "Experimental RCON is not implemented yet.",
      "unsupported_response",
      "Change this server profile to WebRCON or Legacy, depending on how the Rust server is configured.",
    );
    const details = buildRconErrorDetails(server, error);
    await persistRconError(server, details);
    throw Object.assign(new Error(details.message), { details });
  }

  try {
    const output = await runServerCommand(server, command, connectionDetails.normalizedRconType, timeoutMs);
    await prisma.serverEvent.deleteMany({
      where: {
        serverId: server.id,
        source: "rcon",
        level: "error",
      },
    });

    await prisma.serverEvent.create({
      data: {
        serverId: server.id,
        source: "console",
        level: "info",
        message: `> ${command}\n${output}`.trim(),
      },
    });
    return output;
  } catch (error) {
    const details =
      typeof error === "object" && error && "details" in error
        ? (error.details as ReturnType<typeof buildRconErrorDetails>)
        : buildRconErrorDetails(server, error);

    await persistRconError(server, details);
    throw Object.assign(new Error(details.message), { details });
  }
}

export async function testWebRconConnection(server: ServerProfile, passwordOverride?: string): Promise<WebRconTestResult> {
  const savedPassword = getRconPassword(server);
  const normalizedOverride = passwordOverride?.trim();
  const passwordOverrideUsed = Boolean(normalizedOverride);
  const passwordOverrideMatchesSaved = passwordOverrideUsed ? normalizedOverride === savedPassword : null;
  const protocolLog = [
    `[RCON] Server: ${server.name}`,
    "[RCON] Type: WebRCON",
    `[RCON] Host: ${server.host}`,
    `[RCON] Port: ${server.rconPort}`,
    "[RCON] Using WebSocket transport",
  ];
  const webServer = { ...server, rconType: "WEBRCON" };
  const connectionDetails = {
    ...getRconConnectionDetails(webServer),
    passwordHasSurroundingWhitespace: passwordHasSurroundingWhitespace(server),
  };
  const client = webClientFor(webServer, (message) => protocolLog.push(message), passwordOverride);

  try {
    await client.connect();
  } catch (error) {
    const details = buildRconErrorDetails(webServer, error);
    protocolLog.push(`[RCON] Connect failed: ${details.message}`);
    const protocolDetection = await detectRconProtocol(server, {
      ok: false,
      error: details.message,
      state: details.state,
    }, passwordOverride);
    return {
      ok: false,
      stage: details.state === "wrong_password" ? "authentication_failed" : "socket_open_failed",
      rawResponse: null,
      protocolLog,
      connectionDetails,
      passwordOverrideUsed,
      passwordOverrideMatchesSaved,
      protocolDetection,
      error: details,
    };
  }

  try {
    const response = await client.command("status");
    const protocolDetection = {
      webRcon: { ok: true, error: null, state: null },
      legacy: { ok: false, error: "Legacy probe skipped because WebRCON succeeded.", rawResponse: null },
      likelyProtocol: "WEBRCON" as const,
      recommendation: "Keep this profile set to WebRCON.",
    };
    return {
      ok: true,
      stage: "response_received",
      rawResponse: response.Message,
      protocolLog,
      connectionDetails,
      passwordOverrideUsed,
      passwordOverrideMatchesSaved,
      protocolDetection,
    };
  } catch (error) {
    const details = buildRconErrorDetails(webServer, error);
    protocolLog.push(`[RCON] Command failed: ${details.message}`);
    const protocolDetection = await detectRconProtocol(server, {
      ok: false,
      error: details.message,
      state: details.state,
    }, passwordOverride);
    return {
      ok: false,
      stage: details.state === "timeout" ? "response_timeout" : "command_failed",
      rawResponse: null,
      protocolLog,
      connectionDetails,
      passwordOverrideUsed,
      passwordOverrideMatchesSaved,
      protocolDetection,
      error: details,
    };
  } finally {
    client.close();
  }
}

async function detectRconProtocol(
  server: ServerProfile,
  webRcon: RconProtocolDetection["webRcon"],
  passwordOverride?: string,
): Promise<RconProtocolDetection> {
  const legacy = await testLegacyProbe(server, passwordOverride);
  const likelyProtocol = webRcon.ok ? "WEBRCON" : legacy.ok ? "LEGACY" : "UNKNOWN";
  const webClosedHandshake =
    webRcon.state === "wrong_rcon_type" &&
    (webRcon.error?.toLowerCase().includes("closed the websocket handshake") ||
      webRcon.error?.toLowerCase().includes("did not complete a websocket handshake"));
  const legacyReset =
    legacy.error?.toLowerCase().includes("econnreset") ||
    legacy.error?.toLowerCase().includes("connection closed");
  const recommendation =
    likelyProtocol === "WEBRCON"
      ? "Keep this profile set to WebRCON."
      : likelyProtocol === "LEGACY"
        ? "This port answered Legacy RCON after rejecting WebRCON. Set the profile to Legacy, or enable +rcon.web 1 and expose the WebRCON port."
        : webClosedHandshake && legacyReset
          ? "The port is reachable but never returns a WebSocket upgrade and also resets Legacy probes. The saved and temporary passwords match, so verify the running RustDedicated process, not just the .bat file: fully restart it with +rcon.web 1, +rcon.port set to this port, and the expected +rcon.password. If connecting remotely, also try adding +rcon.ip 0.0.0.0 and confirm no host firewall/proxy is filtering WebSocket upgrade traffic."
        : "Neither WebRCON nor Legacy returned a valid status response. Verify the host, port, password, and server startup flags.";

  return {
    webRcon,
    legacy,
    likelyProtocol,
    recommendation,
  };
}

async function testLegacyProbe(server: ServerProfile, passwordOverride?: string): Promise<RconProtocolDetection["legacy"]> {
  const legacyServer = { ...server, rconType: "LEGACY" };
  const client = new SourceRconClient({
    host: server.host,
    port: server.rconPort,
    password: getRconPassword(server, passwordOverride),
    timeoutMs: 6000,
  });

  try {
    const rawResponse = await client.command("status");
    return {
      ok: true,
      error: null,
      rawResponse,
    };
  } catch (error) {
    const details = buildRconErrorDetails(legacyServer, error);
    return {
      ok: false,
      error: details.message,
      rawResponse: null,
    };
  } finally {
    client.close();
  }
}

export async function testServerConnection(server: ServerProfile) {
  return readServerStatus(server);
}

export async function getCachedStatusSnapshot(serverId: string) {
  const events = await prisma.serverEvent.findMany({
    where: {
      serverId,
      level: "info",
      source: "console",
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  for (const event of events) {
    const stored = parseStoredCommandOutput(event.message);
    if (!stored || !stored.output) {
      continue;
    }
    if (stored.command !== "status" && stored.command !== "serverinfo") {
      continue;
    }

    const parsed = parseStatusSnapshot(stored.output, stored.command);
    if (parsed.online) {
      return {
        parsed,
        createdAt: event.createdAt.toISOString(),
      };
    }
  }

  return null;
}

export async function inferConnectionStatus(serverId: string) {
  const lastSuccessfulCommand = await prisma.serverEvent.findFirst({
    where: { serverId, level: "info", source: "console" },
    orderBy: { createdAt: "desc" },
  });

  const lastRconError = await prisma.serverEvent.findFirst({
    where: { serverId, level: "error", source: "rcon" },
    orderBy: { createdAt: "desc" },
  });

  if (
    lastSuccessfulCommand &&
    (!lastRconError || lastSuccessfulCommand.createdAt > lastRconError.createdAt)
  ) {
    return "connected" as const;
  }

  if (lastRconError) {
    return "error" as const;
  }

  return "unknown" as const;
}

export async function readServerStatus(server: ServerProfile) {
  let lastError: ReturnType<typeof buildRconErrorDetails> | undefined;

  for (const command of ["serverinfo", "status"] as const) {
    try {
      const raw = await executeServerCommand(server, command);
      const parsed =
        command === "serverinfo"
          ? (parseServerInfo(raw) ?? parseStatus(raw))
          : parseStatus(raw);

      await prisma.serverMetric.create({
        data: {
          serverId: server.id,
          fps: parsed.fps,
          players: parsed.players,
          memoryMb: parsed.memoryMb,
        },
      });
      return parsed;
    } catch (error) {
      lastError =
        typeof error === "object" && error && "details" in error
          ? (error.details as ReturnType<typeof buildRconErrorDetails>)
          : buildRconErrorDetails(server, error);
    }
  }

  const cached = await getCachedStatusSnapshot(server.id);
  if (cached) {
    return {
      ...cached.parsed,
      online: false,
      state: lastError?.state ?? "disconnected",
      stale: true,
      cachedAt: cached.createdAt,
      source: "cached" as const,
      error: lastError,
    };
  }

  return {
    online: false,
    state: lastError?.state ?? "disconnected",
    raw: lastError?.message ?? "RCON connection failed",
    error: lastError,
  };
}

export type LiveStatusSummary = {
  source: string;
  online: boolean;
  stale: boolean;
  cachedAt: string | null;
  players: number | null;
  maxPlayers: number | null;
  fps: number | null;
  entities: number | null;
  memoryMb: number | null;
  worldSize: number | null;
  seed: number | null;
  raw: string | null;
  error: string | null;
  errorState: string | null;
};

function summarizeLiveStatus(status: ParsedServerStatus): LiveStatusSummary {
  return {
    source: status.source ?? (status.online ? "live" : "none"),
    online: status.online,
    stale: status.stale ?? false,
    cachedAt: status.cachedAt ?? null,
    players: status.players ?? null,
    maxPlayers: status.maxPlayers ?? null,
    fps: status.fps ?? null,
    entities: status.entities ?? null,
    memoryMb: status.memoryMb ?? null,
    worldSize: status.worldSize ?? null,
    seed: status.seed ?? null,
    raw: status.raw ? status.raw.slice(0, 4000) : null,
    error: status.error?.message ?? null,
    errorState: status.error?.state ?? null,
  };
}

export async function probeLiveStatus(server: ServerProfile, timeoutMs = 20000) {
  try {
    const status = await Promise.race([
      readServerStatus(server),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Live status probe timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
    return summarizeLiveStatus(status);
  } catch (error) {
    const cached = await getCachedStatusSnapshot(server.id);
    const details =
      typeof error === "object" && error && "details" in error
        ? (error.details as ReturnType<typeof buildRconErrorDetails>)
        : buildRconErrorDetails(server, error);

    if (cached) {
      return summarizeLiveStatus({
        ...cached.parsed,
        online: false,
        state: details.state,
        stale: true,
        cachedAt: cached.createdAt,
        source: "cached",
        error: details,
      });
    }

    return {
      source: "none",
      online: false,
      stale: false,
      cachedAt: null,
      players: null,
      maxPlayers: null,
      fps: null,
      entities: null,
      memoryMb: null,
      worldSize: null,
      seed: null,
      raw: null,
      error: error instanceof Error ? error.message : "Live status probe failed",
      errorState: details.state,
    };
  }
}
