import { ServerManager } from "@/components/server-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ServersPage() {
  const servers = await prisma.serverProfile.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      host: true,
      gamePort: true,
      rconPort: true,
      rconType: true,
      modFramework: true,
      sftpEnabled: true,
      sftpProtocol: true,
      sftpHost: true,
      sftpPort: true,
      sftpUsername: true,
      sftpRootPath: true,
      sftpDefaultPluginPath: true,
      sftpDefaultConfigPath: true,
      sftpAllowOutsideRoot: true,
      notes: true,
      isDefault: true,
    },
  });

  return <ServerManager initialServers={servers} />;
}
