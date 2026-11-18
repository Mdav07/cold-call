-- What the player talked the employee into paying (the story amount), capped by the floor's
-- per-transfer limit. The chain may send less (PAYOUT_CEILING_UNITS: a 1-cent token on testnet);
-- payout_units stays the real on-chain amount, and the player is shown cracked_units.
alter table runs add column if not exists cracked_units numeric(78, 0);
