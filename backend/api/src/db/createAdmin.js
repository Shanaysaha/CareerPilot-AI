import bcrypt from "bcryptjs";
import { query } from "./pool.js";
import { email, text } from "../middleware/validate.js";
import { validateEnvironment } from "../config/env.js";

validateEnvironment();
// Create the first administrator from terminal-only environment variables.
const userEmail = email(process.env.ADMIN_EMAIL);
const fullName = text(process.env.ADMIN_NAME, "Admin name", { max: 120 });
const password = text(process.env.ADMIN_PASSWORD, "Admin password", {
  min: 12,
  max: 200,
});
if (Buffer.byteLength(password, "utf8") > 72) {
  throw new Error("ADMIN_PASSWORD must be no more than 72 UTF-8 bytes.");
}
const hash = await bcrypt.hash(password, 12);
const result = await query(
  `INSERT INTO users(email,password_hash,full_name,role) VALUES($1,$2,$3,'administrator') RETURNING id,email,full_name AS "fullName",role`,
  [userEmail, hash, fullName],
);
console.log(
  `Administrator created: ${result.rows[0].email} (${result.rows[0].id})`,
);
process.exit(0);
