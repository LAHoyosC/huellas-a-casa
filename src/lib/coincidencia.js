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
// ============================================================

import { EDAD, TAMANO, COLOR_VECINO } from "./catalogo.js";
import { conceptosDe, etiquetaDe } from "./conceptos.js";

const PESOS = {
  color: 22,
  tamano: 18,
  pelo: 11,
  sexo: 10,
  edad: 10,
  orejas: 7,
  cola: 6,
};

const ETIQUETA_CAMPO = {
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

  for (const campo of Object.keys(PESOS)) {
    const a = busqueda[campo];
    const b = ficha[campo];
    if (!a || !b) continue;
    if (campo === "sexo" && (a === "No sé" || b === "No sé")) continue;

    posible += PESOS[campo];

    if (a === b) {
      obtenido += PESOS[campo];
      coinciden.push(ETIQUETA_CAMPO[campo]);
    } else if (campo === "color" && (COLOR_VECINO[a] || []).includes(b)) {
      obtenido += PESOS[campo] * 0.55;
      coinciden.push("color parecido");
    } else if (campo === "edad" && Math.abs(EDAD.indexOf(a) - EDAD.indexOf(b)) === 1) {
      obtenido += PESOS[campo] * 0.5;
    } else if (campo === "tamano" && Math.abs(TAMANO.indexOf(a) - TAMANO.indexOf(b)) === 1) {
      obtenido += PESOS[campo] * 0.5;
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

  const base = obtenido / posible;

  // Corroboracion por conceptos. Empuja hacia 100 sin pasarse.
  const cb = conceptosDe(busqueda);
  const cf = conceptosDe(ficha);
  const compartidos = cb.filter((c) => cf.includes(c));
  const fraccion = cb.length ? compartidos.length / cb.length : 0;
  const empuje = (1 - base) * EMPUJE_MAXIMO * fraccion;

  return {
    valor: Math.round((base + empuje) * 100),
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
