-- Datos de mentira para el CI: se cargan DESPUÉS de aplicar las migraciones
-- que ya están en main y ANTES de aplicar las nuevas del PR. Así una
-- migración nueva se prueba contra filas reales (con todos los estados y
-- columnas llenas), no contra una base vacía: un "set not null" o un
-- "check" nuevo que rompa filas viejas se ve aquí, no en producción.
--
-- Corre como superusuario (salta RLS). No es la semilla de staging
-- (scripts/semilla-staging.py): esta es mínima y determinista.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'voluntaria.ci@example.invalid'),
  ('00000000-0000-0000-0000-000000000002', 'inactivo.ci@example.invalid')
on conflict do nothing;

insert into voluntarios (id, nombre, refugio, activo) values
  ('00000000-0000-0000-0000-000000000001', 'Voluntaria CI', 'Refugio CI', true),
  ('00000000-0000-0000-0000-000000000002', 'Ex voluntario', 'Refugio CI', false)
on conflict do nothing;

-- 30 fichas: mezcla de especies, estados, verificadas o no, con y sin foto,
-- con nota, señas, contacto y todas las columnas que existen hoy.
insert into mascotas (especie, tamano, color, pelo, sexo, edad, orejas, cola, senas, collar_color,
                      departamento, municipio, barrio, fecha_hallazgo, custodio, lugar,
                      contacto_nombre, contacto_telefono, contacto_medio, nota,
                      foto_url, foto_thumb_url, estado, verificado)
select
  (array['Perro','Gato','Otro'])[1 + n % 3],
  (array['Pequeño','Mediano','Grande'])[1 + n % 3],
  (array['Negro','Café','Blanco','Atigrado'])[1 + n % 4],
  (array['Corto','Medio','Largo'])[1 + n % 3],
  (array['Macho','Hembra','No sé'])[1 + n % 3],
  (array['Cachorro','Joven','Adulto','Mayor'])[1 + n % 4],
  (array['Paradas','Caídas'])[1 + n % 2],
  (array['Larga','Corta o mocha'])[1 + n % 2],
  case when n % 4 = 0 then array['Llevaba collar','Cicatriz visible'] else '{}'::text[] end,
  case when n % 4 = 0 then 'Rojo' end,
  'Risaralda',
  (array['Pereira','Dosquebradas','Santa Rosa de Cabal'])[1 + n % 3],
  (array['Cuba','Olaya','Centro'])[1 + n % 3],
  current_date - (n % 10),
  (array['Refugio','Hogar temporal','Casa de familia','Veterinaria'])[1 + n % 4],
  'Lugar ' || n,
  'Contacto ' || n,
  '30000000' || lpad(n::text, 2, '0'),
  (array['WhatsApp','Correo','Instagram'])[1 + n % 3],
  case when n % 3 = 0 then 'Muy asustado, cojea de una pata' end,
  case when n % 2 = 0 then 'https://ejemplo.invalid/prod/x/' || n || '-grande.jpg' end,
  case when n % 2 = 0 then 'https://ejemplo.invalid/prod/x/' || n || '-mini.jpg' end,
  (array['resguardo','resguardo','resguardo','reencontrado','oculto'])[1 + n % 5],
  n % 3 <> 0
from generate_series(1, 30) n;

-- Las columnas que llegaron después del esquema base, si existen ya en main.
do $$
begin
  if exists (select 1 from information_schema.columns where table_name='mascotas' and column_name='raza') then
    update mascotas set raza = 'Criollo' where especie = 'Perro';
  end if;
  if exists (select 1 from information_schema.columns where table_name='mascotas' and column_name='lugar_mapa') then
    update mascotas set lugar_mapa = 'https://maps.example.invalid/x' where custodio = 'Refugio';
  end if;
  if exists (select 1 from information_schema.columns where table_name='mascotas' and column_name='fuente_url') then
    update mascotas set fuente_url = 'https://instagram.com/p/x' where custodio = 'Veterinaria';
  end if;
  if exists (select 1 from information_schema.columns where table_name='mascotas' and column_name='senas_donde') then
    update mascotas set senas_donde = 'pata trasera derecha' where 'Cicatriz visible' = any(senas);
  end if;
end $$;

-- 12 búsquedas de tutores, con contacto (lo que RLS debe proteger).
insert into busquedas (especie, tamano, color, pelo, sexo, edad, senas, departamento, municipio,
                       nota, nombres, contacto_telefono, contacto_medio, estado)
select
  (array['Perro','Gato'])[1 + n % 2],
  (array['Pequeño','Mediano','Grande'])[1 + n % 3],
  (array['Negro','Café','Blanco'])[1 + n % 3],
  'Corto', 'Macho', 'Adulto',
  case when n % 3 = 0 then array['Llevaba collar'] else '{}'::text[] end,
  'Risaralda', 'Pereira',
  'renquea de una pata',
  'Luna ' || n,
  '31000000' || lpad(n::text, 2, '0'),
  'WhatsApp',
  (array['abierta','abierta','resuelta','oculta'])[1 + n % 4]
from generate_series(1, 12) n;

do $$
begin
  if exists (select 1 from information_schema.columns where table_name='busquedas' and column_name='codigo') then
    update busquedas b set codigo = 'BUS-CI' || lpad(s.rn::text, 3, '0')
    from (select id, row_number() over (order by creado_en, id) rn from busquedas) s
    where b.id = s.id and b.codigo is null;
  end if;
end $$;

-- Refugios (si la tabla ya existe en main): dos activos y uno cerrado, y
-- la mitad de las fichas en resguardo enlazadas al primero.
do $$
declare r1 uuid; r2 uuid;
begin
  if to_regclass('public.refugios') is null then return; end if;
  insert into refugios (nombre, tipo, departamento, municipio, barrio, direccion, contacto_telefono, contacto_medio, responsable, activo)
  values ('Albergue CI', 'Refugio', 'Risaralda', 'Pereira', 'Cuba', 'Calle 1 # 2-3', '3005550001', 'WhatsApp', 'Ana', true),
         ('Veterinaria CI', 'Veterinaria', 'Risaralda', 'Dosquebradas', 'Centro', null, '3005550002', 'WhatsApp', null, true),
         ('Refugio cerrado CI', 'Refugio', 'Risaralda', 'Pereira', null, null, null, 'WhatsApp', null, false)
  on conflict ((lower(trim(nombre)))) do nothing;
  select id into r1 from refugios where nombre = 'Albergue CI';
  update mascotas set refugio_id = r1, lugar = 'Albergue CI', custodio = 'Refugio'
   where refugio_id is null and estado = 'resguardo' and custodio = 'Refugio';
  update voluntarios set refugio_id = r1 where id = '00000000-0000-0000-0000-000000000001';
end $$;
