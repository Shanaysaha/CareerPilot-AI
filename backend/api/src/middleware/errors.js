export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);

  // Translate common database and upload errors into helpful HTTP responses.
  if (error.code === "23505") {
    return response.status(409).json({ error: "That record already exists." });
  }
  if (error.code === "23503") {
    return response
      .status(400)
      .json({ error: "A related record does not exist." });
  }
  if (error.name === "MulterError") {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "The uploaded file is too large."
        : "The uploaded file could not be accepted.";
    return response.status(400).json({ error: message });
  }
  if (error.message === "Upload a PDF or DOCX resume.") {
    return response.status(400).json({ error: error.message });
  }

  const status = error.status || 500;
  if (status >= 500) console.error(error);
  return response.status(status).json({
    error:
      status >= 500 ? "Something went wrong on the server." : error.message,
  });
}
