-- Run once against the Postgres database (Supabase SQL editor or psql). Idempotent.

create table if not exists activity_logs (
  id           bigint generated always as identity primary key,
  user_id      text not null,
  email        text not null,
  tool         text not null,
  action       text not null,
  status       text not null,
  details      jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists activity_logs_user_id_idx on activity_logs (user_id);
create index if not exists activity_logs_tool_action_idx on activity_logs (tool, action);
create index if not exists activity_logs_created_at_idx on activity_logs (created_at);

-- Audio files already synced to Zoho as leads (duplicate-upload protection).
-- To allow re-uploading a file after deleting its lead in Zoho:
--   delete from processed_files where filename = '<file name>';
create table if not exists processed_files (
  file_hash   text primary key,
  filename    text not null,
  zoho_id     text,
  created_at  timestamptz not null default now()
);

-- Full transcript of every lead submitted from the review screen (kept here,
-- not in Zoho, and not on the server disk which is wiped on redeploy).
-- zoho_id is null when the Zoho push failed.
create table if not exists lead_transcripts (
  id          bigint generated always as identity primary key,
  email       text not null,
  filename    text not null,
  transcript  text not null,
  fields      jsonb,
  zoho_id     text,
  created_at  timestamptz not null default now()
);
create index if not exists lead_transcripts_created_at_idx on lead_transcripts (created_at);
create index if not exists lead_transcripts_zoho_id_idx on lead_transcripts (zoho_id);

-- Uploaded template overrides (Master Report Processor). Absent for a
-- report_type means "use the built-in default that ships with the app" -
-- see backend/data/templates/. Present means someone uploaded a replacement,
-- and that's what's used instead. Stored here (not on disk) because the
-- server's disk is wiped on every redeploy.
create table if not exists report_templates (
  report_type  text primary key,
  filename     text not null,
  file_bytes   bytea not null,
  uploaded_by  text not null,
  uploaded_at  timestamptz not null default now()
);

-- IST display columns - the *_ist columns below are only for convenience when
-- browsing tables in Supabase (India-readable), auto-derived from the real
-- created_at/uploaded_at (kept in UTC, the correct way to store a timestamp).
-- Do not write to *_ist directly; Postgres computes it automatically.
alter table activity_logs add column if not exists created_at_ist timestamp
  generated always as (created_at at time zone 'Asia/Kolkata') stored;

alter table lead_transcripts add column if not exists created_at_ist timestamp
  generated always as (created_at at time zone 'Asia/Kolkata') stored;

alter table processed_files add column if not exists created_at_ist timestamp
  generated always as (created_at at time zone 'Asia/Kolkata') stored;

alter table report_templates add column if not exists uploaded_at_ist timestamp
  generated always as (uploaded_at at time zone 'Asia/Kolkata') stored;

-- Close the Supabase REST API exposure: by default Supabase auto-publishes
-- every public-schema table over a web API, gated only by RLS. These tables
-- hold real customer data (call transcripts, PAN/Aadhaar, staff emails) and
-- are never meant to be reached that way - only this app's own direct
-- Postgres connection (the `postgres` role, which has BYPASSRLS and is
-- unaffected by any of this) should ever touch them. No policies are added,
-- so once enabled, every other role is denied by default.
alter table activity_logs enable row level security;
alter table lead_transcripts enable row level security;
alter table processed_files enable row level security;
alter table report_templates enable row level security;
