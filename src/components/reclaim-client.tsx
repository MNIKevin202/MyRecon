"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { clsx } from "@/lib/utils";
import { Button, Select } from "@/components/ui";

// ── Types ─────────────────────────────────────────────────────────────────────

type Server = { id: string; name: string; isDefault: boolean };

type Summary = {
  lastScanTime: string | null;
  isScanning: boolean;
  hasScanData: boolean;
  totalBases: number;
  abandonedBases: number;
  cleanupReadyBases: number;
  protectedCount: number;
  totalVehicles: number;
  unusedVehicles: number;
  totalDeployables: number;
  abandonedDeployables: number;
  estimatedEntities: number;
  error?: string;
};

type BaseEntry = {
  id: string; ownerSteamId: string; ownerName: string;
  status: string; risk: string; lastActivity: string | null;
  entityCount: number; grid: string; x: number; y: number; z: number;
  upkeepEmpty: boolean; flagReason: string; isProtected: boolean; isIgnored: boolean;
};

type VehicleEntry = {
  id: string; entityType: string; ownerSteamId: string; ownerName: string;
  status: string; risk: string; lastUsed: string | null;
  grid: string; x: number; y: number; z: number;
  healthPercent: number; isDecaying: boolean; isProtected: boolean; isIgnored: boolean;
};

type DeployableEntry = {
  id: string; entityType: string; ownerSteamId: string; ownerName: string;
  status: string; risk: string; lastInteraction: string | null;
  grid: string; hasTCCoverage: boolean; isProtected: boolean; isIgnored: boolean;
};

type ProtectedEntry = { id: string; type: string; owner: string; grid: string; status: string };

type HistoryEntry = {
  admin: string; entityType: string; ownerName: string; ownerId: string;
  grid: string; position: string; entityCount: number;
  reason: string; time: string; automatic: boolean;
};

