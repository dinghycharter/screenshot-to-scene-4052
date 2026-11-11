-- Seller-driven pricing, cancellation of unpaid deals, and payment lock.
--
-- Flow (price_offers.status):
--   pending   -> waiting for the other participant
--   accepted  -> price agreed by both sides; the buyer can review checkout and pay
--   countered / declined -> closed negotiation steps
--   cancelled -> the owner withdrew the price before the buyer paid
--   paid      -> payment confirmed; nothing can be cancelled or changed any more
--
-- Rules enforced here (not only in the UI):
--   * The owner can always propose a price, even on non-negotiable boats.
--   * A buyer can only send the listed price on non-negotiable boats ("request to buy").
--   * Buyers can only choose dates inside the boat's availability; the owner may offer other dates.
--   * The price is per day and applies to the chosen dates.
--   * Every price carries the charter dates chosen when it was sent.
--   * No new offer once a price is accepted or paid.
--   * Only the owner can cancel, and only while the offer is pending or accepted.
--   * Only the service role (payment backend) can mark an offer as paid; paid is final.

do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.price_offers'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%status%'
  loop
    execute format('alter table public.price_offers drop constraint %I', c);
  end loop;
end $$;

alter table public.price_offers
  add constraint price_offers_status_check
  check (status in ('pending', 'accepted', 'declined', 'countered', 'cancelled', 'paid'));

-- Every price now covers specific charter dates (inclusive, same rule as bookings).
-- Older offers keep null dates; new offers must have them.
alter table public.price_offers add column if not exists start_date date;
alter table public.price_offers add column if not exists end_date date;
alter table public.price_offers drop constraint if exists price_offers_dates_check;
alter table public.price_offers
  add constraint price_offers_dates_check
  check ((start_date is null and end_date is null) or (start_date is not null and end_date is not null and end_date >= start_date));

-- True when the dates sit inside one open availability window and clash with no confirmed booking.
-- Security definer so buyers can be checked against bookings they cannot read.
create or replace function public.offer_dates_available(_boat_id uuid, _start date, _end date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.availability a
    where a.boat_id = _boat_id and a.start_date <= _start and a.end_date >= _end
  ) and not exists (
    select 1 from public.bookings k
    where k.boat_id = _boat_id and k.status = 'confirmed' and k.start_date <= _end and k.end_date >= _start
  )
$$;
revoke all on function public.offer_dates_available(uuid, date, date) from public, anon;
grant execute on function public.offer_dates_available(uuid, date, date) to authenticated;

drop policy if exists "Participants create price offers on negotiable boats" on public.price_offers;
drop policy if exists "Participants create price offers" on public.price_offers;
create policy "Participants create price offers" on public.price_offers
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and status = 'pending'
    and start_date is not null
    and end_date is not null
    and start_date >= current_date
    and exists (
      select 1
      from public.conversations c
      join public.boats b on b.id = c.boat_id
      where c.id = price_offers.conversation_id
        and (c.owner_id = auth.uid() or c.sailor_id = auth.uid())
        and c.closed_at is null
        and (c.owner_id = auth.uid() or b.price_negotiable = true or price_offers.amount = b.daily_price)
        -- Buyers can only pick available dates; the owner may offer any dates.
        and (c.owner_id = auth.uid() or public.offer_dates_available(b.id, price_offers.start_date, price_offers.end_date))
    )
    and not exists (
      select 1 from public.price_offers o
      where o.conversation_id = price_offers.conversation_id
        and o.status in ('accepted', 'paid')
    )
  );

drop policy if exists "Owners cancel unpaid price offers" on public.price_offers;
create policy "Owners cancel unpaid price offers" on public.price_offers
  for update to authenticated
  using (
    status in ('pending', 'accepted')
    and exists (select 1 from public.conversations c where c.id = price_offers.conversation_id and c.owner_id = auth.uid())
  )
  with check (
    status = 'cancelled'
    and exists (select 1 from public.conversations c where c.id = price_offers.conversation_id and c.owner_id = auth.uid())
  );

create or replace function public.price_offers_before_update()
returns trigger language plpgsql set search_path = public as $$
declare
  _owner uuid;
begin
  if new.id <> old.id
    or new.conversation_id <> old.conversation_id
    or new.sender_id <> old.sender_id
    or new.amount <> old.amount
    or new.start_date is distinct from old.start_date
    or new.end_date is distinct from old.end_date
    or new.created_at <> old.created_at
  then
    raise exception 'Price offer details cannot be changed';
  end if;

  if new.status = old.status then
    return new;
  end if;

  if old.status = 'paid' then
    raise exception 'This price has been paid and can no longer be changed';
  end if;

  if new.status = 'paid' then
    -- Only the payment backend (service role, no end-user session) may do this.
    if auth.uid() is not null or old.status <> 'accepted' then
      raise exception 'Only a confirmed payment on an accepted price can mark it as paid';
    end if;
    return new;
  end if;

  if new.status = 'cancelled' then
    select owner_id into _owner from public.conversations where id = old.conversation_id;
    if old.status not in ('pending', 'accepted') or auth.uid() is distinct from _owner then
      raise exception 'Only the owner can cancel a price that has not been paid';
    end if;
    return new;
  end if;

  if old.status <> 'pending'
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
