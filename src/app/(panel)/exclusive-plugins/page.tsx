import { EXCLUSIVE_PLUGINS } from "@/lib/exclusive-plugins";
import { ExclusivePluginsClient } from "@/components/exclusive-plugins-client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Exclusive Plugins" };

export default async function ExclusivePluginsPage() {
  const servers = await prisma.serverProfile.findMany({
    select: { id: true, name: true, isDefault: true, sftpEnabled: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return (
    <ExclusivePluginsClient
      plugins={EXCLUSIVE_PLUGINS.map(({ content: _c, ...meta }) => meta)}
      servers={servers}
    />
  );
}
