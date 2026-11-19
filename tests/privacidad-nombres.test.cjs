// Privacidad (19/11/2026, docs/PRIVACIDAD_NOMBRES.md; D-N24, D-N25 y D-N26). Fase 1: la protección de privacidad no escribe
// las frases prohibidas, solo su huella. Fase 2: los nombres que enseña la app salen de los datos del hogar, nunca del código;
// por defecto, «Persona 1» y «Persona 2». Fase 3: las reglas reconocen a cada persona por la huella de su nombre o por el de
// Ajustes, y la plantilla de financiaciones sale del código. Esta prueba no escribe los nombres: los reconstruye de base64.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const M = require("../household-members.js");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const [N1, N2] = ["SmF2aQ==", "VGVyZQ=="].map((b) => Buffer.from(b, "base64").toString("utf8"));

test("privacidad · los nombres por defecto, los del hogar, las claves de siempre y el hogar", () => {
  assert.equal(M.etiqueta("p1"), "Persona 1");
  assert.equal(M.etiqueta("p2"), "Persona 2");
  assert.equal(M.etiqueta("household"), "Hogar");
  assert.equal(M.etiqueta("hogar"), "Hogar");
  const nombres = { p1: "Ana Ficticia", p2: "Luis Inventado" };
  assert.equal(M.etiqueta("p1", nombres), "Ana Ficticia");
  // Las claves que guardan hoy los datos (hasta la fase 4), con minúscula o mayúscula, son de cada persona.
  assert.equal(M.etiqueta(N1.toLowerCase(), nombres), "Ana Ficticia");
  assert.equal(M.etiqueta(N2, nombres), "Luis Inventado");
  assert.equal(M.clave(N2), "p2");
  assert.equal(M.clave("otro"), null);
  assert.equal(M.plantilla("Ingreso de {p1} y de {p2}", nombres), "Ingreso de Ana Ficticia y de Luis Inventado");
  assert.equal(M.plantilla("Entre {p1} y {p2}"), "Entre Persona 1 y Persona 2");
});

test("privacidad · lo que se guarda: dos nombres cortos, sin marcas; vacío vuelve al de por defecto", () => {
  assert.deepEqual(M.normalizar({ p1: "  <b>Ana</b>   Ficticia ", p2: "x".repeat(50) }), { p1: "bAna/b Ficticia", p2: "x".repeat(30) });
  assert.equal(M.etiqueta("p1", M.normalizar({ p1: "   " })), "Persona 1");
});

test("privacidad · la tarjeta de Ajustes (plegada, sin titular) y el módulo antes de app.js", () => {
  const html = read("index.html");
  const at = html.indexOf('id="householdNamesCard"');
  assert.ok(at > html.indexOf('id="ajustes-hogar"') && at < html.indexOf('id="ajustes-reserva"'));
  const tarjeta = html.slice(at, html.indexOf("</details>", at));
  assert.doesNotMatch(tarjeta, /<h[1-6]/);
  assert.match(tarjeta, /<input id="householdNameP1" type="text" maxlength="30"/);
  assert.ok(html.indexOf('src="household-members.js?v=') > 0 && html.indexOf('src="household-members.js?v=') < html.indexOf('src="app.js?v='));
  assert.match(read("app.js"), /globalThis\.paintMemberLabels\?\.\(\); \/\/ privacidad/);
  assert.match(read("service-worker.js"), /"\.\/household-members\.js",/);
  assert.match(read("tools/build-public-site.mjs"), /"household-members\.js",/);
});

test("privacidad · ningún nombre de las personas se ve en la página: solo «Persona 1/2» y lo que digan sus datos", () => {
  const html = read("index.html");
  const visibles = new RegExp(`>[^<]*\\b(${N1}|${N2})\\b[^<]*<|placeholder="[^"]*\\b(${N1}|${N2})`, "g");
  assert.deepEqual(html.match(visibles) || [], []);
  assert.match(html, /data-member="p1">Persona 1</);
  assert.match(html, /data-member-template="Ingreso mensual de \{p1\} \(€\)">Ingreso mensual de Persona 1 \(€\)</);
});

// Lo que se publica: index.html y los scripts de la raíz y de views/ (no vendor/, ni pruebas, ni documentación).
const publicados = () => ["index.html", ...fs.readdirSync(path.join(__dirname, "..")).filter((f) => f.endsWith(".js")), ...fs.readdirSync(path.join(__dirname, "..", "views")).filter((f) => f.endsWith(".js")).map((f) => `views/${f}`)];

test("privacidad, fase 3 · en lo que se publica no queda un nombre escrito como nombre, ni una regla que lo busque", () => {
  const [n1, n2] = [N1.toLowerCase(), N2.toLowerCase()];
  const nombre = new RegExp(`\\b(${N1}|${N2})\\b`); // con mayúscula: un nombre en un texto, un valor o un comentario
  const regla = new RegExp(`\\\\b(${n1}|${n2})|(includes|test|match)\\(["'\`][^"'\`]*\\b(${n1}|${n2})|\\b(${n1}|${n2})(er|sa)\\b|(nomina|salario|bonus)\\s+(\\\\s\\+)?(${n1}|${n2})`);
  const restos = [];
  publicados().forEach((f) => read(f).split("\n").forEach((linea, i) => {
    if (nombre.test(linea) || regla.test(linea)) restos.push(`${f}:${i + 1}`);
  }));
  assert.deepEqual(restos, []);
  // Hasta la fase 4 quedan las claves de datos en minúscula («owner», «titular», «incomes»…); la plantilla de financiaciones ya no.
  assert.doesNotMatch(read("app.js"), /FINANCING_ROW_TEMPLATES|FINANCING_SUBGROUP_LABELS|USER_REMOVED_FINANCING_KEYS\b|VARIABLE_FORMULA_FINANCING_EXCLUSIONS\b/);
});

