-- Enlace a la publicacion original (Instagram, Facebook, otra pagina) de
-- donde un voluntario tomo la informacion. Opcional. Sirve para volver a
-- la fuente y para no duplicar lo que otros ya publicaron.

alter table mascotas
  add column if not exists fuente_url text
  check (fuente_url is null or char_length(fuente_url) <= 500);
