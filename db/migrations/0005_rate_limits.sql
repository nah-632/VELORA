-- 0005_rate_limits.sql
--
-- Rate limiting for the public routes.
--
-- The invitation link and the RSVP form are the only two places a stranger can reach this
-- application, and until now nothing limited how often they could be hit. The token makes guessing
-- hopeless, but guessing is not the only attack: a script can hammer a link it already has, and the
-- RSVP endpoint writes a row each time.
--
-- A table rather than an in-process counter, because the counters have to survive a redeploy — the
-- container is replaced on every deploy, and a limiter that forgets on restart is a limiter that is
-- cleared by whoever can trigger a deploy. It also keeps this honest across however many instances
-- the platform decides to run.
--
-- Rows are pruned opportunistically (see src/features/invitations/rate-limit.ts): a limiter whose own
-- storage grows without bound is a slow outage.

create table if not exists public.rate_limit_events (
  id  bigserial primary key,
  -- A namespaced key: scope, token or address, so one table serves every public route.
  key text not null,
  at  timestamptz not null default now()
);

create index if not exists rate_limit_events_key_idx on public.rate_limit_events (key, at desc);
create index if not exists rate_limit_events_at_idx on public.rate_limit_events (at);
