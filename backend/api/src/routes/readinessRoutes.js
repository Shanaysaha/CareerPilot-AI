import { Router } from "express";
import { query } from "../db/pool.js";
import { authenticate } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { uuid } from "../middleware/validate.js";
import { requireStudent } from "../services/studentHelpers.js";
import { calculateReadiness } from "../services/readinessScore.js";

export const readinessRouter = Router();
readinessRouter.use(authenticate);
readinessRouter.get("/me", async (req, res) => {
  requireStudent(req.user);
  const evidence = await query(
    `SELECT
  (SELECT score FROM resume_analyses ra JOIN resume_versions rv ON rv.id=ra.resume_version_id JOIN resumes r ON r.id=rv.resume_id WHERE r.student_id=$1 AND ra.status='completed' ORDER BY ra.created_at DESC LIMIT 1) AS resume,
  (SELECT score FROM interview_sessions WHERE student_id=$1 AND status='completed' ORDER BY completed_at DESC LIMIT 1) AS interview,
      (SELECT round(avg(best_score))::int FROM (SELECT max(CASE WHEN is_correct THEN 100 ELSE 0 END) AS best_score FROM coding_submissions WHERE student_id=$1 GROUP BY problem_id) best_per_problem) AS coding,
  (SELECT score FROM aptitude_attempts WHERE student_id=$1 AND status='completed' ORDER BY completed_at DESC LIMIT 1) AS aptitude,
  (SELECT count(*) FROM student_skills WHERE student_id=$1) AS skill_count`,
    [req.user.id],
  );
  const skills = await query(
    `SELECT cr.name AS role,round(100.0*count(*) FILTER(WHERE COALESCE(ss.proficiency,0)>=rs.required_level)/NULLIF(count(*),0))::int AS score,count(*) AS total FROM student_profiles sp JOIN career_roles cr ON cr.id=sp.target_role_id JOIN role_skills rs ON rs.role_id=cr.id LEFT JOIN student_skills ss ON ss.student_id=sp.user_id AND ss.skill_id=rs.skill_id WHERE sp.user_id=$1 GROUP BY cr.name`,
    [req.user.id],
  );
  const formula = await query(
    "SELECT version,weights_json,minimum_evidence_json FROM readiness_formulas WHERE is_active=true ORDER BY created_at DESC LIMIT 1",
  );
  if (!formula.rowCount)
    throw new HttpError(503, "Readiness scoring has not been configured.");
  const raw = evidence.rows[0],
    weights =
      typeof formula.rows[0].weights_json === "string"
        ? JSON.parse(formula.rows[0].weights_json)
        : formula.rows[0].weights_json;
  const minimum =
    typeof formula.rows[0].minimum_evidence_json === "string"
      ? JSON.parse(formula.rows[0].minimum_evidence_json)
      : formula.rows[0].minimum_evidence_json;
  const parts = {
    resume: raw.resume,
    skills: skills.rows[0]?.score ?? null,
    interview: raw.interview,
    coding: raw.coding,
    aptitude: raw.aptitude,
  };
  const required = Number(minimum.count || 3);
  const readiness = calculateReadiness(parts, weights, required);
  const { score, evidenceCount: count, availableWeight } = readiness;
  const result = await query(
    `INSERT INTO readiness_snapshots(student_id,formula_version,total_score,breakdown_json,is_complete) VALUES($1,$2,$3,$4::jsonb,$5) RETURNING calculated_at AS "calculatedAt"`,
    [
      req.user.id,
      formula.rows[0].version,
      score,
      JSON.stringify({
        scores: parts,
        evidenceCount: count,
        requiredEvidence: required,
        weights,
        availableWeight,
      }),
      score !== null,
    ],
  );
  res.json({
    score,
    complete: score !== null,
    formulaVersion: formula.rows[0].version,
    breakdown: parts,
    evidenceCount: count,
    requiredEvidence: required,
    calculatedAt: result.rows[0].calculatedAt,
  });
});

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);
dashboardRouter.get("/student", async (req, res) => {
  requireStudent(req.user);
  const [profile, stats, notifications, ready] = await Promise.all([
    query(
      `SELECT u.full_name AS "fullName",sp.course,sp.graduation_year AS "graduationYear",cr.name AS "targetRole" FROM users u JOIN student_profiles sp ON sp.user_id=u.id LEFT JOIN career_roles cr ON cr.id=sp.target_role_id WHERE u.id=$1`,
      [req.user.id],
    ),
    query(
      `SELECT (SELECT count(*) FROM resume_versions rv JOIN resumes r ON r.id=rv.resume_id WHERE r.student_id=$1) AS resumes,(SELECT count(*) FROM interview_sessions WHERE student_id=$1 AND status='completed') AS interviews,(SELECT count(*) FROM aptitude_attempts WHERE student_id=$1 AND status='completed') AS aptitude,(SELECT count(*) FROM coding_submissions WHERE student_id=$1) AS coding,(SELECT count(*) FROM student_resource_progress WHERE student_id=$1 AND status='completed') AS resources`,
      [req.user.id],
    ),
    query(
      `SELECT n.id,n.title,n.body,n.published_at AS "publishedAt",nd.is_read AS "isRead" FROM notification_deliveries nd JOIN notifications n ON n.id=nd.notification_id WHERE nd.student_id=$1 AND n.is_published=true AND n.archived_at IS NULL ORDER BY n.published_at DESC LIMIT 5`,
      [req.user.id],
    ),
    query(
      'SELECT total_score AS score,is_complete AS complete,calculated_at AS "calculatedAt" FROM readiness_snapshots WHERE student_id=$1 ORDER BY calculated_at DESC LIMIT 1',
      [req.user.id],
    ),
  ]);
  res.json({
    profile: profile.rows[0],
    stats: stats.rows[0],
    notifications: notifications.rows,
    readiness: ready.rows[0] || null,
  });
});

export const notificationRouter = Router();
notificationRouter.use(authenticate);
notificationRouter.get("/", async (req, res) => {
  const result = await query(
    `SELECT n.id,n.title,n.body,n.published_at AS "publishedAt",nd.is_read AS "isRead" FROM notification_deliveries nd JOIN notifications n ON n.id=nd.notification_id WHERE nd.student_id=$1 AND n.is_published=true AND n.archived_at IS NULL ORDER BY n.published_at DESC`,
    [req.user.id],
  );
  res.json({ notifications: result.rows });
});
notificationRouter.patch("/:id/read", async (req, res) => {
  const id = uuid(req.params.id, "Notification ID");
  const result = await query(
    `UPDATE notification_deliveries SET is_read=true,read_at=now() WHERE notification_id=$1 AND student_id=$2 RETURNING notification_id AS id,is_read AS "isRead",read_at AS "readAt"`,
    [id, req.user.id],
  );
  if (!result.rowCount) throw new HttpError(404, "Notification not found.");
  res.json({ notification: result.rows[0] });
});
