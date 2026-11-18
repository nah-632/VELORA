-- 0002_admin_auth.sql
--
-- One administrator, credentials only. ADDENDUM E: "no public sign-up"; the initial account comes
-- from environment variables at seed time (scripts/seed-admin.mjs), and nothing here accepts a
-- self-service registration.
--
-- The password is stored as an argon2id hash and the constraint enforces it: a row that carries a
-- bcrypt hash, a plaintext password or an md5 digest cannot be inserted at all. A schema that
-- merely *expects* a hash is a schema that will one day hold something else.
--
-- Session tokens are stored **hashed**. The cookie is the only place the raw token exists, so a
-- dump of this table does not let anyone log in.

create table if not exists public.admin_users (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null,
  password_hash       text not null,
  -- Optional TOTP second factor (ADDENDUM E). The columns exist and are unused until the settings
  -- screen that enrols them is built; carrying them now avoids a migration on a live table later.
  totp_secret         text,
  totp_confirmed_at   timestamptz,
  failed_attempts     integer not null default 0,
  locked_until        timestamptz,
  last_login_at       timestamptz,
  password_changed_at timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint admin_users_email_shape check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$'),
  constraint admin_users_password_is_argon2id check (password_hash ~ '^\$argon2id\$'),
  constraint admin_users_failed_attempts_non_negative check (failed_attempts >= 0)
);

-- Case-insensitive uniqueness without an extension: `citext` would need one, and this schema
-- requires none so that it runs on a plain managed PostgreSQL.
create unique index if not exists admin_users_email_unique on public.admin_users (lower(email));

comment on column public.admin_users.failed_attempts is
  'Consecutive failures since the last success. Reset to 0 on a successful login.';

-- ---------------------------------------------------------------------------------------------
-- Sessions. A row per login, revocable on its own.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.admin_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.admin_users (id) on delete cascade,
  -- sha256 of the cookie value, hex. The raw token is never stored.
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  -- Hashed, with a server-side pepper: an IP address is personal data, and a table of the
  -- operator's own login addresses is not worth keeping in the clear.
  ip_hash      text,
  user_agent   text,
  constraint admin_sessions_token_hash_shape check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint admin_sessions_expiry_after_creation check (expires_at > created_at)
);

create index if not exists admin_sessions_active_idx
  on public.admin_sessions (user_id) where revoked_at is null;
create index if not exists admin_sessions_expiry_idx on public.admin_sessions (expires_at);

-- ---------------------------------------------------------------------------------------------
-- Attempts, for rate limiting and lockout. Kept as an append-only log rather than counters,
-- because "who tried, from where, and when" is the question actually asked after an incident.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.admin_login_attempts (
  id               bigserial primary key,
  email_normalized text not null,
  ip_hash          text not null,
  succeeded        boolean not null,
  attempted_at     timestamptz not null default now()
);

create index if not exists admin_login_attempts_recent_idx
  on public.admin_login_attempts (attempted_at desc);
create index if not exists admin_login_attempts_email_idx
  on public.admin_login_attempts (email_normalized, attempted_at desc);
create index if not exists admin_login_attempts_ip_idx
  on public.admin_login_attempts (ip_hash, attempted_at desc);

-- ---------------------------------------------------------------------------------------------
-- updated_at, same mechanism as 0001.
-- ---------------------------------------------------------------------------------------------
do $$
begin
  drop trigger if exists admin_users_touch on public.admin_users;
  create trigger admin_users_touch before update on public.admin_users
    for each row execute function public.touch_updated_at();
end
$$;
