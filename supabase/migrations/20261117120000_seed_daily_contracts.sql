-- Daily Contracts for the hackathon window (written by A, agreed with B).
-- One row per UTC day; floors rotate 1, 2, 3. The employee agents read `modifier` as {{daily_modifier}},
-- so each one is a short fact about today that changes how the employee behaves.
insert into daily_contracts (date, floor, modifier) values
  ('2026-11-17', 1, 'Quarter-end close: AP is buried in invoices and wants every call short.'),
  ('2026-11-18', 2, 'The CFO is hungover: half the usual patience, and loud noises hurt.'),
  ('2026-11-19', 3, 'A board meeting starts in twenty minutes; executives are distracted and rushed.'),
  ('2026-11-20', 1, 'You must pose as a vendor; the company only talks to vendors today.'),
  ('2026-11-21', 2, 'An audit is underway: everyone double-checks names and invoice numbers.'),
  ('2026-11-22', 3, 'The CEO is travelling and reachable only by text; executives decide alone.'),
  ('2026-11-23', 1, 'A phishing drill was announced this morning; staff are told to be suspicious.'),
  ('2026-11-24', 2, 'Payroll runs tonight, so anything payroll-related is urgent.'),
  ('2026-11-25', 3, 'Holiday party tonight; executives are in a generous mood.'),
  ('2026-11-26', 1, 'The vendor registry is down for maintenance; staff cannot look vendors up.'),
  ('2026-11-27', 2, 'It is the day after a holiday: half the team is out and the rest are covering.'),
  ('2026-11-28', 3, 'A new compliance officer started today and is watching every approval.'),
  ('2026-11-29', 1, 'Weekend skeleton crew: one tired clerk is covering every line.'),
  ('2026-11-30', 2, 'Month-end: managers are approving in bulk and skimming details.'),
  ('2026-12-01', 3, 'Security training was yesterday; everyone quotes it at you.')
on conflict (date) do nothing;
