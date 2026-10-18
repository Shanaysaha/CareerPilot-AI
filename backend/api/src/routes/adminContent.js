import { Router } from "express";
import { query, withTransaction } from "../db/pool.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { integer, text, uuid } from "../middleware/validate.js";
import { recordAudit } from "../services/audit.js";

export const adminContentRouter = Router();
adminContentRouter.use(authenticate, requireRole("administrator"));

adminContentRouter.get("/catalog/roles", async (_req, res) => {
  const result = await query("SELECT id,name,description,is_active AS \"isActive\" FROM career_roles ORDER BY name");
  res.json({ roles: result.rows });
});
adminContentRouter.get("/catalog/skills", async (_req, res) => {
  const result = await query("SELECT id,name,category,is_active AS \"isActive\" FROM skills ORDER BY category,name");
  res.json({ skills: result.rows });
});
adminContentRouter.get("/catalog/resources", async (_req, res) => {
  const result = await query(`SELECT id,title,description,url,skill_id AS "skillId",resource_type AS "resourceType",difficulty,is_active AS "isActive" FROM learning_resources ORDER BY title`);
  res.json({ resources: result.rows });
});
adminContentRouter.get("/catalog/interview-questions", async (_req, res) => {
  const result = await query(`SELECT id,question_text AS question,category,difficulty,is_active AS "isActive" FROM interview_questions ORDER BY category,question_text`);
  res.json({ questions: result.rows });
});
adminContentRouter.get("/catalog/coding-problems", async (_req, res) => {
  const result = await query(`SELECT id,title,prompt,difficulty,problem_type AS "problemType",options_json AS options,expected_answer AS "expectedAnswer",explanation,is_active AS "isActive" FROM coding_problems ORDER BY difficulty,title`);
  res.json({ problems: result.rows });
});
adminContentRouter.get("/catalog/aptitude-tests", async (_req, res) => {
  const result = await query(`SELECT id,title,description,company_name AS "companyName",is_active AS "isActive" FROM aptitude_tests ORDER BY title`);
  res.json({ tests: result.rows });
});
adminContentRouter.get("/catalog/aptitude-tests/:id/questions", async (req, res) => {
  const testId = uuid(req.params.id, "Test ID");
  const result = await query(`SELECT id,question_text AS question,options_json AS options,correct_option_index AS "correctOptionIndex",explanation,display_order AS "displayOrder",is_active AS "isActive" FROM aptitude_questions WHERE test_id=$1 ORDER BY display_order`, [testId]);
  res.json({ questions: result.rows });
});
adminContentRouter.get("/readiness-formulas", async (_req, res) => {
  const result = await query(`SELECT version,weights_json AS weights,minimum_evidence_json AS "minimumEvidence",is_active AS "isActive",created_at AS "createdAt" FROM readiness_formulas ORDER BY created_at DESC`);
  res.json({ formulas: result.rows });
});

function stringList(value, name, { min = 1, max = 20, itemMax = 300 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new HttpError(400, `${name} must contain ${min} to ${max} items.`);
  }
  return value.map((item) => text(item, name, { max: itemMax }));
}

