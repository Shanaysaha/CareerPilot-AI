import { query } from "../db/pool.js";

export async function recordAudit(
  actorId,
  action,
  entityType,
  entityId = null,
  details = {},
) {
  // Save who changed what, with optional structured details for administrator review.
  await query(
    `INSERT INTO audit_events (actor_id, action, entity_type, entity_id, details_json)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [actorId || null, action, entityType, entityId, JSON.stringify(details)],
  );
}
