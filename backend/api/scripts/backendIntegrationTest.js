import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { pool } from "../src/db/pool.js";

const baseUrl = process.env.API_BASE_URL || "http://127.0.0.1:4000";
const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;
if (!adminEmail || !adminPassword) {
  throw new Error("Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD for the local integration smoke test.");
}

async function request(method, path, { body, token, expectedStatus } = {}) {
  // Send one API request and fail immediately when its response differs from expectation.
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = response.status === 204 ? null : await response.json();
  if (expectedStatus !== undefined) {
    assert.equal(response.status, expectedStatus, `${method} ${path}: ${JSON.stringify(data)}`);
  } else if (!response.ok) {
    throw new Error(`${method} ${path} returned ${response.status}: ${JSON.stringify(data)}`);
  }
  return { status: response.status, data };
}

const studentPassword = `Integration-${randomUUID()}-Pass!`;
const resetPassword = `Reset-${randomUUID()}-Pass!`;
const studentEmail = `student-${randomUUID()}@example.test`;
const laterStudentEmail = `student-${randomUUID()}@example.test`;
const cohortName = `Integration ${randomUUID()}`;
const otherCohortName = `Out of scope ${randomUUID()}`;
const officerEmail = `officer-${randomUUID()}@example.test`;
const officerPassword = `Officer-${randomUUID()}-Pass!`;
let adminToken;
let officerToken;
let studentToken;
let laterStudentToken;
let resetStudentToken;
let cohortId;
let otherCohortId;
let officerId;
let noticeId;
let officerNoticeId;
let codingProblemId;
let studentId;
let laterStudentId;
let deletedStudent = false;
let deletedLaterStudent = false;
const docxFixture = path.resolve(process.cwd(), "..", "..", ".local", "integration-resume.docx");

