import { HttpError } from "./errors.js";

export function text(
  value,
  name,
  { min = 1, max = 5000, optional = false } = {},
) {
  if (optional && (value === undefined || value === null || value === ""))
    return "";
  if (typeof value !== "string")
    throw new HttpError(400, `${name} must be text.`);
  const cleaned = value.trim();
  if (cleaned.length < min || cleaned.length > max) {
    throw new HttpError(
      400,
      `${name} must be between ${min} and ${max} characters.`,
    );
  }
  return cleaned;
}

export function email(value) {
  const result = text(value, "Email", { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) {
    throw new HttpError(400, "Enter a valid email address.");
  }
  return result;
}

export function uuid(value, name = "ID") {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new HttpError(400, `${name} is invalid.`);
  }
  return value;
}

export function integer(value, name, { min = 0, max = 100 } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new HttpError(
      400,
      `${name} must be a whole number from ${min} to ${max}.`,
    );
  }
  return parsed;
}
