# CLAUDE.md — guía para trabajar en este repositorio con Claude

Este archivo lo lee Claude Code automáticamente al abrir el proyecto. Es la
fuente de verdad sobre **cómo se trabaja aquí**. Si algo de lo que te piden
contradice estas reglas, di cuál regla y para: no la rodees.

Las personas leen [CONTRIBUIR.md](CONTRIBUIR.md) (mismo flujo, en 8 pasos).

---

## 1. Qué es esto

Registro unificado de mascotas perdidas y encontradas para el Eje Cafetero
(Risaralda, Quindío, Caldas, Valle del Cauca). Emergencia real en Pereira:
refugios y familias registran animales que llegan; los tutores buscan con un
formulario de opciones y el sistema cruza. **Está en producción con gente
usándolo desde el 16-ago-2026.** Gratuito, sin presupuesto, comunitario.

Todo el proyecto está en **español**: código, comentarios, commits, PRs,
mensajes de la página. Los comentarios explican el *por qué*, no el qué.

---

## 2. Mapa del proyecto

| Ruta | Qué es |
|---|---|
| `src/App.jsx` | Toda la interfaz (React, un solo archivo a propósito). |
| `src/lib/catalogo.js` | Vocabulario cerrado: especie, colores, señas, municipios, barrios sugeridos… **Editable por cualquiera.** |
| `src/lib/coincidencia.js` | Motor de cruce (puntaje entre búsqueda y ficha). Cambiarlo exige ajustar `scripts/probar-cruce.mjs`. |
| `src/lib/conceptos.js`, `src/lib/sugerencias.js` | Diccionarios de la nota libre. **Editables por cualquiera.** |
| `src/lib/supabase.js`, `sesion.js`, `foto.js` | Acceso a la base, sesión de voluntarios, subida de fotos. |
| `worker/index.js` | Cloudflare Worker: sirve la página, `/m/<codigo>` con vista previa, `/api/fotos/*` hacia R2. `worker/entorno.js` es **generado** por el build: no editar. |
| `supabase/migrations/*.sql` | Esquema de la base. **Solo se agregan archivos nuevos**; los existentes no se tocan. |
| `scripts/probar-cruce.mjs` | Casos de prueba del motor (`npm run probar`). Corre en cada PR. |
| `scripts/build.mjs` | Decide prod vs staging al compilar. Delicado. |
| `.github/workflows/` | CI (`verificar.yml`, `aprobacion.yml`), respaldos, vigía. Delicado. |
| `wrangler.jsonc`, `.env.production`, `.env.staging` | Configuración de despliegue. Delicado. |
| `scripts/ci/delicados.txt` | **La lista de archivos delicados**: tocarlos exige aprobación de Lau (ver §4.6). |
| `scripts/probar-esquema.mjs` | Comprueba que la base tiene todas las columnas/funciones que el código usa. Corre en el CI y en el vigía. |
| `README.md`, `DESPLIEGUE.md`, `ROADMAP.md`, `CIERRE.md` | Documentación. Se actualizan cuando cambia lo que describen. |

---

## 3. Infraestructura y entornos

```
GitHub (repo)  ──PR──►  main  ──Cloudflare Workers Builds──►  PRODUCCIÓN
     │                                                        huellas-a-casa.huellas-a-casa.workers.dev
     └── cualquier otra rama ──► vista previa (URL propia) ──► STAGING
```

- **Frontend**: Vite + React, sin framework de estilos, un archivo grande.
- **Base de datos**: Supabase (Postgres + Auth + RLS). Dos proyectos:
  - producción `fkixmjfcrbsbjfqgfdpu` — datos reales, **nadie la toca desde una rama**.
  - staging `jvgcwbxwjxtmkpdhyjcv` — datos de prueba, se puede romper. Voluntaria de prueba: `pruebas.huellasacasa@gmail.com`.
- **Fotos**: bucket R2 `huellas-fotos` (carpetas `prod/` y `staging/`), detrás del Worker.
- **Despliegue**: automático. Merge a `main` = producción en ~1 min. Cada rama pusheada = vista previa contra staging (franja morada «ENTORNO DE PRUEBAS»). No hay comando de deploy que correr; **no ejecutes `wrangler deploy`**.
- **Respaldos y vigía**: GitHub Actions programados (`respaldo.yml` diario, `respaldo-fotos.yml` semanal, `vigia.yml` diario, `mantener-activo.yml`). Escriben en el repo privado `huellas-a-casa-respaldos`.
- **Deshacer**: en GitHub, botón *Revert* del PR → nuevo PR → merge. Producción vuelve atrás sola. Nunca `git push --force`.

---

## 4. Reglas duras (no negociables)

