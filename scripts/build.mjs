// `npm run build`. En Cloudflare se compila cada rama: main -> produccion;
// cualquier otra (previews de PR) -> staging, para que las pruebas no
// toquen datos reales.
// Cloudflare expone la rama en WORKERS_CI_BRANCH. Sin esa variable
// (local, CI de GitHub) se compila produccion.
import { execSync } from "node:child_process";

const rama = process.env.WORKERS_CI_BRANCH || "main";
const modo = rama === "main" ? "production" : "staging";
console.log(`Rama: ${rama} -> compilando en modo ${modo}`);
execSync(`npx vite build --mode ${modo}`, { stdio: "inherit" });
