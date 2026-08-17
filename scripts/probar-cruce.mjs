// `npm run probar`: casos de prueba del motor de coincidencias y de las
// sugerencias desde la nota. No necesita base de datos ni navegador.
//
// Cada caso dice que se espera. Si algo se sale del rango, el guion
// termina con error (sirve para la verificacion de cada PR). Cuando se
// cambie el motor a proposito, se ajustan aqui los rangos, con motivo.
//
// Para agregar un caso: copia uno y cambia los valores. Los rasgos usan
// el vocabulario de src/lib/catalogo.js.

import { puntaje } from "../src/lib/coincidencia.js";
import { sugerirDesdeNota } from "../src/lib/sugerencias.js";

const P = "Pereira", R = "Risaralda";
const perro = (extra) => ({ especie: "Perro", municipio: P, departamento: R, ...extra });

// ---------- Cruce ----------
// [descripcion, busqueda, ficha, minimo, maximo]  (null = debe descartarse)
const CASOS = [
  // El caso que motivo la regla 4: cocker buscada, y todo perro amarillo salia arriba.
  ["cocker mediana beige vs. igual", perro({ tamano: "Mediano", color: "Beige o crema", raza: "Cocker" }), perro({ tamano: "Mediano", color: "Beige o crema", raza: "Cocker" }), 95, 100],
  ["cocker mediana beige vs. mediano beige sin raza", perro({ tamano: "Mediano", color: "Beige o crema", raza: "Cocker" }), perro({ tamano: "Mediano", color: "Beige o crema" }), 70, 85],
  ["cocker mediana beige vs. GRANDE beige sin raza", perro({ tamano: "Mediano", color: "Beige o crema", raza: "Cocker" }), perro({ tamano: "Grande", color: "Beige o crema" }), 45, 65],
  ["cocker mediana beige vs. grande beige LABRADOR", perro({ tamano: "Mediano", color: "Beige o crema", raza: "Cocker" }), perro({ tamano: "Grande", color: "Beige o crema", raza: "Labrador o Golden" }), 20, 40],
  ["cocker mediana beige vs. mediano beige criollo (criollo no cuenta)", perro({ tamano: "Mediano", color: "Beige o crema", raza: "Cocker" }), perro({ tamano: "Mediano", color: "Beige o crema", raza: "Criollo o mestizo" }), 70, 85],
  ["cocker mediana beige vs. mediano NEGRO", perro({ tamano: "Mediano", color: "Beige o crema", raza: "Cocker" }), perro({ tamano: "Mediano", color: "Negro" }), 30, 50],

  // Regla 4: con poca informacion, el techo baja.
  ["solo tamaño+color, iguales (techo ~62)", { especie: "Perro", tamano: "Mediano", color: "Beige o crema" }, perro({ tamano: "Mediano", color: "Beige o crema", pelo: "Largo", edad: "Adulto" }), 55, 68],
  ["solo tamaño+color, tamaño vecino", { especie: "Perro", tamano: "Mediano", color: "Beige o crema" }, perro({ tamano: "Grande", color: "Beige o crema" }), 35, 50],

  // Filtros duros.
  ["pequeño vs. grande se descarta", perro({ tamano: "Pequeño", color: "Negro" }), perro({ tamano: "Grande", color: "Negro" }), null, null],
  ["gato vs. perro se descarta", { especie: "Gato", tamano: "Pequeño", color: "Negro" }, perro({ tamano: "Pequeño", color: "Negro" }), null, null],

  // Busqueda completa: campos iguales deben dar alto; uno distinto, bajar de forma visible.
  ["completa, todo igual", perro({ tamano: "Mediano", color: "Café", pelo: "Corto", sexo: "Hembra", edad: "Adulto", orejas: "Caídas", cola: "Larga" }), perro({ tamano: "Mediano", color: "Café", pelo: "Corto", sexo: "Hembra", edad: "Adulto", orejas: "Caídas", cola: "Larga" }), 100, 100],
  ["completa, sexo distinto", perro({ tamano: "Mediano", color: "Café", pelo: "Corto", sexo: "Hembra", edad: "Adulto", orejas: "Caídas", cola: "Larga" }), perro({ tamano: "Mediano", color: "Café", pelo: "Corto", sexo: "Macho", edad: "Adulto", orejas: "Caídas", cola: "Larga" }), 82, 92],
  ["completa, color vecino (café vs. beige)", perro({ tamano: "Mediano", color: "Café", pelo: "Corto", sexo: "Hembra", edad: "Adulto" }), perro({ tamano: "Mediano", color: "Beige o crema", pelo: "Corto", sexo: "Hembra", edad: "Adulto" }), 80, 92],
  ["completa, color opuesto (blanco vs. negro)", perro({ tamano: "Mediano", color: "Blanco", pelo: "Corto", sexo: "Hembra", edad: "Adulto" }), perro({ tamano: "Mediano", color: "Negro", pelo: "Corto", sexo: "Hembra", edad: "Adulto" }), 55, 75],

  // Regla 3: la nota solo suma. Sin nota, este par da 94; con nota no confirmada o negada debe dar LO MISMO.
  ["linea base sin nota", perro({ tamano: "Mediano", color: "Café", pelo: "Corto" }), perro({ tamano: "Mediano", color: "Café", pelo: "Corto" }), 94, 94],
  ["nota corrobora (cojea) sube", perro({ tamano: "Mediano", color: "Café", pelo: "Corto", nota: "renquea de una pata" }), perro({ tamano: "Mediano", color: "Café", pelo: "Corto", nota: "camina mal, cojito" }), 90, 100],
  ["nota no confirmada NO baja", perro({ tamano: "Mediano", color: "Café", pelo: "Corto", nota: "tiene collar rojo" }), perro({ tamano: "Mediano", color: "Café", pelo: "Corto" }), 94, 94],
  ["nota negada no cuenta (sin collar)", perro({ tamano: "Mediano", color: "Café", pelo: "Corto", nota: "sin collar" }), perro({ tamano: "Mediano", color: "Café", pelo: "Corto", nota: "llevaba collar" }), 94, 94],

  // Zona: empuja, no filtra.
  ["mismo animal, otro municipio del mismo departamento", perro({ tamano: "Mediano", color: "Café", pelo: "Corto", sexo: "Macho", edad: "Joven" }), { ...perro({ tamano: "Mediano", color: "Café", pelo: "Corto", sexo: "Macho", edad: "Joven" }), municipio: "Dosquebradas" }, 85, 98],
];

