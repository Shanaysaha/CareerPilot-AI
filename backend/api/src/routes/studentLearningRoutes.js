import { Router } from "express";
import { pool, query } from "../db/pool.js";
import { authenticate } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { HttpError } from "../middleware/errors.js";
import { integer, uuid } from "../middleware/validate.js";
import {
  reviewInterviewAnswer,
  getAIProvider,
  recommendCareer,
} from "../services/aiClient.js";
import { requireStudent, scorePercent } from "../services/studentHelpers.js";

export const learningRouter = Router();
learningRouter.use(authenticate);
const aiLimit = rateLimit({ limit: 30, windowMs: 60_000 });

learningRouter.get("/roles", async (req, res) => {
  const result = await query(
    "SELECT id,name,description FROM career_roles WHERE is_active=true ORDER BY name",
  );
  res.json({ roles: result.rows });
});
learningRouter.get("/skills", async (req, res) => {
  const result = await query(
    "SELECT id,name,category FROM skills WHERE is_active=true ORDER BY category,name",
  );
  res.json({ skills: result.rows });
});
learningRouter.get("/skills/me", async (req, res) => {
  requireStudent(req.user);
  const result = await query(
    `SELECT s.id,s.name,s.category,ss.proficiency FROM student_skills ss JOIN skills s ON s.id=ss.skill_id WHERE ss.student_id=$1 ORDER BY s.name`,
    [req.user.id],
  );
  res.json({ skills: result.rows });
});
learningRouter.put("/skills/me", async (req, res) => {
  requireStudent(req.user);
  if (!Array.isArray(req.body.skills) || req.body.skills.length > 100)
    throw new HttpError(400, "Provide a list of up to 100 skills.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM student_skills WHERE student_id=$1", [
      req.user.id,
    ]);
    for (const item of req.body.skills) {
      if (!item || typeof item !== "object" || Array.isArray(item))
        throw new HttpError(
          400,
          "Each skill must include an ID and proficiency.",
        );
      const id = uuid(item.id, "Skill ID"),
        level = integer(item.proficiency, "Proficiency", { min: 1, max: 5 });
      await client.query(
        `INSERT INTO student_skills(student_id,skill_id,proficiency) VALUES($1,$2,$3)`,
        [req.user.id, id, level],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  const result = await query(
    `SELECT s.id,s.name,s.category,ss.proficiency FROM student_skills ss JOIN skills s ON s.id=ss.skill_id WHERE ss.student_id=$1 ORDER BY s.name`,
    [req.user.id],
  );
  res.json({ skills: result.rows });
});
learningRouter.get("/skills/gaps", async (req, res) => {
  requireStudent(req.user);
  const result = await query(
    `SELECT cr.name AS "targetRole",s.id,s.name,s.category,rs.required_level AS "requiredLevel",COALESCE(ss.proficiency,0) AS "currentLevel",
  GREATEST(rs.required_level-COALESCE(ss.proficiency,0),0) AS "levelGap"
  FROM student_profiles sp JOIN career_roles cr ON cr.id=sp.target_role_id JOIN role_skills rs ON rs.role_id=cr.id JOIN skills s ON s.id=rs.skill_id LEFT JOIN student_skills ss ON ss.student_id=sp.user_id AND ss.skill_id=s.id WHERE sp.user_id=$1 AND cr.is_active=true AND s.is_active=true ORDER BY "levelGap" DESC,s.name`,
    [req.user.id],
  );
  res.json({ gaps: result.rows });
});
learningRouter.get("/career/recommendations", aiLimit, async (req, res) => {
  requireStudent(req.user);
  const gaps = await query(
    `SELECT cr.name AS role,s.name,COALESCE(ss.proficiency,0) AS level,rs.required_level AS required FROM student_profiles sp JOIN career_roles cr ON cr.id=sp.target_role_id JOIN role_skills rs ON rs.role_id=cr.id JOIN skills s ON s.id=rs.skill_id LEFT JOIN student_skills ss ON ss.student_id=sp.user_id AND ss.skill_id=s.id WHERE sp.user_id=$1 AND cr.is_active=true AND s.is_active=true`,
    [req.user.id],
  );
  const role = gaps.rows[0]?.role;
  if (!role)
    throw new HttpError(400, "Choose a target role in your profile first.");
  const consent = await query(
    "SELECT ai_data_consent FROM student_profiles WHERE user_id=$1",
    [req.user.id],
  );
  const provider = await getAIProvider();
  if (
    ["openai", "gemini"].includes(provider) &&
    !consent.rows[0]?.ai_data_consent
  )
    return res.json({
      provider: "local",
      recommendations: gaps.rows
        .filter((x) => x.level < x.required)
        .map((x) => ({
          skill: x.name,
          reason: `Build this skill for ${role}.`,
        })),
    });
  try {
    const result = await recommendCareer(
      role,
      gaps.rows.filter((x) => x.level > 0).map((x) => x.name),
      gaps.rows.filter((x) => x.level < x.required).map((x) => x.name),
    );
    res.json(result);
  } catch {
    res.json({
      provider: "local",
      recommendations: gaps.rows
        .filter((x) => x.level < x.required)
        .map((x) => ({
          skill: x.name,
          reason: `Build this skill for ${role}.`,
        })),
    });
  }
});
learningRouter.get("/resources", async (req, res) => {
  const result = await query(
    `SELECT lr.id,lr.title,lr.description,lr.url,lr.resource_type AS "resourceType",lr.difficulty,s.name AS skill,
  srp.status AS "myStatus" FROM learning_resources lr LEFT JOIN skills s ON s.id=lr.skill_id LEFT JOIN student_resource_progress srp ON srp.resource_id=lr.id AND srp.student_id=$1 WHERE lr.is_active=true ORDER BY s.name,lr.title`,
    [req.user.role === "student" ? req.user.id : null],
  );
  res.json({ resources: result.rows });
});
learningRouter.put("/resources/:id/progress", async (req, res) => {
  requireStudent(req.user);
  const id = uuid(req.params.id, "Resource ID"),
    status = req.body.status;
  if (!["saved", "in_progress", "completed"].includes(status))
    throw new HttpError(
      400,
      "Status must be saved, in_progress, or completed.",
    );
  const result = await query(
    `INSERT INTO student_resource_progress(student_id,resource_id,status) VALUES($1,$2,$3) ON CONFLICT(student_id,resource_id) DO UPDATE SET status=EXCLUDED.status,updated_at=now() RETURNING status,updated_at AS "updatedAt"`,
    [req.user.id, id, status],
  );
  res.json({ progress: result.rows[0] });
});

learningRouter.get("/interviews/questions", async (req, res) => {
  const result = await query(
    "SELECT id,question_text AS question,category,difficulty FROM interview_questions WHERE is_active=true ORDER BY category,difficulty",
  );
  res.json({ questions: result.rows });
});
learningRouter.post("/interviews", async (req, res) => {
  requireStudent(req.user);
  const type = req.body.type || "technical";
  if (!["technical", "behavioral", "mixed"].includes(type))
    throw new HttpError(400, "Interview type is invalid.");
  const result = await query(
    'INSERT INTO interview_sessions(student_id,interview_type) VALUES($1,$2) RETURNING id,status,started_at AS "startedAt"',
    [req.user.id, type],
  );
  res.status(201).json({ session: result.rows[0] });
});
learningRouter.post("/interviews/:id/responses", aiLimit, async (req, res) => {
  requireStudent(req.user);
  const sid = uuid(req.params.id, "Session ID"),
    qid = uuid(req.body.questionId, "Question ID"),
    answer = String(req.body.answer || "").trim();
  if (!answer || answer.length > 10000)
    throw new HttpError(400, "Answer must contain 1 to 10000 characters.");
  const session = await query(
    "SELECT id FROM interview_sessions WHERE id=$1 AND student_id=$2 AND status='in_progress'",
    [sid, req.user.id],
  );
  if (!session.rowCount)
    throw new HttpError(404, "Active interview session not found.");
  const question = await query(
    "SELECT question_text FROM interview_questions WHERE id=$1 AND is_active=true",
    [qid],
  );
  if (!question.rowCount) throw new HttpError(404, "Question not found.");
  let feedback = {
    provider: "local",
    score: Math.min(100, Math.max(20, Math.round(answer.length / 8))),
    feedback:
      "Answer saved. Consider using a clear example and explaining the result.",
  };
  const consent = await query(
    "SELECT ai_data_consent FROM student_profiles WHERE user_id=$1",
    [req.user.id],
  );
  const provider = await getAIProvider();
  if (
    ["openai", "gemini"].includes(provider) &&
    consent.rows[0]?.ai_data_consent
  ) {
    try {
      feedback = await reviewInterviewAnswer(
        question.rows[0].question_text,
        answer,
      );
    } catch {}
  }
  const result = await query(
    `INSERT INTO interview_responses(session_id,question_id,question_text,answer_text,score,feedback_json) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(session_id,question_id) DO UPDATE SET answer_text=EXCLUDED.answer_text,score=EXCLUDED.score,feedback_json=EXCLUDED.feedback_json RETURNING id,score,feedback_json AS feedback`,
    [
      sid,
      qid,
      question.rows[0].question_text,
      answer,
      feedback.score || null,
      JSON.stringify(feedback),
    ],
  );
  res.status(201).json({ response: result.rows[0] });
});
learningRouter.post("/interviews/:id/complete", async (req, res) => {
  requireStudent(req.user);
  const sid = uuid(req.params.id, "Session ID");
  const result = await query(
    `UPDATE interview_sessions SET status='completed',completed_at=now(),score=(SELECT round(avg(score))::int FROM interview_responses WHERE session_id=$1) WHERE id=$1 AND student_id=$2 AND status='in_progress' RETURNING id,status,score,completed_at AS "completedAt"`,
    [sid, req.user.id],
  );
  if (!result.rowCount)
    throw new HttpError(404, "Active interview session not found.");
  res.json({ session: result.rows[0] });
});
learningRouter.get("/interviews/history", async (req, res) => {
  requireStudent(req.user);
  const result = await query(
    'SELECT id,interview_type AS type,status,score,started_at AS "startedAt",completed_at AS "completedAt" FROM interview_sessions WHERE student_id=$1 ORDER BY started_at DESC',
    [req.user.id],
  );
  res.json({ sessions: result.rows });
});

learningRouter.get("/coding/problems", async (req, res) => {
  const result = await query(
    'SELECT id,title,prompt,difficulty,problem_type AS "problemType",options_json AS options FROM coding_problems WHERE is_active=true ORDER BY difficulty,title',
  );
  res.json({ problems: result.rows });
});
learningRouter.post("/coding/problems/:id/submissions", async (req, res) => {
  requireStudent(req.user);
  const id = uuid(req.params.id, "Problem ID"),
    answer = String(req.body.answer || "").trim();
  if (!answer || answer.length > 5000)
    throw new HttpError(400, "Answer must contain 1 to 5000 characters.");
  const problem = await query(
    'SELECT expected_answer,explanation,problem_type AS "problemType",options_json AS options FROM coding_problems WHERE id=$1 AND is_active=true',
    [id],
  );
  if (!problem.rowCount) throw new HttpError(404, "Problem not found.");
  const item = problem.rows[0];
  let normalizedAnswer = answer;
  let correct;
  if (item.problemType === "multiple_choice") {
    const optionIndex = Number(answer);
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= item.options.length) {
      throw new HttpError(400, "For multiple-choice problems, answer must be a valid zero-based option index.");
    }
    normalizedAnswer = String(optionIndex);
    correct = optionIndex === Number(item.expected_answer);
  } else {
    correct = answer.toLowerCase().replace(/\s+/g, " ") === item.expected_answer.toLowerCase().replace(/\s+/g, " ");
  }
  const result = await query(
    'INSERT INTO coding_submissions(student_id,problem_id,submitted_answer,is_correct) VALUES($1,$2,$3,$4) RETURNING id,is_correct AS correct,created_at AS "createdAt"',
    [req.user.id, id, normalizedAnswer, correct],
  );
  res.status(201).json({
    submission: result.rows[0],
    explanation: item.explanation,
  });
});
learningRouter.get("/coding/submissions", async (req, res) => {
  requireStudent(req.user);
  const result = await query(
    `SELECT cs.id,cp.title,cs.is_correct AS correct,cs.created_at AS "createdAt" FROM coding_submissions cs JOIN coding_problems cp ON cp.id=cs.problem_id WHERE cs.student_id=$1 ORDER BY cs.created_at DESC`,
    [req.user.id],
  );
  res.json({ submissions: result.rows });
});

learningRouter.get("/aptitude/tests", async (req, res) => {
  const result = await query(
    'SELECT id,title,description,company_name AS "companyName" FROM aptitude_tests WHERE is_active=true ORDER BY title',
  );
  res.json({ tests: result.rows });
});
learningRouter.post("/aptitude/tests/:id/attempts", async (req, res) => {
  requireStudent(req.user);
  const id = uuid(req.params.id, "Test ID"),
    test = await query(
      "SELECT id FROM aptitude_tests WHERE id=$1 AND is_active=true",
      [id],
    );
  if (!test.rowCount) throw new HttpError(404, "Test not found.");
  const result = await query(
    'INSERT INTO aptitude_attempts(student_id,test_id) VALUES($1,$2) RETURNING id,status,started_at AS "startedAt"',
    [req.user.id, id],
  );
  res.status(201).json({ attempt: result.rows[0] });
});
learningRouter.get("/aptitude/attempts/:id/questions", async (req, res) => {
  requireStudent(req.user);
  const id = uuid(req.params.id, "Attempt ID"),
    attempt = await query(
      "SELECT id,test_id FROM aptitude_attempts WHERE id=$1 AND student_id=$2 AND status='in_progress'",
      [id, req.user.id],
    );
  if (!attempt.rowCount) throw new HttpError(404, "Active attempt not found.");
  const questions = await query(
    'SELECT id,question_text AS question,options_json AS options,display_order AS "displayOrder" FROM aptitude_questions WHERE test_id=$1 AND is_active=true ORDER BY display_order',
    [attempt.rows[0].test_id],
  );
  res.json({ questions: questions.rows });
});
learningRouter.post("/aptitude/attempts/:id/submit", async (req, res) => {
  requireStudent(req.user);
  const id = uuid(req.params.id, "Attempt ID"),
    answers = req.body.answers;
  if (!Array.isArray(answers) || answers.length > 100)
    throw new HttpError(400, "Answers must be a list.");
  const client = await pool.connect();
  let score;
  try {
    await client.query("BEGIN");
    const attempt = await client.query(
      "SELECT test_id FROM aptitude_attempts WHERE id=$1 AND student_id=$2 AND status='in_progress' FOR UPDATE",
      [id, req.user.id],
    );
    if (!attempt.rowCount)
      throw new HttpError(404, "Active attempt not found.");
    const qs = await client.query(
      "SELECT id,correct_option_index,explanation,jsonb_array_length(options_json) AS option_count FROM aptitude_questions WHERE test_id=$1 AND is_active=true",
      [attempt.rows[0].test_id],
    );
    const validQuestions = new Map(qs.rows.map((question) => [question.id, question]));
    const supplied = new Map();
    for (const answer of answers) {
      if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
        throw new HttpError(400, "Each answer needs a question ID and selected option.");
      }
      const questionId = uuid(answer.questionId, "Question ID");
      const question = validQuestions.get(questionId);
      if (!question) throw new HttpError(400, "An answer refers to a question outside this test.");
      if (supplied.has(questionId)) throw new HttpError(400, "A question may only be answered once.");
      const selected = integer(answer.selectedOptionIndex, "Selected option", {
        min: 0,
        max: Math.max(0, question.option_count - 1),
      });
      supplied.set(questionId, selected);
    }
    let correct = 0;
    const results = [];
    for (const q of qs.rows) {
      const selected = supplied.get(q.id);
      const ok = selected === q.correct_option_index;
      if (ok) correct++;
      results.push({
        questionId: q.id,
        selectedOptionIndex: selected ?? null,
        correctOptionIndex: q.correct_option_index,
        isCorrect: ok,
        explanation: q.explanation,
      });
      await client.query(
        `INSERT INTO aptitude_answers(attempt_id,question_id,selected_option_index,is_correct) VALUES($1,$2,$3,$4) ON CONFLICT(attempt_id,question_id) DO UPDATE SET selected_option_index=EXCLUDED.selected_option_index,is_correct=EXCLUDED.is_correct`,
        [id, q.id, selected ?? null, ok],
      );
    }
    score = scorePercent(correct, qs.rowCount);
    const updated = await client.query(
      "UPDATE aptitude_attempts SET status='completed',score=$1,completed_at=now() WHERE id=$2 RETURNING id,status,score,completed_at AS \"completedAt\"",
      [score, id],
    );
    await client.query("COMMIT");
    res.json({ attempt: updated.rows[0], correct, total: qs.rowCount, results });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});
learningRouter.get("/aptitude/history", async (req, res) => {
  requireStudent(req.user);
  const result = await query(
    `SELECT aa.id,at.title,aa.status,aa.score,aa.started_at AS "startedAt",aa.completed_at AS "completedAt" FROM aptitude_attempts aa JOIN aptitude_tests at ON at.id=aa.test_id WHERE aa.student_id=$1 ORDER BY aa.started_at DESC`,
    [req.user.id],
  );
  res.json({ attempts: result.rows });
});
