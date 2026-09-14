-- ============================================================
-- StudentPerks: repair the "join" form's Supabase RLS policy
-- Run this once in: Supabase -> SQL Editor -> New query
--
-- Symptom this fixes: submitting the "Submit for verification" form
-- shows "The verification database rejected this request."
--
-- Root cause: row level security is enabled on student_applications,
-- but there is currently no INSERT policy in place that matches what
-- the site actually sends (this happens if production-hardening.sql
-- was only partially applied - e.g. the DROP POLICY statements ran
-- but the CREATE POLICY statements after them did not). With RLS
-- enabled and no matching policy, every insert is rejected by
-- default, so the browser's error message is passed along verbatim.
--
-- This script is safe to re-run any time.
-- ============================================================

ALTER TABLE student_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all" ON student_applications;
DROP POLICY IF EXISTS "anon_insert_student_applications" ON student_applications;
DROP POLICY IF EXISTS "authenticated_insert_student_applications" ON student_applications;

-- First-time visitors (not signed in yet) submitting the join form.
CREATE POLICY "anon_insert_student_applications"
  ON student_applications
  FOR INSERT TO anon
  WITH CHECK (status = 'pending');

-- Covers a visitor who is still signed in from an earlier session
-- (e.g. used "Already verified? Sign in") and submits the join form
-- again - without this, their request is rejected because only the
-- anon role could insert.
CREATE POLICY "authenticated_insert_student_applications"
  ON student_applications
  FOR INSERT TO authenticated
  WITH CHECK (status = 'pending');

-- Storage: make sure the student-cards upload policy exists too,
-- since the same form uploads the card photo before the DB insert.
DROP POLICY IF EXISTS "anon_upload_student_cards" ON storage.objects;
CREATE POLICY "anon_upload_student_cards"
  ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'student-cards');
