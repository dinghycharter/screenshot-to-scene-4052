
-- ============ ENUMS ============
create type public.account_type as enum ('owner', 'sailor');
create type public.booking_status as enum ('pending', 'confirmed', 'declined', 'cancelled', 'completed');

-- ============ SHARED ============
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Hides emails and phone numbers so contact stays on the platform.
create or replace function public.redact_contact_info(_text text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(
    regexp_replace(coalesce(_text, ''), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[contact hidden]', 'g'),
    '\+?\(?\d(?:[\s().-]{0,2}\d){8,}', '[contact hidden]', 'g'
  )
$$;

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key,
  account_type public.account_type not null default 'sailor',
  full_name text not null default '',
  avatar_url text,
  bio text,
  home_club text,
  country text,
  languages text[] not null default '{}',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.profiles to anon;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Profiles are publicly viewable" on public.profiles for select to anon, authenticated using (true);
create policy "Users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url, account_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url',
    case when new.raw_user_meta_data->>'account_type' = 'owner' then 'owner'::public.account_type else 'sailor'::public.account_type end
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ============ CLASSES & EVENTS ============
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null default 'Dinghy',
  crew int not null default 1,
  sort_order int not null default 0
);
grant select on public.classes to anon, authenticated;
grant all on public.classes to service_role;
alter table public.classes enable row level security;
create policy "Classes are public" on public.classes for select to anon, authenticated using (true);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  city text not null,
  country text not null,
  start_date date not null,
  end_date date not null,
  description text,
  sort_order int not null default 0
);
grant select on public.events to anon, authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "Events are public" on public.events for select to anon, authenticated using (true);

-- ============ BOATS ============
create table public.boats (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id),
  title text not null,
  manufacturer text not null default '',
  model text not null default '',
  year int,
  sail_number text,
  description text not null default '',
  equipment text[] not null default '{}',
  specs jsonb not null default '{}'::jsonb,
  city text not null,
  country text not null,
  pickup_location text not null default '',
  daily_price numeric(10,2) not null check (daily_price >= 0),
  security_deposit numeric(10,2) not null default 0 check (security_deposit >= 0),
  currency text not null default 'EUR',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index boats_owner_idx on public.boats(owner_id);
create index boats_class_idx on public.boats(class_id);
grant select on public.boats to anon;
grant select, insert, update, delete on public.boats to authenticated;
grant all on public.boats to service_role;
alter table public.boats enable row level security;
create policy "Published boats are public" on public.boats for select to anon, authenticated using (is_published or owner_id = auth.uid());
create policy "Owners create boats" on public.boats for insert to authenticated with check (owner_id = auth.uid());
create policy "Owners update boats" on public.boats for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Owners delete boats" on public.boats for delete to authenticated using (owner_id = auth.uid());
create trigger boats_updated_at before update on public.boats for each row execute function public.set_updated_at();

create or replace function public.owns_boat(_boat_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.boats where id = _boat_id and owner_id = auth.uid())
$$;

