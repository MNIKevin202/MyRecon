"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCopy, Copy, Crown, RefreshCw, ShieldCheck, ShieldPlus, UserMinus, Users, Zap } from "lucide-react";
import { Button, Field, Input, Panel, Select } from "@/components/ui";
import { api, clsx } from "@/lib/utils";

type Server = {
  id: string;
  name: string;
  isDefault: boolean;
};

type PermissionFramework = "CARBON" | "OXIDE" | "AUTO";

type PermissionSummary = {
  permission: string;
  framework: string;
  count: number;
  pluginNames: string[];
};

type Assignment = {
  id: string;
  permission: string;
  framework: string;
  pluginName: string | null;
  steamId: string;
  playerName: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
};

type KnownPlayer = {
  steamId: string;
  name: string;
  aliases: string[];
  online: boolean;
  lastSeenAt: string;
  timesSeen: number;
  lastPing: number | null;
  bestPing: number | null;
};

type PermissionsResponse = {
  permissions: PermissionSummary[];
  assignments: Assignment[];
  players: KnownPlayer[];
};

type AccessResponse = {
  permission: string;
  framework?: "CARBON" | "OXIDE";
  rconError?: string | null;
  users: Array<{ steamId: string; name: string }>;
};

function formatDate(value?: string | null) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function cleanSteamId(value: string) {
  return value.replace(/\D/g, "").slice(0, 20);
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export function PermissionsClient({ servers }: { servers: Server[] }) {
  const defaultServer = servers.find((server) => server.isDefault) ?? servers[0];
  const [serverId, setServerId] = useState(defaultServer?.id ?? "");
  const [framework, setFramework] = useState<PermissionFramework>("CARBON");
  const [permission, setPermission] = useState("");
  const [pluginName, setPluginName] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [selectedSteamId, setSelectedSteamId] = useState("");
  const [manualSteamId, setManualSteamId] = useState("");
  const [manualName, setManualName] = useState("");
  const [permissions, setPermissions] = useState<PermissionSummary[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [players, setPlayers] = useState<KnownPlayer[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkSearch, setBulkSearch] = useState("");

  const selectedPlayer = useMemo(
    () => players.find((player) => player.steamId === selectedSteamId) ?? null,
    [players, selectedSteamId],
  );
  const targetSteamId = (manualSteamId || selectedSteamId).trim();
  const targetName = manualName.trim() || selectedPlayer?.name || targetSteamId;
  const filteredPermissions = useMemo(() => {
    const query = permissionSearch.trim().toLowerCase();
    if (!query) return permissions;
    return permissions.filter((item) =>
      [item.permission, item.framework, item.pluginNames.join(" ")].join(" ").toLowerCase().includes(query),
    );
  }, [permissionSearch, permissions]);
  const selectedAssignments = useMemo(
    () => assignments.filter((item) => item.permission === permission.trim().toLowerCase()),
    [assignments, permission],
  );
  const assignedSteamIds = useMemo(
    () => new Set(selectedAssignments.map((item) => item.steamId)),
    [selectedAssignments],
  );
  const filteredPlayers = useMemo(() => {
    const query = playerSearch.trim().toLowerCase();
    return players.filter((player) => {
      if (assignedSteamIds.has(player.steamId)) return false;
      if (!query) return true;
      return [player.name, player.steamId, player.aliases.join(" ")].join(" ").toLowerCase().includes(query);
    });
  }, [assignedSteamIds, playerSearch, players]);
  const bulkFilteredPlayers = useMemo(() => {
    const query = bulkSearch.trim().toLowerCase();
    if (!query) return players;
    return players.filter((player) =>
      [player.name, player.steamId, player.aliases.join(" ")].join(" ").toLowerCase().includes(query),
    );
  }, [bulkSearch, players]);

  const loadPermissions = useCallback(async (quiet = false) => {
    if (!serverId) return;
    setBusy("load");
    if (!quiet) setNotice(null);
    try {
      const data = await api<PermissionsResponse>(`/api/servers/${serverId}/permissions`);
      setPermissions(data.permissions);
      setAssignments(data.assignments);
      setPlayers(data.players);
      if (!permission && data.permissions[0]) {
        setPermission(data.permissions[0].permission);
        setFramework(data.permissions[0].framework === "OXIDE" ? "OXIDE" : "CARBON");
      }
      if (!quiet) setNotice(`Loaded ${data.permissions.length} permission${data.permissions.length === 1 ? "" : "s"} and ${data.players.length} player${data.players.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load permissions");
    } finally {
      setBusy(null);
    }
  }, [permission, serverId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPermissions(true), 0);
    return () => window.clearTimeout(timer);
  }, [loadPermissions]);

  function selectServer(nextServerId: string) {
    setServerId(nextServerId);
    setPermission("");
    setPluginName("");
    setSelectedSteamId("");
    setManualSteamId("");
    setManualName("");
    setPermissions([]);
    setAssignments([]);
    setPlayers([]);
    setNotice(null);
  }

  function selectPermission(item: PermissionSummary) {
    setPermission(item.permission);
    setFramework(item.framework === "OXIDE" ? "OXIDE" : "CARBON");
    setPluginName(item.pluginNames[0] ?? "");
    setSelectedSteamId("");
    setManualSteamId("");
  }

  async function grantPermission() {
    const cleanPermission = permission.trim().toLowerCase();
    if (!serverId || !cleanPermission || !targetSteamId) {
      setNotice("Choose a permission and player before granting.");
      return;
    }

    setBusy("grant");
    setNotice(`Granting ${cleanPermission}...`);
    try {
      const data = await api<{ framework?: string; warning?: string | null }>(`/api/servers/${serverId}/permissions/grant`, {
        method: "POST",
        body: JSON.stringify({
          steamId: targetSteamId,
          permission: cleanPermission,
          framework,
          playerName: targetName,
          pluginName: pluginName.trim() || null,
        }),
      });
      setNotice(data.warning ? `Command sent and saved. ${data.warning}` : `Granted ${cleanPermission} to ${targetName}.`);
      await loadPermissions(true);
      setManualSteamId("");
      setManualName("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Permission grant failed");
    } finally {
      setBusy(null);
    }
  }

  async function grantFullAccess() {
    if (!serverId || !targetSteamId) {
      setNotice("Choose a player before granting full access.");
      return;
    }
    if (!window.confirm(`Give ${targetName} FULL access (every permission, "*") on this server?`)) return;

    setBusy("grant");
    setNotice("Granting full access...");
    try {
      await api(`/api/servers/${serverId}/permissions/grant`, {
        method: "POST",
        body: JSON.stringify({ steamId: targetSteamId, permission: "*", framework, playerName: targetName }),
      });
      setNotice(`Granted full access (*) to ${targetName}.`);
      await loadPermissions(true);
      setManualSteamId("");
      setManualName("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Full access grant failed");
    } finally {
      setBusy(null);
    }
  }

  async function bulkGrant(fullAccess: boolean) {
    const ids = [...bulkSelected];
    if (!serverId || ids.length === 0) {
      setNotice("Select at least one player for bulk grant.");
      return;
    }
    const perm = fullAccess ? "*" : permission.trim().toLowerCase();
    if (!perm) {
      setNotice("Pick a permission first, or use Grant Full Access.");
      return;
    }
    const label = fullAccess ? 'full access ("*")' : perm;
    if (!window.confirm(`Grant ${label} to ${ids.length} player(s)?`)) return;

    setBusy("bulk");
    setNotice(`Granting ${label} to ${ids.length} player(s)...`);
    try {
      const playersPayload = players
        .filter((p) => bulkSelected.has(p.steamId))
        .map((p) => ({ steamId: p.steamId, name: p.name }));
      const data = await api<{ granted: string[]; failed: Array<{ steamId: string; error: string }> }>(
        `/api/servers/${serverId}/permissions/grant-bulk`,
        {
          method: "POST",
          body: JSON.stringify({ steamIds: ids, permission: perm, framework, players: playersPayload }),
        },
      );
      setNotice(
        `Granted ${label} to ${data.granted.length} player(s)${data.failed.length ? `, ${data.failed.length} failed` : ""}.`,
      );
      setBulkSelected(new Set());
      await loadPermissions(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Bulk grant failed");
    } finally {
      setBusy(null);
    }
  }

  async function grantAdmin(ids: string[], named: Array<{ steamId: string; name: string }>) {
    if (!serverId || ids.length === 0) {
      setNotice("Choose at least one player to make admin.");
      return;
    }
    if (!window.confirm(`Make ${ids.length} player(s) a server admin (ownerid) and write the config?`)) return;

    setBusy("admin");
    setNotice(`Granting admin to ${ids.length} player(s)...`);
    try {
      const data = await api<{ granted: string[]; failed: Array<{ steamId: string }>; configSaved: boolean }>(
        `/api/servers/${serverId}/permissions/grant-admin`,
        { method: "POST", body: JSON.stringify({ steamIds: ids, level: "owner", players: named }) },
      );
      setNotice(
        `Made ${data.granted.length} player(s) server admin${data.failed.length ? `, ${data.failed.length} failed` : ""}. ${data.configSaved ? "Config saved." : "Config write not confirmed — run server.writecfg if needed."}`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Grant admin failed");
    } finally {
      setBusy(null);
    }
  }

  async function revokePermission(steamId: string) {
    const cleanPermission = permission.trim().toLowerCase();
    if (!serverId || !cleanPermission) return;

    setBusy(`revoke-${steamId}`);
    try {
      await api(`/api/servers/${serverId}/permissions/revoke`, {
        method: "POST",
        body: JSON.stringify({ steamId, permission: cleanPermission, framework }),
      });
      setAssignments((current) => current.filter((item) => !(item.permission === cleanPermission && item.steamId === steamId)));
      setNotice(`Revoked ${cleanPermission} from ${steamId}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Permission revoke failed");
    } finally {
      setBusy(null);
    }
  }

  async function syncSelectedPermission() {
    const cleanPermission = permission.trim().toLowerCase();
    if (!serverId || !cleanPermission) return;

    setBusy("sync");
    setNotice(`Syncing ${cleanPermission} from server...`);
    try {
      const data = await api<AccessResponse>(
        `/api/servers/${serverId}/permissions/access?permission=${encodeURIComponent(cleanPermission)}&framework=${framework}&sync=1`,
      );
      setNotice(data.rconError ? `Saved access kept. Server sync reported: ${data.rconError}` : `Synced ${data.users.length} assignment${data.users.length === 1 ? "" : "s"} for ${cleanPermission}.`);
      await loadPermissions(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Permission sync failed");
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

  async function copySetupCommands() {
    if (!serverId) return;
    setBusy("export");
    setNotice("Reading server permissions…");
    try {
      const data = await api<{ framework: string; commands: string[]; groupCount: number; userCount: number }>(
        `/api/servers/${serverId}/permissions/export`,
      );
      if (data.commands.length === 0) {
        setNotice("No permission assignments found to copy.");
        return;
      }
      await copyText(data.commands.join("\n"));
      const cmdCount = data.commands.filter((c) => !c.startsWith("#")).length;
      setNotice(
        `Copied ${cmdCount} ${data.framework} command(s) for ${data.groupCount} group(s) and ${data.userCount} player(s). Paste into the target server console.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not export permissions");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Permissions</h1>
          <p className="mt-1 text-sm text-slate-400">Manage saved Carbon/Oxide permissions for known Rust players.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={serverId} onChange={(event) => selectServer(event.target.value)} className="min-w-56">
            {servers.map((server) => <option key={server.id} value={server.id}>{server.name}</option>)}
          </Select>
          <Button variant="secondary" onClick={() => loadPermissions()} disabled={busy === "load"}>
            <RefreshCw className="h-4 w-4" />Refresh
          </Button>
          <Button variant="secondary" onClick={copySetupCommands} disabled={busy === "export"}>
            <ClipboardCopy className="h-4 w-4" />Copy Setup Commands
          </Button>
        </div>
      </div>

      {notice ? <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200">{notice}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Panel>
          <div className="text-sm text-slate-400">Saved Permissions</div>
          <div className="mt-3 text-2xl font-bold text-white">{permissions.length}</div>
        </Panel>
        <Panel>
          <div className="text-sm text-slate-400">Assignments</div>
          <div className="mt-3 text-2xl font-bold text-white">{assignments.length}</div>
        </Panel>
        <Panel>
          <div className="text-sm text-slate-400">Known Players</div>
          <div className="mt-3 text-2xl font-bold text-white">{players.length}</div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
        <Panel>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Permission List</h2>
            <ShieldCheck className="h-5 w-5 text-orange-300" />
          </div>
          <Field label="Search">
            <Input value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} placeholder="Permission or plugin" />
          </Field>
          <div className="mt-4 grid gap-2">
            {filteredPermissions.length === 0 ? <p className="text-sm text-slate-500">No saved permissions yet. Create one on the right.</p> : null}
            {filteredPermissions.map((item) => (
              <button
                key={item.permission}
                onClick={() => selectPermission(item)}
                className={clsx(
                  "rounded-md border p-3 text-left transition",
                  permission.trim().toLowerCase() === item.permission ? "border-orange-500/60 bg-orange-500/10" : "border-white/10 bg-black/20 hover:bg-white/[0.06]",
                )}
              >
                <div className="break-all font-mono text-sm font-semibold text-white">{item.permission}</div>
                <div className="mt-1 text-xs text-slate-400">{item.count} assignment{item.count === 1 ? "" : "s"} - {item.framework}</div>
                {item.pluginNames.length ? <div className="mt-1 truncate text-xs text-slate-500">{item.pluginNames.join(", ")}</div> : null}
              </button>
            ))}
          </div>
        </Panel>

        <div className="grid gap-4">
          <Panel>
            <div className="grid gap-4 xl:grid-cols-[12rem_1fr_14rem] xl:items-end">
              <Field label="System">
                <Select value={framework} onChange={(event) => setFramework(event.target.value as PermissionFramework)}>
                  <option value="CARBON">Carbon</option>
                  <option value="OXIDE">Oxide/uMod</option>
                  <option value="AUTO">Auto</option>
                </Select>
              </Field>
              <Field label="Permission">
                <Input value={permission} onChange={(event) => setPermission(event.target.value)} placeholder="admin.hammer.use" className="font-mono" />
              </Field>
              <Field label="Plugin name">
                <Input value={pluginName} onChange={(event) => setPluginName(event.target.value)} placeholder="Optional" />
              </Field>
            </div>
          </Panel>

          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Panel>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Has Access</h2>
                  <p className="mt-1 text-sm text-slate-400">{selectedAssignments.length} saved assignment{selectedAssignments.length === 1 ? "" : "s"} for this permission.</p>
                </div>
                <Button variant="secondary" onClick={syncSelectedPermission} disabled={busy === "sync" || !permission.trim()}>
                  <RefreshCw className="h-4 w-4" />Sync
                </Button>
              </div>
              <div className="mt-4 grid gap-2">
                {selectedAssignments.length === 0 ? <p className="text-sm text-slate-500">No one has this permission saved yet.</p> : null}
                {selectedAssignments.map((assignment) => (
                  <div key={assignment.id} className="flex min-w-0 flex-col gap-2 rounded-md border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{assignment.playerName || assignment.steamId}</div>
                      <div className="break-all font-mono text-xs text-slate-500">{assignment.steamId}</div>
                      <div className="mt-1 text-xs text-slate-500">Saved {formatDate(assignment.updatedAt)}{assignment.pluginName ? ` - ${assignment.pluginName}` : ""}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => copySteamId(assignment.steamId)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="danger" onClick={() => revokePermission(assignment.steamId)} disabled={busy === `revoke-${assignment.steamId}`}>
                        <UserMinus className="h-4 w-4" />Revoke
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Grant Access</h2>
                  <p className="mt-1 text-sm text-slate-400">Pick an all-time player or paste a SteamID.</p>
                </div>
                <Users className="h-5 w-5 text-orange-300" />
              </div>
              <div className="mt-4 grid gap-3">
                <Field label="Search players">
                  <Input value={playerSearch} onChange={(event) => setPlayerSearch(event.target.value)} placeholder="Name, alias, SteamID" />
                </Field>
                <Field label="Player">
                  <Select value={selectedSteamId} onChange={(event) => setSelectedSteamId(event.target.value)}>
                    <option value="">Select a player</option>
                    {filteredPlayers.map((player) => (
                      <option key={player.steamId} value={player.steamId}>
                        {player.name} - {player.steamId}{player.online ? " - online" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="SteamID">
                  <Input value={manualSteamId} onChange={(event) => setManualSteamId(cleanSteamId(event.target.value))} placeholder="Paste SteamID to grant directly" className="font-mono" />
                </Field>
                <Field label="Display name">
                  <Input value={manualName} onChange={(event) => setManualName(event.target.value)} placeholder={selectedPlayer?.name ?? "Optional"} />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={grantPermission} disabled={busy === "grant" || !permission.trim() || !targetSteamId}>
                    <ShieldPlus className="h-4 w-4" />Grant Permission
                  </Button>
                  <Button variant="secondary" onClick={grantFullAccess} disabled={busy === "grant" || !targetSteamId}>
                    <Zap className="h-4 w-4" />Grant Full Access
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => grantAdmin([targetSteamId], [{ steamId: targetSteamId, name: targetName }])}
                    disabled={busy === "admin" || !targetSteamId}
                  >
                    <Crown className="h-4 w-4" />Grant Admin
                  </Button>
                </div>
                {selectedPlayer ? (
                  <div className="rounded-md border border-white/10 bg-black/20 p-3 text-xs text-slate-400">
                    <div className="font-semibold text-slate-200">{selectedPlayer.name}</div>
                    <div className="mt-1">Last seen {formatDate(selectedPlayer.lastSeenAt)} - seen {selectedPlayer.timesSeen}x</div>
                    {selectedPlayer.aliases.length > 1 ? <div className="mt-1 break-words">Aliases: {selectedPlayer.aliases.join(", ")}</div> : null}
                  </div>
                ) : null}
              </div>
            </Panel>
          </div>

          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Bulk Grant</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Select players and grant them the chosen permission, or full access ("*"), all at once.
                </p>
              </div>
              <span className="rounded-md bg-white/[0.06] px-2 py-1 text-xs text-slate-300">{bulkSelected.size} selected</span>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={bulkSearch}
                  onChange={(event) => setBulkSearch(event.target.value)}
                  placeholder="Search players by name, alias, or SteamID"
                  className="min-w-48 flex-1"
                />
                <Button variant="secondary" onClick={() => setBulkSelected(new Set(bulkFilteredPlayers.map((p) => p.steamId)))}>
                  Select all
                </Button>
                <Button variant="secondary" onClick={() => setBulkSelected(new Set())} disabled={bulkSelected.size === 0}>
                  Clear
                </Button>
              </div>

              <div className="max-h-64 overflow-y-auto rounded-md border border-white/10 bg-black/20">
                {bulkFilteredPlayers.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500">No players found. Load players first.</p>
                ) : (
                  bulkFilteredPlayers.map((player) => (
                    <label
                      key={player.steamId}
                      className="flex cursor-pointer items-center gap-3 border-b border-white/5 px-3 py-2 text-sm last:border-b-0 hover:bg-white/[0.04]"
                    >
                      <input
                        type="checkbox"
                        checked={bulkSelected.has(player.steamId)}
                        onChange={() =>
                          setBulkSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(player.steamId)) next.delete(player.steamId);
                            else next.add(player.steamId);
                            return next;
                          })
                        }
                      />
                      <span className="min-w-0 flex-1 truncate text-slate-200">
                        {player.name}
                        {player.online ? <span className="ml-2 text-xs text-emerald-400">online</span> : null}
                      </span>
                      <span className="font-mono text-xs text-slate-500">{player.steamId}</span>
                    </label>
                  ))
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => bulkGrant(false)} disabled={busy === "bulk" || bulkSelected.size === 0 || !permission.trim()}>
                  <ShieldPlus className="h-4 w-4" />
                  Grant{permission.trim() ? ` "${permission.trim().toLowerCase()}"` : " permission"} to selected
                </Button>
                <Button variant="secondary" onClick={() => bulkGrant(true)} disabled={busy === "bulk" || bulkSelected.size === 0}>
                  <Zap className="h-4 w-4" />Grant Full Access to selected
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    grantAdmin(
                      [...bulkSelected],
                      players.filter((p) => bulkSelected.has(p.steamId)).map((p) => ({ steamId: p.steamId, name: p.name })),
                    )
                  }
                  disabled={busy === "admin" || bulkSelected.size === 0}
                >
                  <Crown className="h-4 w-4" />Grant Admin to selected
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
