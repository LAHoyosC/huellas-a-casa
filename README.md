# Huellas a Casa

Registro unificado de mascotas perdidas y encontradas para Risaralda, Quindío, Caldas y Valle del Cauca.

Refugios, hogares temporales y familias que acogen registran en un mismo lugar. Los tutores buscan respondiendo un formulario de opciones, sin escribir descripciones largas.

---

## Cómo funciona el cruce

Casi todo el formulario es de selección. Eso es lo que hace posible comparar: si un voluntario escribe "cafecito con manchitas" y el tutor escribe "marrón con blanco", ningún sistema los cruza. Con vocabulario cerrado, sí.

Tres reglas gobiernan el puntaje:

1. **Solo se comparan los campos que ambas partes respondieron.** Alguien conmocionado que no recuerda la cola no pierde coincidencias.
2. **Los valores vecinos suman parcial.** Beige y blanco no son iguales, pero tampoco son lo mismo que blanco y negro.
3. **La nota libre solo suma, nunca resta.** Si el tutor menciona algo y la ficha no lo confirma, no es evidencia en contra: el voluntario pudo no haberse fijado.

La nota se cruza por significado, no por palabras exactas. "cojea", "renquea" y "camina mal" son lo mismo para el sistema. Ese diccionario vive en [`src/lib/conceptos.js`](src/lib/conceptos.js) y **lo puede editar cualquiera sin saber programar**.

**La foto no se usa para el cruce.** Es para que el humano confirme. El cotejo automático de imágenes falla mucho con animales sucios, mojados y asustados, y un porcentaje al lado de una foto hace que la gente le crea al número por encima de sus propios ojos. Eso, en este contexto, termina en entregas equivocadas.

---

## Montaje

### 1. Base de datos (Supabase)

No necesitas cuenta de AWS. Supabase corre sobre servidores de Amazon pero tú solo te registras en Supabase.

1. Crea una cuenta en [supabase.com](https://supabase.com) y un proyecto nuevo.
2. **Elige la región con cuidado: es prácticamente permanente.** Para Colombia, `us-east-1` (Virginia) suele responder mejor que São Paulo, porque el tráfico colombiano sale por Miami.
3. Abre **SQL Editor**, pega [`supabase/schema.sql`](supabase/schema.sql) completo y dale RUN.
4. En **Project Settings → API** copia el Project URL y la llave `anon`.

### 2. Variables

```bash
cp .env.example .env
```

Pega los dos valores. Son públicos: van dentro del navegador y cualquiera puede verlos. **La seguridad real está en las políticas RLS de Postgres**, no en esconder estas llaves. Por eso el paso 3 del schema no es opcional.

### 3. Correr en local

```bash
npm install
npm run dev
```

### 4. Publicar

Guía paso a paso, para hacer una sola vez: [**DESPLIEGUE.md**](DESPLIEGUE.md).

En corto: la página se publica sola en **GitHub Pages** con cada push a `main`
(workflow `publicar.yml`). Solo hay que poner `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY` como **variables** del repositorio. También funciona
en Cloudflare Pages (build `npm run build`, salida `dist`, mismas variables).

### 5. Los dos workflows que evitan desastres

En **Settings → Secrets and variables → Actions**, agrega:

| Secreto | Dónde sacarlo |
|---|---|
| `SUPABASE_DB_URL` | Project Settings → Database → Connection string → URI |
| `SUPABASE_URL` | Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Project Settings → API → anon public |

Con eso quedan andando:

- **`respaldo.yml`** — copia completa de la base cada noche, guardada en este mismo repositorio. **El plan gratuito de Supabase no tiene backups.** Esto es lo único que los protege de un borrado accidental.
- **`mantener-activo.yml`** — los proyectos gratuitos se pausan solos tras 7 días sin consultas. Si eso pasa, la página queda muerta hasta que alguien entre al panel. Esto lo evita.

Corran los dos a mano una vez desde la pestaña **Actions** para verificar que funcionan. No esperen a necesitarlos.

---

## Nada se borra

No hay `DELETE` en toda la aplicación. Marcar como reencontrado cambia un campo de estado; retirar una ficha la oculta. Además el permiso de borrado está revocado a nivel de Postgres, así que ni un error de código puede borrar. Cada cambio queda en la tabla `historial`.

---

## Dar de alta voluntarios

Cualquiera puede registrar una mascota encontrada, pero entra marcada como **sin verificar**. Solo un voluntario aprueba fichas y marca reencuentros.

1. La persona se registra, o créala en **Authentication → Users**.
2. Copia su UUID y corre en el SQL Editor:

```sql
insert into voluntarios (id, nombre, refugio)
values ('PEGA-AQUI-EL-UUID', 'Nombre', 'Refugio');
```

---

## Límites del plan gratuito

| Recurso | Límite | Qué significa aquí |
|---|---|---|
| Base de datos | 500 MB | Muchísimo. Son solo datos, no fotos. |
| Almacenamiento | 1 GB | ~5.000 fotos comprimidas. Sin comprimir, 250. |
| Tráfico de salida | 5 GB/mes | **El límite que primero se agota.** |

El tráfico se consume cada vez que alguien *ve* una foto. Si la página se vuelve viral y mil personas revisan un listado de 30 fotos, ahí van 6 GB en un día.

Por eso [`src/lib/foto.js`](src/lib/foto.js) comprime a ~200 KB y guarda una miniatura de 320px aparte: el listado usa la miniatura, la grande solo se carga al abrir la ficha.

**Si esto crece:** mover las fotos a Cloudflare R2. Da 10 GB gratis y la salida de datos no se cobra nunca, así que el problema del tráfico desaparece. Es la mejora que más rinde si el proyecto escala a los cuatro departamentos.

---

## Antes de abrir al público

Dos decisiones que no son técnicas pero pesan más que el código:

**Los teléfonos quedan públicos en internet**, indexables por Google, permanentes. No es un grupo de WhatsApp. Considera que el botón escriba al grupo de voluntarios en vez de mostrar el número de cada persona.

**Definan el protocolo de entrega** antes de que llegue el primer reclamo: qué prueba pide un refugio para entregar un animal. Con mascotas de raza y en emergencia aparecen reclamos falsos.

---

## Estructura

```
src/lib/catalogo.js      Vocabulario cerrado del formulario
src/lib/conceptos.js     Diccionario de sinónimos  ← editable por cualquiera
src/lib/coincidencia.js  Motor de puntaje
src/lib/foto.js          Compresión y subida
src/App.jsx              Interfaz
supabase/schema.sql      Tablas, RLS, auditoría
```
