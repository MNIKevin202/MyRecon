"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, CheckCircle, Info, WifiOff, X } from "lucide-react";
import { clsx } from "@/lib/utils";

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

type Toast = AppNotification & { exiting?: boolean };

function toastIcon(type: string) {
  if (type === "server_offline") return <WifiOff className="h-4 w-4 text-red-400" />;
  if (type === "server_restart") return <CheckCircle className="h-4 w-4 text-emerald-400" />;
  if (type === "fps_low") return <AlertTriangle className="h-4 w-4 text-amber-400" />;
  if (type === "high_memory") return <AlertTriangle className="h-4 w-4 text-amber-400" />;
  return <Info className="h-4 w-4 text-blue-400" />;
}

export function NotificationCenter() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seenIds = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unread=1");
      if (!res.ok) return;
      const data = await res.json() as { notifications: AppNotification[]; unreadCount: number };
      setUnreadCount(data.unreadCount);

      const fresh = data.notifications.filter((n) => !n.read && !seenIds.current.has(n.id));
      if (fresh.length === 0) return;

      fresh.forEach((n) => seenIds.current.add(n.id));
      setToasts((prev) => [...prev, ...fresh].slice(-5));

      await fetch("/api/notifications/mark-all-read", { method: "POST" });
      setUnreadCount(0);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(poll, 2000);
    const interval = window.setInterval(poll, 15000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [poll]);

  function dismiss(id: string) {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, exiting: true } : t));
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 350);
  }

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = window.setTimeout(() => {
      const oldest = toasts.find((t) => !t.exiting);
      if (oldest) dismiss(oldest.id);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  return (
    <>
      {/* Bell icon — rendered into a portal slot; actual placement is in AppShell */}
      {unreadCount > 0 && (
        <span
          id="notification-badge"
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}

      {/* Toast stack */}
      <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2" style={{ maxWidth: 320 }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={clsx(
              "flex items-start gap-3 rounded-lg border border-white/10 bg-[#10141d] p-3 shadow-2xl shadow-black/40 transition-all duration-350",
              toast.exiting ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100",
            )}
          >
            <div className="mt-0.5 shrink-0">{toastIcon(toast.type)}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-100">{toast.title}</p>
              <p className="mt-0.5 text-xs text-slate-400">{toast.message}</p>
            </div>
            <button onClick={() => dismiss(toast.id)} className="shrink-0 text-slate-500 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

export function useBellBadge() {
  return null;
}

export function BellWithBadge({ unreadCount }: { unreadCount?: number }) {
  return (
    <span className="relative inline-flex">
      <Bell className="h-4 w-4" />
      {unreadCount && unreadCount > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </span>
  );
}