// Career roles and the skills required for each role.
adminContentRouter.post("/catalog/roles", async (req, res) => {
  const name = text(req.body.name, "Role name", { max: 120 });
  const description = text(req.body.description || "", "Description", { max: 2000, optional: true });
  const result = await query(`INSERT INTO career_roles(name,description) VALUES($1,$2) RETURNING id,name,description,is_active AS "isActive"`, [name, description]);
  await recordAudit(req.user.id, "catalog.role_created", "career_role", result.rows[0].id);
  res.status(201).json({ role: result.rows[0] });
});
adminContentRouter.patch("/catalog/roles/:id", async (req, res) => {
  const id = uuid(req.params.id, "Role ID");
  const name = text(req.body.name, "Role name", { max: 120 });
  const description = text(req.body.description || "", "Description", { max: 2000, optional: true });
  if (req.body.isActive !== undefined && typeof req.body.isActive !== "boolean") throw new HttpError(400, "isActive must be true or false.");
  const result = await query(`UPDATE career_roles SET name=$1,description=$2,is_active=COALESCE($3::boolean,is_active) WHERE id=$4 RETURNING id,name,description,is_active AS "isActive"`, [name, description, req.body.isActive ?? null, id]);
  if (!result.rowCount) throw new HttpError(404, "Career role not found.");
  await recordAudit(req.user.id, "catalog.role_updated", "career_role", id);
  res.json({ role: result.rows[0] });
});
adminContentRouter.put("/catalog/roles/:roleId/skills/:skillId", async (req, res) => {
  const roleId = uuid(req.params.roleId, "Role ID"), skillId = uuid(req.params.skillId, "Skill ID");
  const level = integer(req.body.requiredLevel, "Required level", { min: 1, max: 5 });
  await query(`INSERT INTO role_skills(role_id,skill_id,required_level) VALUES($1,$2,$3) ON CONFLICT(role_id,skill_id) DO UPDATE SET required_level=EXCLUDED.required_level`, [roleId, skillId, level]);
  await recordAudit(req.user.id, "catalog.role_skill_set", "career_role", roleId, { skillId, requiredLevel: level });
  res.json({ roleId, skillId, requiredLevel: level });
});
adminContentRouter.delete("/catalog/roles/:roleId/skills/:skillId", async (req, res) => {
  const roleId = uuid(req.params.roleId, "Role ID"), skillId = uuid(req.params.skillId, "Skill ID");
  await query("DELETE FROM role_skills WHERE role_id=$1 AND skill_id=$2", [roleId, skillId]);
  await recordAudit(req.user.id, "catalog.role_skill_removed", "career_role", roleId, { skillId });
  res.sendStatus(204);
});

// Skill catalog. Retire used skills instead of deleting them from past data.
adminContentRouter.post("/catalog/skills", async (req, res) => {
  const name = text(req.body.name, "Skill name", { max: 100 });
  const category = text(req.body.category || "general", "Category", { max: 80 });
  const result = await query(`INSERT INTO skills(name,category) VALUES($1,$2) RETURNING id,name,category,is_active AS "isActive"`, [name, category]);
  await recordAudit(req.user.id, "catalog.skill_created", "skill", result.rows[0].id);
  res.status(201).json({ skill: result.rows[0] });
});
adminContentRouter.patch("/catalog/skills/:id", async (req, res) => {
  const id = uuid(req.params.id, "Skill ID"), name = text(req.body.name, "Skill name", { max: 100 }), category = text(req.body.category || "general", "Category", { max: 80 });
  if (req.body.isActive !== undefined && typeof req.body.isActive !== "boolean") throw new HttpError(400, "isActive must be true or false.");
  const result = await query(`UPDATE skills SET name=$1,category=$2,is_active=COALESCE($3::boolean,is_active) WHERE id=$4 RETURNING id,name,category,is_active AS "isActive"`, [name, category, req.body.isActive ?? null, id]);
  if (!result.rowCount) throw new HttpError(404, "Skill not found.");
  await recordAudit(req.user.id, "catalog.skill_updated", "skill", id);
  res.json({ skill: result.rows[0] });
});

