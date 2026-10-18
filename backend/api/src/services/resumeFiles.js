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
  const resolved = await managedPath(filePath, false);
  await fs.unlink(resolved).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
}

export async function getStoredResumeFile(filePath) {
  return managedPath(filePath, true);
}

async function managedPath(filePath, mustExist) {
  const root = path.resolve(env.resumeStoragePath);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error("Refusing to access a file outside resume storage.");
  }
  if (!mustExist) {
    const rootReal = await fs.realpath(root);
    const parentReal = await fs.realpath(path.dirname(resolved));
    const checked = path.join(parentReal, path.basename(resolved));
    if (!checked.startsWith(rootReal + path.sep)) {
      throw new Error("Refusing to access a file outside resume storage.");
    }
    return checked;
  }
  const rootReal = await fs.realpath(root);
  const fileReal = await fs.realpath(resolved);
  if (!fileReal.startsWith(rootReal + path.sep)) {
    throw new Error("Refusing to access a file outside resume storage.");
  }
  return fileReal;
}
