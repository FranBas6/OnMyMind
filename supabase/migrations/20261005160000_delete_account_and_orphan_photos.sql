-- Sesión 2.8 · Perfil completo (plan 02-fase-2; 08 B.11 y 03 §Storage). Borrar la cuenta de verdad
-- y que las fotos que ya no usa nadie dejen de ocupar sitio.
--
-- Supabase no deja borrar archivos de Storage con SQL (el trigger `storage.protect_delete`): se
-- borran con la API de Storage, desde la app, con las políticas por carpeta de la 2a.6. Por eso
-- aquí solo se dice *cuáles*: la app los borra y, para la cuenta, después llama a
-- `delete_own_account`, que no sigue si aún queda alguno. Así nunca quedan fotos sin dueño.

-- Las fotos de tu carpeta que no usa ningún ítem (ni su miniatura, `…-thumb.ext`). Una foto se
-- comparte entre un ítem y su copia («Duplicar» copia `image_path`), así que no basta con mirar
-- el ítem que cambió: se mira si la usa alguno. Lo subido hace menos de 10 minutos no cuenta, que
-- puede ser una foto que aún se está guardando en su ítem.
create or replace function public.orphan_photos()
returns setof text language sql stable set search_path = '' as $$
  with used as (
    select i.image_path as name from public.items i where i.image_path is not null
    union all
    select regexp_replace(i.image_path, '(\.[a-z0-9]+)$', '-thumb\1', 'i')
    from public.items i where i.image_path is not null
  )
  select o.name
  from storage.objects o
  where o.bucket_id = 'item-images'
    and (storage.foldername(o.name))[1] = (select auth.uid())::text
    and o.created_at < now() - interval '10 minutes'
    and not exists (select 1 from used u where u.name = o.name)
  order by o.name
$$;

-- Todas las fotos de tu carpeta, para borrarlas antes de la cuenta.
create or replace function public.own_photos()
returns setof text language sql stable set search_path = '' as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'item-images'
    and (storage.foldername(o.name))[1] = (select auth.uid())::text
  order by o.name
$$;

-- Borra tu cuenta: tu fila de `auth.users`, y las cascadas se llevan el perfil, las listas (la
-- inbox incluida, 1.1), los ítems, los enlaces, el histórico de precios, los avisos y las
-- suscripciones. Las sesiones de todos tus dispositivos se acaban con ella. Antes, la app ha
-- borrado tus fotos: si queda alguna, no sigue.
create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Hace falta una sesión.' using errcode = '42501';
  end if;
  if exists (
    select 1 from storage.objects o
    where o.bucket_id = 'item-images' and (storage.foldername(o.name))[1] = uid::text
  ) then
    raise exception 'Aún quedan fotos por borrar.' using errcode = '55000';
  end if;
  delete from auth.users u where u.id = uid;
end
$$;

revoke execute on function public.orphan_photos() from public, anon;
revoke execute on function public.own_photos() from public, anon;
revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.orphan_photos() to authenticated;
grant execute on function public.own_photos() to authenticated;
grant execute on function public.delete_own_account() to authenticated;
