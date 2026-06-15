import { PluginsClient } from "@/components/plugins-client";
import { prisma } from "@/lib/prisma";
import { searchCatalog } from "@/server/plugins/catalog";

export const dynamic = "force-dynamic";

export default async function PluginsPage() {
  const servers = await prisma.serverProfile.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      isDefault: true,
      sftpEnabled: true,
      sftpRootPath: true,
      sftpDefaultPluginPath: true,
    },
  });

  return <PluginsClient servers={servers} initialPlugins={searchCatalog("")} />;
}
