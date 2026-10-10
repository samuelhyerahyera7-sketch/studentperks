-- StudentPerks work profiles ("talent profiles") for jobs and promotions.
-- Run once in the Supabase SQL editor. Safe to re-run.
-- Only the site's server reads and writes these (no browser access).

CREATE TABLE IF NOT EXISTS student_profiles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email      TEXT NOT NULL UNIQUE,
  full_name          TEXT NOT NULL DEFAULT '',
  date_of_birth      DATE,
  gender             TEXT NOT NULL DEFAULT '',
  race               TEXT NOT NULL DEFAULT '',
  home_language      TEXT NOT NULL DEFAULT '',
  province           TEXT NOT NULL DEFAULT '',
  city               TEXT NOT NULL DEFAULT '',
  phone              TEXT NOT NULL DEFAULT '',
  height_cm          INTEGER,
  eye_colour         TEXT NOT NULL DEFAULT '',
  hair_colour        TEXT NOT NULL DEFAULT '',
  hair_style         TEXT NOT NULL DEFAULT '',
  tattoos            TEXT NOT NULL DEFAULT '',
  piercings          TEXT NOT NULL DEFAULT '',
  shirt_size         TEXT NOT NULL DEFAULT '',
  waist              TEXT NOT NULL DEFAULT '',
  pants_size         TEXT NOT NULL DEFAULT '',
  shoe_size          TEXT NOT NULL DEFAULT '',
  experience         TEXT NOT NULL DEFAULT '',
  licence            TEXT NOT NULL DEFAULT '',
  own_transport      TEXT NOT NULL DEFAULT '',
  availability       TEXT NOT NULL DEFAULT '',
  travel             TEXT NOT NULL DEFAULT '',
  skills             TEXT NOT NULL DEFAULT '',
  -- [{slot, path, status: pending|approved|rejected, uploaded_at}]
  photos             JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- What partners may see (chosen by the student)
  share_details      BOOLEAN NOT NULL DEFAULT FALSE,
  share_photos       BOOLEAN NOT NULL DEFAULT FALSE,
  share_race         BOOLEAN NOT NULL DEFAULT FALSE,
  adult_confirmed    BOOLEAN NOT NULL DEFAULT FALSE,
  consent_updated_at TIMESTAMPTZ,
  -- Email preferences (each can be switched off by the student)
  job_alerts         BOOLEAN NOT NULL DEFAULT TRUE,
  application_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  message_alerts     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every change to a student's sharing choices, kept for POPIA.
CREATE TABLE IF NOT EXISTS consent_log (
  id               BIGSERIAL PRIMARY KEY,
  student_email    TEXT NOT NULL,
  share_details    BOOLEAN NOT NULL,
  share_photos     BOOLEAN NOT NULL,
  share_race       BOOLEAN NOT NULL,
  adult_confirmed  BOOLEAN NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_log      ENABLE ROW LEVEL SECURITY;

-- Private storage for profile photos (shown through temporary links only).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('talent-photos', 'talent-photos', FALSE, 3145728, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = FALSE;
