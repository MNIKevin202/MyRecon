CREATE TABLE IF NOT EXISTS "ServerPlayer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "serverId" TEXT NOT NULL,
  "steamId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "aliasesJson" TEXT,
  "online" BOOLEAN NOT NULL DEFAULT false,
  "source" TEXT NOT NULL DEFAULT 'MYRCON',
  "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastConnectedAt" DATETIME,
  "lastDisconnectedAt" DATETIME,
  "timesSeen" INTEGER NOT NULL DEFAULT 1,
  "lastPing" INTEGER,
  "bestPing" INTEGER,
  "lastAddress" TEXT,
  "lastConnectedSeconds" INTEGER,
  "maxConnectedSeconds" INTEGER,
  "violationLevel" INTEGER,
  "rawJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServerPlayer_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ServerPlayer_serverId_steamId_key"
  ON "ServerPlayer"("serverId", "steamId");

CREATE INDEX IF NOT EXISTS "ServerPlayer_serverId_online_idx"
  ON "ServerPlayer"("serverId", "online");

CREATE INDEX IF NOT EXISTS "ServerPlayer_serverId_lastSeenAt_idx"
  ON "ServerPlayer"("serverId", "lastSeenAt");
