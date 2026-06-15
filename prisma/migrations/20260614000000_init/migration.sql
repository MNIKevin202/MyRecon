CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'OWNER',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Session_tokenHash_key" ON "Session"("tokenHash");

CREATE TABLE IF NOT EXISTS "LoginAttempt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "ip" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "LoginAttempt_email_ip_createdAt_idx" ON "LoginAttempt"("email", "ip", "createdAt");

CREATE TABLE IF NOT EXISTS "ServerProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "host" TEXT NOT NULL,
  "gamePort" INTEGER NOT NULL,
  "rconPort" INTEGER NOT NULL,
  "rconType" TEXT NOT NULL DEFAULT 'WEBRCON',
  "encryptedRconPassword" TEXT NOT NULL,
  "sftpEnabled" BOOLEAN NOT NULL DEFAULT false,
  "sftpHost" TEXT,
  "sftpPort" INTEGER NOT NULL DEFAULT 22,
  "sftpUsername" TEXT,
  "sftpPasswordEncrypted" TEXT,
  "sftpPrivateKeyEncrypted" TEXT,
  "sftpRootPath" TEXT,
  "sftpDefaultPluginPath" TEXT,
  "sftpDefaultConfigPath" TEXT,
  "sftpAllowOutsideRoot" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "QuickAction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "serverId" TEXT,
  "label" TEXT NOT NULL,
  "command" TEXT NOT NULL,
  "icon" TEXT,
  "requiresConfirm" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuickAction_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CommandCategory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "serverId" TEXT,
  "name" TEXT NOT NULL,
  CONSTRAINT "CommandCategory_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SavedCommand" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "categoryId" TEXT,
  "label" TEXT NOT NULL,
  "command" TEXT NOT NULL,
  "dangerous" BOOLEAN NOT NULL DEFAULT false,
  "requiresConfirm" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedCommand_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CommandCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ScheduledJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "serverId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "cron" TEXT NOT NULL,
  "command" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ENABLED',
  "lastRunAt" DATETIME,
  "nextRunAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduledJob_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ServerEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "serverId" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'info',
  "source" TEXT NOT NULL DEFAULT 'system',
  "message" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServerEvent_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ServerEvent_serverId_createdAt_idx" ON "ServerEvent"("serverId", "createdAt");

CREATE TABLE IF NOT EXISTS "ServerMetric" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "serverId" TEXT NOT NULL,
  "cpu" REAL,
  "memoryMb" REAL,
  "networkInKb" REAL,
  "networkOutKb" REAL,
  "fps" REAL,
  "players" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServerMetric_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ServerMetric_serverId_createdAt_idx" ON "ServerMetric"("serverId", "createdAt");
