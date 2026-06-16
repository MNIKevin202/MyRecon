import { EXCLUSIVE_PLUGINS } from "@/lib/exclusive-plugins";
import { ExclusivePluginsClient } from "@/components/exclusive-plugins-client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Exclusive Plugins" };

export default async function ExclusivePluginsPage() {
  const [servers, installedSettings] = await Promise.all([
    prisma.serverProfile.findMany({
      select: { id: true, name: true, isDefault: true, sftpEnabled: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    prisma.appSetting.findMany({
      where: { key: { startsWith: "plugin_installed:" } },
      select: { key: true, value: true },
    }),
  ]);

  // Build map: pluginId → { serverId → installedVersion }
  const installedOn: Record<string, Record<string, string>> = {};
  for (const row of installedSettings) {
    const [, pluginId, serverId] = row.key.split(":");
    if (pluginId && serverId) {
      const version = row.value?.split("|")[0] ?? "unknown";
      (installedOn[pluginId] ??= {})[serverId] = version;
    }
  }

  return (
    <ExclusivePluginsClient
      plugins={EXCLUSIVE_PLUGINS.map(({ content: _c, ...meta }) => meta)}
      servers={servers}
      installedOn={installedOn as Record<string, Record<string, string>>}
    />
  );
}