create table public.boat_photos (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid not null references public.boats(id) on delete cascade,
  url text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index boat_photos_boat_idx on public.boat_photos(boat_id);
grant select on public.boat_photos to anon;
grant select, insert, update, delete on public.boat_photos to authenticated;
grant all on public.boat_photos to service_role;
alter table public.boat_photos enable row level security;
create policy "Boat photos are public" on public.boat_photos for select to anon, authenticated using (true);
create policy "Owners manage photos" on public.boat_photos for insert to authenticated with check (public.owns_boat(boat_id));
create policy "Owners update photos" on public.boat_photos for update to authenticated using (public.owns_boat(boat_id));
create policy "Owners delete photos" on public.boat_photos for delete to authenticated using (public.owns_boat(boat_id));

create table public.availability (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid not null references public.boats(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index availability_boat_idx on public.availability(boat_id);
grant select on public.availability to anon;
grant select, insert, update, delete on public.availability to authenticated;
grant all on public.availability to service_role;
alter table public.availability enable row level security;
create policy "Availability is public" on public.availability for select to anon, authenticated using (true);
create policy "Owners add availability" on public.availability for insert to authenticated with check (public.owns_boat(boat_id));
create policy "Owners update availability" on public.availability for update to authenticated using (public.owns_boat(boat_id));
create policy "Owners delete availability" on public.availability for delete to authenticated using (public.owns_boat(boat_id));

create table public.boat_events (
  boat_id uuid not null references public.boats(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  primary key (boat_id, event_id)
);
grant select on public.boat_events to anon;
grant select, insert, delete on public.boat_events to authenticated;
grant all on public.boat_events to service_role;
alter table public.boat_events enable row level security;
create policy "Boat events are public" on public.boat_events for select to anon, authenticated using (true);
create policy "Owners link events" on public.boat_events for insert to authenticated with check (public.owns_boat(boat_id));
create policy "Owners unlink events" on public.boat_events for delete to authenticated using (public.owns_boat(boat_id));

-- ============ SAVED BOATS (WISHLIST) ============
create table public.saved_boats (
  user_id uuid not null references public.profiles(id) on delete cascade,
  boat_id uuid not null references public.boats(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, boat_id)
);
grant select, insert, delete on public.saved_boats to authenticated;
grant all on public.saved_boats to service_role;
alter table public.saved_boats enable row level security;
create policy "Users view own saved" on public.saved_boats for select to authenticated using (user_id = auth.uid());
create policy "Users save boats" on public.saved_boats for insert to authenticated with check (user_id = auth.uid());
create policy "Users unsave boats" on public.saved_boats for delete to authenticated using (user_id = auth.uid());

-- ============ BOOKINGS ============
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid not null references public.boats(id) on delete cascade,
  sailor_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  start_date date not null,
  end_date date not null,
  message text,
  daily_price numeric(10,2) not null default 0,
  total_price numeric(10,2) not null default 0,
  security_deposit numeric(10,2) not null default 0,
  status public.booking_status not null default 'pending',
  payment_status text not null default 'not_started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bookings_sailor_idx on public.bookings(sailor_id);
create index bookings_owner_idx on public.bookings(owner_id);
create index bookings_boat_idx on public.bookings(boat_id);
grant select, insert, update on public.bookings to authenticated;
grant all on public.bookings to service_role;
alter table public.bookings enable row level security;
create policy "Participants view bookings" on public.bookings for select to authenticated using (sailor_id = auth.uid() or owner_id = auth.uid());
create policy "Sailors request bookings" on public.bookings for insert to authenticated with check (sailor_id = auth.uid());
create policy "Participants update bookings" on public.bookings for update to authenticated using (sailor_id = auth.uid() or owner_id = auth.uid());

create or replace function public.bookings_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare b record;
begin
  select owner_id, daily_price, security_deposit into b from public.boats where id = new.boat_id;
  if not found then raise exception 'Boat not found'; end if;
  if b.owner_id = new.sailor_id then raise exception 'You cannot book your own boat'; end if;
  if new.end_date < new.start_date then raise exception 'End date must be on or after the start date'; end if;
  if new.start_date < current_date then raise exception 'Start date cannot be in the past'; end if;
  if exists (
    select 1 from public.bookings
    where boat_id = new.boat_id and status = 'confirmed'
      and daterange(start_date, end_date, '[]') && daterange(new.start_date, new.end_date, '[]')
  ) then raise exception 'These dates are already booked'; end if;
  new.owner_id := b.owner_id;
  new.daily_price := b.daily_price;
  new.total_price := ((new.end_date - new.start_date) + 1) * b.daily_price;
  new.security_deposit := b.security_deposit;
  new.status := 'pending';
  new.payment_status := 'not_started';
  new.message := public.redact_contact_info(new.message);
  return new;
end $$;
create trigger bookings_before_insert before insert on public.bookings for each row execute function public.bookings_before_insert();

create or replace function public.bookings_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    new.updated_at := now();
    return new;
  end if;
  if new.boat_id <> old.boat_id or new.sailor_id <> old.sailor_id or new.owner_id <> old.owner_id
     or new.start_date <> old.start_date or new.end_date <> old.end_date
     or new.total_price <> old.total_price or new.daily_price <> old.daily_price
     or new.security_deposit <> old.security_deposit or new.payment_status <> old.payment_status
     or coalesce(new.message, '') <> coalesce(old.message, '') then
    raise exception 'Booking details cannot be changed';
  end if;
  if new.status <> old.status then
    if auth.uid() = old.owner_id and old.status = 'pending' and new.status in ('confirmed', 'declined') then
      if new.status = 'confirmed' and exists (
        select 1 from public.bookings
        where boat_id = old.boat_id and status = 'confirmed' and id <> old.id
          and daterange(start_date, end_date, '[]') && daterange(old.start_date, old.end_date, '[]')
      ) then raise exception 'Another booking is already confirmed for these dates'; end if;
    elsif auth.uid() = old.sailor_id and old.status in ('pending', 'confirmed') and new.status = 'cancelled' then
      null;
    else
      raise exception 'This status change is not allowed';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger bookings_before_update before update on public.bookings for each row execute function public.bookings_before_update();

-- Confirmed date ranges for public calendars (no personal data).
create or replace function public.boat_booked_ranges(_boat_id uuid)
returns table (start_date date, end_date date)
language sql stable security definer set search_path = public as $$
  select start_date, end_date from public.bookings
  where boat_id = _boat_id and status = 'confirmed' and end_date >= current_date
$$;
grant execute on function public.boat_booked_ranges(uuid) to anon, authenticated;

-- ============ CONVERSATIONS & MESSAGES ============
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid not null references public.boats(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  sailor_id uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (boat_id, sailor_id)
);
grant select, insert on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;
create policy "Participants view conversations" on public.conversations for select to authenticated using (owner_id = auth.uid() or sailor_id = auth.uid());
create policy "Sailors start conversations" on public.conversations for insert to authenticated with check (sailor_id = auth.uid());

create or replace function public.conversations_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare _owner uuid;
begin
  select owner_id into _owner from public.boats where id = new.boat_id;
  if _owner is null then raise exception 'Boat not found'; end if;
  if _owner = new.sailor_id then raise exception 'You cannot message yourself'; end if;
  new.owner_id := _owner;
  return new;
end $$;
create trigger conversations_before_insert before insert on public.conversations for each row execute function public.conversations_before_insert();

create or replace function public.is_conversation_participant(_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversations where id = _conversation_id and (owner_id = auth.uid() or sailor_id = auth.uid()))
$$;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  is_system boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages(conversation_id, created_at);
grant select, insert, update on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "Participants read messages" on public.messages for select to authenticated using (public.is_conversation_participant(conversation_id));
create policy "Participants send messages" on public.messages for insert to authenticated with check (sender_id = auth.uid() and is_system = false and public.is_conversation_participant(conversation_id));
create policy "Participants mark read" on public.messages for update to authenticated using (public.is_conversation_participant(conversation_id) and sender_id <> auth.uid());

create or replace function public.messages_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.body := public.redact_contact_info(new.body);
  return new;
end $$;
create trigger messages_before_insert before insert on public.messages for each row execute function public.messages_before_insert();

create or replace function public.messages_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages for each row execute function public.messages_after_insert();

create or replace function public.messages_before_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.body <> old.body or new.sender_id is distinct from old.sender_id or new.conversation_id <> old.conversation_id or new.is_system <> old.is_system then
    raise exception 'Messages cannot be edited';
  end if;
  return new;
end $$;
create trigger messages_before_update before update on public.messages for each row execute function public.messages_before_update();

-- Booking lifecycle posts into the conversation thread.
create or replace function public.bookings_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare _conv uuid; _title text;
begin
  select title into _title from public.boats where id = new.boat_id;
  insert into public.conversations (boat_id, owner_id, sailor_id)
  values (new.boat_id, new.owner_id, new.sailor_id)
  on conflict (boat_id, sailor_id) do update set last_message_at = now()
  returning id into _conv;

  if tg_op = 'INSERT' then
    insert into public.messages (conversation_id, sender_id, body, is_system)
    values (_conv, null, 'Booking requested for ' || coalesce(_title, 'this boat') || ': ' || to_char(new.start_date, 'DD Mon YYYY') || ' – ' || to_char(new.end_date, 'DD Mon YYYY') || '.', true);
    if coalesce(trim(new.message), '') <> '' then
      insert into public.messages (conversation_id, sender_id, body) values (_conv, new.sailor_id, left(new.message, 2000));
    end if;
  elsif new.status <> old.status then
    insert into public.messages (conversation_id, sender_id, body, is_system)
    values (_conv, null, case new.status
      when 'confirmed' then 'Booking confirmed by the owner. See you on the water!'
      when 'declined' then 'The owner declined this booking request.'
      when 'cancelled' then 'The sailor cancelled this booking.'
      else 'Booking status updated to ' || new.status::text || '.' end, true);
  end if;
  return new;
end $$;
create trigger bookings_after_write after insert or update on public.bookings for each row execute function public.bookings_after_write();

-- ============ REVIEWS ============
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique references public.bookings(id) on delete set null,
  boat_id uuid not null references public.boats(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
create index reviews_owner_idx on public.reviews(owner_id);
create index reviews_boat_idx on public.reviews(boat_id);
grant select on public.reviews to anon;
grant select, insert on public.reviews to authenticated;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;
create policy "Reviews are public" on public.reviews for select to anon, authenticated using (true);
create policy "Sailors review their bookings" on public.reviews for insert to authenticated with check (reviewer_id = auth.uid());

create or replace function public.reviews_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare bk record;
begin
  if auth.uid() is null then return new; end if;
  select * into bk from public.bookings where id = new.booking_id;
  if not found or bk.sailor_id <> auth.uid() then raise exception 'You can only review your own bookings'; end if;
  if bk.status not in ('confirmed', 'completed') or bk.end_date >= current_date then raise exception 'You can review once your charter has finished'; end if;
  new.boat_id := bk.boat_id;
  new.owner_id := bk.owner_id;
  new.comment := public.redact_contact_info(new.comment);
  return new;
end $$;
create trigger reviews_before_insert before insert on public.reviews for each row execute function public.reviews_before_insert();

create view public.owner_ratings with (security_invoker = on) as
  select owner_id, round(avg(rating)::numeric, 2) as avg_rating, count(*)::int as review_count
  from public.reviews group by owner_id;
grant select on public.owner_ratings to anon, authenticated;

-- ============ STORAGE POLICIES ============
create policy "Media readable" on storage.objects for select to anon, authenticated using (bucket_id in ('boat-photos', 'avatars'));
create policy "Users upload own media" on storage.objects for insert to authenticated with check (bucket_id in ('boat-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users update own media" on storage.objects for update to authenticated using (bucket_id in ('boat-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own media" on storage.objects for delete to authenticated using (bucket_id in ('boat-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);

-- ============ REALTIME ============
alter publication supabase_realtime add table public.messages;
