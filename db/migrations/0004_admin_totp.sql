-- 0004_admin_totp.sql
--
-- The second factor, and the short-lived challenge between the password and the session.
--
-- The login flow becomes two steps when TOTP is enrolled:
--
--   password verified  →  a challenge row (5 minutes, single use)  →  code verified  →  session
--
-- The challenge exists as its own row rather than as a flag on a session, because a session that
-- can exist in a "half-authenticated" state is a session that some future code path will treat as
-- authenticated. `getCurrentAdmin()` reads `admin_sessions`; nothing half-way is ever in it.

create table if not exists public.admin_login_challenges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.admin_users (id) on delete cascade,
  -- sha256 of the cookie value, as with sessions: the raw token lives only in the cookie.
  token_hash  text not null unique,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  attempts    integer not null default 0,
  constraint admin_login_challenges_hash_shape check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint admin_login_challenges_expiry_after_creation check (expires_at > created_at),
  constraint admin_login_challenges_attempts_non_negative check (attempts >= 0)
);

create index if not exists admin_login_challenges_active_idx
  on public.admin_login_challenges (user_id) where consumed_at is null;
create index if not exists admin_login_challenges_expiry_idx
  on public.admin_login_challenges (expires_at);

-- The TOTP counter last accepted for this account.
--
-- A code is valid for its whole 30-second step. Without remembering the counter, a code seen over a
-- shoulder — or captured from a screen — is replayable for the rest of that window. Storing the
-- counter makes each code single-use within its step, which is what RFC 6238 §5.2 asks for.
alter table public.admin_users add column if not exists totp_last_counter bigint;

comment on column public.admin_users.totp_confirmed_at is
  'Set only when a code from the enrolled device has been verified. A secret without this is an '
  'enrolment that was started and never finished, and it grants nothing.';
