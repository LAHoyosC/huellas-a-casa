// ============================================================
// Cruce de notas libres por significado, no por palabras exactas.
//
// ESTE ARCHIVO LO PUEDE EDITAR CUALQUIERA. No hay que saber programar:
// solo agregar palabras entre comillas, separadas por comas, dentro de
// los corchetes que ya existen.
//
// Se busca por RAIZ, no por palabra completa. Poner "coje" atrapa
// "cojea", "cojeando" y "cojito" de una sola vez. Por eso las raices
// van cortas y sin tildes.
//
// Cuando los voluntarios vean notas reales van a encontrar formas de
// decir las cosas que no estan aqui. Que las anoten y se agregan.
// ============================================================

export const CONCEPTOS = {
  cojera: {
    etiqueta: "cojea",
    raices: ["coje", "cojo", "coja", "cojit", "renque", "renqu", "camina mal",
             "no apoya", "pata mala", "arrastra la pata", "pata lastim"],
  },
  miedo: {
    etiqueta: "muy asustado",
    raices: ["asustad", "miedos", "con miedo", "nervios", "timid", "se escond",
             "escondid", "temblan", "tembloros", "arisc", "desconfia", "huran"],
  },
  herida: {
    etiqueta: "herido",
    raices: ["herid", "lastimad", "sangre", "sangrand", "golpead", "raspad",
             "lesion", "moret", "cortad", "atropell"],
  },
  flaco: {
    etiqueta: "muy flaco",
    raices: ["flac", "delgad", "desnutrid", "huesud", "esquelet", "costillas"],
  },
  collar: {
    etiqueta: "llevaba collar",
    raices: ["collar", "correa", "cintill", "arnes"],
  },
  panoleta: {
    etiqueta: "lleva pañoleta",
    raices: ["panolet", "panuel", "bandan", "trapit", "banda"],
  },
  placa: {
    etiqueta: "identificación",
    raices: ["placa", "chapa", "medall", "carnet", "chip", "microchip", "tatuaj"],
  },
  docil: {
    etiqueta: "dócil",
    raices: ["carinos", "docil", "mansit", "manso", "noble", "juguet",
             "sociable", "tranquil", "amoros", "se deja"],
  },
  viejo: {
    etiqueta: "se ve viejito",
    raices: ["viejit", "viejo", "anciano", "canos", "hocico blanco", "cara blanca"],
  },
  prenada: {
    etiqueta: "preñada o lactando",
    raices: ["pren", "lactan", "con leche", "amamant", "tetas hinchad",
             "tuvo cachorr", "pario"],
  },
  esterilizado: {
    etiqueta: "esterilizado",
    raices: ["esteriliz", "castrad", "operad", "capad", "cicatriz de operacion",
             "cicatriz en la barriga"],
  },
  piel: {
    etiqueta: "problema de piel",
    raices: ["sarna", "peladit", "pelad", "sin pelo", "rona", "hongo",
             "alergia", "rascand", "costra"],
  },
  ojos: {
    etiqueta: "ojos llamativos",
    raices: ["ojos azul", "ojos claros", "ojos verdes", "ojo azul",
             "un ojo de cada", "heterocrom", "ojos distintos", "ojos diferentes"],
  },
  mancha_pecho: {
    etiqueta: "mancha en el pecho",
    raices: ["mancha en el pecho", "manchita en el pecho", "pecho blanco",
             "pechito blanco", "mancha blanca en el pecho"],
  },
  mancha_cara: {
    etiqueta: "mancha en la cara",
    raices: ["mancha en la cara", "mancha en la frente", "mancha en el ojo",
             "antifaz", "manchita en la cara", "cara manchada"],
  },
  patas_blancas: {
    etiqueta: "patas blancas",
    raices: ["patas blancas", "paticas blancas", "medias blancas", "calcetin", "botitas"],
  },
  oreja_marca: {
    etiqueta: "marca en la oreja",
    raices: ["oreja cortad", "falta un pedazo de oreja", "oreja mordid",
             "muesca en la oreja", "oreja rota", "sin punta de oreja"],
  },
  vocal: {
    etiqueta: "muy vocal",
    raices: ["ladra much", "muy ladrador", "llor", "auli", "maulla much",
             "hace mucho ruido"],
  },
  ciego_sordo: {
    etiqueta: "ciego o sordo",
    raices: ["cieg", "sord", "no ve", "no oye", "no escucha", "un ojo malo",
             "ojo nublad", "catarat"],
  },
};

// Las casillas marcadas y la nota escrita hablan el mismo idioma:
// un voluntario apurado marca chips, un tutor angustiado escribe.
export const SENA_A_CONCEPTO = {
  "Llevaba collar": "collar",
  "Lleva pañoleta": "panoleta",
  "Tiene placa": "placa",
  "Tiene chip": "placa",
  "Cojea": "cojera",
  "Está herido": "herida",
  "Ojos claros": "ojos",
  "Esterilizado": "esterilizado",
  "Está preñada o lactando": "prenada",
  "Muy asustado": "miedo",
};

// Quita tildes, mayusculas y puntuacion para poder comparar.
export function normalizar(txt) {
  return (
    " " +
    (txt || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9ñ ]/g, " ")
      .replace(/\s+/g, " ")
      .trim() +
    " "
  );
}

// Saca los conceptos de una nota. Ignora los negados: "sin collar" y
// "no cojea" no cuentan como presencia.
export function extraerConceptos(nota) {
  const t = normalizar(nota);
  return Object.keys(CONCEPTOS).filter((clave) => contiene(t, CONCEPTOS[clave].raices));
}

// ¿El texto ya normalizado contiene alguna de estas raices, sin estar
// negada? Lo usan tambien las sugerencias (sugerencias.js).
export function contiene(textoNormalizado, raices) {
  for (const raiz of raices) {
    let i = textoNormalizado.indexOf(raiz);
    while (i !== -1) {
      const antes = textoNormalizado.slice(Math.max(0, i - 16), i);
      const negado = /\b(no|sin|nunca|tampoco|ni)\s+(\S+\s+)?$/.test(antes);
      if (!negado) return true;
      i = textoNormalizado.indexOf(raiz, i + 1);
    }
  }
  return false;
}

// Conceptos de un registro completo: los de la nota mas los de las casillas.
export function conceptosDe(registro) {
  const deNota = extraerConceptos(registro.nota);
  const deSenas = (registro.senas || []).map((s) => SENA_A_CONCEPTO[s]).filter(Boolean);
  return [...new Set([...deNota, ...deSenas])];
}

export function etiquetaDe(clave) {
  return CONCEPTOS[clave]?.etiqueta || clave;
}
