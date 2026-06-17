import path from "node:path";
import type { ServerProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildSftpErrorDetails } from "@/server/sftp/errors";
import { connectRemoteFs, type RemoteFs } from "@/server/sftp/transport";

const TEXT_EXTENSIONS = new Set([".json", ".cfg", ".txt", ".log", ".cs", ".toml", ".yaml", ".yml"]);
const MAX_EDIT_BYTES = 2 * 1024 * 1024;

export function normalizeRemotePath(input = "") {
  const normalized = input.replace(/\\/g, "/").replace(/\/+/g, "/");
  return normalized || ".";
}

function isWindowsPath(value: string) {
  return /^[a-zA-Z]:\//.test(value.replace(/\\/g, "/"));
}

export function joinRemotePath(base: string, child = "") {
  const cleanBase = normalizeRemotePath(base);
  const cleanChild = normalizeRemotePath(child);
  if (!child || cleanChild === ".") return cleanBase;

  if (isWindowsPath(cleanBase)) {
    return path.win32.normalize(path.win32.join(cleanBase, cleanChild)).replace(/\\/g, "/");
  }

  return path.posix.normalize(path.posix.join(cleanBase, cleanChild));
}

export function assertPathInsideRoot(requestedPath: string, rootPath: string, allowOutsideRoot: boolean) {
  const normalizedPath = normalizeRemotePath(requestedPath);
  const normalizedRoot = normalizeRemotePath(rootPath);

  if (allowOutsideRoot) return normalizedPath;
  if (!normalizedRoot || normalizedRoot === ".") {
    throw new Error("SFTP root path is required when root locking is enabled.");
  }

  const pathForCompare = normalizedPath.toLowerCase();
  const rootForCompare = normalizedRoot.replace(/\/$/, "").toLowerCase();
  if (pathForCompare === rootForCompare || pathForCompare.startsWith(`${rootForCompare}/`)) {
    return normalizedPath;
  }

  throw new Error("Requested path is outside the configured SFTP root.");
}

export function resolveRemotePath(server: ServerProfile, requestedPath?: string) {
  const root = server.sftpRootPath || ".";
  const candidate = requestedPath && requestedPath.trim()
    ? requestedPath
    : root;
  const absolute = isWindowsPath(candidate) || candidate.startsWith("/")
    ? normalizeRemotePath(candidate)
    : joinRemotePath(root, candidate);

  if (absolute.includes("../") || absolute.endsWith("/..")) {
    throw new Error("Path traversal is not allowed.");
  }

  return assertPathInsideRoot(absolute, root, server.sftpAllowOutsideRoot);
}

export function isEditableTextFile(filePath: string) {
  return TEXT_EXTENSIONS.has(path.posix.extname(filePath.toLowerCase()));
}

export async function getSftpClient(server: ServerProfile) {
  return connectRemoteFs(server);
}

export async function withSftp<T>(
  server: ServerProfile,
  operation: string,
  requestedPath: string | undefined,
  fn: (client: RemoteFs) => Promise<T>,
) {
  const client = await connectRemoteFs(server);
  try {
    return await fn(client);
  } catch (error) {
    throw Object.assign(new Error(error instanceof Error ? error.message : "File transfer operation failed"), {
      details: buildSftpErrorDetails(server, operation, requestedPath, error),
    });
  } finally {
    await client.end();
  }
}

export async function listDirectory(server: ServerProfile, requestedPath?: string) {
  const remotePath = resolveRemotePath(server, requestedPath);
  return withSftp(server, "list", remotePath, async (client) => {
    const entries = await client.list(remotePath);
    return {
      path: remotePath,
      entries: entries.map((entry) => ({
        name: entry.name,
        type: entry.type === "d" ? "directory" : "file",
        size: entry.size,
        modifyTime: entry.modifyTime,
        path: joinRemotePath(remotePath, entry.name),
      })),
    };
  });
}

export async function readTextFile(server: ServerProfile, requestedPath: string) {
  const remotePath = resolveRemotePath(server, requestedPath);
  if (!isEditableTextFile(remotePath)) throw new Error("This file type is not editable in the browser.");

  return withSftp(server, "read", remotePath, async (client) => {
    const stat = await client.stat(remotePath);
    if (stat.size > MAX_EDIT_BYTES) {
      return { path: remotePath, tooLarge: true, size: stat.size, content: "" };
    }
    const buffer = await client.getBuffer(remotePath);
    return { path: remotePath, tooLarge: false, size: stat.size, content: buffer.toString("utf8") };
  });
}

