CREATE TABLE IF NOT EXISTS "AppNotification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "serverId" TEXT,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "saved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AppNotification_read_createdAt_idx" ON "AppNotification"("read", "createdAt");

CREATE TABLE IF NOT EXISTS "NotificationRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "threshold" REAL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationRule_type_key" ON "NotificationRule"("type");
