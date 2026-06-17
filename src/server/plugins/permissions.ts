import { ServerProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executeServerCommand } from "@/server/rcon/service";
import { withSftp, joinRemotePath } from "@/server/sftp/service";

export type PluginPermissionFramework = "AUTO" | "CARBON" | "OXIDE";

export type KnownPlayer = {
  steamId: string;
  name: string;
  connected: boolean;
  source: "playerlist" | "users";
};

function cleanPlayerName(value: string | undefined) {
  return (value ?? "").replace(/^"|"$/g, "").trim();
}

function mergePlayer(players: Map<string, KnownPlayer>, player: KnownPlayer) {
  const existing = players.get(player.steamId);
  if (!existing) {
    players.set(player.steamId, player);
    return;
  }

  players.set(player.steamId, {
    steamId: player.steamId,
    name: player.name || existing.name,
    connected: existing.connected || player.connected,
    source: existing.source === "playerlist" ? existing.source : player.source,
  });
}

function parsePlayerListJson(raw: string) {
  const players = new Map<string, KnownPlayer>();
  try {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed)) return players;

    for (const entry of parsed) {
      const steamId = String(entry.SteamID ?? entry.SteamId ?? entry.steamid ?? entry.userid ?? "").trim();
      if (!/^\d{15,20}$/.test(steamId)) continue;
      mergePlayer(players, {
        steamId,
        name: cleanPlayerName(String(entry.DisplayName ?? entry.Name ?? entry.name ?? "")),
        connected: true,
        source: "playerlist",
      });
    }
  } catch {
    return players;
  }
  return players;
}

function parseUsersOutput(raw: string) {
  const players = new Map<string, KnownPlayer>();
  for (const line of raw.split(/\r?\n/)) {
    const steamId = line.match(/\b(\d{15,20})\b/)?.[1];
    if (!steamId) continue;

    const withoutSteamId = line.replace(steamId, " ").replace(/\s+/g, " ").trim();
    const quotedName = line.match(/"([^"]+)"/)?.[1];
    const name = cleanPlayerName(quotedName || withoutSteamId.replace(/^(id|steamid|name|user)\s*[:=]?\s*/i, ""));
    mergePlayer(players, {
      steamId,
      name,
      connected: /connected|online|active/i.test(line),
      source: "users",
    });
  }
  return players;
}

export async function listKnownPlayers(server: ServerProfile) {
  const players = new Map<string, KnownPlayer>();
  const errors: string[] = [];

  try {
    const raw = await executeServerCommand(server, "playerlist");
    for (const player of parsePlayerListJson(raw).values()) {
      mergePlayer(players, player);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "playerlist failed");
  }

  try {
    const raw = await executeServerCommand(server, "users");
    for (const player of parseUsersOutput(raw).values()) {
      mergePlayer(players, player);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "users failed");
  }

  return {
    players: [...players.values()].sort((a, b) => {
      if (a.connected !== b.connected) return a.connected ? -1 : 1;
      return (a.name || a.steamId).localeCompare(b.name || b.steamId);
    }),
    errors,
  };
}

function normalizeFramework(framework?: string | null): PluginPermissionFramework {
  const normalized = String(framework ?? "AUTO").trim().toUpperCase();
  if (normalized === "CARBON") return "CARBON";
  if (normalized === "OXIDE" || normalized === "UMOD") return "OXIDE";
  return "AUTO";
}

function orderedFrameworks(framework?: string | null) {
  const normalized = normalizeFramework(framework);
  if (normalized === "CARBON") return ["CARBON"] as const;
  if (normalized === "OXIDE") return ["OXIDE"] as const;
  return ["CARBON", "OXIDE"] as const;
}

function permissionCommand(
  action: "grant" | "revoke" | "show",
  framework: "CARBON" | "OXIDE",
  steamId: string,
  permission: string,
) {
  const prefix = framework === "CARBON" ? "c" : "oxide";
  if (action === "grant") return `${prefix}.grant user ${steamId} ${permission}`;
  if (action === "revoke") return `${prefix}.revoke user ${steamId} ${permission}`;
  return `${prefix}.show perm ${permission}`;
}

