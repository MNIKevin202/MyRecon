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

  // Build plugin list: manifest is source of truth (lets us add plugins without app updates).
  // Fall back to local EXCLUSIVE_PLUGINS for any entry the manifest doesn't fully describe.
  const localById = Object.fromEntries(EXCLUSIVE_PLUGINS.map((p) => [p.id, p]));
  const plugins = manifest
    ? Object.entries(manifest).map(([id, m]) => {
        const local = localById[id];
        return {
          id,
          name: m.name ?? local?.name ?? id,
          version: m.version,
          description: m.description ?? local?.description ?? "",
          longDescription: m.longDescription ?? local?.longDescription ?? "",
          tags: m.tags ?? local?.tags ?? [],
          filename: m.filename ?? local?.filename ?? `${id}.cs`,
          defaultPath: m.defaultPath ?? local?.defaultPath ?? `oxide/plugins/${m.filename ?? id + ".cs"}`,
          permissions: m.permissions ?? local?.permissions ?? [],
          previewItems: m.previewItems ?? local?.previewItems ?? [],
          contentUrl: m.contentUrl,
        };
      })
    : EXCLUSIVE_PLUGINS;

  return (
    <ExclusivePluginsClient
      plugins={plugins}
      servers={servers}
      installedOn={installedOn}
    />
  );
}