// ---------- Sugerencias ----------
// [nota, registro ya marcado, sugerencias esperadas "campo=valor" (todas deben salir), prohibidas]
const SUGERENCIAS = [
  ["una cocker doradita, chiquita", {}, ["raza=Cocker", "color=Beige o crema", "tamano=Pequeño"], []],
  ["perrita french blanca, peludita", {}, ["raza=Poodle o French", "color=Blanco", "pelo=Largo", "sexo=Hembra"], []],
  ["criollo grande negro con manchas blancas en el pecho", {}, ["raza=Criollo o mestizo", "tamano=Grande"], ["tamano=Pequeño"]],
  ["si ya marque el color, no me lo sugiere", { color: "Negro" }, [], ["color=Café"]],
  ["sin collar y no cojea", {}, [], ["senas=Llevaba collar", "senas=Cojea"]],
  ["cojea de una pata y tiene collar rojo", {}, ["senas=Cojea", "senas=Llevaba collar"], []],
  ["gato atigrado con ojos azules", { especie: "Gato" }, ["color=Atigrado", "senas=Ojos claros"], []],
  ["es un pastor aleman viejito", {}, ["raza=Pastor alemán", "edad=Mayor"], []],
];

let fallos = 0;
const marca = (ok) => (ok ? "  ok " : " FALLA");

console.log("\n=== CRUCE ===");
for (const [nombre, b, f, min, max] of CASOS) {
  const r = puntaje(b, f);
  const valor = r ? r.valor : null;
  const ok = min === null ? valor === null : valor !== null && valor >= min && valor <= max;
  if (!ok) fallos++;
  const esperado = min === null ? "descartado" : `${min}-${max}`;
  const dif = r?.difieren?.length ? `  no coincide: ${r.difieren.join(", ")}` : "";
  console.log(`${marca(ok)} ${String(valor === null ? "—" : valor + "%").padStart(5)}  (esperado ${esperado})  ${nombre}${dif}`);
}

console.log("\n=== SUGERENCIAS DESDE LA NOTA ===");
for (const [nota, registro, deben, noDeben] of SUGERENCIAS) {
  const s = sugerirDesdeNota(nota, registro).map((x) => `${x.campo}=${x.valor}`);
  const faltan = deben.filter((d) => !s.includes(d));
  const sobran = noDeben.filter((d) => s.includes(d));
  const ok = !faltan.length && !sobran.length;
  if (!ok) fallos++;
  console.log(`${marca(ok)} "${nota}" -> ${s.join(", ") || "(nada)"}${faltan.length ? `  FALTAN: ${faltan.join(", ")}` : ""}${sobran.length ? `  SOBRAN: ${sobran.join(", ")}` : ""}`);
}

console.log(fallos ? `\n${fallos} caso(s) fuera de lo esperado.\n` : "\nTodo dentro de lo esperado.\n");
process.exit(fallos ? 1 : 0);
