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

await paso("pinta la portada (contadores y botones)", async () => {
  await pagina.getByText("EN RESGUARDO").first().waitFor({ timeout: ESPERA });
  await pagina.getByRole("button", { name: /Busco a mi mascota/ }).waitFor({ timeout: ESPERA });
  await pagina.getByRole("button", { name: /Encontré una mascota/ }).waitFor({ timeout: ESPERA });
});

await paso("carga el listado desde la base (no se queda en «Cargando…»)", async () => {
  await pagina.getByRole("button", { name: /Ver todos los registros/ }).click();
  await pagina.getByText("Cargando fichas…").waitFor({ state: "detached", timeout: ESPERA }).catch(() => {});
  await pagina.getByText("FILTRAR").waitFor({ timeout: ESPERA });
  const cuerpo = await pagina.textContent("body");
  if (/No se pudo cargar el listado|no tiene configurada la conexión/.test(cuerpo)) throw new Error("la página dice que no pudo cargar el listado (¿base de datos?)");
});

await paso("abre «Busco a mi mascota» (formulario del tutor)", async () => {
  await pagina.getByRole("button", { name: /Busco a mi mascota/ }).click();
  await pagina.getByText("¿Qué animal es?").first().waitFor({ timeout: ESPERA });
  await pagina.getByText("Señas particulares").first().waitFor({ timeout: ESPERA });
});

await paso("abre «Encontré una mascota» (formulario del voluntario)", async () => {
  await pagina.getByRole("button", { name: /Encontré una mascota/ }).click();
  await pagina.getByText("¿Dónde está ahora?").first().waitFor({ timeout: ESPERA });
  await pagina.getByText("Contacto para el tutor").first().waitFor({ timeout: ESPERA });
});

await paso("abre «¿Cómo va mi búsqueda?»", async () => {
  await pagina.getByRole("button", { name: /Busco a mi mascota/ }).click();
  await pagina.getByRole("button", { name: /Consultar mi búsqueda/ }).click();
  await pagina.getByText("¿Cómo va mi búsqueda?").first().waitFor({ timeout: ESPERA });
});

await paso("abre la pantalla de voluntarios (inicio de sesión)", async () => {
  await pagina.getByRole("button", { name: /Voluntarios/ }).first().click();
  await pagina.getByText(/contraseña/i).first().waitFor({ timeout: ESPERA });
});

await navegador.close();
if (erroresConsola.length) {
  console.log(`(${erroresConsola.length} console.error no fatales; el primero: ${erroresConsola[0].slice(0, 160)})`);
}
console.log("\nPágina OK: carga, lista, formularios y estado del caso funcionan.");
