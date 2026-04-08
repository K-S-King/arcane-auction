-- ============================================
-- ARCANE AUCTION — Supabase Database Setup
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create the auctions table
create table if not exists auctions (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  host text not null,
  image_url text,
  current_bid numeric default 0,
  highest_bidder text default '',
  status text default 'upcoming' check (status in ('live', 'upcoming', 'ended')),
  end_time timestamptz not null,
  created_at timestamptz default now(),
  bid_locked boolean default false,
  category text
);

-- 2. Create the bids table
create table if not exists bids (
  id uuid default gen_random_uuid() primary key,
  auction_id uuid references auctions(id) on delete cascade,
  bidder text not null,
  amount numeric not null,
  created_at timestamptz default now()
);

-- 3. Enable Row Level Security (required by Supabase)
alter table auctions enable row level security;
alter table bids enable row level security;

-- 4. Allow public read/write (for demo — tighten for prod)
drop policy if exists "Allow public read auctions" on auctions;
drop policy if exists "Allow public insert auctions" on auctions;
drop policy if exists "Allow public update auctions" on auctions;
drop policy if exists "Allow public read bids" on bids;
drop policy if exists "Allow public insert bids" on bids;

create policy "Allow public read auctions"  on auctions for select using (true);
create policy "Allow public insert auctions" on auctions for insert with check (true);
create policy "Allow public update auctions" on auctions for update using (true);

create policy "Allow public read bids"  on bids for select using (true);
create policy "Allow public insert bids" on bids for insert with check (true);

-- 5. Enable Realtime on both tables
alter publication supabase_realtime drop table auctions;
alter publication supabase_realtime drop table bids;
alter publication supabase_realtime add table auctions;
alter publication supabase_realtime add table bids;
