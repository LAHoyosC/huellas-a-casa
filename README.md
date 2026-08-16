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

Tres reglas gobiernan el puntaje:

1. **Solo se comparan los campos que ambas partes respondieron.** Alguien
   conmocionado que no recuerda la cola no pierde coincidencias.
2. **Los valores vecinos suman parcial.** Beige y blanco no son iguales, pero
   tampoco son lo mismo que blanco y negro.
3. **La nota libre solo suma, nunca resta.** Si el tutor menciona algo y la
   ficha no lo confirma, no es evidencia en contra: el voluntario pudo no
   haberse fijado.

La nota se cruza por significado, no por palabras exactas: "cojea", "renquea"
y "camina mal" son lo mismo para el sistema. Ese diccionario vive en
[`src/lib/conceptos.js`](src/lib/conceptos.js) y **lo puede editar cualquiera
sin saber programar**.

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
**sin verificar**. Solo un voluntario aprueba fichas y marca reencuentros.

1. Supabase → **Authentication → Users → Add user**.
2. Copia su UUID y corre en el SQL Editor:

```sql
insert into voluntarios (id, nombre, refugio)
values ('PEGA-AQUI-EL-UUID', 'Nombre', 'Refugio');
```

(Falta la pantalla de inicio de sesión en la página; es lo siguiente en la lista.)

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

- Inicio de sesión para voluntarios (RLS ya protege; falta la pantalla).
- Panel para aprobar fichas `verificado = false`.
- Cruce inverso: mascota nueva contra búsquedas abiertas (`busquedasParecidas()` ya existe).
- Migraciones automáticas desde CI (staging al abrir PR, producción al mergear).
- **Protocolo de entrega**: qué prueba pide un refugio antes de entregar un animal. Lo define el refugio, no el código.

---

## Estructura

```
src/lib/catalogo.js      Vocabulario cerrado del formulario
src/lib/conceptos.js     Diccionario de sinónimos  ← editable por cualquiera
src/lib/coincidencia.js  Motor de puntaje, duplicados y gemelas
src/lib/foto.js          Compresión y subida de fotos
src/App.jsx              Interfaz
worker/index.js          Worker de Cloudflare: fotos en R2
scripts/build.mjs        Elige producción o staging según la rama
supabase/migrations/     Esquema (tablas, RLS, auditoría) y migraciones, en orden
.github/workflows/       CI, respaldo nocturno, anti-pausa
```
