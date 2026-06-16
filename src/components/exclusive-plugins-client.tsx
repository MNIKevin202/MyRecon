"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Download,
  Lock,
  Package,
  Server,
  Settings2,
  ShieldCheck,
  ShieldOff,
  UserPlus,
  X,
  Zap,
} from "lucide-react";
import { clsx } from "@/lib/utils";
import { Button, Panel } from "@/components/ui";

type PluginMeta = {
  id: string;
  name: string;
  version: string;
  description: string;
  longDescription: string;
  tags: string[];
  filename: string;
  permissions: string[];
};

type ServerOption = {
  id: string;
  name: string;
  isDefault: boolean;
  sftpEnabled: boolean;
};

type KnownPlayer = {
  steamId: string;
  name: string;
  connected: boolean;
};

type PermissionUser = {
  steamId: string;
  name: string;
};

// ─── Manage Permissions Modal ────────────────────────────────────────────────

function ManageModal({
  plugin,
  serverId,
  serverName,
  onClose,
}: {
  plugin: PluginMeta;
  serverId: string;
  serverName: string;
  onClose: () => void;
}) {
  const permission = plugin.permissions[0] ?? "";
  const [grantedUsers, setGrantedUsers] = useState<PermissionUser[]>([]);
  const [knownPlayers, setKnownPlayers] = useState<KnownPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // steamId being operated on
  const [error, setError] = useState("");
  const [manualSteamId, setManualSteamId] = useState("");
  const [manualName, setManualName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [accessRes, playersRes] = await Promise.all([
        fetch(`/api/servers/${serverId}/permissions/access?permission=${encodeURIComponent(permission)}`),
        fetch(`/api/servers/${serverId}/permissions/players`),
      ]);
      if (accessRes.ok) {
        const data = (await accessRes.json()) as { users: PermissionUser[] };
        setGrantedUsers(data.users ?? []);
      }
      if (playersRes.ok) {
        const data = (await playersRes.json()) as { players: KnownPlayer[] };
        setKnownPlayers(data.players ?? []);
      }
    } catch {
      setError("Failed to load permission data.");
    } finally {
      setLoading(false);
    }
  }, [serverId, permission]);

  useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const hasPermission = (steamId: string) =>
    grantedUsers.some((u) => u.steamId === steamId);

  async function grant(steamId: string, playerName: string) {
    setBusy(steamId);
    setError("");
    try {
      const res = await fetch(`/api/servers/${serverId}/permissions/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamId, permission, playerName, pluginName: plugin.name }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? "Grant failed");
      } else {
        await load();
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  async function revoke(steamId: string) {
    setBusy(steamId);
    setError("");
    try {
      const res = await fetch(`/api/servers/${serverId}/permissions/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamId, permission }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? "Revoke failed");
      } else {
        await load();
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  async function grantManual() {
    const id = manualSteamId.trim();
    if (!/^\d{15,20}$/.test(id)) { setError("Enter a valid SteamID (15–20 digits)."); return; }
    await grant(id, manualName.trim() || id);
    setManualSteamId("");
    setManualName("");
  }

  // Players not yet granted — online first, then offline
  const ungrantedPlayers = knownPlayers.filter((p) => !hasPermission(p.steamId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-lg flex-col gap-0 rounded-xl border border-white/10 bg-[#0c1017] shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <ShieldCheck className="h-5 w-5 shrink-0 text-orange-400" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white">{plugin.name} — Permissions</p>
            <p className="text-xs text-slate-500 truncate">{serverName}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[70vh] px-5 py-4 space-y-5">
          {/* Permission node */}
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Permission</span>
            <code className="ml-auto text-xs font-mono text-orange-300">{permission}</code>
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>
          )}

          {loading ? (
            <p className="py-4 text-center text-sm text-slate-500">Loading…</p>
          ) : (
            <>
              {/* Current access */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Has Access ({grantedUsers.length})
                </p>
                {grantedUsers.length === 0 ? (
                  <p className="text-sm text-slate-600">No players have this permission yet.</p>
                ) : (
                  <div className="grid gap-1">
                    {grantedUsers.map((u) => (
                      <div
                        key={u.steamId}
                        className="flex items-center gap-2.5 rounded-md bg-emerald-500/[0.08] px-3 py-2"
                      >
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        <span className="flex-1 truncate text-sm text-slate-200">{u.name}</span>
                        <span className="font-mono text-[10px] text-slate-600">{u.steamId}</span>
                        <button
                          onClick={() => void revoke(u.steamId)}
                          disabled={busy === u.steamId}
                          className="shrink-0 rounded p-1 text-slate-500 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-40"
                          title="Revoke"
                        >
                          {busy === u.steamId ? (
                            <Zap className="h-3.5 w-3.5 animate-pulse" />
                          ) : (
                            <ShieldOff className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Grant from online/known players */}
              {ungrantedPlayers.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Grant to Player
                  </p>
                  <div className="grid gap-1 max-h-48 overflow-y-auto">
                    {ungrantedPlayers.map((p) => (
                      <div
                        key={p.steamId}
                        className="flex items-center gap-2.5 rounded-md bg-white/[0.03] px-3 py-2"
                      >
                        <span className={clsx(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          p.connected ? "bg-emerald-400" : "bg-slate-600",
                        )} />
                        <span className="flex-1 truncate text-sm text-slate-300">{p.name}</span>
                        <span className="font-mono text-[10px] text-slate-600">{p.steamId}</span>
                        <button
                          onClick={() => void grant(p.steamId, p.name)}
                          disabled={busy === p.steamId}
                          className="shrink-0 rounded p-1 text-slate-500 hover:bg-emerald-500/20 hover:text-emerald-400 disabled:opacity-40"
                          title="Grant"
                        >
                          {busy === p.steamId ? (
                            <Zap className="h-3.5 w-3.5 animate-pulse" />
                          ) : (
                            <UserPlus className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual grant */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Grant by SteamID
                </p>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="SteamID (e.g. 76561198000000000)"
                    value={manualSteamId}
                    onChange={(e) => setManualSteamId(e.target.value)}
                    className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-orange-400"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Player name (optional)"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="flex-1 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-orange-400"
                    />
                    <Button onClick={() => void grantManual()} disabled={!!busy || !manualSteamId.trim()}>
                      <UserPlus className="h-4 w-4" /> Grant
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-white/10 px-5 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-slate-400 hover:bg-white/[0.06] hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Plugin Card ─────────────────────────────────────────────────────────────

type InstallState = "idle" | "installing" | "success" | "error";

function PluginCard({
  plugin,
  servers,
  installedServerIds,
  onInstalled,
}: {
  plugin: PluginMeta;
  servers: ServerOption[];
  installedServerIds: Set<string>;
  onInstalled: (serverId: string) => void;
}) {
  const defaultServerId =
    servers.find((s) => s.isDefault && s.sftpEnabled)?.id ??
    servers.find((s) => s.sftpEnabled)?.id ??
    servers[0]?.id ??
    "";

  const [serverId, setServerId] = useState(defaultServerId);
  const [installState, setInstallState] = useState<InstallState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [installedPath, setInstalledPath] = useState("");
  const [showManage, setShowManage] = useState(false);

  const selectedServer = servers.find((s) => s.id === serverId);
  const canInstall = !!selectedServer?.sftpEnabled;
  const isInstalled = installedServerIds.has(serverId);

  async function install() {
    if (!serverId || !canInstall) return;
    setInstallState("installing");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/exclusive-plugins/${plugin.id}/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId }),
      });
      const data = (await res.json()) as { success?: boolean; path?: string; error?: string };
      if (!res.ok || !data.success) {
        setErrorMsg(data.error ?? "Installation failed");
        setInstallState("error");
      } else {
        setInstalledPath(data.path ?? "");
        setInstallState("success");
        onInstalled(serverId);
      }
    } catch {
      setErrorMsg("Network error — check your connection.");
      setInstallState("error");
    }
  }

  return (
    <>
      <Panel className="flex flex-col gap-5">
        {/* Top row */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
            <Package className="h-6 w-6 text-orange-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-white">{plugin.name}</h3>
              <span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                v{plugin.version}
              </span>
              <span className="flex items-center gap-1 rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-orange-300">
                <Lock className="h-2.5 w-2.5" /> MyRcon Exclusive
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">{plugin.description}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {plugin.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-slate-500"
                >
                  {tag}
                </span>
              ))}
              {plugin.permissions.map((perm) => (
                <span
                  key={perm}
                  className="flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/[0.07] px-2 py-0.5 text-[10px] font-mono text-emerald-500"
                >
                  <ShieldCheck className="h-2.5 w-2.5" />{perm}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Long description */}
        <p className="text-sm text-slate-500 leading-relaxed">{plugin.longDescription}</p>

        {/* Install footer */}
        <div className="flex flex-wrap items-end gap-3 border-t border-white/[0.07] pt-4">
          {/* Server selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1">
              <Server className="h-2.5 w-2.5" /> Server
            </label>
            {servers.length === 0 ? (
              <p className="text-xs text-slate-500">No servers configured.</p>
            ) : (
              <select
                value={serverId}
                onChange={(e) => { setServerId(e.target.value); setInstallState("idle"); }}
                className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-orange-400"
              >
                {servers.map((s) => (
                  <option key={s.id} value={s.id} disabled={!s.sftpEnabled}>
                    {s.name}{!s.sftpEnabled ? " (SFTP disabled)" : ""}
                    {installedServerIds.has(s.id) ? " ✓" : ""}
                  </option>
                ))}
              </select>
            )}
            {selectedServer && !selectedServer.sftpEnabled && (
              <p className="text-[11px] text-amber-500/80">Enable SFTP in server settings to install.</p>
            )}
          </div>

          <div className="ml-auto flex flex-col items-end gap-2">
            {installState === "error" && (
              <p className="max-w-xs text-right text-xs text-red-400">{errorMsg}</p>
            )}
            {(installState === "success" || isInstalled) && installedPath && (
              <p className="text-[11px] font-mono text-slate-600 truncate max-w-xs text-right">{installedPath}</p>
            )}

            <div className="flex items-center gap-2">
              {/* Manage button — shown when installed on selected server */}
              {isInstalled && plugin.permissions.length > 0 && (
                <button
                  onClick={() => setShowManage(true)}
                  className="flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white transition"
                >
                  <Settings2 className="h-4 w-4" /> Manage
                </button>
              )}

              {/* Install / Installed button */}
              <Button
                onClick={install}
                disabled={!canInstall || installState === "installing"}
                className={clsx(
                  (installState === "success" || isInstalled) &&
                    "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15",
                )}
              >
                {installState === "installing" ? (
                  <><Zap className="h-4 w-4 animate-pulse" /> Installing…</>
                ) : installState === "success" || isInstalled ? (
                  <><Check className="h-4 w-4" /> Installed</>
                ) : (
                  <><Download className="h-4 w-4" /> Install Plugin</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Panel>

      {showManage && selectedServer && (
        <ManageModal
          plugin={plugin}
          serverId={serverId}
          serverName={selectedServer.name}
          onClose={() => setShowManage(false)}
        />
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ExclusivePluginsClient({
  plugins,
  servers,
  installedOn,
}: {
  plugins: PluginMeta[];
  servers: ServerOption[];
  installedOn: Record<string, string[]>;
}) {
  // Track optimistic installs within the session
  const [localInstalls, setLocalInstalls] = useState<Record<string, Set<string>>>({});

  function handleInstalled(pluginId: string, serverId: string) {
    setLocalInstalls((prev) => {
      const next = { ...prev };
      next[pluginId] = new Set([...(prev[pluginId] ?? []), serverId]);
      return next;
    });
  }

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-white">Exclusive Plugins</h1>
          <span className="flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-semibold text-orange-300">
            <Lock className="h-3 w-3" /> MyRcon Only
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Plugins built by MyRcon — available exclusively in this software. Install them directly
          to your Rust server via SFTP with one click, then manage permissions from here.
        </p>
      </div>

      {/* Plugin list */}
      {plugins.length === 0 ? (
        <Panel>
          <p className="py-8 text-center text-sm text-slate-500">No exclusive plugins available yet.</p>
        </Panel>
      ) : (
        <div className="grid gap-4">
          {plugins.map((plugin) => {
            const serverIds = new Set([
              ...(installedOn[plugin.id] ?? []),
              ...(localInstalls[plugin.id] ?? []),
            ]);
            return (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                servers={servers}
                installedServerIds={serverIds}
                onInstalled={(sid) => handleInstalled(plugin.id, sid)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
