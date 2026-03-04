-- Safe migration to enforce case/whitespace-insensitive unique emails on clients.
-- Target index:
--   CREATE UNIQUE INDEX ... ON clients (LOWER(TRIM(email)))
--
-- What this does:
-- 1) Creates an audit table to keep original values for changed rows.
-- 2) Rewrites duplicate emails (after LOWER(TRIM(email))) for non-canonical rows.
-- 3) Creates the normalized unique index.
--
-- Notes:
-- - Canonical row per duplicate group is the earliest created_at, then lowest id.
-- - Duplicate rows are rewritten with a +dup-<id> suffix.
-- - NULL/blank emails are ignored.

-- Optional: inspect duplicate groups first
-- SELECT LOWER(TRIM(email)) AS normalized_email, COUNT(*)
-- FROM clients
-- WHERE email IS NOT NULL AND BTRIM(email) <> ''
-- GROUP BY LOWER(TRIM(email))
-- HAVING COUNT(*) > 1
-- ORDER BY COUNT(*) DESC;

BEGIN;

-- Prevent concurrent execution of this migration logic.
SELECT pg_advisory_xact_lock(922337203685470001);

CREATE TABLE IF NOT EXISTS migration_clients_email_dedup_audit (
  audit_id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL,
  old_email TEXT NOT NULL,
  new_email TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

WITH ranked AS (
  SELECT
    id,
    email,
    LOWER(BTRIM(email)) AS normalized_email,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(BTRIM(email))
      ORDER BY created_at NULLS LAST, id
    ) AS rn
  FROM clients
  WHERE email IS NOT NULL
    AND BTRIM(email) <> ''
),
rewrites AS (
  SELECT
    r.id,
    r.email AS old_email,
    r.normalized_email,
    CASE
      WHEN POSITION('@' IN BTRIM(r.email)) > 1 THEN
        SPLIT_PART(BTRIM(r.email), '@', 1) || '+dup-' || r.id || '@' || SPLIT_PART(BTRIM(r.email), '@', 2)
      ELSE
        BTRIM(r.email) || '+dup-' || r.id
    END AS new_email
  FROM ranked r
  WHERE r.rn > 1
),
updated AS (
  UPDATE clients c
  SET email = rw.new_email
  FROM rewrites rw
  WHERE c.id = rw.id
  RETURNING c.id, rw.old_email, rw.new_email, rw.normalized_email
)
INSERT INTO migration_clients_email_dedup_audit (client_id, old_email, new_email, normalized_email)
SELECT id, old_email, new_email, normalized_email
FROM updated;

COMMIT;

-- Create index outside transaction to reduce lock impact.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS clients_email_normalized_key
  ON clients (LOWER(BTRIM(email)));

-- Optional: verify there are no remaining duplicate normalized emails
-- SELECT LOWER(BTRIM(email)) AS normalized_email, COUNT(*)
-- FROM clients
-- WHERE email IS NOT NULL AND BTRIM(email) <> ''
-- GROUP BY LOWER(BTRIM(email))
-- HAVING COUNT(*) > 1;