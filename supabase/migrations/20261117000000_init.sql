-- Cold Call: initial schema (written by A for both sides).
-- After this file, each side adds its own timestamped migration and does not edit the other's.

create extension if not exists pgcrypto;

-- ---------- users ----------
create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  wallet_address text unique,
  circle_wallet_id text,
  created_at timestamptz not null default now()
);

-- ---------- daily contracts ----------
create table daily_contracts (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  floor smallint not null check (floor between 0 and 3),
  modifier text not null
);

-- ---------- runs ----------
create table runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  floor smallint not null check (floor between 0 and 3),
  cover text,
  channel text not null default 'chat' check (channel in ('chat', 'voice')),
  started_at timestamptz,            -- set at the first message
  ended_at timestamptz,
  outcome text check (outcome in ('breach', 'lockout', 'timeout', 'quit')),
  tx_hash text,
  duration_ms bigint,                -- block time of TransferExecuted minus started_at
  payout_units numeric(78, 0),
  is_first_clear boolean not null default false,
  hints_used int not null default 0,
  daily_contract_id uuid references daily_contracts (id),
  client_ip inet,
  created_at timestamptz not null default now()
);
create index runs_user_idx on runs (user_id, created_at desc);
create index runs_board_idx on runs (floor, duration_ms) where outcome = 'breach';

-- ---------- conversations ----------
create table conversations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs (id) on delete cascade,
  employee_id text not null,
  channel text not null check (channel in ('chat', 'voice')),
  elevenlabs_conversation_id text unique,
  seconds_used int not null default 0,
  created_at timestamptz not null default now()
);
create index conversations_run_idx on conversations (run_id);

-- ---------- suspicion events ----------
create table suspicion_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs (id) on delete cascade,
  employee_id text not null,
  delta int not null,
  reason text not null,
  level_after int not null check (level_after between 0 and 100),
  created_at timestamptz not null default now()
);
create index suspicion_run_idx on suspicion_events (run_id, created_at);

-- ---------- proposals ----------
create table proposals (
  id uuid primary key default gen_random_uuid(),
  vault text not null,
  onchain_id bigint not null,
  run_id uuid not null references runs (id) on delete cascade,
  kind text not null check (kind in ('transfer', 'allowlist')),
  status text not null default 'open'
    check (status in ('open', 'queued', 'executed', 'added', 'rejected', 'cancelled', 'expired')),
  amount_units numeric(78, 0),
  claimed_name text,
  claimed_amount_units numeric(78, 0),
  unlock_at timestamptz,
  created_at timestamptz not null default now(),
  unique (vault, kind, onchain_id)
);
create index proposals_run_idx on proposals (run_id);

-- ---------- chain events (from the QuickNode Stream; backup path writes source = 'receipt') ----------
create table chain_events (
  tx_hash text not null,
  log_index int not null,
  event text not null,
  vault text not null,
  run_id uuid,
  payload jsonb not null,
  block_number bigint not null,
  block_time timestamptz not null,
  source text not null default 'stream' check (source in ('stream', 'receipt')),
  created_at timestamptz not null default now(),
  primary key (tx_hash, log_index)
);
create index chain_events_run_idx on chain_events (run_id);

-- ---------- player memory and notes ----------
create table player_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  employee_id text not null,
  trick_summary text not null,
  created_at timestamptz not null default now()
);
create index player_memory_idx on player_memory (user_id, employee_id);

create table player_notes (
  user_id uuid not null references users (id) on delete cascade,
  company text not null,
  text text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, company)
);

-- ---------- streaks ----------
create table streaks (
  user_id uuid primary key references users (id) on delete cascade,
  current int not null default 0,
  longest int not null default 0,
  last_completed_date date
);

-- ---------- per-wallet lease (serialises transactions from one sender) ----------
create table wallet_locks (
  wallet text primary key,
  locked_until timestamptz not null default 'epoch',
  holder text
);

-- Returns true if the caller now holds the lease.
create or replace function acquire_wallet_lock(p_wallet text, p_holder text, p_seconds int default 15)
returns boolean
language plpgsql
as $$
declare
  got boolean;
begin
  insert into wallet_locks (wallet) values (p_wallet) on conflict do nothing;
  update wallet_locks
     set locked_until = now() + make_interval(secs => p_seconds), holder = p_holder
   where wallet = p_wallet and locked_until < now()
  returning true into got;
  return coalesce(got, false);
end;
$$;

create or replace function release_wallet_lock(p_wallet text, p_holder text)
returns void
language sql
as $$
  update wallet_locks set locked_until = 'epoch', holder = null
   where wallet = p_wallet and holder = p_holder;
$$;

-- ---------- daily payout budget per vault ----------
create table payout_budget (
  vault text not null,
  day date not null default current_date,
  spent_units numeric(78, 0) not null default 0,
  primary key (vault, day)
);

-- ---------- leaderboard ----------
create view leaderboard as
select
  r.id as run_id,
  r.user_id,
  u.display_name,
  r.floor,
  r.channel,
  r.duration_ms,
  r.tx_hash,
  r.ended_at,
  r.daily_contract_id
from runs r
join users u on u.id = r.user_id
where r.outcome = 'breach'
  and r.tx_hash is not null
  and exists (
    select 1 from chain_events e
     where e.tx_hash = r.tx_hash and e.event = 'TransferExecuted'
  );

-- ---------- row level security ----------
-- The backend uses the service role key, which bypasses RLS.
-- Players (anon/authenticated) may read their own rows and the public board data.
alter table users enable row level security;
alter table runs enable row level security;
alter table conversations enable row level security;
alter table suspicion_events enable row level security;
alter table proposals enable row level security;
alter table chain_events enable row level security;
alter table player_memory enable row level security;
alter table player_notes enable row level security;
alter table streaks enable row level security;
alter table daily_contracts enable row level security;
alter table wallet_locks enable row level security;
alter table payout_budget enable row level security;

create policy users_read on users for select using (true);
create policy runs_read on runs for select using (outcome = 'breach' or user_id = auth.uid());
create policy conversations_own on conversations for select
  using (exists (select 1 from runs r where r.id = run_id and r.user_id = auth.uid()));
create policy suspicion_own on suspicion_events for select
  using (exists (select 1 from runs r where r.id = run_id and r.user_id = auth.uid()));
create policy proposals_own on proposals for select
  using (exists (select 1 from runs r where r.id = run_id and r.user_id = auth.uid()));
create policy chain_events_read on chain_events for select using (true);
create policy notes_own on player_notes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy streaks_read on streaks for select using (true);
create policy daily_read on daily_contracts for select using (true);

-- ---------- realtime ----------
alter publication supabase_realtime add table chain_events, proposals, suspicion_events, runs;
