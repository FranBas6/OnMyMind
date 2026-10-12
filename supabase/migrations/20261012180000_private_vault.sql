-- Sesión 5.6 · La clave privada (ADR-013).
--   · `private_vaults`, una por persona: la clave de la caja (al azar, AES-GCM de 256 bits) cifrada
--     con la clave privada (PBKDF2-SHA256 en el aparato), y un comprobador para saber que lo
--     descifrado es la clave de verdad. La base nunca ve la clave privada ni la de la caja.
--   · `private_vault_keys`, una por llave de acceso (Face ID, la huella, Touch ID, Windows Hello):
--     la misma clave de la caja cifrada con lo que da esa llave (la extensión PRF de WebAuthn).
--   · Cambiar la clave privada vuelve a cifrar la misma clave de la caja: lo protegido y las llaves
--     siguen valiendo. Crear otra porque se olvidó (`reset_private_vault`) cambia la clave de la
--     caja y pide haber entrado con un código por email hace poco: lo de antes se pierde.
-- Referencia: docs/concept/decisiones/ADR-013-que-protege-lo-privado.md, docs/concept/03 y
-- docs/plans/05-fase-5.md (5.6).

-- ─── La caja ─────────────────────────────────────────────────────────────────────────────────

create table public.private_vaults (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- Cuál es la clave de la caja: cambia solo al crear otra porque se olvidó. Lo que se proteja
  -- (5.7) dice con cuál, para saber qué se perdió.
  key_id uuid not null default gen_random_uuid(),
  kdf text not null default 'pbkdf2-sha256' check (kdf = 'pbkdf2-sha256'),
  kdf_iterations integer not null check (kdf_iterations between 100000 and 10000000),
  -- Base64. La sal, de 16 bytes; el vector de AES-GCM, de 12; la clave cifrada, 32 + 16 de la
  -- etiqueta; el comprobador, 32 (SHA-256).
  kdf_salt text not null check (char_length(kdf_salt) between 16 and 64),
  wrap_iv text not null check (char_length(wrap_iv) between 12 and 32),
  wrapped_key text not null check (char_length(wrapped_key) between 32 and 128),
  key_check text not null check (char_length(key_check) between 32 and 128),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.private_vaults is
  'La clave de la caja de cada persona, cifrada con su clave privada (5.6, ADR-013).';

alter table public.private_vaults enable row level security;

-- Cada uno la suya. Sin borrar: crear otra es `reset_private_vault`.
create policy private_vaults_select on public.private_vaults for select to authenticated
  using (user_id = (select auth.uid()));
create policy private_vaults_insert on public.private_vaults for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy private_vaults_update on public.private_vaults for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Cambiar la clave privada solo vuelve a cifrar la misma clave de la caja: ni cuál es ni su
-- comprobador cambian. Así, con la sesión abierta de otro, no se cuela una caja nueva sin el
-- código por email.
create function public.private_vaults_before_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.user_id <> old.user_id or new.key_id <> old.key_id or new.key_check <> old.key_check
     or new.created_at <> old.created_at then
    raise exception 'La clave de la caja no cambia al cambiar la clave privada'
      using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end
$$;

create trigger private_vaults_before_update
  before update on public.private_vaults
  for each row execute function public.private_vaults_before_update();

-- ─── Las llaves de acceso ────────────────────────────────────────────────────────────────────

create table public.private_vault_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Base64url, como lo da WebAuthn.
  credential_id text not null check (char_length(credential_id) between 16 and 1400),
  -- Lo que se le pide a la llave (PRF): 32 bytes al azar, en base64.
  prf_salt text not null check (char_length(prf_salt) between 32 and 64),
  wrap_iv text not null check (char_length(wrap_iv) between 12 and 32),
  wrapped_key text not null check (char_length(wrapped_key) between 32 and 128),
  key_id uuid not null,
  -- Para los textos: «Face ID» en «iPhone» («Si en tu iPhone desbloqueas con Face ID…»).
  method text not null check (char_length(method) between 1 and 40),
  device text not null check (char_length(device) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (user_id, credential_id)
);

comment on table public.private_vault_keys is
  'La clave de la caja cifrada con una llave de acceso de un aparato (5.6, ADR-013).';

alter table public.private_vault_keys enable row level security;

create policy private_vault_keys_select on public.private_vault_keys for select to authenticated
  using (user_id = (select auth.uid()));
create policy private_vault_keys_insert on public.private_vault_keys for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy private_vault_keys_delete on public.private_vault_keys for delete to authenticated
  using (user_id = (select auth.uid()));

-- Una llave guarda la clave de la caja de ahora, no la de antes.
create function public.private_vault_keys_before_insert()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.private_vaults v where v.user_id = new.user_id and v.key_id = new.key_id
  ) then
    raise exception 'Esa llave no es de tu clave privada de ahora' using errcode = '23503';
  end if;
  return new;
end
$$;

create trigger private_vault_keys_before_insert
  before insert on public.private_vault_keys
  for each row execute function public.private_vault_keys_before_insert();

-- ─── Crear otra porque se olvidó ─────────────────────────────────────────────────────────────

-- Si quien pregunta ha entrado con un código por email en los últimos diez minutos: el JWT lo
-- dice en `amr` (el método y cuándo). Es lo que pide «He olvidado la clave» antes de crear otra.
create function public.has_recent_email_code()
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as m
    where m ->> 'method' in ('otp', 'magiclink')
      and to_timestamp((m ->> 'timestamp')::double precision) > now() - interval '10 minutes'
  )
$$;

-- Una caja nueva en lugar de la de antes: otra clave de la caja, sin las llaves de antes (que
-- guardaban la vieja). Lo protegido con la vieja ya no se abre. Necesita el código por email.
create function public.reset_private_vault(
  p_kdf_iterations integer,
  p_kdf_salt text,
  p_wrap_iv text,
  p_wrapped_key text,
  p_key_check text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  new_key uuid := gen_random_uuid();
begin
  if uid is null then
    raise exception 'Sin sesión' using errcode = '42501';
  end if;
  if not public.has_recent_email_code() then
    raise exception 'Para crear otra clave hace falta el código por email' using errcode = '42501';
  end if;

  delete from public.private_vault_keys where user_id = uid;
  delete from public.private_vaults where user_id = uid;
  insert into public.private_vaults
    (user_id, key_id, kdf_iterations, kdf_salt, wrap_iv, wrapped_key, key_check)
  values (uid, new_key, p_kdf_iterations, p_kdf_salt, p_wrap_iv, p_wrapped_key, p_key_check);
  return new_key;
end
$$;

revoke execute on function public.reset_private_vault(integer, text, text, text, text) from public, anon;
grant execute on function public.reset_private_vault(integer, text, text, text, text) to authenticated;
