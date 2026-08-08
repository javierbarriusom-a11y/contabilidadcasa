"use strict";

// Generador pseudoaleatorio determinista (mulberry32, dominio público) para las pruebas de
// invariantes por generación aleatoria del dataset dorado (E19-0, día 4). Con la misma semilla
// siempre produce la misma secuencia: los fallos son reproducibles, no intermitentes.

function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rangeFactory(rng) {
  return function range(min, max) {
    return min + rng() * (max - min);
  };
}

function intRangeFactory(rng) {
  const range = rangeFactory(rng);
  return function intRange(min, max) {
    return Math.floor(range(min, max + 1));
  };
}

function pickFactory(rng) {
  return function pick(options) {
    return options[Math.floor(rng() * options.length)];
  };
}

module.exports = { mulberry32, rangeFactory, intRangeFactory, pickFactory };
