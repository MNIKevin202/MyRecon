import type { RconConnectionState, RconErrorDetails } from "@/server/rcon/errors";

export type ParsedServerStatus = {
  online: boolean;
  state: RconConnectionState;
  hostname?: string;
  map?: string;
  players?: number;
  maxPlayers?: number;
  fps?: number;
  entities?: number;
  worldSize?: number;
  seed?: number;
  uptime?: string;
  memoryMb?: number;
  raw?: string;
  error?: RconErrorDetails;
  stale?: boolean;
  cachedAt?: string;
  source?: "live" | "cached";
};

type RustServerInfo = {
  Hostname?: string;
  Map?: string;
  Players?: number;
  MaxPlayers?: number;
  Framerate?: number;
  EntityCount?: number;
  Memory?: number;
  Uptime?: number | string;
  WorldSize?: number;
  Seed?: number;
};

function numberAfter(pattern: RegExp, input: string) {
  const match = input.match(pattern);
  return match ? Number(match[1]) : undefined;
}

function extractJsonObject(raw: string): RustServerInfo | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(raw.slice(start, end + 1)) as RustServerInfo;
  } catch {
    return null;
  }
}

export function parseStoredCommandOutput(message: string) {
  const normalized = message.replace(/\r\n/g, "\n").trim();
  if (!normalized.startsWith("> ")) {
    return null;
  }

  const body = normalized.slice(2);
  const newline = body.indexOf("\n");
  if (newline === -1) {
    return {
      command: body.trim().toLowerCase(),
      output: "",
    };
  }

  return {
    command: body.slice(0, newline).trim().toLowerCase(),
    output: body.slice(newline + 1).trim(),
  };
}

export function parseServerInfo(raw: string): ParsedServerStatus | null {
  const json = extractJsonObject(raw);
  if (!json || typeof json.Hostname !== "string") {
    return null;
  }

  return {
    online: true,
    state: "connected",
    source: "live",
    hostname: json.Hostname,
    map: json.Map,
    players: json.Players,
    maxPlayers: json.MaxPlayers,
    fps: json.Framerate,
    entities: json.EntityCount,
    worldSize: json.WorldSize,
    seed: json.Seed,
    uptime: json.Uptime !== undefined ? String(json.Uptime) : undefined,
    memoryMb: json.Memory,
    raw,
  };
}

export function parseStatus(raw: string): ParsedServerStatus {
  const fromServerInfo = parseServerInfo(raw);
  if (fromServerInfo) {
    return fromServerInfo;
  }

  const playersMatch = raw.match(/players\s*:\s*(\d+)\s*\((\d+)\s*max\)/i);

  return {
    online: true,
    state: "connected",
    source: "live",
    hostname: raw.match(/hostname\s*:\s*([^\n\r]+)/i)?.[1]?.trim(),
    map: raw.match(/map\s*:\s*([^\n\r]+)/i)?.[1]?.trim(),
    players: playersMatch ? Number(playersMatch[1]) : numberAfter(/players\s+(\d+)/i, raw),
    maxPlayers: playersMatch ? Number(playersMatch[2]) : numberAfter(/maxplayers\s+(\d+)/i, raw),
    fps: numberAfter(/fps\s*:\s*([\d.]+)/i, raw),
    entities: numberAfter(/entities\s*:\s*(\d+)/i, raw),
    worldSize: numberAfter(/worldsize\s*:\s*(\d+)/i, raw),
    seed: numberAfter(/seed\s*:\s*(\d+)/i, raw),
    uptime: raw.match(/uptime\s*:\s*([^\n\r]+)/i)?.[1]?.trim(),
    memoryMb: numberAfter(/memory\s*:\s*([\d.]+)\s*mb/i, raw),
    raw,
  };
}

export function parseStatusSnapshot(raw: string, command = "status") {
  if (command === "serverinfo") {
    return parseServerInfo(raw) ?? parseStatus(raw);
  }

  return parseStatus(raw);
}
