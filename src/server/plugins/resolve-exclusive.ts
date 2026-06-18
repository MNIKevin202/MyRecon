import { getPlugin } from "@/lib/exclusive-plugins";

const MANIFEST_URL =
  "https://raw.githubusercontent.com/MNIKevin202/MyRecon/main/plugins/manifest.json";

export type ResolvedExclusivePlugin = {
  filename: string;
  contentUrl: string;
  version: string;
  defaultPath: string;
};

// Resolve an exclusive plugin's metadata from the local registry, falling back
// to the GitHub manifest. This lets newly published plugins install/uninstall/
// reload without requiring an app update first.
export async function resolveExclusivePlugin(pluginId: string): Promise<ResolvedExclusivePlugin | null> {
  const local = getPlugin(pluginId);
  if (local) {
    return {
      filename: local.filename,
      contentUrl: local.contentUrl,
      version: local.version,
      defaultPath: local.defaultPath,
    };
  }

  try {
    const res = await fetch(MANIFEST_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const manifest = (await res.json()) as Record<
      string,
      { filename?: string; contentUrl?: string; version?: string; defaultPath?: string }
    >;
    const m = manifest[pluginId];
    if (m?.filename && m.contentUrl) {
      return {
        filename: m.filename,
        contentUrl: m.contentUrl,
        version: m.version ?? "unknown",
        defaultPath: m.defaultPath ?? `oxide/plugins/${m.filename}`,
      };
    }
  } catch {
    // fall through
  }
  return null;
}
