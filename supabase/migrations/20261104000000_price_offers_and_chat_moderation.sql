-- Price negotiation on boat listings and chat-level contact moderation.
alter table public.boats
  add column if not exists price_negotiable boolean not null default false;

alter table public.conversations
  add column if not exists closed_at timestamptz,
  add column if not exists close_reason text;

create table if not exists public.price_offers (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'countered')),
  created_at timestamptz not null default now()
);

create unique index if not exists price_offers_one_pending_per_conversation
  on public.price_offers(conversation_id) where status = 'pending';
create index if not exists price_offers_conversation_created_idx
  on public.price_offers(conversation_id, created_at);

grant select, insert, update on public.price_offers to authenticated;
grant all on public.price_offers to service_role;
alter table public.price_offers enable row level security;

drop policy if exists "Participants read price offers" on public.price_offers;
create policy "Participants read price offers" on public.price_offers
  for select to authenticated
  using (public.is_conversation_participant(conversation_id));

drop policy if exists "Participants create price offers on negotiable boats" on public.price_offers;
create policy "Participants create price offers on negotiable boats" on public.price_offers
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1
      from public.conversations c
      join public.boats b on b.id = c.boat_id
      where c.id = conversation_id
        and (c.owner_id = auth.uid() or c.sailor_id = auth.uid())
        and c.closed_at is null
        and b.price_negotiable = true
    )
  );

drop policy if exists "Recipients respond to pending price offers" on public.price_offers;
create policy "Recipients respond to pending price offers" on public.price_offers
  for update to authenticated
  using (
    sender_id <> auth.uid()
    and status = 'pending'
    and public.is_conversation_participant(conversation_id)
    and exists (select 1 from public.conversations c where c.id = conversation_id and c.closed_at is null)
  )
  with check (
    sender_id <> auth.uid()
    and status in ('accepted', 'declined', 'countered')
    and public.is_conversation_participant(conversation_id)
    and exists (select 1 from public.conversations c where c.id = conversation_id and c.closed_at is null)
  );

create or replace function public.price_offers_before_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.id <> old.id
    or new.conversation_id <> old.conversation_id
    or new.sender_id <> old.sender_id
    or new.amount <> old.amount
    or new.created_at <> old.created_at
    or old.status <> 'pending'
    or new.status not in ('accepted', 'declined', 'countered')
    or old.sender_id = auth.uid()
  then
    raise exception 'Only the other participant can respond to a pending price offer';
  end if;
  return new;
end $$;

drop trigger if exists price_offers_before_update on public.price_offers;
create trigger price_offers_before_update
  before update on public.price_offers
  for each row execute function public.price_offers_before_update();

-- Attempts to share phone/email details are redacted, recorded without storing
-- the contact itself, and close the conversation. Repeated attempts can be
-- reviewed by an administrator for account suspension.
create table if not exists public.contact_violations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  message_id uuid,
  created_at timestamptz not null default now()
);
alter table public.contact_violations enable row level security;
revoke all on public.contact_violations from anon, authenticated;
grant all on public.contact_violations to service_role;

create or replace function public.messages_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _clean_body text;
  _closed_at timestamptz;
begin
  if new.is_system then
    new.body := public.redact_contact_info(new.body);
    return new;
  end if;

  select closed_at into _closed_at
  from public.conversations where id = new.conversation_id;
  if _closed_at is not null then
    raise exception 'This conversation has been closed';
  end if;

  _clean_body := public.redact_contact_info(new.body);
  if _clean_body <> new.body then
    new.body := _clean_body;
    update public.conversations
      set closed_at = now(), close_reason = 'contact_sharing'
      where id = new.conversation_id and closed_at is null;

    insert into public.contact_violations (conversation_id, user_id, message_id)
      values (new.conversation_id, new.sender_id, new.id);

    insert into public.messages (conversation_id, sender_id, body, is_system)
      values (
        new.conversation_id,
        null,
        'This conversation was closed because phone numbers or email addresses were shared. Keep booking and payment on DinghyCharter. Repeated attempts may lead to account suspension.',
        true
      );
  else
    new.body := _clean_body;
  end if;
  return new;
end $$;

drop trigger if exists messages_before_insert on public.messages;
create trigger messages_before_insert
  before insert on public.messages
  for each row execute function public.messages_before_insert();
