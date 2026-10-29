const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const F = require("../canonical-decision-freshness.js");
const fep = require("../funciones-en-prueba.js");
const medidor = require("../medidor-utilidad.js");

// XDA-10 · PR-1 «Comprobar los datos antes de decidir»: bajo el veredicto del guardarraíl de colchón, si los saldos son antiguos, dice si
// lo que han podido moverse (estimación de WP-45) cambiaría el veredicto. Lo que no se sabe no se da por bueno. Nace apagada en Funciones
// en prueba. La e2e de qa1 lo mira en el simulador de amortizar con unos saldos de hace 12 días.

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const saldos = (ageDays, plausibleMove) => ({ id: "balances", label: "Los saldos", ageDays, staleAfterDays: 4, plausibleMove, action: { label: "Actualizar saldos", href: "#visual-detail" } });

test("con los datos al día no hay nada que decir", () => {
  const r = F.check({ margin: 500, inputs: [saldos(2, 80)] });
  assert.equal(r.status, "fresh");
  assert.deepEqual(r.items, []);
  assert.equal(r.sentence, "");
  assert.equal(r.oldestDays, 2);
  assert.equal(F.check({}).status, "fresh", "sin datos que mirar, nada");
});

test("un dato antiguo que puede haberse movido tanto como el margen le da la vuelta al veredicto, y se dice con sus cifras", () => {
  const r = F.check({ margin: 80, inputs: [saldos(12, 960)] });
  assert.equal(r.status, "stale");
  assert.equal(r.items[0].flips, "yes");
  assert.equal(r.sentence, "Antes de decidir, actualiza los saldos (de hace 12 días): pueden haberse movido hasta 960 € y el resultado cambia con 80 €.");
  assert.equal(F.check({ margin: -80, inputs: [saldos(12, 80)] }).items[0].flips, "yes", "el margen cuenta en valor absoluto y el empate cambia el veredicto");
  assert.equal(F.check({ margin: 50, inputs: [saldos(1, 1200)] }).status, "fresh", "con saldos de ayer (umbral de 4 días de WP-45) no salta, aunque el margen sea pequeño");
  assert.equal(F.check({ margin: 50, inputs: [saldos(4, 320)] }).items[0].flips, "yes", "el día del umbral ya cuenta como antiguo");
});

test("si no le da la vuelta, se dice que no cambia; si no se sabe, no se da por bueno", () => {
  assert.equal(F.check({ margin: 2000, inputs: [saldos(12, 960)] }).sentence, "Los saldos son de hace 12 días, pero lo que hayan podido moverse (hasta 960 €) no cambia el resultado.");
  const sinFecha = F.check({ margin: 2000, inputs: [saldos(null, null)] });
  assert.equal(sinFecha.items[0].flips, "unknown", "sin fecha no hay edad: el dato no se da por fresco");
  assert.equal(sinFecha.sentence, "Antes de decidir, conviene actualizar los saldos (sin fecha): no sé cuánto han podido moverse.");
  const sinMargen = F.check({ margin: null, inputs: [saldos(12, 960)] });
  assert.equal(sinMargen.items[0].flips, "unknown", "una alerta solo cambia si ha entrado dinero, y eso no se estima");
  assert.match(sinMargen.sentence, /lo que haya podido entrar desde entonces podría cambiar el resultado, y eso no lo estimo/);
});

test("primero lo que da la vuelta, después lo que no se sabe y después lo demás; como mucho tres", () => {
  const inputs = [
    { ...saldos(30, 10), id: "a", label: "A" },
    { ...saldos(5, 900), id: "b", label: "B" },
    { ...saldos(null, null), id: "c", label: "C" },
    { ...saldos(40, 20), id: "d", label: "D" },
    { ...saldos(2, 900), id: "e", label: "E" },
  ];
  const r = F.check({ margin: 100, inputs });
  assert.deepEqual(r.items.map((item) => [item.id, item.flips]), [["b", "yes"], ["c", "unknown"], ["d", "no"]]);
  assert.equal(r.items.length, F.MAX_ITEMS);
  assert.equal(r.oldestDays, 40);
});

test("en Funciones en prueba con su interruptor y cuelga del guardarraíl de colchón sin recalcular nada", () => {
  const item = fep.CATALOGO.find((entry) => entry.id === "antes-de-decidir");
  assert.equal(item.interruptor, "propio");
  assert.ok(medidor.FUNCIONES.some((f) => f.id === "antes-de-decidir"));
  assert.match(read("app.js"), /globalThis\.antesDeDecidirHtml\?\.\(result, globalThis\.FinanceCanonicalDecisionFreshness\) \|\| ""/);
  const ui = read("antes-de-decidir-ui.js");
  assert.match(ui, /if \(!guardrail \|\| !engine \|\| !antesDeDecidirOn\(\) \|\| !globalThis\.FinanceCanonicalDataQueue\) return "";/);
  assert.match(ui, /if \(result\.status !== "stale"\) return "";/);
  assert.match(ui, /margin: below \? null : Number\(guardrail\.remaining\) - Number\(guardrail\.floor\)/, "por debajo del suelo el margen no se estima");
  assert.match(ui, /source\.balanceMode === "auto" \|\| !source\.balanceDate \? null/, "los saldos calculados por calendario no tienen edad");
  assert.match(ui, /queue\.unloggedEstimate\(/, "«hasta» es la estimación de WP-45, no una propia");
  for (const file of ["index.html", "service-worker.js", "tools/build-public-site.mjs"]) {
    assert.ok(read(file).includes("canonical-decision-freshness.js") && read(file).includes("antes-de-decidir-ui.js"), file);
  }
});
