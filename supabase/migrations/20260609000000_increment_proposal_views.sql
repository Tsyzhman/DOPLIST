create or replace function public.increment_proposal_views(
  target_proposal_id uuid,
  viewed_at_value timestamptz default now()
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.proposals
  set views_count = coalesce(views_count, 0) + 1,
      last_viewed_at = viewed_at_value,
      updated_at = viewed_at_value
  where id = target_proposal_id;
$$;
