CREATE TABLE IF NOT EXISTS "PluginPermissionAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "serverId" TEXT NOT NULL,
  "pluginName" TEXT,
  "permission" TEXT NOT NULL,
  "framework" TEXT NOT NULL DEFAULT 'CARBON',
  "steamId" TEXT NOT NULL,
  "playerName" TEXT,
  "source" TEXT NOT NULL DEFAULT 'MYRCON',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PluginPermissionAssignment_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PluginPermissionAssignment_serverId_permission_steamId_key"
  ON "PluginPermissionAssignment"("serverId", "permission", "steamId");

CREATE INDEX IF NOT EXISTS "PluginPermissionAssignment_serverId_permission_idx"
  ON "PluginPermissionAssignment"("serverId", "permission");
