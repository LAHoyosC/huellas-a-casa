-- Enlace de Google Maps del sitio donde esta el animal (refugio, hogar,
-- veterinaria). Opcional: solo se guarda si quien registra marca que
-- quiere mostrar la ubicacion. Se muestra como boton "Como llegar".

alter table mascotas
  add column if not exists lugar_mapa text
  check (lugar_mapa is null or char_length(lugar_mapa) <= 500);
