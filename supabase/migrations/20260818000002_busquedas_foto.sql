-- Foto opcional en la busqueda del tutor, para que los voluntarios cotejen.
-- Vive en R2 bajo <entorno>/busquedas/<id>/..., aparte de las fotos de las
-- fichas; el respaldo semanal copia el bucket entero, asi que entra sola.
-- No se muestra en el listado publico: solo la ve el tutor con su numero de
-- registro y los voluntarios en el panel.
alter table busquedas add column if not exists foto_url text;
alter table busquedas add column if not exists foto_thumb_url text;

drop function if exists consultar_busqueda(text);
create or replace function consultar_busqueda(p_codigo text)
returns table (
  codigo text, estado text, creado_en timestamptz,
  especie text, raza text, tamano text, color text, pelo text, sexo text, edad text,
  orejas text, cola text, senas text[], collar_color text,
  departamento text, municipio text, barrio text, nota text, nombres text,
  tiene_contacto boolean, contacto_medio text,
  foto_url text, foto_thumb_url text
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
         b.contacto_medio,
         b.foto_url, b.foto_thumb_url
  from busquedas b
  where b.codigo = upper(trim(p_codigo))
  limit 1;
$$;
revoke all on function consultar_busqueda(text) from public;
grant execute on function consultar_busqueda(text) to anon, authenticated;
