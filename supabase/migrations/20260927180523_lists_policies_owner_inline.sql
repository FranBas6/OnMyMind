-- Leer y editar listas comprobando primero el propietario en la propia fila (sesión 1.6).
--
-- `is_list_member(id)` busca la lista en `public.lists` con la foto de antes de la sentencia. Al
-- crear una lista con `insert … returning` (lo que hace `.insert().select()` de supabase-js), la
-- fila nueva todavía no está en esa foto: la función devuelve `false`, la política de lectura no
-- deja devolverla y la API responde 403. Mirando `owner_id` en la propia fila, el propietario
-- siempre ve su lista, también la recién creada, y ni siquiera se llama a la función. Los miembros
-- de listas compartidas (fase 3) siguen entrando por `is_list_member`.

drop policy lists_select on public.lists;
create policy lists_select on public.lists for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_list_member(id));

drop policy lists_update on public.lists;
create policy lists_update on public.lists for update to authenticated
  using (owner_id = (select auth.uid()) or public.is_list_member(id))
  with check (owner_id = (select auth.uid()) or public.is_list_member(id));
