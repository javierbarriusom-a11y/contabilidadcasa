const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const { codigoApp } = require("./helpers/codigo-app.cjs");

// Barrido del 24/10/2026: textos que se leían mal en el móvil.
// · «Vence el 23 nov 26» o «Se esperaba el 19 oct 26»: el año de dos cifras se lee como un día. En pantalla, la fecha
//   corta lleva el año entero solo si no es el de hoy («19 oct», «8 ene 2027»). `shortDate` no cambia: sus etiquetas
//   están fijadas en el oro del motor de fechas (WP-07).
// · «Libre de deuda: sept 29» se leía como «29 de septiembre»: ahora «sept 2029».
// · Plurales «movimiento(s)», «día(s)»… en el recorrido del cierre (Cierre, Registrar y la cobertura de Hoy).

const root = path.resolve(__dirname, "..");
const app = codigoApp();
const cierre = fs.readFileSync(path.join(root, "views/cierre.js"), "utf8");
const registrar = fs.readFileSync(path.join(root, "registrar-ui.js"), "utf8");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  let depth = 0;
  for (let index = source.indexOf("{", source.indexOf(")", start)); index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Sin cuerpo: ${name}`);
}

function displayShortDateAt(today) {
  const context = {
    localDateFromIso: (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? new Date(`${iso}T12:00:00`) : null),
    Date: class extends Date {
      constructor(...args) {
        if (args.length) super(...args);
        else super(`${today}T12:00:00`);
      }
    },
  };
  vm.createContext(context);
  vm.runInContext(`${extractFunction(app, "displayShortDate")}; this.displayShortDate = displayShortDate;`, context);
  return context.displayShortDate;
}

test("la fecha corta de pantalla no lleva año si es el de hoy, y lo lleva entero si no", () => {
  const fecha = displayShortDateAt("2026-10-24");
  assert.equal(fecha("2026-10-19"), "19 oct");
  assert.equal(fecha("2026-11-03"), "3 nov");
  assert.equal(fecha("2027-01-08"), "8 ene 2027");
  assert.equal(fecha("2025-12-31"), "31 dic 2025");
  assert.equal(fecha("no es una fecha"), "");
});

test("shortDate sigue igual para el motor de fechas (oro de WP-07)", () => {
  assert.match(extractFunction(app, "shortDate"), /year: "2-digit"/);
});

test("la fecha libre de deuda lleva el año entero, también con la coletilla de deuda sin cuota", () => {
  const line = app.split("\n").find((text) => text.includes("libreDeDeudaLabel: escenarioMotorMonthLabel(summary.libreDeDeuda)"));
  assert.ok(line, "la etiqueta se construye donde siempre");
  const regex = /\.replace\((\/.+\/), "(.+?)"\)/.exec(line);
  assert.ok(regex, "lleva su replace");
  const apply = (label) => label.replace(eval(regex[1]), regex[2]);
  assert.equal(apply("sept 29"), "sept 2029");
  assert.equal(apply("jul 31 · queda deuda sin cuota activa"), "jul 2031 · queda deuda sin cuota activa");
  assert.equal(apply("Sin fecha"), "Sin fecha");
});

test("el recorrido del cierre ya no escribe plurales con paréntesis", () => {
  for (const name of ["cierreRecalcCheck", "cierreFirmChecks", "cierreStep1Html", "cierreEffectsHtml"]) {
    assert.doesNotMatch(extractFunction(cierre, name), /[a-zñ]\((s|es)\)/, `${name} no usa «(s)»`);
  }
  assert.doesNotMatch(extractFunction(registrar, "registrarImpactRows"), /día\(s\)/);
  assert.doesNotMatch(extractFunction(app, "registrarRecalcFigures"), /día\(s\)/);
});
