-- Estado del caso: el tutor consulta su busqueda con el numero de registro.
--
-- El publico no puede leer la tabla busquedas (RLS), y no debe: ahi estan
-- los contactos. Estas dos funciones son la unica puerta, y es estrecha:
--   consultar_busqueda(codigo)  -> esa busqueda, por codigo exacto, SIN el
--                                  contacto (solo dice si dejo uno y por que medio).
--   cerrar_busqueda(codigo)     -> la marca resuelta ("ya aparecio").
-- Un codigo tiene 31^5 combinaciones (28 millones): adivinarlo no es practico
-- y lo unico que se veria son rasgos de un animal, sin datos de la persona.

create or replace function consultar_busqueda(p_codigo text)
returns table (
  codigo text, estado text, creado_en timestamptz,
  especie text, raza text, tamano text, color text, pelo text, sexo text, edad text,
  orejas text, cola text, senas text[], collar_color text,
  departamento text, municipio text, barrio text, nota text, nombres text,
  tiene_contacto boolean, contacto_medio text
)
language sql
security definer
set search_path = public
stable
as $$
  select b.codigo, b.estado, b.creado_en,
         b.especie, b.raza, b.tamano, b.color, b.pelo, b.sexo, b.edad,
         b.orejas, b.cola, b.senas, b.collar_color,
         b.departamento, b.municipio, b.barrio, b.nota, b.nombres,
         (b.contacto_telefono is not null and b.contacto_telefono <> '') as tiene_contacto,
         b.contacto_medio
  from busquedas b
  where b.codigo = upper(trim(p_codigo))
  limit 1;
$$;

create or replace function cerrar_busqueda(p_codigo text)
returns boolean
language sql
security definer
set search_path = public
as $$
  update busquedas set estado = 'resuelta'
  where codigo = upper(trim(p_codigo)) and estado = 'abierta'
  returning true;
$$;

revoke all on function consultar_busqueda(text) from public;
revoke all on function cerrar_busqueda(text) from public;
grant execute on function consultar_busqueda(text) to anon, authenticated;
grant execute on function cerrar_busqueda(text) to anon, authenticated;
