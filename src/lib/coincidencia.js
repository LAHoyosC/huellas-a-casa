// ============================================================
// Motor de coincidencias.
//
// Tres reglas que gobiernan todo:
//
// 1. Solo se comparan los campos que AMBAS partes respondieron.
//    Un tutor conmocionado que no recuerda la cola no pierde
//    candidatos: ese campo simplemente no entra en la cuenta.
//
// 2. Los valores vecinos suman parcial. Beige y blanco no son
//    iguales, pero tampoco son lo mismo que blanco y negro.
//
// 3. La nota SOLO SUMA, nunca resta. Si el tutor menciona algo y la
//    ficha no lo confirma, no es evidencia en contra: el voluntario
//    pudo no haberse fijado.
//
// Y una cuarta, agregada despues de ver el motor en uso real:
//
// 4. El porcentaje refleja cuanta informacion se pudo comparar. Con solo
//    tamano y color, dos perros "mediano beige" no pueden pasar de un
//    parecido moderado: no hay evidencia para mas. Antes, con dos campos
//    iguales salia 100% y todo perro amarillo aparecia arriba.
// ============================================================

import { EDAD, TAMANO, COLOR_VECINO, RAZA_INDEFINIDA } from "./catalogo.js";
import { conceptosDe, etiquetaDe } from "./conceptos.js";

const PESOS = {
  raza: 24,
  color: 22,
  tamano: 18,
  pelo: 11,
  sexo: 10,
  edad: 10,
  orejas: 7,
  cola: 6,
};

const ETIQUETA_CAMPO = {
  raza: "raza",
  color: "color",
  tamano: "tamaño",
  pelo: "pelo",
  sexo: "sexo",
  edad: "edad",
  orejas: "orejas",
  cola: "cola",
};

// Cuanto puede empujar la corroboracion de la nota, como maximo.
const EMPUJE_MAXIMO = 0.4;

// Con cuanto peso comparado el porcentaje llega a valer completo. Por
// debajo se escala hacia abajo: tamano + color (40) tocan techo en 62%;
// con pelo y edad ademas (61) ya se puede llegar a 95-100%.
const PESO_PLENO = 65;

// Por debajo de esto no vale la pena mostrar el candidato.
export const UMBRAL_MINIMO = 30;

export function puntaje(busqueda, ficha) {
  // La especie es filtro duro: un gato nunca es un perro.
  if (busqueda.especie && ficha.especie && busqueda.especie !== ficha.especie) {
    return null;
  }

  let obtenido = 0;
  let posible = 0;
  const coinciden = [];
  const difieren = [];

  // Pequeno contra grande no es confusion: es otro animal. Se descarta.
  if (busqueda.tamano && ficha.tamano &&
      Math.abs(TAMANO.indexOf(busqueda.tamano) - TAMANO.indexOf(ficha.tamano)) >= 2) {
    return null;
  }

  for (const campo of Object.keys(PESOS)) {
    const a = busqueda[campo];
    const b = ficha[campo];
    if (!a || !b) continue;
    if (campo === "sexo" && (a === "No sé" || b === "No sé")) continue;
    // "Criollo" u "otra raza" no dicen cual: no entran en la cuenta.
    if (campo === "raza" && (RAZA_INDEFINIDA.includes(a) || RAZA_INDEFINIDA.includes(b))) continue;

    posible += PESOS[campo];

    if (a === b) {
      obtenido += PESOS[campo];
      coinciden.push(ETIQUETA_CAMPO[campo]);
    } else if (campo === "color" && (COLOR_VECINO[a] || []).includes(b)) {
      obtenido += PESOS[campo] * 0.55;
      coinciden.push("color parecido");
    } else if (campo === "edad" && Math.abs(EDAD.indexOf(a) - EDAD.indexOf(b)) === 1) {
      obtenido += PESOS[campo] * 0.5;
    } else if (campo === "tamano") {
      // Vecino (mediano/grande): la gente lo confunde, pero menos de lo
      // que suponiamos. Antes sumaba la mitad y un grande beige quedaba
      // casi igual que un mediano beige.
      obtenido += PESOS[campo] * 0.3;
      difieren.push("tamaño (parecido)");
    } else if (campo === "raza") {
      // Dos razas concretas distintas: es la senal mas fuerte de que no es
      // el mismo animal. Resta, ademas de no sumar.
      obtenido -= PESOS[campo] * 0.5;
      difieren.push(ETIQUETA_CAMPO[campo]);
    } else {
      difieren.push(ETIQUETA_CAMPO[campo]);
    }
  }

  // El collar es de lo que mas discrimina y la gente lo recuerda bien.
  if (busqueda.collar_color && ficha.collar_color) {
    posible += 12;
    if (busqueda.collar_color === ficha.collar_color) {
      obtenido += 12;
      coinciden.push("color del collar");
    } else {
      difieren.push("color del collar");
    }
  }

  // La zona empuja, no filtra: los animales se desplazan.
  if (busqueda.municipio && ficha.municipio) {
    posible += 10;
    if (busqueda.municipio === ficha.municipio) {
      obtenido += 10;
      coinciden.push("zona");
    } else if (busqueda.departamento === ficha.departamento) {
      obtenido += 5;
    }
  }

  // Muy poca informacion comparable: mejor no opinar.
  if (posible < 30) return null;

  const base = Math.max(0, obtenido) / posible;

  // Corroboracion por conceptos. Empuja hacia 100 sin pasarse.
  const cb = conceptosDe(busqueda);
  const cf = conceptosDe(ficha);
  const compartidos = cb.filter((c) => cf.includes(c));
  const fraccion = cb.length ? compartidos.length / cb.length : 0;
  const empuje = (1 - base) * EMPUJE_MAXIMO * fraccion;

  // Regla 4: la nota tambien cuenta como informacion comparada.
  const pesoComparado = posible + Math.min(compartidos.length, 3) * 8;
  const confianza = Math.min(1, pesoComparado / PESO_PLENO);

  return {
    valor: Math.round((base + empuje) * 100 * confianza),
    // Cuanta informacion se comparo, de 0 a 1. Por debajo de 1 la
    // interfaz avisa que respondiendo mas preguntas el cruce afina.
    confianza,
    coinciden,
    difieren,
    corroborados: compartidos.map(etiquetaDe),
    sinConfirmar: cb.filter((c) => !cf.includes(c)).map(etiquetaDe),
  };
}

