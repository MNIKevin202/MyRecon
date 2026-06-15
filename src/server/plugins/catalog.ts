import { ServerProfile } from "@prisma/client";
import { joinRemotePath, listDirectory, resolveRemotePath, uploadBuffer, withSftp } from "@/server/sftp/service";

export type PluginCatalogItem = {
  id: string;
  source: "uMod";
  name: string;
  fileName: string;
  description: string;
  url: string;
  siteUrl: string;
};

export type PluginCatalogResult = {
  plugins: PluginCatalogItem[];
  page: number;
  perPage: number;
  hasMore: boolean;
  totalPages: number;
  total: number | null;
  source: "uMod live" | "built-in fallback";
  error?: string;
};

export const UMOD_POPULAR_PLUGINS: PluginCatalogItem[] = [
  {
    id: "umod-gather-manager",
    source: "uMod",
    name: "Gather Manager",
    fileName: "GatherManager.cs",
    description: "Adjusts gather rates for resources and dispensers.",
    url: "https://umod.org/plugins/GatherManager.cs",
    siteUrl: "https://umod.org/plugins/gather-manager",
  },
  {
    id: "umod-better-chat",
    source: "uMod",
    name: "Better Chat",
    fileName: "BetterChat.cs",
    description: "Chat formatting, titles, groups, and name colors.",
    url: "https://umod.org/plugins/BetterChat.cs",
    siteUrl: "https://umod.org/plugins/better-chat",
  },
  {
    id: "umod-kits",
    source: "uMod",
    name: "Kits",
    fileName: "Kits.cs",
    description: "Create and manage redeemable player kits.",
    url: "https://umod.org/plugins/Kits.cs",
    siteUrl: "https://umod.org/plugins/rust-kits",
  },
  {
    id: "umod-nteleportation",
    source: "uMod",
    name: "NTeleportation",
    fileName: "NTeleportation.cs",
    description: "Homes, towns, teleport requests, and teleport controls.",
    url: "https://umod.org/plugins/NTeleportation.cs",
    siteUrl: "https://umod.org/plugins/nteleportation",
  },
  {
    id: "umod-vanish",
    source: "uMod",
    name: "Vanish",
    fileName: "Vanish.cs",
    description: "Admin invisibility tools for moderation.",
    url: "https://umod.org/plugins/Vanish.cs",
    siteUrl: "https://umod.org/plugins/vanish",
  },
  {
    id: "umod-stack-size-controller",
    source: "uMod",
    name: "Stack Size Controller",
    fileName: "StackSizeController.cs",
    description: "Customize item stack sizes.",
    url: "https://umod.org/plugins/StackSizeController.cs",
    siteUrl: "https://umod.org/plugins/stack-size-controller",
  },
  {
    id: "umod-backpacks",
    source: "uMod",
    name: "Backpacks",
    fileName: "Backpacks.cs",
    description: "Adds player backpack storage.",
    url: "https://umod.org/plugins/Backpacks.cs",
    siteUrl: "https://umod.org/plugins/backpacks",
  },
  {
    id: "umod-zone-manager",
    source: "uMod",
    name: "Zone Manager",
    fileName: "ZoneManager.cs",
    description: "Create zones with custom behavior and flags.",
    url: "https://umod.org/plugins/ZoneManager.cs",
    siteUrl: "https://umod.org/plugins/zone-manager",
  },
  {
    id: "umod-economics",
    source: "uMod",
    name: "Economics",
    fileName: "Economics.cs",
    description: "Adds a simple server economy balance system.",
    url: "https://umod.org/plugins/Economics.cs",
    siteUrl: "https://umod.org/plugins/economics",
  },
  {
    id: "umod-server-rewards",
    source: "uMod",
    name: "Server Rewards",
    fileName: "ServerRewards.cs",
    description: "Reward points, shops, and player purchases.",
    url: "https://umod.org/plugins/ServerRewards.cs",
    siteUrl: "https://umod.org/plugins/server-rewards",
  },
  {
    id: "umod-image-library",
    source: "uMod",
    name: "Image Library",
    fileName: "ImageLibrary.cs",
    description: "Shared image caching library used by many UI plugins.",
    url: "https://umod.org/plugins/ImageLibrary.cs",
    siteUrl: "https://umod.org/plugins/image-library",
  },
  {
    id: "umod-copy-paste",
    source: "uMod",
    name: "Copy Paste",
    fileName: "CopyPaste.cs",
    description: "Copy, paste, save, and restore buildings or structures.",
    url: "https://umod.org/plugins/CopyPaste.cs",
    siteUrl: "https://umod.org/plugins/copy-paste",
  },
  {
    id: "umod-better-loot",
    source: "uMod",
    name: "Better Loot",
    fileName: "BetterLoot.cs",
    description: "Customize loot tables and container loot behavior.",
    url: "https://umod.org/plugins/BetterLoot.cs",
    siteUrl: "https://umod.org/plugins/better-loot",
  },
  {
    id: "umod-magic-loot",
    source: "uMod",
    name: "Magic Loot",
    fileName: "MagicLoot.cs",
    description: "Advanced loot multiplier and loot-table customization.",
    url: "https://umod.org/plugins/MagicLoot.cs",
    siteUrl: "https://umod.org/plugins/magic-loot",
  },
  {
    id: "umod-quick-smelt",
    source: "uMod",
    name: "Quick Smelt",
    fileName: "QuickSmelt.cs",
    description: "Adjusts furnace speed, fuel usage, and smelting output.",
    url: "https://umod.org/plugins/QuickSmelt.cs",
    siteUrl: "https://umod.org/plugins/quick-smelt",
  },
  {
    id: "umod-furnace-splitter",
    source: "uMod",
    name: "Furnace Splitter",
    fileName: "FurnaceSplitter.cs",
    description: "Automatically splits ore and fuel across furnace slots.",
    url: "https://umod.org/plugins/FurnaceSplitter.cs",
    siteUrl: "https://umod.org/plugins/furnace-splitter",
  },
  {
    id: "umod-auto-doors",
    source: "uMod",
    name: "Auto Doors",
    fileName: "AutoDoors.cs",
    description: "Automatically closes doors after configurable delays.",
    url: "https://umod.org/plugins/AutoDoors.cs",
    siteUrl: "https://umod.org/plugins/auto-doors",
  },
  {
    id: "umod-remover-tool",
    source: "uMod",
    name: "Remover Tool",
    fileName: "RemoverTool.cs",
    description: "Lets players or admins remove placed entities safely.",
    url: "https://umod.org/plugins/RemoverTool.cs",
    siteUrl: "https://umod.org/plugins/remover-tool",
  },
  {
    id: "umod-building-grades",
    source: "uMod",
    name: "Building Grades",
    fileName: "BuildingGrades.cs",
    description: "Upgrade or downgrade building blocks in bulk.",
    url: "https://umod.org/plugins/BuildingGrades.cs",
    siteUrl: "https://umod.org/plugins/building-grades",
  },
  {
    id: "umod-no-escape",
    source: "uMod",
    name: "No Escape",
    fileName: "NoEscape.cs",
    description: "Blocks teleport, trade, or commands during raid/combat timers.",
    url: "https://umod.org/plugins/NoEscape.cs",
    siteUrl: "https://umod.org/plugins/no-escape",
  },
  {
    id: "umod-death-notes",
    source: "uMod",
    name: "Death Notes",
    fileName: "DeathNotes.cs",
    description: "Broadcasts configurable death messages.",
    url: "https://umod.org/plugins/DeathNotes.cs",
    siteUrl: "https://umod.org/plugins/death-notes",
  },
  {
    id: "umod-welcomer",
    source: "uMod",
    name: "Welcomer",
    fileName: "Welcomer.cs",
    description: "Shows welcome messages and join information to players.",
    url: "https://umod.org/plugins/Welcomer.cs",
    siteUrl: "https://umod.org/plugins/welcomer",
  },
  {
    id: "umod-timed-execute",
    source: "uMod",
    name: "Timed Execute",
    fileName: "TimedExecute.cs",
    description: "Runs scheduled server commands from plugin configuration.",
    url: "https://umod.org/plugins/TimedExecute.cs",
    siteUrl: "https://umod.org/plugins/timed-execute",
  },
  {
    id: "umod-sign-artist",
    source: "uMod",
    name: "Sign Artist",
    fileName: "SignArtist.cs",
    description: "Lets players import images onto signs and frames.",
    url: "https://umod.org/plugins/SignArtist.cs",
    siteUrl: "https://umod.org/plugins/sign-artist",
  },
  {
    id: "umod-admin-radar",
    source: "uMod",
    name: "Admin Radar",
    fileName: "AdminRadar.cs",
    description: "Admin radar overlay for moderation and investigation.",
    url: "https://umod.org/plugins/AdminRadar.cs",
    siteUrl: "https://umod.org/plugins/admin-radar",
  },
  {
    id: "umod-discord-messages",
    source: "uMod",
    name: "Discord Messages",
    fileName: "DiscordMessages.cs",
    description: "Sends server events and messages to Discord webhooks.",
    url: "https://umod.org/plugins/DiscordMessages.cs",
    siteUrl: "https://umod.org/plugins/discord-messages",
  },
  {
    id: "umod-info-panel",
    source: "uMod",
    name: "Info Panel",
    fileName: "InfoPanel.cs",
    description: "Adds configurable in-game information panels.",
    url: "https://umod.org/plugins/InfoPanel.cs",
    siteUrl: "https://umod.org/plugins/info-panel",
  },
  {
    id: "umod-smooth-restart",
    source: "uMod",
    name: "Smooth Restart",
    fileName: "SmoothRestart.cs",
    description: "Restart warnings, countdowns, and controlled restart flow.",
    url: "https://umod.org/plugins/SmoothRestart.cs",
    siteUrl: "https://umod.org/plugins/smooth-restart",
  },
];

