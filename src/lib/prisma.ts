import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaBootstrap?: Promise<void>;
  prismaBootstrapping?: boolean;
};

const client =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

function migrationPaths() {
  const configured = process.env.MYRCON_MIGRATION_SQL;
  if (configured && existsSync(configured)) {
    return [configured];
  }

  const migrationsDir =
    process.env.MYRCON_MIGRATIONS_DIR ??
    join(/* turbopackIgnore: true */ process.cwd(), "prisma", "migrations");

  return [
    join(migrationsDir, "20260614000000_init", "migration.sql"),
    join(migrationsDir, "20260614000100_sftp_columns", "migration.sql"),
    join(migrationsDir, "20260614000200_app_settings", "migration.sql"),
    join(migrationsDir, "20260614000300_plugin_permission_assignments", "migration.sql"),
    join(migrationsDir, "20260615000000_server_players", "migration.sql"),
    join(migrationsDir, "20260615000100_command_runs", "migration.sql"),
    join(migrationsDir, "20260616000000_notifications", "migration.sql"),
    join(migrationsDir, "20260616000100_mod_framework", "migration.sql"),
    join(migrationsDir, "20260617000000_sftp_protocol", "migration.sql"),
  ].filter((sqlPath) => existsSync(sqlPath));
}

export async function ensureDatabase() {
  if (process.env.MYRCON_AUTO_INIT_DB === "false") {
    return;
  }

  globalForPrisma.prismaBootstrap ??= (async () => {
    globalForPrisma.prismaBootstrapping = true;
    try {
      for (const sqlPath of migrationPaths()) {
        if (!existsSync(sqlPath)) {
          continue;
        }
        const sql = readFileSync(sqlPath, "utf8");
        for (const statement of sql.split(";").map((item) => item.trim()).filter(Boolean)) {
          try {
            await client.$executeRawUnsafe(statement);
          } catch (error) {
            if (
              !(error instanceof Error) ||
              (!error.message.includes("duplicate column name") &&
                !error.message.includes("already exists"))
            ) {
              throw error;
            }
          }
        }
      }
    } finally {
      globalForPrisma.prismaBootstrapping = false;
    }
  })();

  await globalForPrisma.prismaBootstrap;
}

client.$use(async (_params, next) => {
  if (!globalForPrisma.prismaBootstrapping) {
    await ensureDatabase();
  }
  return next(_params);
});

export const prisma = client;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = client;
}
