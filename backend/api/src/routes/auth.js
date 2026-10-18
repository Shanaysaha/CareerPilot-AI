import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { query, withTransaction } from "../db/pool.js";
import { authenticate } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { email, text } from "../middleware/validate.js";

export const authRouter = Router();
const loginLimit = rateLimit({ limit: 8, windowMs: 60_000 });

async function createSession(user) {
  const sessionId = randomUUID();
  const token = jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
    jwtid: sessionId,
  });
  const claims = jwt.decode(token);
  await query(
    `INSERT INTO auth_sessions (id, user_id, expires_at)
     VALUES ($1, $2, to_timestamp($3))`,
    [sessionId, user.id, claims.exp],
  );
  return token;
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
  };
}

authRouter.post("/register", loginLimit, async (request, response) => {
  const fullName = text(request.body.fullName, "Full name", { max: 120 });
  const userEmail = email(request.body.email);
  const password = text(request.body.password, "Password", {
    min: 10,
    max: 200,
  });
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new HttpError(400, "Password must be no more than 72 UTF-8 bytes.");
  }
  const course = text(request.body.course || "", "Course", {
    max: 120,
    optional: true,
  });
  const cohortId = request.body.cohortId || null;
  const graduationYear = request.body.graduationYear ?? null;
  if (
    graduationYear !== null &&
    (!Number.isInteger(graduationYear) ||
      graduationYear < 2000 ||
      graduationYear > 2100)
  ) {
    throw new HttpError(
      400,
      "Graduation year must be a year between 2000 and 2100.",
    );
  }
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await withTransaction(async (client) => {
    const created = await client.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, 'student')
       RETURNING id, email, full_name, role`,
      [userEmail, passwordHash, fullName],
    );
    const newUser = created.rows[0];
    await client.query(
      `INSERT INTO student_profiles (user_id, cohort_id, course, graduation_year)
       VALUES ($1, $2, $3, $4)`,
      [newUser.id, cohortId, course, graduationYear],
    );
    return newUser;
  });

  const accessToken = await createSession(user);
  response
    .status(201)
    .json({ accessToken, tokenType: "Bearer", user: publicUser(user) });
});

authRouter.post("/login", loginLimit, async (request, response) => {
  const userEmail = email(request.body.email);
  const password = text(request.body.password, "Password", {
    min: 1,
    max: 200,
  });
  const result = await query(
    `SELECT id, email, full_name, role, status, password_hash
     FROM users WHERE email = $1`,
    [userEmail],
  );
  const user = result.rows[0];
  const passwordMatches = user
    ? await bcrypt.compare(password, user.password_hash)
    : false;
  if (!user || !passwordMatches || user.status !== "active") {
    throw new HttpError(401, "Email or password is incorrect.");
  }
  const accessToken = await createSession(user);
  response.json({ accessToken, tokenType: "Bearer", user: publicUser(user) });
});

authRouter.get("/me", authenticate, async (request, response) => {
  response.json({ user: publicUser(request.user) });
});

authRouter.post("/logout", authenticate, async (request, response) => {
  await query(
    "UPDATE auth_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL",
    [request.sessionId],
  );
  response.json({ message: "You are signed out." });
});

authRouter.post("/change-password", authenticate, async (request, response) => {
  const currentPassword = text(
    request.body.currentPassword,
    "Current password",
    { min: 1, max: 200 },
  );
  const newPassword = text(request.body.newPassword, "New password", {
    min: 10,
    max: 200,
  });
  if (Buffer.byteLength(newPassword, "utf8") > 72) {
    throw new HttpError(400, "Password must be no more than 72 UTF-8 bytes.");
  }
  const result = await query("SELECT password_hash FROM users WHERE id = $1", [
    request.user.id,
  ]);
  if (!(await bcrypt.compare(currentPassword, result.rows[0].password_hash))) {
    throw new HttpError(400, "Current password is incorrect.");
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await withTransaction(async (client) => {
    await client.query(
      "UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2",
      [passwordHash, request.user.id],
    );
    await client.query(
      "UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
      [request.user.id],
    );
  });
  response.json({
    message: "Password changed. Sign in again with the new password.",
  });
});
