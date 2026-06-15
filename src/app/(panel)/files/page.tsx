import { FilesClient } from "@/components/files-client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const servers = await prisma.serverProfile.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      isDefault: true,
      sftpEnabled: true,
      sftpRootPath: true,
      sftpDefaultPluginPath: true,
      sftpDefaultConfigPath: true,
    },
  });

  return <FilesClient servers={servers} />;
}
