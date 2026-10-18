import fs from "node:fs/promises";
import { app } from "./app.js";
import { env, validateEnvironment } from "./config/env.js";
import { pool } from "./db/pool.js";

validateEnvironment();
await fs.mkdir(env.resumeStoragePath, { recursive: true });
const server = app.listen(env.port, "0.0.0.0", () => {
  console.log(`CareerPilot API listening on http://localhost:${env.port}`);
});

async function stop(signal) {
  console.log(`${signal} received. Closing the API.`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
