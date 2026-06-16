"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  ChevronRight,
  EyeOff,
  FileText,
  Flame,
  Layers,
  MapPin,
  MessageSquare,
  RefreshCw,
  Search,
  Shield,
  ShieldOff,
  Users,
  X,
  Zap,
} from "lucide-react";
import { clsx } from "@/lib/utils";
import { Button, Select } from "@/components/ui";

// ── Types ─────────────────────────────────────────────────────────────────────

type Server = { id: string; name: string; isDefault: boolean };

type Summary = {
  isScanning: boolean;
  hasScanData: boolean;
  lastScanTime: string | null;
  stats: {
    totalStructures: number;
    massiveBuilds: number;
    highImpact: number;
    overLimit: number;
    protectedCount: number;
    unknownOwnership: number;
    totalEntities: number;
  } | null;
  error?: string;
};

type Structure = {
  id: string;
  name: string | null;
  ownerSteamId: string;
  ownerName: string;
  authorizedPlayers: string[];
  ownershipConfidence: string;
  grid: string;
  x: number; y: number; z: number;
  blockCount: number;
  entityCount: number;
  doorCount: number;
  containerCount: number;
  turretCount: number;
  trapCount: number;
  furnaceCount: number;
  workbenchCount: number;
  vendingMachineCount: number;
  signCount: number;
  electricalCount: number;
  industrialCount: number;
  deployableCount: number;
  tCCount: number;
  vehicleNearbyCount: number;
  performanceScore: number;
  sizeClass: string;
  ruleStatus: string;
  lastActive: string | null;
  isProtected: boolean;
  isIgnored: boolean;
  adminNote: string | null;
  upkeepEmpty: boolean;
};

type OwnerRow = {
  ownerSteamId: string;
  ownerName: string;
  structureCount: number;
  totalEntities: number;
  totalBlocks: number;
  totalTurrets: number;
  totalDeployables: number;
  highestScore: number;
  hasWarning: boolean;
};

type Hotspot = {
  grid: string;
  structureCount: number;
  totalEntities: number;
  highestScore: number;
  concern: string;
  owners: string[];
};

type NoteEntry = { id: string; note: string; owner: string; grid: string };

type PagedResult<T> = { total: number; page: number; pageSize: number; items: T[]; error?: string };

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = ["Overview", "Structures", "Owners", "Hotspots", "Limits", "Protected", "Notes"] as const;
type Tab = typeof TABS[number];

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 70) return "text-red-400";
  if (score >= 40) return "text-yellow-400";
  return "text-green-400";
}

function scoreBar(score: number) {
  const color = score >= 70 ? "bg-red-500" : score >= 40 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-slate-700">
        <div className={clsx("h-1.5 rounded-full", color)} style={{ width: `${score}%` }} />
      </div>
      <span className={clsx("text-xs font-bold tabular-nums", scoreColor(score))}>{score}</span>
    </div>
  );
}

function sizeColor(size: string) {
  switch (size) {
    case "Extreme": return "text-red-400 bg-red-500/10 border-red-500/30";
    case "Massive": return "text-orange-400 bg-orange-500/10 border-orange-500/30";
    case "Large":   return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
    case "Medium":  return "text-blue-400 bg-blue-500/10 border-blue-500/30";
    case "Small":   return "text-slate-300 bg-slate-500/10 border-slate-500/30";
    default:        return "text-slate-500 bg-slate-800/50 border-slate-700";
  }
}

function ruleColor(rule: string) {
  switch (rule) {
    case "Severe":  return "text-red-400 bg-red-500/10 border-red-500/30";
    case "Warning": return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
    default:        return "text-green-400 bg-green-500/10 border-green-500/30";
  }
}

function concernColor(concern: string) {
  switch (concern) {
    case "Critical": return "text-red-400";
    case "High":     return "text-orange-400";
    case "Medium":   return "text-yellow-400";
    default:         return "text-green-400";
  }
}

function confidenceColor(c: string) {
  switch (c) {
    case "High":    return "text-green-400";
    case "Medium":  return "text-yellow-400";
    case "Low":     return "text-orange-400";
    default:        return "text-slate-500";
  }
}

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", className)}>
      {label}
    </span>
  );
}

