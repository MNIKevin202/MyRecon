import { CommandsClient } from "@/components/commands-client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CommandsPage() {
  const servers = await prisma.serverProfile.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, isDefault: true },
  });

  return <CommandsClient servers={servers} />;
}
