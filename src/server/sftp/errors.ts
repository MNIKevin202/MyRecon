import type { ServerProfile } from "@prisma/client";

export type SftpErrorDetails = {
  timestamp: string;
  serverName: string;
  host: string;
  port: number;
  username: string;
  requestedPath?: string;
  operation: string;
  message: string;
  stack?: string;
};

export function buildSftpErrorDetails(
  server: Pick<ServerProfile, "name" | "sftpHost" | "sftpPort" | "sftpUsername">,
  operation: string,
  requestedPath: string | undefined,
  error: unknown,
): SftpErrorDetails {
  return {
    timestamp: new Date().toISOString(),
    serverName: server.name,
    host: server.sftpHost ?? "",
    port: server.sftpPort,
    username: server.sftpUsername ?? "",
    requestedPath,
    operation,
    message: error instanceof Error ? error.message : "SFTP operation failed",
    stack: error instanceof Error ? error.stack : undefined,
  };
}

export function formatSftpError(details: SftpErrorDetails) {
  return [
    `Timestamp: ${details.timestamp}`,
    `Server: ${details.serverName}`,
    `SFTP host: ${details.host}`,
    `SFTP port: ${details.port}`,
    `Username: ${details.username}`,
    details.requestedPath ? `Requested path: ${details.requestedPath}` : null,
    `Operation: ${details.operation}`,
    `Error: ${details.message}`,
    details.stack ? `Stack:\n${details.stack}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
