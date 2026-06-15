"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Brain,
  Download,
  ExternalLink,
  FolderOpen,
  KeyRound,
  PlugZap,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserMinus,
  Users,
} from "lucide-react";
import { Button, Field, Input, Panel, Select } from "@/components/ui";
import { clsx, api } from "@/lib/utils";

type Server = {
  id: string;
  name: string;
  isDefault: boolean;
  sftpEnabled: boolean;
  sftpDefaultPluginPath: string | null;
  sftpRootPath: string | null;
};

type PluginItem = {
  id: string;
  source: "uMod";
  name: string;
  fileName: string;
  description: string;
  url: string;
  siteUrl: string;
};

type InstallResult = {
  ok: boolean;
  path: string;
  fileName: string;
  source: string;
  message: string;
};

type CatalogResult = {
  plugins: PluginItem[];
  page: number;
  perPage: number;
  hasMore: boolean;
  totalPages: number;
  total: number | null;
  source: "uMod live" | "built-in fallback";
  error?: string;
};

type InstalledPlugin = {
  name: string;
  path: string;
  size: number;
  modifyTime: number;
};

type PluginDirectoryCandidate = {
  path: string;
  label: string;
  confidence: "high" | "medium" | "low";
};

type KnownPlayer = {
  steamId: string;
  name: string;
  connected: boolean;
  source: "playerlist" | "users";
};

type ManagedPlugin = {
  name: string;
  fileName: string;
  path?: string;
  size?: number;
  siteUrl?: string;
};

type PermissionAccess = {
  permission: string;
  framework?: "CARBON" | "OXIDE";
  command: string;
  raw: string;
  rconError?: string | null;
  source?: "saved" | "saved+rcon";
  users: Array<{ steamId: string; name: string }>;
};

type PluginAnalysis = {
  aiEnabled: boolean;
  model: string | null;
  path: string;
  size: number;
  summary: string;
  permissions: string[];
  configKeys: string[];
  commands: string[];
  suggestions: string[];
  risks: string[];
};

type PluginTab = "setup" | "download" | "installed" | "manage";
type CatalogFilter = "available" | "all" | "installed";
type PermissionFramework = "AUTO" | "CARBON" | "OXIDE";

const tabs: Array<{ id: PluginTab; label: string }> = [
  { id: "setup", label: "Setup" },
  { id: "download", label: "Download Plugins" },
  { id: "installed", label: "Installed Plugins" },
];

const perPageOptions = [10, 20, 30, 50];

