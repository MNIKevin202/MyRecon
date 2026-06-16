"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Bell, Bookmark, CheckCircle, Info, Trash2, WifiOff, X } from "lucide-react";
import { Button, Panel } from "@/components/ui";
import { api, clsx } from "@/lib/utils";

type AppNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  serverId: string | null;
  read: boolean;
  saved: boolean;
  createdAt: string;
};

type Rule = {
  type: string;
  label: string;
  enabled: boolean;
  threshold: number | null;
};

type Tab = "history" | "settings";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  server_offline: <WifiOff className="h-4 w-4 text-red-400" />,
  server_online: <CheckCircle className="h-4 w-4 text-emerald-400" />,
  fps_low: <AlertTriangle className="h-4 w-4 text-amber-400" />,
  high_memory: <AlertTriangle className="h-4 w-4 text-amber-400" />,
  player_join: <Info className="h-4 w-4 text-blue-400" />,
  player_leave: <Info className="h-4 w-4 text-blue-400" />,
};

function typeIcon(type: string) {
  return TYPE_ICONS[type] ?? <Bell className="h-4 w-4 text-slate-400" />;
}

const THRESHOLD_LABELS: Record<string, string> = {
  fps_low: "Alert when FPS below",
  high_memory: "Alert when memory above (MB)",
};

export function NotificationsClient() {
  const [tab, setTab] = useState<Tab>("history");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    const data = await api<{ notifications: AppNotification[] }>("/api/notifications");
    setNotifications(data.notifications);
  }, []);

  const loadRules = useCallback(async () => {
    const data = await api<{ rules: Rule[] }>("/api/notifications/rules");
    setRules(data.rules);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadNotifications();
      void loadRules();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadNotifications, loadRules]);

  async function toggleSaved(n: AppNotification) {
    await api(`/api/notifications/${n.id}`, {
      method: "PATCH",
      body: JSON.stringify({ saved: !n.saved }),
    });
    await loadNotifications();
  }

  async function deleteOne(id: string) {
    await api(`/api/notifications/${id}`, { method: "DELETE" });
    await loadNotifications();
  }

  async function clearAll() {
    if (!window.confirm("Clear all unsaved notifications?")) return;
    await api("/api/notifications", { method: "DELETE" });
    await loadNotifications();
    setNotice("Cleared.");
  }

  async function markAllRead() {
    await api("/api/notifications/mark-all-read", { method: "POST" });
    await loadNotifications();
  }

  function updateRule(type: string, key: "enabled" | "threshold", value: boolean | number | null) {
    setRules((prev) => prev.map((r) => r.type === type ? { ...r, [key]: value } : r));
  }

  async function saveRules() {
    setBusy(true);
    try {
      await api("/api/notifications/rules", {
        method: "POST",
        body: JSON.stringify(rules.map((r) => ({ type: r.type, enabled: r.enabled, threshold: r.threshold }))),
      });
      setNotice("Settings saved.");
    } catch {
      setNotice("Failed to save settings.");
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "history", label: "Notification History" },
    { id: "settings", label: "Settings" },
  ];

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Notifications</h1>
        <p className="mt-1 text-sm text-slate-400">Configure alerts and view notification history.</p>
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200">
          {notice}
          <button onClick={() => setNotice(null)} className="ml-3 text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="flex border-b border-white/10">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              "px-5 py-2.5 text-sm font-medium transition",
              tab === t.id ? "border-b-2 border-orange-400 text-orange-100" : "text-slate-400 hover:text-white",
            )}
          >
            {t.label}
            {t.id === "history" && unread > 0 && (
              <span className="ml-2 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "history" && (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">{notifications.length} notification{notifications.length !== 1 ? "s" : ""}</p>
            <div className="flex gap-2">
              {unread > 0 && (
                <Button variant="secondary" onClick={markAllRead}>Mark all read</Button>
              )}
              <Button variant="danger" onClick={clearAll}>
                <Trash2 className="h-4 w-4" />Clear unsaved
              </Button>
            </div>
          </div>

          {notifications.length === 0 && (
            <Panel>
              <div className="py-8 text-center text-sm text-slate-500">
                No notifications yet. They&apos;ll appear here as events occur.
              </div>
            </Panel>
          )}

          <div className="grid gap-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={clsx(
                  "flex items-start gap-3 rounded-md border p-3 transition",
                  n.read ? "border-white/[0.06] bg-black/10" : "border-white/10 bg-[#0c1017]",
                )}
              >
                <div className="mt-0.5 shrink-0">{typeIcon(n.type)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={clsx("text-sm font-medium", n.read ? "text-slate-400" : "text-slate-100")}>{n.title}</p>
                    {n.saved && <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-orange-200">Saved</span>}
                    {!n.read && <span className="h-2 w-2 rounded-full bg-orange-500" />}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{n.message}</p>
                  <p className="mt-1 text-[10px] text-slate-600">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => toggleSaved(n)}
                    className={clsx("rounded p-1.5 transition hover:bg-white/10", n.saved ? "text-orange-400" : "text-slate-500 hover:text-slate-300")}
                    title={n.saved ? "Unsave" : "Save"}
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteOne(n.id)}
                    className="rounded p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition"
                    title="Delete"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div className="grid gap-6">
          <Panel>
            <h2 className="mb-4 text-base font-semibold text-white">Notification Rules</h2>
            <div className="grid gap-4">
              {rules.map((rule) => (
                <div key={rule.type} className="flex flex-col gap-3 border-b border-white/[0.06] pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    {typeIcon(rule.type)}
                    <div>
                      <p className="text-sm font-medium text-slate-200">{rule.label}</p>
                      {THRESHOLD_LABELS[rule.type] && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xs text-slate-500">{THRESHOLD_LABELS[rule.type]}</span>
                          <input
                            type="number"
                            value={rule.threshold ?? ""}
                            onChange={(e) => updateRule(rule.type, "threshold", e.target.value ? Number(e.target.value) : null)}
                            className="w-20 rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-100 outline-none focus:border-orange-400"
                            disabled={!rule.enabled}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
                    <div
                      onClick={() => updateRule(rule.type, "enabled", !rule.enabled)}
                      className={clsx(
                        "relative h-5 w-9 rounded-full transition-colors",
                        rule.enabled ? "bg-orange-500" : "bg-white/10",
                      )}
                    >
                      <div className={clsx(
                        "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                        rule.enabled ? "translate-x-4" : "translate-x-0.5",
                      )} />
                    </div>
                    {rule.enabled ? "On" : "Off"}
                  </label>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <Button onClick={saveRules} disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
