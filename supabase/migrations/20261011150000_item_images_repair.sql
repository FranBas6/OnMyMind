-- Arreglo entre sesiones (4.7b) · Fotos que se quedaron fuera de `item_images`.
--
-- La migración de la 4.5 pasó a `item_images` las fotos que había entonces. Pero subió antes que
-- el código, y en ese rato la app publicada (la 4.4) guardó alguna foto a la antigua: solo en
-- `items.image_path`. La fila la enseña (lee `items`), pero la ficha no (lee `item_images`), y no
-- se puede ordenar, cambiar ni quitar. Aquí cada una pasa a ser la primera foto de su cosa.
-- `item_images_sync` vuelve a escribir la misma ruta en la cosa.

insert into public.item_images (item_id, path, position, created_at)
select i.id, i.image_path,
       coalesce((select min(g.position) from public.item_images g where g.item_id = i.id), 2000)
         - 1000,
       i.updated_at
from public.items i
where i.image_path is not null
  and not exists (select 1 from public.item_images g
                  where g.item_id = i.id and g.path = i.image_path);
