create extension if not exists pgcrypto;

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  share_slug text,
  title text not null default '',
  client_name text not null default '',
  client_company text not null default '',
  prepared_by text not null default '',
  prepared_by_role text not null default '',
  proposal_date date,
  valid_until date,
  version text not null default 'v1.0',
  status text not null default 'draft',
  language text not null default 'ru',
  currency text not null default 'RUB',
  short_intro text not null default '',
  client_context text not null default '',
  client_problem text not null default '',
  business_goal text not null default '',
  proposed_solution_summary text not null default '',
  why_us text not null default '',
  payment_terms text not null default '',
  legal_notes text not null default '',
  next_step_text text not null default '',
  selected_package_id text,
  published_at timestamptz,
  last_viewed_at timestamptz,
  views_count integer not null default 0,
  expires_at date,
  access_mode text not null default 'public_link',
  is_password_protected boolean not null default false,
  password_hash text,
  public_notes text,
  internal_notes text,
  share_settings jsonb not null default '{}'::jsonb,
  proposal_data jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  out_of_scope jsonb not null default '[]'::jsonb,
  deliverables jsonb not null default '[]'::jsonb,
  packages jsonb not null default '[]'::jsonb,
  process_steps jsonb not null default '[]'::jsonb,
  proof_items jsonb not null default '[]'::jsonb,
  archive_state text not null default 'active',
  archive_after timestamptz,
  purge_after timestamptz,
  archived_at timestamptz,
  purged_at timestamptz,
  archive_text_sha256 text,
  archive_attempts integer not null default 0,
  archive_last_error text,
  archive_failed_at timestamptz,
  archive_locked_at timestamptz,
  telegram_archive_chat_id text,
  telegram_archive_message_ids jsonb,
  archive_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.proposals add column if not exists share_slug text;
alter table public.proposals add column if not exists published_at timestamptz;
alter table public.proposals add column if not exists last_viewed_at timestamptz;
alter table public.proposals add column if not exists views_count integer not null default 0;
alter table public.proposals add column if not exists expires_at date;
alter table public.proposals add column if not exists access_mode text not null default 'public_link';
alter table public.proposals add column if not exists is_password_protected boolean not null default false;
alter table public.proposals add column if not exists password_hash text;
alter table public.proposals add column if not exists public_notes text;
alter table public.proposals add column if not exists internal_notes text;
alter table public.proposals add column if not exists share_settings jsonb not null default '{}'::jsonb;
alter table public.proposals add column if not exists proposal_data jsonb;
alter table public.proposals add column if not exists assumptions jsonb not null default '[]'::jsonb;
alter table public.proposals add column if not exists out_of_scope jsonb not null default '[]'::jsonb;
alter table public.proposals add column if not exists deliverables jsonb not null default '[]'::jsonb;
alter table public.proposals add column if not exists packages jsonb not null default '[]'::jsonb;
alter table public.proposals add column if not exists process_steps jsonb not null default '[]'::jsonb;
alter table public.proposals add column if not exists proof_items jsonb not null default '[]'::jsonb;
alter table public.proposals add column if not exists archive_state text not null default 'active';
alter table public.proposals add column if not exists archive_after timestamptz;
alter table public.proposals add column if not exists purge_after timestamptz;
alter table public.proposals add column if not exists archived_at timestamptz;
alter table public.proposals add column if not exists purged_at timestamptz;
alter table public.proposals add column if not exists archive_text_sha256 text;
alter table public.proposals add column if not exists archive_attempts integer not null default 0;
alter table public.proposals add column if not exists archive_last_error text;
alter table public.proposals add column if not exists archive_failed_at timestamptz;
alter table public.proposals add column if not exists archive_locked_at timestamptz;
alter table public.proposals add column if not exists telegram_archive_chat_id text;
alter table public.proposals add column if not exists telegram_archive_message_ids jsonb;
alter table public.proposals add column if not exists archive_summary jsonb;
alter table public.proposals add column if not exists created_at timestamptz not null default now();
alter table public.proposals add column if not exists updated_at timestamptz not null default now();

update public.proposals
set share_slug = replace(replace(replace(encode(gen_random_bytes(18), 'base64'), '/', '_'), '+', '-'), '=', '')
where share_slug is null or share_slug = '';

alter table public.proposals alter column share_slug set not null;

create unique index if not exists proposals_share_slug_unique_idx
  on public.proposals (share_slug);

create index if not exists proposals_public_lookup_idx
  on public.proposals (share_slug, status, expires_at);

create table if not exists public.proposal_events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  event_type text not null,
  package_id text,
  metadata jsonb,
  user_agent text,
  referrer text,
  created_at timestamptz not null default now()
);

create index if not exists proposal_events_proposal_id_idx
  on public.proposal_events (proposal_id, created_at desc);

alter table public.proposals enable row level security;
alter table public.proposal_events enable row level security;
