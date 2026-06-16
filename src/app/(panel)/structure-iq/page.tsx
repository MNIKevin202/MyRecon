import { StructureIQClient } from "@/components/structure-iq-client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "StructureIQ" };

export default async function StructureIQPage() {
  const servers = await prisma.serverProfile.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, isDefault: true },
  });

  return <StructureIQClient servers={servers} />;
}
