# Hoja de ruta

Qué sigue, en qué orden y por qué. Se actualiza en cada PR que cambie el
plan. Lo que ya se hizo baja a la sección final con la fecha.

Criterio de orden: primero lo que protege lo que ya funciona (la página
está en uso real desde el 16 de agosto de 2026), después lo que más
reencuentros produce por hora de trabajo, y al final lo que es bonito
pero no urgente.

---

## Ahora (esta semana)

- [ ] **Fusionar el PR #17** (compartir con foto, contacto, control de
      imágenes, raza, cruce más exigente, sugerencias desde la nota).
      Antes de fusionar: aplicar en producción la migración
      `supabase/migrations/20260817000000_raza.sql`. Ya está en staging.
      Responsable: Lau.
- [ ] **Decidir el plan de Cloudflare.** El plan gratis da 100.000
      peticiones al Worker por día; cada foto vista es una. Aguanta unos
      2.500-3.500 visitantes nuevos al día; si se pasa, ese día se quedan
      sin fotos (la página y la búsqueda siguen). Opciones: Workers Paid
      (US$5/mes, 10 millones/mes) o paginar el listado para gastar menos.
- [ ] **Paginar el listado** (12 fichas + «ver más»). Baja de ~43 a ~12
      peticiones por visitante. Gratis y pequeño.
- [ ] **Regla de límite de subidas** en Cloudflare (WAF → Rate limiting,
      el plan gratis incluye una): p. ej. 20 subidas por IP cada 10 min en
      `/api/fotos/*`. Hoy no hay tope.
- [ ] **Fusionar el PR #19 (vigía diario)** y correrlo una vez a mano.
      Para que reporte las peticiones al Worker: crear en Cloudflare un API
      token de solo lectura de analíticas y guardarlo con el Account ID como
      secretos `CF_API_TOKEN` / `CF_ACCOUNT_ID` (pasos en DESPLIEGUE.md).
- [ ] **Visitas:** activar Cloudflare Web Analytics (gratis, sin cookies) y
      poner el token en `index.html`. Responsable: Lau crea el sitio en el
      panel y pasa el token.
- [ ] **Mirar las métricas** del Worker una vez al día durante la semana
      de difusión (Cloudflare → Workers & Pages → huellas-a-casa → Metrics)
      y el panel de la página (botón «Panel», solo voluntarios).

## Después (próximas 2-3 semanas) — lo que más reencuentros produce

- [ ] **Preguntar cuándo y dónde se perdió** en la búsqueda. Un animal
      recogido *antes* de perderse no puede ser el tuyo: filtro duro que
      hoy no existe. Columna `fecha_perdida` en `busquedas`.
- [ ] **Cruce inverso con aviso.** Cuando entra una ficha nueva, mostrar al
      voluntario las búsquedas abiertas que se parecen («hay 2 personas
      buscando algo así — avisar»). La función `busquedasParecidas()` ya
      existe en `coincidencia.js`; falta la pantalla.
- [ ] **Medir el cruce:** botones «Es mi mascota» / «No es» en los
      resultados y guardarlos. Con 30-50 casos reales se ajustan los pesos
      con evidencia. Es lo que permite mejorar el motor de verdad.
- [ ] **Copiar las fichas de producción a staging, anonimizadas** (nombre y
      contacto reemplazados) para probar el cruce con casos reales.
- [ ] **Recuperación de contraseña por correo:** ya existe la pantalla;
      revisar que el correo de Supabase llegue (remitente, plantilla en
      español).

## Más adelante — mejoras al cruce

- [ ] **Color secundario** («y también tiene…»). Muchos animales son de dos
      colores; «Blanco con manchas» es un parche.
- [ ] **Peso por rareza:** coincidir en «husky» o «tricolor» dice más que
      en «café mediano». Ponderar cada acierto por lo raro que es en las
      fichas actuales.
- [ ] **Pegar el texto de una publicación de Instagram** y que las
      sugerencias propongan todas las casillas de una vez. Llena la base
      con más rasgos, que es lo que el motor necesita.
- [ ] **Foto para detectar duplicados** (misma foto publicada por varias
      cuentas), nunca como porcentaje de parecido.
- [ ] Vincular más refugios de los cuatro departamentos.

## Aparcado (evaluado y descartado por ahora, con motivo)

- **Embeddings de texto como motor** (probado el 17-ago-2026 con
  `multilingual-e5-small` vía transformers.js): 135 MB de descarga, no
  distingue sexo ni collar, falla con negaciones y colores vecinos, y las
  similitudes quedan comprimidas entre 0,88 y 0,93 (ruido). Solo tendría
  sentido como señal pequeña sobre la nota libre, cargado en segundo plano.
- **Embeddings de imagen para el parecido:** el fondo (jaula, casa) domina
  la señal y un número al lado de la foto hace que la gente deje de mirar.
  Solo para duplicados (arriba).
- **Revisión automática de fotos con IA** (p. ej. Workers AI): posible, con
  cupo gratis, pero hay que probarla en staging antes; mientras tanto la foto
  borrosa hasta aprobación cubre el riesgo.

---

## Hecho

- 17-ago-2026 — PR #17 (en revisión): compartir con foto en WhatsApp
  (`/m/PER-0012`), contacto del grupo, foto borrosa hasta aprobación,
  voluntarios ven y restauran ocultas, campo raza, regla 4 del cruce,
  sugerencias desde la nota, `npm run probar`, panel de uso para voluntarios.
- 17-ago-2026 — PR #19 (en revisión): vigía diario con alarma por correo.
- 17-ago-2026 — #16 recuperar contraseña; #14 ficha completa; #15 contacto
  sin nombre, datos de prueba en staging, edición de fichas.
- 16-ago-2026 — #11 inicio de sesión de voluntarios; #12 foto antes de la
  ficha; #13 foto desde el carrete y enlace a la publicación original.
- 16-ago-2026 — Sitio en producción (Cloudflare + Supabase + R2), staging
  separado, respaldo diario, anti-pausa.
