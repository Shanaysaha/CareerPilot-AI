import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { query } from "../db/pool.js";
import { HttpError } from "./errors.js";

// A token is accepted only while its matching database session is active.
// This lets logout revoke a JWT before its expiry time.
export async function authenticate(request, response, next) {
  try {
    const header = request.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token)
      throw new HttpError(401, "Sign in to continue.");

    const claims = jwt.verify(token, env.jwtSecret);
    const result = await query(
      `SELECT u.id, u.email, u.full_name, u.role, u.status
       FROM users u
       JOIN auth_sessions s ON s.user_id = u.id
       WHERE u.id = $1 AND s.id = $2 AND s.revoked_at IS NULL
         AND s.expires_at > now() AND u.status = 'active'`,
      [claims.sub, claims.jti],
    );
    if (!result.rowCount)
      throw new HttpError(401, "This session has expired. Sign in again.");
    request.user = result.rows[0];
    request.sessionId = claims.jti;
    next();
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    return next(
      new HttpError(401, "Your sign-in token is invalid or expired."),
    );
  }
}

export function requireRole(...allowedRoles) {
  // Restrict a route to the listed roles after authenticate has loaded the user.
  return (request, response, next) => {
    if (!request.user || !allowedRoles.includes(request.user.role)) {
      return next(new HttpError(403, "You do not have permission to do that."));
    }
    next();
  };
}