function isCommandTimeout(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const detailsMessage =
    typeof error === "object" && error && "details" in error && typeof error.details === "object" && error.details && "message" in error.details
      ? String(error.details.message)
      : "";

  return `${message} ${detailsMessage}`.toLowerCase().includes("command timed out");
}

async function executePermissionCommand(
  server: ServerProfile,
  commands: Array<{ framework: "CARBON" | "OXIDE"; command: string }>,
  tolerateTimeout: boolean,
) {
  const errors: string[] = [];

  for (const candidate of commands) {
    try {
      const raw = await executeServerCommand(server, candidate.command);
      return {
        ok: true,
        framework: candidate.framework,
        command: candidate.command,
        raw,
        warning: null,
      };
    } catch (error) {
      if (tolerateTimeout && isCommandTimeout(error)) {
        return {
          ok: true,
          framework: candidate.framework,
          command: candidate.command,
          raw: "",
          warning: "The command was sent but did not return a response before the RCON timeout. Check the console or load access to verify.",
        };
      }

      errors.push(`${candidate.command}: ${error instanceof Error ? error.message : "failed"}`);
    }
  }

  throw new Error(errors.at(-1) ?? "Permission command failed");
}

export async function grantPluginPermission(
  server: ServerProfile,
  steamId: string,
  permission: string,
  framework?: string | null,
  playerName?: string | null,
  pluginName?: string | null,
) {
  const cleanSteamId = steamId.trim();
  const cleanPermission = permission.trim().toLowerCase();

  if (!/^\d{15,20}$/.test(cleanSteamId)) {
    throw new Error("Enter a valid SteamID before granting a permission.");
  }

  if (cleanPermission !== "*" && !/^[a-z0-9_.:-]+$/.test(cleanPermission)) {
    throw new Error("Permission names may only contain letters, numbers, dots, underscores, colons, and dashes.");
  }

  const result = await executePermissionCommand(
    server,
    orderedFrameworks(framework).map((item) => ({
      framework: item,
      command: permissionCommand("grant", item, cleanSteamId, cleanPermission),
    })),
    true,
  );

  await prisma.pluginPermissionAssignment.upsert({
    where: {
      serverId_permission_steamId: {
        serverId: server.id,
        permission: cleanPermission,
        steamId: cleanSteamId,
      },
    },
    update: {
      framework: result.framework,
      playerName: playerName?.trim() || null,
      pluginName: pluginName?.trim() || null,
      source: "MYRCON",
    },
    create: {
      serverId: server.id,
      permission: cleanPermission,
      framework: result.framework,
      steamId: cleanSteamId,
      playerName: playerName?.trim() || null,
      pluginName: pluginName?.trim() || null,
      source: "MYRCON",
    },
  });

  return result;
}

function cleanPermission(permission: string) {
  const clean = permission.trim().toLowerCase();
  if (clean !== "*" && !/^[a-z0-9_.:-]+$/.test(clean)) {
    throw new Error("Permission names may only contain letters, numbers, dots, underscores, colons, and dashes.");
  }
  return clean;
}

