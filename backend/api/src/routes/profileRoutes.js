import { Router } from "express";
import { query, withTransaction } from "../db/pool.js";
import { authenticate } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { text, uuid } from "../middleware/validate.js";

export const profileRouter = Router();
profileRouter.use(authenticate);

// Read the signed-in student's profile and selected career role.
profileRouter.get("/me", async (request, response) => {
  if (request.user.role !== "student")
    throw new HttpError(403, "This profile belongs to students.");
  const result = await query(
    `SELECT u.id, u.email, u.full_name AS "fullName", sp.course,
            sp.graduation_year AS "graduationYear", sp.cohort_id AS "cohortId",
            sp.target_role_id AS "targetRoleId", cr.name AS "targetRole",
            sp.preferences, sp.ai_data_consent AS "aiDataConsent",
            sp.updated_at AS "updatedAt"
     FROM users u JOIN student_profiles sp ON sp.user_id = u.id
     LEFT JOIN career_roles cr ON cr.id = sp.target_role_id
     WHERE u.id = $1`,
    [request.user.id],
  );
  response.json({ profile: result.rows[0] });
});

// Update account details and profile preferences in one database transaction.
profileRouter.put("/me", async (request, response) => {
  if (request.user.role !== "student")
    throw new HttpError(403, "This profile belongs to students.");
  const fullName = text(request.body.fullName, "Full name", { max: 120 });
  const course = text(request.body.course || "", "Course", {
    max: 120,
    optional: true,
  });
  const targetRoleId = request.body.targetRoleId
    ? uuid(request.body.targetRoleId, "Target role ID")
    : null;
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
  const preferences = request.body.preferences ?? {};
  if (
    request.body.aiDataConsent !== undefined &&
    typeof request.body.aiDataConsent !== "boolean"
  ) {
    throw new HttpError(400, "AI data consent must be true or false.");
  }
  const aiDataConsent = request.body.aiDataConsent ?? null;
  if (
    !preferences ||
    typeof preferences !== "object" ||
    Array.isArray(preferences)
  ) {
    throw new HttpError(400, "Preferences must be an object.");
  }

  const result = await withTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE users SET full_name = $1, updated_at = now() WHERE id = $2
     RETURNING id, email, full_name AS "fullName", role`,
      [fullName, request.user.id],
    );
    await client.query(
      `UPDATE student_profiles SET course = $1, graduation_year = $2,
       target_role_id = $3, preferences = $4::jsonb,
       ai_data_consent = COALESCE($5::boolean, ai_data_consent), updated_at = now()
     WHERE user_id = $6`,
      [
        course,
        graduationYear,
        targetRoleId,
        JSON.stringify(preferences),
        aiDataConsent,
        request.user.id,
      ],
    );
    return updated;
  });
  response.json({
    profile: {
      ...result.rows[0],
      course,
      graduationYear,
      targetRoleId,
      preferences,
      ...(aiDataConsent !== null ? { aiDataConsent } : {}),
    },
  });
});
