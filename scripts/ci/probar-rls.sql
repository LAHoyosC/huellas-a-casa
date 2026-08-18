-- Prueba de permisos (RLS): lo que el PÚBLICO puede y no puede hacer.
--
-- Corre en el CI después de aplicar todas las migraciones y la semilla
-- (scripts/ci/semilla.sql). Se pone en el rol de la llave pública (anon),
-- de un usuario con sesión pero sin rol (authenticated) y de una voluntaria,
-- y comprueba las promesas del proyecto:
--   - el público NO lee las búsquedas (llevan teléfono de un particular)
--   - consultar_busqueda NO devuelve el contacto
--   - el público NO puede borrar, ni vaciar, ni auto-verificar una ficha
--   - el público NO ve fichas ocultas
--   - una voluntaria activa SÍ ve búsquedas y edita fichas; una inactiva NO
--
-- Cualquier `assert` que falle tumba el CI con el mensaje entre comillas.
-- Si una migración cambia estas reglas A PROPÓSITO, se cambia esta prueba
-- en el mismo PR (es crítica: la revisa Lau).
--
-- Se ejecuta con: psql -v ON_ERROR_STOP=1 -f scripts/ci/probar-rls.sql

\set ON_ERROR_STOP on

-- Datos de referencia (como superusuario).
create temp table ref as
select (select count(*) from mascotas) as mascotas,
       (select count(*) from busquedas) as busquedas,
       (select count(*) from mascotas where estado <> 'oculto') as visibles,
       (select codigo from busquedas where codigo is not null limit 1) as un_codigo,
       (select id from mascotas where estado = 'resguardo' limit 1) as una_ficha;
grant select on ref to anon, authenticated;

-- ============================================================
-- Como PÚBLICO (anon: la llave que va en el navegador)
-- ============================================================
set role anon;

do $$
declare r ref%rowtype; n bigint; j jsonb;
begin
  select * into r from ref;

  select count(*) into n from busquedas;
  assert n = 0, 'anon puede leer busquedas (contactos de tutores expuestos)';

  select count(*) into n from mascotas;
  assert n = r.visibles, format('anon ve %s fichas; debería ver solo las no ocultas (%s)', n, r.visibles);

  select count(*) into n from voluntarios;
  assert n = 0, 'anon puede leer la tabla voluntarios';

  select count(*) into n from historial;
  assert n = 0, 'anon puede leer el historial';

  -- consultar_busqueda: solo por código exacto y sin contacto.
  if r.un_codigo is not null then
    select to_jsonb(c) into j from consultar_busqueda(r.un_codigo) c;
    assert j is not null, 'consultar_busqueda no devuelve nada para un código válido';
    assert not (j ? 'contacto_telefono'), 'consultar_busqueda expone contacto_telefono';
    assert not (j ? 'contacto_nombre'), 'consultar_busqueda expone contacto_nombre';
    select count(*) into n from consultar_busqueda('BUS-NOEXISTE');
    assert n = 0, 'consultar_busqueda devuelve algo para un código inexistente';
  end if;

  -- Puede registrar una ficha, pero sin verificar y en resguardo.
  insert into mascotas (especie, departamento, municipio) values ('Perro', 'Risaralda', 'Pereira');
  begin
    insert into mascotas (especie, departamento, municipio, verificado) values ('Perro', 'Risaralda', 'Pereira', true);
    raise exception 'anon puede registrar una ficha ya verificada';
  exception when insufficient_privilege or check_violation then null;
  end;
  begin
    insert into mascotas (especie, departamento, municipio, estado) values ('Perro', 'Risaralda', 'Pereira', 'reencontrado');
    raise exception 'anon puede registrar una ficha en estado distinto de resguardo';
  exception when insufficient_privilege or check_violation then null;
  end;

  -- No edita fichas (RLS de update: 0 filas afectadas o error).
  begin
    update mascotas set verificado = true where id = r.una_ficha;
    get diagnostics n = row_count;
    assert n = 0, 'anon puede editar una ficha';
  exception when insufficient_privilege then null;
  end;

  -- No borra ni vacía.
  begin
    delete from mascotas where id = r.una_ficha;
    raise exception 'anon puede borrar fichas';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from busquedas;
    raise exception 'anon puede borrar búsquedas';
  exception when insufficient_privilege then null;
  end;
  begin
    execute 'truncate mascotas';
    raise exception 'anon puede vaciar mascotas';
  exception when insufficient_privilege then null;
  end;
  begin
    execute 'truncate busquedas';
    raise exception 'anon puede vaciar busquedas';
  exception when insufficient_privilege then null;
  end;

  -- No escribe en el historial.
  begin
    insert into historial (tabla, registro_id, operacion) values ('x', gen_random_uuid(), 'x');
    raise exception 'anon puede escribir en el historial';
  exception when insufficient_privilege then null;
  end;

  -- Puede dejar una búsqueda (abierta), no una ya resuelta.
  insert into busquedas (especie, codigo) values ('Gato', 'BUS-RLSOK');
  begin
    insert into busquedas (especie, estado, codigo) values ('Gato', 'resuelta', 'BUS-RLSNO');
    raise exception 'anon puede registrar una búsqueda ya resuelta';
  exception when insufficient_privilege or check_violation then null;
  end;
end $$;

reset role;

-- ============================================================
-- Con sesión pero SIN ser voluntario (authenticated, uid ajeno)
-- ============================================================
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000099';
do $$
declare n bigint;
begin
  select count(*) into n from busquedas;
  assert n = 0, 'un usuario con sesión pero sin rol de voluntario lee búsquedas';
  select count(*) into n from voluntarios;
  assert n = 0, 'un usuario sin rol ve la tabla voluntarios';
end $$;

-- Voluntario INACTIVO: como si no fuera nadie.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
declare n bigint;
begin
  select count(*) into n from busquedas;
  assert n = 0, 'un voluntario inactivo sigue leyendo búsquedas';
end $$;

-- ============================================================
-- Voluntaria ACTIVA
-- ============================================================
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare r ref%rowtype; n bigint;
begin
  select * into r from ref;
  select count(*) into n from busquedas;
  assert n > 0, 'una voluntaria activa no ve las búsquedas';
  select count(*) into n from mascotas;
  assert n >= r.mascotas, 'una voluntaria activa no ve todas las fichas (incluidas ocultas)';
  update mascotas set verificado = true where id = r.una_ficha;
  get diagnostics n = row_count;
  assert n = 1, 'una voluntaria activa no puede verificar una ficha';
  begin
    delete from mascotas where id = r.una_ficha;
    raise exception 'una voluntaria puede borrar fichas (nada se borra, ni voluntarios)';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
reset request.jwt.claim.sub;
select 'RLS OK: el público no lee contactos ni borra; los voluntarios activos sí trabajan.' as resultado;