function permissionSlug(pluginName: string) {
  return pluginName
    .replace(/\.cs$/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1.$2")
    .replace(/[^a-zA-Z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .toLowerCase();
}

function tabButtonClass(active: boolean) {
  return clsx(
    "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold transition",
    active ? "bg-orange-500 text-white shadow-lg shadow-orange-950/30" : "border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]",
  );
}

export function PluginsClient({ servers, initialPlugins }: { servers: Server[]; initialPlugins: PluginItem[] }) {
  const [serverProfiles, setServerProfiles] = useState(servers);
  const defaultServer = serverProfiles.find((server) => server.isDefault) ?? serverProfiles[0];
  const [activeTab, setActiveTab] = useState<PluginTab>("setup");
  const [serverId, setServerId] = useState(defaultServer?.id ?? "");
  const [pluginDirectory, setPluginDirectory] = useState(defaultServer?.sftpDefaultPluginPath || "");
  const [query, setQuery] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [plugins, setPlugins] = useState<PluginItem[]>(initialPlugins);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogPerPage, setCatalogPerPage] = useState(20);
  const [catalogHasMore, setCatalogHasMore] = useState(true);
  const [catalogTotalPages, setCatalogTotalPages] = useState(1);
  const [catalogTotal, setCatalogTotal] = useState<number | null>(null);
  const [catalogSource, setCatalogSource] = useState<"uMod live" | "built-in fallback">("built-in fallback");
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>("available");
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [installedPath, setInstalledPath] = useState("");
  const [directoryCandidates, setDirectoryCandidates] = useState<PluginDirectoryCandidate[]>([]);
  const [knownPlayers, setKnownPlayers] = useState<KnownPlayer[]>([]);
  const [playerErrors, setPlayerErrors] = useState<string[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedSteamId, setSelectedSteamId] = useState("");
  const [manualSteamId, setManualSteamId] = useState("");
  const [permissionInputs, setPermissionInputs] = useState<Record<string, string>>({});
  const [managedPlugin, setManagedPlugin] = useState<ManagedPlugin | null>(null);
  const [managedPermission, setManagedPermission] = useState("");
  const [permissionFramework, setPermissionFramework] = useState<PermissionFramework>("CARBON");
  const [permissionAccess, setPermissionAccess] = useState<PermissionAccess | null>(null);
  const [permissionRawOpen, setPermissionRawOpen] = useState(false);
  const [pluginAnalysis, setPluginAnalysis] = useState<PluginAnalysis | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const autoLoadedInstalled = useRef(new Set<string>());

  const selected = useMemo(() => serverProfiles.find((server) => server.id === serverId), [serverId, serverProfiles]);
  const fallbackPath = selected?.sftpDefaultPluginPath || selected?.sftpRootPath || "";
  const targetPath = pluginDirectory.trim() || fallbackPath;
  const installedNames = useMemo(
    () => new Set(installedPlugins.map((plugin) => plugin.name.toLowerCase())),
    [installedPlugins],
  );
  const visiblePlugins = useMemo(() => {
    if (catalogFilter === "all") return plugins;
    return plugins.filter((plugin) => {
      const installed = installedNames.has(plugin.fileName.toLowerCase());
      return catalogFilter === "installed" ? installed : !installed;
    });
  }, [catalogFilter, installedNames, plugins]);
  const filteredPlayers = useMemo(() => {
    const normalized = playerSearch.trim().toLowerCase();
    if (!normalized) return knownPlayers;
    return knownPlayers.filter((player) =>
      [player.name, player.steamId, player.source].join(" ").toLowerCase().includes(normalized),
    );
  }, [knownPlayers, playerSearch]);

  function selectServer(nextServerId: string) {
    const nextServer = serverProfiles.find((server) => server.id === nextServerId);
    setServerId(nextServerId);
    setPluginDirectory(nextServer?.sftpDefaultPluginPath || "");
    setInstalledPlugins([]);
    setInstalledPath("");
    setDirectoryCandidates([]);
    setKnownPlayers([]);
    setPlayerErrors([]);
    setPlayerSearch("");
    setSelectedSteamId("");
    setPermissionInputs({});
    setManagedPlugin(null);
    setManagedPermission("");
    setPermissionAccess(null);
    setPermissionRawOpen(false);
    setPluginAnalysis(null);
    setCatalogLoaded(false);
    setNotice(null);
  }

  async function loadCatalog(search = query, page = catalogPage, perPage = catalogPerPage) {
    setBusy("catalog");
    setNotice(null);
    try {
      const data = await api<CatalogResult>(
        `/api/plugins/catalog?q=${encodeURIComponent(search)}&page=${page}&perPage=${perPage}`,
      );
      setPlugins(data.plugins);
      setCatalogLoaded(true);
      setCatalogPage(data.page);
      setCatalogPerPage(data.perPage);
      setCatalogHasMore(data.hasMore);
      setCatalogTotalPages(data.totalPages);
      setCatalogTotal(data.total);
      setCatalogSource(data.source);
      setNotice(
        data.error
          ? `Using built-in fallback catalog because uMod could not be reached: ${data.error}`
          : `Loaded page ${data.page} from uMod.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load plugin catalog");
    } finally {
      setBusy(null);
    }
  }

  async function install(input: string, id: string) {
    if (!serverId) return;
    if (!selected?.sftpEnabled) {
      setNotice("Enable and test SFTP on the Servers page before installing plugins.");
      setActiveTab("setup");
      return;
    }

    setBusy(id);
    setNotice(`Installing ${input}...`);
    try {
      const result = await api<InstallResult>(`/api/servers/${serverId}/plugins/install`, {
        method: "POST",
        body: JSON.stringify({ source: "uMod", input, directory: targetPath }),
      });
      setNotice(`${result.fileName} installed to ${result.path}. Watch the console for compile/load results.`);
      await loadInstalled();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Plugin install failed");
    } finally {
      setBusy(null);
    }
  }

  async function savePluginDirectory(path = targetPath, quiet = false) {
    if (!serverId) return;
    const directory = path.trim();
    if (!directory) {
      setNotice("Enter a plugin directory before saving.");
      return;
    }

    setBusy("save-directory");
    if (!quiet) setNotice(null);
    try {
      const data = await api<{ server: Server }>(`/api/servers/${serverId}/plugins/directory`, {
        method: "PATCH",
        body: JSON.stringify({ directory }),
      });
      setServerProfiles((current) => current.map((server) => (server.id === data.server.id ? data.server : server)));
      setPluginDirectory(data.server.sftpDefaultPluginPath || directory);
      if (!quiet) setNotice(`Saved plugin directory: ${data.server.sftpDefaultPluginPath || directory}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save plugin directory");
    } finally {
      setBusy(null);
    }
  }

  async function loadInstalled() {
    if (!serverId) return;
    if (!targetPath) {
      setNotice("Enter a plugin directory first.");
      setActiveTab("setup");
      return;
    }

    setBusy("installed");
    setNotice(null);
    try {
      const data = await api<{ path: string; plugins: InstalledPlugin[] }>(
        `/api/servers/${serverId}/plugins/installed?directory=${encodeURIComponent(targetPath)}`,
      );
      setInstalledPath(data.path);
      setInstalledPlugins(data.plugins);
      setNotice(`Loaded ${data.plugins.length} installed plugin${data.plugins.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load installed plugins");
    } finally {
      setBusy(null);
    }
  }

  async function findDirectories() {
    if (!serverId) return;
    if (!selected?.sftpEnabled) {
      setNotice("Enable and test SFTP on the Servers page before searching folders.");
      return;
    }

    setBusy("directories");
    setNotice("Searching for plugin folders...");
    try {
      const data = await api<{ root: string; directories: PluginDirectoryCandidate[] }>(
        `/api/servers/${serverId}/plugins/directories?root=${encodeURIComponent(selected.sftpRootPath || "")}`,
      );
      setDirectoryCandidates(data.directories);
      setNotice(
        data.directories.length
          ? `Found ${data.directories.length} possible plugin folder${data.directories.length === 1 ? "" : "s"}.`
          : `No plugin folders found under ${data.root}.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to search plugin folders");
    } finally {
      setBusy(null);
    }
  }

  async function selectPluginDirectory(path: string) {
    setPluginDirectory(path);
    setInstalledPlugins([]);
    setInstalledPath("");
    await savePluginDirectory(path, true);
    await loadInstalledForPath(path);
  }

  async function loadInstalledForPath(path: string, quiet = false) {
    if (!serverId || !path) return;
    setBusy("installed");
    try {
      const data = await api<{ path: string; plugins: InstalledPlugin[] }>(
        `/api/servers/${serverId}/plugins/installed?directory=${encodeURIComponent(path)}`,
      );
      setInstalledPath(data.path);
      setInstalledPlugins(data.plugins);
      if (!quiet) setNotice(`Loaded ${data.plugins.length} installed plugin${data.plugins.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load installed plugins");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    const savedPath = selected?.sftpDefaultPluginPath?.trim();
    if (!serverId || !selected?.sftpEnabled || !savedPath) return;

    const key = `${serverId}:${savedPath}`;
    if (autoLoadedInstalled.current.has(key)) return;
    autoLoadedInstalled.current.add(key);
    setPluginDirectory(savedPath);
    void loadInstalledForPath(savedPath, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, selected?.sftpEnabled, selected?.sftpDefaultPluginPath]);

  useEffect(() => {
    if (activeTab !== "download" || catalogLoaded) return;
    const timer = window.setTimeout(() => {
      void loadCatalog(query, 1, catalogPerPage);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, catalogLoaded, query, catalogPerPage]);

  async function loadKnownPlayers() {
    if (!serverId) return;
    setBusy("players");
    setNotice(null);
    try {
      const data = await api<{ players: KnownPlayer[]; errors: string[] }>(`/api/servers/${serverId}/permissions/players`);
      setKnownPlayers(data.players);
      setPlayerErrors(data.errors);
      if (!selectedSteamId && data.players[0]) setSelectedSteamId(data.players[0].steamId);
      setNotice(`Loaded ${data.players.length} known player${data.players.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load known players");
    } finally {
      setBusy(null);
    }
  }

  function openManage(plugin: ManagedPlugin) {
    const permission = permissionInputs[plugin.fileName] || permissionInputs[plugin.name] || `${permissionSlug(plugin.fileName)}.use`;
    const pathHint = `${plugin.path ?? ""}/${plugin.fileName}`.toLowerCase();
    setManagedPlugin(plugin);
    setManagedPermission(permission);
    setPermissionFramework(pathHint.includes("/oxide/") || pathHint.includes("\\oxide\\") ? "OXIDE" : "CARBON");
    setPermissionAccess(null);
    setPermissionRawOpen(false);
    setPluginAnalysis(null);
    setActiveTab("manage");
    if (knownPlayers.length === 0) {
      void loadKnownPlayers();
    }
  }

  async function loadPermissionAccess(permission = managedPermission, quiet = false, syncRcon = false) {
    if (!serverId || !permission.trim()) return;
    setBusy("permission-access");
    if (!quiet) setNotice(null);
    try {
      const data = await api<PermissionAccess>(
        `/api/servers/${serverId}/permissions/access?permission=${encodeURIComponent(permission.trim())}&framework=${permissionFramework}${syncRcon ? "&sync=1" : ""}`,
      );
      setPermissionAccess(data);
      if (!quiet) {
        setNotice(
          syncRcon && data.rconError
            ? `Loaded saved access. Server sync reported: ${data.rconError}`
            : syncRcon
              ? `Synced access for ${data.permission}.`
              : `Loaded saved access for ${data.permission}.`,
        );
      }
    } catch (error) {
      setPermissionAccess(null);
      if (!quiet) {
        setNotice(
          error instanceof Error
            ? `Unable to load current access: ${error.message}. You can still grant by SteamID below.`
            : "Unable to load current access. You can still grant by SteamID below.",
        );
      }
    } finally {
      setBusy(null);
    }
  }

  async function grantPermission(pluginName: string) {
    if (!serverId) return;
    const permission = (pluginName === managedPlugin?.name ? managedPermission : permissionInputs[pluginName] || `${permissionSlug(pluginName)}.use`).trim();
    const steamId = (manualSteamId || selectedSteamId).trim();
    if (!steamId) {
      setNotice("Select a player or enter a SteamID before granting a permission.");
      return;
    }

    setBusy(`grant-${pluginName}`);
    setNotice(`Granting ${permission}...`);
    try {
      const player = knownPlayers.find((item) => item.steamId === steamId);
      const data = await api<{ raw: string; command: string; framework?: "CARBON" | "OXIDE"; warning?: string | null }>(`/api/servers/${serverId}/permissions/grant`, {
        method: "POST",
        body: JSON.stringify({
          steamId,
          permission,
          framework: permissionFramework,
          playerName: player?.name,
          pluginName: managedPlugin?.name ?? pluginName,
        }),
      });
      setNotice(
        data.warning
          ? `${data.framework ?? permissionFramework} command sent for ${permission} to ${player?.name || steamId}. ${data.warning}`
          : `Granted ${permission} to ${player?.name || steamId} using ${data.framework ?? permissionFramework}. ${data.raw ? "Server replied in console events." : ""}`,
      );
      if (pluginName === managedPlugin?.name) {
        setPermissionAccess((current) => {
          if (current?.users.some((user) => user.steamId === steamId)) {
            return current;
          }

          const base = current?.permission === permission
            ? current
            : {
                permission,
                framework: data.framework ?? (permissionFramework === "AUTO" ? undefined : permissionFramework),
                command: data.command,
                raw: data.raw,
                rconError: null,
                users: [],
              };

          return {
            ...base,
            users: [...base.users, { steamId, name: player?.name || steamId }].sort((a, b) =>
              (a.name || a.steamId).localeCompare(b.name || b.steamId),
            ),
          };
        });
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Permission grant failed");
    } finally {
      setBusy(null);
    }
  }

  async function revokePermission(steamId: string) {
    if (!serverId || !managedPlugin) return;
    const permission = managedPermission.trim();
    setBusy(`revoke-${steamId}`);
    setNotice(`Revoking ${permission}...`);
    try {
      await api<{ raw: string; warning?: string | null }>(`/api/servers/${serverId}/permissions/revoke`, {
        method: "POST",
        body: JSON.stringify({ steamId, permission, framework: permissionFramework }),
      });
      setNotice(`Revoked ${permission} from ${steamId}.`);
      setPermissionAccess((current) => current ? {
        ...current,
        users: current.users.filter((user) => user.steamId !== steamId),
      } : current);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Permission revoke failed");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (activeTab !== "manage" || !managedPlugin || !managedPermission.trim()) return;
    const timer = window.setTimeout(() => {
      void loadPermissionAccess(managedPermission, true, false);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, managedPlugin?.name, managedPermission, permissionFramework, serverId]);

  async function analyzeManagedPlugin() {
    if (!serverId || !managedPlugin?.path) {
      setNotice("Load installed plugins first so MyRcon knows the plugin file path.");
      return;
    }

    setBusy("plugin-analysis");
    setNotice("Reading plugin source and preparing suggestions...");
    try {
      const data = await api<{ analysis: PluginAnalysis }>(`/api/servers/${serverId}/plugins/analyze`, {
        method: "POST",
        body: JSON.stringify({ path: managedPlugin.path }),
      });
      setPluginAnalysis(data.analysis);
      setNotice(data.analysis.aiEnabled ? "OpenAI plugin analysis complete." : "Local plugin scan complete. Configure OpenAI for richer suggestions.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Plugin analysis failed");
    } finally {
      setBusy(null);
    }
  }

  function renderSetupTab() {
    return (
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Plugin Directory</h2>
              <p className="mt-1 text-sm text-slate-400">Save the folder where Carbon or Oxide watches for `.cs` plugins.</p>
            </div>
            <SlidersHorizontal className="h-5 w-5 text-orange-300" />
          </div>
          <div className="mt-5 grid gap-4">
            <Field label="Server">
              <Select value={serverId} onChange={(event) => selectServer(event.target.value)}>
                {serverProfiles.map((server) => <option key={server.id} value={server.id}>{server.name}</option>)}
              </Select>
            </Field>
            <Field label="Plugin directory" hint="Use Find to scan the SFTP root, or paste the Carbon/Oxide plugins folder directly.">
              <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
                <Input
                  value={pluginDirectory}
                  onChange={(event) => {
                    setPluginDirectory(event.target.value);
                    setInstalledPlugins([]);
                    setInstalledPath("");
                  }}
                  placeholder={fallbackPath || "C:/rustserver/carbon/plugins"}
                />
                <Button variant="secondary" onClick={findDirectories} disabled={busy === "directories" || !selected?.sftpEnabled}>
                  <Search className="h-4 w-4" />Find
                </Button>
                <Button variant="secondary" onClick={loadInstalled} disabled={busy === "installed" || !selected?.sftpEnabled}>
                  <FolderOpen className="h-4 w-4" />Load
                </Button>
                <Button onClick={() => savePluginDirectory()} disabled={busy === "save-directory" || !targetPath}>
                  <Save className="h-4 w-4" />Save
                </Button>
              </div>
            </Field>
            <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-400">
              Install target: <span className="break-all font-mono text-slate-200">{targetPath || "No directory selected"}</span>
            </div>
          </div>
        </Panel>

        <Panel>
          <h2 className="text-lg font-semibold text-white">Status</h2>
          <div className="mt-4 grid gap-3">
            <div className="rounded-md border border-white/10 bg-black/20 p-3">
              <div className="text-xs uppercase text-slate-500">SFTP</div>
              <div className={clsx("mt-1 text-sm font-semibold", selected?.sftpEnabled ? "text-emerald-300" : "text-yellow-200")}>
                {selected?.sftpEnabled ? "Enabled for this profile" : "Disabled in this profile"}
              </div>
            </div>
            <div className="rounded-md border border-white/10 bg-black/20 p-3">
              <div className="text-xs uppercase text-slate-500">Saved plugin path</div>
              <div className="mt-1 break-all font-mono text-sm text-slate-200">{selected?.sftpDefaultPluginPath || "Not saved yet"}</div>
            </div>
          </div>
        </Panel>

        {directoryCandidates.length > 0 ? (
          <Panel className="xl:col-span-2">
            <h2 className="text-lg font-semibold text-white">Found Plugin Folders</h2>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {directoryCandidates.map((candidate) => (
                <button
                  key={candidate.path}
                  onClick={() => selectPluginDirectory(candidate.path)}
                  className="min-w-0 rounded-md border border-white/10 bg-black/20 p-3 text-left hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{candidate.label}</div>
                      <div className="mt-1 break-all font-mono text-xs text-slate-400">{candidate.path}</div>
                    </div>
                    <span className="rounded-full bg-orange-500/10 px-2 py-1 text-xs uppercase text-orange-300">{candidate.confidence}</span>
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        ) : null}
      </div>
    );
  }

  function renderDownloadTab() {
    const canGoBack = catalogPage > 1 && busy !== "catalog";
    const canGoForward = catalogHasMore && busy !== "catalog";
    const paginationControls = (
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => loadCatalog(query, catalogPage - 1, catalogPerPage)} disabled={!canGoBack}>
          <ChevronLeft className="h-4 w-4" />Previous
        </Button>
        <Button variant="secondary" onClick={() => loadCatalog(query, catalogPage + 1, catalogPerPage)} disabled={!canGoForward}>
          Next<ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );

    return (
      <div className="grid gap-5">
        <Panel>
          <div className="grid gap-4 xl:grid-cols-[1fr_11rem_11rem_12rem_auto] xl:items-end">
            <Field label="Search uMod Rust plugins">
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="kits, chat, teleport, admin..." />
            </Field>
            <Field label="Per page">
              <Select
                value={catalogPerPage}
                onChange={(event) => {
                  const nextPerPage = Number(event.target.value);
                  setCatalogPerPage(nextPerPage);
                  void loadCatalog(query, 1, nextPerPage);
                }}
              >
                {perPageOptions.map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
            </Field>
            <Field label="Page">
              <Input
                type="number"
                min={1}
                max={catalogTotalPages}
                value={catalogPage}
                onChange={(event) => setCatalogPage(Number(event.target.value))}
                onBlur={() => loadCatalog(query, Math.max(1, Math.min(catalogTotalPages, catalogPage || 1)), catalogPerPage)}
              />
            </Field>
            <Field label="Show">
              <Select value={catalogFilter} onChange={(event) => setCatalogFilter(event.target.value as CatalogFilter)}>
                <option value="available">Available only</option>
                <option value="all">All results</option>
                <option value="installed">Installed only</option>
              </Select>
            </Field>
            <Button onClick={() => loadCatalog(query, 1, catalogPerPage)} disabled={busy === "catalog"}>
              <Search className="h-4 w-4" />Search
            </Button>
          </div>
          <div className="mt-4 border-t border-white/10 pt-4">
            <Field label="Install direct uMod plugin" hint="Paste a direct uMod .cs URL or enter a class filename like GatherManager.cs.">
              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <Input
                  value={customInput}
                  onChange={(event) => setCustomInput(event.target.value)}
                  placeholder="GatherManager.cs or https://umod.org/plugins/GatherManager.cs"
                />
                <Button onClick={() => install(customInput, "custom")} disabled={busy === "custom" || !customInput.trim() || !targetPath}>
                  <Download className="h-4 w-4" />Install
                </Button>
              </div>
            </Field>
          </div>
          <div className="mt-4 flex flex-col gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="font-semibold text-slate-200">{catalogSource}</span>
              {catalogTotal !== null ? <span> - {catalogTotal} Rust plugin{catalogTotal === 1 ? "" : "s"}</span> : null}
              <span> - Page {catalogPage} of {catalogTotalPages}</span>
              <span> - Showing {visiblePlugins.length} of {plugins.length} on this page</span>
            </div>
            {paginationControls}
          </div>
        </Panel>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visiblePlugins.length === 0 ? (
            <Panel className="md:col-span-2 xl:col-span-3">
              <p className="text-sm text-slate-400">
                No plugins match the current filter on this page. Change the Show filter or move to another page.
              </p>
            </Panel>
          ) : null}
          {visiblePlugins.map((plugin) => {
            const installed = installedNames.has(plugin.fileName.toLowerCase());
            return (
              <Panel key={plugin.id} className={installed ? "border-emerald-500/30" : undefined}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-orange-300">{plugin.source}</div>
                    <h2 className="mt-1 text-lg font-semibold text-white">{plugin.name}</h2>
                    <p className="mt-1 line-clamp-3 text-sm text-slate-400">{plugin.description}</p>
                    <p className="mt-3 break-all font-mono text-xs text-slate-500">{plugin.fileName}</p>
                    {installed ? <p className="mt-2 text-sm font-semibold text-emerald-300">Already installed</p> : null}
                  </div>
                  <a href={plugin.siteUrl} target="_blank" rel="noreferrer" className="rounded-md border border-white/10 p-2 text-slate-300 hover:bg-white/[0.06]" title="Open plugin page">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <div className="mt-4">
                  {installed ? (
                    <Button
                      variant="secondary"
                      onClick={() => openManage({
                        name: plugin.name,
                        fileName: plugin.fileName,
                        path: installedPlugins.find((item) => item.name.toLowerCase() === plugin.fileName.toLowerCase())?.path,
                        siteUrl: plugin.siteUrl,
                      })}
                    >
                      <SlidersHorizontal className="h-4 w-4" />Manage
                    </Button>
                  ) : (
                    <Button onClick={() => install(plugin.url, plugin.id)} disabled={busy === plugin.id || !selected?.sftpEnabled || !targetPath}>
                      <Download className="h-4 w-4" />Install
                    </Button>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <div>Page {catalogPage} of {catalogTotalPages}</div>
          {paginationControls}
        </div>
      </div>
    );
  }

  function renderInstalledTab() {
    return (
      <div className="grid gap-5">
        <Panel>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Installed Plugins</h2>
              <p className="mt-1 break-words text-sm text-slate-400">{installedPath || "Load a plugin directory to detect installed .cs plugins."}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={loadKnownPlayers} disabled={busy === "players"}>
                <Users className="h-4 w-4" />Load Players
              </Button>
              <Button variant="secondary" onClick={loadInstalled} disabled={busy === "installed" || !selected?.sftpEnabled}>
                <RefreshCw className="h-4 w-4" />Refresh Installed
              </Button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
            <Field label="Known players">
              <Input value={playerSearch} onChange={(event) => setPlayerSearch(event.target.value)} placeholder="Search name or SteamID" />
            </Field>
            <Field label="Selected player">
              <Select value={selectedSteamId} onChange={(event) => setSelectedSteamId(event.target.value)}>
                <option value="">Select a player</option>
                {filteredPlayers.map((player) => (
                  <option key={player.steamId} value={player.steamId}>
                    {player.name || "Unnamed"} - {player.steamId}{player.connected ? " - online" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {playerErrors.length ? (
            <div className="mt-3 rounded-md border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100">
              Some player sources failed: {playerErrors.join(" | ")}
            </div>
          ) : null}
        </Panel>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {installedPlugins.length === 0 ? (
            <Panel>
              <p className="text-sm text-slate-500">No installed plugins loaded.</p>
            </Panel>
          ) : null}
          {installedPlugins.map((plugin) => (
            <Panel key={plugin.path} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="break-all font-mono text-sm text-slate-100">{plugin.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{Math.round(plugin.size / 1024)} KB</div>
                </div>
                <PlugZap className="h-5 w-5 text-orange-300" />
              </div>
              <Button
                className="mt-4 w-full"
                variant="secondary"
                onClick={() => openManage({
                  name: plugin.name.replace(/\.cs$/i, ""),
                  fileName: plugin.name,
                  path: plugin.path,
                  size: plugin.size,
                })}
              >
                <SlidersHorizontal className="h-4 w-4" />Manage
              </Button>
            </Panel>
          ))}
        </div>
      </div>
    );
  }

  function renderManageTab() {
    if (!managedPlugin) {
      return (
        <Panel>
          <h2 className="text-lg font-semibold text-white">No Plugin Selected</h2>
          <p className="mt-1 text-sm text-slate-400">Choose Manage from Download Plugins or Installed Plugins.</p>
        </Panel>
      );
    }

    const assignedSteamIds = new Set(permissionAccess?.users.map((user) => user.steamId) ?? []);
    const playersWithoutAccess = filteredPlayers.filter((player) => !assignedSteamIds.has(player.steamId));

    return (
      <div className="grid gap-5">
        <Panel>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-orange-300">
                <KeyRound className="h-4 w-4" /> Plugin Access
              </div>
              <h2 className="mt-2 break-words text-2xl font-bold text-white">{managedPlugin.name}</h2>
              <p className="mt-1 break-all font-mono text-sm text-slate-400">{managedPlugin.path || managedPlugin.fileName}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={analyzeManagedPlugin} disabled={busy === "plugin-analysis" || !managedPlugin.path}>
                <Brain className="h-4 w-4" />Analyze .cs
              </Button>
              {managedPlugin.siteUrl ? (
                <a href={managedPlugin.siteUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-100 hover:bg-white/[0.08]">
                  <ExternalLink className="h-4 w-4" />uMod
                </a>
              ) : null}
              <Button variant="secondary" onClick={() => setActiveTab("installed")}>Back</Button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[12rem_1fr_auto] xl:items-end">
            <Field label="Permission system">
              <Select
                value={permissionFramework}
                onChange={(event) => {
                  setPermissionFramework(event.target.value as PermissionFramework);
                  setPermissionAccess(null);
                }}
              >
                <option value="CARBON">Carbon</option>
                <option value="OXIDE">Oxide/uMod</option>
                <option value="AUTO">Auto</option>
              </Select>
            </Field>
            <Field label="Permission">
              <Input
                value={managedPermission}
                onChange={(event) => {
                  setManagedPermission(event.target.value);
                  setPermissionAccess(null);
                }}
                placeholder={`${permissionSlug(managedPlugin.fileName)}.use`}
                className="font-mono"
              />
            </Field>
            <Button variant="secondary" onClick={loadKnownPlayers} disabled={busy === "players"}>
              <Users className="h-4 w-4" />Load Players
            </Button>
          </div>
        </Panel>

        {pluginAnalysis ? (
          <Panel>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-orange-300">
                  <Brain className="h-4 w-4" /> {pluginAnalysis.aiEnabled ? `OpenAI Analysis${pluginAnalysis.model ? ` - ${pluginAnalysis.model}` : ""}` : "Local Code Scan"}
                </div>
                <h3 className="mt-2 text-lg font-semibold text-white">Suggestions</h3>
                <p className="mt-1 text-sm text-slate-300">{pluginAnalysis.summary}</p>
              </div>
              <div className="text-xs text-slate-500">{Math.round(pluginAnalysis.size / 1024)} KB</div>
            </div>
            {!pluginAnalysis.aiEnabled ? (
              <div className="mt-4 rounded-md border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100">
                OpenAI is not configured. Set `OPENAI_API_KEY` to get richer plugin-specific recommendations.
              </div>
            ) : null}
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <div className="rounded-md border border-white/10 bg-black/20 p-4">
                <h4 className="font-semibold text-white">Recommended Changes</h4>
                <ul className="mt-3 grid gap-2 text-sm text-slate-300">
                  {pluginAnalysis.suggestions.length ? pluginAnalysis.suggestions.map((item) => <li key={item}>- {item}</li>) : <li>No suggestions returned.</li>}
                </ul>
              </div>
              <div className="rounded-md border border-white/10 bg-black/20 p-4">
                <h4 className="font-semibold text-white">Risks To Review</h4>
                <ul className="mt-3 grid gap-2 text-sm text-slate-300">
                  {pluginAnalysis.risks.length ? pluginAnalysis.risks.map((item) => <li key={item}>- {item}</li>) : <li>No obvious risks detected.</li>}
                </ul>
              </div>
              <div className="rounded-md border border-white/10 bg-black/20 p-4">
                <h4 className="font-semibold text-white">Permissions</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  {pluginAnalysis.permissions.length ? pluginAnalysis.permissions.map((item) => (
                    <button key={item} onClick={() => setManagedPermission(item)} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-xs text-slate-200 hover:bg-white/[0.08]">
                      {item}
                    </button>
                  )) : <span className="text-sm text-slate-500">None detected.</span>}
                </div>
              </div>
              <div className="rounded-md border border-white/10 bg-black/20 p-4">
                <h4 className="font-semibold text-white">Commands</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  {pluginAnalysis.commands.length ? pluginAnalysis.commands.map((item) => <span key={item} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-xs text-slate-200">{item}</span>) : <span className="text-sm text-slate-500">None detected.</span>}
                </div>
              </div>
              <div className="rounded-md border border-white/10 bg-black/20 p-4 xl:col-span-2">
                <h4 className="font-semibold text-white">Config Hints</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  {pluginAnalysis.configKeys.length ? pluginAnalysis.configKeys.map((item) => <span key={item} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-xs text-slate-200">{item}</span>) : <span className="text-sm text-slate-500">No simple config keys detected.</span>}
                </div>
              </div>
            </div>
          </Panel>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <Panel>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Has Access</h3>
                <p className="mt-1 text-sm text-slate-400">
                  {permissionAccess
                    ? `${permissionAccess.users.length} saved assignment${permissionAccess.users.length === 1 ? "" : "s"}.`
                    : busy === "permission-access" ? "Loading saved access..." : "No saved assignments yet."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => loadPermissionAccess(managedPermission, false, true)} disabled={busy === "permission-access" || !managedPermission.trim()}>
                  <RefreshCw className="h-4 w-4" />Sync
                </Button>
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {permissionAccess?.source === "saved+rcon" && permissionAccess.rconError ? (
                <div className="rounded-md border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100">
                  Server sync did not return cleanly, so MyRcon is showing saved grants. Console/RCON detail: {permissionAccess.rconError}
                </div>
              ) : null}
              {!permissionAccess && busy !== "permission-access" ? <p className="text-sm text-slate-500">No saved access yet.</p> : null}
              {permissionAccess?.users.length === 0 ? <p className="text-sm text-slate-500">No users were reported for this permission.</p> : null}
              {permissionAccess?.users.map((user) => (
                <div key={user.steamId} className="flex min-w-0 flex-col gap-2 rounded-md border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{user.name || "Unnamed"}</div>
                    <div className="font-mono text-xs text-slate-500">{user.steamId}</div>
                  </div>
                  <Button variant="danger" onClick={() => revokePermission(user.steamId)} disabled={busy === `revoke-${user.steamId}`}>
                    <UserMinus className="h-4 w-4" />Revoke
                  </Button>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Grant Access</h3>
                <p className="mt-1 text-sm text-slate-400">Search known players and grant the selected permission.</p>
              </div>
              <Users className="h-5 w-5 text-orange-300" />
            </div>
            <div className="mt-4 grid gap-3">
              <Field label="Search players">
                <Input value={playerSearch} onChange={(event) => setPlayerSearch(event.target.value)} placeholder="Name or SteamID" />
              </Field>
              <Field label="SteamID">
                <Input
                  value={manualSteamId}
                  onChange={(event) => setManualSteamId(event.target.value.replace(/\D/g, "").slice(0, 20))}
                  placeholder="Paste a SteamID to grant directly"
                  className="font-mono"
                />
              </Field>
              <Field label="Player">
                <Select value={selectedSteamId} onChange={(event) => setSelectedSteamId(event.target.value)}>
                  <option value="">Select a loaded player</option>
                  {playersWithoutAccess.map((player) => (
                    <option key={player.steamId} value={player.steamId}>
                      {player.name || "Unnamed"} - {player.steamId}{player.connected ? " - online" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button onClick={() => grantPermission(managedPlugin.name)} disabled={busy === `grant-${managedPlugin.name}` || !(manualSteamId.trim() || selectedSteamId) || !managedPermission.trim()}>
                <ShieldCheck className="h-4 w-4" />Grant Permission
              </Button>
              {playerErrors.length ? (
                <div className="rounded-md border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100">
                  Some player sources failed: {playerErrors.join(" | ")}
                </div>
              ) : null}
            </div>
          </Panel>
        </div>

        {permissionAccess?.raw ? (
          <Panel>
            <button className="text-sm font-semibold text-slate-200" onClick={() => setPermissionRawOpen((open) => !open)}>
              {permissionRawOpen ? "Hide" : "Show"} Raw RCON Response
            </button>
            {permissionRawOpen ? (
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-black/30 p-3 font-mono text-xs text-slate-300">{permissionAccess.raw}</pre>
            ) : null}
          </Panel>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Plugins</h1>
          <p className="mt-1 text-sm text-slate-400">Configure plugin paths, browse uMod, install over SFTP, and grant player permissions.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={serverId} onChange={(event) => selectServer(event.target.value)} className="min-w-56">
            {serverProfiles.map((server) => <option key={server.id} value={server.id}>{server.name}</option>)}
          </Select>
          <Button variant="secondary" onClick={() => loadCatalog(query, catalogPage, catalogPerPage)} disabled={busy === "catalog"}>
            <RefreshCw className="h-4 w-4" />Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border border-white/10 bg-white/[0.025] p-2">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={tabButtonClass(activeTab === tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {notice ? <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200">{notice}</div> : null}

      {!selected?.sftpEnabled ? (
        <div className="rounded-md border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100">
          SFTP is disabled in this MyRcon profile. Enable and test SFTP on the Servers page before direct plugin install.
        </div>
      ) : null}

      {activeTab === "setup" ? renderSetupTab() : null}
      {activeTab === "download" ? renderDownloadTab() : null}
      {activeTab === "installed" ? renderInstalledTab() : null}
      {activeTab === "manage" ? renderManageTab() : null}
    </div>
  );
}
