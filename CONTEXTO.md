# Contexto del proyecto

Documento de traspaso. Guárdalo en la raíz del repositorio: sirve para que
cualquiera —persona o agente— entienda no solo qué hay, sino por qué está
así. Las decisiones de este proyecto tienen razones que no son obvias
mirando el código.

---

## Qué es

Registro unificado de mascotas perdidas y encontradas para el Eje Cafetero
(Risaralda, Quindío, Caldas, Valle del Cauca).

Contexto real: emergencia en curso en Pereira. Están llegando cientos de
perros y gatos perdidos a refugios, hogares temporales y casas de familia.
La información está dispersa en publicaciones de Instagram, sin estructura,
y los tutores no logran ubicar a sus animales.

Arranca con un refugio grande de Pereira. La idea es ir vinculando más
refugios de los cuatro departamentos y que la información quede en un solo
lugar.

**Restricciones que definen todo el diseño:**

- Gratuito. Sin presupuesto.
- Rápido. Hay animales esperando.
- Los usuarios están conmocionados: no pueden llenar formularios largos ni
  escribir descripciones cuidadosas.
- El equipo incluye dos personas sin experiencia técnica que deben poder
  aportar de verdad.

---

## Estado actual

Prototipo funcional y compilado. Falta desplegarlo.

**Hecho**

- Frontend en React + Vite, en español, con formularios de opción cerrada.
- Motor de coincidencias con puntaje ponderado.
- Diccionario de conceptos para cruzar notas libres por significado.
- Esquema SQL completo con RLS, auditoría y borrado revocado.
- Compresión de fotos en el navegador, con miniatura aparte.
- Workflows de respaldo diario y anti-pausa.

**Falta**

- Pantalla de inicio de sesión para voluntarios. Ya está protegido por RLS
  (marcar reencuentros falla sin sesión), pero no hay interfaz de login.
  Es lo siguiente en la lista.
- Panel de moderación para aprobar fichas `verificado = false`.
- Vista de cruce inverso: mascota nueva contra búsquedas abiertas. La
  función `busquedasParecidas()` ya existe en `coincidencia.js`, sin usar.
- Desplegar: Supabase + Cloudflare Pages.
- Decidir si los teléfonos de contacto se muestran públicos.

---

## Decisiones y por qué

Estas son las que importa no revertir sin entender el motivo.

### El formulario es casi todo de selección

Solo hay tres campos de texto libre: barrio, contacto y una nota de 180
caracteres.

No es por simplicidad estética. Es que si un voluntario escribe "cafecito
con manchitas" y el tutor escribe "marrón con blanco", **ningún sistema los
cruza**. El vocabulario cerrado es lo que hace posible comparar. Si alguien
propone "dejemos que escriban libre, es más natural", el cruce se muere.

### La foto no participa en el cruce

Es para que el humano confirme, nada más.

Se evaluó usar embeddings de imagen (CLIP, DINOv2, MegaDescriptor). Se
descartó para v1 por una razón concreta: la foto del tutor es su perro
limpio y dormido en el sofá; la del refugio es el mismo perro mojado,
sucio y aterrado en una jaula. La distancia entre esas dos imágenes puede
ser mayor que entre dos perros distintos fotografiados ambos en jaula. El
fondo domina la señal.

Y hay un riesgo peor que la imprecisión: un porcentaje grande al lado de una
foto hace que la gente le crea al número por encima de sus propios ojos. En
este contexto eso termina en entregas equivocadas.

Si algún día se agrega, el uso correcto es **detectar duplicados** (la misma
foto publicada por tres cuentas distintas), que es un problema mucho más
fácil y resuelve el desorden original.

### La nota libre se cruza por diccionario, no por embeddings

`src/lib/conceptos.js` agrupa las formas de decir lo mismo: "cojea",
"renquea", "camina mal" caen en un solo concepto. Se busca por raíz, así
que "cojeando" y "cojito" también entran. Hay una guarda de negación:
"sin collar" y "no cojea" no cuentan como presencia.

Se prefirió sobre embeddings de texto porque en frases de 6 a 10 palabras
los modelos multilingües pequeños confunden estructura con significado
("muy asustado" y "muy tranquilo" salen parecidos), y porque **un voluntario
puede corregir un diccionario y no puede corregir un modelo**. Ese archivo
está escrito para que lo edite gente que no programa.

### Tres reglas del puntaje

1. Solo se comparan los campos que ambas partes respondieron. Lo que el
   tutor no recuerda no le quita candidatos.
