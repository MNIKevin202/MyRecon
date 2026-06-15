import { DiagnosticsClient } from "@/components/diagnostics-client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DiagnosticsPage() {
  const servers = await prisma.serverProfile.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      host: true,
      gamePort: true,
      rconPort: true,
      rconType: true,
      isDefault: true,
    },
  });

  return <DiagnosticsClient servers={servers} />;
}
