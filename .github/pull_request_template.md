## Qué cambia (para quien usa la página)

<!-- Una o dos frases. Ej.: «Al marcar cicatriz o tatuaje, se puede decir dónde está.» -->

## Por qué

<!-- Quién lo pidió o qué problema resuelve. -->

## Cómo lo probé

- [ ] `npm run probar` y `npm run build` en verde en mi máquina
- [ ] Lo probé en la **vista previa** del PR (URL que comenta Cloudflare aquí abajo, base de staging)
- [ ] Si toca la ficha o la búsqueda: creé una de prueba en la vista previa y se guardó bien

## Base de datos

- [ ] No toca la base
- [ ] Trae migración nueva en `supabase/migrations/` (solo agrega, no edita las viejas). **Lau la aplica** en staging → prod después de aprobar.

## Archivos delicados (lista en `scripts/ci/delicados.txt`)

- [ ] No toca ninguno → con el CI en verde se fusiona solo (`gh pr merge --auto --squash`)
- [ ] Sí toca alguno → necesita la aprobación de Lau; explico por qué aquí:

<!-- Recuerda: se fusiona con squash; el título de este PR es lo que queda en la historia. En español, diciendo qué cambia. -->