// Curated links and practice catalogs.
adminContentRouter.post("/catalog/resources", async (req, res) => {
  const title = text(req.body.title, "Title", { max: 200 }), description = text(req.body.description || "", "Description", { max: 2000, optional: true }), url = text(req.body.url, "URL", { max: 2000 });
  if (!/^https:\/\//i.test(url)) throw new HttpError(400, "Resource links must use HTTPS.");
  const skillId = req.body.skillId ? uuid(req.body.skillId, "Skill ID") : null;
  const resourceType = text(req.body.resourceType || "article", "Resource type", { max: 40 }), difficulty = text(req.body.difficulty || "beginner", "Difficulty", { max: 40 });
  const result = await query(`INSERT INTO learning_resources(title,description,url,skill_id,resource_type,difficulty) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,title,description,url,skill_id AS "skillId",resource_type AS "resourceType",difficulty,is_active AS "isActive"`, [title, description, url, skillId, resourceType, difficulty]);
  await recordAudit(req.user.id, "catalog.resource_created", "learning_resource", result.rows[0].id);
  res.status(201).json({ resource: result.rows[0] });
});
adminContentRouter.patch("/catalog/resources/:id", async (req, res) => {
  const id = uuid(req.params.id, "Resource ID"), title = text(req.body.title, "Title", { max: 200 }), description = text(req.body.description || "", "Description", { max: 2000, optional: true }), url = text(req.body.url, "URL", { max: 2000 });
  if (!/^https:\/\//i.test(url)) throw new HttpError(400, "Resource links must use HTTPS.");
  const skillId = req.body.skillId ? uuid(req.body.skillId, "Skill ID") : null;
  const resourceType = text(req.body.resourceType || "article", "Resource type", { max: 40 }), difficulty = text(req.body.difficulty || "beginner", "Difficulty", { max: 40 });
  if (req.body.isActive !== undefined && typeof req.body.isActive !== "boolean") throw new HttpError(400, "isActive must be true or false.");
  const result = await query(`UPDATE learning_resources SET title=$1,description=$2,url=$3,skill_id=$4,resource_type=$5,difficulty=$6,is_active=COALESCE($7::boolean,is_active) WHERE id=$8 RETURNING id,title,description,url,skill_id AS "skillId",resource_type AS "resourceType",difficulty,is_active AS "isActive"`, [title, description, url, skillId, resourceType, difficulty, req.body.isActive ?? null, id]);
  if (!result.rowCount) throw new HttpError(404, "Learning resource not found.");
  await recordAudit(req.user.id, "catalog.resource_updated", "learning_resource", id);
  res.json({ resource: result.rows[0] });
});

adminContentRouter.post("/catalog/interview-questions", async (req, res) => {
  const question = text(req.body.question, "Question", { max: 2000 }), category = text(req.body.category || "general", "Category", { max: 80 }), difficulty = text(req.body.difficulty || "beginner", "Difficulty", { max: 40 });
  const result = await query(`INSERT INTO interview_questions(question_text,category,difficulty) VALUES($1,$2,$3) RETURNING id,question_text AS question,category,difficulty,is_active AS "isActive"`, [question, category, difficulty]);
  await recordAudit(req.user.id, "catalog.interview_question_created", "interview_question", result.rows[0].id);
  res.status(201).json({ question: result.rows[0] });
});
adminContentRouter.patch("/catalog/interview-questions/:id", async (req, res) => {
  const id = uuid(req.params.id, "Question ID"), question = text(req.body.question, "Question", { max: 2000 }), category = text(req.body.category || "general", "Category", { max: 80 }), difficulty = text(req.body.difficulty || "beginner", "Difficulty", { max: 40 });
  if (req.body.isActive !== undefined && typeof req.body.isActive !== "boolean") throw new HttpError(400, "isActive must be true or false.");
  const result = await query(`UPDATE interview_questions SET question_text=$1,category=$2,difficulty=$3,is_active=COALESCE($4::boolean,is_active) WHERE id=$5 RETURNING id,question_text AS question,category,difficulty,is_active AS "isActive"`, [question, category, difficulty, req.body.isActive ?? null, id]);
  if (!result.rowCount) throw new HttpError(404, "Interview question not found.");
  await recordAudit(req.user.id, "catalog.interview_question_updated", "interview_question", id);
  res.json({ question: result.rows[0] });
});

adminContentRouter.post("/catalog/coding-problems", async (req, res) => {
  const title = text(req.body.title, "Title", { max: 200 }), prompt = text(req.body.prompt, "Prompt", { max: 5000 }), expected = text(req.body.expectedAnswer, "Expected answer", { max: 5000 }), explanation = text(req.body.explanation || "", "Explanation", { max: 3000, optional: true });
  const difficulty = text(req.body.difficulty || "beginner", "Difficulty", { max: 40 }), problemType = req.body.problemType || "short_answer";
  if (!["short_answer", "multiple_choice"].includes(problemType)) throw new HttpError(400, "Problem type is invalid.");
  const options = problemType === "multiple_choice" ? stringList(req.body.options, "Options", { min: 2, max: 8, itemMax: 300 }) : [];
  if (problemType === "multiple_choice") integer(req.body.correctOptionIndex, "Correct option", { min: 0, max: options.length - 1 });
  const expectedAnswer = problemType === "multiple_choice" ? String(req.body.correctOptionIndex) : expected;
  const result = await query(`INSERT INTO coding_problems(title,prompt,difficulty,problem_type,options_json,expected_answer,explanation) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7) RETURNING id,title,prompt,difficulty,problem_type AS "problemType",options_json AS options,is_active AS "isActive"`, [title, prompt, difficulty, problemType, JSON.stringify(options), expectedAnswer, explanation]);
  await recordAudit(req.user.id, "catalog.coding_problem_created", "coding_problem", result.rows[0].id);
  res.status(201).json({ problem: result.rows[0] });
});
adminContentRouter.patch("/catalog/coding-problems/:id", async (req, res) => {
  const id = uuid(req.params.id, "Problem ID");
  const currentResult = await query("SELECT * FROM coding_problems WHERE id=$1", [id]);
  if (!currentResult.rowCount) throw new HttpError(404, "Coding problem not found.");
  const current = currentResult.rows[0];
  const contentFields = ["title", "prompt", "difficulty", "problemType", "options", "expectedAnswer", "correctOptionIndex", "explanation"];
  const contentChanged = contentFields.some((field) => req.body[field] !== undefined);
  if (req.body.isActive !== undefined && typeof req.body.isActive !== "boolean") throw new HttpError(400, "isActive must be true or false.");
  const existingSubmissions = await query("SELECT 1 FROM coding_submissions WHERE problem_id=$1 LIMIT 1", [id]);
  if (existingSubmissions.rowCount && contentChanged) throw new HttpError(409, "Problem content with submission history is locked. Create a new problem to change it.");
  const title = req.body.title === undefined ? current.title : text(req.body.title, "Title", { max: 200 });
  const prompt = req.body.prompt === undefined ? current.prompt : text(req.body.prompt, "Prompt", { max: 5000 });
  const difficulty = req.body.difficulty === undefined ? current.difficulty : text(req.body.difficulty, "Difficulty", { max: 40 });
  const problemType = req.body.problemType === undefined ? current.problem_type : req.body.problemType;
  if (!["short_answer", "multiple_choice"].includes(problemType)) throw new HttpError(400, "Problem type is invalid.");
  const options = req.body.options === undefined
    ? current.options_json
    : problemType === "multiple_choice" ? stringList(req.body.options, "Options", { min: 2, max: 8, itemMax: 300 }) : [];
  if (problemType === "multiple_choice" && (!Array.isArray(options) || options.length < 2 || options.length > 8)) throw new HttpError(400, "Multiple-choice problems need 2 to 8 options.");
  const correctOptionIndex = req.body.correctOptionIndex === undefined ? Number(current.expected_answer) : integer(req.body.correctOptionIndex, "Correct option", { min: 0, max: options.length - 1 });
  let expectedAnswer;
  if (problemType === "multiple_choice") {
    if (!Number.isInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex >= options.length) throw new HttpError(400, "Correct option must refer to an available option.");
    expectedAnswer = String(correctOptionIndex);
  } else {
    expectedAnswer = req.body.expectedAnswer === undefined ? current.expected_answer : text(req.body.expectedAnswer, "Expected answer", { max: 5000 });
  }
  const explanation = req.body.explanation === undefined ? current.explanation : text(req.body.explanation, "Explanation", { max: 3000, optional: true });
  const result = await query(`UPDATE coding_problems SET title=$1,prompt=$2,difficulty=$3,problem_type=$4,options_json=$5::jsonb,expected_answer=$6,explanation=$7,is_active=COALESCE($8::boolean,is_active) WHERE id=$9 RETURNING id,title,prompt,difficulty,problem_type AS "problemType",options_json AS options,is_active AS "isActive"`, [title, prompt, difficulty, problemType, JSON.stringify(options), expectedAnswer, explanation, req.body.isActive ?? null, id]);
  await recordAudit(req.user.id, "catalog.coding_problem_updated", "coding_problem", id, { isActive: req.body.isActive });
  res.json({ problem: result.rows[0] });
});

adminContentRouter.post("/catalog/aptitude-tests", async (req, res) => {
  const title = text(req.body.title, "Title", { max: 200 }), description = text(req.body.description || "", "Description", { max: 2000, optional: true }), companyName = text(req.body.companyName || "", "Company name", { max: 120, optional: true });
  const result = await query(`INSERT INTO aptitude_tests(title,description,company_name) VALUES($1,$2,$3) RETURNING id,title,description,company_name AS "companyName",is_active AS "isActive"`, [title, description, companyName || null]);
  await recordAudit(req.user.id, "catalog.aptitude_test_created", "aptitude_test", result.rows[0].id);
  res.status(201).json({ test: result.rows[0] });
});
adminContentRouter.patch("/catalog/aptitude-tests/:id", async (req, res) => {
  const id = uuid(req.params.id, "Test ID"), title = text(req.body.title, "Title", { max: 200 }), description = text(req.body.description || "", "Description", { max: 2000, optional: true }), companyName = text(req.body.companyName || "", "Company name", { max: 120, optional: true });
  if (req.body.isActive !== undefined && typeof req.body.isActive !== "boolean") throw new HttpError(400, "isActive must be true or false.");
  const result = await query(`UPDATE aptitude_tests SET title=$1,description=$2,company_name=$3,is_active=COALESCE($4::boolean,is_active) WHERE id=$5 RETURNING id,title,description,company_name AS "companyName",is_active AS "isActive"`, [title, description, companyName || null, req.body.isActive ?? null, id]);
  if (!result.rowCount) throw new HttpError(404, "Aptitude test not found.");
  await recordAudit(req.user.id, "catalog.aptitude_test_updated", "aptitude_test", id);
  res.json({ test: result.rows[0] });
});
adminContentRouter.post("/catalog/aptitude-tests/:id/questions", async (req, res) => {
  const testId = uuid(req.params.id, "Test ID"), question = text(req.body.question, "Question", { max: 2000 }), explanation = text(req.body.explanation || "", "Explanation", { max: 3000, optional: true });
  const options = stringList(req.body.options, "Options", { min: 2, max: 8, itemMax: 300 }), correct = integer(req.body.correctOptionIndex, "Correct option", { min: 0, max: options.length - 1 }), displayOrder = integer(req.body.displayOrder ?? 1, "Display order", { min: 1, max: 1000 });
  const result = await query(`INSERT INTO aptitude_questions(test_id,question_text,options_json,correct_option_index,explanation,display_order) VALUES($1,$2,$3::jsonb,$4,$5,$6) RETURNING id,test_id AS "testId",question_text AS question,options_json AS options,correct_option_index AS "correctOptionIndex",explanation,display_order AS "displayOrder"`, [testId, question, JSON.stringify(options), correct, explanation, displayOrder]);
  await recordAudit(req.user.id, "catalog.aptitude_question_created", "aptitude_question", result.rows[0].id, { testId });
  res.status(201).json({ question: result.rows[0] });
});
adminContentRouter.patch("/catalog/aptitude-questions/:id", async (req, res) => {
  const id = uuid(req.params.id, "Question ID");
  const current = await query("SELECT * FROM aptitude_questions WHERE id=$1", [id]);
  if (!current.rowCount) throw new HttpError(404, "Aptitude question not found.");
  const attempts = await query("SELECT 1 FROM aptitude_attempts WHERE test_id=$1 LIMIT 1", [current.rows[0].test_id]);
  const contentFields = ["question", "explanation", "options", "correctOptionIndex", "displayOrder"];
  const contentChanged = contentFields.some((field) => req.body[field] !== undefined);
  if (attempts.rowCount && contentChanged) throw new HttpError(409, "Questions for a test with attempt history are locked. Create a new test to change its content.");
  if (req.body.isActive !== undefined && typeof req.body.isActive !== "boolean") throw new HttpError(400, "isActive must be true or false.");
  if (!contentChanged && req.body.isActive === undefined) throw new HttpError(400, "Provide a question field to update.");
  const previous = current.rows[0];
  const question = req.body.question === undefined ? previous.question_text : text(req.body.question, "Question", { max: 2000 });
  const explanation = req.body.explanation === undefined ? previous.explanation : text(req.body.explanation, "Explanation", { max: 3000, optional: true });
  const options = req.body.options === undefined ? previous.options_json : stringList(req.body.options, "Options", { min: 2, max: 8, itemMax: 300 });
  const correct = req.body.correctOptionIndex === undefined ? previous.correct_option_index : integer(req.body.correctOptionIndex, "Correct option", { min: 0, max: options.length - 1 });
  if (correct >= options.length) throw new HttpError(400, "Correct option must refer to an available option.");
  const displayOrder = req.body.displayOrder === undefined ? previous.display_order : integer(req.body.displayOrder, "Display order", { min: 1, max: 1000 });
  const result = await query(`UPDATE aptitude_questions SET question_text=$1,options_json=$2::jsonb,correct_option_index=$3,explanation=$4,display_order=$5,is_active=COALESCE($6::boolean,is_active) WHERE id=$7 RETURNING id,test_id AS "testId",question_text AS question,options_json AS options,correct_option_index AS "correctOptionIndex",explanation,display_order AS "displayOrder",is_active AS "isActive"`, [question, JSON.stringify(options), correct, explanation, displayOrder, req.body.isActive ?? null, id]);
  await recordAudit(req.user.id, "catalog.aptitude_question_updated", "aptitude_question", id);
  res.json({ question: result.rows[0] });
});

adminContentRouter.put("/readiness-formulas/:version", async (req, res) => {
  const version = text(req.params.version, "Formula version", { max: 40 });
  const weights = req.body.weights, minimum = req.body.minimumEvidence;
  const keys = ["resume", "skills", "interview", "coding", "aptitude"];
  if (!weights || typeof weights !== "object" || Array.isArray(weights) || keys.some((key) => typeof weights[key] !== "number" || weights[key] < 0) || Math.abs(keys.reduce((sum, key) => sum + weights[key], 0) - 1) > 0.001) throw new HttpError(400, "Provide non-negative category weights that sum to 1.");
  if (!minimum || typeof minimum !== "object" || Array.isArray(minimum)) throw new HttpError(400, "minimumEvidence must be an object.");
  const count = integer(minimum.count, "Minimum evidence count", { min: 1, max: 5 });
  const result = await withTransaction(async (client) => {
    await client.query("UPDATE readiness_formulas SET is_active=false");
    return client.query(`INSERT INTO readiness_formulas(version,weights_json,minimum_evidence_json,is_active) VALUES($1,$2::jsonb,$3::jsonb,true) RETURNING version,weights_json AS weights,minimum_evidence_json AS "minimumEvidence",is_active AS "isActive"`, [version, JSON.stringify(weights), JSON.stringify({ count })]);
  });
  await recordAudit(req.user.id, "readiness.formula_changed", "readiness_formula", null, { version });
  res.json({ formula: result.rows[0] });
});
