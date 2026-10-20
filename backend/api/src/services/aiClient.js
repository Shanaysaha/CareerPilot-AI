import { env } from "../config/env.js";

async function postJson(path, body) {
  // Send a signed internal JSON request to the private FastAPI service.
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
  // Read the provider name for UI/status messages without failing the API if AI is down.
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
  // Ask the AI service to review resume text supplied by the student.
  return postJson("/v1/resume/analyze", {
    resume_text: resumeText,
    target_role: targetRole,
  });
}

export async function analyzeResumeFile(file, targetRole = "") {
  // Forward an uploaded PDF/DOCX file so the AI service can extract and review it.
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
  // Request practice feedback for one interview answer.
  return postJson("/v1/interview/feedback", { question, answer });
}

export function recommendCareer(targetRole, currentSkills, missingSkills) {
  // Turn the selected career role and skill gaps into learning suggestions.
  return postJson("/v1/career/recommendations", {
    target_role: targetRole,
    current_skills: currentSkills,
    missing_skills: missingSkills,
  });
}
