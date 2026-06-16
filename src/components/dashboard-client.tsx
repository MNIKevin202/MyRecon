"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Copy, Database, HardDrive, Power, Radio, Users } from "lucide-react";
import { Button, Panel, Select } from "@/components/ui";
import { api } from "@/lib/utils";

type Server = {
  id: string;
  name: string;
  host: string;
  gamePort: number;
  rconPort: number;
  rconType: string;
  isDefault: boolean;
};

type Status = {
  online: boolean;
  state: string;
  players?: number;
  maxPlayers?: number;
  fps?: number;
  entities?: number;
  worldSize?: number;
  seed?: number;
  uptime?: string;
  memoryMb?: number;
  raw?: string;
  stale?: boolean;
  cachedAt?: string;
  source?: "live" | "cached";
  error?: RconErrorDetails;
};

type RconErrorDetails = {
  message: string;
  timestamp: string;
  serverName: string;
  host: string;
  gamePort: number;
  rconPort: number;
  rconType: string;
  state: string;
  stack?: string;
  suggestedFix?: string;
};

type Event = {
  id: string;
  level: string;
  source: string;
  message: string;
  createdAt: string;
};

type Diagnostics = {
  buildStamp: string;
  appVersion: string;
  server: Server;
  connectionDetails: {
    configuredRconType: string;
    normalizedRconType: string;
    actualClientImplementation: string;
    transport: string;
    websocketUrl?: string;
    passwordHasSurroundingWhitespace?: boolean;
    connectionState: string;
    lastSuccessfulConnectionAt: string | null;
    lastSuccessfulCommandAt: string | null;
    lastSuccessfulCommandName: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
  };
  lastRconErrors: Array<{ timestamp: string; message: string }>;
  lastSuccessfulCommandAt: string | null;
  lastSuccessfulCommandName: string | null;
  staleErrorsHiddenSince: string | null;
  inferredConnectionStatus: string;
  lastRconErrorAt: string | null;
  liveStatus: {
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
};

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Activity }) {
  return (
    <Panel className="min-h-28">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-400">{label}</div>
        <Icon className="h-4 w-4 text-orange-300" />
      </div>
      <div className="mt-3 text-2xl font-bold text-white">{value}</div>
    </Panel>
  );
}

