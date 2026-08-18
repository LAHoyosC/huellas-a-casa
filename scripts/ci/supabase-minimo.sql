-- Lo mínimo de Supabase que las migraciones dan por hecho, para poder
-- aplicarlas en un Postgres "pelado" dentro del CI (verificar.yml).
-- No es Supabase de verdad: solo los roles, el esquema auth y las tablas de
-- storage que las migraciones nombran. Sirve para comprobar que TODAS las
-- migraciones corren en orden, desde cero, sin chocar entre sí, y que dejan
-- las columnas y funciones que el código usa (scripts/probar-esquema.mjs).
--
-- Si una migración nueva usa algo más de Supabase (otro esquema, otra
-- función auth.*), agrégalo aquí también, en la misma PR.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema if not exists auth;
create table if not exists auth.users (
  id    uuid primary key,
  email text unique
);
-- En Supabase devuelve el usuario de la sesión. Aquí nadie tiene sesión.
create or replace function auth.uid() returns uuid
language sql stable as $$ select null::uuid $$;

create schema if not exists storage;
create table if not exists storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean default false
);
create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name      text
);
alter table storage.objects enable row level security;

grant usage on schema public, auth, storage to anon, authenticated, service_role;
