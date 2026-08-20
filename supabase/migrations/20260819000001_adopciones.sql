-- Adopciones como tabla propia (pedido del equipo, 19-ago-2026; estaba en el
-- roadmap desde el 18-ago).
--
-- Una adopción es un PROCESO, no un atributo del animal: por eso va en su
-- tabla y no como columnas de `mascotas` (misma lección que con refugios).
-- Un voluntario marca la mascota como disponible; la ficha pública muestra
-- «En adopción» y un botón para preguntar por ella. La ficha NO cambia de
-- estado: sigue en resguardo y sigue cruzando con búsquedas, por si el
-- tutor aparece.
--
-- El contacto de la adopción es público por diseño (igual que el de la
-- ficha): es a quien escribe la persona interesada. Si queda vacío, la
-- página usa el contacto que la ficha ya muestra. A futuro cabrán aquí
-- datos del proceso (seguimiento, requisitos, entrega) sin tocar mascotas.

create table if not exists adopciones (
  id                 uuid primary key default gen_random_uuid(),
  mascota_id         uuid not null references mascotas (id),
  estado             text not null default 'disponible'
                       check (estado in ('disponible', 'entregada', 'cancelada')),
  contacto_nombre    text,
  contacto_telefono  text,
  contacto_medio     text not null default 'WhatsApp'
                       check (contacto_medio in ('WhatsApp', 'Correo', 'Instagram')),
  notas              text check (notas is null or char_length(notas) <= 500),
  creado_por         uuid references voluntarios (id),
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);

comment on table adopciones is
  'Procesos de adopción. Una fila «disponible» = la mascota se puede adoptar y la ficha pública muestra el botón de preguntar.';
comment on column adopciones.estado is
  'disponible = se puede preguntar; entregada = ya se adoptó; cancelada = se retiró (p. ej. apareció el tutor).';

-- Una sola adopción abierta por mascota.
create unique index if not exists idx_adopciones_una_abierta
  on adopciones (mascota_id) where estado = 'disponible';
create index if not exists idx_adopciones_mascota on adopciones (mascota_id);

-- Historial y actualizado_en, igual que mascotas y refugios.
drop trigger if exists trg_historial_adopciones on adopciones;
create trigger trg_historial_adopciones
  after insert or update on adopciones
  for each row execute function registrar_historial();
drop trigger if exists trg_actualizado_adopciones on adopciones;
create trigger trg_actualizado_adopciones
  before update on adopciones
  for each row execute function tocar_actualizado_en();

-- Permisos: el público ve solo las disponibles (para el botón de la ficha);
-- los voluntarios ven todas y las manejan; nadie borra.
alter table adopciones enable row level security;

drop policy if exists adopciones_lectura_publica on adopciones;
create policy adopciones_lectura_publica on adopciones
  for select to anon, authenticated
  using (estado = 'disponible' or es_voluntario());

drop policy if exists adopciones_alta_voluntarios on adopciones;
create policy adopciones_alta_voluntarios on adopciones
  for insert to authenticated
  with check (es_voluntario());

drop policy if exists adopciones_edicion_voluntarios on adopciones;
create policy adopciones_edicion_voluntarios on adopciones
  for update to authenticated
  using (es_voluntario())
  with check (es_voluntario());

revoke delete, truncate on adopciones from anon, authenticated;
