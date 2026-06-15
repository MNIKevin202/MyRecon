"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Copy, Crosshair, HeartPulse, RefreshCw, Search, ShieldAlert, Terminal, UserX, Users } from "lucide-react";
import { Button, Field, Input, Panel, Select } from "@/components/ui";
import { api, clsx } from "@/lib/utils";

type Server = {
  id: string;
  name: string;
  isDefault: boolean;
};

type ConnectedPlayer = {
  steamId: string;
  name: string;
  ping: number | null;
  connectedSeconds: number | null;
  address: string;
  violationLevel: number | null;
};

type KnownPlayer = {
  steamId: string;
  name: string;
  connected: boolean;
  source: string;
  aliases?: string[];
  firstSeenAt?: string;
  lastSeenAt?: string;
  lastConnectedAt?: string | null;
  lastDisconnectedAt?: string | null;
  timesSeen?: number;
  ping?: number | null;
  bestPing?: number | null;
  connectedSeconds?: number | null;
  maxConnectedSeconds?: number | null;
  address?: string;
  violationLevel?: number | null;
};

type PlayerRow = {
  steamId: string;
  name: string;
  connected: boolean;
  ping: number | null;
  connectedSeconds: number | null;
  maxConnectedSeconds: number | null;
  firstSeenAt?: string;
  lastSeenAt?: string;
  timesSeen: number;
  aliases: string[];
  bestPing: number | null;
  address: string;
  violationLevel: number | null;
  source: string;
};

