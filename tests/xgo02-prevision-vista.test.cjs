// XGO-02 · la Previsión nueva cuenta como vista al abrir su pestaña (13/11/2026). Antes solo se miraba al pintarla, y se pinta
// con Plan, casi siempre con «Mes» delante: al pulsar «Previsión», setPlanTab (app.js) solo quita el `hidden` del panel y no
// repinta, así que el medidor de noviembre decía «aún sin usar». La prueba en navegador está en qa1 («XGO-02 · Previsión vista»).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("XGO-02 · la visita de la Previsión nueva se anota cuando se ve, no solo al pintarse", () => {
  const vista = read("views/prevision-v2.js");
  const anota = vista.slice(vista.indexOf("function previsionV2AnotaVista()"), vista.indexOf("function previsionV2AbreHoja("));
  assert.match(anota, /if \(!box \|\| box\.hidden \|\| qs\("plan"\)\?\.hidden \|\| panel\?\.hidden\) return false;/);
  assert.match(anota, /globalThis\.FinanceMedidor\?\.anotar\("prevision-v2", "vista"\);/);
  // Al pintarse, la misma regla (y ninguna otra anotación de vista suelta).
  assert.equal((vista.match(/anotar\("prevision-v2", "vista"\)/g) || []).length, 1, "una sola anotación de vista, en previsionV2AnotaVista");
  const render = vista.slice(vista.indexOf("function previsionV2Render()"), vista.indexOf("function previsionV2AnotaVista()"));
  assert.match(render, /previsionV2AnotaVista\(\);\n  return true;/);
  // Al abrir la pestaña o llegar a Plan: un observador del `hidden` de Plan, del panel y de la vista nueva.
  const init = vista.slice(vista.indexOf("function previsionV2Init()"));
  assert.match(init, /new MutationObserver\(\(\) => previsionV2AnotaVista\(\)\)/);
  assert.match(init, /\[qs\("plan"\), box\.closest\("\[data-plan-panel\]"\), box\]/);
  assert.match(init, /attributeFilter: \["hidden"\]/);
  assert.match(read("index.html"), /views\/prevision-v2\.js\?v=20261116prv01b/); // 14/11: PRV-01, el gasto variable previsto frente a real
});
