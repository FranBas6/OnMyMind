-- Sesión 3.7 · Los eventos en el Calendario del iPhone (diseño 21, C1–C7 y D6). Un enlace secreto
-- por persona que el Calendario consulta solo, sin sesión: la edge function `calendar-feed` lo
-- recibe en la URL y pide aquí los eventos de quien lo tiene.
--
-- El enlace es la llave, porque el Calendario no sabe iniciar sesión. Se guarda tal cual y no como
-- hash (como decía el plan): la hoja de Perfil lo enseña y lo copia otra vez cuando quieras, desde
-- cualquier dispositivo, y con el hash habría que cambiarlo para volver a verlo. Vive en una tabla
-- propia, que solo lee su dueño y solo escriben las funciones de abajo: así no viaja con el perfil
-- ni sale en «Exportar mis datos». Quien lo tenga ve tus eventos hasta que lo cambies.

-- ─── calendar_feeds ─────────────────────────────────────────────────────────────

create table public.calendar_feeds (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  token       text not null unique check (token ~ '^[A-Za-z0-9_-]{32}$'),
  created_at  timestamptz not null default now()
);

alter table public.calendar_feeds enable row level security;

-- Ver el tuyo; crearlo o cambiarlo, solo con `calendar_token` y `rotate_calendar_token`.
create policy calendar_feeds_select on public.calendar_feeds for select to authenticated
  using (user_id = (select auth.uid()));

-- 24 bytes al azar en base64 para URL: 32 caracteres, 192 bits. No se adivina.
create or replace function public.new_calendar_token()
returns text language sql volatile set search_path = '' as $$
  select translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_')
$$;

-- Tu enlace, o uno nuevo si aún no tenías: abrir la hoja lo crea la primera vez.
create or replace function public.calendar_token()
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  current_token text;
begin
  if uid is null then
    raise exception 'Hace falta una sesión.' using errcode = '42501';
  end if;
  insert into public.calendar_feeds (user_id, token)
  values (uid, public.new_calendar_token())
  on conflict (user_id) do nothing;
  select f.token into current_token from public.calendar_feeds f where f.user_id = uid;
  return current_token;
end
$$;

-- «Cambiar enlace» (C4, C5): uno nuevo, y el anterior deja de funcionar en ese momento.
create or replace function public.rotate_calendar_token()
returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  new_token text;
begin
  if uid is null then
    raise exception 'Hace falta una sesión.' using errcode = '42501';
  end if;
  insert into public.calendar_feeds as f (user_id, token)
  values (uid, public.new_calendar_token())
  on conflict (user_id) do update set token = excluded.token, created_at = now()
  returning f.token into new_token;
  return new_token;
end
$$;

-- ─── Lo que lee el feed ─────────────────────────────────────────────────────────
-- Los eventos de quien tiene el enlace: los de sus listas y los de las compartidas con él, sin las
-- archivadas, los cancelados, los que no tienen día ni los de una sublista ya terminada (lo mismo
-- que el resumen de Hoy). Las fechas salen ya en su zona, como la escribe el reloj: «2026-10-09» o
-- «2026-10-09T21:00:00», para que la función no tenga que convertir nada y la repetición siga en
-- su hora aunque cambie el horario de verano.
--
-- `null` si el enlace no existe, para que la función conteste 404; `[]` si existe y no hay nada.
-- Solo la llama `calendar-feed` con `service_role`: nadie más puede.
create or replace function public.calendar_feed(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  with feed as (
    select f.user_id, public.user_timezone(f.user_id) as tz
    from public.calendar_feeds f
    where f.token = p_token
  )
  select jsonb_build_object(
    'timezone', feed.tz,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id,
               'list_id', i.list_id,
               'list_name', l.name,
               'title', i.title,
               'notes', i.notes,
               'all_day', i.all_day,
               'start', case
                 when i.all_day then to_char(i.due_at at time zone feed.tz, 'YYYY-MM-DD')
                 else to_char(i.due_at at time zone feed.tz, 'YYYY-MM-DD"T"HH24:MI:SS')
               end,
               'recurrence', public.recurrence_rule(i.recurrence),
               'updated_at', i.updated_at
             ) order by i.due_at, i.id)
      from public.lists l
      join public.items i on i.list_id = l.id
      left join public.items p on p.id = i.parent_id
      where l.archived_at is null
        and (l.owner_id = feed.user_id
             or exists (select 1 from public.list_members m
                        where m.list_id = l.id and m.user_id = feed.user_id
                          and m.accepted_at is not null))
        and i.kind = 'event'
        and i.status = 'upcoming'
        and i.due_at is not null
        and (i.parent_id is null or public.is_active_sublist_status(p.status))
    ), '[]'::jsonb)
  )
  from feed
$$;

revoke execute on function public.new_calendar_token() from public, anon, authenticated;
revoke execute on function public.calendar_token() from public, anon;
grant execute on function public.calendar_token() to authenticated;
revoke execute on function public.rotate_calendar_token() from public, anon;
grant execute on function public.rotate_calendar_token() to authenticated;
revoke execute on function public.calendar_feed(text) from public, anon, authenticated;
grant execute on function public.calendar_feed(text) to service_role;
