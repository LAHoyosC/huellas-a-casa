# Cómo poner esto en línea (paso a paso, gratis)

Son dos piezas: la **base de datos** (Supabase) y la **página** (Cloudflare).
Ninguna cobra. Esto ya está hecho; queda documentado por si hay que
rehacerlo o entender qué hay.

La página está en:
**https://huellas-a-casa.huellas-a-casa.workers.dev**

---

## Parte 1 — Base de datos (Supabase)

1. Entra a [supabase.com](https://supabase.com) y crea una cuenta (sirve
   con la de GitHub).
2. **New project**. Nombre: `huellas-a-casa`. Contraseña de la base:
   inventa una larga y **guárdala en un lugar seguro** (se necesita en el
   paso 6). Región: **East US (North Virginia)**. Plan: **Free**.
3. Espera a que termine de crearse (1-2 min).
4. Menú izquierdo → **SQL Editor** → **New query**. Pega el contenido
   completo de cada archivo de [`supabase/migrations/`](supabase/migrations/) **en orden**
   (primero `…_esquema.sql`, luego los siguientes) y dale **Run** a cada uno.
5. Menú izquierdo → **Storage**: debe aparecer un bucket `fotos` (lo creó
   el paso anterior). Si no está, créalo con **New bucket**, nombre `fotos`,
   marcado como **Public bucket**.
6. Menú izquierdo → **Project Settings** → **API**. Deja abierta esa
   pestaña: de ahí salen dos valores que se usan en la Parte 2:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **anon public** (una llave larga que empieza por `eyJ...`)

   Estos dos valores son públicos por diseño. Van dentro del navegador de
   cualquiera que abra la página. La seguridad no está en esconderlos sino
   en las reglas que ya instalaron las migraciones.

---
## Parte 2 — Página (Cloudflare)

El Worker `huellas-a-casa` en Cloudflare está conectado a este repositorio
y se recompila solo con cada cambio en `main`. La URL y la llave de
Supabase van en `.env.production` (son públicas), así que no hay variables
que configurar en Cloudflare.

Si hubiera que rehacerlo desde cero: Cloudflare → Workers & Pages → Create
→ Import a repository → este repo. Build command `npm run build`, deploy
command `npx wrangler deploy` (lo define `wrangler.jsonc`). Antes, crear el
bucket R2 `huellas-fotos` (R2 → Create bucket) y activar el subdominio
`workers.dev` del Worker (Settings → Domains & Routes).

En GitHub → **Settings → Secrets and variables → Actions → Secrets**, para
los robots de respaldo y anti-pausa:

| Name | Value |
|---|---|
| `SUPABASE_URL` | el Project URL |
| `SUPABASE_ANON_KEY` | la llave anon / publishable |
| `SUPABASE_DB_URL` | Supabase → **Connect** → **Session pooler** → URI, con la contraseña puesta. La conexión «directa» no sirve desde GitHub: es solo IPv6. |
| `RESPALDO_SSH_KEY` | llave privada con permiso de escritura en `huellas-a-casa-respaldos` (ya configurada) |
| `CF_ACCOUNT_ID` | (opcional, para el vigía) Cloudflare → Workers & Pages → a la derecha, **Account ID** |
| `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY` | (para el respaldo de fotos) Cloudflare → **R2 → Manage R2 API Tokens → Create API token**, permiso **Object Read only**, bucket `huellas-fotos`. Copia el *Access Key ID* y el *Secret Access Key* (el secreto solo se muestra una vez). |
| `CF_API_TOKEN` | (opcional, para el vigía) Cloudflare → perfil → **API Tokens → Create Token → Read analytics and logs** (solo lectura). Con estos dos, el vigía diario reporta las peticiones al Worker frente al tope gratis. |

Después, en la pestaña **Actions**, correr a mano una vez **Respaldo de la
base de datos** y **Mantener el proyecto despierto**. Ambos deben quedar
verdes.

---

## Parte 3 — Voluntarios (alta, baja, contraseña)

Cualquiera registra animales, pero solo un voluntario con sesión aprueba
fichas, marca reencuentros y ve el panel (enlace «Voluntarios» arriba a la
derecha de la página).

1. Supabase → **Authentication → Users → Add user → Create new user**: correo
   y contraseña, y marca **Auto Confirm User** (así no depende de un correo
   de confirmación).
2. En el **SQL Editor**, con el correo de esa persona:

   ```sql
   insert into voluntarios (id, nombre, refugio)
   select id, 'Nombre', 'Refugio' from auth.users where email = 'correo@ejemplo.com';
   ```

3. Prueba que entra (o pídele que entre) antes de darlo por hecho.