export async function writeTextFile(server: ServerProfile, requestedPath: string, content: string) {
  const remotePath = resolveRemotePath(server, requestedPath);
  if (!isEditableTextFile(remotePath)) throw new Error("This file type is not editable in the browser.");
  return withSftp(server, "write", remotePath, async (client) => {
    await client.putBuffer(Buffer.from(content, "utf8"), remotePath);
    return { path: remotePath, ok: true };
  });
}

export async function uploadFile(server: ServerProfile, requestedPath: string, file: File) {
  const remotePath = resolveRemotePath(server, requestedPath);
  const bytes = Buffer.from(await file.arrayBuffer());
  return uploadBuffer(server, remotePath, bytes);
}

export async function uploadBuffer(server: ServerProfile, requestedPath: string, bytes: Buffer) {
  const remotePath = resolveRemotePath(server, requestedPath);
  return withSftp(server, "upload", remotePath, async (client) => {
    await client.putBuffer(bytes, remotePath);
    return { path: remotePath, ok: true };
  });
}

export async function deleteRemotePath(server: ServerProfile, requestedPath: string) {
  const remotePath = resolveRemotePath(server, requestedPath);
  return withSftp(server, "delete", remotePath, async (client) => {
    const stat = await client.stat(remotePath);
    if (stat.isDirectory) await client.rmdir(remotePath);
    else await client.delete(remotePath);
    return { ok: true };
  });
}

export async function renameRemotePath(server: ServerProfile, oldPath: string, newPath: string) {
  const oldRemotePath = resolveRemotePath(server, oldPath);
  const newRemotePath = resolveRemotePath(server, newPath);
  return withSftp(server, "rename", oldRemotePath, async (client) => {
    await client.rename(oldRemotePath, newRemotePath);
    return { ok: true, path: newRemotePath };
  });
}

export async function makeDirectory(server: ServerProfile, requestedPath: string) {
  const remotePath = resolveRemotePath(server, requestedPath);
  return withSftp(server, "mkdir", remotePath, async (client) => {
    await client.mkdir(remotePath);
    return { ok: true, path: remotePath };
  });
}

// Resolve the server's plugin directory the same way the install flow does:
// explicit override → framework-based default under root → error.
export function resolvePluginDir(server: ServerProfile) {
  if (server.sftpDefaultPluginPath) {
    return server.sftpDefaultPluginPath.replace(/\/$/, "");
  }
  if (server.sftpRootPath) {
    const framework = (server.modFramework ?? "oxide") as "oxide" | "carbon";
    const frameworkPath = framework === "carbon" ? "carbon/plugins" : "oxide/plugins";
    return `${server.sftpRootPath.replace(/\/$/, "")}/${frameworkPath}`;
  }
  throw new Error("Server has no SFTP root path configured. Set it in Server Settings.");
}

// Download every .cs plugin file in the server's plugin directory over SFTP.
// Returns the raw file contents so they can be zipped or copied as-is.
export async function downloadPluginFiles(server: ServerProfile) {
  const dir = resolvePluginDir(server);
  return withSftp(server, "download-plugins", dir, async (client) => {
    const entries = await client.list(dir);
    const csFiles = entries.filter(
      (e) => e.type !== "d" && e.name.toLowerCase().endsWith(".cs"),
    );

    const files: { name: string; data: Buffer }[] = [];
    for (const entry of csFiles) {
      const remotePath = joinRemotePath(dir, entry.name);
      files.push({ name: entry.name, data: await client.getBuffer(remotePath) });
    }
    return files;
  });
}

export async function testSftpConnection(server: ServerProfile) {
  const root = resolveRemotePath(server);
  return withSftp(server, "test", root, async (client) => {
    await client.list(root);
    await prisma.serverEvent.create({
      data: {
        serverId: server.id,
        source: "sftp",
        level: "info",
        message: `${server.sftpProtocol ?? "SFTP"} connection test succeeded for ${server.sftpHost}:${server.sftpPort}`,
      },
    });
    return { ok: true, path: root };
  });
}
