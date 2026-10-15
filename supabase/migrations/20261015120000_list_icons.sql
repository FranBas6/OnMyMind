-- Sesión 5.9 · Iconos y emojis en las listas (diseño 28).
--   · `lists.icon` existe desde el esquema inicial («null = inicial del nombre») y nunca se ha
--     usado. Ahora guarda un icono de lucide (`lucide:house`) o un emoji (`emoji:✈️`); `null`
--     sigue siendo la inicial. Un `check` del formato, para que la app sepa siempre leerlo.
--   · La invitación enseña el cuadrado de la lista (diseño 20, J2): `list_invite_preview` gana
--     `list_icon`.
--   · Duplicar ya copia `icon` (`duplicate_list`), y exportar lo lleva (`select *`).
-- Referencia: docs/plans/05-fase-5.md (5.9) y docs/concept/06-diseno-y-ui.md §Iconos de lista.

-- ─── El formato ──────────────────────────────────────────────────────────────────────────────

-- Lo que hubiera de antes que no siga el formato vuelve a la inicial (no debería haber nada).
update public.lists
set icon = null
where icon is not null and icon !~ '^(lucide:[a-z0-9]+(-[a-z0-9]+)*|emoji:\S{1,16})$';

alter table public.lists
  add constraint lists_icon_check check (
    icon is null
    or (char_length(icon) <= 48 and icon ~ '^(lucide:[a-z0-9]+(-[a-z0-9]+)*|emoji:\S{1,16})$')
  );

comment on column public.lists.icon is
  'El cuadrado de la lista (5.9): «lucide:<nombre>» o «emoji:<emoji>»; null = la inicial del nombre.';

-- ─── La invitación, con el icono ─────────────────────────────────────────────────────────────
-- Como en `list_sharing` (3.2), con `list_icon` al final.
drop function public.list_invite_preview(text);

create function public.list_invite_preview(p_token text)
returns table (
  status text, list_id uuid, list_name text, list_color text, list_kind public.list_kind,
  pending_count integer, inviter_name text, member_since timestamptz, list_icon text)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  inv record;
  joined timestamptz;
begin
  select i.list_id, i.expires_at, i.revoked_at, l.name, l.color, l.kind, l.owner_id,
         l.archived_at, l.icon, p.display_name
    into inv
  from public.list_invites i
  join public.lists l on l.id = i.list_id
  left join public.profiles p on p.id = i.created_by
  where i.token = p_token;

  if not found then
    return query select 'unknown'::text, null::uuid, null::text, null::text,
                        null::public.list_kind, null::integer, null::text, null::timestamptz,
                        null::text;
    return;
  end if;

  if uid is not null then
    select m.accepted_at into joined from public.list_members m
    where m.list_id = inv.list_id and m.user_id = uid and m.accepted_at is not null;
  end if;

  return query select
    case
      when uid is not null and inv.owner_id = uid then 'own'
      when joined is not null then 'member'
      when inv.revoked_at is not null or inv.archived_at is not null then 'revoked'
      when inv.expires_at <= now() then 'expired'
      else 'valid'
    end,
    inv.list_id, inv.name, inv.color, inv.kind,
    (select count(*)::integer from public.items it
     where it.list_id = inv.list_id and it.completed_at is null and it.kind <> 'sublist'),
    inv.display_name, joined, inv.icon;
end
$$;

revoke execute on function public.list_invite_preview(text) from public;
grant execute on function public.list_invite_preview(text) to anon, authenticated;
