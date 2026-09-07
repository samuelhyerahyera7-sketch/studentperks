-- ============================================================
-- StudentPerks Production Hardening
-- Apply this after setting these Vercel env vars:
--   SUPABASE_SERVICE_ROLE_KEY
--   VENDOR_SESSION_SECRET
--   RESEND_API_KEY                 -- optional, for emails
--   REDEMPTION_EMAIL_FROM          -- optional
--
-- This moves public table access away from the browser and lets
-- serverless API routes perform sensitive vendor/redeem actions.
-- ============================================================

ALTER TABLE vendors              ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_codes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemptions          ENABLE ROW LEVEL SECURITY;

ALTER TABLE student_applications
  ADD COLUMN IF NOT EXISTS student_email_verified BOOLEAN DEFAULT FALSE;

DROP POLICY IF EXISTS "anon_all" ON vendors;
DROP POLICY IF EXISTS "anon_all" ON coupon_codes;
DROP POLICY IF EXISTS "anon_all" ON student_applications;
DROP POLICY IF EXISTS "anon_all" ON redemptions;

-- Public visitors may submit a student application.
CREATE POLICY "anon_insert_student_applications"
  ON student_applications
  FOR INSERT TO anon
  WITH CHECK (status = 'pending');

-- Signed-in students may read only their own application rows.
CREATE POLICY "student_read_own_applications"
  ON student_applications
  FOR SELECT TO authenticated
  USING (
    personal_email = auth.jwt() ->> 'email'
    OR student_email = auth.jwt() ->> 'email'
  );

-- Signed-in students may read only codes assigned to their email.
CREATE POLICY "student_read_assigned_codes"
  ON coupon_codes
  FOR SELECT TO authenticated
  USING (assigned_to_email = auth.jwt() ->> 'email');

-- Signed-in students may read only their own redemption history.
CREATE POLICY "student_read_own_redemptions"
  ON redemptions
  FOR SELECT TO authenticated
  USING (student_email = auth.jwt() ->> 'email');

-- Keep student-card uploads private. The service role can still read them.
UPDATE storage.buckets
SET public = FALSE
WHERE id = 'student-cards';

DROP POLICY IF EXISTS "anon_view" ON storage.objects;
DROP POLICY IF EXISTS "anon_upload" ON storage.objects;

CREATE POLICY "anon_upload_student_cards"
  ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'student-cards');
