-- Un tutor angustiado suele registrar la misma mascota varias veces con
-- combinaciones distintas. Los voluntarios pueden marcar esas búsquedas como
-- un solo caso: duplicada_de apunta a la búsqueda principal del grupo.
-- No se borra nada: la duplicada sigue existiendo y se puede separar.
alter table busquedas add column if not exists duplicada_de uuid;

create index if not exists idx_busquedas_duplicada_de on busquedas (duplicada_de);

comment on column busquedas.duplicada_de is
  'Si no es null, esta búsqueda es duplicada de otra (la principal del caso). Solo la marcan voluntarios.';
