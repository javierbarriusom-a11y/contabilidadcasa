// Privacidad (19/11/2026, docs/PRIVACIDAD_NOMBRES.md; D-N24, D-N25 y D-N26). Fase 1: la protección de privacidad no escribe
// las frases prohibidas, solo su huella. Fase 2: los nombres que enseña la app salen de los datos del hogar, nunca del código;
// por defecto, «Persona 1» y «Persona 2». Esta prueba no escribe los nombres: los reconstruye de base64 para buscarlos.
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

test("privacidad · en el código de las pantallas, los nombres solo quedan como valores de datos (fase 4)", () => {
  const ficheros = ["app.js", "p2-ui.js", "partidas-ui.js", "informe-renta-ui.js", "local-renta-ui.js", "renta-datos-ui.js", "views/executive-advisor.js", "views/new-life-definitive.js", "views/new-life-simulation.js"];
  const restos = [];
  const palabra = new RegExp(`\\b(${N1}|${N2})\\b`);
  ficheros.forEach((f) => read(f).split("\n").forEach((linea, i) => {
    if (!palabra.test(linea) || /^\s*\/\//.test(linea)) return;
    // Lo que queda a propósito hasta la fase 4: el valor que guarda el simulador de proyectos y cómo se infiere, y la plantilla
    // de financiaciones del Excel del hogar (fase 3).
    if (/creditOwner|projectCreditOwner|inferDecisionOwner|return "|const owners = \[|financingTemplateKey\(|group: "|^\s*"[a-z]+\||^\s*"[^"]*",\s*$/.test(linea)) return;
    restos.push(`${f}:${i + 1}`);
  }));
  assert.deepEqual(restos, []);
});

test("privacidad, fase 1 · la protección guarda huellas, no las frases; y sigue el patrón de tarjeta", () => {
  const tool = read("tools/check-public-privacy.mjs");
  assert.match(tool, /const FORBIDDEN_PHRASE_HASHES = new Set\(\[("[0-9a-f]{64}", ){5}"[0-9a-f]{64}"\]\);/);
  assert.match(tool, /const FIRST_WORD_HASHES = new Set\(\[/);
  assert.match(tool, /\/\\b\(\?:\\d\[ -\]\?\)\{13,19\}\\b\//);
  // Ninguna línea del fichero escribe una frase de dos palabras con mayúsculas (lo que era la lista en claro).
  assert.doesNotMatch(tool, /\/[A-ZÁÉÍÓÚ][a-záéíóú]+ [A-ZÁÉÍÓÚ][a-záéíóú]+[^/]*\/i,/);
});