type PagedResult<T> = { total: number; page: number; pageSize: number; items: T[]; error?: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

const TABS = ["Overview", "Bases", "Vehicles", "Deployables", "Protected", "History"] as const;
type Tab = typeof TABS[number];

function statusColor(status: string) {
  switch (status) {
    case "CleanupReady":      return "text-red-400 bg-red-500/10 border-red-500/30";
    case "Abandoned":         return "text-orange-400 bg-orange-500/10 border-orange-500/30";
    case "PossiblyAbandoned": return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
    case "Decaying":          return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    case "Protected":         return "text-blue-400 bg-blue-500/10 border-blue-500/30";
    case "Active":            return "text-green-400 bg-green-500/10 border-green-500/30";
    default:                  return "text-slate-400 bg-slate-500/10 border-slate-500/30";
  }
}

function riskColor(risk: string) {
  switch (risk) {
    case "Low":    return "text-red-400";
    case "Medium": return "text-yellow-400";
    default:       return "text-green-400";
  }
}

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", className)}>
      {label}
    </span>
  );
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "Never";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)   return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  if (days < 365) return `${days}d ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function StatCard({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-[#0e1118] p-4">
      <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</div>
      <div className={clsx("mt-1 text-2xl font-bold", accent ?? "text-white")}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0e1118] p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-400" />
          <p className="text-sm text-slate-200">{message}</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ReclaimClient({ servers }: { servers: Server[] }) {
  const defaultServer = servers.find(s => s.isDefault) ?? servers[0];
  const [serverId, setServerId] = useState(defaultServer?.id ?? "");
  const [tab, setTab]           = useState<Tab>("Overview");
  const [summary, setSummary]   = useState<Summary | null>(null);
  const [loading, setLoading]   = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError]       = useState("");
  const [confirm, setConfirm]   = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [actionMsg, setActionMsg] = useState("");

  // Tab-specific data
  const [bases,       setBases]       = useState<PagedResult<BaseEntry> | null>(null);
  const [vehicles,    setVehicles]    = useState<PagedResult<VehicleEntry> | null>(null);
  const [deployables, setDeployables] = useState<PagedResult<DeployableEntry> | null>(null);
  const [protected_,  setProtected]   = useState<{ total: number; items: ProtectedEntry[] } | null>(null);
  const [history,     setHistory]     = useState<PagedResult<HistoryEntry> | null>(null);
  const [basesPage,   setBasesPage]   = useState(0);
  const [vehPage,     setVehPage]     = useState(0);
  const [depPage,     setDepPage]     = useState(0);
  const [histPage,    setHistPage]    = useState(0);
  const [statusFilter, setStatusFilter] = useState("All");

  const api = useCallback(async (params: string) => {
    const r = await fetch(`/api/servers/${serverId}/reclaim${params}`);
    return r.json();
  }, [serverId]);

  const postApi = useCallback(async (body: object) => {
    const r = await fetch(`/api/servers/${serverId}/reclaim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r.json();
  }, [serverId]);

  const loadSummary = useCallback(async () => {
    if (!serverId) return;
    setLoading(true); setError("");
    try { setSummary(await api("?type=summary")); }
    catch { setError("Failed to connect to server."); }
    finally { setLoading(false); }
  }, [api, serverId]);

  const loadTabData = useCallback(async () => {
    if (!serverId) return;
    switch (tab) {
      case "Bases":
        setBases(await api(`?type=bases&page=${basesPage}`));
        break;
      case "Vehicles":
        setVehicles(await api(`?type=vehicles&page=${vehPage}`));
        break;
      case "Deployables":
        setDeployables(await api(`?type=deployables&page=${depPage}`));
        break;
      case "Protected":
        setProtected(await api("?type=protected"));
        break;
      case "History":
        setHistory(await api(`?type=history&page=${histPage}`));
        break;
    }
  }, [api, serverId, tab, basesPage, vehPage, depPage, histPage]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { if (tab !== "Overview") loadTabData(); }, [loadTabData, tab]);

  async function doScan() {
    setScanning(true); setError(""); setActionMsg("");
    try {
      await postApi({ action: "scan" });
      // Poll until scan completes
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const s = await api("?type=summary");
        setSummary(s);
        if (!s.isScanning || attempts > 30) {
          clearInterval(poll);
          setScanning(false);
          if (tab !== "Overview") loadTabData();
          setActionMsg("Scan complete.");
        }
      }, 2000);
    } catch {
      setScanning(false);
      setError("Scan failed.");
    }
  }

  async function doAction(action: string, netId: string, label: string) {
    if (action === "delete") {
      setConfirm({
        message: `Delete ${label}? This action cannot be undone. Protected entities cannot be deleted.`,
        onConfirm: async () => {
          setConfirm(null);
          const result = await postApi({ action: "delete", netId });
          if (result.error) setActionMsg(`Error: ${result.error}`);
          else { setActionMsg(`Deleted ${result.type ?? label} (${result.entityCount ?? 1} entities).`); loadTabData(); loadSummary(); }
        },
      });
    } else {
      const result = await postApi({ action, netId });
      if (result.error) setActionMsg(`Error: ${result.error}`);
      else { setActionMsg(`${action.charAt(0).toUpperCase() + action.slice(1)} applied to ${netId}.`); loadTabData(); loadSummary(); }
    }
  }

  if (!serverId) return <div className="py-16 text-center text-slate-500">No servers configured.</div>;

  return (
    <div>
      {confirm && <ConfirmModal message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Reclaim</h1>
          <p className="mt-0.5 text-sm text-slate-400">Identify and clean up abandoned bases, vehicles, and deployables</p>
        </div>
        <div className="flex items-center gap-3">
          {servers.length > 1 && (
            <Select value={serverId} onChange={e => setServerId(e.target.value)}>
              {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          )}
          <Button onClick={doScan} disabled={scanning || loading} variant="primary">
            {scanning ? <><RefreshCw className="h-4 w-4 animate-spin" /> Scanning…</> : <><Search className="h-4 w-4" /> Scan Server</>}
          </Button>
          <button onClick={loadSummary} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-slate-400 hover:text-white">
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Messages */}
      {error     && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</div>}
      {actionMsg && <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-400">{actionMsg}</div>}

      {/* No plugin installed */}
      {summary?.error && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-400"><AlertTriangle className="h-4 w-4" /> Plugin not responding</div>
          <p className="mt-1 text-xs text-amber-300/70">Install MyRconReclaim on your server via Exclusive Plugins, then run a scan.</p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b border-white/[0.07]">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx("px-4 py-2 text-sm font-medium transition",
              tab === t ? "border-b-2 border-orange-500 text-orange-300" : "text-slate-400 hover:text-slate-200"
            )}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "Overview"    && <OverviewTab summary={summary} onScan={doScan} scanning={scanning} />}
      {tab === "Bases"       && <BasesTab data={bases} page={basesPage} onPage={setBasesPage} onAction={doAction} filter={statusFilter} onFilter={setStatusFilter} />}
      {tab === "Vehicles"    && <VehiclesTab data={vehicles} page={vehPage} onPage={setVehPage} onAction={doAction} />}
      {tab === "Deployables" && <DeployablesTab data={deployables} page={depPage} onPage={setDepPage} onAction={doAction} />}
      {tab === "Protected"   && <ProtectedTab data={protected_} onAction={doAction} />}
      {tab === "History"     && <HistoryTab data={history} page={histPage} onPage={setHistPage} />}
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function OverviewTab({ summary, onScan, scanning }: { summary: Summary | null; onScan: () => void; scanning: boolean }) {
  if (!summary || summary.error) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-400">Run a scan to see server cleanup data.</p>
        <div className="mt-4">
          <Button onClick={onScan} disabled={scanning} variant="primary">
            {scanning ? "Scanning…" : "Scan Now"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Abandoned Bases"    value={summary.abandonedBases}       accent="text-orange-400" />
        <StatCard label="Cleanup Ready"      value={summary.cleanupReadyBases}     accent="text-red-400" />
        <StatCard label="Unused Vehicles"    value={summary.unusedVehicles}        accent="text-yellow-400" />
        <StatCard label="Stray Deployables"  value={summary.abandonedDeployables}  accent="text-amber-400" />
        <StatCard label="Protected"          value={summary.protectedCount}         accent="text-blue-400" />
        <StatCard label="Est. Entities"      value={summary.estimatedEntities}     sub="reclaimable" accent="text-slate-300" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/[0.07] bg-[#0e1118] p-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Total Bases</div>
          <div className="mt-1 text-xl font-bold text-white">{summary.totalBases}</div>
          <div className="mt-1 text-xs text-slate-500">{summary.abandonedBases} flagged · {summary.cleanupReadyBases} cleanup-ready</div>
        </div>
        <div className="rounded-lg border border-white/[0.07] bg-[#0e1118] p-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Total Vehicles</div>
          <div className="mt-1 text-xl font-bold text-white">{summary.totalVehicles}</div>
          <div className="mt-1 text-xs text-slate-500">{summary.unusedVehicles} unused</div>
        </div>
        <div className="rounded-lg border border-white/[0.07] bg-[#0e1118] p-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Last Scan</div>
          <div className="mt-1 text-xl font-bold text-white">{formatDate(summary.lastScanTime)}</div>
          <div className="mt-1 text-xs text-slate-500">{summary.lastScanTime ? new Date(summary.lastScanTime).toLocaleString() : "Never"}</div>
        </div>
      </div>

      {!summary.hasScanData && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">
          No scan data yet. Click &quot;Scan Server&quot; to detect abandoned assets.
        </div>
      )}
    </div>
  );
}

// ── Bases ─────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ["All", "CleanupReady", "Abandoned", "PossiblyAbandoned", "Decaying", "Protected", "Active"];

function BasesTab({ data, page, onPage, onAction, filter, onFilter }: {
  data: PagedResult<BaseEntry> | null;
  page: number; onPage: (p: number) => void;
  onAction: (action: string, netId: string, label: string) => void;
  filter: string; onFilter: (f: string) => void;
}) {
  if (!data) return <EmptyState message="Loading bases…" />;
  if (data.error) return <EmptyState message={data.error} error />;

  const filtered = filter === "All" ? data.items : data.items.filter(b => b.status === filter);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Filter:</span>
        {STATUS_OPTIONS.map(s => (
          <button key={s} onClick={() => onFilter(s)}
            className={clsx("rounded px-2 py-0.5 text-xs font-medium transition",
              filter === s ? "bg-orange-500/20 text-orange-300" : "text-slate-500 hover:text-slate-300"
            )}>
            {s}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500">{data.total} total</span>
      </div>

      {filtered.length === 0 ? <EmptyState message="No bases match this filter." /> : (
        <div className="overflow-x-auto rounded-lg border border-white/[0.07]">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] text-left text-xs font-semibold uppercase tracking-widest text-slate-500">
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Last Activity</th>
                <th className="px-4 py-3">Entities</th>
                <th className="px-4 py-3">Grid</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{b.ownerName}</div>
                    <div className="text-xs text-slate-500">{b.ownerSteamId}</div>
                  </td>
                  <td className="px-4 py-3"><Badge label={b.status} className={statusColor(b.status)} /></td>
                  <td className="px-4 py-3"><span className={clsx("text-xs font-semibold", riskColor(b.risk))}>{b.risk}</span></td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(b.lastActivity)}</td>
                  <td className="px-4 py-3 text-slate-300">{b.entityCount}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-slate-300"><MapPin className="h-3 w-3" />{b.grid}</span>
                  </td>
                  <td className="max-w-[200px] px-4 py-3 text-xs text-slate-500">{b.flagReason}</td>
                  <td className="px-4 py-3">
                    <ActionButtons entry={b} onAction={onAction} label={`${b.ownerName}'s base at ${b.grid}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} total={data.total} pageSize={data.pageSize} onPage={onPage} />
    </div>
  );
}

// ── Vehicles ──────────────────────────────────────────────────────────────────

function VehiclesTab({ data, page, onPage, onAction }: {
  data: PagedResult<VehicleEntry> | null;
  page: number; onPage: (p: number) => void;
  onAction: (action: string, netId: string, label: string) => void;
}) {
  if (!data) return <EmptyState message="Loading vehicles…" />;
  if (data.error) return <EmptyState message={data.error} error />;
  if (data.items.length === 0) return <EmptyState message="No tracked vehicles found. Run a scan first." />;

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500 text-right">{data.total} total</div>
      <div className="overflow-x-auto rounded-lg border border-white/[0.07]">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.07] text-left text-xs font-semibold uppercase tracking-widest text-slate-500">
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">HP</th>
              <th className="px-4 py-3">Last Used</th>
              <th className="px-4 py-3">Grid</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map(v => (
              <tr key={v.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-medium text-white">{v.entityType}</td>
                <td className="px-4 py-3">
                  <div className="text-slate-200">{v.ownerName}</div>
                  <div className="text-xs text-slate-500">{v.ownerSteamId}</div>
                </td>
                <td className="px-4 py-3"><Badge label={v.status} className={statusColor(v.status)} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 rounded-full bg-white/10">
                      <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${Math.round(v.healthPercent * 100)}%` }} />
                    </div>
                    <span className="text-xs text-slate-400">{Math.round(v.healthPercent * 100)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-400">{formatDate(v.lastUsed)}</td>
                <td className="px-4 py-3"><span className="flex items-center gap-1 text-slate-300"><MapPin className="h-3 w-3" />{v.grid}</span></td>
                <td className="px-4 py-3">
                  <ActionButtons entry={v} onAction={onAction} label={`${v.entityType} at ${v.grid}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={data.total} pageSize={data.pageSize} onPage={onPage} />
    </div>
  );
}

// ── Deployables ───────────────────────────────────────────────────────────────

function DeployablesTab({ data, page, onPage, onAction }: {
  data: PagedResult<DeployableEntry> | null;
  page: number; onPage: (p: number) => void;
  onAction: (action: string, netId: string, label: string) => void;
}) {
  if (!data) return <EmptyState message="Loading deployables…" />;
  if (data.error) return <EmptyState message={data.error} error />;
  if (data.items.length === 0) return <EmptyState message="No abandoned deployables found." />;

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500 text-right">{data.total} total</div>
      <div className="overflow-x-auto rounded-lg border border-white/[0.07]">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.07] text-left text-xs font-semibold uppercase tracking-widest text-slate-500">
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">TC Coverage</th>
              <th className="px-4 py-3">Last Interaction</th>
              <th className="px-4 py-3">Grid</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map(d => (
              <tr key={d.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-mono text-xs text-slate-300">{d.entityType}</td>
                <td className="px-4 py-3">
                  <div className="text-slate-200">{d.ownerName}</div>
                  <div className="text-xs text-slate-500">{d.ownerSteamId}</div>
                </td>
                <td className="px-4 py-3"><Badge label={d.status} className={statusColor(d.status)} /></td>
                <td className="px-4 py-3">
                  {d.hasTCCoverage
                    ? <span className="text-xs text-green-400">Yes</span>
                    : <span className="text-xs text-red-400">No</span>}
                </td>
                <td className="px-4 py-3 text-slate-400">{formatDate(d.lastInteraction)}</td>
                <td className="px-4 py-3"><span className="flex items-center gap-1 text-slate-300"><MapPin className="h-3 w-3" />{d.grid}</span></td>
                <td className="px-4 py-3">
                  <ActionButtons entry={d} onAction={onAction} label={`${d.entityType} at ${d.grid}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={data.total} pageSize={data.pageSize} onPage={onPage} />
    </div>
  );
}

// ── Protected ─────────────────────────────────────────────────────────────────

function ProtectedTab({ data, onAction }: {
  data: { total: number; items: ProtectedEntry[] } | null;
  onAction: (action: string, netId: string, label: string) => void;
}) {
  if (!data) return <EmptyState message="Loading protected entities…" />;
  if (data.items.length === 0) return (
    <div className="py-12 text-center">
      <Shield className="mx-auto h-10 w-10 text-slate-600" />
      <p className="mt-3 text-slate-400">No protected entities.</p>
      <p className="mt-1 text-xs text-slate-500">Use /reclaim protect in-game or the protect button on any entry to shield it from cleanup.</p>
    </div>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-white/[0.07]">
      <table className="w-full min-w-[500px] text-sm">
        <thead>
          <tr className="border-b border-white/[0.07] text-left text-xs font-semibold uppercase tracking-widest text-slate-500">
            <th className="px-4 py-3">Net ID</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3">Grid</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map(p => (
            <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
              <td className="px-4 py-3 font-mono text-xs text-slate-400">{p.id}</td>
              <td className="px-4 py-3 text-slate-200">{p.type}</td>
              <td className="px-4 py-3 text-slate-300">{p.owner || "—"}</td>
              <td className="px-4 py-3 text-slate-400">{p.grid || "—"}</td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => onAction("unprotect", p.id, p.type)}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-yellow-400 hover:bg-yellow-500/10">
                  <ShieldOff className="h-3 w-3" /> Unprotect
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── History ───────────────────────────────────────────────────────────────────

function HistoryTab({ data, page, onPage }: {
  data: PagedResult<HistoryEntry> | null;
  page: number; onPage: (p: number) => void;
}) {
  if (!data) return <EmptyState message="Loading history…" />;
  if (data.items.length === 0) return (
    <div className="py-12 text-center">
      <Clock className="mx-auto h-10 w-10 text-slate-600" />
      <p className="mt-3 text-slate-400">No cleanup history yet.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500 text-right">{data.total} entries</div>
      <div className="overflow-x-auto rounded-lg border border-white/[0.07]">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.07] text-left text-xs font-semibold uppercase tracking-widest text-slate-500">
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Admin</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Grid</th>
              <th className="px-4 py-3">Entities</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Mode</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((h, i) => (
              <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(h.time)}</td>
                <td className="px-4 py-3 font-medium text-white">{h.admin}</td>
                <td className="px-4 py-3 text-slate-300">{h.entityType}</td>
                <td className="px-4 py-3 text-slate-300">{h.ownerName}</td>
                <td className="px-4 py-3 text-slate-400">{h.grid}</td>
                <td className="px-4 py-3 text-slate-300">{h.entityCount}</td>
                <td className="max-w-[180px] px-4 py-3 text-xs text-slate-500">{h.reason}</td>
                <td className="px-4 py-3">
                  <Badge label={h.automatic ? "Auto" : "Manual"}
                    className={h.automatic ? "text-purple-400 bg-purple-500/10 border-purple-500/30" : "text-blue-400 bg-blue-500/10 border-blue-500/30"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={data.total} pageSize={data.pageSize} onPage={onPage} />
    </div>
  );
}

// ── Shared subcomponents ──────────────────────────────────────────────────────

function ActionButtons({ entry, onAction, label }: {
  entry: { id: string; isProtected?: boolean; isIgnored?: boolean; status?: string };
  onAction: (action: string, netId: string, label: string) => void;
  label: string;
}) {
  const canDelete = entry.status !== "Active" && entry.status !== "Protected" && !entry.isProtected;
  return (
    <div className="flex items-center justify-end gap-1">
      {entry.isProtected ? (
        <button onClick={() => onAction("unprotect", entry.id, label)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-yellow-400 hover:bg-yellow-500/10">
          <ShieldOff className="h-3 w-3" /> Unprotect
        </button>
      ) : (
        <button onClick={() => onAction("protect", entry.id, label)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10">
          <Shield className="h-3 w-3" /> Protect
        </button>
      )}
      {!entry.isIgnored ? (
        <button onClick={() => onAction("ignore", entry.id, label)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:bg-white/5">
          <X className="h-3 w-3" /> Ignore
        </button>
      ) : (
        <button onClick={() => onAction("unignore", entry.id, label)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:bg-white/5">
          <CheckCircle2 className="h-3 w-3" /> Unignore
        </button>
      )}
      {canDelete && (
        <button onClick={() => onAction("delete", entry.id, label)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10">
          <Trash2 className="h-3 w-3" /> Delete
        </button>
      )}
    </div>
  );
}

function Pagination({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between text-sm text-slate-400">
      <span>Page {page + 1} of {pages}</span>
      <div className="flex gap-2">
        {page > 0       && <Button variant="secondary" onClick={() => onPage(page - 1)}>Previous</Button>}
        {page < pages-1 && <Button variant="secondary" onClick={() => onPage(page + 1)}>Next</Button>}
      </div>
    </div>
  );
}

function EmptyState({ message, error }: { message: string; error?: boolean }) {
  return (
    <div className={clsx("py-10 text-center text-sm", error ? "text-red-400" : "text-slate-500")}>
      {error && <AlertTriangle className="mx-auto mb-2 h-5 w-5" />}
      {message}
    </div>
  );
}