test("privacidad, fase 3 · quién nombra un texto: por la huella, palabra a palabra, o por el nombre de Ajustes", () => {
  assert.equal(M.huella("Ábc  DEF"), M.huella("abc def"));
  assert.deepEqual(M.personasEnTexto(`Nómina ${N2}`), ["p2"]);
  assert.deepEqual(M.personasEnTexto(`Préstamo ${N1}er`), ["p1"]);
  assert.deepEqual(M.personasEnTexto(`${N1} y ${N2}`), ["p1", "p2"]);
  // Nunca un trozo de palabra: «intereses» contenía a una de las dos con la regla de antes.
  assert.deepEqual(M.personasEnTexto("Intereses del préstamo"), []);
  assert.deepEqual(M.personasEnTexto("Nómina Ana", { p1: "Ana Ficticia" }), ["p1"]);
  assert.deepEqual(M.personasEnTexto("Nómina", { p1: "Ana Ficticia" }), []);
  // La nómina: la misma regla de posición que tenía el motor de fechas, y solo con la forma corta del nombre.
  assert.equal(M.nominaDe(`nomina ${N1.toLowerCase()}`, "p1"), true);
  assert.equal(M.nominaDe(`${N1.toLowerCase()} bonus nomina`, "p1"), true);
  assert.equal(M.nominaDe(`nomina extra ${N1.toLowerCase()}`, "p1"), false);
  assert.equal(M.nominaDe(`${N1.toLowerCase()}er nomina`, "p1"), false);
  assert.equal(M.nominaDe(`salario ${N2.toLowerCase()}`, "p2"), true);
  assert.equal(M.nominaDe("nomina ana", "p1", { p1: "Ana" }), true);
  // Las claves de los datos de siempre, por su huella: ya no por longitud y primera letra («tasa» no es nadie).
  assert.equal(M.clave(N1), "p1");
  assert.equal(M.clave("tasa"), null);
  assert.equal(M.clave("p2"), "p2");
});

test("privacidad, fase 3 · la plantilla de financiaciones: solo sus huellas, y la app hace lo mismo que antes", () => {
  const app = read("app.js");
  const huellas = (nombre) => new Set(app.match(new RegExp(`const ${nombre} = new Set\\(\\[([^\\]]*)\\]`))[1].match(/[0-9a-f]+/g));
  const [n1, n2] = [N1.toLowerCase(), N2.toLowerCase()];
  // Las dos filas que el hogar quitó siguen fuera aunque vuelvan en una copia antigua.
  const quitadas = huellas("USER_REMOVED_FINANCING_KEY_HASHES");
  assert.ok(quitadas.has(M.huella(`pass carrefour ${n2}|financiacion express 5`)));
  assert.ok(quitadas.has(M.huella(`pass carrefour ${n1}|financiacion express 1`)));
  assert.ok(!quitadas.has(M.huella(`pass carrefour ${n2}|financiacion express 4`)));
  // La fórmula del gasto variable no cuenta las mismas filas (también con algo detrás, como hacía `includes`).
  const excluidas = huellas("VARIABLE_FORMULA_FINANCING_EXCLUSION_HASHES");
  assert.equal(M.contieneHuella(`caixabank|mastercard ${n2}`, excluidas), true);
  assert.equal(M.contieneHuella(`caixabank|visa go ${n1} 2`, excluidas), true);
  assert.equal(M.contieneHuella(`otros|prestamo cetelem ${n2}`, excluidas), true);
  assert.equal(M.contieneHuella("caixabank|otra tarjeta", excluidas), false);
  assert.equal(M.contieneHuella("eci|tarjeta eci", excluidas), false);
  // Al importar el Excel, sus subgrupos se siguen reconociendo.
  const subgrupos = huellas("FINANCING_SUBGROUP_HASHES");
  ["ECI", `Pass Carrefour ${N2}`, `Pass Carrefour ${N1}`, "Caixabank", "Bankintercard", "Otros"].forEach((g) => assert.ok(subgrupos.has(M.huella(g)), g));
  assert.match(read("registrar-ui.js"), /FINANCING_SUBGROUP_HASHES\.has\(globalThis\.FinanceHouseholdMembers\?\.huella\(text\)\)/);
  // «Financiaciones» queda con las filas de los datos: la demo pública ya no recibe las de la plantilla.
  const ensure = app.slice(app.indexOf("function ensureCompleteFinancingSection()"), app.indexOf("function fitPlannedValues("));
  assert.match(ensure, /section\.rows = section\.rows\s*\.filter\(\(row\) => !isUserRemovedFinancingRow\(row\)/);
});

test("privacidad, fase 1 · la protección guarda huellas, no las frases; y sigue el patrón de tarjeta", () => {
  const tool = read("tools/check-public-privacy.mjs");
  assert.match(tool, /const FORBIDDEN_PHRASE_HASHES = new Set\(\[("[0-9a-f]{64}", ){5}"[0-9a-f]{64}"\]\);/);
  assert.match(tool, /const FIRST_WORD_HASHES = new Set\(\[/);
  assert.match(tool, /\/\\b\(\?:\\d\[ -\]\?\)\{13,19\}\\b\//);
  // Ninguna línea del fichero escribe una frase de dos palabras con mayúsculas (lo que era la lista en claro).
  assert.doesNotMatch(tool, /\/[A-ZÁÉÍÓÚ][a-záéíóú]+ [A-ZÁÉÍÓÚ][a-záéíóú]+[^/]*\/i,/);
});
