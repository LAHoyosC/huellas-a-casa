-- Registro de qué migraciones ya se aplicaron en ESTA base. Lo usa el
-- workflow migrar.yml para aplicar en producción (y staging) solo lo que
-- falta, en orden, al fusionar a main. Solo lo lee/escribe el CI con la
-- conexión de administrador; el público ni lo ve.
create table if not exists migraciones_aplicadas (
  nombre      text primary key,          -- p. ej. 20260818000003_senas_donde.sql
  aplicada_en timestamptz not null default now()
);
alter table migraciones_aplicadas enable row level security;
revoke all on migraciones_aplicadas from anon, authenticated;

-- Las que ya están aplicadas al crear esta tabla (bootstrap). A partir de
-- aquí las registra migrar.yml.
insert into migraciones_aplicadas (nombre) values
  ('20260816000000_esquema.sql'),
  ('20260816000001_contacto_medio.sql'),
  ('20260816000002_lugar_mapa.sql'),
  ('20260816000003_voluntarios_ven_ocultas.sql'),
  ('20260816000004_fuente_url.sql'),
  ('20260817000000_raza.sql'),
  ('20260818000000_busquedas_codigo.sql'),
  ('20260818000001_consultar_busqueda.sql'),
  ('20260818000002_busquedas_foto.sql'),
  ('20260818000003_senas_donde.sql'),
  ('20260818000004_nadie_vacia.sql'),
  ('20260818000005_migraciones_aplicadas.sql')
on conflict do nothing;
