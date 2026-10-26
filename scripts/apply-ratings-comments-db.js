// Apply only this feature's migration, after verifying that no other team
// migrations are pending. No reset, schema push, or database seeding is used.
const { PrismaClient } = require("@prisma/client");
const { readdirSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const featureMigration = "20261026221500_add_ratings_comments";

async function main() {
  const prisma = new PrismaClient();
  let needsMigration = false;
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const names = new Set(tables.map((table) => table.table_name));
    for (const name of ["Book", "User", "_prisma_migrations"]) {
      if (!names.has(name)) throw new Error(`Required existing table ${name} is missing. Stop and check the shared database setup.`);
    }

    const history = await prisma.$queryRaw`
      SELECT migration_name, finished_at, rolled_back_at FROM public."_prisma_migrations"
    `;
    const failed = history.filter((row) => !row.finished_at && !row.rolled_back_at);
    if (failed.length) {
      throw new Error(`An unresolved migration exists: ${failed.map((row) => row.migration_name).join(", ")}. Coordinate its recovery with the team first.`);
    }
    const applied = new Set(history.filter((row) => row.finished_at && !row.rolled_back_at).map((row) => row.migration_name));
    const local = readdirSync(join(__dirname, "../prisma/migrations"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    const otherPending = local.filter((name) => name !== featureMigration && !applied.has(name));
    if (otherPending.length) {
      throw new Error(`Other team migrations are pending: ${otherPending.join(", ")}. No tables were changed. Check their status with the owners before continuing.`);
    }
    if (applied.has(featureMigration)) {
      if (!names.has("Rating") || !names.has("Comment")) {
        throw new Error("The migration is recorded as applied, but a feature table is missing. Check the database before proceeding.");
      }
      console.log("Rating and Comment are already installed.");
    } else {
      if (names.has("Rating") || names.has("Comment")) {
        throw new Error("Rating or Comment already exists without this migration record. Stop and inspect it; no tables were changed.");
      }
      needsMigration = true;
    }
  } finally {
    await prisma.$disconnect();
  }

  if (!needsMigration) return;
  console.log("Preflight passed. Applying the Rating/Comment migration.");
  const result = spawnSync(process.execPath, [
    require.resolve("prisma/build/index.js"), "migrate", "deploy",
    "--schema", join(__dirname, "../prisma/schema.prisma"),
  ], { cwd: join(__dirname, ".."), env: process.env, stdio: "inherit" });
  if (result.error) throw new Error("Unable to start the local Prisma migration command.");
  if (result.status !== 0) throw new Error("Prisma migration did not finish successfully. Review its error before retrying.");
}

main().catch((error) => {
  // Prisma initialization errors can contain connection information.
  if (error.name?.startsWith("Prisma")) {
    console.error("Database preflight failed. Check the local .env connection settings and database availability.");
  } else {
    console.error(error.message);
  }
  process.exitCode = 1;
});
