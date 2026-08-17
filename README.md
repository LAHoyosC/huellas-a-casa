# Huellas a Casa

Registro unificado de mascotas perdidas y encontradas para Risaralda, Quindío,
Caldas y Valle del Cauca.

**Página:** https://huellas-a-casa.huellas-a-casa.workers.dev

Refugios, hogares temporales y familias que acogen registran en un mismo
lugar. Los tutores buscan respondiendo un formulario de opciones, sin
escribir descripciones largas. Es gratuito, comunitario y temporal: existe
por la emergencia y se cierra cuando deje de hacer falta ([CIERRE.md](CIERRE.md)).

---

## Cómo funciona el cruce

Casi todo el formulario es de selección. Eso es lo que hace posible comparar:
si un voluntario escribe "cafecito con manchitas" y el tutor escribe "marrón
con blanco", ningún sistema los cruza. Con vocabulario cerrado, sí.

Cuatro reglas gobiernan el puntaje:

1. **Solo se comparan los campos que ambas partes respondieron.** Alguien
   conmocionado que no recuerda la cola no pierde coincidencias.
2. **Los valores vecinos suman parcial.** Beige y blanco no son iguales, pero
   tampoco son lo mismo que blanco y negro.
3. **La nota libre solo suma, nunca resta.** Si el tutor menciona algo y la
   ficha no lo confirma, no es evidencia en contra: el voluntario pudo no
   haberse fijado.
4. **El porcentaje refleja cuánta información se comparó.** Con solo tamaño
   y color, dos perros "mediano beige" no pasan de un parecido moderado
   (~60 %): no hay evidencia para más. La página lo avisa y sugiere
   responder más preguntas. Pequeño contra grande se descarta; mediano
   contra grande suma poco. Y la raza (solo perros, opcional) es lo
   que más pesa cuando ambas partes la dieron: dos razas concretas distintas
   restan.

La nota se cruza por significado, no por palabras exactas: "cojea", "renquea"
y "camina mal" son lo mismo para el sistema. Ese diccionario vive en
[`src/lib/conceptos.js`](src/lib/conceptos.js) y **lo puede editar cualquiera
sin saber programar**.

Además, la nota **sugiere casillas**: si alguien escribe "una cocker doradita,
chiquita" y no marcó raza, color ni tamaño, la página le propone marcarlos
(Cocker · Beige o crema · Pequeño) y la persona confirma con un toque. Nunca se
marca solo. Las palabras que reconoce están en
[`src/lib/sugerencias.js`](src/lib/sugerencias.js), también editable por
cualquiera.

**Cómo comprobar que el cruce funciona:** `npm run probar` corre una lista de
casos escritos en español (`scripts/probar-cruce.mjs`) —la cocker contra el
labrador, la nota negada, pequeño contra grande…— y dice qué porcentaje da
cada uno y si está dentro de lo esperado. Corre solo en cada PR. Cuando se
cambie el motor a propósito, se ajustan ahí los rangos, con el motivo.

**La foto no se usa para el cruce.** Es para que el humano confirme. El cotejo
automático de imágenes falla mucho con animales sucios, mojados y asustados,
y un porcentaje al lado de una foto hace que la gente le crea al número por
encima de sus propios ojos.

El mismo motor evita dos errores frecuentes: antes de guardar una ficha avisa
si el mismo animal parece ya registrado (**duplicados**), y al marcar un
reencuentro avisa si hay otros animales en resguardo muy parecidos
(**gemelas**), para no entregar el equivocado.

---

## Infraestructura y transparencia

Todo corre en planes gratuitos; nadie paga ni cobra por esto.

| Pieza | Dónde | Qué guarda |
|---|---|---|
| Página web | Cloudflare Workers | Archivos estáticos + un Worker pequeño para las fotos. Se recompila sola con cada cambio en `main`. |
| Base de datos | Supabase, plan gratuito, región Virginia (EE. UU.) | Fichas, búsquedas, historial de cambios. Protegida con RLS. |
| Fotos | Cloudflare R2, bucket `huellas-fotos` | Las sube y sirve [`worker/index.js`](worker/index.js). 10 GB gratis, salida sin costo. |
| Compartir fichas | El mismo Worker | Cada ficha tiene enlace propio (`/m/PER-0012`). El Worker responde ahí con la foto y los datos del animal en las etiquetas de vista previa, para que al mandarlo por WhatsApp salga la imagen. La foto solo va si un voluntario ya aprobó la ficha. |
| Pruebas (staging) | Segundo proyecto de Supabase con el mismo esquema | Cada *pull request* se prueba contra esta base, nunca contra la real. |
| Respaldos | Repositorio privado `huellas-a-casa-respaldos`, copia cada noche | Privado porque incluyen contactos de particulares. |
| Código | Este repositorio, público | Cualquiera puede revisar qué hace la página con los datos. |

**Datos personales**: qué se guarda, quién lo ve y cómo pedir corrección o
retiro está explicado en la propia página (inicio, «Tus datos»). Se tratan
según la Ley 1581 de 2012. Los contactos de quien cuida un animal se
publican en la ficha (la persona elige WhatsApp, correo o Instagram); los de
quien busca a su mascota solo los ven voluntarios.

**Nada se borra**: no hay `DELETE` en la aplicación ni permiso de borrado en
Postgres. Marcar reencontrado cambia un estado; retirar una ficha la oculta.
Cada cambio queda en la tabla `historial`.

