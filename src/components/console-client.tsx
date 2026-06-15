"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Play, RotateCcw, Search, Trash2 } from "lucide-react";
import { Button, Field, Input, Panel, Select } from "@/components/ui";
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

type LogLine = {
  id: string;
  level: string;
  source: string;
  message: string;
  createdAt: string;
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

export function ConsoleClient({ servers }: { servers: Server[] }) {
  const defaultServer = servers.find((server) => server.isDefault) ?? servers[0];
  const [serverId, setServerId] = useState(defaultServer?.id ?? "");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [level, setLevel] = useState("all");
  const [busy, setBusy] = useState(false);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [lastError, setLastError] = useState<RconErrorDetails | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef<HTMLDivElement | null>(null);
  const selected = useMemo(() => servers.find((server) => server.id === serverId), [servers, serverId]);

  const loadLogs = useCallback(async () => {
    if (!serverId) return;
    const data = await api<{ logs: LogLine[] }>(`/api/servers/${serverId}/console`);
    setLogs(data.logs);
  }, [serverId]);

  useEffect(() => {
    const initial = window.setTimeout(loadLogs, 0);
    const timer = window.setInterval(loadLogs, 2500);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [loadLogs]);

  useEffect(() => {
    if (!serverId) return;

    const connectingTimer = window.setTimeout(() => setConnectionState("connecting"), 0);
    const source = new EventSource(`/api/servers/${serverId}/console/stream`);

    source.addEventListener("state", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { state: string };
      setConnectionState(data.state);
      setLastError(null);
    });

    source.addEventListener("message", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { timestamp: string; message: unknown };
      const message =
        typeof data.message === "string"
          ? data.message
          : JSON.stringify(data.message, null, 2);
      setLogs((current) => [
        ...current,
        {
          id: `${data.timestamp}-${current.length}`,
          level: "info",
          source: "stream",
          message,
          createdAt: data.timestamp,
        },
      ].slice(-500));
    });

    source.addEventListener("rcon-error", (event) => {
      const raw = (event as MessageEvent).data;
      if (raw) {
        const details = JSON.parse(raw) as RconErrorDetails;
        setLastError(details);
        setConnectionState(details.state);
      } else {
        setConnectionState("disconnected");
      }
      source.close();
    });

    source.onerror = () => {
      setConnectionState((current) => current === "connected" ? "disconnected" : current);
    };

    return () => {
      window.clearTimeout(connectingTimer);
      source.close();
      setConnectionState("disconnected");
    };
  }, [serverId]);

  const filtered = useMemo(() => {
    return logs.filter((line) => {
      const matchesText = filter ? line.message.toLowerCase().includes(filter.toLowerCase()) : true;
      const matchesLevel = level === "all" ? true : line.level === level;
      return matchesText && matchesLevel;
    });
  }, [logs, filter, level]);

  useEffect(() => {
    if (autoScroll) {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
    }
  }, [filtered, autoScroll]);

  async function send() {
    if (!command.trim() || !serverId) return;
    setBusy(true);
    try {
      await api(`/api/servers/${serverId}/console`, {
        method: "POST",
        body: JSON.stringify({ command }),
      });
      setHistory((current) => [command, ...current.filter((item) => item !== command)].slice(0, 25));
      setCommand("");
      await loadLogs();
      setLastError(null);
      setConnectionState("connected");
    } catch (error) {
      const apiError = error as Error & { details?: RconErrorDetails };
      setLastError(
        apiError.details ?? {
          message: error instanceof Error ? error.message : "Command failed",
          timestamp: new Date().toISOString(),
          serverName: selected?.name ?? "Unknown",
          host: selected?.host ?? "Unknown",
          gamePort: selected?.gamePort ?? 0,
          rconPort: selected?.rconPort ?? 0,
          rconType: selected?.rconType ?? "Unknown",
          state: "disconnected",
        },
      );
    } finally {
      setBusy(false);
    }
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

  async function copyError() {
    if (lastError) {
      await navigator.clipboard.writeText(errorText(lastError));
    }
  }

  function exportLogs() {
    const blob = new Blob(
      [
        filtered
          .map((line) => `[${new Date(line.createdAt).toISOString()}] ${line.source}/${line.level}: ${line.message}`)
          .join("\n\n"),
      ],
      { type: "text/plain;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `myrcon-${serverId}-logs.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Console</h1>
          <p className="mt-1 text-sm text-slate-400">Commands execute server-side. WebRCON live output streams through the backend.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={serverId} onChange={(event) => setServerId(event.target.value)} className="min-w-56">
            {servers.map((server) => (
              <option key={server.id} value={server.id}>{server.name}</option>
            ))}
          </Select>
          <Button variant="secondary" onClick={loadLogs}><RotateCcw className="h-4 w-4" />Refresh</Button>
          <Button variant="secondary" onClick={() => setLogs([])}><Trash2 className="h-4 w-4" />Clear</Button>
          <Button variant="secondary" onClick={exportLogs}><Download className="h-4 w-4" />Export</Button>
        </div>
      </div>

      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-md border border-white/10 px-3 py-2 text-slate-300">
            Console: <span className="text-orange-200">{connectionState}</span>
          </span>
          <label className="flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(event) => setAutoScroll(event.target.checked)}
            />
            Auto-scroll
          </label>
        </div>

        {lastError ? (
          <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="font-semibold">{lastError.state}</div>
                <div className="mt-1">{lastError.message}</div>
                {lastError.suggestedFix ? <div className="mt-2 text-red-100/80">{lastError.suggestedFix}</div> : null}
              </div>
              <Button variant="secondary" onClick={copyError}><Copy className="h-4 w-4" />Copy Error</Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-[1fr_180px_160px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search logs" className="pl-9" />
          </div>
          <Select value={level} onChange={(event) => setLevel(event.target.value)}>
            <option value="all">All levels</option>
            <option value="info">Info</option>
            <option value="warn">Warnings</option>
            <option value="error">Errors</option>
          </Select>
          <div className="text-sm text-slate-500 lg:pt-3">{filtered.length} lines</div>
        </div>

        <div ref={logRef} className="mt-4 h-[52vh] overflow-auto rounded-md border border-white/10 bg-black/40 p-4 font-mono text-xs leading-6 text-slate-200">
          {filtered.length === 0 ? <div className="text-slate-500">No console output yet.</div> : null}
          {filtered.map((line) => (
            <div key={line.id} className="border-b border-white/[0.04] py-2">
              <span className="text-slate-500">[{new Date(line.createdAt).toLocaleTimeString()}] </span>
              <span className="text-orange-300">{line.source}/{line.level}</span>
              <pre className="mt-1 whitespace-pre-wrap">{line.message}</pre>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
          <Input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") send();
              if (event.key === "ArrowUp" && history[0]) setCommand(history[0]);
            }}
            placeholder="status"
          />
          <Button onClick={send} disabled={busy || !command.trim()}><Play className="h-4 w-4" />Send</Button>
        </div>

        {history.length ? (
          <div className="mt-4">
            <Field label="Command history">
              <div className="flex flex-wrap gap-2">
                {history.map((item) => (
                  <button key={item} onClick={() => setCommand(item)} className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/[0.06]">
                    {item}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
