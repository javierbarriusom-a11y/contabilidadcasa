-- E9-2: referencias PSD2 cifradas. Las credenciales del proveedor permanecen en el gestor de secretos del backend.
create table if not exists public.finance_bank_connections (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  provider text not null,
  status text not null check (status in ('disconnected','authorizing','active','reauth-required','revoked','error')),
  provider_reference_ciphertext bytea not null,
  encryption_key_id text not null,
  consent_expires_at timestamptz,
  last_synced_at timestamptz,
  next_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.finance_bank_accounts (
  id uuid primary key,
  connection_id uuid not null references public.finance_bank_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  provider_account_hash text not null,
  label text not null,
  masked_reference text not null,
  currency text not null,
  account_type text not null,
  active boolean not null default true,
  unique (connection_id, provider_account_hash)
);
alter table public.finance_bank_connections enable row level security;
alter table public.finance_bank_accounts enable row level security;
drop policy if exists finance_bank_connections_select_own on public.finance_bank_connections;
create policy finance_bank_connections_select_own on public.finance_bank_connections for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists finance_bank_accounts_select_own on public.finance_bank_accounts;
create policy finance_bank_accounts_select_own on public.finance_bank_accounts for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.finance_bank_connections to authenticated;
grant select on public.finance_bank_accounts to authenticated;
-- Altas, cambios, revocaciones y descifrado quedan exclusivamente en backend service_role.
