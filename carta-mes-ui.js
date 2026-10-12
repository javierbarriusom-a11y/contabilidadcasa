// WP-29 (NHG-05, docs/WP29_DISENO.md): la carta del mes en Cierre. El texto lo compone canonical-month-letter.js (plantillas y selectores, sin IA); aquí se leen las cifras que ya
// existen (partidas del mes con su previsto y su real, las fotos del patrimonio de WP-46, las cartas anteriores), se guarda la carta al firmar el cierre (`month-letters`, en la copia) y se
// pinta. NO cambia ningún dato del hogar. Sin red.
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, escapeHtml, storageGet, storageSet, storageKey, queueRemoteSave, announceStatus, formatIsoDate,
// cuadroMandosAllMonths, planMesCollect, actualAwareInfo, registrarMesLongMonth, patrimonioLoad, patrimonioComponents, pendingMonthCloseBalances…). Sin llamadas al DOM ni escuchas al cargarse:
// app.js llama a `recordCartaMes` al firmar un cierre y views/cierre.js a `renderCartaMes` al pintar Cierre.

const CARTA_MES_STORE = "month-letters"; // en la copia (BACKUP_LOCAL_STORES): un arreglo de cartas, la más nueva primero
const CARTA_MES_SHOWN_PREVIOUS = 12;

function cartaMesEngine() {
  return globalThis.FinanceCanonicalMonthLetter;
}

function cartaMesLoad() {
  try {
    return cartaMesEngine().normalizeStore(JSON.parse(storageGet(storageKey(CARTA_MES_STORE), "[]")));
  } catch {
    return [];
  }
}

// Una carta cuyo mes se reabrió para corregirlo deja de valer hasta que se vuelva a firmar: no cuenta para la racha ni se lista como anterior.
function cartaMesSignedLetters() {
  return cartaMesLoad().filter((letter) => typeof isSignedClosedMonthKey !== "function" || isSignedClosedMonthKey(letter.monthKey));
}

function cartaMesSave(letters) {
  storageSet(storageKey(CARTA_MES_STORE), JSON.stringify(letters));
  queueRemoteSave();
}

// Las partidas de un mes con lo previsto y lo que cuenta (el real si lo hay). Una partida cancelada cuenta 0 y está resuelta; una sin real cuenta lo previsto y se dice.
function cartaMesItems(month) {
  const collected = planMesCollect(month);
  const items = [];
  ["income", "expense"].forEach((kind) => {
    collected[kind].forEach((entry) => {
      const cancelled = actualAwareInfo(entry.row, month).status === "cancelled";
      items.push({ id: entry.key, label: entry.label, section: entry.sectionName, kind, planned: Number(entry.planned) || 0, used: cancelled ? 0 : Number(entry.usado) || 0, settled: Boolean(entry.hasActual) || cancelled });
    });
  });
  return items;
}

// El patrimonio neto de este cierre frente al anterior (WP-46). Sin dos fotos completas no hay nada que contar. Antes de firmar no existe la foto de este mes: se calcula con los saldos
// que se guardarían, igual que al firmar.
function cartaMesNetWorth(monthKey, closeBalances) {
  const engine = globalThis.FinanceCanonicalNetWorth;
  if (!engine || typeof patrimonioLoad !== "function" || typeof patrimonioComponents !== "function") return null;
  const store = patrimonioLoad().snapshots;
  let current = store.find((item) => item.monthKey === monthKey) || null;
  if (!current) {
    const cash = closeBalances && Number.isFinite(Number(closeBalances.total)) ? Number(closeBalances.total) : null;
    const built = engine.buildSnapshot({ monthKey, closedAt: "", ...patrimonioComponents(cash) });
    if (built.calculable) current = built.snapshot;
  }
  if (!current || !Number.isFinite(current.net)) return null;
  const earlier = store.filter((item) => item.monthKey < monthKey && Number.isFinite(item.net));
  if (!earlier.length) return null;
  const move = engine.movement(earlier[0], current);
  if (!move.calculable) return null;
  const debtRow = move.rows.find((row) => row.id === "debt");
  return { previousMonthKey: earlier[0].monthKey, net: current.net, delta: move.delta, debtDelta: debtRow ? debtRow.value : null, isMax: current.net >= Math.max(...earlier.map((item) => item.net)), seriesCount: earlier.length + 1 };
}

