-- The Daily Case (A, .plans/daily.md): runs on floor 4, one case per UTC date.
-- Floor 4 pays from the Pocket Branch vault; it never unlocks or locks Floors 0-3.

alter table runs drop constraint if exists runs_floor_check;
alter table runs add constraint runs_floor_check check (floor between 0 and 4);

-- The case date the run was started on (a run that ends after midnight UTC still counts for its case).
alter table runs add column if not exists daily_date date;

create index if not exists runs_daily_board_idx on runs (daily_date, duration_ms)
  where floor = 4 and outcome = 'breach';

-- The public board gains the case date (new columns go at the end of a replaced view).
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
  and r.tx_hash is not null
  and exists (
    select 1 from chain_events e
     where e.tx_hash = r.tx_hash and e.event = 'TransferExecuted'
  );
