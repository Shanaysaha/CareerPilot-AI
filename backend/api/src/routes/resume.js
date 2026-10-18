import { Router } from "express";
import fs from "node:fs";
import { query, withTransaction } from "../db/pool.js";
import { authenticate } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { HttpError } from "../middleware/errors.js";
import { text, uuid } from "../middleware/validate.js";
import {
  analyzeResumeFile,
  analyzeResumeText,
  getAIProvider,
} from "../services/aiClient.js";
import { requireStudent } from "../services/student.js";
import { resumeUpload } from "../services/uploads.js";
import { recordAudit } from "../services/audit.js";

export const resumeRouter = Router();
resumeRouter.use(authenticate);
const aiLimit = rateLimit({ limit: 20, windowMs: 60_000 });
resumeRouter.use((request, response, next) => {
  try {
    requireStudent(request.user);
    next();
  } catch (error) {
    next(error);
  }
});

function flatten(value, lines = []) {
  if (typeof value === "string" || typeof value === "number")
    lines.push(String(value));
  else if (Array.isArray(value)) value.forEach((item) => flatten(item, lines));
  else if (value && typeof value === "object")
    Object.entries(value).forEach(([key, item]) => {
      lines.push(`${key}:`);
      flatten(item, lines);
    });
  return lines.join("\n").slice(0, 30000);
}

async function saveVersion(studentId, { title, content, file }) {
  return withTransaction(async (client) => {
    const saved = await client.query(
      `INSERT INTO resumes(student_id, title) VALUES($1,$2)
     ON CONFLICT(student_id) DO UPDATE SET title=EXCLUDED.title, updated_at=now()
     RETURNING id`,
      [studentId, title],
    );
    const resumeId = saved.rows[0].id;
    await client.query("SELECT id FROM resumes WHERE id=$1 FOR UPDATE", [
      resumeId,
    ]);
    const ver = await client.query(
      "SELECT COALESCE(MAX(version_number),0)+1 AS next FROM resume_versions WHERE resume_id=$1",
      [resumeId],
    );
    await client.query(
      "UPDATE resume_versions SET is_current=false WHERE resume_id=$1",
      [resumeId],
    );
    const result = await client.query(
      `INSERT INTO resume_versions(resume_id,version_number,content_json,original_filename,stored_path,mime_type,file_size_bytes,is_current)
     VALUES($1,$2,$3::jsonb,$4,$5,$6,$7,true) RETURNING id,version_number AS "versionNumber",created_at AS "createdAt"`,
      [
        resumeId,
        ver.rows[0].next,
        content ? JSON.stringify(content) : null,
        file?.originalname || null,
        file?.path || null,
        file?.mimetype || null,
        file?.size || null,
      ],
    );
    return { resumeId, version: result.rows[0] };
  });
}

async function analyzeSaved(request, version, textValue, file) {
  const provider = await getAIProvider();
  const consent = await query(
    "SELECT ai_data_consent FROM student_profiles WHERE user_id=$1",
    [request.user.id],
  );
  if (
    ["openai", "gemini"].includes(provider) &&
    !consent.rows[0]?.ai_data_consent
  ) {
    return {
      status: "skipped",
      provider,
      message:
        "Resume saved. Enable AI data processing consent in your profile before requesting external AI analysis.",
    };
  }
  const pending = await query(
    "INSERT INTO resume_analyses(resume_version_id,status,provider) VALUES($1,'pending',$2) RETURNING id",
    [version.id, provider],
  );
  try {
    const output = file
      ? await analyzeResumeFile(file, request.body.targetRole || "")
      : await analyzeResumeText(textValue, request.body.targetRole || "");
    await query(
      "UPDATE resume_analyses SET status='completed',score=$1,result_json=$2::jsonb,provider=$3 WHERE id=$4",
      [
        output.score,
        JSON.stringify(output),
        output.provider || provider,
        pending.rows[0].id,
      ],
    );
    return { status: "completed", ...output };
  } catch (error) {
    await query(
      "UPDATE resume_analyses SET status='failed',error_message=$1 WHERE id=$2",
      [error.message.slice(0, 500), pending.rows[0].id],
    );
    return {
      status: "failed",
      message: "Resume saved, but analysis could not finish. You can retry it.",
    };
  }
}

