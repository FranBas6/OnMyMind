#!/bin/sh
# Tests de la base (pgTAP) contra el Supabase local: cada archivo de supabase/tests/ va en una
# transacción que se deshace al final y termina con `finish(true)`, que falla si algo falló. Se
# ejecutan con el psql del contenedor de la base: no hace falta la imagen de pg_prove de
# `supabase test db`.
container=supabase_db_onmymind
status=0
for file in supabase/tests/*.test.sql; do
  echo "# $file"
  if out=$(docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q -t < "$file" 2>&1); then
    printf '%s\n' "$out" | grep -E '^ *(ok|not ok|1\.\.|#)' | sed 's/ *+$//'
  else
    printf '%s\n' "$out" | grep -E '^ *(ok|not ok|1\.\.|#)|ERROR' | sed 's/ *+$//'
    status=1
  fi
done
exit $status