function StatCard({ label, value, sub, accent = false }: { label: string; value: number | string; sub?: string; accent?: boolean }) {
  return (
    <div className={clsx(
      "rounded-lg border p-4",
      accent
        ? "border-cyan-500/30 bg-cyan-500/5"
        : "border-slate-700/60 bg-slate-800/40",
    )}>
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className={clsx("mt-1 text-2xl font-bold tabular-nums", accent ? "text-cyan-300" : "text-slate-100")}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString();
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "Never";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function fmtRelative(iso: string | null | undefined) {
  if (!iso) return "Never";
  try {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)   return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch { return iso; }
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function StructureDetail({
  s,
  serverId,
  onClose,
  onAction,
}: {
  s: Structure;
  serverId: string;
  onClose: () => void;
  onAction: () => void;
}) {
  const [noteText, setNoteText] = useState(s.adminNote ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function doAction(action: string, extra?: Record<string, string>) {
    setBusy(true); setMsg("");
    try {
      const res = await fetch(`/api/servers/${serverId}/structure-iq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id: s.id, ...extra }),
      });
      const d = await res.json();
      if (d.error) setMsg(d.error);
      else { setMsg("Done."); onAction(); }
    } catch { setMsg("Request failed."); }
    finally { setBusy(false); }
  }

  const coords = `${s.x.toFixed(0)} ${s.y.toFixed(0)} ${s.z.toFixed(0)}`;

  return (
    <div className="flex h-full flex-col overflow-hidden border-l border-slate-700/60 bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-100">{s.name ?? `Structure ${s.id.slice(-6)}`}</span>
            <Badge label={s.sizeClass} className={sizeColor(s.sizeClass)} />
            {s.isProtected && <Badge label="Protected" className="border-blue-500/30 bg-blue-500/10 text-blue-400" />}
            {s.isIgnored   && <Badge label="Ignored"   className="border-slate-600 bg-slate-700/50 text-slate-400" />}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin className="h-3 w-3" />
            <span>{s.grid}</span>
            <span className="text-slate-600">·</span>
            <span className="font-mono">{coords}</span>
          </div>
        </div>
        <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-700 hover:text-slate-300">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Owner */}
        <section>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Ownership</div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 divide-y divide-slate-700/40">
            <Row label="Owner" value={s.ownerName} />
            <Row label="Steam ID" value={<span className="font-mono text-xs">{s.ownerSteamId}</span>} />
            <Row label="Confidence" value={<span className={confidenceColor(s.ownershipConfidence)}>{s.ownershipConfidence}</span>} />
            <Row label="Auth Players" value={s.authorizedPlayers.length === 0 ? "None" : `${s.authorizedPlayers.length} player(s)`} />
            <Row label="Last Active" value={fmtRelative(s.lastActive)} />
          </div>
        </section>

        {/* Performance */}
        <section>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Performance</div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 divide-y divide-slate-700/40">
            <Row label="StructureIQ Score" value={scoreBar(s.performanceScore)} />
            <Row label="Rule Status" value={<Badge label={s.ruleStatus} className={ruleColor(s.ruleStatus)} />} />
            <Row label="Upkeep" value={s.upkeepEmpty ? <span className="text-red-400">TC Empty</span> : <span className="text-green-400">Has Resources</span>} />
          </div>
        </section>

        {/* Entity breakdown */}
        <section>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Entity Breakdown</div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 divide-y divide-slate-700/40">
            <Row label="Total Entities"  value={fmt(s.entityCount)} />
            <Row label="Building Blocks" value={fmt(s.blockCount)} />
            <Row label="Doors"           value={fmt(s.doorCount)} />
            <Row label="Containers"      value={fmt(s.containerCount)} />
            <Row label="Turrets"         value={fmt(s.turretCount)} />
            <Row label="Furnaces"        value={fmt(s.furnaceCount)} />
            <Row label="Workbenches"     value={fmt(s.workbenchCount)} />
            <Row label="Vending"         value={fmt(s.vendingMachineCount)} />
            <Row label="Signs"           value={fmt(s.signCount)} />
            <Row label="Electrical"      value={fmt(s.electricalCount)} />
            <Row label="Industrial"      value={fmt(s.industrialCount)} />
            <Row label="Traps"           value={fmt(s.trapCount)} />
            <Row label="Vehicles Nearby" value={fmt(s.vehicleNearbyCount)} />
            <Row label="Tool Cupboards"  value={fmt(s.tCCount)} />
          </div>
        </section>

        {/* Admin note */}
        <section>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Admin Note</div>
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            rows={3}
            placeholder="Add a note about this structure..."
            className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            <Button
              className="py-1 px-2 text-xs"
              disabled={busy}
              onClick={() => doAction(noteText.trim() ? "note" : "deletenote", { message: noteText.trim() })}
            >
              {noteText.trim() ? "Save Note" : "Clear Note"}
            </Button>
          </div>
        </section>

        {msg && <p className="text-sm text-cyan-400">{msg}</p>}
      </div>

      {/* Actions */}
      <div className="border-t border-slate-700/60 p-3 flex flex-wrap gap-2">
        {s.isProtected
          ? <Button className="py-1 px-2 text-xs" variant="secondary" disabled={busy} onClick={() => doAction("unprotect")}><ShieldOff className="h-3.5 w-3.5 mr-1" />Unprotect</Button>
          : <Button className="py-1 px-2 text-xs" variant="secondary" disabled={busy} onClick={() => doAction("protect")}><Shield className="h-3.5 w-3.5 mr-1" />Protect</Button>}
        {s.isIgnored
          ? <Button className="py-1 px-2 text-xs" variant="secondary" disabled={busy} onClick={() => doAction("unignore")}><EyeOff className="h-3.5 w-3.5 mr-1" />Unignore</Button>
          : <Button className="py-1 px-2 text-xs" variant="secondary" disabled={busy} onClick={() => doAction("ignore")}><EyeOff className="h-3.5 w-3.5 mr-1" />Ignore</Button>}
        <Button className="py-1 px-2 text-xs" variant="secondary" disabled={busy} onClick={() => doAction("refresh")}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" />Refresh
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 text-right">{value}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function StructureIQClient({ servers }: { servers: Server[] }) {
  const defaultServer = servers.find(s => s.isDefault) ?? servers[0];
  const [serverId, setServerId] = useState(defaultServer?.id ?? "");
  const [tab, setTab] = useState<Tab>("Overview");

  // Data state
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [structures, setStructures] = useState<PagedResult<Structure> | null>(null);
  const [owners, setOwners]       = useState<PagedResult<OwnerRow> | null>(null);
  const [hotspots, setHotspots]   = useState<{ hotspots: Hotspot[] } | null>(null);
  const [limits, setLimits]       = useState<PagedResult<Structure> | null>(null);
  const [protected_, setProtected] = useState<{ items: Structure[] } | null>(null);
  const [notes, setNotes]         = useState<{ notes: NoteEntry[] } | null>(null);

  const [loading, setLoading]   = useState(false);
  const [scanning, setScanning] = useState(false);
  const [search, setSearch]     = useState("");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [sortKey, setSortKey]   = useState("score");
  const [selected, setSelected] = useState<Structure | null>(null);

  const api = useCallback((type: string, extra?: string) =>
    `/api/servers/${serverId}/structure-iq?type=${type}${extra ?? ""}`, [serverId]);

  const load = useCallback(async (t: Tab) => {
    if (!serverId) return;
    setLoading(true);
    try {
      switch (t) {
        case "Overview": {
          const r = await fetch(api("summary")); setSummary(await r.json()); break;
        }
        case "Structures": {
          const r = await fetch(api("structures", `&size=500&sort=${sortKey}`));
          setStructures(await r.json()); break;
        }
        case "Owners": {
          const r = await fetch(api("owners", "&size=200")); setOwners(await r.json()); break;
        }
        case "Hotspots": {
          const r = await fetch(api("hotspots")); setHotspots(await r.json()); break;
        }
        case "Limits": {
          const r = await fetch(api("limits", "&size=200")); setLimits(await r.json()); break;
        }
        case "Protected": {
          const r = await fetch(api("protected")); setProtected(await r.json()); break;
        }
        case "Notes": {
          const r = await fetch(api("notes")); setNotes(await r.json()); break;
        }
      }
    } finally { setLoading(false); }
  }, [serverId, api, sortKey]);

  // Load summary on mount / server change
  useEffect(() => { load("Overview"); }, [serverId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(tab); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function triggerScan() {
    setScanning(true);
    try {
      await fetch(`/api/servers/${serverId}/structure-iq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan" }),
      });
      // Poll summary until hasScanData changes or scan completes
      await new Promise(r => setTimeout(r, 3000));
      load("Overview");
      if (tab !== "Overview") load(tab);
    } finally { setScanning(false); }
  }

  const filteredStructures = (structures?.items ?? []).filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      s.ownerName.toLowerCase().includes(q) ||
      s.ownerSteamId.includes(q) ||
      (s.grid ?? "").toLowerCase().includes(q) ||
      (s.name ?? "").toLowerCase().includes(q) ||
      (s.adminNote ?? "").toLowerCase().includes(q);
    const matchSize = sizeFilter === "all" || s.sizeClass.toLowerCase() === sizeFilter ||
      (sizeFilter === "massive" && (s.sizeClass === "Massive" || s.sizeClass === "Extreme")) ||
      (sizeFilter === "overlimit" && s.ruleStatus !== "OK") ||
      (sizeFilter === "highimpact" && s.performanceScore >= 70) ||
      (sizeFilter === "unknown" && s.ownershipConfidence === "Unknown");
    return matchSearch && matchSize;
  });

  const tabIcon: Record<Tab, React.ReactNode> = {
    Overview:   <BarChart3 className="h-3.5 w-3.5" />,
    Structures: <Layers className="h-3.5 w-3.5" />,
    Owners:     <Users className="h-3.5 w-3.5" />,
    Hotspots:   <Flame className="h-3.5 w-3.5" />,
    Limits:     <AlertTriangle className="h-3.5 w-3.5" />,
    Protected:  <Shield className="h-3.5 w-3.5" />,
    Notes:      <FileText className="h-3.5 w-3.5" />,
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-slate-700/60 bg-slate-900/80 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10">
              <Zap className="h-4.5 w-4.5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-100">StructureIQ</h1>
              <p className="text-xs text-slate-500">Base analytics · Entity intelligence · PvE structure management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {servers.length > 1 && (
              <Select value={serverId} onChange={e => setServerId(e.target.value)} className="text-sm">
                {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            )}
            <Button
              onClick={triggerScan}
              disabled={scanning || loading}
              className="py-1 px-2 text-xs border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
            >
              <RefreshCw className={clsx("mr-1.5 h-3.5 w-3.5", (scanning || loading) && "animate-spin")} />
              {scanning ? "Scanning…" : "Scan Now"}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t
                  ? "bg-cyan-500/15 text-cyan-300"
                  : "text-slate-500 hover:bg-slate-800 hover:text-slate-300",
              )}
            >
              {tabIcon[t]}
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Content + optional detail panel */}
      <div className={clsx("flex flex-1 overflow-hidden", selected && "divide-x divide-slate-700/60")}>
        <div className="flex-1 overflow-y-auto p-6">
          {/* ── Overview ── */}
          {tab === "Overview" && (
            <div className="space-y-6">
              {summary?.error ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400 text-sm">{summary.error}</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                    <StatCard label="Total Structures" value={fmt(summary?.stats?.totalStructures)}  accent />
                    <StatCard label="Massive Builds"   value={fmt(summary?.stats?.massiveBuilds)} />
                    <StatCard label="High Impact"      value={fmt(summary?.stats?.highImpact)} />
                    <StatCard label="Over Limit"       value={fmt(summary?.stats?.overLimit)} />
                    <StatCard label="Protected"        value={fmt(summary?.stats?.protectedCount)} />
                    <StatCard label="Unknown Owner"    value={fmt(summary?.stats?.unknownOwnership)} />
                    <StatCard label="Total Entities"   value={fmt(summary?.stats?.totalEntities)} />
                  </div>
                  <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-4">
                    <div className="text-xs text-slate-500">
                      {summary?.hasScanData
                        ? <>Last scan: <span className="text-slate-300">{fmtDate(summary.lastScanTime)}</span></>
                        : "No scan data yet — click Scan Now to analyze server structures."
                      }
                    </div>
                    {summary?.isScanning && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-cyan-400">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Scan in progress…
                      </div>
                    )}
                    {!summary?.hasScanData && (
                      <div className="mt-4 space-y-2 text-sm text-slate-400">
                        <p>StructureIQ scans all player-built structures and provides:</p>
                        <ul className="ml-4 list-disc space-y-1 text-slate-500">
                          <li>Per-structure entity breakdown (blocks, turrets, electrical, signs, vending…)</li>
                          <li>Ownership confidence rating based on TC and building data</li>
                          <li>StructureIQ performance impact score (0–100)</li>
                          <li>PvE rule limit checking with Warning / Severe status</li>
                          <li>Grid-based hotspot detection for performance-sensitive areas</li>
                          <li>Admin notes and protection flags that persist across scans</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Structures ── */}
          {tab === "Structures" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search owner, grid, name, note…"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 py-1.5 pl-8 pr-3 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none"
                  />
                </div>
                <Select value={sizeFilter} onChange={e => setSizeFilter(e.target.value)} className="text-sm">
                  <option value="all">All Sizes</option>
                  <option value="tiny">Tiny</option>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                  <option value="massive">Massive / Extreme</option>
                  <option value="overlimit">Over Limit</option>
                  <option value="highimpact">High Impact (70+)</option>
                  <option value="unknown">Unknown Owner</option>
                </Select>
                <Select value={sortKey} onChange={e => { setSortKey(e.target.value); load("Structures"); }} className="text-sm">
                  <option value="score">Sort: Score</option>
                  <option value="entities">Sort: Entities</option>
                  <option value="blocks">Sort: Blocks</option>
                  <option value="owner">Sort: Owner</option>
                  <option value="grid">Sort: Grid</option>
                  <option value="active">Sort: Last Active</option>
                  <option value="rule">Sort: Rule Status</option>
                </Select>
                <span className="text-xs text-slate-500">{filteredStructures.length} structures</span>
              </div>

              {structures?.error ? (
                <PluginNotice />
              ) : (
                <div className="rounded-lg border border-slate-700/60 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/60 bg-slate-800/60 text-xs text-slate-500 uppercase tracking-wide">
                        <th className="px-3 py-2 text-left">Owner</th>
                        <th className="px-3 py-2 text-left">Grid</th>
                        <th className="px-3 py-2 text-left">Size</th>
                        <th className="px-3 py-2 text-right">Entities</th>
                        <th className="px-3 py-2 text-right">Blocks</th>
                        <th className="px-3 py-2 text-left">Score</th>
                        <th className="px-3 py-2 text-left">Rule</th>
                        <th className="px-3 py-2 text-left">Last Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStructures.map(s => (
                        <tr
                          key={s.id}
                          onClick={() => setSelected(selected?.id === s.id ? null : s)}
                          className={clsx(
                            "cursor-pointer border-b border-slate-700/30 transition-colors",
                            selected?.id === s.id
                              ? "bg-cyan-500/10"
                              : "hover:bg-slate-800/60",
                          )}
                        >
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-200">{s.ownerName}</span>
                              <span className="text-[11px] text-slate-500">{s.name ?? `#${s.id.slice(-6)}`}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-400">{s.grid}</td>
                          <td className="px-3 py-2"><Badge label={s.sizeClass} className={sizeColor(s.sizeClass)} /></td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-300">{fmt(s.entityCount)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-400">{fmt(s.blockCount)}</td>
                          <td className="px-3 py-2">{scoreBar(s.performanceScore)}</td>
                          <td className="px-3 py-2"><Badge label={s.ruleStatus} className={ruleColor(s.ruleStatus)} /></td>
                          <td className="px-3 py-2 text-xs text-slate-500">{fmtRelative(s.lastActive)}</td>
                        </tr>
                      ))}
                      {filteredStructures.length === 0 && !loading && (
                        <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-600">{structures ? "No structures match filter." : "Run a scan first."}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Owners ── */}
          {tab === "Owners" && (
            <div className="space-y-4">
              {owners?.error ? <PluginNotice /> : (
                <div className="rounded-lg border border-slate-700/60 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/60 bg-slate-800/60 text-xs text-slate-500 uppercase tracking-wide">
                        <th className="px-3 py-2 text-left">Player</th>
                        <th className="px-3 py-2 text-right">Structures</th>
                        <th className="px-3 py-2 text-right">Total Entities</th>
                        <th className="px-3 py-2 text-right">Blocks</th>
                        <th className="px-3 py-2 text-right">Turrets</th>
                        <th className="px-3 py-2 text-right">Deployables</th>
                        <th className="px-3 py-2 text-right">Peak Score</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(owners?.items ?? []).map(o => (
                        <tr key={o.ownerSteamId} className="border-b border-slate-700/30 hover:bg-slate-800/60">
                          <td className="px-3 py-2">
                            <div className="font-medium text-slate-200">{o.ownerName}</div>
                            <div className="text-[11px] font-mono text-slate-500">{o.ownerSteamId}</div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-300">{o.structureCount}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-300">{fmt(o.totalEntities)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-400">{fmt(o.totalBlocks)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-400">{fmt(o.totalTurrets)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-400">{fmt(o.totalDeployables)}</td>
                          <td className="px-3 py-2 text-right">
                            <span className={clsx("tabular-nums font-bold text-xs", scoreColor(o.highestScore))}>{o.highestScore}</span>
                          </td>
                          <td className="px-3 py-2">
                            {o.hasWarning
                              ? <Badge label="Warning" className="border-yellow-500/30 bg-yellow-500/10 text-yellow-400" />
                              : <Badge label="OK"      className="border-green-500/30 bg-green-500/10 text-green-400" />}
                          </td>
                        </tr>
                      ))}
                      {(owners?.items ?? []).length === 0 && !loading && (
                        <tr><td colSpan={8} className="py-8 text-center text-sm text-slate-600">No data. Run a scan.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Hotspots ── */}
          {tab === "Hotspots" && (
            <div className="space-y-3">
              {hotspots?.hotspots?.length === 0 && !loading && (
                <div className="py-8 text-center text-sm text-slate-600">No multi-structure grid cells found. Run a scan or server may have sparse builds.</div>
              )}
              {(hotspots?.hotspots ?? []).map(h => (
                <div key={h.grid} className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-700/60 font-mono font-bold text-slate-300">{h.grid}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-100">{h.structureCount} structures</span>
                          <span className={clsx("text-xs font-semibold", concernColor(h.concern))}>● {h.concern} concern</span>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">{fmt(h.totalEntities)} total entities · Peak score {h.highestScore}</div>
                      </div>
                    </div>
                  </div>
                  {h.owners.length > 0 && (
                    <div className="mt-2 text-xs text-slate-500">Owners: {h.owners.join(", ")}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Limits ── */}
          {tab === "Limits" && (
            <div className="space-y-4">
              {limits?.error ? <PluginNotice /> : (
                <>
                  <div className="text-xs text-slate-500">
                    Showing {limits?.total ?? 0} structure(s) that exceed configured PvE limits. No automatic action is taken — this is for admin review only.
                  </div>
                  <div className="rounded-lg border border-slate-700/60 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700/60 bg-slate-800/60 text-xs text-slate-500 uppercase tracking-wide">
                          <th className="px-3 py-2 text-left">Owner</th>
                          <th className="px-3 py-2 text-left">Grid</th>
                          <th className="px-3 py-2 text-right">Entities</th>
                          <th className="px-3 py-2 text-right">Blocks</th>
                          <th className="px-3 py-2 text-right">Turrets</th>
                          <th className="px-3 py-2 text-right">TCs</th>
                          <th className="px-3 py-2 text-right">Signs</th>
                          <th className="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(limits?.items ?? []).map(s => (
                          <tr
                            key={s.id}
                            onClick={() => setSelected(selected?.id === s.id ? null : s)}
                            className="cursor-pointer border-b border-slate-700/30 hover:bg-slate-800/60"
                          >
                            <td className="px-3 py-2 font-medium text-slate-200">{s.ownerName}</td>
                            <td className="px-3 py-2 font-mono text-xs text-slate-400">{s.grid}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-300">{fmt(s.entityCount)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-400">{fmt(s.blockCount)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-400">{fmt(s.turretCount)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-400">{fmt(s.tCCount)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-400">{fmt(s.signCount)}</td>
                            <td className="px-3 py-2"><Badge label={s.ruleStatus} className={ruleColor(s.ruleStatus)} /></td>
                          </tr>
                        ))}
                        {(limits?.items ?? []).length === 0 && !loading && (
                          <tr><td colSpan={8} className="py-8 text-center text-sm text-slate-600">No structures exceed configured limits. Run a scan first.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Protected ── */}
          {tab === "Protected" && (
            <div className="space-y-3">
              {(protected_?.items ?? []).length === 0 && !loading && (
                <div className="py-8 text-center text-sm text-slate-600">No protected or ignored structures. Select a structure in the Structures tab to protect it.</div>
              )}
              {(protected_?.items ?? []).map(s => (
                <div
                  key={s.id}
                  onClick={() => setSelected(selected?.id === s.id ? null : s)}
                  className={clsx(
                    "cursor-pointer rounded-lg border p-4 transition-colors",
                    s.isProtected ? "border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10" : "border-slate-700/60 bg-slate-800/40 hover:bg-slate-800",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {s.isProtected
                        ? <Shield className="h-4 w-4 text-blue-400 shrink-0" />
                        : <EyeOff className="h-4 w-4 text-slate-500 shrink-0" />}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-200">{s.ownerName}</span>
                          <Badge label={s.sizeClass} className={sizeColor(s.sizeClass)} />
                          <Badge label={s.isProtected ? "Protected" : "Ignored"}
                            className={s.isProtected ? "border-blue-500/30 bg-blue-500/10 text-blue-400" : "border-slate-600 bg-slate-700/50 text-slate-400"} />
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">{s.grid} · {fmt(s.entityCount)} entities</div>
                        {s.adminNote && <div className="mt-1 text-xs text-amber-400/70">📝 {s.adminNote}</div>}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-600" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Notes ── */}
          {tab === "Notes" && (
            <div className="space-y-3">
              {(notes?.notes ?? []).length === 0 && !loading && (
                <div className="py-8 text-center text-sm text-slate-600">No admin notes. Open a structure in the Structures tab to add notes.</div>
              )}
              {(notes?.notes ?? []).map(n => (
                <NoteCard key={n.id} note={n} serverId={serverId} onSaved={() => load("Notes")} />
              ))}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8 text-sm text-slate-600">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />Loading…
            </div>
          )}
        </div>

        {/* Detail side panel */}
        {selected && (
          <div className="w-80 shrink-0">
            <StructureDetail
              s={selected}
              serverId={serverId}
              onClose={() => setSelected(null)}
              onAction={() => { load(tab); if (tab !== "Overview") load("Overview"); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Note card (editable) ──────────────────────────────────────────────────────

function NoteCard({ note, serverId, onSaved }: { note: NoteEntry; serverId: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.note);
  const [busy, setBusy] = useState(false);

  async function save(del = false) {
    setBusy(true);
    try {
      await fetch(`/api/servers/${serverId}/structure-iq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: del ? "deletenote" : "note", id: note.id, message: text }),
      });
      setEditing(false);
      onSaved();
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <MessageSquare className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-slate-200">{note.owner}</span>
            <span className="mx-1.5 text-slate-600">·</span>
            <span className="font-mono text-xs text-slate-500">{note.grid}</span>
          </div>
        </div>
        <button onClick={() => setEditing(!editing)} className="text-xs text-slate-500 hover:text-slate-300">
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>
      {editing ? (
        <div className="mt-3 space-y-2">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={2}
            className="w-full resize-none rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200 focus:border-cyan-500/50 focus:outline-none" />
          <div className="flex gap-2">
            <Button className="py-1 px-2 text-xs" disabled={busy} onClick={() => save()}>Save</Button>
            <Button className="py-1 px-2 text-xs" variant="secondary" disabled={busy} onClick={() => save(true)}>Delete</Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-amber-200/80">{note.note}</p>
      )}
    </div>
  );
}

function PluginNotice() {
  return (
    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-400">
      Plugin not responding. Install MyRconStructureIQ via Exclusive Plugins and run a scan.
    </div>
  );
}