// Make players server admins via Rust's ownerid/moderatorid auth system, then
// persist with server.writecfg so it's written to cfg/users.cfg. This is the
// real server auth level — separate from plugin permissions.
function sanitizeAdminName(name?: string | null) {
  return (name ?? "").replace(/["\r\n]/g, "").trim() || "admin";
}

export async function grantServerAdminBulk(
  server: ServerProfile,
  targets: Array<{ steamId: string; playerName?: string | null }>,
  level: "owner" | "moderator" = "owner",
) {
  const command = level === "moderator" ? "moderatorid" : "ownerid";
  const granted: string[] = [];
  const failed: Array<{ steamId: string; error: string }> = [];

  for (const target of targets) {
    const id = target.steamId.trim();
    if (!/^\d{15,20}$/.test(id)) {
      failed.push({ steamId: target.steamId, error: "invalid SteamID" });
      continue;
    }
    try {
      await executeServerCommand(server, `${command} ${id} "${sanitizeAdminName(target.playerName)}"`);
      granted.push(id);
    } catch (error) {
      failed.push({ steamId: id, error: error instanceof Error ? error.message : "command failed" });
    }
  }

  // Persist to cfg/users.cfg so admin survives a restart
  let configSaved = false;
  if (granted.length > 0) {
    try {
      await executeServerCommand(server, "server.writecfg");
      configSaved = true;
    } catch {
      // command sent but no/late response — treat as best effort
    }
  }

  return { granted, failed, configSaved };
}

// Grant one permission (or "*" for full access) to many players at once.
export async function grantPluginPermissionsBulk(
  server: ServerProfile,
  targets: Array<{ steamId: string; playerName?: string | null }>,
  permission: string,
  framework?: string | null,
) {
  const granted: string[] = [];
  const failed: Array<{ steamId: string; error: string }> = [];
  for (const target of targets) {
    try {
      await grantPluginPermission(server, target.steamId, permission, framework, target.playerName, null);
      granted.push(target.steamId);
    } catch (error) {
      failed.push({ steamId: target.steamId, error: error instanceof Error ? error.message : "grant failed" });
    }
  }
  return { granted, failed };
}

function cleanSteamId(steamId: string) {
  const clean = steamId.trim();
  if (!/^\d{15,20}$/.test(clean)) {
    throw new Error("Enter a valid SteamID.");
  }
  return clean;
}

function parsePermissionUsers(raw: string) {
  const users = new Map<string, { steamId: string; name: string }>();
  for (const line of raw.split(/\r?\n/)) {
    const steamId = line.match(/\b(\d{15,20})\b/)?.[1];
    if (!steamId) continue;
    const quotedName = line.match(/"([^"]+)"/)?.[1];
    const name = cleanPlayerName(quotedName || line.replace(steamId, "").replace(/[-:()[\]]/g, " ").replace(/\s+/g, " ").trim());
    users.set(steamId, { steamId, name });
  }
  return [...users.values()].sort((a, b) => (a.name || a.steamId).localeCompare(b.name || b.steamId));
}

function mergePermissionUsers(users: Array<{ steamId: string; name: string }>) {
  const merged = new Map<string, { steamId: string; name: string }>();
  for (const user of users) {
    merged.set(user.steamId, {
      steamId: user.steamId,
      name: user.name || merged.get(user.steamId)?.name || user.steamId,
    });
  }
  return [...merged.values()].sort((a, b) => (a.name || a.steamId).localeCompare(b.name || b.steamId));
}

async function listSavedPermissionUsers(serverId: string, permission: string) {
  const rows = await prisma.pluginPermissionAssignment.findMany({
    where: { serverId, permission },
    orderBy: [{ playerName: "asc" }, { steamId: "asc" }],
  });

  return rows.map((row) => ({
    steamId: row.steamId,
    name: row.playerName || row.steamId,
  }));
}

export async function listPluginPermissionAccess(
  server: ServerProfile,
  permission: string,
  framework?: string | null,
  syncRcon = false,
) {
  const clean = cleanPermission(permission);
  const savedUsers = await listSavedPermissionUsers(server.id, clean);
  let result:
    | Awaited<ReturnType<typeof executePermissionCommand>>
    | null = null;
  let rconError: string | null = null;

  if (syncRcon) {
    try {
      result = await executePermissionCommand(
        server,
        orderedFrameworks(framework).map((item) => ({
          framework: item,
          command: permissionCommand("show", item, "", clean),
        })),
        false,
      );
    } catch (error) {
      rconError = error instanceof Error ? error.message : "Unable to load access from RCON";
    }
  }

  const rconUsers = result?.raw ? parsePermissionUsers(result.raw) : [];
  return {
    permission: clean,
    framework: result?.framework ?? normalizeFramework(framework),
    command: result?.command ?? permissionCommand("show", normalizeFramework(framework) === "OXIDE" ? "OXIDE" : "CARBON", "", clean),
    raw: result?.raw ?? "",
    rconError,
    source: syncRcon ? "saved+rcon" : "saved",
    users: mergePermissionUsers([...savedUsers, ...rconUsers]),
  };
}

// ── Export setup commands ─────────────────────────────────────────────────────
// Reads the server's permission data files over SFTP (groups + users) and
// generates the full list of grant/group/usergroup commands needed to
// reproduce the same admin/mod/permission setup on another server.

type OxideGroup = { Perms?: string[]; ParentGroup?: string };
type OxideUser = { Perms?: string[]; Groups?: string[]; LastSeenNickname?: string };

function dataDirCandidates(server: ServerProfile) {
  const root = (server.sftpRootPath ?? "").replace(/\/$/, "");
  if (!root) throw new Error("Server has no SFTP root path configured. Set it in Server Settings.");
  const framework = (server.modFramework ?? "oxide").toLowerCase();
  const carbon = `${root}/carbon/data`;
  const oxide = `${root}/oxide/data`;
  return framework === "carbon" ? [carbon, oxide] : [oxide, carbon];
}

async function readJsonFile<T>(server: ServerProfile, dir: string, name: string): Promise<T | null> {
  return withSftp(server, "perm-export", dir, async (client) => {
    const remotePath = joinRemotePath(dir, name);
    try {
      const data = await client.getBuffer(remotePath);
      return JSON.parse(data.toString("utf8")) as T;
    } catch {
      return null;
    }
  });
}

export async function exportPermissionSetupCommands(server: ServerProfile) {
  if (!server.sftpEnabled) {
    throw new Error("SFTP is not enabled for this server. Enable it in Server Settings.");
  }

  const framework = (server.modFramework ?? "oxide").toLowerCase();
  const prefix = framework === "carbon" ? "c" : "oxide";

  // Locate the data directory that actually holds the permission files
  let groups: Record<string, OxideGroup> | null = null;
  let users: Record<string, OxideUser> | null = null;

  for (const dir of dataDirCandidates(server)) {
    const g = await readJsonFile<Record<string, OxideGroup>>(server, dir, "oxide.groups.data.json");
    const u = await readJsonFile<Record<string, OxideUser>>(server, dir, "oxide.users.data.json");
    if (g || u) {
      groups = g;
      users = u;
      break;
    }
  }

  if (!groups && !users) {
    throw new Error(
      "Could not find oxide.groups.data.json / oxide.users.data.json under the server's data directory.",
    );
  }

  const builtin = new Set(["default", "admin"]);
  const commands: string[] = [];
  let groupCount = 0;
  let userCount = 0;

  // Groups: create (non-builtin), set parent, then grant each permission
  for (const [name, group] of Object.entries(groups ?? {})) {
    const perms = group.Perms ?? [];
    const parent = group.ParentGroup?.trim();
    const isBuiltin = builtin.has(name.toLowerCase());
    if (!isBuiltin) commands.push(`${prefix}.group add ${name}`);
    if (parent) commands.push(`${prefix}.group parent ${name} ${parent}`);
    for (const perm of perms) commands.push(`${prefix}.grant group ${name} ${perm}`);
    if (!isBuiltin || perms.length > 0) groupCount++;
  }

  // Users: grant direct permissions and group memberships (skip default group)
  for (const [steamId, user] of Object.entries(users ?? {})) {
    if (!/^\d{15,20}$/.test(steamId)) continue;
    const perms = user.Perms ?? [];
    const memberOf = (user.Groups ?? []).filter((g) => g.toLowerCase() !== "default");
    if (perms.length === 0 && memberOf.length === 0) continue;
    const nick = user.LastSeenNickname?.trim();
    if (nick) commands.push(`# ${nick} (${steamId})`);
    for (const perm of perms) commands.push(`${prefix}.grant user ${steamId} ${perm}`);
    for (const group of memberOf) commands.push(`${prefix}.usergroup add ${steamId} ${group}`);
    userCount++;
  }

  return { framework: framework === "carbon" ? "CARBON" : "OXIDE", commands, groupCount, userCount };
}

export async function revokePluginPermission(server: ServerProfile, steamId: string, permission: string, framework?: string | null) {
  const userId = cleanSteamId(steamId);
  const clean = cleanPermission(permission);
  const result = await executePermissionCommand(
    server,
    orderedFrameworks(framework).map((item) => ({
      framework: item,
      command: permissionCommand("revoke", item, userId, clean),
    })),
    true,
  );

  await prisma.pluginPermissionAssignment.deleteMany({
    where: {
      serverId: server.id,
      permission: clean,
      steamId: userId,
    },
  });

  return result;
}
