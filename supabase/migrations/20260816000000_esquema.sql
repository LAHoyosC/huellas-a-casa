-- ============================================================
-- REENCUENTRO — Esquema de base de datos
--
-- Como usarlo: entra a tu proyecto en Supabase, abre "SQL Editor",
-- pega este archivo completo y dale RUN. Se puede correr una sola vez.
--
-- Principio de diseno: NADA SE BORRA NUNCA. No hay DELETE en toda la
-- aplicacion. Corregir es crear una version nueva; retirar una ficha
-- es cambiarle el estado. Ademas revocamos el permiso de DELETE a
-- nivel de Postgres, para que ni un error de codigo pueda borrar.
-- ============================================================

create extension if not exists pgcrypto;


-- ------------------------------------------------------------
-- 1. Tabla principal: mascotas encontradas
-- ------------------------------------------------------------

create sequence if not exists consecutivo_mascota start 1;

create table if not exists mascotas (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text unique not null
                       default 'PER-' || lpad(nextval('consecutivo_mascota')::text, 4, '0'),

  -- Rasgos (vocabulario cerrado; ver src/lib/catalogo.js)
  especie            text not null check (especie in ('Perro', 'Gato', 'Otro')),
  tamano             text check (tamano in ('Pequeño', 'Mediano', 'Grande')),
  color              text,
  pelo               text check (pelo in ('Corto', 'Medio', 'Largo')),
  sexo               text check (sexo in ('Macho', 'Hembra', 'No sé')),
  edad               text check (edad in ('Cachorro', 'Joven', 'Adulto', 'Mayor')),
  orejas             text,
  cola               text,
  senas              text[] not null default '{}',
  collar_color       text,

  -- Ubicacion
  departamento       text not null,
  municipio          text not null,
  barrio             text,

  -- Custodia y contacto
  fecha_hallazgo     date not null default current_date,
  custodio           text check (custodio in ('Refugio', 'Hogar temporal', 'Casa de familia', 'Veterinaria')),
  lugar              text,
  contacto_nombre    text,
  contacto_telefono  text,

  -- Nota libre, corta a proposito
  nota               text check (char_length(nota) <= 180),

  -- Fotos: viven en Storage o R2. Aqui solo guardamos la direccion.
  foto_url           text,
  foto_thumb_url     text,

  -- Ciclo de vida
  estado             text not null default 'resguardo'
                       check (estado in ('resguardo', 'reencontrado', 'oculto')),
  verificado         boolean not null default false,

  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);

comment on column mascotas.verificado is
  'Las fichas creadas por el publico entran en false. Un voluntario las revisa y las aprueba.';
comment on column mascotas.estado is
  'oculto = retirada del listado publico. Nunca se borra el registro.';

create index if not exists idx_mascotas_busqueda
  on mascotas (estado, especie, departamento, municipio);
create index if not exists idx_mascotas_recientes
  on mascotas (creado_en desc);


-- ------------------------------------------------------------
-- 2. Busquedas de tutores
--    Sirve para el cruce inverso: cuando llega una mascota nueva,
--    los voluntarios pueden ver que busquedas abiertas se le parecen.
-- ------------------------------------------------------------

create table if not exists busquedas (
  id                 uuid primary key default gen_random_uuid(),
  especie            text not null check (especie in ('Perro', 'Gato', 'Otro')),
  tamano             text,
  color              text,
  pelo               text,
  sexo               text,
  edad               text,
  orejas             text,
  cola               text,
  senas              text[] not null default '{}',
  collar_color       text,
  departamento       text,
  municipio          text,
  barrio             text,
  nota               text check (char_length(nota) <= 180),
  nombres            text,
  contacto_telefono  text,
  estado             text not null default 'abierta'
                       check (estado in ('abierta', 'resuelta', 'oculta')),
  creado_en          timestamptz not null default now()
);

create index if not exists idx_busquedas_abiertas
  on busquedas (estado, especie, departamento);


-- ------------------------------------------------------------
-- 3. Historial: cada cambio queda registrado, para siempre
-- ------------------------------------------------------------

create table if not exists historial (
  id            bigserial primary key,
  tabla         text not null,
  registro_id   uuid not null,
  operacion     text not null,
  antes         jsonb,
  despues       jsonb,
  hecho_por     uuid,
  hecho_en      timestamptz not null default now()
);

create index if not exists idx_historial_registro
  on historial (registro_id, hecho_en desc);

