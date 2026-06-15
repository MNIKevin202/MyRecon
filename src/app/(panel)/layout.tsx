import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import type React from "react";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const [servers, user] = await Promise.all([
    prisma.serverProfile.count(),
    getSessionUser(),
  ]);

  if (servers === 0) redirect("/setup");
  if (!user) redirect("/login");

  return (
    <AppShell userName={user.name} role={user.role}>
      {children}
    </AppShell>
  );
}
