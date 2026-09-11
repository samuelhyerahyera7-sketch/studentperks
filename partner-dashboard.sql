-- ============================================================
-- StudentPerks Partner Dashboard — additive schema
-- Run this in: Supabase → SQL Editor → New query
-- Safe to run after setup.sql + production-hardening.sql.
-- Adds: vendor logo storage/column, and a place for vendors to
-- upload their own sales/redemption records for their account
-- manager to fold into their Analytics tab.
-- ============================================================

-- 1. Vendor logo column
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '';

-- 2. Vendor-uploaded files (their own data, for manual analytics review)
CREATE TABLE IF NOT EXISTS vendor_uploads (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id     UUID REFERENCES vendors(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  content_type  TEXT DEFAULT '',
  file_size     INTEGER DEFAULT 0,
  uploaded_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vendor_uploads ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: only the service role (used by the
-- api/vendor-* serverless functions, which check the vendor's signed
-- token themselves) can read or write this table.

-- 3. Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-logos', 'vendor-logos', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-uploads', 'vendor-uploads', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Logos are public (shown on deal cards site-wide) but only the
-- service role writes to the bucket — reads go through the public URL.
CREATE POLICY "anon_view_vendor_logos" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'vendor-logos');

-- vendor-uploads stays fully private: no anon/authenticated policy at
-- all, so only the service role (server-side) can read or write files.
