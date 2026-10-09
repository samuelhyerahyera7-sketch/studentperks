-- Deal views, opens and code reveals, for the admin "Deal performance" view.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Written by the site's server only (/api/track); read only by the server
-- (/api/deal-stats returns totals). No browser access is granted here.

CREATE TABLE IF NOT EXISTS deal_events (
  id          BIGSERIAL PRIMARY KEY,
  deal        TEXT NOT NULL,                 -- partner name, e.g. 'Intercity Xpress'
  event       TEXT NOT NULL,                 -- 'view' | 'open' | 'code'
  source      TEXT NOT NULL DEFAULT '',      -- 'home' | 'dashboard'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_events_created_at_idx ON deal_events (created_at DESC);

ALTER TABLE deal_events ENABLE ROW LEVEL SECURITY;
