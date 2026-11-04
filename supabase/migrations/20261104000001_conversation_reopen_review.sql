-- Participant explanations and administrator review for contact-moderated chats.
create or replace function public.is_site_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

create table if not exists public.conversation_reopen_requests (
  id uuid primary key default gen_random_uuid(),
  violation_id uuid not null references public.contact_violations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  explanation text not null check (length(explanation) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'superseded')),
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (violation_id, requester_id)
);

create index if not exists conversation_reopen_requests_status_created_idx
  on public.conversation_reopen_requests(status, created_at desc);
create index if not exists contact_violations_created_idx
  on public.contact_violations(created_at desc);

alter table public.conversation_reopen_requests enable row level security;
revoke all on public.conversation_reopen_requests from anon, authenticated;
grant select on public.conversation_reopen_requests to authenticated;
grant all on public.conversation_reopen_requests to service_role;

drop policy if exists "Participants read reopen requests" on public.conversation_reopen_requests;
create policy "Participants read reopen requests" on public.conversation_reopen_requests
  for select to authenticated
  using (
    public.is_site_admin()
    or public.is_conversation_participant(conversation_id)
  );

drop policy if exists "Admins read contact violations" on public.contact_violations;
create policy "Admins read contact violations" on public.contact_violations
  for select to authenticated using (public.is_site_admin());
grant select on public.contact_violations to authenticated;

drop policy if exists "Admins read moderated conversations" on public.conversations;
create policy "Admins read moderated conversations" on public.conversations
  for select to authenticated using (public.is_site_admin());

drop policy if exists "Admins read moderated messages" on public.messages;
create policy "Admins read moderated messages" on public.messages
  for select to authenticated using (public.is_site_admin());

create or replace function public.request_conversation_reopen(_conversation_id uuid, _explanation text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _requester uuid := auth.uid();
  _violation_id uuid;
  _request_id uuid;
  _clean_explanation text;
begin
  if _requester is null or not public.is_conversation_participant(_conversation_id) then
    raise exception 'You are not a participant in this conversation';
  end if;
  _clean_explanation := public.redact_contact_info(trim(coalesce(_explanation, '')));
  if length(_clean_explanation) < 10 or length(_clean_explanation) > 2000 then
    raise exception 'Please provide an explanation between 10 and 2000 characters';
  end if;
  if not exists (
    select 1 from public.conversations
    where id = _conversation_id and closed_at is not null and close_reason = 'contact_sharing'
  ) then
    raise exception 'This conversation is not awaiting a contact-sharing review';
  end if;
  select id into _violation_id
  from public.contact_violations
  where conversation_id = _conversation_id
  order by created_at desc
  limit 1;
  if _violation_id is null then
    raise exception 'No contact moderation event was found for this conversation';
  end if;

  insert into public.conversation_reopen_requests (violation_id, conversation_id, requester_id, explanation)
  values (_violation_id, _conversation_id, _requester, _clean_explanation)
  on conflict (violation_id, requester_id) do update
    set explanation = excluded.explanation,
        status = 'pending',
        admin_note = null,
        reviewed_by = null,
        reviewed_at = null,
        created_at = now()
  returning id into _request_id;
  return _request_id;
end
$$;

create or replace function public.review_conversation_reopen_request(_request_id uuid, _decision text, _admin_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _request public.conversation_reopen_requests%rowtype;
begin
  if not public.is_site_admin() then
    raise exception 'Administrator access required';
  end if;
  if _decision not in ('approved', 'denied') then
    raise exception 'Decision must be approved or denied';
  end if;

  select * into _request
  from public.conversation_reopen_requests
  where id = _request_id and status = 'pending'
  for update;
  if not found then
    raise exception 'This request is no longer pending';
  end if;

  update public.conversation_reopen_requests
  set status = _decision,
      admin_note = nullif(public.redact_contact_info(trim(coalesce(_admin_note, ''))), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = _request_id;

  if _decision = 'approved' then
    update public.conversations
    set closed_at = null, close_reason = null
    where id = _request.conversation_id and close_reason = 'contact_sharing';
    update public.conversation_reopen_requests
    set status = 'superseded', reviewed_by = auth.uid(), reviewed_at = now()
    where violation_id = _request.violation_id and id <> _request_id and status = 'pending';
  else
    update public.conversation_reopen_requests
    set status = 'denied', reviewed_by = auth.uid(), reviewed_at = now()
    where violation_id = _request.violation_id and id <> _request_id and status = 'pending';
  end if;
end
$$;

revoke all on function public.request_conversation_reopen(uuid, text) from public, anon;
grant execute on function public.request_conversation_reopen(uuid, text) to authenticated;
revoke all on function public.review_conversation_reopen_request(uuid, text, text) from public, anon;
grant execute on function public.review_conversation_reopen_request(uuid, text, text) to authenticated;

