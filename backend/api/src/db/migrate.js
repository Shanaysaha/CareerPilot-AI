import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, withTransaction } from "./pool.js";
import { validateEnvironment } from "../config/env.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationFolder = path.join(here, "migrations");

async function migrate() {
  // Apply each numbered SQL migration once and record it in schema_migrations.
  validateEnvironment();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await fs.readdir(migrationFolder))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const filename of files) {
    const alreadyApplied = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE filename = $1",
      [filename],
    );
    if (alreadyApplied.rowCount) continue;

    const sql = await fs.readFile(path.join(migrationFolder, filename), "utf8");
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        [filename],
      );
    });
    console.log(`Applied ${filename}`);
  }
  console.log("Database migrations are up to date.");
}

migrate()
  .catch((error) => {
    console.error("Database migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