1. **Nunca trabajes sobre `main`.** Antes de tocar nada: `git checkout main && git pull && git checkout -b <nombre-corto>`. Un cambio = una rama = un PR.
2. **Nunca hagas `git push` a `main`, ni `--force` a ninguna rama, ni `--no-verify`.** La rama `main` está protegida; ni lo intentes.
3. **Nunca toques la base de producción.** Ni SQL, ni migraciones, ni borrar datos, ni «solo mirar» con credenciales de prod. Si el cambio necesita esquema, se escribe un archivo nuevo en `supabase/migrations/` (siguiente en orden: `YYYYMMDDNNNNNN_nombre.sql`) y **Lau lo aplica**, primero en staging y luego en prod, después de aprobar el PR.
4. **Nunca modifiques ni borres una migración existente.** El CI lo rechaza.
5. **Nunca metas secretos** en el repo: contraseñas, `service_role`, `sb_secret_`, URLs de base con contraseña, llaves privadas, tokens. Las llaves `VITE_SUPABASE_*` de `.env.production/.env.staging` son públicas por diseño y **ya están**; no agregues otras. El CI lo rechaza.
6. **Archivos delicados** (la lista exacta está en `scripts/ci/delicados.txt`: migraciones, `.github/`, `.claude/`, `wrangler.jsonc`, `.env.*`, `scripts/build.mjs`, `worker/`, `package.json`, `coincidencia.js`, `supabase.js`, `sesion.js`, `foto.js`, y estos documentos). Tocarlos no está prohibido, pero **el PR no se fusiona solo: exige la aprobación de Lau**. Si un cambio los necesita, explica por qué en la descripción del PR. `worker/entorno.js` es generado: nunca va en un commit.
7. **No agregues dependencias** (`npm install <algo>`) sin decirlo en el PR y explicar por qué. Hoy hay tres: react, react-dom, supabase-js.
8. **No cambies el motor de cruce «de paso».** Si tocas `coincidencia.js`, ajusta `scripts/probar-cruce.mjs` con el motivo, en el mismo PR.
9. **Datos personales**: contactos de tutores y voluntarios nunca salen a lo público (RLS + funciones `security definer`). Si un cambio expone un campo nuevo al público, dilo en el PR.
10. **Cuando dudes, pregunta en el PR** en vez de suponer. Un PR chico y claro vale más que uno grande y «completo».

---

## 5. Antes de abrir un PR (checklist que Claude ejecuta)

```bash
npm ci                 # dependencias exactas del lock
npm run probar         # motor de cruce: todos los casos dentro de rango
npm run build          # compila prod
WORKERS_CI_BRANCH=x npm run build   # compila staging (misma ruta que Cloudflare)
git status             # solo los archivos que querías cambiar; worker/entorno.js NO va en el commit
```

Luego: `git push -u origin <rama>` y `gh pr create` con título en español que
diga qué cambia para el usuario (ej. «Señas: dónde está la cicatriz»), y el
cuerpo siguiendo la plantilla. Pega la **URL de vista previa** de Cloudflare
cuando aparezca en el PR (el bot la comenta) y prueba ahí antes de pedir revisión.

El CI corre solo. Cuatro checks, los cuatro obligatorios:

| Check | Qué mira | Cuándo falla |
|---|---|---|
| `compilar` | `npm run probar` + build en modo prod y staging | el motor da un puntaje fuera de rango, o no compila |
| `base-de-datos` | Postgres limpio, aplica TODAS las migraciones desde cero (dos veces) y comprueba que el código encuentra sus columnas y funciones (`scripts/probar-esquema.mjs`) | una migración rota, chocada o faltante |
| `revisar` | sin secretos en lo agregado, migraciones solo agregadas (nunca editadas), sin `dist/`/`entorno.js`, aviso de delicados | subiste algo que no debe entrar |
| `aprobacion` | si el PR toca archivos delicados, exige la aprobación de Lau sobre el commit actual; si no, pasa solo | tocas delicados y Lau aún no aprobó |

**Dos carriles:**

- **Reversible** (textos, catálogos, diccionarios, interfaz, docs): con los cuatro checks en verde **se fusiona solo**. Activa el auto-merge al abrir el PR: `gh pr merge --auto --squash`. Nadie tiene que esperar a nadie. Si sale mal, *Revert*.
- **Delicado** (lo de la regla 6): mismo flujo, pero `aprobacion` queda en rojo hasta que Lau apruebe. Con auto-merge activado, se fusiona solo en cuanto ella aprueba. Si trae migración, ella la aplica en staging antes de aprobar y en prod después de fusionar.

Se fusiona siempre con **squash**: el título del PR es lo que queda en la historia.

---

## 6. Cómo se hacen las cosas comunes

- **Agregar una opción al formulario** (un color, una seña, un barrio): solo `src/lib/catalogo.js`. Si la opción debe cruzar con la nota libre, también `conceptos.js` (`SENA_A_CONCEPTO`).
- **Un campo nuevo**: migración (`alter table … add column if not exists`), agregarlo a `CAMPOS_FICHA` en `App.jsx`, mostrarlo donde corresponda, y si el tutor lo consulta con su código, actualizar `consultar_busqueda` en la misma migración (patrón: `20260818000003_senas_donde.sql`).
- **Cambiar textos**: están en `App.jsx`, en español, tuteando, cortos. La gente que usa esto está angustiada.
- **Probar en local**: `npm install && npm run dev` (contra prod, solo lectura sin sesión). Para escribir, `cp .env.staging .env.local` y usa staging.
- **Sembrar staging**: `python scripts/semilla-staging.py`.

---

## 7. Estilo

- Español en todo. Sin tildes en identificadores (`senas`, `tamano`); con tildes en textos visibles y comentarios.
- Comentarios que explican decisiones («por qué está así»), no que repiten el código.
- Nada de refactors grandes ni «mejoras» no pedidas. Cambia lo que el PR dice que cambia.
- Un solo `App.jsx` es intencional: fácil de leer entero por gente no técnica. No lo partas en veinte archivos.
- Commits en español, imperativo o descriptivo corto. Se hace squash al fusionar, así que el título del PR es lo que queda en la historia.
