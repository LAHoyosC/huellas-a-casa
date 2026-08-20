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

-- ============================================================
-- Refugios (si la tabla existe): el público ve solo los activos y no
-- los crea ni edita; una voluntaria activa sí; nadie borra.
-- ============================================================
do $$
declare n bigint; total bigint; activos bigint;
begin
  if to_regclass('public.refugios') is null then return; end if;
  select count(*), count(*) filter (where activo) into total, activos from refugios;

  set local role anon;
  select count(*) into n from refugios;
  assert n = activos, format('anon ve %s refugios; debería ver solo los activos (%s)', n, activos);
  begin
    insert into refugios (nombre) values ('Refugio colado por anon');
    raise exception 'anon puede crear refugios';
  exception when insufficient_privilege then null;
  end;
  begin
    update refugios set nombre = 'x' where activo;
    get diagnostics n = row_count;
    assert n = 0, 'anon puede editar refugios';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from refugios;
    raise exception 'anon puede borrar refugios';
  exception when insufficient_privilege then null;
  end;
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
  select count(*) into n from refugios;
  assert n = total, 'una voluntaria activa no ve todos los refugios (incluidos los cerrados)';
  insert into refugios (nombre, tipo, municipio) values ('Refugio creado por voluntaria', 'Refugio', 'Pereira');
  update refugios set notas = 'editado' where nombre = 'Refugio creado por voluntaria';
  get diagnostics n = row_count;
  assert n = 1, 'una voluntaria activa no puede editar refugios';
  begin
    delete from refugios where nombre = 'Refugio creado por voluntaria';
    raise exception 'una voluntaria puede borrar refugios';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;
reset role;

-- ============================================================
-- Adopciones (si la tabla existe): el público ve solo las disponibles
-- y no las crea, edita ni borra; una voluntaria activa las maneja.
-- ============================================================
do $$
declare n bigint; disponibles bigint; total bigint; ficha uuid; nueva uuid;
begin
  if to_regclass('public.adopciones') is null then return; end if;
  select id into ficha from mascotas where estado = 'resguardo' limit 1;

  -- Una voluntaria activa marca una mascota en adopción.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
  insert into adopciones (mascota_id, notas) values (ficha, 'prueba RLS') returning id into nueva;
  update adopciones set estado = 'cancelada' where id = nueva;
  get diagnostics n = row_count;
  assert n = 1, 'una voluntaria activa no puede editar una adopción';
  update adopciones set estado = 'disponible' where id = nueva;
  begin
    delete from adopciones where id = nueva;
    raise exception 'una voluntaria puede borrar adopciones';
  exception when insufficient_privilege then null;
  end;
  reset role;

  select count(*), count(*) filter (where estado = 'disponible') into total, disponibles from adopciones;

  -- El público ve solo las disponibles y no toca nada.
  set local role anon;
  select count(*) into n from adopciones;
  assert n = disponibles, format('anon ve %s adopciones; debería ver solo las disponibles (%s)', n, disponibles);
  begin
    insert into adopciones (mascota_id) values (ficha);
    raise exception 'anon puede crear adopciones';
  exception when insufficient_privilege or unique_violation then null;
  end;
  begin
    update adopciones set estado = 'entregada' where id = nueva;
    get diagnostics n = row_count;
    assert n = 0, 'anon puede editar adopciones';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from adopciones;
    raise exception 'anon puede borrar adopciones';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;
reset role;

select 'RLS OK: el público no lee contactos ni borra; los voluntarios activos sí trabajan.' as resultado;
