const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// DAT-05 (15/11/2026): traspasos entre cuentas propias. Movimientos INVENTADOS en dos cuentas («Cuenta A» y «Cuenta B»).

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const T = require("../canonical-internal-transfers.js");

const mv = (id, date, amount, account, settled = false) => ({ id, date, amount, account, settled });

test("empareja una salida y una entrada del mismo importe, en cuentas distintas, con dos días o menos", () => {
  const pairs = T.pairs([
    mv("s1", "2026-11-03", -500, "Cuenta A"),
    mv("e1", "2026-11-04", 500, "Cuenta B"),
    mv("s2", "2026-11-10", -80, "Cuenta A"),
    mv("e2", "2026-11-13", 80, "Cuenta B"), // tres días: no
    mv("s3", "2026-11-12", -60, "Cuenta A"),
    mv("e3", "2026-11-12", 60, "Cuenta A"), // misma cuenta: no es un traspaso entre cuentas
    mv("s4", "2026-11-14", -25.5, "Cuenta B"),
    mv("e4", "2026-11-14", 25.49, "Cuenta A"), // un céntimo de diferencia: no
  ]);
  assert.deepEqual(pairs, [{ key: "s1→e1", outId: "s1", inId: "e1", amount: 500, date: "2026-11-03", inDate: "2026-11-04", from: "Cuenta A", to: "Cuenta B", gap: 1, ambiguous: false }]);
});

test("cada movimiento va en una sola pareja, con la entrada más cercana; si había más de una candidata, lo dice", () => {
  const pairs = T.pairs([
    mv("s1", "2026-11-03", -100, "Cuenta A"),
    mv("e-lejos", "2026-11-05", 100, "Cuenta B"),
    mv("e-cerca", "2026-11-03", 100, "Cuenta B"),
    mv("s2", "2026-11-04", -100, "Cuenta A"),
  ]);
  assert.deepEqual(pairs.map((p) => [p.outId, p.inId, p.ambiguous]), [["s2", "e-lejos", false], ["s1", "e-cerca", true]], "de la más reciente a la más antigua");
});

test("la entrada puede ir antes que la salida (fecha valor) y un movimiento sin cuenta no se empareja", () => {
  assert.equal(T.pairs([mv("s", "2026-11-05", -40, "Cuenta A"), mv("e", "2026-11-04", 40, "Cuenta B")]).length, 1);
  assert.equal(T.pairs([mv("s", "2026-11-05", -40, ""), mv("e", "2026-11-05", 40, "Cuenta B")]).length, 0);
  assert.equal(T.pairs([mv("s", "2026-11-05", -40, "Cuenta A"), mv("e", "sin fecha", 40, "Cuenta B")]).length, 0);
  assert.deepEqual(T.pairs(null), []);
});

test("lo ya decidido en las dos puntas no se propone, pero ocupa su entrada; con una sola punta decidida, sí", () => {
  const base = [mv("s1", "2026-11-03", -100, "Cuenta A", true), mv("e1", "2026-11-03", 100, "Cuenta B", true), mv("s2", "2026-11-04", -100, "Cuenta A")];
  assert.deepEqual(T.pairs(base), [], "la entrada de la pareja decidida no se le da a otra salida");
  const media = T.pairs([mv("s1", "2026-11-03", -100, "Cuenta A", true), mv("e1", "2026-11-03", 100, "Cuenta B")]);
  assert.equal(media.length, 1, "la entrada sigue pidiendo partida: se propone");
});

test("una pareja descartada por el hogar no vuelve; la salida puede emparejarse con otra entrada", () => {
  const movs = [mv("s1", "2026-11-03", -100, "Cuenta A"), mv("e1", "2026-11-03", 100, "Cuenta B"), mv("e2", "2026-11-04", 100, "Cuenta B")];
  assert.equal(T.pairs(movs)[0].inId, "e1");
  assert.equal(T.pairs(movs, { dismissed: [T.pairKey("s1", "e1")] })[0].inId, "e2");
  assert.deepEqual(T.pairs(movs, { dismissed: ["s1→e1", "s1→e2"] }), []);
});

test("integración · un traspaso marcado no pide partida en Clasificar, Movimientos, la lista de siempre ni el cierre", () => {
  const datos = read("datos-ui.js");
  assert.match(datos, /function movementIsInternalTransfer\(transaction\) \{\n {2}return typeof actionTypeEntryForMovement === "function" && actionTypeEntryForMovement\(transaction\)\?\.actionType === "transferencia_interna";/, "solo el tipo confirmado por el hogar: una propuesta sin confirmar no cuenta");
  assert.match(datos, /const unclassified = filtered\.filter\(\(row\) => \(typeof movementNeedsPartida === "function" \? movementNeedsPartida\(row\) :/);
  const clas = read("views/clasificar-v2.js");
  const grupos = clas.slice(clas.indexOf("function clasV2PendingGroups()"), clas.indexOf("function clasV2MonthName("));
  assert.match(grupos, /movementIsInternalTransfer\(row\)\) return;/);
  const cobertura = clas.slice(clas.indexOf("function clasV2Coverage("), clas.indexOf("function clasificarV2CoberturaFrase()"));
  assert.match(cobertura, /movementIsInternalTransfer\(row\)\) return;/, "tampoco cuenta en el % de gasto con partida");
  assert.match(clas, /movementActionTypes\[group\.key\] = \{ actionType: "transferencia_interna"/);
  assert.match(read("views/cierre.js"), /movementIsInternalTransfer\(row\)\) return false; \/\/ DAT-05/);
  assert.match(read("app.js"), /id: "sin-clasificar".*movementIsInternalTransfer\(row\)/);
  const mov = read("views/movimientos-v2.js");
  assert.match(mov, /movementIsInternalTransfer\(row\) \? MOV_V2_TRASPASO : null;/);
  assert.match(mov, /data-mov-v2-traspaso-si=/);
  assert.match(mov, /data-mov-v2-traspaso-no=/);
});

test("integración · lo descartado va en la copia y el motor, en la caché offline y en el sitio público", () => {
  assert.match(read("app.js"), /"traspasos-descartados", \/\/ DAT-05/);
  assert.match(read("views/movimientos-v2.js"), /const MOV_V2_TRASPASOS_KEY = "traspasos-descartados";/);
  const html = read("index.html");
  const at = html.indexOf('<script defer src="canonical-internal-transfers.js?v=');
  assert.ok(at > 0 && at < html.indexOf('<script defer src="views/movimientos-v2.js'));
  assert.ok(read("service-worker.js").includes('"./canonical-internal-transfers.js"'));
  assert.ok(read("tools/build-public-site.mjs").includes('"canonical-internal-transfers.js"'));
});
