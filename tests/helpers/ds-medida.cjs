// DS-1 (plan de diseño, docs/PROPUESTA_CON05_CON08_Y_PLAN_DISENO_2026-11-27.md §2.2): mide, fichero a fichero, cuánto se aparta el
// código de la escala del sistema de diseño (PDF «Finanzas Casa · Rediseño», p. 1, y D-N56). Lo usan la guardia
// (tests/ds1-guardia-diseno.test.cjs) y la herramienta que guarda la base (tools/ds-medida.mjs).
//
// Qué cuenta como desviación (una declaración cuenta una vez, aunque tenga varios valores fuera):
// - tipografia: `font-size` con un valor en px o rem fuera de {48, 32, 19, 15, 13,5, 12,5, 11}. Con `var(--fs-*)`, en em, en % o
//   con palabras clave no cuenta. 13,5 es el «cuerpo compacto» de D-N56 (b), solo para tablas y listas.
// - espaciado: `padding*`, `margin*`, `gap`, `row-gap` y `column-gap` con un valor en px o rem fuera de {0, 4, 8, 12, 16, 20, 24, 32}.
//   Se admite 1 px (y −1 px): es el filete de los bordes y del texto solo para lectores de pantalla, no espaciado.
// - radios: `border-radius*` con un valor en px o rem fuera de {0, 12, 16, 24} y de las píldoras (999 px o más).
// - redondeo: `.toFixed(` en el código de la app (decisión 7: las cifras, siempre por el formateador). No distingue el uso legítimo
//   (claves, ficheros), por eso es trinquete y no prohibición.
// Los custom properties (`--fs-cuerpo: 15px`) no son declaraciones de esas propiedades y no cuentan.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ESCALA = Object.freeze({
  tipografia: Object.freeze([48, 32, 19, 15, 13.5, 12.5, 11]),
  espaciado: Object.freeze([0, 1, 4, 8, 12, 16, 20, 24, 32]),
  radios: Object.freeze([0, 12, 16, 24]),
});

const PROPIEDAD = /(?:^|[;{\s])(font-size|border(?:-(?:top|bottom)-(?:left|right))?-radius|padding(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|margin(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|gap|row-gap|column-gap)\s*:\s*([^;{}]+)/g;
const MEDIDA = /(-?\d*\.?\d+)(px|rem)\b/g;

function familia(propiedad) {
  if (propiedad === "font-size") return "tipografia";
  if (propiedad.endsWith("radius")) return "radios";
  return "espaciado";
}

function fueraDeEscala(fam, valor) {
  MEDIDA.lastIndex = 0;
  let m;
  while ((m = MEDIDA.exec(valor))) {
    const px = Math.abs(Number(m[1]) * (m[2] === "rem" ? 16 : 1));
    if (fam === "radios" && px >= 999) continue;
    if (!ESCALA[fam].some((v) => Math.abs(v - px) < 0.01)) return true;
  }
  return false;
}

function medirCss(texto) {
  const limpio = String(texto).replace(/\/\*[\s\S]*?\*\//g, " ");
  const cuenta = { tipografia: 0, espaciado: 0, radios: 0 };
  PROPIEDAD.lastIndex = 0;
  let m;
  while ((m = PROPIEDAD.exec(limpio))) {
    const fam = familia(m[1]);
    if (fueraDeEscala(fam, m[2])) cuenta[fam] += 1;
  }
  return cuenta;
}

function medirJs(texto) {
  return { redondeo: (String(texto).match(/\.toFixed\(/g) || []).length };
}

function ficherosDeLaApp(raiz) {
  const todos = execFileSync("git", ["ls-files", "*.css", "*.js"], { cwd: raiz, encoding: "utf8" }).split("\n").filter(Boolean);
  // Fuera: pruebas, herramientas, dependencias de terceros y el Service Worker generado.
  return todos.filter((f) => !/^(tests|tools|scripts|vendor|node_modules|docs)\//.test(f) && !/\.min\.js$/.test(f)).sort();
}

function medirRepositorio(raiz) {
  const resultado = {};
  for (const f of ficherosDeLaApp(raiz)) {
    const texto = fs.readFileSync(path.join(raiz, f), "utf8");
    const cuenta = f.endsWith(".css") ? medirCss(texto) : medirJs(texto);
    if (Object.values(cuenta).some((n) => n > 0)) resultado[f] = cuenta;
  }
  return resultado;
}

function totales(porFichero) {
  const t = { tipografia: 0, espaciado: 0, radios: 0, redondeo: 0 };
  for (const cuenta of Object.values(porFichero)) for (const [k, n] of Object.entries(cuenta)) t[k] += n;
  return t;
}

module.exports = { ESCALA, medirCss, medirJs, medirRepositorio, totales, ficherosDeLaApp };
