import express from "express";
import { authRouter } from "./routes/auth.js";
import { profileRouter } from "./routes/profiles.js";
import { resumeRouter } from "./routes/resume.js";
import { learningRouter } from "./routes/learning.js";
import {
  readinessRouter,
  dashboardRouter,
  notificationRouter,
} from "./routes/readiness.js";
import { staffRouter, adminRouter } from "./routes/staff.js";
import { adminContentRouter } from "./routes/adminContent.js";
import { env } from "./config/env.js";
import { errorHandler, HttpError } from "./middleware/errors.js";

export const app = express();
const allowedOrigins = new Set(env.corsOrigins);

app.disable("x-powered-by");
app.use((request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, X-Internal-Key",
    );
    response.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
  }
  if (request.method === "OPTIONS") return response.sendStatus(204);
  next();
});
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", async (request, response, next) => {
  try {
    const { query } = await import("./db/pool.js");
    await query("SELECT 1");
    response.json({ status: "ok", database: "connected" });
  } catch (error) {
    next(new HttpError(503, "The database is not available."));
  }
});

app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/resume", resumeRouter);
app.use("/api/readiness", readinessRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/officer", staffRouter);
app.use("/api/admin", adminRouter);
app.use("/api/admin", adminContentRouter);
app.use("/api", learningRouter);

app.use((request, response, next) =>
  next(new HttpError(404, "This API route does not exist.")),
);
app.use(errorHandler);
