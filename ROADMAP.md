# Hoja de ruta

Qué sigue, en qué orden y por qué. Se actualiza en cada PR que cambie el
plan. Lo que ya se hizo baja a la sección final con la fecha.

Criterio de orden: primero lo que protege lo que ya funciona (la página
está en uso real desde el 16 de agosto de 2026), después lo que más
reencuentros produce por hora de trabajo, y al final lo que es bonito
pero no urgente.

---

## Ahora (esta semana)

- [x] Fusionar el PR #17 y aplicar la migración `raza` en producción
      (hecho 18-ago-2026).
- [x] Fusionar el PR #22 (número de registro de búsquedas y seguimiento
      desde el panel) — hecho 18-ago-2026.
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
- [x] **Secretos de Cloudflare en GitHub** (`CF_API_TOKEN`, `CF_ACCOUNT_ID`,
      `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`): puestos el 18-ago-2026;
      «Vigía» y «Respaldo de las fotos» corridos a mano, ambos en verde.
- [x] Visitas: Cloudflare Web Analytics activo (18-ago-2026).
- [ ] **Mirar las métricas** del Worker una vez al día durante la semana
      de difusión (Cloudflare → Workers & Pages → huellas-a-casa → Metrics)
      y el panel de la página (botón «Panel», solo voluntarios).

## Después (próximas 2-3 semanas) — lo que más reencuentros produce

- [x] **Refugios como tabla propia** (PR #30, 19-ago-2026): tabla `refugios`,
      `refugio_id` en fichas y voluntarios, selector con autollenado al
      registrar, filtro por refugio, sección «Refugios» en el panel (agregar,
      editar, asignar fichas con el sitio escrito a mano, crear refugio desde
      una ficha), refugio por defecto del voluntario. Semilla: Albergue
      Gestora Social de Risaralda y Bomberos, con sus fichas enlazadas.
      Pendiente: cifras por refugio en el panel; que los voluntarios elijan su
      refugio por defecto desde la página (hoy lo pone Lau en la base).
- [ ] **Hogares de paso** (pedido de los albergues, 18-ago-2026): un `tipo`
      más en `refugios` («Hogar de paso») con capacidad, qué acepta y si está
      disponible; formulario público «Quiero ser hogar de paso» (entra
      inactivo hasta que un voluntario lo revise) y lista en el panel para
      contactarlos. Contacto solo para voluntarios.
- [ ] **Adopciones** (idea, 18-ago-2026): un estado más de la ficha
      («en adopción») que un voluntario pone cuando pasa ~1-1,5 meses sin
      reencuentro; el vigía avisa las que llevan más de 45 días. Sección
      pública apagada hasta decidir reglas (quién decide, qué pasa si aparece
      el tutor, requisitos). Primero el estado interno + aviso.
- [ ] Refugios, detalle original del plan (19-ago-2026, hecho arriba). Hoy
      «Nombre del refugio o del sitio» es texto libre en cada ficha, así que
      no se puede filtrar bien ni evitar que el mismo refugio quede escrito
      de tres formas. Plan:
      - Tabla `refugios` (nombre, tipo, municipio, barrio, dirección o enlace
        de mapa, contacto público, notas) y una columna `refugio_id` en
        `mascotas`. Las fichas actuales se enlazan por nombre y las que no
        cuadren las asigna un voluntario.
      - Voluntarios: agregar refugios y editar su información, y ver las
        mascotas asociadas a cada uno.
      - Filtro por refugio en el listado (público y voluntarios).
      - **Autollenado al registrar:** al elegir el refugio, la ficha se llena
        sola con municipio, barrio, ubicación, «cómo llegar» y contacto, para
        que quien recibe animales solo tenga que marcar los rasgos y la foto.
      - Después: que cada voluntario tenga un refugio «por defecto», y que el
        panel muestre cifras por refugio.
- [x] **Estado del caso para el tutor** (PR #24, 18-ago-2026): consulta por
      número de registro, estado, rasgos, fichas parecidas hoy y «ya
      apareció — cerrar». Pendiente: que pueda actualizar su contacto.
- [ ] **Preguntar cuándo y dónde se perdió** en la búsqueda. Un animal
      recogido *antes* de perderse no puede ser el tuyo: filtro duro que
      hoy no existe. Columna `fecha_perdida` en `busquedas`.
- [ ] **Cruce inverso con aviso.** Ya existe la versión ligera en el panel
      (cada búsqueda muestra «N fichas parecidas hoy» y «Avisar por
      WhatsApp»). Falta el otro sentido: al guardar una ficha nueva, mostrar
      al voluntario las búsquedas abiertas que se le parecen, y a futuro
      avisar solo (automatizar el seguimiento que hoy es manual).
- [ ] **Medir el cruce:** botones «Es mi mascota» / «No es» en los
      resultados y guardarlos. Con 30-50 casos reales se ajustan los pesos
      con evidencia. Es lo que permite mejorar el motor de verdad.
- [ ] **Copiar las fichas de producción a staging, anonimizadas** (nombre y
      contacto reemplazados) para probar el cruce con casos reales.
- [ ] **Recuperación de contraseña por correo:** ya existe la pantalla;
      revisar que el correo de Supabase llegue (remitente, plantilla en
      español).
- [ ] **Alta de voluntarios desde el panel** (hoy la hace un administrador
      en Supabase, ver DESPLIEGUE.md). Útil cuando entren más refugios.

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

- 18-ago-2026 — #26 «dónde está la seña» y barrios sugeridos; #28 y #29
  modelo de contribución: CONTRIBUIR.md, CLAUDE.md, CI con base de datos y
  RLS, dos carriles (auto-merge / aprobación de Lau), migraciones que se
  aplican solas al fusionar (`migrar.yml`); #24 estado del caso para el
  tutor; #25/#27 roadmap; secretos de Cloudflare y vigía en verde; README
  reescrito y operación movida a DESPLIEGUE.md.
- 18-ago-2026 — Migraciones `raza` y `busquedas_codigo` aplicadas en
  producción. #20 panel de voluntarios + Web Analytics + enlace a política de
  datos en el pie; #21 panel con listas desplegables, búsquedas con contacto
  y fichas parecidas; #22 (en revisión) número de registro de búsquedas y
  seguimiento (resuelta / ocultar / reabrir).

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
