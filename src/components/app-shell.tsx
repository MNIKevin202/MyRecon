"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import {
  Activity,
  Bell,
  CalendarClock,
  CircleHelp,
  FolderTree,
  Gauge,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  LogOut,
  MessageSquare,
  PlugZap,
  Recycle,
  ScanSearch,
  ScrollText,
  Server,
  Settings,
  Shield,
  TerminalSquare,
  Users,
} from "lucide-react";
import { clsx } from "@/lib/utils";
import { PluginUpdateBadge } from "@/components/plugin-update-badge";

type NavItem = { href: string; label: string; icon: typeof Gauge };
type NavSection = { label: string | null; items: NavItem[] };

const navSections: NavSection[] = [
  {
    label: null,
    items: [
      { href: "/dashboard",     label: "Dashboard",    icon: LayoutDashboard },
      { href: "/servers",       label: "Servers",      icon: Server },
      { href: "/files",         label: "Files",        icon: FolderTree },
      { href: "/console",       label: "Console",      icon: TerminalSquare },
      { href: "/chat",          label: "Chat",         icon: MessageSquare },
      { href: "/players",       label: "Players",      icon: Users },
      { href: "/plugins",       label: "Plugins",      icon: PlugZap },
      { href: "/permissions",   label: "Permissions",  icon: Shield },
      { href: "/commands",      label: "Commands",     icon: ScrollText },
      { href: "/scheduling",    label: "Scheduling",   icon: CalendarClock },
      { href: "/monitoring",    label: "Monitoring",   icon: Activity },
      { href: "/notifications", label: "Notifications",icon: Bell },
      { href: "/settings",      label: "Settings",     icon: Settings },
    ],
  },
  {
    label: "MyRcon",
    items: [
      { href: "/admin-panel",        label: "Admin Panel",       icon: LayoutGrid },
      { href: "/exclusive-plugins",  label: "Exclusive Plugins", icon: Lock },
      { href: "/reclaim",            label: "Reclaim",           icon: Recycle },
      { href: "/structure-iq",       label: "StructureIQ",       icon: ScanSearch },
    ],
  },
];

export function AppShell({
  children,
  userName,
  role,
}: {
  children: React.ReactNode;
  userName: string;
  role: string;
}) {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#090b10] text-slate-100 lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="min-w-0 border-b border-white/10 bg-[#0c1017] lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-4 px-4 py-4 lg:block">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image src="/logo.png" alt="MyRcon Admin Panel" width={44} height={44} className="rounded" priority />
          </Link>
          <button
            onClick={logout}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-slate-300 hover:bg-white/[0.06] lg:hidden"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex max-w-full gap-1 overflow-x-auto px-3 pb-4 lg:grid lg:overflow-visible">
          {navSections.map((section, si) => (
            <div key={si} className="contents lg:block">
              {section.label && (
                <p className="hidden lg:block mt-3 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                  {section.label}
                </p>
              )}
              {section.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex min-w-fit items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-400 transition hover:bg-white/[0.06] hover:text-white lg:min-w-0",
                      active && "bg-orange-500/15 text-orange-100",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    {item.href === "/exclusive-plugins" && <PluginUpdateBadge />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="mt-auto hidden border-t border-white/10 p-4 lg:block">
          <div className="text-sm font-medium text-white">{userName}</div>
          <div className="text-xs text-slate-500">{role.replace("_", " ")}</div>
          <button
            onClick={logout}
            className="mt-3 inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06]"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 max-w-full overflow-x-hidden">
        <main className="mx-auto w-full max-w-7xl min-w-0 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
