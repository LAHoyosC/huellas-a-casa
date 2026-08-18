#!/usr/bin/env bash
# Aplica en una base las migraciones de supabase/migrations/ que aún no
# están registradas en la tabla migraciones_aplicadas, en orden, y las
# registra. Lo usan migrar.yml (producción, staging) y verificar.yml
# (staging en cada PR). Cada archivo corre dentro de una transacción: o
# entra completo o no entra.
#
# Uso: bash scripts/ci/aplicar-migraciones.sh "<url postgres>" "<nombre para los mensajes>"
#
# Si la tabla migraciones_aplicadas no existe, NO adivina: para y pide que
# se aplique a mano la migración que la crea (bootstrap, una sola vez).
set -euo pipefail
URL="$1"; DONDE="${2:-la base}"

existe=$(psql "$URL" -X -A -t -c "select to_regclass('public.migraciones_aplicadas') is not null")
if [ "$existe" != "t" ]; then
  echo "::error::En $DONDE no existe la tabla migraciones_aplicadas. Aplica a mano (una vez) supabase/migrations/20260818000005_migraciones_aplicadas.sql y vuelve a lanzar."
  exit 1
fi

psql "$URL" -X -A -t -c "select nombre from migraciones_aplicadas" | sort > aplicadas.txt
ls supabase/migrations/*.sql | xargs -n1 basename | sort > todas.txt
comm -13 aplicadas.txt todas.txt > pendientes.txt

if [ ! -s pendientes.txt ]; then
  echo "$DONDE: al día ($(wc -l < todas.txt) migraciones, ninguna pendiente)."
  exit 0
fi

echo "$DONDE: $(wc -l < pendientes.txt) migración(es) pendiente(s):"; sed 's/^/  - /' pendientes.txt
while read -r f; do
  [ -z "$f" ] && continue
  echo "==> $f"
  psql "$URL" -X -v ON_ERROR_STOP=1 -q -1 -f "supabase/migrations/$f" || {
    echo "::error file=supabase/migrations/$f::Falló al aplicarse en $DONDE. No se registró; las siguientes no se aplicaron. Arregla y relanza el workflow (o avisa a Lau)."; exit 1; }
  psql "$URL" -X -q -c "insert into migraciones_aplicadas (nombre) values ('$f') on conflict do nothing"
  echo "    aplicada y registrada."
done < pendientes.txt
echo "$DONDE: al día."
