const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// CLA-01 y CLA-02 (15/11/2026): reglas por palabras en Clasificar. Movimientos INVENTADOS: Bizum a dos personas con su
// texto libre, un recibo cuya referencia cambia cada mes, otro cargo del mismo emisor con otro importe y un comercio.

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const P = require("../canonical-pattern-rules.js");

const bizum = (date, amount, details) => ({ date, amount, movement: "BIZUM ENVIADO", details });
const recibo = (date, amount, ref) => ({ date, amount, movement: `RECIBO AGUAS DEL VALLE REF ${ref}`, details: "" });

const MOVS = [
  bizum("2026-09-12", -20, "A PEPA FICTICIA cena sabado"),
  bizum("2026-10-03", -35, "A PEPA FICTICIA regalo"),
  bizum("2026-10-20", -12, "A LUIS INVENTADO entradas"),
  recibo("2026-09-05", -41.2, "000123"),
  recibo("2026-10-05", -43.9, "000456"),
  recibo("2026-10-18", -210, "000789"), // otro cargo del mismo emisor: una regularización
  { date: "2026-10-09", amount: -63.4, movement: "COMPRA TARJ. SUPER EJEMPLO 1234", details: "" },
  { date: "2026-10-28", amount: 35, movement: "BIZUM RECIBIDO", details: "DE PEPA FICTICIA devolucion" },
];

test("las palabras propuestas son las comunes al grupo, sin las genéricas, sin números y sin meses", () => {
  assert.deepEqual(P.candidateWords(MOVS.slice(0, 2)), ["pepa", "ficticia"], "el texto libre de cada Bizum no es común y se queda fuera");
  assert.deepEqual(P.candidateWords([MOVS[0]]), ["pepa", "ficticia", "cena", "sabado"], "con un solo movimiento no se puede saber qué cambia: lo decide el hogar");
  assert.deepEqual(P.candidateWords(MOVS.slice(3, 5)), ["aguas", "valle"], "ni «recibo», ni «ref», ni «del», ni la referencia");
  assert.deepEqual(P.candidateWords([{ date: "2026-10-01", amount: -9, movement: "FINANCIE-OCTUBRE 2026", details: "" }]), ["financie"]);
  assert.deepEqual(P.candidateWords([{ date: "2026-10-01", amount: -9, movement: "TPV 4455 12", details: "" }]), [], "sin nombre reconocible no hay regla por palabras");
});

test("lo que teclea el hogar se limpia igual: tildes, mayúsculas, repetidas y palabras que no identifican", () => {
  assert.deepEqual(P.cleanWords("  Pepa   FICTÍCIA pepa bizum 2026 a de "), ["pepa", "ficticia"]);
  assert.deepEqual(P.cleanWords("bizum recibo 123"), []);
  assert.equal(P.build({ kind: "expense", words: "bizum 12", rowKey: "expense|x" }), null, "sin palabras que valgan no hay regla");
  assert.equal(P.build({ kind: "expense", words: "pepa", rowKey: "" }), null, "sin partida no hay regla");
});

test("CLA-02 · un Bizum a la misma persona encaja aunque cambie el texto; a otra persona o en el otro sentido, no", () => {
  const built = P.build({ kind: "expense", words: "pepa ficticia", rowKey: "expense|ocio", now: "2026-11-15T10:00:00Z" });
  assert.equal(built.key, "patron|expense|ficticia pepa", "la clave no depende del orden en que se escriban");
  const [rule] = P.rulesOf({ [built.key]: built.value });
  assert.equal(rule.amount, null);
  assert.equal(rule.shown, "PEPA FICTICIA", "se dice en el orden en que se escribió");
  assert.ok(P.matches(rule, MOVS[0]) && P.matches(rule, MOVS[1]));
  assert.ok(!P.matches(rule, MOVS[2]), "otra persona");
  assert.ok(!P.matches(rule, MOVS[7]), "un Bizum recibido es un ingreso: no lo coge una regla de gasto");
  assert.ok(!P.matches(rule, { ...MOVS[0], amount: 0 }));
  assert.deepEqual(P.preview(rule, MOVS), { rows: [MOVS[0], MOVS[1]], count: 2, total: 55 });
});

