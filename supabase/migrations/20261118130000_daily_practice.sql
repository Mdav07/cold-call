-- Daily Case replays (A, .plans/daily-2.md): an earlier day's case is practice. It pays a token, never
-- counts for the daily streak, and never shows on any board.

alter table runs add column if not exists practice boolean not null default false;

create or replace view leaderboard as
select
  r.id as run_id,
  r.user_id,
  u.display_name,
  r.floor,
  r.channel,
  r.duration_ms,
  r.tx_hash,
  r.ended_at,
  r.daily_contract_id,
  r.daily_date
from runs r
join users u on u.id = r.user_id
where r.outcome = 'breach'
  and not r.practice
  and r.tx_hash is not null
  and exists (
    select 1 from chain_events e
     where e.tx_hash = r.tx_hash and e.event = 'TransferExecuted'
  );
