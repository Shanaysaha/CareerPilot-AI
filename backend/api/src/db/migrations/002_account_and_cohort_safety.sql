-- Merge cohorts that differ only by NULL versus empty academic year before adding uniqueness.
CREATE TEMP TABLE cohort_merge_map ON COMMIT DROP AS
SELECT id,
       first_value(id) OVER (PARTITION BY name, COALESCE(academic_year, '') ORDER BY created_at, id) AS keeper_id,
       row_number() OVER (PARTITION BY name, COALESCE(academic_year, '') ORDER BY created_at, id) AS duplicate_order
FROM cohorts;

UPDATE student_profiles sp
SET cohort_id = m.keeper_id
FROM cohort_merge_map m
WHERE sp.cohort_id = m.id AND m.duplicate_order > 1;

UPDATE notifications n
SET cohort_id = m.keeper_id
FROM cohort_merge_map m
WHERE n.cohort_id = m.id AND m.duplicate_order > 1;

INSERT INTO officer_cohorts(officer_id, cohort_id)
SELECT oc.officer_id, m.keeper_id
FROM officer_cohorts oc
JOIN cohort_merge_map m ON m.id = oc.cohort_id
WHERE m.duplicate_order > 1
ON CONFLICT DO NOTHING;

DELETE FROM officer_cohorts oc
USING cohort_merge_map m
WHERE oc.cohort_id = m.id AND m.duplicate_order > 1;

DELETE FROM cohorts c
USING cohort_merge_map m
WHERE c.id = m.id AND m.duplicate_order > 1;

ALTER TABLE cohorts DROP CONSTRAINT IF EXISTS cohorts_name_academic_year_key;
CREATE UNIQUE INDEX IF NOT EXISTS cohorts_name_year_unique_idx
ON cohorts(name, (COALESCE(academic_year, '')));
ALTER TABLE cohorts ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE aptitude_questions ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Store only hashed, expiring, one-time password reset tokens.
CREATE TABLE password_reset_tokens (
  token_hash char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_user_idx ON password_reset_tokens(user_id, expires_at DESC);

-- Backfill delivery rows so existing students receive notices already published to them.
INSERT INTO notification_deliveries(notification_id, student_id)
SELECT n.id, sp.user_id
FROM notifications n
JOIN student_profiles sp ON (n.cohort_id IS NULL OR sp.cohort_id=n.cohort_id)
WHERE n.is_published=true AND n.archived_at IS NULL
ON CONFLICT DO NOTHING;
