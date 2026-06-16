import { ReclaimClient } from "@/components/reclaim-client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reclaim" };

export default async function ReclaimPage() {
  const servers = await prisma.serverProfile.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, isDefault: true },
  });

  return <ReclaimClient servers={servers} />;
}
