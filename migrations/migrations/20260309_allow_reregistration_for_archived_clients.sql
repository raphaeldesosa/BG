ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_wallet_address_key;
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_dsj_number_key;

DROP INDEX IF EXISTS clients_wallet_address_key;
DROP INDEX IF EXISTS clients_dsj_number_key;
DROP INDEX IF EXISTS clients_wallet_address_normalized_key;
DROP INDEX IF EXISTS clients_email_normalized_key;
DROP INDEX IF EXISTS clients_contact_number_normalized_key;

CREATE UNIQUE INDEX IF NOT EXISTS clients_wallet_address_normalized_key
  ON clients (LOWER(TRIM(wallet_address)))
  WHERE (is_archived = FALSE OR is_archived IS NULL)
    AND wallet_address IS NOT NULL
    AND BTRIM(wallet_address) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS clients_dsj_number_key
  ON clients (BTRIM(dsj_number))
  WHERE (is_archived = FALSE OR is_archived IS NULL)
    AND dsj_number IS NOT NULL
    AND BTRIM(dsj_number) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS clients_email_normalized_key
  ON clients (LOWER(TRIM(email)))
  WHERE (is_archived = FALSE OR is_archived IS NULL)
    AND email IS NOT NULL
    AND BTRIM(email) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS clients_contact_number_normalized_key
  ON clients (BTRIM(contact_number))
  WHERE (is_archived = FALSE OR is_archived IS NULL)
    AND contact_number IS NOT NULL
    AND BTRIM(contact_number) <> '';