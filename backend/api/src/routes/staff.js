import { Router } from "express";
import bcrypt from "bcryptjs";
import { query, withTransaction } from "../db/pool.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { email, text, uuid } from "../middleware/validate.js";
import { recordAudit } from "../services/audit.js";

export const staffRouter = Router();
staffRouter.use(
  authenticate,
  requireRole("placement_officer", "administrator"),
);
async function ensureCohortAccess(user, cohortId) {
  if (user.role === "administrator") return;
  const allowed = await query(
    "SELECT 1 FROM officer_cohorts WHERE officer_id=$1 AND cohort_id=$2",
    [user.id, cohortId],
  );
  if (!allowed.rowCount)
    throw new HttpError(403, "This cohort is outside your assignment.");
}
staffRouter.get("/dashboard", async (req, res) => {
  const values = [];
  let scope = "";
  if (req.user.role !== "administrator") {
    values.push(req.user.id);
    scope =
      "AND sp.cohort_id IN (SELECT cohort_id FROM officer_cohorts WHERE officer_id=$1)";
  }
  const result = await query(
    `SELECT c.id AS "cohortId",c.name AS cohort,count(DISTINCT sp.user_id)::int AS students,
  count(DISTINCT sp.user_id) FILTER(WHERE rs.is_complete)::int AS "studentsWithReadiness",
  round(avg(rs.total_score))::int AS "averageReadiness"
  FROM cohorts c LEFT JOIN student_profiles sp ON sp.cohort_id=c.id
  LEFT JOIN LATERAL(SELECT is_complete,total_score FROM readiness_snapshots WHERE student_id=sp.user_id ORDER BY calculated_at DESC LIMIT 1) rs ON true
  WHERE true ${scope} GROUP BY c.id,c.name ORDER BY c.name`,
    values,
  );
  res.json({ cohorts: result.rows });
});
staffRouter.get("/cohorts/:id/students", async (req, res) => {
  const id = uuid(req.params.id, "Cohort ID");
  await ensureCohortAccess(req.user, id);
  const result = await query(
    `SELECT u.id,u.full_name AS "fullName",u.email,sp.course,sp.graduation_year AS "graduationYear",cr.name AS "targetRole",rs.total_score AS "readinessScore",rs.is_complete AS "readinessComplete" FROM student_profiles sp JOIN users u ON u.id=sp.user_id LEFT JOIN career_roles cr ON cr.id=sp.target_role_id LEFT JOIN LATERAL(SELECT total_score,is_complete FROM readiness_snapshots WHERE student_id=sp.user_id ORDER BY calculated_at DESC LIMIT 1) rs ON true WHERE sp.cohort_id=$1 ORDER BY u.full_name`,
    [id],
  );
  res.json({ students: result.rows });
});
staffRouter.get("/reports/summary", async (req, res) => {
  const cohortId = req.query.cohortId
    ? uuid(req.query.cohortId, "Cohort ID")
    : null;
  if (cohortId) await ensureCohortAccess(req.user, cohortId);
  const result = await query(
    `SELECT count(DISTINCT sp.user_id)::int AS students,round(avg(rs.total_score))::int AS "averageReadiness",count(DISTINCT sp.user_id) FILTER(WHERE rs.is_complete)::int AS "completeReadiness",count(DISTINCT sp.user_id) FILTER(WHERE EXISTS(SELECT 1 FROM resumes r JOIN resume_versions v ON v.resume_id=r.id WHERE r.student_id=sp.user_id))::int AS "studentsWithResume" FROM student_profiles sp LEFT JOIN LATERAL(SELECT total_score,is_complete FROM readiness_snapshots WHERE student_id=sp.user_id ORDER BY calculated_at DESC LIMIT 1) rs ON true WHERE ($1::uuid IS NULL OR sp.cohort_id=$1) AND ($2::boolean OR sp.cohort_id IN (SELECT cohort_id FROM officer_cohorts WHERE officer_id=$3))`,
    [cohortId, req.user.role === "administrator", req.user.id],
  );
  res.json({ summary: result.rows[0] });
});
staffRouter.post("/notifications", async (req, res) => {
  const title = text(req.body.title, "Title", { max: 160 }),
    body = text(req.body.body, "Message", { max: 5000 }),
    cohortId = req.body.cohortId ? uuid(req.body.cohortId, "Cohort ID") : null;
  if (!cohortId && req.user.role !== "administrator")
    throw new HttpError(
      403,
      "Only administrators can publish institution-wide notifications.",
    );
  if (cohortId) await ensureCohortAccess(req.user, cohortId);
  const notification = await withTransaction(async (client) => {
    const n = await client.query(
      `INSERT INTO notifications(author_id,cohort_id,title,body,is_published,published_at) VALUES($1,$2,$3,$4,true,now()) RETURNING id,title,body,cohort_id AS "cohortId",published_at AS "publishedAt"`,
      [req.user.id, cohortId, title, body],
    );
    await client.query(
      `INSERT INTO notification_deliveries(notification_id,student_id) SELECT $1,user_id FROM student_profiles WHERE ($2::uuid IS NULL OR cohort_id=$2)`,
      [n.rows[0].id, cohortId],
    );
    return n.rows[0];
  });
  await recordAudit(
    req.user.id,
    "notification.published",
    "notification",
    notification.id,
  );
  res.status(201).json({ notification });
});
staffRouter.post("/cohorts", requireRole("administrator"), async (req, res) => {
  const name = text(req.body.name, "Cohort name", { max: 120 }),
    year = text(req.body.academicYear || "", "Academic year", {
      max: 20,
      optional: true,
    });
  const result = await query(
    `INSERT INTO cohorts(name,academic_year) VALUES($1,$2) ON CONFLICT(name,academic_year) DO UPDATE SET name=EXCLUDED.name RETURNING id,name,academic_year AS "academicYear"`,
    [name, year || null],
  );
  res.status(201).json({ cohort: result.rows[0] });
});
staffRouter.post(
  "/officers/:id/cohorts",
  requireRole("administrator"),
  async (req, res) => {
    const officerId = uuid(req.params.id, "Officer ID"),
      cohortId = uuid(req.body.cohortId, "Cohort ID");
    const officer = await query(
      "SELECT id FROM users WHERE id=$1 AND role='placement_officer' AND status='active'",
      [officerId],
    );
    if (!officer.rowCount)
      throw new HttpError(404, "Active placement officer not found.");
    const result = await query(
      `INSERT INTO officer_cohorts(officer_id,cohort_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING officer_id`,
      [officerId, cohortId],
    );
    await recordAudit(
      req.user.id,
      "officer.cohort_assigned",
      "user",
      officerId,
      { cohortId },
    );
    res.status(201).json({ assigned: Boolean(result.rowCount) });
  },
);
staffRouter.post("/users", requireRole("administrator"), async (req, res) => {
  const userEmail = email(req.body.email),
    fullName = text(req.body.fullName, "Full name", { max: 120 }),
    role = req.body.role;
  if (!["placement_officer", "administrator"].includes(role))
    throw new HttpError(
      400,
      "Role must be placement_officer or administrator.",
    );
  const password = text(req.body.temporaryPassword, "Temporary password", {
      min: 12,
      max: 200,
    }),
    hash = await bcrypt.hash(password, 12);
  const result = await query(
    `INSERT INTO users(email,password_hash,full_name,role) VALUES($1,$2,$3,$4) RETURNING id,email,full_name AS "fullName",role,status`,
    [userEmail, hash, fullName, role],
  );
  await recordAudit(req.user.id, "user.created", "user", result.rows[0].id, {
    role,
  });
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new HttpError(400, "Password must be no more than 72 UTF-8 bytes.");
  }
  res.status(201).json({ user: result.rows[0] });
});
staffRouter.patch(
  "/users/:id/status",
  requireRole("administrator"),
  async (req, res) => {
    const id = uuid(req.params.id, "User ID"),
      status = req.body.status;
    if (!["active", "disabled"].includes(status))
      throw new HttpError(400, "Status must be active or disabled.");
    if (id === req.user.id && status === "disabled")
      throw new HttpError(400, "You cannot disable your own account.");
    const result = await query(
      `UPDATE users SET status=$1,updated_at=now() WHERE id=$2 RETURNING id,email,role,status`,
      [status, id],
    );
    if (!result.rowCount) throw new HttpError(404, "User not found.");
    if (status === "disabled")
      await query(
        "UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL",
        [id],
      );
    await recordAudit(req.user.id, "user.status_changed", "user", id, {
      status,
    });
    res.json({ user: result.rows[0] });
  },
);

export const adminRouter = Router();
adminRouter.use(authenticate, requireRole("administrator"));
adminRouter.get("/audit", async (req, res) => {
  const requested = Number(req.query.limit) || 100;
  const limit = Math.max(1, Math.min(requested, 500));
  const result = await query(
    `SELECT id,actor_id AS "actorId",action,entity_type AS "entityType",entity_id AS "entityId",details_json AS details,created_at AS "createdAt" FROM audit_events ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  res.json({ events: result.rows });
});