try {
  const health = await request("GET", "/api/health");
  assert.equal(health.data.database, "connected");

  const adminLogin = await request("POST", "/api/auth/login", {
    body: { email: adminEmail, password: adminPassword },
  });
  adminToken = adminLogin.data.accessToken;

  const cohort = await request("POST", "/api/officer/cohorts", {
    token: adminToken,
    body: { name: cohortName },
  });
  cohortId = cohort.data.cohort.id;
  const otherCohort = await request("POST", "/api/officer/cohorts", {
    token: adminToken,
    body: { name: otherCohortName },
  });
  otherCohortId = otherCohort.data.cohort.id;
  await request("PATCH", `/api/officer/cohorts/${cohortId}`, {
    token: adminToken,
    body: { isActive: false },
  });

  const officer = await request("POST", "/api/officer/users", {
    token: adminToken,
    body: { fullName: "Integration Officer", email: officerEmail, role: "placement_officer", temporaryPassword: officerPassword },
    expectedStatus: 201,
  });
  officerId = officer.data.user.id;
  await request("POST", `/api/officer/officers/${officerId}/cohorts`, {
    token: adminToken,
    body: { cohortId },
  });
  const officerLogin = await request("POST", "/api/auth/login", {
    body: { email: officerEmail, password: officerPassword },
  });
  officerToken = officerLogin.data.accessToken;
  assert.equal(officerLogin.data.user.role, "placement_officer");
  const officerCohorts = await request("GET", "/api/officer/cohorts", { token: officerToken });
  assert.ok(officerCohorts.data.cohorts.some((item) => item.id === cohortId));
  assert.equal(officerCohorts.data.cohorts.some((item) => item.id === otherCohortId), false);
  await request("GET", `/api/officer/cohorts/${otherCohortId}/students`, { token: officerToken, expectedStatus: 403 });
  await request("GET", "/api/admin/audit", { token: officerToken, expectedStatus: 403 });
  await request("PATCH", `/api/officer/cohorts/${cohortId}`, {
    token: adminToken,
    body: { isActive: true },
  });

  const notice = await request("POST", "/api/officer/notifications", {
    token: adminToken,
    body: { title: "Integration notice", body: "Cohort delivery smoke test.", cohortId, isPublished: false },
  });
  noticeId = notice.data.notification.id;
  await request("PATCH", `/api/officer/notifications/${noticeId}`, {
    token: adminToken,
    body: { title: "Integration notice", body: "Cohort delivery smoke test.", cohortId, isPublished: true },
  });

  const registration = await request("POST", "/api/auth/register", {
    body: {
      fullName: "Integration Student",
      email: studentEmail,
      password: studentPassword,
      cohortId: "untrusted-client-value",
    },
  });
  studentId = registration.data.user.id;
  studentToken = registration.data.accessToken;
  assert.equal(registration.data.user.role, "student");
  const profile = await request("GET", "/api/profile/me", { token: studentToken });
  assert.equal(profile.data.profile.cohortId, null);

  const roles = await request("GET", "/api/admin/catalog/roles", { token: adminToken });
  const roleId = roles.data.roles[0].id;
  await request("PUT", "/api/profile/me", {
    token: studentToken,
    body: { fullName: "Integration Student", course: "Computer Science", graduationYear: 2027, targetRoleId: roleId, preferences: {}, aiDataConsent: false },
  });
  const skills = await request("GET", "/api/skills", { token: studentToken });
  await request("PUT", "/api/skills/me", {
    token: studentToken,
    body: { skills: [{ id: skills.data.skills[0].id, proficiency: 5 }] },
  });

  const resume = await request("PUT", "/api/resume/me/builder", {
    token: studentToken,
    body: {
      title: "Integration Resume",
      content: { summary: "Computer science student with project and teamwork experience.", education: "Bachelors in Computer Science", skills: "JavaScript, SQL, teamwork", projects: "Built an employability planning project." },
    },
  });
  assert.equal(resume.data.analysis.status, "completed");

  const docxText = "Education experience projects skills Python SQL teamwork and communication. A detailed student resume with project work and measurable learning outcomes.";
  const python = process.env.PYTHON || path.resolve(process.cwd(), "..", "ai-service", ".venv", "Scripts", "python.exe");
  const makeDocx = "import sys,zipfile; z=zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED); z.writestr('word/document.xml','<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:r><w:t>'+sys.argv[2]+'</w:t></w:r></w:p></w:body></w:document>'); z.close()";
  execFileSync(python, ["-c", makeDocx, docxFixture, docxText]);
  const form = new FormData();
  form.append("title", "Uploaded integration resume");
  form.append("resume", new Blob([await readFile(docxFixture)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), "integration.docx");
  const uploadResponse = await fetch(`${baseUrl}/api/resume/me/upload`, { method: "POST", headers: { Authorization: `Bearer ${studentToken}` }, body: form });
  const uploadedResume = await uploadResponse.json();
  assert.equal(uploadResponse.status, 201, JSON.stringify(uploadedResume));
  assert.equal(uploadedResume.analysis.status, "completed");

  const interviewQuestions = await request("GET", "/api/interviews/questions", { token: studentToken });
  const interview = await request("POST", "/api/interviews", { token: studentToken, body: { type: "technical" } });
  await request("POST", `/api/interviews/${interview.data.session.id}/responses`, {
    token: studentToken,
    body: { questionId: interviewQuestions.data.questions[0].id, answer: "I would reproduce the problem, inspect logs, isolate the change, and verify the fix." },
  });
  await request("POST", `/api/interviews/${interview.data.session.id}/complete`, { token: studentToken, body: {} });

  const problem = await request("POST", "/api/admin/catalog/coding-problems", {
    token: adminToken,
    body: { title: "Integration MCQ", prompt: "Which option is true?", problemType: "multiple_choice", options: ["False", "True"], correctOptionIndex: 1, explanation: "True is correct." },
  });
  codingProblemId = problem.data.problem.id;
  const submission = await request("POST", `/api/coding/problems/${codingProblemId}/submissions`, {
    token: studentToken,
    body: { answer: "1" },
  });
  assert.equal(submission.data.submission.correct, true);

  const tests = await request("GET", "/api/aptitude/tests", { token: studentToken });
  const attempt = await request("POST", `/api/aptitude/tests/${tests.data.tests[0].id}/attempts`, { token: studentToken, body: {} });
  const questions = await request("GET", `/api/aptitude/attempts/${attempt.data.attempt.id}/questions`, { token: studentToken });
  assert.equal("correctOptionIndex" in questions.data.questions[0], false, "Student question payload must not reveal the answer key.");
  const correctByOrder = { 1: 1, 2: 3, 3: 2 };
  const answers = questions.data.questions.map((item) => ({ questionId: item.id, selectedOptionIndex: correctByOrder[item.displayOrder] ?? 0 }));
  const submitted = await request("POST", `/api/aptitude/attempts/${attempt.data.attempt.id}/submit`, {
    token: studentToken,
    body: { answers },
  });
  assert.equal(submitted.data.attempt.status, "completed");

  const laterRegistration = await request("POST", "/api/auth/register", {
    body: { fullName: "Later Cohort Student", email: laterStudentEmail, password: studentPassword },
  });
  laterStudentId = laterRegistration.data.user.id;
  laterStudentToken = laterRegistration.data.accessToken;
  await request("PATCH", `/api/officer/students/${laterStudentId}/cohort`, {
    token: adminToken,
    body: { cohortId },
  });
  const officerStudents = await request("GET", `/api/officer/cohorts/${cohortId}/students`, { token: officerToken });
  assert.ok(officerStudents.data.students.some((item) => item.id === laterStudentId));
  const officerDashboard = await request("GET", "/api/officer/dashboard", { token: officerToken });
  assert.ok(officerDashboard.data.cohorts.some((item) => item.cohortId === cohortId));
  assert.equal(officerDashboard.data.cohorts.some((item) => item.cohortId === otherCohortId), false);
  await request("GET", `/api/officer/reports/summary?cohortId=${cohortId}`, { token: officerToken });
  await request("GET", "/api/officer/notifications", { token: officerToken });
  await request("GET", `/api/officer/reports/summary?cohortId=${otherCohortId}`, { token: officerToken, expectedStatus: 403 });
  await request("POST", "/api/officer/notifications", {
    token: officerToken,
    body: { title: "Officer cohort notice", body: "Officer assigned-cohort publishing smoke test.", cohortId },
    expectedStatus: 201,
  }).then(({ data }) => { officerNoticeId = data.notification.id; });
  await request("POST", "/api/officer/notifications", {
    token: officerToken,
    body: { title: "Unauthorized global notice", body: "Should be rejected." },
    expectedStatus: 403,
  });
  const notifications = await request("GET", "/api/notifications", { token: laterStudentToken });
  assert.equal(notifications.data.notifications.some((item) => item.id === noticeId), true);
  assert.equal(notifications.data.notifications.some((item) => item.id === officerNoticeId), true);

  const readiness = await request("GET", "/api/readiness/me", { token: studentToken });
  assert.equal(readiness.data.complete, true);
  assert.ok(readiness.data.evidenceCount >= 3);
  assert.ok(readiness.data.score >= 0 && readiness.data.score <= 100);

  const reset = await request("POST", `/api/officer/users/${studentId}/password-reset`, { token: adminToken, body: {} });
  await request("POST", "/api/auth/password-reset", { body: { token: reset.data.resetToken, newPassword: resetPassword } });
  await request("GET", "/api/auth/me", { token: studentToken, expectedStatus: 401 });
  const relogin = await request("POST", "/api/auth/login", { body: { email: studentEmail, password: resetPassword } });
  resetStudentToken = relogin.data.accessToken;

  const versions = await request("GET", "/api/resume/me/versions", { token: resetStudentToken });
  assert.equal(versions.data.versions.length, 2);
  const uploadedVersion = versions.data.versions.find((item) => item.originalFilename === "integration.docx");
  const builderVersion = versions.data.versions.find((item) => item.originalFilename === null);
  assert.ok(uploadedVersion && builderVersion);
  const download = await fetch(`${baseUrl}/api/resume/me/versions/${uploadedVersion.id}/file`, { headers: { Authorization: `Bearer ${resetStudentToken}` } });
  assert.equal(download.status, 200);
  assert.ok((await download.arrayBuffer()).byteLength > 0);
  await request("DELETE", `/api/resume/me/versions/${uploadedVersion.id}`, { token: resetStudentToken });
  await request("DELETE", `/api/resume/me/versions/${builderVersion.id}`, { token: resetStudentToken });
  await request("DELETE", "/api/auth/account", { token: resetStudentToken, body: { password: resetPassword } });
  deletedStudent = true;
  await request("DELETE", "/api/auth/account", { token: laterStudentToken, body: { password: studentPassword } });
  deletedLaterStudent = true;

  console.log("Integration smoke test passed: database, student and placement-officer auth, officer cohort access controls, officer dashboard/reports/notices, auth/reset/revocation, profiles/skills, resume lifecycle, interview, coding MCQ, aptitude, readiness, notifications, and account deletion.");
} finally {
  try {
    if (!deletedStudent && resetStudentToken) {
      await request("DELETE", "/api/auth/account", { token: resetStudentToken, body: { password: resetPassword } });
    } else if (!deletedStudent && studentToken) {
      await request("DELETE", "/api/auth/account", { token: studentToken, body: { password: studentPassword } });
    }
  } catch {}
  try {
    if (!deletedLaterStudent && laterStudentToken) {
      await request("DELETE", "/api/auth/account", { token: laterStudentToken, body: { password: studentPassword } });
    }
  } catch {}
  if (officerId && adminToken) {
    await request("PATCH", `/api/officer/users/${officerId}/status`, {
      token: adminToken,
      body: { status: "disabled" },
    }).catch(() => {});
  }
  if (officerNoticeId) await pool.query("DELETE FROM notifications WHERE id=$1", [officerNoticeId]);
  if (noticeId) await pool.query("DELETE FROM notifications WHERE id=$1", [noticeId]);
  if (officerId) await pool.query("DELETE FROM users WHERE id=$1", [officerId]);
  if (cohortId) await pool.query("DELETE FROM cohorts WHERE id=$1", [cohortId]);
  if (otherCohortId) await pool.query("DELETE FROM cohorts WHERE id=$1", [otherCohortId]);
  if (codingProblemId) await pool.query("DELETE FROM coding_problems WHERE id=$1", [codingProblemId]);
  await unlink(docxFixture).catch(() => {});
  await pool.end();
}
