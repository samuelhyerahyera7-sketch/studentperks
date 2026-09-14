-- ============================================================
-- StudentPerks: add partner/vendor applications to the database
-- Run this once in: Supabase -> SQL Editor -> New query
--
-- Until now, the "List Your Deal" form on partner.html only emailed
-- admin@studentperks.co.za via formsubmit.co - it never wrote
-- anything to the database, so submissions could never show up in
-- the admin panel (and were silently lost entirely on a first-time
-- formsubmit.co destination address until its activation link is
-- confirmed - see partner.html's submit handler for that fix).
--
-- This creates a vendor_applications table so partner.html can save
-- every submission there too, and admin.html can list/review them
-- the same way it already does for student_applications.
--
-- Safe to re-run any time.
-- ============================================================

CREATE TABLE IF NOT EXISTS vendor_applications (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_name     TEXT NOT NULL,
  contact_name   TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT DEFAULT '',
  category       TEXT DEFAULT '',
  offer          TEXT DEFAULT '',
  description    TEXT DEFAULT '',
  website        TEXT DEFAULT '',
  expiry         TEXT DEFAULT '',
  extra          TEXT DEFAULT '',
  status         TEXT DEFAULT 'pending',
  admin_notes    TEXT DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at    TIMESTAMPTZ
);

ALTER TABLE vendor_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all" ON vendor_applications;

-- Matches the existing anon_all policy already used for vendors/
-- coupon_codes/redemptions in setup.sql - admin.html has no separate
-- privileged login, it uses this same public key for everything and
-- is protected at the app layer by the admin password gate instead.
CREATE POLICY "anon_all" ON vendor_applications FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
