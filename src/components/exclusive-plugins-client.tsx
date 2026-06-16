"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clipboard,
  Download,
  Lock,
  RefreshCw,
  Settings2,
  ShieldCheck,
  ShieldOff,
  Terminal,
  Trash2,
  UserPlus,
  X,
  Zap,
} from "lucide-react";
import { clsx } from "@/lib/utils";

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
  contentUrl: string;
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

// ─── Plugin Terminal ──────────────────────────────────────────────────────────

type LogLine = { ts: string; text: string; kind: "info" | "ok" | "err" | "cmd" };

function now() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function PluginTerminal({ lines, onClear }: { lines: LogLine[]; onClear: () => void }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lines]);

  function copyAll() {
    const text = lines.map((l) => `${l.ts}  ${l.text}`).join("\n");
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#060a0d]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2">
        <Terminal className="h-3.5 w-3.5 shrink-0 text-slate-600" />
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Console Output</span>
        <button
          onClick={copyAll}
          disabled={lines.length === 0}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-slate-600 hover:bg-white/[0.05] hover:text-slate-300 disabled:opacity-30 transition"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Clipboard className="h-3 w-3" />}
          {copied ? "Copied!" : "Copy"}
        </button>
        <button
          onClick={onClear}
          disabled={lines.length === 0}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-slate-600 hover:bg-white/[0.05] hover:text-slate-300 disabled:opacity-30 transition"
        >
          <X className="h-3 w-3" /> Clear
        </button>
      </div>
      <div className="max-h-56 overflow-y-auto px-4 py-3 font-mono text-[11px] leading-relaxed">
        {lines.length === 0 ? (
          <span className="text-slate-700">No output yet — run Install, Reload, or Uninstall to see results here.</span>
        ) : (
          lines.map((l, i) => (
            <div key={i} className="flex gap-3">
              <span className="shrink-0 select-none text-slate-700">{l.ts}</span>
              <span className={clsx(
                l.kind === "ok"   && "text-emerald-400",
                l.kind === "err"  && "text-red-400",
                l.kind === "cmd"  && "text-amber-300",
                l.kind === "info" && "text-slate-500",
              )}>{l.text}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ─── Plugin Card ──────────────────────────────────────────────────────────────

type ActionState = "idle" | "busy" | "ok" | "err";

function ActionBtn({
  state, onClick, disabled, children, variant = "default",
}: {
  state: ActionState;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  variant?: "default" | "ok" | "warn" | "danger";
}) {
  const base = "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-40";
  const colors = {
    default: "border-white/[0.08] text-slate-400 hover:bg-white/[0.06] hover:text-white",
    ok:      "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-400 hover:bg-emerald-500/[0.13]",
    warn:    "border-amber-500/30 bg-amber-500/[0.08] text-amber-400 hover:bg-amber-500/[0.14]",
    danger:  "border-red-500/25 bg-red-500/[0.07] text-red-400 hover:bg-red-500/[0.14]",
  };
  return (
    <button onClick={onClick} disabled={disabled || state === "busy"} className={clsx(base, colors[variant])}>
      {state === "busy" ? <Zap className="h-3 w-3 animate-pulse" /> : null}
      {children}
    </button>
  );
}

function PluginCard({
  plugin, servers, installedVersions, onInstalled, onUninstalled, addLog,
}: {
  plugin: PluginMeta;
  servers: ServerOption[];
  installedVersions: Record<string, string>;
  onInstalled: (sid: string, version: string) => void;
  onUninstalled: (sid: string) => void;
  addLog: (text: string, kind?: LogLine["kind"]) => void;
}) {
  const defaultId =
    servers.find((s) => s.isDefault && s.sftpEnabled)?.id ??
    servers.find((s) => s.sftpEnabled)?.id ??
    servers[0]?.id ?? "";

  const [serverId, setServerId]     = useState(defaultId);
  const [installState, setInstall]    = useState<ActionState>("idle");
  const [reloadState, setReload]      = useState<ActionState>("idle");
  const [uninstallState, setUninstall] = useState<ActionState>("idle");
  const [confirmUninstall, setConfirm] = useState(false);
  const [errMsg, setErrMsg]           = useState("");
  const [reloadMsg, setReloadMsg]     = useState("");
  const [uninstallMsg, setUninstallMsg] = useState("");
  const [showManage, setShowManage]   = useState(false);

  const server           = servers.find((s) => s.id === serverId);
  const canInstall       = !!server?.sftpEnabled;
  const canUninstall     = !!server?.sftpEnabled;
  const installedVersion = installedVersions[serverId];
  const isInstalled      = !!installedVersion;
  const hasUpdate        = isInstalled && installedVersion !== plugin.version;

  async function install() {
    if (!serverId || !canInstall) return;
    setInstall("busy"); setErrMsg("");
    addLog(`--- Install ${plugin.name} ---`, "info");
    try {
      const res  = await fetch(`/api/exclusive-plugins/${plugin.id}/install`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId }),
      });
      const data = (await res.json()) as { success?: boolean; version?: string; error?: string; logs?: string[] };
      for (const line of data.logs ?? []) addLog(line, line.startsWith("ERROR") ? "err" : line.startsWith("Writing") || line.startsWith("Fetching") ? "cmd" : "ok");
      if (!res.ok || !data.success) { setErrMsg(data.error ?? "Failed"); setInstall("err"); }
      else { setInstall("ok"); onInstalled(serverId, data.version ?? plugin.version); }
    } catch (e) { addLog(`Network error: ${String(e)}`, "err"); setErrMsg("Network error."); setInstall("err"); }
  }

  async function uninstall() {
    if (!serverId || !canUninstall) return;
    setUninstall("busy"); setUninstallMsg(""); setConfirm(false);
    addLog(`--- Uninstall ${plugin.name} ---`, "info");
    try {
      const res  = await fetch(`/api/exclusive-plugins/${plugin.id}/uninstall`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string; logs?: string[] };
      for (const line of data.logs ?? []) addLog(line, line.startsWith("ERROR") ? "err" : line.startsWith("Deleting") ? "cmd" : "ok");
      if (!res.ok || !data.success) { setUninstallMsg(data.error ?? "Uninstall failed"); setUninstall("err"); }
      else { setUninstall("idle"); setInstall("idle"); onUninstalled(serverId); }
    } catch (e) { addLog(`Network error: ${String(e)}`, "err"); setUninstallMsg("Network error."); setUninstall("err"); }
  }

  async function reload() {
    if (!serverId) return;
    setReload("busy"); setReloadMsg("");
    addLog(`--- Reload ${plugin.name} ---`, "info");
    try {
      const res  = await fetch(`/api/exclusive-plugins/${plugin.id}/reload`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId }),
      });
      const data = (await res.json()) as { success?: boolean; command?: string; error?: string; logs?: string[] };
      for (const line of data.logs ?? []) addLog(line, line.startsWith("ERROR") ? "err" : line.startsWith(">") ? "cmd" : "ok");
      if (!res.ok || !data.success) { setReloadMsg(data.error ?? "Reload failed"); setReload("err"); }
      else { setReloadMsg(`Reloaded via ${data.command}`); setReload("ok"); setTimeout(() => setReloadMsg(""), 4000); }
    } catch (e) { addLog(`Network error: ${String(e)}`, "err"); setReloadMsg("Network error."); setReload("err"); }
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#0d1117]">
        {/* Item image strip */}
        <div className="relative flex gap-px overflow-hidden bg-[#060a0d]" style={{ height: 72 }}>
          {plugin.previewItems.map((sn) => (
            <div key={sn} className="flex flex-1 items-center justify-center bg-[#0a0e14]" style={{ minWidth: 56, maxWidth: 72 }}>
              <ItemImg sn={sn} size={36} />
            </div>
          ))}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#060a0d]" />
          <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-orange-300 backdrop-blur-sm">
            <Lock className="h-2.5 w-2.5" /> Exclusive
          </div>
          {hasUpdate && (
            <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 backdrop-blur-sm border border-amber-500/30">
              <AlertTriangle className="h-2.5 w-2.5" /> Update available
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-4 pt-3 pb-4">
          <div className="flex items-start gap-2 min-w-0">
            <h3 className="text-sm font-semibold text-white">{plugin.name}</h3>
            <span className="shrink-0 rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
              v{plugin.version}
            </span>
            {isInstalled && !hasUpdate && (
              <span className="shrink-0 flex items-center gap-1 rounded bg-emerald-500/[0.1] px-1.5 py-0.5 text-[10px] text-emerald-500">
                <Check className="h-2.5 w-2.5" /> v{installedVersion}
              </span>
            )}
            {hasUpdate && (
              <span className="shrink-0 font-mono text-[10px] text-slate-600">installed: v{installedVersion}</span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{plugin.description}</p>

          {/* Tags + perms */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {plugin.tags.map((t) => (
              <span key={t} className="rounded border border-white/[0.07] px-1.5 py-0.5 text-[10px] text-slate-600">{t}</span>
            ))}
            {plugin.permissions.map((p) => (
              <span key={p} className="flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-emerald-600">
                <ShieldCheck className="h-2.5 w-2.5" />{p}
              </span>
            ))}
          </div>

          {/* Action row */}
          <div className="mt-3 border-t border-white/[0.05] pt-3 space-y-2">
            {/* Server selector */}
            <div className="flex items-center gap-1.5">
              <select
                value={serverId}
                onChange={(e) => { setServerId(e.target.value); setInstall("idle"); setReload("idle"); setUninstall("idle"); setConfirm(false); setErrMsg(""); setReloadMsg(""); setUninstallMsg(""); }}
                className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-xs text-slate-300 outline-none focus:border-orange-400"
              >
                {servers.map((s) => {
                  const iv = installedVersions[s.id];
                  const upd = iv && iv !== plugin.version;
                  return (
                    <option key={s.id} value={s.id} disabled={!s.sftpEnabled}>
                      {s.name}{!s.sftpEnabled ? " (SFTP off)" : ""}{iv ? (upd ? " ⚠" : " ✓") : ""}
                    </option>
                  );
                })}
              </select>
              {server && !server.sftpEnabled && (
                <span className="text-[10px] text-amber-500/70">Enable SFTP in settings</span>
              )}
            </div>

            {/* Feedback messages */}
            {errMsg        && <p className="text-[11px] text-red-400">{errMsg}</p>}
            {reloadMsg     && <p className={clsx("text-[11px]", reloadState === "err" ? "text-red-400" : "text-emerald-400")}>{reloadMsg}</p>}
            {uninstallMsg  && <p className="text-[11px] text-red-400">{uninstallMsg}</p>}

            {/* Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Manage */}
              {isInstalled && plugin.permissions.length > 0 && (
                <ActionBtn state="idle" onClick={() => setShowManage(true)}>
                  <Settings2 className="h-3 w-3" /> Manage
                </ActionBtn>
              )}

              {/* Reload — only when installed */}
              {isInstalled && (
                <ActionBtn state={reloadState} onClick={() => void reload()} variant={reloadState === "ok" ? "ok" : "default"}>
                  <RefreshCw className={clsx("h-3 w-3", reloadState === "busy" && "animate-spin")} />
                  {reloadState === "ok" ? "Reloaded" : "Reload"}
                </ActionBtn>
              )}

              {/* Uninstall — confirm-then-act */}
              {isInstalled && (
                confirmUninstall ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-red-400">Remove file?</span>
                    <ActionBtn state={uninstallState} onClick={() => void uninstall()} variant="danger" disabled={!canUninstall}>
                      <Trash2 className="h-3 w-3" />
                      {uninstallState === "busy" ? "Removing…" : "Confirm"}
                    </ActionBtn>
                    <button
                      onClick={() => setConfirm(false)}
                      className="rounded-lg border border-white/[0.08] px-2 py-1.5 text-[11px] text-slate-500 hover:text-white transition"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <ActionBtn state="idle" onClick={() => setConfirm(true)} variant="danger">
                    <Trash2 className="h-3 w-3" /> Uninstall
                  </ActionBtn>
                )
              )}

              {/* Install / Update / Installed */}
              <button
                onClick={() => void install()}
                disabled={!canInstall || installState === "busy"}
                className={clsx(
                  "ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition disabled:opacity-40",
                  hasUpdate
                    ? "border-amber-500/30 bg-amber-500/[0.08] text-amber-300 hover:bg-amber-500/[0.14]"
                    : isInstalled || installState === "ok"
                    ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-400 hover:bg-emerald-500/[0.13]"
                    : "border-orange-500/30 bg-orange-500/10 text-orange-300 hover:bg-orange-500/15",
                )}
              >
                {installState === "busy" ? (
                  <><Zap className="h-3 w-3 animate-pulse" /> {hasUpdate ? "Updating…" : "Installing…"}</>
                ) : hasUpdate ? (
                  <><Download className="h-3 w-3" /> Update to v{plugin.version}</>
                ) : isInstalled || installState === "ok" ? (
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
        <ManageModal plugin={plugin} serverId={serverId} serverName={server.name} onClose={() => setShowManage(false)} />
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
  // pluginId → { serverId → installedVersion }
  installedOn: Record<string, Record<string, string>>;
}) {
  // Console toggle — persisted to localStorage
  const [showConsole, setShowConsole] = useState(true);
  useEffect(() => {
    const stored = localStorage.getItem("ep_showConsole");
    if (stored !== null) setShowConsole(stored !== "false");
  }, []);
  function toggleConsole() {
    setShowConsole((v) => {
      localStorage.setItem("ep_showConsole", String(!v));
      return !v;
    });
  }

  // Shared console log — all plugin actions write here
  const [consoleLogs, setConsoleLogs] = useState<LogLine[]>([]);
  function addLog(text: string, kind: LogLine["kind"] = "info") {
    setConsoleLogs((prev) => [...prev, { ts: now(), text, kind }]);
  }

  // Local version map updated optimistically after install/uninstall
  const [localVersions, setLocalVersions] = useState<Record<string, Record<string, string>>>({});
  const [localUninstalled, setLocalUninstalled] = useState<Record<string, Set<string>>>({});

  // Poll manifest every 60s and surface new versions to cards without a page reload
  const [latestVersions, setLatestVersions] = useState<Record<string, string>>({});
  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/exclusive-plugins/manifest");
        if (!res.ok) return;
        const data = (await res.json()) as Record<string, { version: string }>;
        setLatestVersions((prev) => {
          const next = { ...prev };
          for (const [id, entry] of Object.entries(data)) {
            if (entry?.version) next[id] = entry.version;
          }
          return next;
        });
      } catch { /* silent — just wait for next tick */ }
    }
    void poll();
    const id = setInterval(() => void poll(), 60_000);
    return () => clearInterval(id);
  }, []);

  function handleInstalled(pluginId: string, serverId: string, version: string) {
    setLocalVersions((prev) => ({
      ...prev,
      [pluginId]: { ...(prev[pluginId] ?? {}), [serverId]: version },
    }));
    setLocalUninstalled((prev) => {
      const next = new Set(prev[pluginId]);
      next.delete(serverId);
      return { ...prev, [pluginId]: next };
    });
  }

  function handleUninstalled(pluginId: string, serverId: string) {
    setLocalUninstalled((prev) => {
      const next = new Set(prev[pluginId]);
      next.add(serverId);
      return { ...prev, [pluginId]: next };
    });
    setLocalVersions((prev) => {
      const copy = { ...(prev[pluginId] ?? {}) };
      delete copy[serverId];
      return { ...prev, [pluginId]: copy };
    });
  }

  const [tab, setTab] = useState<"download" | "installed" | "updates">("download");

  // Build merged install map for all plugins
  function mergedVersions(pluginId: string) {
    const base    = installedOn[pluginId] ?? {};
    const removed = localUninstalled[pluginId] ?? new Set<string>();
    const merged  = { ...base, ...(localVersions[pluginId] ?? {}) };
    for (const sid of removed) delete merged[sid];
    return merged;
  }

  const pluginsWithMeta = plugins.map((plugin) => {
    const mv      = mergedVersions(plugin.id);
    const livePlugin = latestVersions[plugin.id]
      ? { ...plugin, version: latestVersions[plugin.id] }
      : plugin;
    const isInstalledAnywhere = Object.keys(mv).length > 0;
    const hasUpdate = isInstalledAnywhere &&
      Object.values(mv).some((v) => v !== livePlugin.version);
    return { plugin: livePlugin, mv, isInstalledAnywhere, hasUpdate };
  });

  const downloadPlugins  = pluginsWithMeta.filter((p) => !p.isInstalledAnywhere);
  const installedPlugins = pluginsWithMeta.filter((p) => p.isInstalledAnywhere);
  const updatePlugins    = pluginsWithMeta.filter((p) => p.hasUpdate);

  function renderGrid(items: typeof pluginsWithMeta, emptyMsg: string) {
    if (items.length === 0)
      return (
        <div className="rounded-xl border border-white/[0.06] bg-[#0d1117] py-12 text-center text-sm text-slate-600">
          {emptyMsg}
        </div>
      );
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ plugin, mv }) => (
          <PluginCard
            key={plugin.id} plugin={plugin} servers={servers}
            installedVersions={mv}
            onInstalled={(sid, ver) => handleInstalled(plugin.id, sid, ver)}
            onUninstalled={(sid) => handleUninstalled(plugin.id, sid)}
            addLog={addLog}
          />
        ))}
      </div>
    );
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
        <button
          onClick={toggleConsole}
          title={showConsole ? "Hide console output" : "Show console output"}
          className={clsx(
            "ml-auto flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition",
            showConsole
              ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-400 hover:bg-emerald-500/[0.13]"
              : "border-white/[0.08] text-slate-500 hover:bg-white/[0.06] hover:text-white",
          )}
        >
          <Terminal className="h-3 w-3" />
          Console {showConsole ? "On" : "Off"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.06]">
        {([
          { key: "download",  label: "Download",         count: downloadPlugins.length,  amber: false },
          { key: "installed", label: "Installed",        count: installedPlugins.length, amber: false },
          { key: "updates",   label: "Updates Available",count: updatePlugins.length,    amber: true  },
        ] as const).map(({ key, label, count, amber }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition border-b-2 -mb-px",
              tab === key
                ? "border-orange-400 text-white"
                : "border-transparent text-slate-500 hover:text-slate-300",
            )}
          >
            {label}
            {count > 0 && (
              <span className={clsx(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                amber
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-white/[0.07] text-slate-400",
              )}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {plugins.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-[#0d1117] py-12 text-center text-sm text-slate-600">
          No exclusive plugins available yet.
        </div>
      ) : tab === "download" ? (
        renderGrid(downloadPlugins, "All plugins are already installed.")
      ) : tab === "updates" ? (
        renderGrid(updatePlugins, "All installed plugins are up to date.")
      ) : (
        renderGrid(installedPlugins, "No plugins installed yet — go to Download to install one.")
      )}

      {/* Shared full-width console */}
      {showConsole && (
        <PluginTerminal lines={consoleLogs} onClear={() => setConsoleLogs([])} />
      )}
    </div>
  );
}
