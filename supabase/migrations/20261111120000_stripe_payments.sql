-- Stripe payments (test mode first): seller payout accounts and one payment per paid offer.
-- Clients can only read their own rows. All writes come from the server with the service role.

create table if not exists public.seller_payout_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.seller_payout_accounts enable row level security;

drop policy if exists "Sellers read own payout account" on public.seller_payout_accounts;
create policy "Sellers read own payout account" on public.seller_payout_accounts
  for select to authenticated using (user_id = auth.uid());

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.price_offers(id),
  conversation_id uuid not null references public.conversations(id),
  buyer_id uuid not null,
  seller_id uuid not null,
  currency text not null,
  rental_cents integer not null check (rental_cents > 0),
  buyer_fee_cents integer not null check (buyer_fee_cents >= 0),
  seller_fee_cents integer not null check (seller_fee_cents >= 0),
  buyer_total_cents integer not null check (buyer_total_cents > 0),
  seller_payout_cents integer not null check (seller_payout_cents > 0),
  start_date date not null,
  end_date date not null,
  -- pending: checkout started; paid: money collected, seller not paid yet;
  -- transferred: seller paid after pick-up; refunded / expired: no charter.
  status text not null default 'pending' check (status in ('pending', 'paid', 'transferred', 'refunded', 'expired')),
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_transfer_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  transferred_at timestamptz,
  refunded_at timestamptz
);

-- A charter can only be paid once.
create unique index if not exists payments_one_paid_per_offer
  on public.payments (offer_id) where status in ('paid', 'transferred');
create index if not exists payments_due_payouts on public.payments (status, start_date);

alter table public.payments enable row level security;

drop policy if exists "Participants read own payments" on public.payments;
create policy "Participants read own payments" on public.payments
  for select to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid());
