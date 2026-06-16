import { EXCLUSIVE_PLUGINS } from "@/lib/exclusive-plugins";
import { ExclusivePluginsClient } from "@/components/exclusive-plugins-client";
import { prisma } from "@/lib/prisma";
import type { PluginManifest } from "@/app/api/exclusive-plugins/manifest/route";

export const dynamic = "force-dynamic";
export const metadata = { title: "Exclusive Plugins" };

const MANIFEST_URL =
  "https://raw.githubusercontent.com/MNIKevin202/MyRecon/main/plugins/manifest.json";

export default async function ExclusivePluginsPage() {
  const [servers, installedSettings, manifest] = await Promise.all([
    prisma.serverProfile.findMany({
      select: { id: true, name: true, isDefault: true, sftpEnabled: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    prisma.appSetting.findMany({
      where: { key: { startsWith: "plugin_installed:" } },
      select: { key: true, value: true },
    }),
    fetch(MANIFEST_URL, { next: { revalidate: 60 } })
      .then((r) => (r.ok ? (r.json() as Promise<PluginManifest>) : null))
      .catch(() => null),
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

  // Overlay manifest versions (GitHub is source of truth for latest version)
  const plugins = EXCLUSIVE_PLUGINS.map((p) => ({
    ...p,
    version: manifest?.[p.id]?.version ?? p.version,
  }));

  return (
    <ExclusivePluginsClient
      plugins={plugins}
      servers={servers}
      installedOn={installedOn}
    />
  );
}
