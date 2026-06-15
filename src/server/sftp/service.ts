import path from "node:path";
import SftpClient from "ssh2-sftp-client";
import type { ServerProfile } from "@prisma/client";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { buildSftpErrorDetails } from "@/server/sftp/errors";

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
  if (!server.sftpEnabled) throw new Error("SFTP is not enabled for this server profile.");
  if (!server.sftpHost || !server.sftpUsername) throw new Error("SFTP host and username are required.");

  const client = new SftpClient();
  await client.connect({
    host: server.sftpHost,
    port: server.sftpPort,
    username: server.sftpUsername,
    password: server.sftpPasswordEncrypted ? decryptSecret(server.sftpPasswordEncrypted) : undefined,
    privateKey: server.sftpPrivateKeyEncrypted ? decryptSecret(server.sftpPrivateKeyEncrypted) : undefined,
    readyTimeout: 12000,
  });
  return client;
}

export async function withSftp<T>(
  server: ServerProfile,
  operation: string,
  requestedPath: string | undefined,
  fn: (client: SftpClient) => Promise<T>,
) {
  const client = await getSftpClient(server);
  try {
    return await fn(client);
  } catch (error) {
    throw Object.assign(new Error(error instanceof Error ? error.message : "SFTP operation failed"), {
      details: buildSftpErrorDetails(server, operation, requestedPath, error),
    });
  } finally {
    await client.end().catch(() => undefined);
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
    const data = await client.get(remotePath);
    const buffer = Buffer.isBuffer(data)
      ? data
      : typeof data === "string"
        ? Buffer.from(data, "utf8")
        : await streamToBuffer(data as unknown as NodeJS.ReadableStream);
    return { path: remotePath, tooLarge: false, size: stat.size, content: buffer.toString("utf8") };
  });
}

export async function writeTextFile(server: ServerProfile, requestedPath: string, content: string) {
  const remotePath = resolveRemotePath(server, requestedPath);
  if (!isEditableTextFile(remotePath)) throw new Error("This file type is not editable in the browser.");
  return withSftp(server, "write", remotePath, async (client) => {
    await client.put(Buffer.from(content, "utf8"), remotePath);
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
    await client.put(bytes, remotePath);
    return { path: remotePath, ok: true };
  });
}

export async function deleteRemotePath(server: ServerProfile, requestedPath: string) {
  const remotePath = resolveRemotePath(server, requestedPath);
  return withSftp(server, "delete", remotePath, async (client) => {
    const stat = await client.stat(remotePath);
    if (stat.isDirectory) await client.rmdir(remotePath, true);
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
    await client.mkdir(remotePath, true);
    return { ok: true, path: remotePath };
  });
}

async function streamToBuffer(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
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
        message: `SFTP connection test succeeded for ${server.sftpHost}:${server.sftpPort}`,
      },
    });
    return { ok: true, path: root };
  });
}
