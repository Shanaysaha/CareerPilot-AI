import { HttpError } from "../middleware/errors.js";

export function requireStudent(user) {
  // Block staff accounts from student-only profile and practice features.
  if (user.role !== "student")
    throw new HttpError(403, "This feature is for student accounts.");
}

export function requireOfficer(user) {
  // Allow placement officers and administrators into staff workflows.
  if (!["placement_officer", "administrator"].includes(user.role)) {
    throw new HttpError(403, "Placement staff access is required.");
  }
}

export function jsonObject(value, fallback = {}) {
  // Normalize PostgreSQL JSON values whether the driver returns text or an object.
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value || fallback;
}

export function scorePercent(correct, total) {
  // Convert a count of correct answers to a whole-number percentage.
  return total ? Math.round((correct / total) * 100) : 0;
}
