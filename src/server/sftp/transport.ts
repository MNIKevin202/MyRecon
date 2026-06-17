import { Readable, Writable } from "node:stream";
import SftpClient from "ssh2-sftp-client";
import * as ftp from "basic-ftp";
import type { ServerProfile } from "@prisma/client";
import { decryptSecret } from "@/lib/crypto";

// Unified remote filesystem interface so the rest of the app doesn't care
// whether the host speaks SFTP (SSH) or plain FTP. HostHavoc and some other
// budget hosts expose FTP only.

export type RemoteEntry = {
  name: string;
  type: "d" | "-";
  size: number;
  modifyTime: number;
};

export interface RemoteFs {
  list(path: string): Promise<RemoteEntry[]>;
  stat(path: string): Promise<{ size: number; isDirectory: boolean }>;
  exists(path: string): Promise<false | "d" | "-">;
  getBuffer(path: string): Promise<Buffer>;
  putBuffer(data: Buffer, path: string): Promise<void>;
  delete(path: string): Promise<void>;
  rmdir(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  end(): Promise<void>;
}

export function isFtp(server: Pick<ServerProfile, "sftpProtocol">) {
  return String(server.sftpProtocol ?? "SFTP").toUpperCase() === "FTP";
}

export async function connectRemoteFs(server: ServerProfile): Promise<RemoteFs> {
  if (!server.sftpEnabled) throw new Error("File access is not enabled for this server profile.");
  if (!server.sftpHost || !server.sftpUsername) throw new Error("File host and username are required.");

  return isFtp(server) ? connectFtp(server) : connectSftp(server);
}

// ── SFTP (ssh2-sftp-client) ───────────────────────────────────────────────────
async function connectSftp(server: ServerProfile): Promise<RemoteFs> {
  const client = new SftpClient();
  await client.connect({
    host: server.sftpHost!,
    port: server.sftpPort,
    username: server.sftpUsername!,
    password: server.sftpPasswordEncrypted ? decryptSecret(server.sftpPasswordEncrypted) : undefined,
    privateKey: server.sftpPrivateKeyEncrypted ? decryptSecret(server.sftpPrivateKeyEncrypted) : undefined,
    readyTimeout: 12000,
  });

  return {
    async list(path) {
      const entries = await client.list(path);
      return entries.map((e) => ({
        name: e.name,
        type: e.type === "d" ? "d" : "-",
        size: e.size,
        modifyTime: e.modifyTime,
      }));
    },
    async stat(path) {
      const s = await client.stat(path);
      return { size: s.size, isDirectory: s.isDirectory };
    },
    async exists(path) {
      const r = await client.exists(path);
      return r === "d" ? "d" : r ? "-" : false;
    },
    async getBuffer(path) {
      const data = await client.get(path);
      return Buffer.isBuffer(data)
        ? data
        : typeof data === "string"
          ? Buffer.from(data, "utf8")
          : await streamToBuffer(data as unknown as NodeJS.ReadableStream);
    },
    async putBuffer(data, path) {
      await client.put(data, path);
    },
    async delete(path) {
      await client.delete(path);
    },
    async rmdir(path) {
      await client.rmdir(path, true);
    },
    async rename(oldPath, newPath) {
      await client.rename(oldPath, newPath);
    },
    async mkdir(path) {
      await client.mkdir(path, true);
    },
    async end() {
      await client.end().catch(() => undefined);
    },
  };
}

// ── FTP (basic-ftp) ───────────────────────────────────────────────────────────
async function connectFtp(server: ServerProfile): Promise<RemoteFs> {
  const host = server.sftpHost!;
  const port = server.sftpPort;
  const user = server.sftpUsername!;
  const password = server.sftpPasswordEncrypted ? decryptSecret(server.sftpPasswordEncrypted) : "";

  // Most managed hosts (HostHavoc, etc.) require "explicit FTP over TLS" (FTPS).
  // Try explicit TLS first (accepting self-signed certs), then fall back to
  // plain FTP if the server doesn't support TLS.
  async function open(secure: boolean) {
    const c = new ftp.Client(20000);
    await c.access({
      host,
      port,
      user,
      password,
      secure,
      // Pin TLS 1.2: vsftpd-style FTPS servers (HostHavoc) require the data
      // connection to resume the control connection's TLS session. Under TLS
      // 1.3 the resumable session arrives via a late ticket and races the first
      // data transfer, resetting the socket. With TLS 1.2 the session is
      // available immediately after the handshake, so resumption is reliable.
      secureOptions: secure
        ? { rejectUnauthorized: false, minVersion: "TLSv1.2", maxVersion: "TLSv1.2" }
        : undefined,
    });
    return c;
  }

  let client: ftp.Client;
  try {
    client = await open(true);
    // Many FTPS servers (vsftpd with require_ssl_reuse) reset the data socket
    // unless it resumes the control connection's TLS session — the exact cause
    // of "read ECONNRESET (data socket)". FileZilla does this automatically;
    // basic-ftp does not. Keep the latest control-connection TLS session in the
    // data-connection TLS options. We track the socket's "session" event because
    // the session ticket can arrive after login and rotate between transfers, so
    // a one-time capture isn't enough for multi-list operations (folder scans).
    try {
      const ctrl = client.ftp.socket as unknown as {
        getSession?: () => Buffer | undefined;
        on?: (event: string, cb: (session: Buffer) => void) => void;
      };
      const applySession = (session?: Buffer) => {
        if (session) client.ftp.tlsOptions = { ...client.ftp.tlsOptions, session };
      };
      applySession(ctrl.getSession?.());
      ctrl.on?.("session", (session) => applySession(session));
    } catch {
      // best effort — fall through and let the transfer attempt proceed
    }
  } catch {
    client = await open(false);
  }

  // Retry a data-channel op once on ECONNRESET: the FTPS session ticket can
  // arrive just after login, so the first transfer occasionally races it.
  // Re-apply the current control session and try again.
  async function dataOp<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (!String((error as Error)?.message ?? "").includes("ECONNRESET")) throw error;
      const ctrl = client.ftp.socket as unknown as { getSession?: () => Buffer | undefined };
      const session = ctrl.getSession?.();
      if (session) client.ftp.tlsOptions = { ...client.ftp.tlsOptions, session };
      return await fn();
    }
  }

  return {
    async list(path) {
      const entries = await dataOp(() => client.list(path));
      return entries.map((e) => ({
        name: e.name,
        type: e.isDirectory ? "d" : "-",
        size: e.size,
        modifyTime: e.modifiedAt ? e.modifiedAt.getTime() : 0,
      }));
    },
    async stat(path) {
      // FTP has no stat; infer file vs directory. SIZE works on files only.
      try {
        const size = await client.size(path);
        return { size, isDirectory: false };
      } catch {
        return { size: 0, isDirectory: true };
      }
    },
    async exists(path) {
      // No native exists in FTP — list the parent and match the basename.
      const norm = path.replace(/\/+$/, "") || "/";
      const idx = norm.lastIndexOf("/");
      const parent = idx <= 0 ? "/" : norm.slice(0, idx);
      const base = norm.slice(idx + 1);
      try {
        const entries = await client.list(parent);
        const match = entries.find((e) => e.name === base);
        if (!match) return false;
        return match.isDirectory ? "d" : "-";
      } catch {
        return false;
      }
    },
    async getBuffer(path) {
      return dataOp(async () => {
        const chunks: Buffer[] = [];
        const sink = new Writable({
          write(chunk, _enc, cb) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            cb();
          },
        });
        await client.downloadTo(sink, path);
        return Buffer.concat(chunks);
      });
    },
    async putBuffer(data, path) {
      await dataOp(() => client.uploadFrom(Readable.from(data), path));
    },
    async delete(path) {
      await client.remove(path);
    },
    async rmdir(path) {
      await client.removeDir(path);
    },
    async rename(oldPath, newPath) {
      await client.rename(oldPath, newPath);
    },
    async mkdir(path) {
      await client.ensureDir(path);
      // ensureDir changes the working directory; reset to root for absolute ops.
      await client.cd("/").catch(() => undefined);
    },
    async end() {
      client.close();
    },
  };
}

async function streamToBuffer(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