function formatDuration(seconds: number | null) {
  if (!seconds) return "Unknown";
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function mergePlayers(connectedPlayers: ConnectedPlayer[], knownPlayers: KnownPlayer[]) {
  const map = new Map<string, PlayerRow>();
  for (const player of knownPlayers) {
    map.set(player.steamId, {
      steamId: player.steamId,
      name: player.name || "Unnamed",
      connected: player.connected,
      ping: null,
      connectedSeconds: player.connectedSeconds ?? null,
      maxConnectedSeconds: player.maxConnectedSeconds ?? null,
      firstSeenAt: player.firstSeenAt,
      lastSeenAt: player.lastSeenAt,
      timesSeen: player.timesSeen ?? 1,
      aliases: player.aliases ?? [],
      bestPing: player.bestPing ?? null,
      address: player.address ?? "",
      violationLevel: player.violationLevel ?? null,
      source: player.source,
    });
  }

  const existing = (steamId: string) => map.get(steamId);
  for (const player of connectedPlayers) {
    map.set(player.steamId, {
      steamId: player.steamId,
      name: player.name || existing(player.steamId)?.name || "Unnamed",
      connected: true,
      ping: player.ping,
      connectedSeconds: player.connectedSeconds,
      maxConnectedSeconds: existing(player.steamId)?.maxConnectedSeconds ?? player.connectedSeconds,
      firstSeenAt: existing(player.steamId)?.firstSeenAt,
      lastSeenAt: existing(player.steamId)?.lastSeenAt,
      timesSeen: existing(player.steamId)?.timesSeen ?? 1,
      aliases: existing(player.steamId)?.aliases ?? [],
      bestPing: existing(player.steamId)?.bestPing ?? player.ping,
      address: player.address,
      violationLevel: player.violationLevel,
      source: "playerlist",
    });
  }

  return [...map.values()].sort((a, b) => {
    if (a.connected !== b.connected) return a.connected ? -1 : 1;
    return (a.name || a.steamId).localeCompare(b.name || b.steamId);
  });
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export function PlayersClient({ servers }: { servers: Server[] }) {
  const defaultServer = servers.find((server) => server.isDefault) ?? servers[0];
  const [serverId, setServerId] = useState(defaultServer?.id ?? "");
  const [connectedPlayers, setConnectedPlayers] = useState<ConnectedPlayer[]>([]);
  const [knownPlayers, setKnownPlayers] = useState<KnownPlayer[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"connected" | "known" | "all">("connected");
  const [selectedSteamId, setSelectedSteamId] = useState("");
  const [reason, setReason] = useState("");
  const [customCommand, setCustomCommand] = useState("teleport.toplayer {steamId}");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const players = useMemo(() => mergePlayers(connectedPlayers, knownPlayers), [connectedPlayers, knownPlayers]);
  const visiblePlayers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return players.filter((player) => {
      if (filter === "connected" && !player.connected) return false;
      if (filter === "known" && player.connected) return false;
      if (!normalized) return true;
      return [player.name, player.steamId, player.address, player.source].join(" ").toLowerCase().includes(normalized);
    });
  }, [filter, players, query]);
  const selectedPlayer = players.find((player) => player.steamId === selectedSteamId) ?? visiblePlayers[0] ?? null;

  const loadPlayers = useCallback(async () => {
    if (!serverId) return;
    setBusy("load");
    try {
      const data = await api<{
        connectedPlayers: ConnectedPlayer[];
        knownPlayers: KnownPlayer[];
        errors: string[];
      }>(`/api/servers/${serverId}/players`);
      setConnectedPlayers(data.connectedPlayers);
      setKnownPlayers(data.knownPlayers);
      setErrors(data.errors);
      setNotice(`Loaded ${data.connectedPlayers.length} connected and ${data.knownPlayers.length} all-time player${data.knownPlayers.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load players");
    } finally {
      setBusy(null);
    }
  }, [serverId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPlayers(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPlayers]);

  function selectServer(nextServerId: string) {
    setServerId(nextServerId);
    setConnectedPlayers([]);
    setKnownPlayers([]);
    setErrors([]);
    setSelectedSteamId("");
    setNotice(null);
  }

  async function runAction(action: "kick" | "ban" | "kill" | "heal" | "custom") {
    const steamId = selectedPlayer?.steamId;
    if (!steamId) {
      setNotice("Select a player first.");
      return;
    }

    if (action === "ban" && !window.confirm(`Ban ${selectedPlayer?.name || steamId}?`)) return;
    if (action === "kick" && !window.confirm(`Kick ${selectedPlayer?.name || steamId}?`)) return;

    setBusy(action);
    try {
      const result = await api<{ command: string; raw: string }>(`/api/servers/${serverId}/players/action`, {
        method: "POST",
        body: JSON.stringify({
          action,
          steamId,
          reason,
          command: customCommand,
        }),
      });
      setNotice(`Ran: ${result.command}`);
      await loadPlayers();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Player action failed");
    } finally {
      setBusy(null);
    }
  }

  async function copySteamId(steamId: string) {
    try {
      await copyText(steamId);
      setNotice("SteamID copied");
    } catch {
      setNotice("Clipboard copy failed");
    }
  }

  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Players</h1>
          <p className="mt-1 text-sm text-slate-400">View connected and known players, copy SteamIDs, and run server-side RCON actions.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={serverId} onChange={(event) => selectServer(event.target.value)} className="min-w-56">
            {servers.map((server) => <option key={server.id} value={server.id}>{server.name}</option>)}
          </Select>
          <Button variant="secondary" onClick={loadPlayers} disabled={busy === "load"}>
            <RefreshCw className="h-4 w-4" />Refresh
          </Button>
        </div>
      </div>

      {notice ? <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200">{notice}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Panel>
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-400">Connected</div>
            <Users className="h-4 w-4 text-orange-300" />
          </div>
          <div className="mt-3 text-2xl font-bold text-white">{connectedPlayers.length}</div>
        </Panel>
        <Panel>
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-400">All-time players</div>
            <Search className="h-4 w-4 text-orange-300" />
          </div>
          <div className="mt-3 text-2xl font-bold text-white">{knownPlayers.length}</div>
        </Panel>
        <Panel>
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-400">Selected</div>
            <ShieldAlert className="h-4 w-4 text-orange-300" />
          </div>
          <div className="mt-3 truncate text-lg font-bold text-white">{selectedPlayer?.name ?? "None"}</div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <Panel>
          <div className="grid gap-3 lg:grid-cols-[1fr_12rem]">
            <Field label="Search">
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, SteamID, IP, source..." />
            </Field>
            <Field label="Show">
              <Select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
                <option value="connected">Connected</option>
                <option value="known">Offline history</option>
                <option value="all">All-time</option>
              </Select>
            </Field>
          </div>

          {errors.length ? (
            <div className="mt-4 rounded-md border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100">
              Some player sources failed: {errors.join(" | ")}
            </div>
          ) : null}

          <div className="mt-4 grid gap-2">
            {visiblePlayers.length === 0 ? <p className="text-sm text-slate-500">No players match this view.</p> : null}
            {visiblePlayers.map((player) => (
              <button
                key={player.steamId}
                onClick={() => setSelectedSteamId(player.steamId)}
                className={clsx(
                  "min-w-0 rounded-md border p-3 text-left transition",
                  selectedPlayer?.steamId === player.steamId ? "border-orange-500/60 bg-orange-500/10" : "border-white/10 bg-black/20 hover:bg-white/[0.06]",
                )}
              >
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={clsx("h-2.5 w-2.5 rounded-full", player.connected ? "bg-emerald-400" : "bg-slate-600")} />
                      <div className="truncate font-semibold text-white">{player.name}</div>
                    </div>
                    <div className="mt-1 break-all font-mono text-xs text-slate-500">{player.steamId}</div>
                  </div>
                  <div className="grid gap-1 text-xs text-slate-400 sm:text-right">
                    <span>{player.connected ? "Online" : "Known"}</span>
                    <span>Seen {player.timesSeen}x</span>
                    <span>Last {formatDate(player.lastSeenAt)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel>
          <h2 className="text-lg font-semibold text-white">Actions</h2>
          {selectedPlayer ? (
            <div className="mt-4 grid gap-4">
              <div className="rounded-md border border-white/10 bg-black/20 p-3">
                <div className="truncate font-semibold text-white">{selectedPlayer.name}</div>
                <div className="mt-1 break-all font-mono text-xs text-slate-500">{selectedPlayer.steamId}</div>
                <div className="mt-3 grid gap-1 text-xs text-slate-400">
                  <div>First seen: {formatDate(selectedPlayer.firstSeenAt)}</div>
                  <div>Last seen: {formatDate(selectedPlayer.lastSeenAt)}</div>
                  <div>Seen count: {selectedPlayer.timesSeen}</div>
                  <div>Ping: {selectedPlayer.ping ?? "Unknown"}{selectedPlayer.bestPing != null ? ` (best ${selectedPlayer.bestPing})` : ""}</div>
                  <div>Connected: {formatDuration(selectedPlayer.connectedSeconds)}</div>
                  <div>Longest seen session: {formatDuration(selectedPlayer.maxConnectedSeconds)}</div>
                  {selectedPlayer.address ? <div className="break-all">Last address: {selectedPlayer.address}</div> : null}
                  {selectedPlayer.violationLevel != null ? <div>Violation level: {selectedPlayer.violationLevel}</div> : null}
                  {selectedPlayer.aliases.length > 1 ? <div className="break-words">Aliases: {selectedPlayer.aliases.join(", ")}</div> : null}
                </div>
                <Button className="mt-3 w-full" variant="secondary" onClick={() => copySteamId(selectedPlayer.steamId)}>
                  <Copy className="h-4 w-4" />Copy SteamID
                </Button>
              </div>

              <Field label="Reason">
                <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optional reason" />
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => runAction("kick")} disabled={Boolean(busy)}>
                  <UserX className="h-4 w-4" />Kick
                </Button>
                <Button variant="danger" onClick={() => runAction("ban")} disabled={Boolean(busy)}>
                  <Ban className="h-4 w-4" />Ban
                </Button>
                <Button variant="secondary" onClick={() => runAction("kill")} disabled={Boolean(busy)}>
                  <Crosshair className="h-4 w-4" />Kill
                </Button>
                <Button variant="secondary" onClick={() => runAction("heal")} disabled={Boolean(busy)}>
                  <HeartPulse className="h-4 w-4" />Heal
                </Button>
              </div>

              <Field label="Custom RCON command" hint="Use {steamId} and {reason}. Useful for plugin commands like teleport, bring, jail, or mute.">
                <Input value={customCommand} onChange={(event) => setCustomCommand(event.target.value)} />
              </Field>
              <Button onClick={() => runAction("custom")} disabled={Boolean(busy) || !customCommand.trim()}>
                <Terminal className="h-4 w-4" />Run Custom
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Select a player to run actions.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