---

## Cómo se trabaja en este repositorio

- Todo cambio va en una rama con nombre de la necesidad y entra a `main` por
  *pull request*. `main` está protegida: exige que compile (CI) y una
  aprobación de un administrador ([`.github/CODEOWNERS`](.github/CODEOWNERS)).
- Cada PR recibe una **URL de vista previa** de Cloudflare conectada a la base
  de **staging** (franja morada «ENTORNO DE PRUEBAS»). Producción solo cambia
  al mergear.
- Los cambios de esquema van como archivos en
  [`supabase/migrations/`](supabase/migrations/), se aplican **primero en
  staging**, se prueban en la vista previa, y solo después en producción.
- Guía completa de montaje y operación: [**DESPLIEGUE.md**](DESPLIEGUE.md).

### Correr en local

```bash
npm install
npm run dev              # la página, contra la base de producción (.env.production)
npx wrangler dev         # en otra terminal, si necesitas subir fotos
```

Para trabajar contra staging en local: `cp .env.staging .env.local`.

**Datos de prueba en staging**: `python scripts/semilla-staging.py` siembra ~30
fichas inventadas (varios municipios, gemelas, reencontradas, con fotos
generadas en R2 bajo `staging/`) y unas búsquedas. Solo apunta a staging.
Voluntaria de prueba: `pruebas.huellasacasa@gmail.com` (solo existe en staging).

### Workflows automáticos

| Workflow | Cuándo | Qué hace |
|---|---|---|
| `verificar.yml` | cada PR | Comprueba que compila. No publica nada. |
| `respaldo.yml` | cada noche, 2 a.m. | `pg_dump` completo al repositorio privado. 30 diarios + 1 mensual permanente. |
| `mantener-activo.yml` | cada día | Consulta la base para que Supabase no pause el proyecto por inactividad. |

Si alguno falla, GitHub avisa por correo a los administradores.

---

## Dar de alta voluntarios

Cualquiera puede registrar una mascota encontrada, pero entra marcada como
**sin verificar**. Solo un voluntario con sesión iniciada aprueba fichas,
marca reencuentros y oculta fichas (enlace «Voluntarios» arriba a la derecha
de la página).

Mientras una ficha está sin verificar, su foto se muestra **borrosa** al
público (quien quiera la destapa tocándola) y **no** va en la vista previa al
compartir el enlace. Así una imagen indebida no queda al aire sin que nadie
la haya visto. Una ficha **oculta** desaparece para el público (la base misma
no se la entrega a nadie sin sesión de voluntario); los voluntarios la ven con
el filtro «Ocultas» del listado y pueden volver a mostrarla.

1. Supabase → **Authentication → Users → Add user → Create new user**: correo
   y contraseña, y marca **Auto Confirm User** (así no depende de un correo
   de confirmación).
2. En el **SQL Editor**, con el correo de esa persona:

```sql
insert into voluntarios (id, nombre, refugio)
select id, 'Nombre', 'Refugio' from auth.users where email = 'correo@ejemplo.com';
```

Para desactivar a alguien: `update voluntarios set activo = false where id = '...'`.
Para cambiar una contraseña: Authentication → Users → ⋯ → Reset password.

---

## Límites de los planes gratuitos

| Recurso | Dónde | Límite | Qué significa aquí |
|---|---|---|---|
| Base de datos | Supabase | 500 MB | Muchísimo. Son solo datos, no fotos. |
| Fotos | Cloudflare R2 | 10 GB, salida gratis | ~45.000 mascotas. Ver fotos no gasta cuota. |
| Peticiones del Worker | Cloudflare | 100.000 al día | Cada foto vista es una petición: alcanza para varios miles de visitas diarias. |

[`src/lib/foto.js`](src/lib/foto.js) comprime a ~200 KB y guarda una miniatura
de 320 px aparte: el listado usa la miniatura, la grande solo se carga al
abrir la ficha. Menos datos móviles para quien busca.

---

## Pendientes

- Recuperación de contraseña desde la página (hoy la restablece un administrador).
- Cruce inverso: mascota nueva contra búsquedas abiertas (`busquedasParecidas()` ya existe).
- Migraciones automáticas desde CI (staging al abrir PR, producción al mergear).
- **Protocolo de entrega**: qué prueba pide un refugio antes de entregar un animal. Lo define el refugio, no el código.

---

## Estructura

```
src/lib/catalogo.js      Vocabulario cerrado del formulario
src/lib/conceptos.js     Diccionario de sinónimos  ← editable por cualquiera
src/lib/sugerencias.js    Palabras de la nota que sugieren casillas  ← editable por cualquiera
scripts/probar-cruce.mjs Casos de prueba del cruce (npm run probar)
src/lib/coincidencia.js  Motor de puntaje, duplicados y gemelas
src/lib/foto.js          Compresión y subida de fotos
src/App.jsx              Interfaz
worker/index.js          Worker de Cloudflare: fotos en R2 y vista previa al compartir
worker/entorno.js        Generado por scripts/build.mjs: a qué base lee el Worker
scripts/build.mjs        Elige producción o staging según la rama
supabase/migrations/     Esquema (tablas, RLS, auditoría) y migraciones, en orden
.github/workflows/       CI, respaldo nocturno, anti-pausa
```