// Ordena una lista de fichas frente a una busqueda.
export function buscarCoincidencias(busqueda, fichas) {
  return fichas
    .map((f) => ({ ficha: f, resultado: puntaje(busqueda, f) }))
    .filter((x) => x.resultado && x.resultado.valor >= UMBRAL_MINIMO)
    .sort((a, b) => b.resultado.valor - a.resultado.valor);
}

// Cruce inverso: llega una mascota nueva, que busquedas abiertas
// se le parecen. Para que los voluntarios avisen sin esperar a que
// el tutor vuelva a entrar.
export function busquedasParecidas(ficha, busquedas) {
  return busquedas
    .map((b) => ({ busqueda: b, resultado: puntaje(b, ficha) }))
    .filter((x) => x.resultado && x.resultado.valor >= 55)
    .sort((a, b) => b.resultado.valor - a.resultado.valor);
}

// ------------------------------------------------------------
// Duplicados y gemelas.
//
// Dos riesgos distintos, dos funciones distintas:
//
// - DUPLICADO: el mismo animal registrado dos veces (dos cuentas de
//   Instagram, dos voluntarios). Se revisa ANTES de guardar una ficha.
//   Pide mismo municipio y fechas cercanas: un animal no aparece en
//   dos ciudades ni con un mes de diferencia.
//
// - GEMELA: dos animales distintos que se parecen mucho y estan ambos
//   en resguardo. El riesgo es entregar el equivocado. Se revisa al
//   marcar un reencuentro y al mostrar resultados de busqueda.
// ------------------------------------------------------------

export const UMBRAL_DUPLICADO = 65;
export const UMBRAL_GEMELA = 70;
const DIAS_DUPLICADO = 21;

function diasEntre(a, b) {
  if (!a || !b) return 0;
  const ms = Math.abs(new Date(a) - new Date(b));
  return Number.isNaN(ms) ? 0 : ms / 86400000;
}

export function posiblesDuplicados(nueva, fichas) {
  return fichas
    .filter((f) => f.estado === "resguardo" && f.id !== nueva.id)
    .filter((f) => !nueva.municipio || !f.municipio || nueva.municipio === f.municipio)
    .filter((f) => diasEntre(nueva.fecha_hallazgo, f.fecha_hallazgo) <= DIAS_DUPLICADO)
    .map((f) => ({ ficha: f, resultado: puntaje(nueva, f) }))
    .filter((x) => x.resultado && x.resultado.valor >= UMBRAL_DUPLICADO)
    // Si el color o el collar son francamente distintos, no es el mismo
    // animal. Sin esta guarda, cualquier "perro mediano cafe" dispararia
    // la alerta y la gente dejaria de leerla.
    .filter((x) => !x.resultado.difieren.includes("color") && !x.resultado.difieren.includes("color del collar"))
    .sort((a, b) => b.resultado.valor - a.resultado.valor);
}

export function fichasGemelas(ficha, fichas) {
  return fichas
    .filter((f) => f.estado === "resguardo" && f.id !== ficha.id)
    .map((f) => ({ ficha: f, resultado: puntaje(ficha, f) }))
    .filter((x) => x.resultado && x.resultado.valor >= UMBRAL_GEMELA)
    .sort((a, b) => b.resultado.valor - a.resultado.valor);
}

// En una lista de resultados ordenada, cuantos candidatos estan
// "empatados" con el primero. Si son mas de uno, el tutor debe
// mirar las fotos con calma antes de decidir.
export function empatadosArriba(resultados, margen = 8) {
  if (!resultados.length) return [];
  const tope = resultados[0].resultado.valor;
  return resultados.filter((x) => tope - x.resultado.valor <= margen && x.resultado.valor >= 55);
}
