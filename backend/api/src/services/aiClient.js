import { env } from "../config/env.js";

async function postJson(path, body) {
  const response = await fetch(`${env.aiServiceUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.aiServiceApiKey ? { "X-Internal-Key": env.aiServiceApiKey } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(50_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      data.detail || "The AI service did not complete the request.",
    );
  return data;
}

export async function getAIProvider() {
  try {
    const response = await fetch(`${env.aiServiceUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return "unavailable";
    const data = await response.json();
    return data.provider || "unavailable";
  } catch {
    return "unavailable";
  }
}

export function analyzeResumeText(resumeText, targetRole = "") {
  return postJson("/v1/resume/analyze", {
    resume_text: resumeText,
    target_role: targetRole,
  });
}

export async function analyzeResumeFile(file, targetRole = "") {
  const form = new FormData();
  const bytes = await import("node:fs/promises").then((fs) =>
    fs.readFile(file.path),
  );
  form.append(
    "file",
    new Blob([bytes], { type: file.mimetype }),
    file.originalname,
  );
  form.append("target_role", targetRole);
  const response = await fetch(`${env.aiServiceUrl}/v1/resume/analyze-file`, {
    method: "POST",
    headers: env.aiServiceApiKey
      ? { "X-Internal-Key": env.aiServiceApiKey }
      : {},
    body: form,
    signal: AbortSignal.timeout(50_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      data.detail || "The AI service did not complete the request.",
    );
  return data;
}

export function reviewInterviewAnswer(question, answer) {
  return postJson("/v1/interview/feedback", { question, answer });
}

export function recommendCareer(targetRole, currentSkills, missingSkills) {
  return postJson("/v1/career/recommendations", {
    target_role: targetRole,
    current_skills: currentSkills,
    missing_skills: missingSkills,
  });
}
