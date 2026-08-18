// Clasifica una migración SQL por lo que DICE, sin criterio humano:
//
//   prohibida  -> el CI la rechaza. Aquí NADA se borra: ni tablas, ni
//                 columnas, ni filas, ni se apaga la seguridad por filas.
//   critica    -> pasa todas las pruebas Y además exige la aprobación de
//                 Lau: crear/quitar tablas, políticas RLS, funciones
//                 security definer, permisos, tipos, not null, tocar datos.
//   aditiva    -> solo agrega (columna nueva, índice, función normal,
//                 comentario). Con el CI en verde se fusiona y aplica sola.
//
// Lo que no encaje en "aditiva" es "critica": ante la duda, un humano.
//
// Uso:  node scripts/clasificar-migracion.mjs archivo.sql [otro.sql ...]
// Salida por archivo:  <nivel>\t<archivo>\t<motivos>
// Código de salida: 2 si alguna es prohibida, 0 si no.
// La misma tabla vive en CLAUDE.md §4 (mantenerlas iguales).

import { readFileSync } from "node:fs";

// Quita comentarios, cadenas y cuerpos de función ($$...$$), pasa a
// minúsculas y colapsa espacios. Los cuerpos de función se revisan aparte
// (una función security definer que borre es tan grave como un delete).
function limpiar(sql) {
  let s = sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
  const cuerpos = [];
  s = s.replace(/\$([a-z_]*)\$([\s\S]*?)\$\1\$/gi, (_, __, c) => { cuerpos.push(c); return " $CUERPO$ "; });
  s = s.replace(/'(?:[^']|'')*'/g, "'…'");
  return { s: s.toLowerCase().replace(/\s+/g, " ").trim(), cuerpos: cuerpos.map((c) => c.toLowerCase().replace(/\s+/g, " ")) };
}

const PROHIBIDAS = [
  [/\bdrop\s+(table|schema|column|database|sequence|extension)\b/, "borra tabla/columna/esquema"],
  [/\balter\s+table\s+\S+\s+drop\b/, "quita una columna o restricción"],
  [/\btruncate\s+(table\s+)?(?!on\b)[a-z_"]/, "vacía una tabla"], // "revoke truncate on" no cuenta
  [/\bdelete\s+from\b/, "borra filas"],
  [/\bdisable\s+row\s+level\s+security\b/, "apaga la seguridad por filas"],
  [/\b(drop|alter)\s+role\b/, "toca roles"],
  [/\bupdate\s+\S+\s+set\b(?![^;]*\bwhere\b)/, "update sin where (toca todas las filas)"],
];

const CRITICAS = [
  [/\bcreate\s+table\b/, "crea una tabla"],
  [/\b(create|drop|alter)\s+policy\b/, "toca políticas RLS"],
  [/\bsecurity\s+definer\b/, "función security definer"],
  [/\b(grant|revoke)\b/, "toca permisos"],
  [/\balter\s+default\s+privileges\b/, "toca permisos por defecto"],
  [/\balter\s+(table\s+\S+\s+)?alter\s+column\s+\S+\s+(set\s+data\s+)?type\b/, "cambia el tipo de una columna"],
  [/\bset\s+not\s+null\b/, "pone not null (puede romper filas viejas)"],
  [/\bdrop\s+(function|trigger|policy|index|view)\b/, "quita función/trigger/índice"],
  [/\bupdate\s+\S+\s+set\b/, "modifica datos existentes"],
  [/\binsert\s+into\s+(?!storage\.)/, "inserta datos"],
  [/\bcreate\s+(or\s+replace\s+)?trigger\b/, "crea un trigger"],
  [/\balter\s+table\s+\S+\s+(enable|force)\s+row\s+level\s+security\b/, "toca RLS"],
  [/\bcreate\s+(schema|extension|role)\b/, "crea esquema/extensión/rol"],
  [/\brename\b/, "renombra (la página deja de encontrar el nombre viejo)"],
];

// Lo único que puede tener una migración aditiva.
const ADITIVAS = [
  /\balter\s+table\s+(if\s+exists\s+)?\S+\s+add\s+column\s+if\s+not\s+exists\b[^;]*;/,
  /\bcreate\s+(unique\s+)?index\s+(concurrently\s+)?if\s+not\s+exists\b[^;]*;/,
  /\bcreate\s+or\s+replace\s+function\b[^;]*\$cuerpo\$[^;]*;/,
  /\bcomment\s+on\b[^;]*;/,
];

export function clasificar(sql) {
  const { s, cuerpos } = limpiar(sql);
  const motivos = [];
  const todo = [s, ...cuerpos];
  for (const [re, m] of PROHIBIDAS) if (todo.some((t) => re.test(t))) motivos.push(m);
  if (motivos.length) return { nivel: "prohibida", motivos };
  for (const [re, m] of CRITICAS) if (todo.some((t) => re.test(t))) motivos.push(m);
  if (motivos.length) return { nivel: "critica", motivos };
  // ¿Queda algo que no sea aditivo? Se quitan las sentencias aditivas y
  // si sobra cualquier cosa, es crítica por defecto.
  let resto = s.replace(/\$cuerpo\$/g, "$cuerpo$");
  for (const re of ADITIVAS) resto = resto.replace(new RegExp(re.source, "g"), " ");
  resto = resto.replace(/;/g, " ").trim();
  if (resto) return { nivel: "critica", motivos: [`sentencia no reconocida como aditiva: «${resto.slice(0, 80)}»`] };
  return { nivel: "aditiva", motivos: ["solo agrega columnas/índices/funciones/comentarios"] };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].endsWith("clasificar-migracion.mjs")) {
  const archivos = process.argv.slice(2);
  if (!archivos.length) { console.error("Uso: node scripts/clasificar-migracion.mjs <archivo.sql> ..."); process.exit(1); }
  let prohibida = false;
  for (const a of archivos) {
    const r = clasificar(readFileSync(a, "utf8"));
    if (r.nivel === "prohibida") prohibida = true;
    console.log(`${r.nivel}\t${a}\t${r.motivos.join("; ")}`);
  }
  process.exit(prohibida ? 2 : 0);
}
