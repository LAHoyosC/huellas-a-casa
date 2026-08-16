-- Medio de contacto elegido por la persona (WhatsApp, Correo o Instagram).
-- El valor (numero, correo o usuario) sigue guardandose en contacto_telefono.
--
-- Como aplicar: Supabase > SQL Editor > pegar y Run. Se puede correr
-- varias veces sin problema.

alter table mascotas
  add column if not exists contacto_medio text not null default 'WhatsApp'
  check (contacto_medio in ('WhatsApp', 'Correo', 'Instagram'));

alter table busquedas
  add column if not exists contacto_medio text not null default 'WhatsApp'
  check (contacto_medio in ('WhatsApp', 'Correo', 'Instagram'));