test("CLA-01 · un recibo con la referencia cambiada encaja por emisor e importe parecido; otro cargo del mismo emisor, no", () => {
  const perfil = P.amountProfile(MOVS.slice(3, 5));
  assert.equal(perfil.typical, 42.55);
  assert.equal(perfil.steady, true);
  assert.equal(P.amountProfile(MOVS.slice(3, 6)).steady, false, "con la regularización los importes ya no se parecen");
  const built = P.build({ kind: "expense", words: P.candidateWords(MOVS.slice(3, 5)), rowKey: "expense|agua", amount: perfil.typical, now: "2026-11-15T10:00:00Z" });
  const [rule] = P.rulesOf({ [built.key]: built.value });
  assert.equal(rule.amount, 42.55);
  assert.ok(P.matches(rule, recibo("2026-11-05", -45.1, "000999")), "dentro del ± 10 %");
  assert.ok(!P.matches(rule, MOVS[5]), "210 € no es el recibo de siempre: sigue en la bandeja");
  assert.ok(!P.matches(rule, recibo("2026-11-05", -47.5, "000999")), "fuera del ± 10 %");
  const pequeño = P.rulesOf({ a: null, ...Object.fromEntries([Object.values(P.build({ kind: "expense", words: "aguas", rowKey: "expense|agua", amount: 3 }))]) })[0];
  assert.ok(P.matches(pequeño, recibo("2026-11-05", -3.9, "1")), "con importes pequeños el margen mínimo es 1 €");
  assert.ok(!P.matches(pequeño, recibo("2026-11-05", -4.2, "1")));
});

test("si encajan varias reglas manda la más concreta y, a igualdad, la que pide importe; después, la última", () => {
  const mk = (words, rowKey, amount, now) => P.build({ kind: "expense", words, rowKey, amount, now });
  const dict = Object.fromEntries([mk("aguas", "expense|a", null, "2026-11-01"), mk("aguas valle", "expense|b", null, "2026-10-01"), mk("valle", "expense|c", 42, "2026-11-10")].map((r) => [r.key, r.value]));
  dict["expense|recibo aguas del valle ref 000123|"] = { kind: "expense", rowKey: "expense|z" }; // una regla de concepto: no es una regla por palabras
  const rules = P.rulesOf(dict);
  assert.equal(rules.length, 3);
  assert.equal(P.best(rules, MOVS[3]).rowKey, "expense|b", "dos palabras ganan a una");
  assert.equal(P.best(rules.filter((r) => r.words.length === 1), MOVS[3]).rowKey, "expense|c", "a igualdad de palabras, la que pide importe");
  assert.equal(P.best(rules, MOVS[6]), null);
});

test("las palabras salen de la clave: sin el campo «patron» la regla sigue reconociendo por palabras", () => {
  const [rule] = P.rulesOf({ "patron|income|ficticia pepa": { kind: "income", rowKey: "income|otros" } });
  assert.deepEqual(rule.words, ["ficticia", "pepa"]);
  assert.equal(rule.shown, "FICTICIA PEPA");
  assert.ok(P.matches(rule, MOVS[7]));
  assert.deepEqual(P.rulesOf({ "patron|income|pepa": { kind: "expense", rowKey: "x" }, "patron|income|": { kind: "income", rowKey: "x" }, "patron|income|luis": { kind: "income" } }), [], "tipo que no cuadra, sin palabras o sin partida");
});

test("typeOf dice cómo se pagó", () => {
  assert.equal(P.typeOf(MOVS[0]), "bizum");
  assert.equal(P.typeOf(MOVS[3]), "recibo");
  assert.equal(P.typeOf({ movement: "TRANSF. A FAVOR DE X" }), "transferencia");
  assert.equal(P.typeOf(MOVS[6]), "");
});

test("integración · la regla por palabras va detrás de las de concepto y delante de la coincidencia de nombre", () => {
  const app = read("app.js");
  const fn = app.slice(app.indexOf("function mappingForMovement("), app.indexOf("// P-1: catálogo del eje de tipo de acción"));
  const orden = ["transactionIdentity(transaction)", "movementMappingKey(transaction)", "movementMappingForAnyMonth(", "movementMappingByPattern(", "exactMovementPlanningMatch("].map((s) => fn.indexOf(s));
  assert.ok(orden.every((at) => at > 0) && orden.every((at, i) => i === 0 || at > orden[i - 1]), `orden: ${orden}`);
  assert.match(fn, /source: "pattern", patternKey: byWords\.key/);
  assert.match(read("datos-ui.js"), /function movementMappingByPattern\(transaction, kind\)/);
});

