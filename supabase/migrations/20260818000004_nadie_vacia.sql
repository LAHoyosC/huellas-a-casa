-- "Nada se borra nunca" también para vaciar tablas: el esquema base solo
-- revocó TRUNCATE en mascotas. Aquí se revoca en las demás. (RLS no
-- protege contra TRUNCATE; el permiso sí.) Lo detectó la prueba de RLS del
-- CI (scripts/ci/probar-rls.sql).
revoke truncate on busquedas   from anon, authenticated;
revoke truncate on historial   from anon, authenticated;
revoke truncate on voluntarios from anon, authenticated;
revoke delete   on voluntarios from anon, authenticated;
