-- Numero de registro de cada busqueda (BUS-7K3MQ), para que el tutor sepa
-- que su reporte quedo recibido y pueda mencionarlo al escribir.
-- Lo genera la pagina (5 letras/numeros sin ambiguos) porque el publico no
-- puede leer busquedas (RLS) y no recibiria un consecutivo de la base.
alter table busquedas add column if not exists codigo text unique;
