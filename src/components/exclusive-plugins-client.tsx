"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  ChevronRight,
  Download,
  Lock,
  Settings2,
  ShieldCheck,
  ShieldOff,
  UserPlus,
  X,
  Zap,
} from "lucide-react";
import { clsx } from "@/lib/utils";
import { Button } from "@/components/ui";

type PluginMeta = {
  id: string;
  name: string;
  version: string;
  description: string;
  longDescription: string;
  tags: string[];
  filename: string;
  permissions: string[];
  previewItems: string[];
};

type ServerOption = {
  id: string;
  name: string;
  isDefault: boolean;
  sftpEnabled: boolean;
};

type KnownPlayer = { steamId: string; name: string; connected: boolean };
type PermUser    = { steamId: string; name: string };

const CDN = "https://cdn.rusthelper.com/item";

function ItemImg({ sn, size = 40 }: { sn: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (err) return <div style={{ width: size, height: size }} className="rounded bg-white/[0.04]" />;
  return (
    <img
      src={`${CDN}/${sn}/image`}
      alt={sn}
      loading="lazy"
      onError={() => setErr(true)}
      style={{ width: size, height: size }}
      className="object-contain"
    />
  );
}

// ─── Manage Modal ─────────────────────────────────────────────────────────────

function ManageModal({
  plugin, serverId, serverName, onClose,
}: {
  plugin: PluginMeta; serverId: string; serverName: string; onClose: () => void;
}) {
  const perm = plugin.permissions[0] ?? "";
  const [granted, setGranted]   = useState<PermUser[]>([]);
  const [players, setPlayers]   = useState<KnownPlayer[]>([]);
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState<string | null>(null);
  const [err, setErr]           = useState("");
  const [manualId, setManualId] = useState("");
  const [manualName, setManualName] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const [ar, pr] = await Promise.all([
        fetch(`/api/servers/${serverId}/permissions/access?permission=${encodeURIComponent(perm)}`),
        fetch(`/api/servers/${serverId}/permissions/players`),
      ]);
      if (ar.ok) setGranted(((await ar.json()) as { users: PermUser[] }).users ?? []);
      if (pr.ok) setPlayers(((await pr.json()) as { players: KnownPlayer[] }).players ?? []);
    } catch { setErr("Failed to load."); }
    finally { setLoading(false); }
  }, [serverId, perm]);

  useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const hasAccess = (id: string) => granted.some((u) => u.steamId === id);

  async function grant(steamId: string, name: string) {
    setBusy(steamId); setErr("");
    const res = await fetch(`/api/servers/${serverId}/permissions/grant`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steamId, permission: perm, playerName: name, pluginName: plugin.name }),
    });
    if (!res.ok) setErr(((await res.json()) as { error?: string }).error ?? "Grant failed");
    else await load();
    setBusy(null);
  }

  async function revoke(steamId: string) {
    setBusy(steamId); setErr("");
    const res = await fetch(`/api/servers/${serverId}/permissions/revoke`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steamId, permission: perm }),
    });
    if (!res.ok) setErr(((await res.json()) as { error?: string }).error ?? "Revoke failed");
    else await load();
    setBusy(null);
  }

  async function grantManual() {
    const id = manualId.trim();
    if (!/^\d{15,20}$/.test(id)) { setErr("Enter a valid SteamID (15–20 digits)."); return; }
    await grant(id, manualName.trim() || id);
    setManualId(""); setManualName("");
  }

  const ungranted = players.filter((p) => !hasAccess(p.steamId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl shadow-black/70 overflow-hidden">
        {/* header */}
        <div className="flex items-center gap-3 border-b border-white/[0.08] bg-[#111820] px-4 py-3">
          <ShieldCheck className="h-4 w-4 shrink-0 text-orange-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-none">{plugin.name}</p>
            <p className="mt-0.5 text-[11px] text-slate-500 truncate">{serverName}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* perm node */}
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Permission</span>
          <code className="ml-auto text-[11px] font-mono text-orange-300">{perm}</code>
        </div>

        <div className="overflow-y-auto max-h-[60vh] px-4 py-3 space-y-4">
          {err && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{err}</div>}
          {loading ? (
            <p className="py-6 text-center text-sm text-slate-600">Loading…</p>
          ) : (
            <>
              {/* Has access */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Has Access · {granted.length}
                </p>
                {granted.length === 0 ? (
                  <p className="text-xs text-slate-600">Nobody granted yet.</p>
                ) : (
                  <div className="grid gap-1">
                    {granted.map((u) => (
                      <div key={u.steamId} className="flex items-center gap-2 rounded-lg bg-emerald-500/[0.07] px-2.5 py-1.5">
                        <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-500" />
                        <span className="flex-1 truncate text-xs text-slate-200">{u.name}</span>
                        <span className="font-mono text-[10px] text-slate-600 hidden sm:block">{u.steamId}</span>
                        <button
                          onClick={() => void revoke(u.steamId)}
                          disabled={busy === u.steamId}
                          className="ml-1 shrink-0 rounded p-1 text-slate-600 hover:bg-red-500/15 hover:text-red-400 disabled:opacity-40 transition"
                          title="Revoke"
                        >
                          {busy === u.steamId ? <Zap className="h-3 w-3 animate-pulse" /> : <ShieldOff className="h-3 w-3" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Grant from players */}
              {ungranted.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                    Grant to Player
                  </p>
                  <div className="grid gap-1 max-h-40 overflow-y-auto">
                    {ungranted.map((p) => (
                      <div key={p.steamId} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                        <span className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", p.connected ? "bg-emerald-400" : "bg-slate-700")} />
                        <span className="flex-1 truncate text-xs text-slate-300">{p.name}</span>
                        <button
                          onClick={() => void grant(p.steamId, p.name)}
                          disabled={busy === p.steamId}
                          className="shrink-0 rounded p-1 text-slate-600 hover:bg-emerald-500/15 hover:text-emerald-400 disabled:opacity-40 transition"
                          title="Grant"
                        >
                          {busy === p.steamId ? <Zap className="h-3 w-3 animate-pulse" /> : <UserPlus className="h-3 w-3" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Grant by SteamID</p>
                <div className="flex flex-col gap-1.5">
                  <input
                    type="text" placeholder="76561198000000000"
                    value={manualId} onChange={(e) => setManualId(e.target.value)}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 outline-none focus:border-orange-400 font-mono"
                  />
                  <div className="flex gap-1.5">
                    <input
                      type="text" placeholder="Name (optional)"
                      value={manualName} onChange={(e) => setManualName(e.target.value)}
                      className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 outline-none focus:border-orange-400"
                    />
                    <button
                      onClick={() => void grantManual()} disabled={!!busy || !manualId.trim()}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.08] hover:text-white disabled:opacity-40 transition"
                    >
                      <UserPlus className="h-3 w-3" /> Grant
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-white/[0.08] px-4 py-3">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-white/[0.08] py-2 text-xs text-slate-500 hover:bg-white/[0.05] hover:text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Plugin Card ──────────────────────────────────────────────────────────────

type InstallState = "idle" | "installing" | "success" | "error";

function PluginCard({
  plugin, servers, installedServerIds, onInstalled,
}: {
  plugin: PluginMeta;
  servers: ServerOption[];
  installedServerIds: Set<string>;
  onInstalled: (sid: string) => void;
}) {
  const defaultId =
    servers.find((s) => s.isDefault && s.sftpEnabled)?.id ??
    servers.find((s) => s.sftpEnabled)?.id ??
    servers[0]?.id ?? "";

  const [serverId, setServerId]   = useState(defaultId);
  const [state, setState]         = useState<InstallState>("idle");
  const [errMsg, setErrMsg]       = useState("");
  const [showManage, setShowManage] = useState(false);

  const server     = servers.find((s) => s.id === serverId);
  const canInstall = !!server?.sftpEnabled;
  const installed  = installedServerIds.has(serverId);

  async function install() {
    if (!serverId || !canInstall) return;
    setState("installing"); setErrMsg("");
    try {
      const res = await fetch(`/api/exclusive-plugins/${plugin.id}/install`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) { setErrMsg(data.error ?? "Failed"); setState("error"); }
      else { setState("success"); onInstalled(serverId); }
    } catch { setErrMsg("Network error."); setState("error"); }
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#0d1117]">
        {/* Item image strip — F1-menu style grid */}
        <div className="relative flex gap-px overflow-hidden bg-[#060a0d]" style={{ height: 72 }}>
          {plugin.previewItems.map((sn) => (
            <div
              key={sn}
              className="flex flex-1 items-center justify-center bg-[#0a0e14] hover:bg-[#111820] transition"
              style={{ minWidth: 56, maxWidth: 72 }}
            >
              <ItemImg sn={sn} size={36} />
            </div>
          ))}
          {/* Gradient fade on right */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#060a0d]" />
          {/* Exclusive badge over strip */}
          <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-orange-300 backdrop-blur-sm">
            <Lock className="h-2.5 w-2.5" /> Exclusive
          </div>
        </div>

        {/* Body */}
        <div className="px-4 pt-3 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">{plugin.name}</h3>
                <span className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                  v{plugin.version}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{plugin.description}</p>
            </div>
          </div>

          {/* Tags + permission nodes */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {plugin.tags.map((t) => (
              <span key={t} className="rounded border border-white/[0.07] px-1.5 py-0.5 text-[10px] text-slate-600">
                {t}
              </span>
            ))}
            {plugin.permissions.map((p) => (
              <span key={p} className="flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-emerald-600">
                <ShieldCheck className="h-2.5 w-2.5" />{p}
              </span>
            ))}
          </div>

          {/* Action row */}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-3">
            {/* Server select */}
            <div className="flex items-center gap-1.5">
              <select
                value={serverId}
                onChange={(e) => { setServerId(e.target.value); setState("idle"); }}
                className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-xs text-slate-300 outline-none focus:border-orange-400"
              >
                {servers.map((s) => (
                  <option key={s.id} value={s.id} disabled={!s.sftpEnabled}>
                    {s.name}{!s.sftpEnabled ? " (SFTP off)" : ""}{installedServerIds.has(s.id) ? " ✓" : ""}
                  </option>
                ))}
              </select>
              {server && !server.sftpEnabled && (
                <span className="text-[10px] text-amber-500/70">Enable SFTP in settings</span>
              )}
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              {errMsg && <span className="text-[11px] text-red-400">{errMsg}</span>}

              {/* Manage — only when installed */}
              {installed && plugin.permissions.length > 0 && (
                <button
                  onClick={() => setShowManage(true)}
                  className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[11px] text-slate-400 hover:bg-white/[0.06] hover:text-white transition"
                >
                  <Settings2 className="h-3 w-3" /> Manage
                </button>
              )}

              {/* Install / Installed */}
              <button
                onClick={install}
                disabled={!canInstall || state === "installing"}
                className={clsx(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition disabled:opacity-40",
                  installed || state === "success"
                    ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-400 hover:bg-emerald-500/[0.13]"
                    : "border-orange-500/30 bg-orange-500/10 text-orange-300 hover:bg-orange-500/15",
                )}
              >
                {state === "installing" ? (
                  <><Zap className="h-3 w-3 animate-pulse" /> Installing…</>
                ) : installed || state === "success" ? (
                  <><Check className="h-3 w-3" /> Installed</>
                ) : (
                  <><Download className="h-3 w-3" /> Install</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showManage && server && (
        <ManageModal
          plugin={plugin} serverId={serverId} serverName={server.name}
          onClose={() => setShowManage(false)}
        />
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ExclusivePluginsClient({
  plugins, servers, installedOn,
}: {
  plugins: PluginMeta[];
  servers: ServerOption[];
  installedOn: Record<string, string[]>;
}) {
  const [localInstalls, setLocalInstalls] = useState<Record<string, Set<string>>>({});

  function handleInstalled(pluginId: string, serverId: string) {
    setLocalInstalls((prev) => ({
      ...prev,
      [pluginId]: new Set([...(prev[pluginId] ?? []), serverId]),
    }));
  }

  return (
    <div className="grid gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Exclusive Plugins</h1>
            <span className="flex items-center gap-1 rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
              <Lock className="h-2.5 w-2.5" /> MyRcon Only
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Install exclusive plugins to your server in one click, then manage permissions from here.
          </p>
        </div>
        <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-700" />
      </div>

      {plugins.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-[#0d1117] py-12 text-center text-sm text-slate-600">
          No exclusive plugins available yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plugins.map((plugin) => {
            const ids = new Set([...(installedOn[plugin.id] ?? []), ...(localInstalls[plugin.id] ?? [])]);
            return (
              <PluginCard
                key={plugin.id} plugin={plugin} servers={servers}
                installedServerIds={ids}
                onInstalled={(sid) => handleInstalled(plugin.id, sid)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
