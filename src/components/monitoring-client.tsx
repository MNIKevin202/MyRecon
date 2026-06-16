"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, HardDrive, RefreshCw, Users } from "lucide-react";
import { Panel, Select } from "@/components/ui";
import { api, clsx } from "@/lib/utils";

type Server = { id: string; name: string; isDefault: boolean };

type Metric = {
  createdAt: string;
  fps: number | null;
  players: number | null;
  memoryMb: number | null;
};

type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Activity;
  color: string;
};

function StatCard({ label, value, sub, icon: Icon, color }: StatCardProps) {
  return (
    <Panel className="min-h-24">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-400">{label}</div>
        <Icon className={clsx("h-4 w-4", color)} />
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-slate-500">{sub}</div> : null}
    </Panel>
  );
}

type LineChartProps = {
  data: (number | null)[];
  labels: string[];
  color: string;
  unit: string;
  min?: number;
};

function LineChart({ data, labels, color, unit, min = 0 }: LineChartProps) {
  const valid = data.filter((v): v is number => v !== null);
  const maxVal = valid.length ? Math.max(...valid) : 1;
  const minVal = Math.min(min, valid.length ? Math.min(...valid) : 0);
  const range = maxVal - minVal || 1;

  const W = 600;
  const H = 120;
  const PAD = { top: 8, right: 8, bottom: 24, left: 40 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const points = data
    .map((v, i) => {
      if (v === null) return null;
      const x = PAD.left + (i / Math.max(data.length - 1, 1)) * innerW;
      const y = PAD.top + innerH - ((v - minVal) / range) * innerH;
      return { x, y, v };
    })
    .filter((p): p is { x: number; y: number; v: number } => p !== null);

  const path =
    points.length < 2
      ? ""
      : points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const area =
    points.length < 2
      ? ""
      : `${path} L${points[points.length - 1].x.toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${points[0].x.toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: PAD.top + innerH - t * innerH,
    label: (minVal + t * range).toFixed(0),
  }));

  const xTickCount = Math.min(6, labels.length);
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const idx = Math.round((i / (xTickCount - 1)) * (labels.length - 1));
    return {
      x: PAD.left + (idx / Math.max(data.length - 1, 1)) * innerW,
      label: labels[idx] ?? "",
    };
  });

  const last = valid[valid.length - 1];

  return (
    <div className="relative">
      {last !== undefined && (
        <div className="absolute right-0 top-0 text-xs font-semibold" style={{ color }}>
          {last.toFixed(1)}{unit}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
        {yTicks.map((t) => (
          <g key={t.y}>
            <line x1={PAD.left} y1={t.y} x2={PAD.left + innerW} y2={t.y} stroke="rgba(255,255,255,0.06)" />
            <text x={PAD.left - 6} y={t.y + 4} textAnchor="end" fontSize={9} fill="#64748b">{t.label}</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t.x} x={t.x} y={H - 6} textAnchor="middle" fontSize={9} fill="#64748b">{t.label}</text>
        ))}
        {area && (
          <path d={area} fill={color} fillOpacity={0.08} />
        )}
        {path && (
          <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
        )}
        {points.length === 0 && (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={11} fill="#475569">No data yet</text>
        )}
      </svg>
    </div>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function MonitoringClient({ servers }: { servers: Server[] }) {
  const defaultServer = servers.find((s) => s.isDefault) ?? servers[0];
  const [serverId, setServerId] = useState(defaultServer?.id ?? "");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (id = serverId) => {
    if (!id) return;
    setBusy(true);
    try {
      const data = await api<{ metrics: Metric[] }>(`/api/servers/${id}/metrics`);
      setMetrics(data.metrics);
      setLastUpdated(new Date());
    } catch {
      // silently ignore — server may be offline
    } finally {
      setBusy(false);
    }
  }, [serverId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 30000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId]);

  const labels = useMemo(() => metrics.map((m) => formatTime(m.createdAt)), [metrics]);
  const fps = useMemo(() => metrics.map((m) => m.fps), [metrics]);
  const players = useMemo(() => metrics.map((m) => m.players !== null ? Number(m.players) : null), [metrics]);
  const memory = useMemo(() => metrics.map((m) => m.memoryMb), [metrics]);

  const latest = metrics[metrics.length - 1];

  const stats = [
    {
      label: "Server FPS",
      value: latest?.fps != null ? `${latest.fps.toFixed(0)}` : "—",
      sub: "frames per second",
      icon: Activity,
      color: "text-orange-300",
    },
    {
      label: "Players",
      value: latest?.players != null ? String(latest.players) : "—",
      sub: "online now",
      icon: Users,
      color: "text-blue-300",
    },
    {
      label: "Memory",
      value: latest?.memoryMb != null ? `${latest.memoryMb.toFixed(0)} MB` : "—",
      sub: "server RAM usage",
      icon: HardDrive,
      color: "text-emerald-300",
    },
  ];

  const charts = [
    { label: "FPS", data: fps, color: "#f97316", unit: " fps", min: 0 },
    { label: "Players", data: players, color: "#60a5fa", unit: "", min: 0 },
    { label: "Memory (MB)", data: memory, color: "#34d399", unit: " MB", min: 0 },
  ];

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Monitoring</h1>
          <p className="mt-1 text-sm text-slate-400">Live server metrics — last 30 minutes, refreshes every 30 seconds.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-slate-500">Updated {formatTime(lastUpdated.toISOString())}</span>
          )}
          <Select value={serverId} onChange={(e) => { setServerId(e.target.value); setMetrics([]); }} className="min-w-56">
            {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <button
            onClick={() => load()}
            disabled={busy}
            className="rounded-md border border-white/10 p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw className={clsx("h-4 w-4", busy && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="grid gap-4">
        {charts.map((c) => (
          <Panel key={c.label}>
            <div className="mb-3 text-sm font-medium text-slate-300">{c.label}</div>
            <LineChart data={c.data} labels={labels} color={c.color} unit={c.unit} min={c.min} />
          </Panel>
        ))}
      </div>

      {metrics.length === 0 && !busy && (
        <p className="text-center text-sm text-slate-500">
          No metrics collected yet. The dashboard automatically records data when you visit it — open the Dashboard page to start collecting.
        </p>
      )}
    </div>
  );
}
