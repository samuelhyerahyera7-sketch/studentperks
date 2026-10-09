-- Student jobs posted by partners from the partner portal (Jobs tab).
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Only the site's server (service role key) reads and writes this table:
-- partners post through /api/vendor-jobs and the homepage lists live
-- jobs through /api/public-jobs, so no browser access is granted here.

CREATE TABLE IF NOT EXISTS jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id    UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  job_type     TEXT NOT NULL DEFAULT 'Part-time',
  location     TEXT NOT NULL DEFAULT '',
  pay          TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  apply_url    TEXT NOT NULL DEFAULT '',   -- a https:// link or an email address
  closes_on    DATE,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jobs_vendor_id_idx ON jobs (vendor_id);
CREATE INDEX IF NOT EXISTS jobs_active_idx ON jobs (active, created_at DESC);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
