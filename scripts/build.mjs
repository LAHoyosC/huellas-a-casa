// `npm run build`. En Cloudflare se compila cada rama: main -> produccion;
// cualquier otra (previews de PR) -> staging, para que las pruebas no
// toquen datos reales.
// Cloudflare expone la rama en WORKERS_CI_BRANCH. Sin esa variable
// (local, CI de GitHub) se compila produccion.
//
// Ademas escribe worker/entorno.js con la URL y la llave publica de
// Supabase del entorno elegido, para que el Worker pueda leer una ficha
// y armar la vista previa (foto + datos) cuando se comparte /m/<codigo>.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const rama = process.env.WORKERS_CI_BRANCH || "main";
const modo = rama === "main" ? "production" : "staging";
console.log(`Rama: ${rama} -> compilando en modo ${modo}`);

const env = Object.fromEntries(
  readFileSync(`.env.${modo}`, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
writeFileSync(
  "worker/entorno.js",
  `// GENERADO por scripts/build.mjs en cada compilacion: no lo edites a mano.
// Dice al Worker contra que base de Supabase leer las fichas para las
// vistas previas de /m/<codigo>. Los valores son publicos (los mismos de
// .env.production / .env.staging). Por defecto apunta a produccion.
export const SUPABASE_URL = ${JSON.stringify(env.VITE_SUPABASE_URL)};
export const SUPABASE_ANON_KEY = ${JSON.stringify(env.VITE_SUPABASE_ANON_KEY)};
export const ENTORNO = ${JSON.stringify(modo === "production" ? "prod" : "staging")};
`
);

execSync(`npx vite build --mode ${modo}`, { stdio: "inherit" });
