// DEC-22 · El aviso del domingo abre la app en el repaso (décima auditoría §4.4; 20/11/2026, «sigue con todo lo que puedas que no
// depende de nosotros»). El recordatorio llegaba, la puerta no: el aviso del repaso semanal lleva un enlace a la app con
// `?abrir=repaso`, que la abre ya en el repaso. Sin datos del hogar: solo la dirección de la app que generó el fichero.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const R = require("../canonical-reminders.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const soloRepaso = { kinds: Object.fromEntries(R.KINDS.map((kind) => [kind, kind === "weeklyReview"])) };

test("DEC-22 · el enlace es la dirección de la app con ?abrir=repaso#home; sin una dirección http(s), nada", () => {
  assert.equal(R.reviewLink("https://ejemplo.github.io/app/index.html?tema=clasico#plan"), "https://ejemplo.github.io/app/index.html?abrir=repaso#home");
  assert.equal(R.reviewLink("http://127.0.0.1:4182/"), "http://127.0.0.1:4182/?abrir=repaso#home");
  for (const malo of ["", "file:///tmp/index.html", "javascript:alert(1)", "https://a b/", undefined]) assert.equal(R.reviewLink(malo), "", String(malo));
});

test("DEC-22 · cada aviso del repaso lleva el enlace en la descripción y como URL del evento; los demás avisos no", () => {
  const appUrl = "https://ejemplo.github.io/app/";
  const r = R.build({ today: "2026-11-13", appUrl, options: { kinds: { ...soloRepaso.kinds, monthClose: true } } });
  const repasos = r.events.filter((event) => event.kind === "weeklyReview");
  assert.ok(repasos.length > 20);
  assert.ok(repasos.every((event) => event.url === `${appUrl}?abrir=repaso#home` && event.description.endsWith(`Abrir el repaso: ${appUrl}?abrir=repaso#home`)));
  assert.ok(r.events.filter((event) => event.kind !== "weeklyReview").every((event) => !event.url));
  const ics = R.toIcs(repasos.slice(0, 1), { now: "2026-11-13T10:00:00Z" });
  assert.match(ics, /\r\nURL:https:\/\/ejemplo\.github\.io\/app\/\?abrir=repaso#home\r\n/);
  // Sin dirección (pruebas, fichero local) el aviso es el de siempre.
  const sin = R.build({ today: "2026-11-13", options: soloRepaso }).events[0];
  assert.equal(sin.url, undefined);
  assert.doesNotMatch(R.toIcs([sin], { now: "2026-11-13T10:00:00Z" }), /\r\nURL:/);
  assert.match(read("recordatorios-ui.js"), /appUrl: typeof location !== "undefined" \? `\$\{location\.origin\}\$\{location\.pathname\}` : "",/);
});

function ventana(search) {
  const listeners = {};
  const win = {
    location: { search, pathname: "/app/index.html", hash: "#home" },
    replaced: null,
    history: { replaceState: (_s, _t, url) => { win.replaced = url; } },
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    removeEventListener: (type, fn) => { listeners[type] = (listeners[type] || []).filter((item) => item !== fn); },
    fire: (type) => (listeners[type] || []).slice().forEach((fn) => fn()),
    listeners,
  };
  return win;
}

function cargarRepaso({ tema = "v2" } = {}) {
  const abiertos = [];
  const context = { document: { documentElement: { dataset: { tema } } }, globalThis: {}, window: undefined, module: undefined, URLSearchParams };
  vm.createContext(context);
  vm.runInContext(read("views/repaso-v2.js"), context);
  context.repasoV2Open = () => abiertos.push(1);
  return { context, abiertos };
}

test("DEC-22 · con ?abrir=repaso, al pintar la primera pantalla se abre el repaso y la marca se quita de la dirección", () => {
  const { context, abiertos } = cargarRepaso();
  const win = ventana("?abrir=repaso&x=1");
  assert.equal(context.repasoV2DesdeEnlace(win), true);
  assert.deepEqual(abiertos, []);
  win.fire("finance:view-rendered");
  assert.deepEqual(abiertos, [1]);
  assert.equal(win.replaced, "/app/index.html?x=1#home");
  win.fire("finance:view-rendered");
  assert.deepEqual(abiertos, [1], "una sola vez");
  // Sin la marca, nada; con el tema clásico, se quita la marca pero no hay repaso que abrir.
  assert.equal(context.repasoV2DesdeEnlace(ventana("")), false);
  const clasico = cargarRepaso({ tema: "clasico" });
  const w2 = ventana("?abrir=repaso");
  clasico.context.repasoV2DesdeEnlace(w2);
  w2.fire("finance:view-rendered");
  assert.deepEqual(clasico.abiertos, []);
  assert.equal(w2.replaced, "/app/index.html#home");
});
