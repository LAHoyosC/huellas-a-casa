// Comprueba que la base de datos tiene TODO lo que el código usa.
//
// Lee el código (src/App.jsx, worker/index.js) y saca:
//   - las columnas que la página escribe o lee en `mascotas` y `busquedas`
//   - las funciones que llama por RPC (consultar_busqueda, cerrar_busqueda…)
// y las compara con lo que hay de verdad en una base de datos.
//
// La base se le pasa como un archivo de texto con una fila por línea:
//   tabla.columna        (por ejemplo  mascotas.senas_donde)
//   funcion:nombre       (por ejemplo  funcion:consultar_busqueda)
// Ese archivo lo produce psql con la consulta CONSULTA_ESQUEMA de abajo:
//   psql "$URL" -X -A -t -c "$(node scripts/probar-esquema.mjs --consulta)" > esquema.txt
//   node scripts/probar-esquema.mjs esquema.txt
//
// Se usa en dos sitios:
//   - CI de cada PR (verificar.yml): contra un Postgres recién creado al que
//     se le aplicaron todas las migraciones del repo. Si falla, la migración
//     que acompaña al cambio falta o está incompleta.
//   - Vigía diario (vigia.yml): contra PRODUCCIÓN (solo lectura). Si falla,
//     hay una migración fusionada que todavía no se aplicó en prod.
//
// Sin dependencias: solo Node.

import { readFileSync } from "node:fs";

export const CONSULTA_ESQUEMA = `
  select table_name || '.' || column_name from information_schema.columns
   where table_schema = 'public' and table_name in ('mascotas','busquedas','voluntarios','historial','refugios','adopciones')
  union all
  select 'funcion:' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
`;

if (process.argv.includes("--consulta")) {
  process.stdout.write(CONSULTA_ESQUEMA.trim());
  process.exit(0);
}

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const worker = readFileSync(new URL("../worker/index.js", import.meta.url), "utf8");

const cadenas = (txt) => [...txt.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
const literal = (nombre) => {
  const m = app.match(new RegExp(`const ${nombre} = \\[([\\s\\S]*?)\\];`));
  if (!m) throw new Error(`No encontré «const ${nombre} = [...]» en src/App.jsx`);
  return cadenas(m[1]);
};

// Lo que escribe la ficha del voluntario (editar/crear) -> mascotas.
const ficha = new Set(literal("CAMPOS_FICHA"));
// Lo que marcan Rasgos y Zona: son los mismos campos en la ficha y en la
// búsqueda del tutor -> deben existir en las DOS tablas.
const compartidos = new Set([...app.matchAll(/\bset\("([a-z_]+)"/g)].map((m) => m[1]));
// setR = solo ficha; setB = solo búsqueda.
for (const m of app.matchAll(/\bsetR\("([a-z_]+)"/g)) ficha.add(m[1]);
const busqueda = new Set([...app.matchAll(/\bsetB\("([a-z_]+)"/g)].map((m) => m[1]));
// Columnas que el insert de la búsqueda agrega por su cuenta (ver buscar()).
for (const c of ["id", "codigo", "estado", "foto_url", "foto_thumb_url", "creado_en"]) busqueda.add(c);
for (const c of ["id", "codigo", "estado", "verificado", "creado_en", "foto_url", "foto_thumb_url"]) ficha.add(c);
// Lo que el Worker pide a mascotas para la vista previa de /m/<codigo>.
const sel = worker.match(/searchParams\.set\("select",\s*"([^"]+)"\)/);
if (sel) for (const c of sel[1].split(",")) ficha.add(c.trim());
// Refugios: lo que escribe el panel de voluntarios (CAMPOS_REFUGIO en App.jsx).
const refugio = new Set(literal("CAMPOS_REFUGIO"));
for (const c of ["id", "activo", "creado_en"]) refugio.add(c);
// Adopciones: lo que escribe el voluntario (CAMPOS_ADOPCION en App.jsx) más
// lo que el insert y el filtro agregan por su cuenta.
const adopcion = new Set(literal("CAMPOS_ADOPCION"));
for (const c of ["id", "mascota_id", "estado", "creado_por", "creado_en"]) adopcion.add(c);
// Lo que la sesión lee del voluntario (src/lib/sesion.js).
const voluntario = new Set(["id", "nombre", "refugio", "refugio_id", "activo"]);
// Funciones RPC.
const funciones = new Set([...app.matchAll(/\.rpc\("([a-z_]+)"/g)].map((m) => m[1]));

const esperado = [
  ...[...ficha].map((c) => `mascotas.${c}`),
  ...[...compartidos].flatMap((c) => [`mascotas.${c}`, `busquedas.${c}`]),
  ...[...busqueda].map((c) => `busquedas.${c}`),
  ...[...refugio].map((c) => `refugios.${c}`),
  ...[...adopcion].map((c) => `adopciones.${c}`),
  ...[...voluntario].map((c) => `voluntarios.${c}`),
  ...[...funciones].map((f) => `funcion:${f}`),
];

const archivo = process.argv[2];
if (!archivo) {
  console.log("El código necesita esto en la base:\n" + [...new Set(esperado)].sort().join("\n"));
  console.log("\nPara comparar contra una base: node scripts/probar-esquema.mjs esquema.txt");
  process.exit(0);
}

const hay = new Set(readFileSync(archivo, "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
const faltan = [...new Set(esperado)].filter((x) => !hay.has(x)).sort();

if (faltan.length) {
  console.error("FALTA EN LA BASE DE DATOS (el código lo usa y no existe):");
  for (const f of faltan) console.error("  - " + f);
  console.error(
    "\nSi es el CI de un PR: falta una migración nueva en supabase/migrations/ (o está incompleta)." +
    "\nSi es el vigía: hay una migración fusionada que aún no se aplicó en producción (npx supabase db push)."
  );
  process.exit(1);
}
console.log(`Esquema al día: ${new Set(esperado).size} columnas/funciones que usa el código existen en la base.`);
