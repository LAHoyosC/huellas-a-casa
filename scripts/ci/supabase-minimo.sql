-- Lo mínimo de Supabase que las migraciones dan por hecho, para poder
-- aplicarlas en un Postgres "pelado" dentro del CI (verificar.yml).
-- No es Supabase de verdad: solo los roles, el esquema auth, las tablas de
-- storage que las migraciones nombran y los permisos por defecto que
-- Supabase da (para que las políticas RLS y los revoke se prueben igual
-- que en producción).
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
-- En Supabase devuelve el usuario de la sesión (lo saca del JWT). Aquí lo
-- imitamos leyendo un ajuste de sesión, para que las pruebas de RLS puedan
-- "ser" un voluntario:  set request.jwt.claim.sub = '<uuid>';
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

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

-- Supabase da estos permisos por defecto a todo lo que se cree en public.
-- Sin esto, "revoke delete" no revocaría nada y las pruebas mentirían.
grant usage on schema public, auth, storage to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;
