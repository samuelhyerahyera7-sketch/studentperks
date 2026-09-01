-- ============================================================
-- StudentPerks Supabase Setup
-- Run this entire script in: Supabase → SQL Editor → New query
-- ============================================================

-- 1. TABLES

CREATE TABLE IF NOT EXISTS vendors (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name             TEXT NOT NULL,
  email            TEXT DEFAULT '',
  code_prefix      TEXT NOT NULL UNIQUE,
  discount_desc    TEXT DEFAULT '',
  vendor_pin       TEXT NOT NULL,
  active           BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS coupon_codes (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id           UUID REFERENCES vendors(id) ON DELETE CASCADE,
  vendor_name         TEXT DEFAULT '',
  code                TEXT NOT NULL UNIQUE,
  assigned_to_email   TEXT DEFAULT '',
  assigned_to_name    TEXT DEFAULT '',
  is_used             BOOLEAN DEFAULT FALSE,
  used_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_applications (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name        TEXT NOT NULL,
  personal_email   TEXT NOT NULL,
  student_email    TEXT DEFAULT '',
  institution      TEXT DEFAULT '',
  year_of_study    TEXT DEFAULT '',
  degree_course    TEXT DEFAULT '',
  student_number   TEXT DEFAULT '',
  referral_code    TEXT DEFAULT '',
  card_photo_url   TEXT DEFAULT '',
  status           TEXT DEFAULT 'pending',
  admin_notes      TEXT DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS redemptions (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code           TEXT NOT NULL,
  vendor_id      UUID REFERENCES vendors(id),
  vendor_name    TEXT DEFAULT '',
  student_email  TEXT DEFAULT '',
  redeemed_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ROW LEVEL SECURITY

ALTER TABLE vendors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_codes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemptions         ENABLE ROW LEVEL SECURITY;

-- Allow anon full access (protected at app layer by admin password + vendor PIN)
CREATE POLICY "anon_all" ON vendors             FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all" ON coupon_codes        FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all" ON student_applications FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "anon_all" ON redemptions         FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

-- 3. STORAGE BUCKET FOR STUDENT CARD PHOTOS

INSERT INTO storage.buckets (id, name, public)
VALUES ('student-cards', 'student-cards', TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "anon_upload" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'student-cards');

CREATE POLICY "anon_view" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'student-cards');
