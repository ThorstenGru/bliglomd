-- Stripe subscription fields on profiles
alter table public.profiles
  add column if not exists stripe_customer_id     text unique,
  add column if not exists stripe_subscription_id text unique,
  add column if not exists subscription_status    text not null default 'inactive';

-- Fast lookup from webhook (customer.* events arrive with customer ID only)
create index if not exists idx_profiles_stripe_customer
  on public.profiles(stripe_customer_id)
  where stripe_customer_id is not null;

comment on column public.profiles.stripe_customer_id     is 'Stripe cus_xxx — set on first checkout';
comment on column public.profiles.stripe_subscription_id is 'Stripe sub_xxx — set on checkout.session.completed';
comment on column public.profiles.subscription_status    is 'inactive | active | past_due | canceled';
