-- Login security: attempt limits and hashed partner passwords.
-- Run once in the Supabase SQL editor. Safe to re-run.

-- Failed sign-in attempts (admin and partner), used to slow down guessing.
CREATE TABLE IF NOT EXISTS login_attempts (
  id          BIGSERIAL PRIMARY KEY,
  key         TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_key_time ON login_attempts (key, created_at);
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Partner passwords are stored hashed. Existing PINs are converted the next
-- time each partner signs in.
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS vendor_pin_hash TEXT;

-- Partner checkout codes are stored in app_settings under the key
-- "partner_codes" (set separately, never committed to this repository).
