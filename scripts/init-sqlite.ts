import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const migrationFiles = [
    join(process.cwd(), "prisma", "migrations", "20260614000000_init", "migration.sql"),
    join(process.cwd(), "prisma", "migrations", "20260614000100_sftp_columns", "migration.sql"),
  ];

  for (const file of migrationFiles) {
    const sql = await readFile(file, "utf8");
    for (const statement of sql.split(";").map((item) => item.trim()).filter(Boolean)) {
      try {
        await prisma.$executeRawUnsafe(statement);
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
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("SQLite schema initialized.");
  })
  .catch(async (error) => {
    await prisma.$disconnect();
    console.error(error);
    process.exit(1);
  });
