# Cómo contribuir

Gracias por sumarte. Esta página la usa gente real, angustiada, ahora mismo.
Por eso el flujo es corto pero estricto: **nada llega a producción sin pasar
por un PR y por el CI.** Lo reversible se fusiona solo cuando el CI está en
verde; lo difícil de deshacer (base de datos, despliegue, permisos) además
necesita la aprobación de Lau. Si trabajas con Claude,
él ya conoce estas reglas ([CLAUDE.md](CLAUDE.md)); igual léelas tú.

---

## Las 5 cosas que nunca se hacen

1. **Trabajar sobre `main`.** Siempre una rama nueva.
2. **Tocar la base de producción.** Ni un `select`. Lo que necesite base va
   como archivo en `supabase/migrations/` y **Lau lo aplica**.
3. **Editar o borrar una migración que ya existe.** Solo se agregan nuevas.
4. **Subir secretos** (contraseñas, tokens, llaves). El CI lo bloquea.
5. **`git push --force`**, `--no-verify`, `wrangler deploy`. Nunca.

Si el cambio que quieres hacer choca con alguna, para y pregunta en el PR.

---

## El flujo, en 8 pasos

```
 tu rama ──► PR ──► CI verde ──► vista previa OK ──► se fusiona solo (squash) ──► producción
                                                        ▲
                     si toca archivos delicados: además, aprobación de Lau
```

1. **Ponte al día y crea tu rama** (nombre corto, en español, sin espacios):
   ```bash
   git checkout main && git pull
   git checkout -b barrios-armenia
   ```
2. **Haz el cambio.** Uno solo por rama. Chico y claro.
3. **Pruébalo en tu máquina**:
   ```bash
   npm ci && npm run probar && npm run build
   ```
   `npm run dev` levanta la página en local. Para escribir datos de prueba,
   `cp .env.staging .env.local` (usa la base de pruebas, no la real).
4. **Sube la rama y abre el PR**:
   ```bash
   git push -u origin barrios-armenia
   gh pr create                    # o desde GitHub; se llena la plantilla
   gh pr merge --auto --squash     # «fusiónalo solo cuando todo esté en verde»
   ```
   Título en español que diga qué cambia para quien usa la página. Ese
   título es lo que queda en la historia.
5. **Espera el CI** (pestaña *Checks* del PR, ~3 min). Cuatro checks y los
   cuatro deben estar en verde:
   - `compilar` — el motor de cruce da lo esperado y compila en prod y staging.
   - `base-de-datos` — todas las migraciones corren desde cero y el código
     encuentra todas sus columnas.
   - `revisar` — sin secretos, migraciones solo agregadas, sin archivos
     generados; avisa si tocas algo delicado.
   - `aprobacion` — si no tocas nada delicado, verde solo. Si tocas algo
     delicado, rojo hasta que Lau apruebe (no es un error tuyo).

   Si algo falla, el mensaje dice qué y cómo arreglarlo. Arreglas, haces
   commit, push, y vuelve a correr solo.
6. **Prueba en la vista previa.** Cloudflare comenta en el PR una URL propia
   de tu rama (franja morada «ENTORNO DE PRUEBAS», base de staging). Ahí
   registra una ficha o una búsqueda de mentira y confirma que se ve y se
   guarda como esperabas. Marca la casilla en la plantilla.
7. **Se fusiona.** Si activaste el auto-merge y no tocas nada delicado, en
   cuanto los cuatro checks estén en verde GitHub lo fusiona solo (squash).
   Si tocas algo delicado, espera la aprobación de Lau: ella puede pedir
   cambios (los haces en la misma rama; la aprobación se pide de nuevo). Si
   trae migración, ella la aplica primero en staging.
8. **Producción se actualiza sola** en ~1 minuto. Si había migración, Lau la
   aplica en producción justo después. La rama se borra sola.

---

## Si algo sale mal en producción

No entres en pánico ni intentes «arreglar rápido» sobre `main`. En GitHub,
en el PR que lo causó, botón **Revert** → se abre un PR de reversión → pasa el
CI y se fusiona (solo, o Lau si toca delicados) → producción vuelve al estado
anterior en un minuto. Luego se
arregla con calma en una rama nueva.

Hay respaldo diario de la base y semanal de las fotos (repo privado
`huellas-a-casa-respaldos`), y un vigía que avisa cada mañana si algo se
sale de lo normal — incluido si a producción le falta una migración.

---

## Qué puedes cambiar sin miedo

- **Catálogos** (`src/lib/catalogo.js`): colores, señas, razas, municipios,
  barrios sugeridos. Es solo agregar texto entre comillas.
- **Diccionarios de la nota libre** (`src/lib/conceptos.js`,
  `src/lib/sugerencias.js`): sinónimos que la gente escribe.
- **Textos de la página** (`src/App.jsx`): tuteando, cortos, en español.
- **Documentación**: si cambias algo que el README o ROADMAP describen,
  actualízalos en el mismo PR.

## Qué necesita la aprobación de Lau (archivos delicados)

La lista exacta está en [`scripts/ci/delicados.txt`](scripts/ci/delicados.txt).
En resumen: migraciones de la base, `.github/`, `.claude/`, `wrangler.jsonc`,
`.env.*`, `scripts/build.mjs`, `worker/`, `package.json` (dependencias), el
motor de cruce y el acceso a la base (`coincidencia.js`, `supabase.js`,
`sesion.js`, `foto.js`), y estos documentos. Criterio: **si sale mal, no se
arregla con un Revert.** No está prohibido tocarlos; solo que el PR no se
fusiona solo. Explica por qué en la descripción.

También avisa en el PR si un cambio expone datos de tutores o voluntarios,
aunque no toque esos archivos.

---

## Dónde está cada cosa

Ver el mapa en [CLAUDE.md](CLAUDE.md) §2, y para montaje y operación
[DESPLIEGUE.md](DESPLIEGUE.md). Lo que sigue por hacer está en
[ROADMAP.md](ROADMAP.md): elige algo de ahí o propón en un issue antes de
arrancar, para no duplicar trabajo.
