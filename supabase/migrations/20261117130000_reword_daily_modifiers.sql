-- B: two Daily Contract modifiers that didn't fit their floor or the tools.
-- Nov 18 is a Floor 2 contract but named the CFO (Floor 3); Nov 26 said staff can't look vendors
-- up, but every employee's vendor lookup tool still works.
update daily_contracts
   set modifier = 'Annie''s label printer died this morning: she''s flustered and wants requests short.'
 where date = '2026-11-18';

update daily_contracts
   set modifier = 'The vendor registry is painfully slow today; staff hate every lookup and may skip one if you sound legit.'
 where date = '2026-11-26';