create or replace function registrar_historial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into historial (tabla, registro_id, operacion, antes, despues, hecho_por)
  values (
    tg_table_name,
    coalesce(new.id, old.id),
    tg_op,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

create or replace function tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists trg_historial_mascotas on mascotas;
create trigger trg_historial_mascotas
  after insert or update on mascotas
  for each row execute function registrar_historial();

drop trigger if exists trg_actualizado_mascotas on mascotas;
create trigger trg_actualizado_mascotas
  before update on mascotas
  for each row execute function tocar_actualizado_en();


-- ------------------------------------------------------------
-- 4. Quien es voluntario
-- ------------------------------------------------------------

create table if not exists voluntarios (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text,
  refugio     text,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

create or replace function es_voluntario()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from voluntarios
    where id = auth.uid() and activo = true
  );
$$;


-- ------------------------------------------------------------
-- 5. Row Level Security
--
--    Sin esto, la llave publica que va en el navegador permite que
--    cualquiera lea, edite o vacie la base. Esta seccion NO es
--    opcional.
-- ------------------------------------------------------------

alter table mascotas   enable row level security;
alter table busquedas  enable row level security;
alter table historial  enable row level security;
alter table voluntarios enable row level security;

-- MASCOTAS ---------------------------------------------------

-- Cualquiera puede ver las fichas que no estan ocultas.
drop policy if exists mascotas_lectura_publica on mascotas;
create policy mascotas_lectura_publica on mascotas
  for select to anon, authenticated
  using (estado <> 'oculto');

-- Cualquiera puede registrar una mascota encontrada, pero entra
-- sin verificar y en resguardo. No puede autoaprobarse.
drop policy if exists mascotas_registro_publico on mascotas;
create policy mascotas_registro_publico on mascotas
  for insert to anon, authenticated
  with check (verificado = false and estado = 'resguardo');

-- Solo un voluntario activo modifica fichas.
drop policy if exists mascotas_edicion_voluntarios on mascotas;
create policy mascotas_edicion_voluntarios on mascotas
  for update to authenticated
  using (es_voluntario())
  with check (es_voluntario());

-- BUSQUEDAS --------------------------------------------------

drop policy if exists busquedas_registro_publico on busquedas;
create policy busquedas_registro_publico on busquedas
  for insert to anon, authenticated
  with check (estado = 'abierta');

-- Las busquedas llevan telefono de un particular: solo voluntarios.
drop policy if exists busquedas_lectura_voluntarios on busquedas;
create policy busquedas_lectura_voluntarios on busquedas
  for select to authenticated
  using (es_voluntario());

drop policy if exists busquedas_edicion_voluntarios on busquedas;
create policy busquedas_edicion_voluntarios on busquedas
  for update to authenticated
  using (es_voluntario())
  with check (es_voluntario());

-- HISTORIAL Y VOLUNTARIOS ------------------------------------

drop policy if exists historial_lectura_voluntarios on historial;
create policy historial_lectura_voluntarios on historial
  for select to authenticated
  using (es_voluntario());

drop policy if exists voluntarios_se_ve_a_si_mismo on voluntarios;
create policy voluntarios_se_ve_a_si_mismo on voluntarios
  for select to authenticated
  using (id = auth.uid());


-- ------------------------------------------------------------
-- 6. Nadie borra nada. Ni por error.
-- ------------------------------------------------------------

revoke delete on mascotas   from anon, authenticated;
revoke delete on busquedas  from anon, authenticated;
revoke delete on historial  from anon, authenticated;
revoke truncate on mascotas from anon, authenticated;

-- El historial es solo de lectura, incluso para voluntarios.
revoke insert, update on historial from anon, authenticated;


-- ------------------------------------------------------------
-- 7. Bucket de fotos (si usas Supabase Storage)
--    Si vas a usar Cloudflare R2, puedes saltarte esta seccion.
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

drop policy if exists fotos_lectura_publica on storage.objects;
create policy fotos_lectura_publica on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'fotos');

drop policy if exists fotos_subida_publica on storage.objects;
create policy fotos_subida_publica on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'fotos');


-- ------------------------------------------------------------
-- 8. Para dar de alta al primer voluntario
--
--    1. Que la persona se registre en la app (o crea el usuario desde
--       Authentication > Users en el panel de Supabase).
--    2. Copia su UUID y corre:
--
--    insert into voluntarios (id, nombre, refugio)
--    values ('PEGA-AQUI-EL-UUID', 'Marcela R.', 'Albergue Huellas de Esperanza');
-- ------------------------------------------------------------
