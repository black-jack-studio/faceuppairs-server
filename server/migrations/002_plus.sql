-- Pairs+ owners get a crown on the leaderboards. Set only after the server checked the purchase
-- with RevenueCat, never on the app's word.
alter table players add column if not exists plus boolean not null default false;
