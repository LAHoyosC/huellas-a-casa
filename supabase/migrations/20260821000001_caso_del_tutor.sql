-- El tutor que no encuentra a su mascota vuelve a intentar con otra
-- combinación y deja varias búsquedas sueltas. Estas funciones le permiten
-- unirlas ÉL MISMO al registrar, sin exponer ningún teléfono:
--
--   caso_con_mismo_telefono(id) -> ¿hay otra búsqueda abierta reciente con mi
--                                  mismo teléfono? Devuelve código/fecha/nombre,
--                                  NUNCA el contacto.
--   unir_mi_busqueda(id)        -> marca mi búsqueda como duplicada de esa.
--   consultar_caso(codigo)      -> todas las búsquedas del caso (para que el
--                                  tutor vea los resultados de todas juntas).
--
-- Privacidad: las dos primeras se consultan por el id (uuid) de la búsqueda
-- recién creada. Ese uuid lo genera el navegador del tutor y no se muestra a
-- nadie más: quien lo conoce es quien acaba de registrarla. Nadie puede
-- sondear teléfonos ajenos (no reciben teléfono como parámetro) y solo se
-- sugiere si la otra búsqueda es de las últimas 24 horas: probar
-- combinaciones se hace el mismo día, y así la ventana queda corta.

create or replace function telefono_normalizado(t text)
returns text
language sql
immutable
as $$
  -- Solo dígitos y los últimos 10: así +57 300... y 300... son el mismo.
  select right(regexp_replace(coalesce(t, ''), '\D', '', 'g'), 10)
$$;

drop function if exists caso_con_mismo_telefono(uuid);
create or replace function caso_con_mismo_telefono(p_id uuid)
returns table (codigo text, creado_en timestamptz, nombres text)
language sql
security definer
set search_path = public
stable
as $$
  select o.codigo, o.creado_en, o.nombres
  from busquedas m
  join busquedas o
    on o.id <> m.id
   and telefono_normalizado(o.contacto_telefono) = telefono_normalizado(m.contacto_telefono)
   and o.estado = 'abierta'
   and o.duplicada_de is null
   and o.creado_en > now() - interval '24 hours'
  where m.id = p_id
    and telefono_normalizado(m.contacto_telefono) <> ''
  order by o.creado_en asc
  limit 1;
$$;

drop function if exists unir_mi_busqueda(uuid);
create or replace function unir_mi_busqueda(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_principal busquedas%rowtype;
begin
  -- La principal la decide la base con las mismas condiciones de la
  -- sugerencia: no se confía en nada que venga del navegador.
  select o.* into v_principal
  from busquedas m
  join busquedas o
    on o.id <> m.id
   and telefono_normalizado(o.contacto_telefono) = telefono_normalizado(m.contacto_telefono)
   and o.estado = 'abierta'
   and o.duplicada_de is null
   and o.creado_en > now() - interval '24 hours'
  where m.id = p_id
    and telefono_normalizado(m.contacto_telefono) <> ''
    and m.estado = 'abierta'
  order by o.creado_en asc
  limit 1;

  if v_principal.id is null then return null; end if;
  update busquedas set duplicada_de = v_principal.id
   where id = p_id or duplicada_de = p_id;
  return v_principal.codigo;
end;
$$;

-- Todas las búsquedas del caso, por cualquiera de sus códigos, sin contacto.
-- Mismas columnas que consultar_busqueda; la primera fila es la principal.
drop function if exists consultar_caso(text);
create or replace function consultar_caso(p_codigo text)
returns table (
  codigo text, estado text, creado_en timestamptz,
  especie text, raza text, tamano text, color text, pelo text, sexo text, edad text,
  orejas text, cola text, senas text[], senas_donde text, collar_color text,
  departamento text, municipio text, barrio text, nota text, nombres text,
  tiene_contacto boolean, contacto_medio text,
  foto_url text, foto_thumb_url text
)
language sql
security definer
set search_path = public
stable
as $$
  with raiz as (
    select coalesce(b.duplicada_de, b.id) as id
    from busquedas b
    where b.codigo = upper(trim(p_codigo))
    limit 1
  )
  select b.codigo, b.estado, b.creado_en,
         b.especie, b.raza, b.tamano, b.color, b.pelo, b.sexo, b.edad,
         b.orejas, b.cola, b.senas, b.senas_donde, b.collar_color,
         b.departamento, b.municipio, b.barrio, b.nota, b.nombres,
         (b.contacto_telefono is not null and b.contacto_telefono <> '') as tiene_contacto,
         b.contacto_medio,
         b.foto_url, b.foto_thumb_url
  from busquedas b, raiz
  where b.id = raiz.id or b.duplicada_de = raiz.id
  order by b.creado_en asc;
$$;

-- «Ya apareció» cierra el caso completo: la principal y sus duplicadas.
create or replace function cerrar_busqueda(p_codigo text)
returns boolean
language sql
security definer
set search_path = public
as $$
  with raiz as (
    select coalesce(b.duplicada_de, b.id) as id
    from busquedas b
    where b.codigo = upper(trim(p_codigo))
    limit 1
  )
  update busquedas b set estado = 'resuelta'
  from raiz
  where (b.id = raiz.id or b.duplicada_de = raiz.id) and b.estado = 'abierta'
  returning true;
$$;

revoke all on function caso_con_mismo_telefono(uuid) from public;
revoke all on function unir_mi_busqueda(uuid) from public;
revoke all on function consultar_caso(text) from public;
revoke all on function cerrar_busqueda(text) from public;
grant execute on function caso_con_mismo_telefono(uuid) to anon, authenticated;
grant execute on function unir_mi_busqueda(uuid) to anon, authenticated;
grant execute on function consultar_caso(text) to anon, authenticated;
grant execute on function cerrar_busqueda(text) to anon, authenticated;
