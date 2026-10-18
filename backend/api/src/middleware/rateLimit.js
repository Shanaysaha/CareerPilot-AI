const windows = new Map();

// Small per-process limiter for login and AI endpoints. A production deployment
// with multiple API servers should move this counter to shared infrastructure.
export function rateLimit({ limit = 10, windowMs = 60_000 } = {}) {
  return (request, response, next) => {
    const route = request.route?.path || request.path;
    const key = `${request.ip}:${request.method}:${request.baseUrl}${route}`;
    const now = Date.now();
    let bucket = windows.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      windows.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      return response
        .status(429)
        .json({ error: "Too many requests. Please wait and try again." });
    }
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of windows)
    if (now >= bucket.resetAt) windows.delete(key);
}, 60_000).unref();