- Desactivar: `update voluntarios set activo = false where id = '...'`.
- Cambiar contraseña: Authentication → Users → ⋯ → Reset password. La
  persona también puede pedirla desde la página («¿Olvidaste tu contraseña?»).
- Pasa la contraseña por un canal privado, nunca en un grupo.

Es una de las pocas cosas que se hacen a mano en producción; no toques nada
más desde el panel de Supabase.

---

## Cuando algo cambia en el código

Cada merge a `main` vuelve a publicar la página solo. Los PR se prueban
antes en su URL de vista previa (base de staging).

## Dominio propio

Cuando haya nombre decidido: comprar el dominio (Cloudflare Registrar lo
vende a costo, ~US$10/año) y en el Worker → Settings → Domains & Routes →
Add custom domain. HTTPS es automático.

---

## Staging (pruebas)

Hay un segundo proyecto de Supabase, `huellas-a-casa-staging`, con el mismo
esquema. Cada rama distinta de `main` se compila en Cloudflare contra esa
base (lo decide `scripts/build.mjs`) y muestra una franja morada «ENTORNO
DE PRUEBAS». Los datos que se registren ahí no son reales y se pueden
borrar.

Regla: **ningún cambio de esquema se aplica a mano.** Va como archivo nuevo
en `supabase/migrations/`, el CI lo prueba desde cero, lo aplica a staging al
abrir el PR y a producción al fusionar (`migrar.yml`, tabla
`migraciones_aplicadas`). Detalle en [CONTRIBUIR.md](CONTRIBUIR.md).

---

## Operación

### Workflows automáticos

| Workflow | Cuándo | Qué hace |
|---|---|---|
| `verificar.yml` | cada PR | Tres checks: `compilar` (motor + build prod y staging), `base-de-datos` (aplica todas las migraciones desde cero en un Postgres limpio, sobre datos, y comprueba que el código encuentra sus columnas y que la RLS se cumple), `revisar` (sin secretos, migraciones solo agregadas, sin archivos generados). No publica nada. |
| `aprobacion.yml` | cada PR y cada reseña | Si el PR toca archivos delicados (`scripts/ci/delicados.txt`) o trae una migración crítica (`scripts/clasificar-migracion.mjs`) exige la aprobación de Lau; si no, pasa solo. Con los checks en verde el PR se fusiona por auto-merge. |
| `migrar.yml` | al fusionar a main con migraciones | Aplica en staging y producción solo las migraciones que faltan y comprueba esquema y RLS contra la base real. Nadie corre `db push`. |
| `vigia.yml` | cada mañana | Cuenta fichas, búsquedas, tamaño de la base y peticiones al Worker, y comprueba que producción tenga todas las migraciones que el código usa; escribe un resumen (Actions → el run → Summary) y **falla a propósito (= correo)** si algo pasa un umbral: Worker > 70 % del tope diario, base > 400 MB, más de 30 fichas sin verificar. |
| `respaldo.yml` | cada noche, 2 a.m. | `pg_dump` completo al repositorio privado `huellas-a-casa-respaldos`. 30 diarios + 1 mensual permanente. |
| `respaldo-fotos.yml` | domingos | Copia las fotos nuevas del bucket R2 al mismo repo privado (`fotos/`). Nunca borra. Necesita `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `CF_ACCOUNT_ID`. |
| `mantener-activo.yml` | cada día | Consulta la base para que Supabase no pause el proyecto por inactividad. |

Si alguno falla, GitHub avisa por correo a los administradores.

### Límites de los planes gratuitos

| Recurso | Dónde | Límite | Qué significa aquí |
|---|---|---|---|
| Base de datos | Supabase | 500 MB | Muchísimo. Son solo datos, no fotos. |
| Fotos | Cloudflare R2 | 10 GB, salida gratis | ~45.000 mascotas. Ver fotos no gasta cuota. |
| Peticiones del Worker | Cloudflare | 100.000 al día | Cada foto vista es una petición: alcanza para varios miles de visitas diarias. Si se pasa, ese día no salen fotos (la página y la búsqueda siguen). |

`src/lib/foto.js` comprime a ~200 KB y guarda una miniatura de 320 px aparte:
el listado usa la miniatura, la grande solo se carga al abrir la ficha.

Dónde mirar: Cloudflare → Workers & Pages → huellas-a-casa → Metrics; y el
botón «Panel» de la página (solo voluntarios).

### Si algo sale mal en producción

Revert del PR que lo causó desde GitHub (ver [CONTRIBUIR.md](CONTRIBUIR.md)).
Hay respaldo diario de la base y semanal de las fotos.