export function DashboardClient({ servers }: { servers: Server[] }) {
  const defaultServer = servers.find((server) => server.isDefault) ?? servers[0];
  const [serverId, setServerId] = useState(defaultServer?.id ?? "");
  const [status, setStatus] = useState<Status | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [rebooting, setRebooting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [inferredConnectionStatus, setInferredConnectionStatus] = useState<string | null>(null);
  const selected = useMemo(() => servers.find((server) => server.id === serverId), [serverId, servers]);
  const statusIndicatorClass =
    status?.online || status?.stale
      ? "bg-emerald-400"
      : inferredConnectionStatus === "connected"
        ? "bg-amber-400"
        : "bg-red-500";
  const visibleConnectionState = status?.online
    ? status.stale
      ? "Connected (cached snapshot)"
      : "Connected"
    : inferredConnectionStatus === "connected"
      ? status?.stale
        ? "Stale snapshot (last status succeeded)"
        : "Connected (last command succeeded)"
      : status?.state ?? "Disconnected";

  const loadStatus = useCallback(async () => {
    if (!serverId) return;
    setLoading(true);
    try {
      const data = await api<{
        status: Status;
        events: Event[];
        inferredConnectionStatus: string;
      }>(`/api/servers/${serverId}/status`);
      setStatus(data.status);
      setEvents(data.events);
      setInferredConnectionStatus(
        data.status.online || data.inferredConnectionStatus === "connected"
          ? "connected"
          : data.inferredConnectionStatus,
      );
      setNotice(null);
      if (selected) {
        fetch("/api/notifications/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serverId,
            serverName: selected.name,
            online: data.status.online,
            fps: data.status.fps ?? null,
            memoryMb: data.status.memoryMb ?? null,
          }),
        }).catch(() => undefined);
      }
    } catch (error) {
      setNotice(error instanceof Error ? `Status refresh failed: ${error.message}` : "Status refresh failed");
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    const initial = window.setTimeout(loadStatus, 0);
    const timer = window.setInterval(loadStatus, 30000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [loadStatus]);

  function selectServer(nextServerId: string) {
    setServerId(nextServerId);
    setInferredConnectionStatus(null);
    setStatus(null);
    setEvents([]);
  }

  function errorText(details: RconErrorDetails) {
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
    ].filter(Boolean).join("\n");
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();

      if (!copied) {
        throw new Error("Clipboard copy failed");
      }
    }
  }

  async function copyError() {
    if (!status?.error) return;
    try {
      await copyText(errorText(status.error));
      setNotice("Error copied");
    } catch (error) {
      setNotice(error instanceof Error ? `Error copy failed: ${error.message}` : "Error copy failed");
    }
  }

  async function copyDiagnostics() {
    if (!serverId || !selected) return;
    setNotice("Running live status check...");
    setLoading(true);

    try {
      const diagnostics = await api<Diagnostics>(`/api/servers/${serverId}/diagnostics`);
      setInferredConnectionStatus(diagnostics.inferredConnectionStatus);

      const live = diagnostics.liveStatus;
      const refreshedStatus: Status = {
        online: live.online,
        state: live.errorState ?? (live.online ? "connected" : "disconnected"),
        players: live.players ?? undefined,
        maxPlayers: live.maxPlayers ?? undefined,
        fps: live.fps ?? undefined,
        entities: live.entities ?? undefined,
        memoryMb: live.memoryMb ?? undefined,
        worldSize: live.worldSize ?? undefined,
        seed: live.seed ?? undefined,
        raw: live.raw ?? undefined,
        stale: live.stale,
        cachedAt: live.cachedAt ?? undefined,
        source: live.source === "none" ? undefined : (live.source as Status["source"]),
        error: live.error
          ? {
              message: live.error,
              timestamp: new Date().toISOString(),
              serverName: selected.name,
              host: selected.host,
              gamePort: selected.gamePort,
              rconPort: selected.rconPort,
              rconType: selected.rconType,
              state: live.errorState ?? "disconnected",
            }
          : undefined,
      };

      setStatus(refreshedStatus);

      const connectionStatus = live.online
        ? live.stale
          ? "connected (cached snapshot)"
          : "connected"
        : diagnostics.inferredConnectionStatus === "connected"
          ? live.stale
            ? "stale snapshot (last status succeeded)"
            : "connected (last command succeeded)"
          : live.errorState ?? diagnostics.inferredConnectionStatus ?? "unknown";

      const text = [
        `App version: ${diagnostics.appVersion}`,
        `Build stamp: ${diagnostics.buildStamp}`,
        `Selected server: ${selected.name}`,
        `Host: ${selected.host}`,
        `Game port: ${selected.gamePort}`,
        `RCON port: ${selected.rconPort}`,
        `RCON type: ${selected.rconType}`,
        `Configured RCON type: ${diagnostics.connectionDetails.configuredRconType}`,
        `Normalized RCON type: ${diagnostics.connectionDetails.normalizedRconType}`,
        `Actual client implementation: ${diagnostics.connectionDetails.actualClientImplementation}`,
        `Transport selected: ${diagnostics.connectionDetails.transport}`,
        `WebSocket URL: ${diagnostics.connectionDetails.websocketUrl ?? "not used"}`,
        `Saved password has surrounding whitespace: ${diagnostics.connectionDetails.passwordHasSurroundingWhitespace ? "yes" : "no"}`,
        `Last connection status: ${connectionStatus}`,
        `Last successful command: ${diagnostics.lastSuccessfulCommandName ?? "none"}`,
        `Last successful command timestamp: ${diagnostics.lastSuccessfulCommandAt ?? "none"}`,
        `Last RCON error timestamp: ${diagnostics.lastRconErrorAt ?? "none"}`,
        `Live status source: ${live.source}${live.cachedAt ? ` (${live.cachedAt})` : ""}`,
        `Live status players: ${live.players ?? "unknown"}/${live.maxPlayers ?? "?"}`,
        `Live status fps: ${live.fps ?? "unknown"}`,
        `Live status entities: ${live.entities ?? "unknown"}`,
        live.error ? `Live status error: ${live.error}` : "Live status error: none",
        `Console WebSocket/SSE: only used on the Console page, not Dashboard`,
        `Stale RCON errors hidden since: ${diagnostics.staleErrorsHiddenSince ?? "none"}`,
        diagnostics.lastRconErrors.length ? "RCON errors since last success:" : "RCON errors since last success: none",
        ...diagnostics.lastRconErrors.map((error, index) => `${index + 1}. [${error.timestamp}] ${error.message}`),
      ].join("\n");

      await copyText(text);
      setNotice("Diagnostics copied");
    } catch (error) {
      const fallback = [
        "MyRcon diagnostics (limited - API unavailable)",
        `Selected server: ${selected.name}`,
        `Host: ${selected.host}`,
        `Game port: ${selected.gamePort}`,
        `RCON port: ${selected.rconPort}`,
        `RCON type: ${selected.rconType}`,
        `Dashboard connection state: ${visibleConnectionState}`,
        `Live status source: ${status?.source ?? "none"}`,
        status?.error ? `Last dashboard error: ${status.error.message}` : "Last dashboard error: none",
        `API error: ${error instanceof Error ? error.message : "Diagnostics request failed"}`,
      ].join("\n");

      try {
        await copyText(fallback);
        setNotice("Diagnostics copied (limited fallback)");
      } catch (copyError) {
        setNotice(
          copyError instanceof Error
            ? `Diagnostics copy failed: ${copyError.message}`
            : "Diagnostics copy failed",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function reboot() {
    if (!serverId || !window.confirm(`Reboot ${selected?.name ?? "this server"}? The server process will restart.`)) return;
    setRebooting(true);
    setNotice("Reboot command sent — server will restart shortly.");
    try {
      await api(`/api/servers/${serverId}/console`, { method: "POST", body: JSON.stringify({ command: "quit" }) });
    } catch {
      // quit disconnects the server before it can reply — treat any error as success
    } finally {
      setRebooting(false);
    }
  }

  async function clearEvents() {
    if (!serverId) return;
    await api(`/api/servers/${serverId}/events`, { method: "DELETE" });
    setEvents([]);
    setNotice("Event history cleared");
  }

  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">Live status for the selected Rust server profile.</p>
        </div>
        <div className="flex gap-3">
          <Select value={serverId} onChange={(event) => selectServer(event.target.value)} className="min-w-56">
            {servers.map((server) => (
              <option key={server.id} value={server.id}>
                {server.name}
              </option>
            ))}
          </Select>
          <Button variant="secondary" onClick={loadStatus} disabled={loading}>
            {loading ? "Checking..." : "Refresh"}
          </Button>
          <Button variant="danger" onClick={reboot} disabled={rebooting || !serverId}>
            <Power className="h-4 w-4" />{rebooting ? "Rebooting..." : "Reboot"}
          </Button>
          <Button variant="secondary" onClick={copyDiagnostics}>
            <Copy className="h-4 w-4" />Diagnostics
          </Button>
        </div>
      </div>
      {notice ? <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{notice}</div> : null}

      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${statusIndicatorClass}`} />
              <h2 className="text-lg font-semibold text-white">{selected?.name ?? "No server selected"}</h2>
            </div>
            <p className="mt-1 break-words text-sm text-slate-400">
              {selected ? `${selected.host}:${selected.gamePort} - RCON ${selected.rconPort} - ${selected.rconType}` : "Add a server to begin."}
            </p>
          </div>
          <div className="text-sm text-slate-400">{visibleConnectionState}</div>
        </div>
      </Panel>

      {status?.stale ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Showing cached server stats from{" "}
          {status.cachedAt ? new Date(status.cachedAt).toLocaleString() : "the last successful status command"}.
          Click Refresh to fetch live data.
        </div>
      ) : null}

      {status?.error ? (
        <Panel className="border-red-500/30 bg-red-500/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-red-100">{status.error.state}</h2>
              <p className="mt-1 break-words text-sm text-red-100">{status.error.message}</p>
              {status.error.suggestedFix ? <p className="mt-2 break-words text-sm text-red-100/80">{status.error.suggestedFix}</p> : null}
              <p className="mt-2 break-words text-xs text-red-100/70">
                {status.error.timestamp} - {status.error.serverName} - {status.error.host}:{status.error.rconPort} - {status.error.rconType}
              </p>
            </div>
            <Button variant="secondary" onClick={copyError}><Copy className="h-4 w-4" />Copy Error</Button>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Players" value={`${status?.players ?? 0}/${status?.maxPlayers ?? "?"}`} icon={Users} />
        <Stat label="Server FPS" value={status?.fps?.toString() ?? "Unknown"} icon={Activity} />
        <Stat label="Entities" value={status?.entities?.toLocaleString() ?? "Unknown"} icon={Database} />
        <Stat label="Memory" value={status?.memoryMb ? `${status.memoryMb} MB` : "Unavailable"} icon={HardDrive} />
        <Stat label="World" value={status?.worldSize ? `${status.worldSize} / ${status.seed ?? "seed ?"}` : "Unknown"} icon={Radio} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-white">Recent Server Events</h2>
            <Button variant="secondary" onClick={clearEvents}>Clear Events</Button>
          </div>
          <div className="mt-4 grid max-h-80 min-w-0 gap-3 overflow-y-auto overflow-x-hidden">
            {events.length === 0 ? <p className="text-sm text-slate-500">No events have been recorded yet.</p> : null}
            {events.map((event) => (
              <div key={event.id} className="min-w-0 rounded-md border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{event.source} - {event.level}</span>
                  <span>{new Date(event.createdAt).toLocaleString()}</span>
                </div>
                <pre className="mt-2 max-w-full whitespace-pre-wrap break-words text-sm text-slate-200">{event.message}</pre>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <h2 className="text-lg font-semibold text-white">Status Snapshot</h2>
          <pre className="mt-4 max-h-80 max-w-full overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-md bg-black/30 p-4 text-xs leading-6 text-slate-300">
            {status?.raw ?? "Run a refresh to collect server status."}
          </pre>
        </Panel>
      </div>
    </div>
  );
}
