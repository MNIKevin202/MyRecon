import { BlackMarketClient } from "@/components/black-market-client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Black Market" };

export default async function BlackMarketPage() {
  const servers = await prisma.serverProfile.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, isDefault: true },
  });

  return <BlackMarketClient servers={servers} />;
}
