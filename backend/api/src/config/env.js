import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFolder = path.dirname(fileURLToPath(import.meta.url));
const apiFolder = path.resolve(currentFolder, "../..");

export const env = {
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  resumeStoragePath: path.resolve(
    apiFolder,
    process.env.RESUME_STORAGE_PATH || "./uploads/resumes",
  ),
  maxResumeSizeBytes: Number(process.env.MAX_RESUME_SIZE_MB || 5) * 1024 * 1024,
  aiServiceUrl: process.env.AI_SERVICE_URL || "http://127.0.0.1:8001",
  aiServiceApiKey: process.env.AI_SERVICE_API_KEY || "",
};

export function validateEnvironment() {
  const missing = [];
  if (!env.databaseUrl) missing.push("DATABASE_URL");
  if (env.aiServiceApiKey.length < 32 || /change|replace|example/i.test(env.aiServiceApiKey)) {
    missing.push("AI_SERVICE_API_KEY (set the same random secret in both services)");
  }
  if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
    missing.push("PORT (must be a port from 1 to 65535)");
  }
  if (!Number.isFinite(env.maxResumeSizeBytes) || env.maxResumeSizeBytes < 1024 * 1024 || env.maxResumeSizeBytes > 20 * 1024 * 1024) {
    missing.push("MAX_RESUME_SIZE_MB (must be from 1 to 20)");
  }
  if (
    !env.jwtSecret ||
    env.jwtSecret.length < 32 ||
    env.jwtSecret.startsWith("replace-this")
  ) {
    missing.push("JWT_SECRET (use a random value with at least 32 characters)");
  }
  if (missing.length) {
    throw new Error(
      `Missing or invalid environment settings: ${missing.join(", ")}`,
    );
  }
}
