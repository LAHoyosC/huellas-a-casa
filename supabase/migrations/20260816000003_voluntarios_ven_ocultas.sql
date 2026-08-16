-- Los voluntarios pueden ver tambien las fichas ocultas (para revisarlas o
-- volver a mostrarlas). El publico sigue viendo solo las no ocultas.

drop policy if exists mascotas_lectura_voluntarios on mascotas;
create policy mascotas_lectura_voluntarios on mascotas
  for select to authenticated
  using (es_voluntario());
