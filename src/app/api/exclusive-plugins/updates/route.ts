import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const MANIFEST_URL =
  "https://raw.githubusercontent.com/MNIKevin202/MyRecon/main/plugins/manifest.json";

// GET /api/exclusive-plugins/updates
// Returns { count: N } — number of installed plugins that have a newer version available.
// Used by the nav badge in AppShell.
export async function GET(request: NextRequest) {
  const { response } = await requireUser(request);
  if (response) return response;

  const [installedSettings, manifest] = await Promise.all([
    prisma.appSetting.findMany({
      where: { key: { startsWith: "plugin_installed:" } },
      select: { key: true, value: true },
    }),
    fetch(MANIFEST_URL, { next: { revalidate: 60 } })
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, { version: string }>>) : null))
      .catch(() => null),
  ]);

  if (!manifest) return NextResponse.json({ count: 0 });

  // pluginId → highest installed version across all servers
  const installedVersions: Record<string, string> = {};
  for (const row of installedSettings) {
    const [, pluginId] = row.key.split(":");
    if (pluginId) {
      const version = row.value?.split("|")[0] ?? "0.0.0";
      installedVersions[pluginId] = version;
    }
  }

  let count = 0;
  for (const [id, entry] of Object.entries(manifest)) {
    if (installedVersions[id] && installedVersions[id] !== entry.version) count++;
  }

  return NextResponse.json({ count });
}
