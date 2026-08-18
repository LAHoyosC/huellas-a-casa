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

## Parte 3 — Primer voluntario

Para que alguien pueda aprobar fichas y marcar reencuentros:

1. Supabase → **Authentication** → **Users** → **Add user** → correo y
   contraseña de la persona.
2. **SQL Editor**, con el correo de la persona:

   ```sql
   insert into voluntarios (id, nombre, refugio)
   select id, 'Nombre', 'Refugio' from auth.users where email = 'correo@ejemplo.com';
   ```

(Todavía no hay pantalla de inicio de sesión en la página; es lo siguiente
en la lista. Ver CONTEXTO.md.)

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

Regla: **todo cambio de esquema se aplica primero en staging**, se prueba
en la URL de vista previa del PR, y solo después se aplica en producción y
se mergea.

Aplicar migraciones con la CLI (requiere `npx supabase login`):

```bash
npx supabase link --project-ref jvgcwbxwjxtmkpdhyjcv   # staging
npx supabase db push
```
