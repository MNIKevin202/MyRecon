import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { hasSelectedServer } from "@/lib/active-server";
import type React from "react";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const [servers, user] = await Promise.all([
    prisma.serverProfile.count(),
    getSessionUser(),
  ]);

  if (servers === 0) redirect("/setup");
  if (!user) redirect("/login");

  // On the first navigation after launch, ask the user which server to manage.
  // Skipped when only one server exists (nothing to choose). Once chosen, the
  // per-launch flag stays set so navigation isn't interrupted again.
  if (servers > 1 && !hasSelectedServer()) redirect("/select-server");

  return (
    <AppShell userName={user.name} role={user.role}>
      {children}
    </AppShell>
  );
}
