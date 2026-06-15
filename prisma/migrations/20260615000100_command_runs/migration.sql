CREATE TABLE IF NOT EXISTS "CommandRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "serverId" TEXT NOT NULL,
  "savedCommandId" TEXT,
  "command" TEXT NOT NULL,
  "label" TEXT,
  "output" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommandRun_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CommandRun_serverId_createdAt_idx" ON "CommandRun"("serverId", "createdAt");
