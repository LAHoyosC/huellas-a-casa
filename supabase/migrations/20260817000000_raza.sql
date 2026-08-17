-- Raza o tipo aparente (solo se usa en perros). Opcional; vocabulario en
-- src/lib/catalogo.js (RAZA). Sin CHECK a proposito, igual que color:
-- la lista se ajusta desde el catalogo sin tocar la base.
alter table mascotas  add column if not exists raza text;
alter table busquedas add column if not exists raza text;
