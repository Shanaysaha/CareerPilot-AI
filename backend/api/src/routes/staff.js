import { Router } from "express";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
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
staffRouter.get("/cohorts", async (req, res) => {
  const result = req.user.role === "administrator"
    ? await query(`SELECT id,name,academic_year AS "academicYear",is_active AS "isActive",created_at AS "createdAt" FROM cohorts ORDER BY name,academic_year`)
    : await query(`SELECT c.id,c.name,c.academic_year AS "academicYear",c.is_active AS "isActive",c.created_at AS "createdAt" FROM cohorts c JOIN officer_cohorts oc ON oc.cohort_id=c.id WHERE oc.officer_id=$1 ORDER BY c.name,c.academic_year`, [req.user.id]);
  res.json({ cohorts: result.rows });
});
staffRouter.patch("/cohorts/:id", requireRole("administrator"), async (req, res) => {
  const id = uuid(req.params.id, "Cohort ID");
  const current = await query("SELECT name,academic_year FROM cohorts WHERE id=$1", [id]);
  if (!current.rowCount) throw new HttpError(404, "Cohort not found.");
  const name = req.body.name === undefined ? current.rows[0].name : text(req.body.name, "Cohort name", { max: 120 });
  const year = req.body.academicYear === undefined ? current.rows[0].academic_year : (text(req.body.academicYear ?? "", "Academic year", { max: 20, optional: true }) || null);
  if (req.body.name === undefined && req.body.academicYear === undefined && req.body.isActive === undefined) throw new HttpError(400, "Provide a cohort field to update.");
  if (req.body.isActive !== undefined && typeof req.body.isActive !== "boolean") throw new HttpError(400, "isActive must be true or false.");
  const result = await query(`UPDATE cohorts SET name=$1,academic_year=$2,is_active=COALESCE($3::boolean,is_active) WHERE id=$4 RETURNING id,name,academic_year AS "academicYear",is_active AS "isActive"`, [name, year || null, req.body.isActive ?? null, id]);
  if (!result.rowCount) throw new HttpError(404, "Cohort not found.");
  await recordAudit(req.user.id, "cohort.updated", "cohort", id, { isActive: req.body.isActive });
  res.json({ cohort: result.rows[0] });
});
staffRouter.get("/cohorts/:id/officers", requireRole("administrator"), async (req, res) => {
  const cohortId = uuid(req.params.id, "Cohort ID");
  const result = await query(`SELECT u.id,u.full_name AS "fullName",u.email,oc.assigned_at AS "assignedAt" FROM officer_cohorts oc JOIN users u ON u.id=oc.officer_id WHERE oc.cohort_id=$1 ORDER BY u.full_name`, [cohortId]);
  res.json({ officers: result.rows });
});
staffRouter.delete("/cohorts/:cohortId/officers/:officerId", requireRole("administrator"), async (req, res) => {
  const cohortId = uuid(req.params.cohortId, "Cohort ID");
  const officerId = uuid(req.params.officerId, "Officer ID");
  const result = await query("DELETE FROM officer_cohorts WHERE cohort_id=$1 AND officer_id=$2 RETURNING officer_id", [cohortId, officerId]);
  if (!result.rowCount) throw new HttpError(404, "Officer assignment not found.");
  await recordAudit(req.user.id, "officer.cohort_unassigned", "user", officerId, { cohortId });
  res.json({ assigned: false });
});
staffRouter.patch("/students/:id/cohort", requireRole("administrator"), async (req, res) => {
  const studentId = uuid(req.params.id, "Student ID");
  const cohortId = req.body.cohortId === null ? null : uuid(req.body.cohortId, "Cohort ID");
  const result = await withTransaction(async (client) => {
    const updated = await client.query("UPDATE student_profiles SET cohort_id=$1,updated_at=now() WHERE user_id=$2 RETURNING user_id AS \"studentId\",cohort_id AS \"cohortId\"", [cohortId, studentId]);
    if (!updated.rowCount) throw new HttpError(404, "Student profile not found.");
    await client.query(`DELETE FROM notification_deliveries nd USING notifications n WHERE nd.notification_id=n.id AND nd.student_id=$1 AND n.cohort_id IS NOT NULL AND n.cohort_id IS DISTINCT FROM $2`, [studentId, cohortId]);
    await client.query(`INSERT INTO notification_deliveries(notification_id,student_id) SELECT id,$1 FROM notifications WHERE is_published=true AND archived_at IS NULL AND (cohort_id IS NULL OR cohort_id=$2) ON CONFLICT DO NOTHING`, [studentId, cohortId]);
    await client.query(`INSERT INTO audit_events(actor_id,action,entity_type,entity_id,details_json) VALUES($1,'student.cohort_changed','user',$2,$3::jsonb)`, [req.user.id, studentId, JSON.stringify({ cohortId })]);
    return updated.rows[0];
  });
  res.json({ student: result });
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
staffRouter.get("/notifications", async (req, res) => {
  const result = req.user.role === "administrator"
    ? await query(`SELECT n.id,n.title,n.body,n.is_published AS "isPublished",n.published_at AS "publishedAt",n.archived_at AS "archivedAt",n.cohort_id AS "cohortId",c.name AS cohort FROM notifications n LEFT JOIN cohorts c ON c.id=n.cohort_id ORDER BY n.created_at DESC`)
    : await query(`SELECT n.id,n.title,n.body,n.is_published AS "isPublished",n.published_at AS "publishedAt",n.archived_at AS "archivedAt",n.cohort_id AS "cohortId",c.name AS cohort FROM notifications n LEFT JOIN cohorts c ON c.id=n.cohort_id WHERE n.author_id=$1 OR n.cohort_id IN (SELECT cohort_id FROM officer_cohorts WHERE officer_id=$1) ORDER BY n.created_at DESC`, [req.user.id]);
  res.json({ notifications: result.rows });
});
staffRouter.post("/notifications", async (req, res) => {
  const title = text(req.body.title, "Title", { max: 160 }),
    body = text(req.body.body, "Message", { max: 5000 }),
    cohortId = req.body.cohortId ? uuid(req.body.cohortId, "Cohort ID") : null;
  const isPublished = req.body.isPublished !== false;
  if (req.body.isPublished !== undefined && typeof req.body.isPublished !== "boolean")
    throw new HttpError(400, "isPublished must be true or false.");
  if (!cohortId && req.user.role !== "administrator")
    throw new HttpError(
      403,
      "Only administrators can publish institution-wide notifications.",
    );
  if (cohortId) await ensureCohortAccess(req.user, cohortId);
  const notification = await withTransaction(async (client) => {
    const n = await client.query(
      `INSERT INTO notifications(author_id,cohort_id,title,body,is_published,published_at) VALUES($1,$2,$3,$4,$5,CASE WHEN $5 THEN now() ELSE NULL END) RETURNING id,title,body,cohort_id AS "cohortId",is_published AS "isPublished",published_at AS "publishedAt"`,
      [req.user.id, cohortId, title, body, isPublished],
    );
    if (isPublished) await client.query(
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
staffRouter.patch("/notifications/:id", async (req, res) => {
  const id = uuid(req.params.id, "Notification ID");
  const title = text(req.body.title, "Title", { max: 160 });
  const body = text(req.body.body, "Message", { max: 5000 });
  const isPublished = req.body.isPublished;
  if (typeof isPublished !== "boolean") throw new HttpError(400, "isPublished must be true or false.");
  const notification = await withTransaction(async (client) => {
    const current = await client.query("SELECT * FROM notifications WHERE id=$1 FOR UPDATE", [id]);
    if (!current.rowCount) throw new HttpError(404, "Notification not found.");
    const old = current.rows[0];
    if (req.user.role !== "administrator") {
      if (old.author_id !== req.user.id) throw new HttpError(403, "You can only edit notices you created.");
      if (!old.cohort_id) throw new HttpError(403, "Officers cannot edit institution-wide notices.");
      await ensureCohortAccess(req.user, old.cohort_id);
    }
    const cohortId = req.body.cohortId === undefined ? old.cohort_id : (req.body.cohortId === null ? null : uuid(req.body.cohortId, "Cohort ID"));
    if (!cohortId && req.user.role !== "administrator") throw new HttpError(403, "Only administrators can publish institution-wide notices.");
    if (cohortId) await ensureCohortAccess(req.user, cohortId);
    const updated = await client.query(`UPDATE notifications SET title=$1,body=$2,cohort_id=$3,is_published=$4,published_at=CASE WHEN $4 THEN COALESCE(published_at,now()) ELSE NULL END,updated_at=now() WHERE id=$5 RETURNING id,title,body,cohort_id AS "cohortId",is_published AS "isPublished",published_at AS "publishedAt"`, [title, body, cohortId, isPublished, id]);
    if (old.cohort_id !== cohortId) await client.query("DELETE FROM notification_deliveries WHERE notification_id=$1", [id]);
    if (isPublished) await client.query(`INSERT INTO notification_deliveries(notification_id,student_id) SELECT $1,user_id FROM student_profiles WHERE ($2::uuid IS NULL OR cohort_id=$2) ON CONFLICT DO NOTHING`, [id, cohortId]);
    await client.query(`INSERT INTO audit_events(actor_id,action,entity_type,entity_id) VALUES($1,'notification.updated','notification',$2)`, [req.user.id, id]);
    return updated.rows[0];
  });
  res.json({ notification });
});
staffRouter.patch("/notifications/:id/archive", async (req, res) => {
  const id = uuid(req.params.id, "Notification ID");
  const current = await query("SELECT author_id,cohort_id FROM notifications WHERE id=$1", [id]);
  if (!current.rowCount) throw new HttpError(404, "Notification not found.");
  if (req.user.role !== "administrator") {
    if (current.rows[0].author_id !== req.user.id || !current.rows[0].cohort_id) throw new HttpError(403, "You cannot archive this notice.");
    await ensureCohortAccess(req.user, current.rows[0].cohort_id);
  }
  const result = await query("UPDATE notifications SET archived_at=now(),updated_at=now() WHERE id=$1 RETURNING id,archived_at AS \"archivedAt\"", [id]);
  await recordAudit(req.user.id, "notification.archived", "notification", id);
  res.json({ notification: result.rows[0] });
});
staffRouter.post("/cohorts", requireRole("administrator"), async (req, res) => {
  const name = text(req.body.name, "Cohort name", { max: 120 }),
    year = text(req.body.academicYear || "", "Academic year", {
      max: 20,
      optional: true,
    });
  const academicYear = year || null;
  const existing = await query(`SELECT id,name,academic_year AS "academicYear" FROM cohorts WHERE name=$1 AND COALESCE(academic_year,'')=COALESCE($2,'')`, [name, academicYear]);
  if (existing.rowCount) return res.json({ cohort: existing.rows[0] });
  const inserted = await query(`INSERT INTO cohorts(name,academic_year) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id,name,academic_year AS "academicYear"`, [name, academicYear]);
  const result = inserted.rowCount ? inserted : await query(`SELECT id,name,academic_year AS "academicYear" FROM cohorts WHERE name=$1 AND COALESCE(academic_year,'')=COALESCE($2,'')`, [name, academicYear]);
  if (!result.rowCount) throw new HttpError(500, "The cohort could not be created.");
  res.status(inserted.rowCount ? 201 : 200).json({ cohort: result.rows[0] });
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
    });
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new HttpError(400, "Password must be no more than 72 UTF-8 bytes.");
  }
  const hash = await bcrypt.hash(password, 12);
  const result = await query(
    `INSERT INTO users(email,password_hash,full_name,role) VALUES($1,$2,$3,$4) RETURNING id,email,full_name AS "fullName",role,status`,
    [userEmail, hash, fullName, role],
  );
  await recordAudit(req.user.id, "user.created", "user", result.rows[0].id, {
    role,
  });
  res.status(201).json({ user: result.rows[0] });
});
staffRouter.post("/users/:id/password-reset", requireRole("administrator"), async (req, res) => {
  const userId = uuid(req.params.id, "User ID");
  const target = await query("SELECT id FROM users WHERE id=$1 AND status='active'", [userId]);
  if (!target.rowCount) throw new HttpError(404, "Active user not found.");
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await withTransaction(async (client) => {
    await client.query("UPDATE password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL", [userId]);
    await client.query("INSERT INTO password_reset_tokens(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 minutes')", [tokenHash, userId]);
    await client.query("INSERT INTO audit_events(actor_id,action,entity_type,entity_id) VALUES($1,'password_reset.issued','user',$2)", [req.user.id, userId]);
  });
  res.status(201).json({ resetToken: token, expiresInMinutes: 30, message: "Share this one-time token with the user through a verified private channel." });
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