test("integración · Clasificar ofrece «Recordar también por palabras», dice lo que cogería y lo deshace con la regla", () => {
  const clas = read("views/clasificar-v2.js");
  assert.match(clas, /Recordar también por palabras, aunque cambie el resto del concepto/);
  assert.match(clas, /Además de este grupo, ahora cogería/);
  assert.match(clas, /movementMappings\[patron\.key\] = patron\.value;/);
  assert.match(clas, /else if \(rule\.patron\) delete movementMappings\[rule\.patron\.key\];/);
  assert.match(clas, /if \(clasV2PatronOn && !patron\) \{/, "con la casilla marcada y sin palabras que valgan no se acepta a medias");
  const reset = clas.slice(clas.indexOf("function clasV2PatronReset()"), clas.indexOf("function clasV2PatronDraft("));
  assert.match(reset, /clasV2PatronOn = false;/, "sin marcar de entrada: una regla que clasifica sola la pide el hogar");
  assert.match(read("ficha-movimiento-ui.js"), /id="fichaMovQuitarPatron">Quitar esa regla<\/button>/);
});

test("integración · el motor se carga antes que Clasificar y app.js, y va en la caché offline y en el sitio público", () => {
  const html = read("index.html");
  const at = html.indexOf('<script defer src="canonical-pattern-rules.js?v=');
  assert.ok(at > 0 && at < html.indexOf('<script defer src="views/clasificar-v2.js') && at < html.indexOf('<script defer src="app.js'));
  assert.ok(read("service-worker.js").includes('"./canonical-pattern-rules.js"'));
  assert.ok(read("tools/build-public-site.mjs").includes('"canonical-pattern-rules.js"'));
  assert.ok(html.includes("datos-ui.js?v=20261116cla1"));
  // La ficha pasó a 20261119dat07 con «Dividir en varias partidas» (DAT-07).
  assert.ok(html.includes("ficha-movimiento-ui.js?v=20261119dat07"));
  // Clasificar pasó a 20261118dec18 con la meta del 95 % en la bandeja (DEC-18, clasV2Meta).
  assert.ok(html.includes("views/clasificar-v2.js?v=20261118dec18"));
});

test("CLA-03 · propone la partida del movimiento ya clasificado que más se parece, y dice cuánto se fía", () => {
  const cl = (row, rowKey) => ({ row, rowKey });
  const clasificados = [cl(MOVS[0], "expense|ocio"), cl(MOVS[1], "expense|ocio"), cl(MOVS[3], "expense|agua"), cl(MOVS[6], "expense|super"), cl(MOVS[7], "income|otros")];
  const nuevo = bizum("2026-11-02", -18, "A PEPA FICTICIA cafe");
  assert.deepEqual(P.nearest(nuevo, clasificados), { rowKey: "expense|ocio", shared: ["pepa", "ficticia"], alike: false, count: 2, tie: false, confidence: "media" }, "dos palabras de la persona; el ingreso de la misma persona no cuenta para un gasto");
  const reciboNuevo = recibo("2026-11-05", -42, "000999");
  assert.equal(P.nearest(reciboNuevo, clasificados).rowKey, "expense|agua");
  assert.equal(P.nearest(reciboNuevo, clasificados).alike, true);
  // Una sola palabra en común y otro importe: confianza baja.
  assert.equal(P.nearest({ date: "2026-11-05", amount: -300, movement: "COMPRA VALLE DEPORTES", details: "" }, clasificados).confidence, "baja");
  // Empate entre dos partidas: baja, y lo dice.
  const empate = P.nearest(nuevo, [cl(MOVS[0], "expense|ocio"), cl(MOVS[1], "expense|regalos")]);
  assert.equal(empate.tie, true);
  assert.equal(empate.confidence, "baja");
  assert.equal(P.nearest({ date: "2026-11-05", amount: -9, movement: "TPV 4455 12", details: "" }, clasificados), null, "sin palabras que identifiquen no hay parecido");
  assert.equal(P.nearest(nuevo, []), null);
  const clas = read("views/clasificar-v2.js");
  assert.match(clas, /if \(!byName\.length\) return clasV2Parecido\(group\);/, "solo cuando no hay reglas del comercio ni nombre de partida: no pisa las señales de siempre");
});

test("integración · todas las reglas por palabras se ven y se quitan en Movimientos, plegadas de entrada", () => {
  const mov = read("views/movimientos-v2.js");
  assert.match(mov, /<details class="mov-v2-reglas" id="movV2Reglas"/, "un desplegable, no un titular nuevo (XGO-01)");
  assert.match(mov, /if \(!reglas\.length\) return \[\]; \/\/ sin reglas no se recorre el extracto/);
  assert.match(mov, /data-mov-v2-regla-quitar=/);
  const quitar = mov.slice(mov.indexOf("function movV2ReglaQuitar("), mov.indexOf("function movV2TraspasoNo("));
  assert.match(quitar, /delete movementMappings\[key\];/);
  assert.match(quitar, /applyMovementMappingsToActuals\(\);/, "los reales se recalculan al quitarla");
  assert.match(quitar, /movementMappings\[key\] = antes;/, "se deshace");
});
