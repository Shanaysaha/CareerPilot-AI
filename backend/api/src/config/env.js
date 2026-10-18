import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFolder = path.dirname(fileURLToPath(import.meta.url));
const apiFolder = path.resolve(currentFolder, "../..");

export const env = {
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
