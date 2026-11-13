// Abre la página en un navegador de verdad (Chromium, sin ventana) y recorre
// las pantallas principales como lo haría una persona. Si la página revienta
// al cargar (un error de JavaScript la deja en blanco), aquí se ve.
//
// Lo que un build "en verde" NO atrapa: errores que solo pasan al ejecutar
// (una variable usada antes de existir, un dato que llega distinto, una
// función que no está). El 18-ago-2026 producción se cayó por uno así.
//
// Uso:  node scripts/ci/probar-pagina.mjs [url]     (por defecto http://localhost:4173)
//   - En el CI de cada PR: contra la compilación del PR (modo staging).
//   - Después de cada deploy y en el vigía: contra producción.
// Sale con 1 y un mensaje claro si algo falla. Guarda pantallazo en
// pagina-fallo.png cuando puede.

import { chromium } from "playwright";

const URL = process.argv[2] || "http://localhost:4173";
const ESPERA = 20000;

const erroresPagina = [];   // excepciones sin atrapar: la página se rompió
const erroresConsola = [];  // console.error: se reportan, no tumban (salvo que digan Uncaught)

function fallo(msg) {
  console.error(`\n✗ ${msg}`);
  if (erroresPagina.length) { console.error("Errores de JavaScript en la página:"); erroresPagina.forEach((e) => console.error("  - " + e)); }
  if (erroresConsola.length) { console.error("console.error:"); erroresConsola.slice(0, 10).forEach((e) => console.error("  - " + e)); }
  process.exitCode = 1;
}

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 420, height: 860 } }); // móvil: así la usa la gente
pagina.on("pageerror", (e) => erroresPagina.push(String(e?.message || e)));
pagina.on("console", (m) => { if (m.type() === "error") erroresConsola.push(m.text()); });

async function paso(nombre, fn) {
  try {
    await fn();
    if (erroresPagina.length) throw new Error("hubo errores de JavaScript en la página");
    console.log(`✓ ${nombre}`);
  } catch (e) {
    try { await pagina.screenshot({ path: "pagina-fallo.png", fullPage: true }); } catch { /* sin pantallazo */ }
    fallo(`${nombre}: ${e.message}`);
    await navegador.close();
    process.exit(1);
  }
}

await paso(`abre ${URL}`, async () => {
  const r = await pagina.goto(URL, { waitUntil: "domcontentloaded", timeout: ESPERA });
  if (!r || r.status() >= 400) throw new Error(`HTTP ${r?.status()}`);
});

// Desde el cierre (12-nov-2026) la página es una sola pantalla. Los pasos
// de antes (portada, listado, formularios, voluntarios) ya no existen; lo
// que se comprueba es que el aviso se pinta y que la aplicación no volvió.
await paso("pinta la pantalla de cierre", async () => {
  await pagina.getByRole("heading", { name: /Huellas a Casa terminó/ }).waitFor({ timeout: ESPERA });
  await pagina.getByText(/Borraremos toda la información/).first().waitFor({ timeout: ESPERA });
});

await paso("ya no ofrece registrar ni buscar", async () => {
  const botones = await pagina.getByRole("button").count();
  if (botones > 0) throw new Error(`la pantalla de cierre tiene ${botones} botón(es): ¿volvió la aplicación?`);
});

await navegador.close();
if (erroresConsola.length) {
  console.log(`(${erroresConsola.length} console.error no fatales; el primero: ${erroresConsola[0].slice(0, 160)})`);
}
console.log("\nPágina OK: muestra la pantalla de cierre.");
