# Huellas a Casa

Registro unificado de mascotas perdidas y encontradas para Risaralda, Quindío,
Caldas y Valle del Cauca.

**Página:** https://huellas-a-casa.huellas-a-casa.workers.dev

Refugios, hogares temporales y familias que acogen registran en un mismo lugar.
Los tutores buscan respondiendo un formulario de opciones, sin escribir
descripciones largas, y reciben un número de registro para seguir su caso.
Es gratuito, comunitario y temporal: existe por la emergencia y se cierra
cuando deje de hacer falta ([CIERRE.md](CIERRE.md)). En uso real desde el
16 de agosto de 2026.

---

## Qué hace hoy

- **Registrar un animal encontrado** con foto, rasgos de opción múltiple y
  quién lo cuida. Cualquiera puede; la ficha entra **sin verificar** (foto
  borrosa al público) hasta que un voluntario la aprueba.
- **Buscar una mascota perdida** marcando rasgos. El sistema compara con
  todas las fichas y ordena por parecido. La búsqueda queda guardada con un
  **número de registro** (`BUS-7K3MQ`); con él el tutor consulta
  «¿Cómo va mi búsqueda?» y la cierra si ya apareció.
- **Compartir fichas** por WhatsApp con foto y datos en la vista previa
  (`/m/PER-0012`).
- **Panel de voluntarios**: aprobar, editar y ocultar fichas, marcar
  reencuentros (con aviso si hay «gemelas»), ver búsquedas abiertas con su
  contacto y las fichas que se les parecen hoy.
- Antes de guardar avisa si el mismo animal **ya parece registrado**.

### Cómo funciona el cruce (en corto)

Casi todo el formulario es de selección; eso hace posible comparar. Solo se
comparan los campos que ambas partes respondieron; los valores vecinos
(beige/blanco) suman parcial; la nota libre solo suma, nunca resta, y se
cruza por significado («cojea» = «renquea», diccionario en
[`src/lib/conceptos.js`](src/lib/conceptos.js)); el porcentaje refleja
cuánta información se comparó. **La foto no entra al cruce**: es para que
el humano confirme. Detalle y razones en [CONTEXTO.md](CONTEXTO.md);
`npm run probar` corre los casos de prueba del motor.

---

## Cómo involucrarte

No hace falta programar. Escríbenos por WhatsApp al **+57 301 8009036** o al
correo **huellasacasa.eje@gmail.com**.

| Si eres… | Puedes… |
|---|---|
| **Refugio, hogar de paso o familia que acoge** | Registrar los animales que recibes en la página. Toma un minuto por animal: foto y casillas. Si registras seguido, pide cuenta de voluntario. |
| **Voluntario/a** | Aprobar fichas, cruzar búsquedas abiertas con lo que llega, avisar a los tutores, marcar reencuentros. Se te crea un usuario y entras por «Voluntarios» arriba a la derecha. |
| **Alguien que quiere ayudar desde el teléfono** | Difundir la página en grupos y cuentas de la región; revisar publicaciones de Instagram y registrar los animales que aparecen ahí (hay un campo para el enlace original). |
| **Alguien que sabe un poco de código, o quiere aprender con Claude** | Ver [CONTRIBUIR.md](CONTRIBUIR.md) y elegir algo del [ROADMAP.md](ROADMAP.md). Los sinónimos, catálogos (colores, razas, barrios) y textos se pueden editar sin miedo: si sale mal se revierte con un clic. |

Todo el código es público y todo cambio pasa por revisión automática antes de
llegar a la página; nadie paga ni cobra por esto.

---

## Qué sigue

Resumen de [ROADMAP.md](ROADMAP.md) (ahí está el detalle y el orden):

1. **Refugios como tabla propia** — siguiente paso. Filtrar por refugio y
   autollenar la ficha (municipio, ubicación, contacto) al elegirlo.
2. **Cuándo y dónde se perdió** en la búsqueda, para descartar animales
   recogidos antes de perderse.
3. **Cruce inverso con aviso**: al entrar una ficha nueva, mostrar las
   búsquedas abiertas que se le parecen (hoy el seguimiento es manual).
4. **Medir el cruce** («es mi mascota» / «no es») para ajustar los pesos
   con casos reales.
5. Cuidar los límites del plan gratis: paginar el listado, tope de subidas.

---

## Cómo está hecho

Todo en planes gratuitos.

| Pieza | Dónde |
|---|---|
| Página + Worker de fotos y vista previa | Cloudflare Workers; se publica sola con cada cambio en `main` |
| Base de datos (fichas, búsquedas, historial), con RLS | Supabase, región Virginia (EE. UU.) |
| Fotos | Cloudflare R2, bucket `huellas-fotos` |
| Pruebas (staging) | Segundo proyecto de Supabase; cada PR se prueba ahí, nunca contra la base real |
| Respaldos | Repo privado `huellas-a-casa-respaldos`: base cada noche, fotos cada domingo |
| Código | Este repositorio, público |

**Datos personales:** qué se guarda, quién lo ve y cómo pedir corrección o
retiro está en la propia página («Tus datos»), según la Ley 1581 de 2012.
Los contactos de quien busca a su mascota solo los ven voluntarios.
**Nada se borra**: no hay `DELETE` en la aplicación ni permiso de borrado en
la base; cada cambio queda en `historial`.

```
src/App.jsx              Interfaz
src/lib/catalogo.js      Vocabulario cerrado del formulario   ← editable
src/lib/conceptos.js     Sinónimos de la nota libre           ← editable
src/lib/sugerencias.js   Palabras que sugieren casillas       ← editable
src/lib/coincidencia.js  Motor de puntaje, duplicados y gemelas
worker/index.js          Fotos en R2 y vista previa al compartir
supabase/migrations/     Esquema y migraciones, en orden (solo se agregan)
scripts/                 Build, pruebas del cruce y del esquema, semilla de staging
.github/workflows/       CI, migraciones automáticas, respaldos, vigía
```

---

## Mantener esto al día

Lo mínimo para que el proyecto siga sano sin depender de una persona:

- **Cada cambio va por PR.** El CI compila, prueba el motor y las
  migraciones, y aplica las migraciones a staging y producción al fusionar.
  Lo reversible se fusiona solo; lo delicado (base, despliegue, permisos)
  necesita aprobación de Lau. Detalle: [CONTRIBUIR.md](CONTRIBUIR.md).
- **Si un workflow falla, GitHub avisa por correo** a los administradores.
  El «Vigía» corre cada mañana y avisa si la base, el Worker o las fichas
  sin verificar pasan un umbral, o si a producción le falta una migración.
- **Dar de alta o de baja voluntarios**, revisar métricas, aplicar el plan
  de cierre: [DESPLIEGUE.md](DESPLIEGUE.md) («Operación»).
- **Cuando cambies algo que estos documentos describen, actualízalos en el
  mismo PR.** README = qué es y qué sigue; ROADMAP = orden y por qué;
  CONTEXTO = decisiones de diseño; DESPLIEGUE = cómo se opera.
- **Cada tres meses** revisar si la iniciativa sigue haciendo falta
  ([CIERRE.md](CIERRE.md); primera revisión: noviembre de 2026).

### Correr en local

```bash
npm install
npm run dev              # la página, contra la base de producción (.env.production)
cp .env.staging .env.local   # para escribir datos de prueba sin tocar la real
npx wrangler dev         # en otra terminal, si necesitas subir fotos
```

Voluntaria de prueba (solo staging): `pruebas.huellasacasa@gmail.com`.
`python scripts/semilla-staging.py` siembra ~30 fichas inventadas en staging.
