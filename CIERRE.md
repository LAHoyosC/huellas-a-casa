# Plan de cierre

Esta iniciativa es temporal: existe por la emergencia y se cierra cuando
deje de hacer falta. **Cada tres meses** alguien del grupo revisa si sigue
siendo necesaria (fecha de la primera revisión: noviembre de 2026).

Cuando se decida cerrar, esto es lo que hay que hacer, en este orden y en
menos de 30 días. Es lo prometido en el aviso de datos de la página.

## 1. Avisar
- Publicar en la página y en las cuentas de Instagram que la iniciativa
  termina el día X y que después de esa fecha se borra toda la información.
- Dar 15 días para que quien tenga un animal en resguardo anote los
  contactos que necesite.

## 2. Dejar la página en modo "cerrado"
- Reemplazar la aplicación por una sola pantalla que diga que la iniciativa
  terminó, cuándo, y que los datos fueron eliminados. (Cambio pequeño en
  `src/App.jsx`; se hace por PR como todo lo demás.)
- No borrar el repositorio público: el código no tiene datos personales y
  puede servirle a otro grupo en otra emergencia.

## 3. Borrar los datos (todos, no solo la tabla)
En Supabase, **Project Settings → General → Delete project**. Eso borra la
base de datos, el Storage con las fotos, los usuarios y el historial de una
sola vez. No hay forma de recuperarlo, que es la idea.

## 4. Borrar los respaldos
El repositorio privado `huellas-a-casa-respaldos` guarda copias diarias y
mensuales **con historial de git**: no basta con borrar los archivos. Hay
que borrar el repositorio completo: **Settings → Danger Zone → Delete this
repository**.

## 5. Apagar lo demás
- GitHub: desactivar los workflows `respaldo.yml` y `mantener-activo.yml`
  (o dejarlos: fallan sin proyecto, pero hacen ruido). Borrar los secretos
  `SUPABASE_*` y `RESPALDO_SSH_KEY`.
- Cloudflare: el Worker puede quedar sirviendo la pantalla de cierre. No
  tiene datos.
- Buzón de contacto de datos: mantenerlo activo unos meses más por si
  alguien escribe, luego cerrarlo.

## 6. Confirmar
Alguien distinto de quien ejecutó los pasos verifica que:
- la página muestra la pantalla de cierre,
- el proyecto de Supabase ya no existe,
- el repositorio de respaldos ya no existe.
