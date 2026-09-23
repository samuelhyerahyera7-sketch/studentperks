-- AI check of uploaded student cards / proof of registration.
-- Run once in the Supabase SQL editor. Safe to re-run.

ALTER TABLE student_applications ADD COLUMN IF NOT EXISTS ai_verdict    TEXT;        -- approved | needs_review | reject | error
ALTER TABLE student_applications ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC;
ALTER TABLE student_applications ADD COLUMN IF NOT EXISTS ai_summary    TEXT;
ALTER TABLE student_applications ADD COLUMN IF NOT EXISTS ai_result     JSONB;
ALTER TABLE student_applications ADD COLUMN IF NOT EXISTS ai_error      TEXT;
ALTER TABLE student_applications ADD COLUMN IF NOT EXISTS ai_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS student_applications_student_number_idx
  ON student_applications (student_number);
