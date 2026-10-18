import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { env } from "../config/env.js";

const allowed = new Map([
  [".pdf", ["application/pdf"]],
  [
    ".docx",
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ],
]);

const storage = multer.diskStorage({
  destination(request, file, callback) {
    const folder = path.join(env.resumeStoragePath, request.user.id);
    fs.mkdir(folder, { recursive: true })
      .then(() => callback(null, folder))
      .catch(callback);
  },
  filename(request, file, callback) {
    callback(
      null,
      `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`,
    );
  },
});

export const resumeUpload = multer({
  storage,
  limits: { fileSize: env.maxResumeSizeBytes, files: 1 },
  fileFilter(request, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    const acceptedTypes = allowed.get(extension);
    if (!acceptedTypes || !acceptedTypes.includes(file.mimetype)) {
      return callback(new Error("Upload a PDF or DOCX resume."));
    }
    callback(null, true);
  },
});

export async function removeStoredFile(filePath) {
  if (!filePath) return;
  const resolved = path.resolve(filePath);
  const root = path.resolve(env.resumeStoragePath) + path.sep;
  if (!resolved.startsWith(root))
    throw new Error("Refusing to remove a file outside resume storage.");
  await fs.unlink(resolved).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
}
