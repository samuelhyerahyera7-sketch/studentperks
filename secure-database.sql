-- ============================================================
-- StudentPerks: close the database to the public.
-- Run once in the Supabase SQL editor (safe to re-run).
--
-- Before this, anyone with the site's public key could read (and change)
-- student details, partner PINs and codes. After it:
--   * the site's server (service role key) does everything for admin,
--     partners and deal codes, as it already does since this update;
--   * the public can only ADD a pending student application, ADD a
--     partner application and UPLOAD a student card;
--   * a signed-in student can read only their own application, codes
--     and redemptions;
--   * student cards are private (admin sees them via temporary links).
-- ============================================================

-- 1. Remove every existing rule on these tables, whatever it is called.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('vendors','coupon_codes','student_applications','redemptions',
                        'vendor_applications','saved_offers','jobs','deal_events','app_settings')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 2. Admin password storage (used by the admin page's "Change password").
CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which student received a deal code (recorded by the server).
ALTER TABLE deal_events ADD COLUMN IF NOT EXISTS student_email TEXT NOT NULL DEFAULT '';

-- 3. Row level security on, for every table that exists.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vendors','coupon_codes','student_applications','redemptions',
                           'vendor_applications','saved_offers','jobs','deal_events','app_settings']
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- 4. The only things the public may do.
CREATE POLICY "public_insert_pending_student_application"
  ON student_applications FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending');

CREATE POLICY "public_insert_partner_application"
  ON vendor_applications FOR INSERT TO anon, authenticated
  WITH CHECK (COALESCE(status, 'pending') = 'pending');

-- 5. Signed-in students read only their own rows.
CREATE POLICY "student_read_own_application"
  ON student_applications FOR SELECT TO authenticated
  USING (lower(personal_email) = lower(auth.jwt() ->> 'email')
      OR lower(student_email)  = lower(auth.jwt() ->> 'email'));

CREATE POLICY "student_read_own_codes"
  ON coupon_codes FOR SELECT TO authenticated
  USING (lower(assigned_to_email) = lower(auth.jwt() ->> 'email'));

CREATE POLICY "student_read_own_redemptions"
  ON redemptions FOR SELECT TO authenticated
  USING (lower(student_email) = lower(auth.jwt() ->> 'email'));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'saved_offers' AND column_name = 'student_email') THEN
    EXECUTE 'CREATE POLICY "student_read_own_saved_offers" ON saved_offers FOR SELECT TO authenticated
             USING (lower(student_email) = lower(auth.jwt() ->> ''email''))';
  END IF;
END $$;

-- 6. Student cards: private bucket, uploads only.
DO $$
DECLARE r record;
BEGIN
  UPDATE storage.buckets SET public = FALSE WHERE id = 'student-cards';
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (policyname IN ('anon_view','anon_upload','anon_upload_student_cards','student_cards_upload')
           OR COALESCE(qual, '') LIKE '%student-cards%' OR COALESCE(with_check, '') LIKE '%student-cards%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
  CREATE POLICY "student_cards_upload" ON storage.objects
    FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = 'student-cards');
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Could not change storage rules from here: in Supabase go to Storage > student-cards and turn off "Public bucket".';
END $$;