function cartaMesCompose(monthKey, closeBalances = null) {
  const engine = cartaMesEngine();
  if (!engine) return null;
  const months = cuadroMandosAllMonths();
  const month = months.find((item) => item.key === monthKey);
  if (!month) return null;
  const previousMonth = months.find((item) => item.key === engine.addMonths(monthKey, -1));
  return engine.compose({
    monthKey,
    items: cartaMesItems(month),
    netWorth: cartaMesNetWorth(monthKey, closeBalances),
    previousLetters: cartaMesSignedLetters(),
    previousAdverse: previousMonth ? engine.adverseIds(cartaMesItems(previousMonth)) : {},
  });
}

// Al firmar el cierre (app.js): la carta queda escrita con los datos de ese momento. Devuelve si se guardó.
function recordCartaMes(monthKey, closedAt, closeBalances) {
  try {
    const engine = cartaMesEngine();
    if (!engine) return false;
    const record = engine.toRecord(cartaMesCompose(monthKey, closeBalances), { closedAt });
    if (!record) return false;
    cartaMesSave(engine.upsert(cartaMesLoad(), record));
    return true;
  } catch {
    return false;
  }
}

function cartaMesMetaText(record, mode) {
  if (mode === "firmada") return `Escrita al firmar el cierre, el ${formatIsoDate((record.closedAt || "").slice(0, 10))}, con los datos de entonces.`;
  if (mode === "reconstruida") return "Reconstruida hoy con los datos actuales: este cierre se firmó antes de que existiera la carta, así que no es la de aquel momento.";
  return "Borrador con los datos de hoy. Se escribe y se guarda al firmar el cierre; hasta entonces puede cambiar.";
}

function cartaMesHtml(record, mode, others) {
  const month = registrarMesLongMonth(record.monthKey);
  const previous = others.slice(0, CARTA_MES_SHOWN_PREVIOUS).map((letter) => `<li><strong>${escapeHtml(registrarMesLongMonth(letter.monthKey))}</strong><p>${escapeHtml(letter.text)}</p></li>`).join("");
  return `<h3 class="escenario-motor-panel-title" id="cartaMesTitulo">Carta de ${escapeHtml(month)}${mode === "borrador" ? " · borrador" : ""}</h3>
    <p class="carta-mes-texto" data-carta-mes-texto>${escapeHtml(record.text)}</p>
    <p class="e19-kpi-note">${escapeHtml(cartaMesMetaText(record, mode))} ${record.words} palabras, compuestas con plantillas a partir de las cifras de la app: sin IA, y cada cifra sale de vuestros datos.</p>
    <div class="carta-mes-acciones"><button type="button" class="e19-btn e19-btn-secondary" data-carta-mes-copy>Copiar la carta</button></div>
    ${previous ? `<details class="carta-mes-previas"><summary>Cartas anteriores (${others.length})</summary><ul>${previous}</ul></details>` : ""}`;
}

// Cierre abierto: el borrador con los datos de hoy. Cierre firmado: la carta guardada al firmar; si el cierre es anterior a la carta, una reconstruida (y se dice). No escribe nada.
function renderCartaMes(engine, monthKey, closed) {
  const card = qs("cartaMes");
  if (!card) return;
  if (!engine) { card.hidden = true; return; }
  try {
    const letters = cartaMesSignedLetters();
    let record = closed ? letters.find((item) => item.monthKey === monthKey) || null : null;
    let mode = record ? (record.reconstructed ? "reconstruida" : "firmada") : "";
    if (!record) {
      mode = closed ? "reconstruida" : "borrador";
      record = engine.toRecord(cartaMesCompose(monthKey, closed ? null : (typeof pendingMonthCloseBalances === "function" ? pendingMonthCloseBalances(monthKey) : null)), { reconstructed: closed });
    }
    if (!record) { card.hidden = true; return; }
    card.setAttribute("aria-labelledby", "cartaMesTitulo");
    card.innerHTML = cartaMesHtml(record, mode, letters.filter((item) => item.monthKey !== monthKey));
    card.hidden = false;
    card.querySelector("[data-carta-mes-copy]")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(record.text);
        announceStatus("Carta copiada.");
      } catch {
        announceStatus("No se pudo copiar la carta: selecciona el texto y cópialo a mano.");
      }
    });
  } catch (error) {
    console.error(`renderCartaMes: ${error.message}`);
    card.hidden = true;
  }
}
