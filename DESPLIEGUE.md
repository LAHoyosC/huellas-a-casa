# Cómo poner esto en línea (paso a paso, gratis)

Son dos piezas: la **base de datos** (Supabase) y la **página** (GitHub
Pages). Ninguna cobra. Se hace una sola vez y toma unos 20 minutos.

Después de esto la página queda en:
**https://lahoyosc.github.io/huellas-a-casa/**

---

## Parte 1 — Base de datos (Supabase)

1. Entra a [supabase.com](https://supabase.com) y crea una cuenta (sirve
   con la de GitHub).
2. **New project**. Nombre: `huellas-a-casa`. Contraseña de la base:
   inventa una larga y **guárdala en un lugar seguro** (se necesita en el
   paso 6). Región: **East US (North Virginia)**. Plan: **Free**.
3. Espera a que termine de crearse (1-2 min).
4. Menú izquierdo → **SQL Editor** → **New query**. Pega el contenido
   completo de [`supabase/schema.sql`](supabase/schema.sql) y dale **Run**.
   Debe terminar sin errores. Solo se corre una vez.
5. Menú izquierdo → **Storage**: debe aparecer un bucket `fotos` (lo creó
   el paso anterior). Si no está, créalo con **New bucket**, nombre `fotos`,
   marcado como **Public bucket**.
6. Menú izquierdo → **Project Settings** → **API**. Deja abierta esa
   pestaña: de ahí salen dos valores que se usan en la Parte 2:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **anon public** (una llave larga que empieza por `eyJ...`)

   Estos dos valores son públicos por diseño. Van dentro del navegador de
   cualquiera que abra la página. La seguridad no está en esconderlos sino
   en las reglas que ya instaló el `schema.sql`.

---

## Parte 2 — Página (GitHub Pages)

Todo esto es en https://github.com/LAHoyosC/huellas-a-casa

1. **Settings** → **Secrets and variables** → **Actions**.
2. Pestaña **Variables** → **New repository variable**. Crea dos:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | el Project URL de Supabase |
   | `VITE_SUPABASE_ANON_KEY` | la llave anon public |

3. Pestaña **Secrets** → **New repository secret**. Crea tres (estos sí
   son para los robots de respaldo y anti-pausa):

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | el mismo Project URL |
   | `SUPABASE_ANON_KEY` | la misma llave anon |
   | `SUPABASE_DB_URL` | Supabase → Project Settings → **Database** → Connection string → **URI**. Reemplaza `[YOUR-PASSWORD]` por la contraseña del paso 2 de la Parte 1. |

4. Pestaña **Actions** (arriba, en el menú del repositorio) → a la
   izquierda **Publicar en GitHub Pages** → botón **Run workflow** → **Run
   workflow**. Tarda 1-2 minutos. Cuando quede verde, la página está en
   línea.

   Si la corrida falla con un mensaje sobre permisos de Pages: **Settings**
   → **Pages** → **Source** → elige **GitHub Actions**, y vuelve a correr.

5. En la misma pestaña **Actions**, corre a mano una vez **Respaldo de la
   base de datos** y **Mantener el proyecto despierto**. Los dos deben quedar
   verdes. Si alguno falla, revisa los secretos del paso 3.

---

## Parte 3 — Primer voluntario

Para que alguien pueda aprobar fichas y marcar reencuentros:

1. Supabase → **Authentication** → **Users** → **Add user** → correo y
   contraseña de la persona.
2. Copia su **UUID** (la columna ID).
3. **SQL Editor**:

   ```sql
   insert into voluntarios (id, nombre, refugio)
   values ('PEGA-AQUI-EL-UUID', 'Nombre', 'Refugio');
   ```

(Todavía no hay pantalla de inicio de sesión en la página; es lo siguiente
en la lista. Ver CONTEXTO.md.)

---

## Cuando algo cambia en el código

Cada `git push` a `main` vuelve a publicar la página solo. No hay que
hacer nada más.

## Si algún día se quiere dominio propio o Cloudflare

La página funciona igual en Cloudflare Pages: conectar el repositorio,
build `npm run build`, salida `dist`, y las mismas dos variables de
entorno. En ese caso **no** se define `VITE_BASE`. GitHub Pages sirve
bien mientras tanto y no exige registrar tarjeta.
