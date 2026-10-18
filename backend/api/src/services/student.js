import { HttpError } from "../middleware/errors.js";

export function requireStudent(user) {
  if (user.role !== "student")
    throw new HttpError(403, "This feature is for student accounts.");
}

export function requireOfficer(user) {
  if (!["placement_officer", "administrator"].includes(user.role)) {
    throw new HttpError(403, "Placement staff access is required.");
  }
}

export function jsonObject(value, fallback = {}) {
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
  return total ? Math.round((correct / total) * 100) : 0;
}