export function searchCatalog(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return UMOD_POPULAR_PLUGINS;
  return UMOD_POPULAR_PLUGINS.filter((plugin) =>
    [plugin.name, plugin.fileName, plugin.description, plugin.source]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

function pluginFileNameFromUrl(downloadUrl: string, slug: string) {
  try {
    const url = new URL(downloadUrl);
    const fileName = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    if (/^[a-zA-Z0-9_.-]+\.cs$/.test(fileName)) return fileName;
  } catch {
    // Fall through to slug conversion.
  }

  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("")
    .replace(/[^a-zA-Z0-9_.-]/g, "") + ".cs";
}

function mapUmodPlugin(entry: Record<string, unknown>): PluginCatalogItem | null {
  const slug = String(entry.slug ?? "").trim();
  const title = String(entry.title ?? "").trim();
  const downloadUrl = String(entry.download_url ?? "").trim();
  if (!slug || !title || !downloadUrl) return null;

  const description = String(entry.description ?? "").trim();
  return {
    id: `umod-${slug}`,
    source: "uMod",
    name: title,
    fileName: pluginFileNameFromUrl(downloadUrl, slug),
    description: description || "uMod Rust plugin.",
    url: downloadUrl,
    siteUrl: `https://umod.org/plugins/${slug}`,
  };
}

async function fetchUmodSearchPage(query: string, page: number) {
  const params = new URLSearchParams({
    query: query.trim(),
    page: String(page),
    sort: "downloads",
    sortdir: "desc",
    filter: "",
    author: "",
  });
  params.append("categories[]", "rust");

  const response = await fetch(`https://umod.org/plugins/search.json?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "MyRcon/0.1.9 (+https://example.invalid/myrcon)",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`uMod catalog returned HTTP ${response.status}`);
  }

  return await response.json() as {
    data?: Array<Record<string, unknown>>;
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
  };
}

export async function searchUmodCatalog(query: string, page = 1, perPage = 12): Promise<PluginCatalogResult> {
  const safePage = Math.max(1, Math.min(200, Math.floor(page) || 1));
  const safePerPage = [10, 20, 30, 50].includes(perPage) ? perPage : 20;
  const startIndex = (safePage - 1) * safePerPage;

  try {
    const firstPayload = await fetchUmodSearchPage(query, 1);
    const remotePerPage = Math.max(1, Number(firstPayload.per_page ?? 10) || 10);
    const total = Number.isFinite(Number(firstPayload.total)) ? Number(firstPayload.total) : null;
    const totalPages = total ? Math.max(1, Math.ceil(total / safePerPage)) : safePage;
    const remoteStartPage = Math.floor(startIndex / remotePerPage) + 1;
    const remoteEndPage = Math.floor((startIndex + safePerPage - 1) / remotePerPage) + 1;
    const remotePages = new Map<number, typeof firstPayload>([[1, firstPayload]]);

    for (let remotePage = remoteStartPage; remotePage <= remoteEndPage; remotePage++) {
      if (remotePages.has(remotePage)) continue;
      remotePages.set(remotePage, await fetchUmodSearchPage(query, remotePage));
    }

    const orderedEntries: Array<Record<string, unknown>> = [];
    for (let remotePage = remoteStartPage; remotePage <= remoteEndPage; remotePage++) {
      orderedEntries.push(...(remotePages.get(remotePage)?.data ?? []));
    }

    const sliceOffset = startIndex % remotePerPage;
    const plugins = orderedEntries
      .slice(sliceOffset, sliceOffset + safePerPage)
      .map(mapUmodPlugin)
      .filter((plugin): plugin is PluginCatalogItem => Boolean(plugin));

    return {
      plugins,
      page: safePage,
      perPage: safePerPage,
      hasMore: total ? safePage < totalPages : plugins.length === safePerPage,
      totalPages,
      total,
      source: "uMod live",
    };
  } catch (error) {
    const allFallback = searchCatalog(query);
    const totalPages = Math.max(1, Math.ceil(allFallback.length / safePerPage));
    const fallback = allFallback.slice(startIndex, startIndex + safePerPage);
    return {
      plugins: fallback,
      page: Math.min(safePage, totalPages),
      perPage: safePerPage,
      hasMore: safePage < totalPages,
      totalPages,
      total: allFallback.length,
      source: "built-in fallback",
      error: error instanceof Error ? error.message : "Unable to reach uMod catalog",
    };
  }
}

export function pluginFileNameFromInput(input: string) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Plugin URL, filename, or uMod class name is required.");

  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    if (url.hostname !== "umod.org") {
      throw new Error("Only direct uMod plugin URLs are supported in this installer.");
    }
    const fileName = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    if (!fileName.endsWith(".cs")) {
      throw new Error("Use a direct uMod .cs download URL, such as https://umod.org/plugins/GatherManager.cs.");
    }
    return fileName;
  }

  const cleaned = trimmed.replace(/[^a-zA-Z0-9_.-]/g, "");
  return cleaned.endsWith(".cs") ? cleaned : `${cleaned}.cs`;
}

export function uModDownloadUrlForFile(fileName: string) {
  if (!/^[a-zA-Z0-9_.-]+\.cs$/.test(fileName)) {
    throw new Error("Invalid plugin filename.");
  }
  return `https://umod.org/plugins/${fileName}`;
}

export async function downloadUmodPlugin(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/x-csharp,text/plain,*/*",
      "User-Agent": "MyRcon/0.1.9 (+https://example.invalid/myrcon)",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`uMod download failed with HTTP ${response.status}. Try again later or use a direct .cs file upload.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (!contentType.includes("csharp") && !text.includes("namespace Oxide.Plugins")) {
    throw new Error("uMod did not return a C# plugin source file.");
  }

  if (text.length > 3 * 1024 * 1024) {
    throw new Error("Plugin source is unexpectedly large.");
  }

  return Buffer.from(text, "utf8");
}

export async function listInstalledPlugins(server: ServerProfile, requestedDirectory?: string) {
  const targetDir = requestedDirectory?.trim() || server.sftpDefaultPluginPath || server.sftpRootPath;
  if (!targetDir) {
    throw new Error("Configure or enter a plugin directory before listing installed plugins.");
  }

  const listing = await listDirectory(server, targetDir);
  return {
    path: listing.path,
    plugins: listing.entries
      .filter((entry) => entry.type === "file" && entry.name.toLowerCase().endsWith(".cs"))
      .map((entry) => ({
        name: entry.name,
        path: entry.path,
        size: entry.size,
        modifyTime: entry.modifyTime,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export type PluginDirectoryCandidate = {
  path: string;
  label: string;
  confidence: "high" | "medium" | "low";
};

function pluginDirectoryCandidate(path: string): PluginDirectoryCandidate {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  if (normalized.includes("/carbon/plugins") || normalized.endsWith("carbon/plugins")) {
    return { path, label: "Carbon plugins", confidence: "high" };
  }
  if (normalized.includes("/oxide/plugins") || normalized.endsWith("oxide/plugins")) {
    return { path, label: "Oxide plugins", confidence: "high" };
  }
  if (normalized.endsWith("/plugins") || normalized === "plugins") {
    return { path, label: "Plugins folder", confidence: "medium" };
  }
  return { path, label: "Possible plugins folder", confidence: "low" };
}

export async function findPluginDirectories(server: ServerProfile, requestedRoot?: string) {
  const root = requestedRoot?.trim() || server.sftpRootPath || ".";
  const startPath = resolveRemotePath(server, root);
  const commonPaths = [
    joinRemotePath(startPath, "carbon/plugins"),
    joinRemotePath(startPath, "Carbon/plugins"),
    joinRemotePath(startPath, "oxide/plugins"),
    joinRemotePath(startPath, "Oxide/plugins"),
    joinRemotePath(startPath, "plugins"),
    joinRemotePath(startPath, "Plugins"),
  ];
  const found = new Map<string, PluginDirectoryCandidate>();

  await withSftp(server, "find-plugin-folders", startPath, async (client) => {
    for (const candidatePath of commonPaths) {
      const safePath = resolveRemotePath(server, candidatePath);
      const exists = await client.exists(safePath);
      if (exists === "d") {
        found.set(safePath.toLowerCase(), pluginDirectoryCandidate(safePath));
      }
    }

    const queue: Array<{ path: string; depth: number }> = [{ path: startPath, depth: 0 }];
    const visited = new Set<string>();
    const maxDepth = 5;
    const maxDirectories = 300;

    while (queue.length > 0 && visited.size < maxDirectories) {
      const current = queue.shift();
      if (!current) break;
      const key = current.path.toLowerCase();
      if (visited.has(key)) continue;
      visited.add(key);

      let entries;
      try {
        entries = await client.list(current.path);
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (entry.type !== "d") continue;
        const childPath = joinRemotePath(current.path, entry.name);
        const childKey = childPath.toLowerCase();
        if (entry.name.toLowerCase() === "plugins") {
          found.set(childKey, pluginDirectoryCandidate(childPath));
        }
        if (current.depth < maxDepth && !visited.has(childKey)) {
          queue.push({ path: childPath, depth: current.depth + 1 });
        }
      }
    }
  });

  return {
    root: startPath,
    directories: [...found.values()].sort((a, b) => {
      const score = { high: 0, medium: 1, low: 2 };
      return score[a.confidence] - score[b.confidence] || a.path.localeCompare(b.path);
    }),
  };
}

async function assertPluginNotInstalled(server: ServerProfile, targetPath: string) {
  const remotePath = resolveRemotePath(server, targetPath);
  await withSftp(server, "duplicate-check", remotePath, async (client) => {
    const exists = await client.exists(remotePath);
    if (exists) {
      throw new Error(`${remotePath} already exists. Duplicate plugin installs are blocked.`);
    }
  });
}

export async function installPluginFromUmod(server: ServerProfile, input: string, requestedDirectory?: string) {
  const fileName = pluginFileNameFromInput(input);
  const downloadUrl = /^https?:\/\//i.test(input.trim()) ? input.trim() : uModDownloadUrlForFile(fileName);
  const targetDir = requestedDirectory?.trim() || server.sftpDefaultPluginPath || server.sftpRootPath;
  if (!targetDir) {
    throw new Error("Enter a plugin directory or configure an SFTP default plugin path before installing plugins.");
  }

  const targetPath = joinRemotePath(targetDir, fileName);
  await assertPluginNotInstalled(server, targetPath);

  const bytes = await downloadUmodPlugin(downloadUrl);
  const result = await uploadBuffer(server, targetPath, bytes);
  return {
    ...result,
    fileName,
    source: "uMod",
    downloadUrl,
    message: "Plugin installed. Watch the console for compile/load results.",
  };
}
