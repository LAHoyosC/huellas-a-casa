-- Versión SOLO LECTURA de scripts/ci/probar-rls.sql, para correr contra
-- PRODUCCIÓN desde el vigía cada mañana. No inserta, no edita, no borra:
-- solo comprueba que el público (anon) sigue sin ver lo que no debe.
\set ON_ERROR_STOP on
set role anon;
do $$
declare n bigint; j jsonb; c text;
begin
  select count(*) into n from busquedas;
  assert n = 0, 'PRODUCCIÓN: anon puede leer busquedas (contactos expuestos)';
  select count(*) into n from voluntarios;
  assert n = 0, 'PRODUCCIÓN: anon puede leer voluntarios';
  select count(*) into n from historial;
  assert n = 0, 'PRODUCCIÓN: anon puede leer historial';
  select count(*) into n from mascotas where estado = 'oculto';
  assert n = 0, 'PRODUCCIÓN: anon ve fichas ocultas';
end $$;
reset role;
-- consultar_busqueda no expone contacto (con un código real, si hay).
do $$
declare c text; j jsonb;
begin
  select codigo into c from busquedas where codigo is not null limit 1;
  if c is not null then
    set local role anon;
    select to_jsonb(x) into j from consultar_busqueda(c) x;
    assert not (j ? 'contacto_telefono'), 'PRODUCCIÓN: consultar_busqueda expone contacto_telefono';
    reset role;
  end if;
end $$;
select 'RLS OK en producción' as resultado;
