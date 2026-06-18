import { NextResponse } from "next/server";

const MANIFEST_URL =
  "https://raw.githubusercontent.com/MNIKevin202/MyRecon/main/plugins/manifest.json";

export type PluginManifestEntry = {
  version: string;
  contentUrl: string;
  name?: string;
  description?: string;
  longDescription?: string;
  tags?: string[];
  filename?: string;
  defaultPath?: string;
  permissions?: string[];
  previewItems?: string[];
};
export type PluginManifest = Record<string, PluginManifestEntry>;

export async function GET() {
  try {
    const res = await fetch(MANIFEST_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
    const data = (await res.json()) as PluginManifest;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch manifest" },
      { status: 502 },
    );
  }
}
