const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// T11 (Horizonte 4 de BACKLOG_CONTABILIDADCASA_2_0.md): «ficha de gasto con foto y geolocalización
// opcional, para reconciliar más rápido sin depender de la descripción del banco». La foto de un
// gasto nuevo ya la cubría A17-3 (captura por cámara + OCR); esto cubre adjuntar una foto a un
// movimiento YA existente (típicamente uno importado del banco) y, nuevo, geolocalización opcional
// — mismo mecanismo de adjunto que A17-3 (P2PrivateStore/A3-5), sin librería ni servicio externo
// para la geolocalización (API del navegador + permalink de OpenStreetMap).

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

function extractFunction(name) {
  let start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  if (start >= 6 && app.slice(start - 6, start) === "async ") start -= 6;
  const parenStart = app.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = app.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function sandboxWith(names, extra = {}) {
  const context = {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    formatIsoDate: (v) => v,
    transactionIdentity: (row) => `${row.date}|${row.movement}|${row.amount}`,
    ...extra,
  };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

const ROW = { date: "2026-09-19", movement: "SUPERMERCADO XYZ", amount: -34.5 };

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// --- t11GeoMapUrl ------------------------------------------------------------------------------

test("t11GeoMapUrl · arma un permalink de OpenStreetMap, sin clave de API", () => {
  const context = sandboxWith(["t11GeoMapUrl"]);
  const url = context.t11GeoMapUrl({ lat: 40.4168, lon: -3.7038 });
  assert.equal(url, "https://www.openstreetmap.org/?mlat=40.4168&mlon=-3.7038#map=17/40.4168/-3.7038");
});

// --- movementDetailAttachmentHtml ----------------------------------------------------------------

test("movementDetailAttachmentHtml · sin ningún adjunto, ofrece adjuntar foto y guardar ubicación", () => {
  const context = sandboxWith(["movementDetailAttachmentHtml", "t11GeoMapUrl"], { receiptAttachments: {} });
  const html = context.movementDetailAttachmentHtml(ROW);
  assert.match(html, /id="movementDetailAttachPhoto"/);
  assert.match(html, /Adjuntar foto/);
  assert.doesNotMatch(html, /movementDetailViewReceipt/);
  assert.doesNotMatch(html, /Ver ubicación guardada/);
  assert.match(html, /id="movementDetailSaveGeo"/);
  assert.match(html, /Guardar mi ubicación/);
  assert.doesNotMatch(html, /Actualizar mi ubicación/);
});

test("movementDetailAttachmentHtml · con foto ya enlazada, ofrece verla en vez de adjuntar otra", () => {
  const context = sandboxWith(["movementDetailAttachmentHtml", "t11GeoMapUrl"], {
    receiptAttachments: { [`${ROW.date}|${ROW.movement}|${ROW.amount}`]: { inboxItemId: "receipt-manual-1" } },
  });
  const html = context.movementDetailAttachmentHtml(ROW);
  assert.match(html, /id="movementDetailViewReceipt"/);
  assert.match(html, /Ver foto del ticket/);
  assert.doesNotMatch(html, /id="movementDetailAttachPhoto"/);
});

test("movementDetailAttachmentHtml · con ubicación ya guardada, ofrece verla y «actualizar» en vez de «guardar»", () => {
  const context = sandboxWith(["movementDetailAttachmentHtml", "t11GeoMapUrl"], {
    receiptAttachments: {
      [`${ROW.date}|${ROW.movement}|${ROW.amount}`]: { geo: { lat: 40.1, lon: -3.5, capturedAt: "2026-09-19T10:00:00.000Z" } },
    },
  });
  const html = context.movementDetailAttachmentHtml(ROW);
  assert.match(html, /Ver ubicación guardada/);
  assert.match(html, /mlat=40\.1&mlon=-3\.5/);
  assert.match(html, /Actualizar mi ubicación/);
  assert.doesNotMatch(html, />Guardar mi ubicación/);
  // Sin foto adjunta todavía, sigue ofreciendo adjuntar una — foto y ubicación son independientes.
  assert.match(html, /id="movementDetailAttachPhoto"/);
});

test("movementDetailAttachmentHtml · con foto y ubicación, ofrece las dos acciones de «ver» a la vez", () => {
  const context = sandboxWith(["movementDetailAttachmentHtml", "t11GeoMapUrl"], {
    receiptAttachments: {
      [`${ROW.date}|${ROW.movement}|${ROW.amount}`]: {
        inboxItemId: "receipt-manual-1",
        geo: { lat: 40.1, lon: -3.5, capturedAt: "2026-09-19T10:00:00.000Z" },
      },
    },
  });
  const html = context.movementDetailAttachmentHtml(ROW);
  assert.match(html, /Ver foto del ticket/);
  assert.match(html, /Ver ubicación guardada/);
});

// --- handleMovementDetailAttachPhoto ------------------------------------------------------------

function attachPhotoSandbox({ storeAvailable = true, storeFails = false, cloud = false } = {}) {
  const calls = { saveLocalSnapshot: 0, render: 0, statuses: [], storePut: null };
  const receiptAttachments = {};
  const context = sandboxWith(["handleMovementDetailAttachPhoto"], {
    receiptAttachments,
    saveLocalSnapshot: () => { calls.saveLocalSnapshot += 1; },
    renderMovementDetailDialog: () => { calls.render += 1; },
    announceStatus: (message) => calls.statuses.push(message),
    // ARQ-6 (sesión 244): el guardado en sí (local o cifrado en la nube) vive en
    // P2PrivateStore.saveAttachment() — su propia cobertura está en
    // tests/p2-private-store-session-key.test.cjs. Aquí solo importa que
    // handleMovementDetailAttachPhoto enlaza bien el resultado con el movimiento.
    P2PrivateStore: storeAvailable
      ? {
          saveAttachment: (id, file) => {
            calls.storePut = { id, file };
            if (storeFails) return Promise.reject(new Error("fail"));
            return Promise.resolve(cloud
              ? { storage: "cloud", remotePath: `p2/${id}.encrypted`, mimeType: file.type, createdAt: "2026-09-19T00:00:00.000Z" }
              : { storage: "local", mimeType: file.type, createdAt: "2026-09-19T00:00:00.000Z" });
          },
        }
      : undefined,
  });
  return { context, calls, receiptAttachments };
}

test("handleMovementDetailAttachPhoto · sin fichero seleccionado, no hace nada", async () => {
  const { context, calls } = attachPhotoSandbox();
  const event = { target: { files: [], value: "x" } };
  context.handleMovementDetailAttachPhoto(event, ROW);
  await flushMicrotasks();
  assert.equal(calls.storePut, null);
  assert.equal(calls.saveLocalSnapshot, 0);
});

test("handleMovementDetailAttachPhoto · sin P2PrivateStore disponible, avisa en vez de fallar en silencio", async () => {
  const { context, calls } = attachPhotoSandbox({ storeAvailable: false });
  const file = { type: "image/jpeg" };
  const event = { target: { files: [file], value: "x" } };
  context.handleMovementDetailAttachPhoto(event, ROW);
  await flushMicrotasks();
  assert.ok(calls.statuses.some((message) => /no admite guardar adjuntos/.test(message)));
});

test("handleMovementDetailAttachPhoto · con éxito, guarda el fichero cifrado y enlaza el movimiento", async () => {
  const { context, calls, receiptAttachments } = attachPhotoSandbox();
  const file = { type: "image/jpeg" };
  const event = { target: { files: [file], value: "x" } };
  context.handleMovementDetailAttachPhoto(event, ROW);
  await flushMicrotasks();
  assert.equal(event.target.value, "", "el input se limpia de inmediato, no solo tras guardar");
  assert.equal(calls.storePut.file, file);
  assert.match(calls.storePut.id, /^receipt-manual-/);
  const key = `${ROW.date}|${ROW.movement}|${ROW.amount}`;
  assert.equal(receiptAttachments[key].inboxItemId, calls.storePut.id);
  assert.equal(receiptAttachments[key].mimeType, "image/jpeg");
  assert.equal(calls.saveLocalSnapshot, 1);
  assert.equal(calls.render, 1);
  assert.ok(calls.statuses.some((message) => /Foto adjuntada/.test(message)));
});

test("handleMovementDetailAttachPhoto · con clave de sesión activa, enlaza el adjunto como cifrado en la nube", async () => {
  const { context, calls, receiptAttachments } = attachPhotoSandbox({ cloud: true });
  const file = { type: "image/jpeg" };
  const event = { target: { files: [file], value: "x" } };
  context.handleMovementDetailAttachPhoto(event, ROW);
  await flushMicrotasks();
  const key = `${ROW.date}|${ROW.movement}|${ROW.amount}`;
  assert.equal(receiptAttachments[key].storage, "cloud");
  assert.match(receiptAttachments[key].remotePath, /\.encrypted$/);
  assert.ok(calls.statuses.some((message) => /sincronizada con la nube/.test(message)));
});

test("handleMovementDetailAttachPhoto · conserva una ubicación ya guardada al adjuntar la foto (no la pisa)", async () => {
  const { context, receiptAttachments } = attachPhotoSandbox();
  const key = `${ROW.date}|${ROW.movement}|${ROW.amount}`;
  receiptAttachments[key] = { geo: { lat: 1, lon: 2, capturedAt: "2026-09-01T00:00:00.000Z" } };
  const file = { type: "image/png" };
  const event = { target: { files: [file], value: "x" } };
  context.handleMovementDetailAttachPhoto(event, ROW);
  await flushMicrotasks();
  assert.equal(receiptAttachments[key].geo.lat, 1);
  assert.ok(receiptAttachments[key].inboxItemId);
});

test("handleMovementDetailAttachPhoto · si el guardado cifrado falla, avisa en vez de dejarlo en silencio", async () => {
  const { context, calls } = attachPhotoSandbox({ storeFails: true });
  const file = { type: "image/jpeg" };
  const event = { target: { files: [file], value: "x" } };
  context.handleMovementDetailAttachPhoto(event, ROW);
  await flushMicrotasks();
  assert.ok(calls.statuses.some((message) => /No se pudo guardar la foto/.test(message)));
  assert.equal(calls.saveLocalSnapshot, 0);
});

// --- handleMovementDetailSaveGeo -----------------------------------------------------------------

function saveGeoSandbox({ geolocationAvailable = true, position = null, error = null } = {}) {
  const calls = { saveLocalSnapshot: 0, render: 0, statuses: [] };
  const receiptAttachments = {};
  const navigatorMock = geolocationAvailable
    ? {
        geolocation: {
          getCurrentPosition: (onSuccess, onError) => {
            if (error) onError(error);
            else onSuccess(position);
          },
        },
      }
    : {};
  const context = sandboxWith(["handleMovementDetailSaveGeo"], {
    receiptAttachments,
    navigator: navigatorMock,
    saveLocalSnapshot: () => { calls.saveLocalSnapshot += 1; },
    renderMovementDetailDialog: () => { calls.render += 1; },
    announceStatus: (message) => calls.statuses.push(message),
    Date,
  });
  return { context, calls, receiptAttachments };
}

test("handleMovementDetailSaveGeo · sin movimiento, no hace nada", () => {
  const { context, calls } = saveGeoSandbox();
  context.handleMovementDetailSaveGeo(null);
  assert.equal(calls.statuses.length, 0);
});

test("handleMovementDetailSaveGeo · sin geolocalización en el navegador, avisa en vez de fallar en silencio", () => {
  const { context, calls } = saveGeoSandbox({ geolocationAvailable: false });
  context.handleMovementDetailSaveGeo(ROW);
  assert.ok(calls.statuses.some((message) => /no permite compartir ubicación/.test(message)));
});

test("handleMovementDetailSaveGeo · con éxito, redondea a 4 decimales y guarda junto al movimiento", () => {
  const { context, calls, receiptAttachments } = saveGeoSandbox({
    position: { coords: { latitude: 40.41681234, longitude: -3.70379876, accuracy: 12.6 } },
  });
  context.handleMovementDetailSaveGeo(ROW);
  const key = `${ROW.date}|${ROW.movement}|${ROW.amount}`;
  assert.equal(receiptAttachments[key].geo.lat, 40.4168);
  assert.equal(receiptAttachments[key].geo.lon, -3.7038);
  assert.equal(receiptAttachments[key].geo.accuracy, 13);
  assert.ok(receiptAttachments[key].geo.capturedAt);
  assert.equal(calls.saveLocalSnapshot, 1);
  assert.equal(calls.render, 1);
  assert.ok(calls.statuses.some((message) => /Ubicación guardada/.test(message)));
});

test("handleMovementDetailSaveGeo · conserva una foto ya adjunta al guardar la ubicación (no la pisa)", () => {
  const { context, receiptAttachments } = saveGeoSandbox({
    position: { coords: { latitude: 40.4, longitude: -3.7, accuracy: 10 } },
  });
  const key = `${ROW.date}|${ROW.movement}|${ROW.amount}`;
  receiptAttachments[key] = { inboxItemId: "receipt-manual-1", mimeType: "image/jpeg" };
  context.handleMovementDetailSaveGeo(ROW);
  assert.equal(receiptAttachments[key].inboxItemId, "receipt-manual-1");
  assert.ok(receiptAttachments[key].geo);
});

test("handleMovementDetailSaveGeo · con permiso denegado, avisa con el motivo en vez de fallar en silencio", () => {
  const { context, calls } = saveGeoSandbox({ error: { message: "Permiso denegado" } });
  context.handleMovementDetailSaveGeo(ROW);
  assert.ok(calls.statuses.some((message) => /No se pudo obtener la ubicación: Permiso denegado/.test(message)));
  assert.equal(calls.saveLocalSnapshot, 0);
});

// --- wiring ----------------------------------------------------------------------------------

test("wiring: renderMovementDetailDialog pinta movementDetailAttachmentHtml(row) y conecta los dos nuevos controles", () => {
  const body = extractFunction("renderMovementDetailDialog");
  assert.match(body, /movementDetailAttachmentHtml\(row\)/);
  assert.match(body, /qs\("movementDetailAttachPhoto"\)\?\.addEventListener\("change", \(event\) => handleMovementDetailAttachPhoto\(event, row\)\)/);
  assert.match(body, /qs\("movementDetailSaveGeo"\)\?\.addEventListener\("click", \(\) => handleMovementDetailSaveGeo\(row\)\)/);
});