2. Los valores vecinos suman parcial (beige/blanco, mediano/grande,
   adulto/mayor). La gente los confunde bajo estrés.
3. **La nota solo suma, nunca resta.** Si el tutor menciona algo y la ficha
   no lo confirma, no es evidencia en contra: el voluntario pudo no haberse
   fijado. Esta asimetría es deliberada.

### Nada se borra

No hay `DELETE` en la aplicación. Marcar reencontrado cambia un estado;
retirar una ficha la oculta. El permiso de borrado está revocado a nivel de
Postgres, así que ni un error de código puede borrar. Cada cambio queda en
la tabla `historial`.

Motivo: el plan gratuito de Supabase **no tiene backups**. Prevenir el
borrado importa más que repararlo.

### RLS no es opcional

La llave `anon` va dentro del navegador y cualquiera puede leerla. Sin
políticas de RLS, cualquier persona con las herramientas del navegador
puede vaciar la base en una tarde. La seguridad vive en Postgres, no en el
frontend.

Reglas: cualquiera lee las fichas; cualquiera crea una ficha, pero entra
`verificado = false` y no puede autoaprobarse; solo un voluntario activo
modifica. Las búsquedas de tutores llevan teléfonos de particulares, así
que solo las leen voluntarios.

---

## Infraestructura

- **Frontend**: Cloudflare Pages (gratis, CDN, aguanta picos de Instagram).
- **Backend**: Supabase plan gratuito. Postgres, Storage, Auth.
- **No hay servidor propio.** El navegador habla directo con Supabase.
- **No hace falta cuenta de AWS.** Supabase corre sobre AWS pero el registro
  es solo con Supabase.

**Región**: elegir `us-east-1` (Virginia). El tráfico colombiano sale por
Miami, así que responde mejor que São Paulo. **La elección es prácticamente
permanente.**

**Límites del plan gratuito y qué significan:**

| Recurso | Límite | Nota |
|---|---|---|
| Base de datos | 500 MB | De sobra. Son datos, no fotos. |
| Almacenamiento | 1 GB | ~5.000 fotos comprimidas. Sin comprimir, 250. |
| Tráfico de salida | 5 GB/mes | **El que primero se agota.** |

El tráfico se consume cada vez que alguien *ve* una foto. Mil visitantes
revisando 30 fotos son 6 GB en un día. Por eso hay miniatura de 320px para
el listado y la grande solo al abrir la ficha.

**Mejora pendiente de mayor rendimiento**: mover las fotos a Cloudflare R2.
10 GB gratis y salida de datos sin cobro nunca, lo que elimina el problema
del tráfico por completo. Requiere método de pago registrado aunque no
cobre.

**Dos trampas del plan gratuito:**

- Los proyectos se pausan solos tras 7 días sin consultas. Por eso existe
  `mantener-activo.yml`. Sin eso, un día alguien busca su perro y la página
  está muerta.
- No hay backups. Por eso existe `respaldo.yml`. **Correr ambos a mano una
  vez apenas se desplieguen**, no esperar a necesitarlos.

---

## Pendientes no técnicos

Pesan más que el código y no los puede resolver un desarrollador:

**Los teléfonos quedan públicos** en internet, indexables, permanentes. No
es un grupo de WhatsApp. Recomendación: que el botón escriba al grupo de
voluntarios en vez de exponer el número de cada persona. Es poco código y
evita un problema feo.

**Protocolo de entrega**: qué prueba pide un refugio para entregar un
animal. Con mascotas de raza y en emergencia aparecen reclamos falsos. Debe
definirlo alguien del refugio con autoridad, antes del primer reclamo.

**Redirigir las cuentas de Instagram** que ya publican hacia un solo enlace.
Sin eso la página existe pero la información sigue dispersa.

**Trabajo para las dos personas sin experiencia técnica:** convertir las
publicaciones de Instagram en fichas del formulario (ahí está el volumen
hoy), y confirmar entregas marcando reencuentros. Si lo segundo no se hace,
el listado se llena de animales que ya tienen casa.

---

## Estructura

```
src/lib/catalogo.js      Vocabulario cerrado del formulario
src/lib/conceptos.js     Diccionario de sinónimos ← editable sin programar
src/lib/coincidencia.js  Motor de puntaje
src/lib/foto.js          Compresión y subida
src/App.jsx              Interfaz completa (un solo archivo, se puede dividir)
supabase/schema.sql      Tablas, RLS, auditoría
.github/workflows/       Respaldo diario y anti-pausa
```

Todo el código, los comentarios y la interfaz están en español. Mantenerlo
así: el equipo que va a sostener esto es local.