resumeRouter.get("/me", async (request, response) => {
  requireStudent(request.user);
  const result = await query(
    `SELECT r.id AS "resumeId",r.title,v.id AS "versionId",v.version_number AS "versionNumber",
      v.content_json AS content,v.original_filename AS "originalFilename",v.created_at AS "createdAt"
     FROM resumes r LEFT JOIN resume_versions v ON v.resume_id=r.id AND v.is_current=true
     WHERE r.student_id=$1`,
    [request.user.id],
  );
  const analyses = result.rows[0]?.versionId
    ? await query(
        `SELECT id,status,score,result_json AS result,provider,error_message AS "errorMessage",created_at AS "createdAt"
     FROM resume_analyses WHERE resume_version_id=$1 ORDER BY created_at DESC`,
        [result.rows[0].versionId],
      )
    : { rows: [] };
  response.json({ resume: result.rows[0] || null, analyses: analyses.rows });
});

resumeRouter.put("/me/builder", aiLimit, async (request, response) => {
  requireStudent(request.user);
  const title = text(request.body.title || "My Resume", "Title", { max: 160 });
  const content = request.body.content;
  if (!content || typeof content !== "object" || Array.isArray(content))
    throw new HttpError(400, "Resume content must be an object.");
  const resumeText = flatten(content);
  if (resumeText.length < 30)
    throw new HttpError(400, "Add more resume details before saving.");
  const saved = await saveVersion(request.user.id, { title, content });
  await recordAudit(request.user.id, "resume.saved", "resume", saved.resumeId, {
    source: "builder",
  });
  const analysis = await analyzeSaved(request, saved.version, resumeText, null);
  response.status(201).json({ ...saved, analysis });
});

resumeRouter.post(
  "/me/upload",
  aiLimit,
  resumeUpload.single("resume"),
  async (request, response) => {
    requireStudent(request.user);
    if (!request.file)
      throw new HttpError(400, "Choose a PDF or DOCX resume file.");
    const title = text(request.body.title || "Uploaded Resume", "Title", {
      max: 160,
    });
    const saved = await saveVersion(request.user.id, {
      title,
      file: request.file,
    });
    await recordAudit(
      request.user.id,
      "resume.uploaded",
      "resume",
      saved.resumeId,
      { filename: request.file.originalname },
    );
    const analysis = await analyzeSaved(
      request,
      saved.version,
      "",
      request.file,
    );
    response.status(201).json({ ...saved, analysis });
  },
);

resumeRouter.post("/me/analyze", aiLimit, async (request, response) => {
  requireStudent(request.user);
  const versionId = uuid(request.body.versionId, "Resume version ID");
  const result = await query(
    `SELECT v.*,r.student_id FROM resume_versions v JOIN resumes r ON r.id=v.resume_id WHERE v.id=$1`,
    [versionId],
  );
  if (!result.rows[0] || result.rows[0].student_id !== request.user.id)
    throw new HttpError(404, "Resume version not found.");
  const version = result.rows[0];
  let contentText = flatten(version.content_json);
  if (version.stored_path && fs.existsSync(version.stored_path)) {
    const output = await analyzeSaved(request, version, "", {
      path: version.stored_path,
      originalname: version.original_filename,
      mimetype: version.mime_type,
    });
    return response.json({ analysis: output });
  }
  const output = await analyzeSaved(request, version, contentText, null);
  response.json({ analysis: output });
});

resumeRouter.get("/me/versions", async (request, response) => {
  requireStudent(request.user);
  const result = await query(
    `SELECT v.id,v.version_number AS "versionNumber",v.original_filename AS "originalFilename",
    v.is_current AS "isCurrent",v.created_at AS "createdAt"
    FROM resume_versions v JOIN resumes r ON r.id=v.resume_id WHERE r.student_id=$1 ORDER BY v.version_number DESC`,
    [request.user.id],
  );
  response.json({ versions: result.rows });
});
