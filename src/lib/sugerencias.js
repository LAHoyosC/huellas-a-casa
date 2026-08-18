// ============================================================
// Sugerencias desde la nota libre.
//
// El motor solo cruza CASILLAS. Pero mucha gente escribe "una cocker
// doradita, chiquita" y deja casillas vacias. Aqui se leen esas
// palabras y se le PROPONE marcar la casilla; la persona confirma con
// un toque. Nunca se marca sola: la evidencia la pone el humano.
//
// ESTE ARCHIVO LO PUEDE EDITAR CUALQUIERA, igual que conceptos.js:
// solo agregar raices (sin tildes, cortas) dentro de los corchetes.
// La clave de cada bloque debe ser exactamente un valor del catalogo.
// ============================================================

import { normalizar, contiene, CONCEPTOS, SENA_A_CONCEPTO } from "./conceptos.js";
import { RAZA_INDEFINIDA } from "./catalogo.js";

const PISTAS = {
  color: {
    "Blanco": ["blanc", "blanquit"],
    "Negro": ["negr", "negrit", "azabach"],
    "Café": ["cafe", "cafecit", "marron", "chocolat", "castan", "cobriz"],
    "Beige o crema": ["beige", "crema", "amarill", "dorad", "doradit", "miel", "canel", "rubi", "arena", "champan", "trigueñ", "trigen", "habano"],
    "Gris": ["gris", "grisac", "plomo", "plateado", "ceniz"],
    "Naranja": ["naranj", "anaranjad", "zanahori", "colorad", "rojiz", "pelirroj"],
    "Atigrado": ["atigrad", "tigrit", "rayad", "barcin", "brindle"],
    "Tricolor": ["tricolor", "tres colores", "calico", "carey"],
    "Blanco con manchas": ["manchad", "pintad", "moteado", "con manchas", "manchas negras", "manchas cafe", "dalmata", "pinto"],
  },
  tamano: {
    "Pequeño": ["pequen", "chiquit", "chico", "chica", "mini", "toy", "de bolsillo", "enano", "peque "],
    "Mediano": ["median", "ni grande ni"],
    "Grande": ["grand", "grandot", "gigant", "enorme", "corpulent"],
  },
  raza: {
    "Cocker": ["cocker", "coker", "spaniel"],
    "Poodle o French": ["poodle", "pudel", "french", "frenchi", "caniche"],
    "Pinscher": ["pinscher", "pincher", "pinche", "doberman miniatura"],
    "Chihuahua": ["chihuahua", "chiguagua", "chiwawa"],
    "Schnauzer": ["schnauzer", "snauzer", "eschnauzer", "shnauzer"],
    "Shih tzu o Maltés": ["shih tzu", "shitzu", "shih-tzu", "maltes", "lhasa", "bichon"],
    "Beagle": ["beagle", "bigle"],
    "Labrador o Golden": ["labrador", "golden", "retriever"],
    "Pastor alemán": ["pastor aleman", "pastor", "ovejero", "german shepherd"],
    "Pitbull o Bully": ["pitbull", "pit bull", "pitbul", "bully", "stafford", "amstaff"],
    "Husky": ["husky", "haski", "siberian", "malamute"],
    "Bulldog": ["bulldog", "buldog", "bull dog"],
    "Criollo o mestizo": ["criollo", "criolla", "criollit", "mestiz", "cruzad", "sin raza"],
  },
  pelo: {
    "Corto": ["pelo corto", "pelicort", "pelo cortic", "pelo raso"],
    "Largo": ["pelo largo", "pelilarg", "peludo", "peluda", "peludit", "lanudo", "lanuda", "motoso", "motosa"],
  },
  sexo: {
    "Macho": ["macho", "machito", "perrito", "gatico", "gatito", "el perro", "el gato", "un perro", "un gato"],
    "Hembra": ["hembra", "hembrit", "perrita", "perra ", "gatica", "gatita", "la perra", "la gata", "una perra", "una gata"],
  },
  edad: {
    "Cachorro": ["cachorr", "bebe", "bebit", "chiquitic", "de meses", "recien nacid"],
    "Joven": ["joven", "jovencit", "adolescent"],
    "Mayor": ["viejit", "viejo", "vieja", "anciano", "anciana", "mayor", "canos", "hocico blanco"],
  },
  orejas: {
    "Paradas": ["orejas paradas", "orejas puntiag", "orejitas paradas", "orejas erguid"],
    "Caídas": ["orejas caidas", "orejas largas", "orejotas", "orejas colgant", "orejitas caidas", "orejas gachas"],
  },
  cola: {
    "Corta o mocha": ["cola corta", "sin cola", "mocho", "mocha", "colita corta", "rabo corto", "sin rabo"],
    "Enroscada": ["cola enroscada", "cola enrollada", "colita enroscada", "cola en rosca", "cola de cerdo"],
  },
};

const ETIQUETA = { color: "color", tamano: "tamaño", raza: "raza", pelo: "pelo", sexo: "sexo", edad: "edad", orejas: "orejas", cola: "cola" };

// Devuelve [{ campo, valor, texto }] con lo que la nota sugiere y la
// persona todavia no marco. Si un campo ya tiene valor, no se sugiere
// otro: la casilla manda sobre la nota.
export function sugerirDesdeNota(nota, registro = {}) {
  const t = normalizar(nota);
  if (t.trim().length < 3) return [];
  const sugerencias = [];

  for (const [campo, valores] of Object.entries(PISTAS)) {
    if (registro[campo]) continue;
    if (campo === "raza" && registro.especie && registro.especie !== "Perro") continue;
    const hallados = Object.keys(valores).filter((valor) => contiene(t, valores[valor]));
    // Si la nota menciona dos colores ("blanco con cafe"), no se adivina cual
    // domina: se proponen ambos y la persona elige. Para lo demas, solo si
    // hay uno claro.
    const permitidos = campo === "color" ? hallados.slice(0, 2) : hallados.length === 1 ? hallados : [];
    for (const valor of permitidos) {
      const texto = campo === "raza" && RAZA_INDEFINIDA.includes(valor) ? valor : `${ETIQUETA[campo]}: ${valor}`;
      sugerencias.push({ campo, valor, texto });
    }
  }

  // Senas: los conceptos que ya detecta conceptos.js, llevados a la casilla.
  const marcadas = registro.senas || [];
  for (const [sena, concepto] of Object.entries(SENA_A_CONCEPTO)) {
    if (marcadas.includes(sena)) continue;
    if (sugerencias.some((s) => s.campo === "senas" && s.valor === sena)) continue;
    if (contiene(t, CONCEPTOS[concepto].raices)) sugerencias.push({ campo: "senas", valor: sena, texto: sena });
  }
  return sugerencias;
}
