-- Refugios como tabla propia (pedido del equipo, 18-ago-2026).
--
-- Hoy «Nombre del refugio o del sitio» es texto libre en cada ficha y el
-- mismo albergue aparece escrito de veinte formas. Con una tabla:
--   - al registrar, se elige el refugio y la ficha se llena sola
--     (municipio, barrio, cómo llegar, contacto);
--   - se puede filtrar por refugio y contar por refugio;
--   - los voluntarios agregan y editan refugios; el público solo los ve.
-- Nada se borra: un refugio que cierra se marca activo = false.
--
-- El contacto del refugio es público por diseño (igual que el de la ficha):
-- es el número al que el tutor tiene que escribir.

create table if not exists refugios (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null check (char_length(nombre) between 2 and 120),
  tipo               text not null default 'Refugio'
                       check (tipo in ('Refugio', 'Hogar temporal', 'Casa de familia', 'Veterinaria')),
  departamento       text,
  municipio          text,
  barrio             text,
  direccion          text check (direccion is null or char_length(direccion) <= 200),
  lugar_mapa         text check (lugar_mapa is null or char_length(lugar_mapa) <= 500),
  contacto_telefono  text,
  contacto_medio     text not null default 'WhatsApp'
                       check (contacto_medio in ('WhatsApp', 'Correo', 'Instagram')),
  responsable        text,
  notas              text check (notas is null or char_length(notas) <= 500),
  activo             boolean not null default true,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);

comment on table refugios is
  'Sitios que reciben animales: refugios, hogares temporales, veterinarias. Los voluntarios los mantienen; el público los ve.';

-- El mismo nombre (sin importar mayúsculas ni espacios) no se repite.
create unique index if not exists idx_refugios_nombre on refugios (lower(trim(nombre)));

alter table mascotas    add column if not exists refugio_id uuid references refugios (id);
alter table voluntarios add column if not exists refugio_id uuid references refugios (id);
create index if not exists idx_mascotas_refugio on mascotas (refugio_id);

comment on column mascotas.refugio_id is
  'Refugio donde está el animal. Si es null, «lugar» tiene el sitio escrito a mano y un voluntario puede asignarlo.';

-- Historial y actualizado_en, igual que mascotas.
drop trigger if exists trg_historial_refugios on refugios;
create trigger trg_historial_refugios
  after insert or update on refugios
  for each row execute function registrar_historial();
drop trigger if exists trg_actualizado_refugios on refugios;
create trigger trg_actualizado_refugios
  before update on refugios
  for each row execute function tocar_actualizado_en();

-- Permisos: todos ven los activos; los voluntarios ven todos y los editan.
alter table refugios enable row level security;

drop policy if exists refugios_lectura_publica on refugios;
create policy refugios_lectura_publica on refugios
  for select to anon, authenticated
  using (activo = true or es_voluntario());

drop policy if exists refugios_alta_voluntarios on refugios;
create policy refugios_alta_voluntarios on refugios
  for insert to authenticated
  with check (es_voluntario());

drop policy if exists refugios_edicion_voluntarios on refugios;
create policy refugios_edicion_voluntarios on refugios
  for update to authenticated
  using (es_voluntario())
  with check (es_voluntario());

revoke delete, truncate on refugios from anon, authenticated;

-- Semilla: los sitios que ya aparecen en las fichas de producción, escritos
-- de muchas formas. Se crean una vez y se enlazan las fichas por nombre.
insert into refugios (nombre, tipo, departamento, municipio, direccion, notas)
values
  ('Albergue Gestora Social de Risaralda', 'Refugio', 'Risaralda', 'Pereira',
   'Av. Las Américas, Calle 95 lote 1 (cerca a Mercasa)',
   'Programa de la Primera Dama de Risaralda.'),
  ('Estación Central de Bomberos de Pereira', 'Refugio', 'Risaralda', 'Pereira', null, null)
on conflict ((lower(trim(nombre)))) do nothing;

update mascotas m set refugio_id = r.id
from refugios r
where m.refugio_id is null
  and r.nombre = 'Albergue Gestora Social de Risaralda'
  and (m.lugar ilike '%gestora%' or m.lugar ilike '%las am_ricas%calle 95%' or m.lugar ilike '%calle 95 lote 1%');

update mascotas m set refugio_id = r.id
from refugios r
where m.refugio_id is null
  and r.nombre = 'Estación Central de Bomberos de Pereira'
  and m.lugar ilike '%bomberos%';
