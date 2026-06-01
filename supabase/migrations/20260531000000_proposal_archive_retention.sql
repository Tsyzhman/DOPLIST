do $$
begin
  if to_regclass('public.proposals') is null then
    raise notice 'public.proposals does not exist yet; archive-retention migration skipped';
    return;
  end if;

  execute 'alter table public.proposals add column if not exists archive_state text not null default ''active''';
  execute 'alter table public.proposals add column if not exists archive_after timestamptz';
  execute 'alter table public.proposals add column if not exists purge_after timestamptz';
  execute 'alter table public.proposals add column if not exists archived_at timestamptz';
  execute 'alter table public.proposals add column if not exists purged_at timestamptz';
  execute 'alter table public.proposals add column if not exists archive_text_sha256 text';
  execute 'alter table public.proposals add column if not exists archive_attempts integer not null default 0';
  execute 'alter table public.proposals add column if not exists archive_last_error text';
  execute 'alter table public.proposals add column if not exists archive_failed_at timestamptz';
  execute 'alter table public.proposals add column if not exists archive_locked_at timestamptz';
  execute 'alter table public.proposals add column if not exists telegram_archive_chat_id text';
  execute 'alter table public.proposals add column if not exists telegram_archive_message_ids jsonb';
  execute 'alter table public.proposals add column if not exists archive_summary jsonb';

  execute 'update public.proposals
    set purge_after = coalesce(purge_after, created_at + interval ''6 months''),
        archive_after = coalesce(archive_after, created_at + interval ''6 months'' - interval ''7 days'')
    where created_at is not null
      and (purge_after is null or archive_after is null)';

  execute 'create table if not exists public.proposal_deliveries (
    id uuid primary key default gen_random_uuid(),
    proposal_id uuid not null references public.proposals(id) on delete cascade,
    target text not null check (target in (''archive'', ''client'')),
    chat_id text not null,
    status text not null check (status in (''queued'', ''sent'', ''failed'')),
    message_ids jsonb,
    text_sha256 text,
    attempts integer not null default 0,
    last_error text,
    created_at timestamptz not null default now(),
    sent_at timestamptz
  )';

  execute 'create index if not exists proposals_archive_due_idx
    on public.proposals (archive_after)
    where purged_at is null and archive_state in (''active'', ''archive_due'', ''archive_failed'')';

  execute 'create index if not exists proposals_purge_due_idx
    on public.proposals (purge_after)
    where purged_at is null and archive_state = ''archived''';

  execute 'create index if not exists proposal_deliveries_proposal_id_idx
    on public.proposal_deliveries (proposal_id)';
end $$;

create or replace function public.purge_proposal_content(
  target_proposal_id uuid,
  purged_at_value timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_column text;
  child_table text;
begin
  if to_regclass('public.proposals') is null then
    raise exception 'public.proposals does not exist';
  end if;

  execute 'update public.proposals
    set archive_state = ''purged'',
        purged_at = $1
    where id = $2'
    using purged_at_value, target_proposal_id;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'proposals'
      and column_name = 'updated_at'
  ) then
    execute 'update public.proposals set updated_at = $1 where id = $2'
      using purged_at_value, target_proposal_id;
  end if;

  foreach target_column in array array[
    'password_hash',
    'short_intro',
    'client_context',
    'client_problem',
    'business_goal',
    'proposed_solution_summary',
    'why_us',
    'payment_terms',
    'legal_notes',
    'next_step_text',
    'public_notes',
    'internal_notes',
    'share_settings',
    'assumptions',
    'out_of_scope',
    'deliverables',
    'packages',
    'process_steps',
    'proof_items'
  ]
  loop
    if exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'proposals'
        and c.column_name = target_column
        and c.is_nullable = 'YES'
    ) then
      execute format('update public.proposals set %I = null where id = $1', target_column)
        using target_proposal_id;
    end if;
  end loop;

  foreach child_table in array array[
    'proposal_deliverables',
    'proposal_packages',
    'proposal_process_steps',
    'proposal_proof_items'
  ]
  loop
    if to_regclass('public.' || child_table) is not null then
      execute format('delete from public.%I where proposal_id = $1', child_table)
        using target_proposal_id;
    end if;
  end loop;
end;
$$;
