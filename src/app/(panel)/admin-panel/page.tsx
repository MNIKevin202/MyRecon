import { AdminPanelClient } from "@/components/admin-panel-client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPanelPage() {
  const [servers, user] = await Promise.all([
    prisma.serverProfile.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isDefault: true },
    }),
    getSessionUser(),
  ]);

  return <AdminPanelClient servers={servers} invokerName={user?.name ?? "Admin"} />;
}
