-- Safe migration to enforce whitespace-insensitive unique contact numbers on clients.
-- Target index:
--   CREATE UNIQUE INDEX ... ON clients (BTRIM(contact_number))
--   WHERE contact_number IS NOT NULL AND BTRIM(contact_number) <> ''
--
-- What this does:
-- 1) Creates an audit table of rewritten contact numbers.
-- 2) Rewrites duplicate contact_number values (after BTRIM) for non-canonical rows.
-- 3) Recreates the normalized unique index as a partial index (ignores NULL/blank values).
--
-- Notes:
-- - Canonical row per duplicate group is the earliest created_at, then lowest id.
-- - Duplicate rows are rewritten with a -dup-<id> suffix.

-- Optional: inspect duplicates first
-- SELECT BTRIM(contact_number) AS normalized_contact_number, COUNT(*)
-- FROM clients
-- WHERE contact_number IS NOT NULL AND BTRIM(contact_number) <> ''
-- GROUP BY BTRIM(contact_number)
-- HAVING COUNT(*) > 1
-- ORDER BY COUNT(*) DESC;

BEGIN;

-- Prevent concurrent execution of this migration logic.
SELECT pg_advisory_xact_lock(922337203685470002);

CREATE TABLE IF NOT EXISTS migration_clients_contact_number_dedup_audit (
  audit_id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL,
  old_contact_number TEXT NOT NULL,
  new_contact_number TEXT NOT NULL,
  normalized_contact_number TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

WITH ranked AS (
  SELECT
    id,
    contact_number,
    BTRIM(contact_number) AS normalized_contact_number,
    ROW_NUMBER() OVER (
      PARTITION BY BTRIM(contact_number)
      ORDER BY created_at NULLS LAST, id
    ) AS rn
  FROM clients
  WHERE contact_number IS NOT NULL
    AND BTRIM(contact_number) <> ''
),
rewrites AS (
  SELECT
    r.id,
    r.contact_number AS old_contact_number,
    r.normalized_contact_number,
    BTRIM(r.contact_number) || '-dup-' || r.id AS new_contact_number
  FROM ranked r
  WHERE r.rn > 1
),
updated AS (
  UPDATE clients c
  SET contact_number = rw.new_contact_number
  FROM rewrites rw
  WHERE c.id = rw.id
  RETURNING c.id, rw.old_contact_number, rw.new_contact_number, rw.normalized_contact_number
)
INSERT INTO migration_clients_contact_number_dedup_audit (
  client_id,
  old_contact_number,
  new_contact_number,
  normalized_contact_number
)
SELECT id, old_contact_number, new_contact_number, normalized_contact_number
FROM updated;

COMMIT;

-- Recreate as partial unique index to ignore NULL/blank values.
DROP INDEX IF EXISTS clients_contact_number_normalized_key;
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS clients_contact_number_normalized_key
  ON clients (BTRIM(contact_number))
  WHERE contact_number IS NOT NULL AND BTRIM(contact_number) <> '';

-- Optional verification
-- SELECT BTRIM(contact_number) AS normalized_contact_number, COUNT(*)
-- FROM clients
-- WHERE contact_number IS NOT NULL AND BTRIM(contact_number) <> ''
-- GROUP BY BTRIM(contact_number)
-- HAVING COUNT(*) > 1;