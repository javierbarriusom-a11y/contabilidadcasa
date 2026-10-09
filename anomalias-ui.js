// WP-36 (ND-07, docs/WP36_DISENO.md): la tarjeta «Cosas raras en tus movimientos» de Movimientos. El detector vive en
// canonical-statement-anomalies.js (puro); aquí solo se leen los movimientos ya importados (`canonicalLedgerTransactions`), se pinta cada aviso con
// su evidencia y se guardan las respuestas del hogar en el almacén `statement-anomaly-answers`.
// NO actúa: no reclama al banco, no clasifica, no borra ni toca ningún movimiento (A11-4). Tampoco va a la bandeja de Hoy: Hoy sigue congelado
// hasta leer H-02 (docs/ESTADO_TAREAS_Y_FASES.md).
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, money, escapeHtml, storageGet, isoLocalDate, announceStatus…). Sin
// llamadas al DOM ni escuchas al cargarse: app.js llama a `renderAnomalias` al pintar Movimientos, que engancha las escuchas la primera vez.

const ANOMALIAS_STORE = "statement-anomaly-answers"; // en la copia (BACKUP_LOCAL_STORES)
const ANOMALIAS_KIND_LABEL = { devolucion: "Recibo devuelto", duplicado: "Posible duplicado", comision: "Comisión", recurrente: "Sin partida en el plan", atipico: "Importe alto" };
let anomaliasShown = [];
let anomaliasUndo = null; // { before } para «Deshacer» la última respuesta

function anomaliasLoad() {
  let saved = {};
  try { saved = JSON.parse(storageGet(storageKey(ANOMALIAS_STORE), "{}")) || {}; } catch { saved = {}; }
  return globalThis.FinanceCanonicalStatementAnomalies.normalizeAnswers(saved);
}

function anomaliasSave(answers) {
  storageSet(storageKey(ANOMALIAS_STORE), JSON.stringify(answers));
  queueRemoteSave();
}

function anomaliasDate(iso) {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return `${day}/${month}/${year}`;
}

function anomaliasItemHtml(item) {
  const sign = item.amount > 0 ? "+" : "−";
  const answers = [["real", "Es algo real"], ["normal", "Es normal"], ["normalAlways", "Es normal siempre"]];
  return `<li class="ano-aviso" data-anomalia-id="${escapeHtml(item.id)}">
      <p class="ano-cabecera"><span class="ano-tipo">${escapeHtml(ANOMALIAS_KIND_LABEL[item.kind] || item.kind)}</span> <span>${escapeHtml(anomaliasDate(item.date))}</span> <span>${sign}${escapeHtml(money(Math.abs(item.amount), true))}</span> <span>${escapeHtml(item.label)}</span></p>
      <ul class="ano-evidencia">${item.evidence.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
      <div class="ano-respuestas" role="group" aria-label="Respuesta sobre este aviso">
        ${answers.map(([key, label]) => `<button type="button" class="e19-btn e19-btn-secondary" data-anomalia-respuesta="${key}" data-anomalia-ref="${escapeHtml(item.id)}">${label}</button>`).join("")}
      </div>
    </li>`;
}

function anomaliasStatsHtml(stats) {
  if (stats.falsePositiveRate === null) return `<p class="e19-kpi-note ano-medida">Cuántos avisos sobran todavía no se puede medir: hacen falta ${stats.minAnswered} respuestas y llevas ${stats.answered}. El objetivo es que sobren menos del 20 %.</p>`;
  const pct = Math.round(stats.falsePositiveRate * 100);
  return `<p class="e19-kpi-note ano-medida">De ${stats.answered} avisos respondidos, <strong>${stats.normal} eran normales (${pct} %)</strong>. El objetivo es menos del 20 %${stats.falsePositiveRate >= 0.2 ? ": está por encima, el detector necesita afinarse" : ""}.</p>`;
}

function anomaliasBodyHtml(result) {
  if (result.status === "missing") return `<p class="e19-kpi-note">Para mirar el extracto falta ${escapeHtml(result.missing.join(", "))}.</p>`;
  if (result.status === "stale") {
    const since = result.coveredUntil ? `El último movimiento importado es del ${escapeHtml(anomaliasDate(result.coveredUntil))}` : "Todavía no hay movimientos importados";
    return `<p class="e19-kpi-note"><strong>No puedo mirar lo reciente.</strong> ${since}: sin un extracto al día, que no salga nada no significa que todo esté bien. Importa el extracto en <a href="#registrar">Registrar</a>.</p>${anomaliasStatsHtml(result.stats)}`;
  }
  const covered = `Mirado hasta el ${escapeHtml(anomaliasDate(result.coveredUntil))} (últimos 45 días).`;
  if (!result.items.length) {
    return `<p class="e19-kpi-note"><strong>No he marcado nada.</strong> ${covered}${result.suppressed ? ` Dejo ${result.suppressed} ya respondido${result.suppressed === 1 ? "" : "s"}.` : ""}</p>${anomaliasStatsHtml(result.stats)}`;
  }
  const more = result.overflow ? `<p class="e19-kpi-note">Hay ${result.overflow} más. Responde estas y aparecerán las siguientes.</p>` : "";
  return `<p class="e19-kpi-note">${covered} <strong>${result.items.length + result.overflow} ${result.items.length + result.overflow === 1 ? "aviso" : "avisos"}</strong>, de los más graves a los menos.</p><ul class="ano-lista">${result.items.map(anomaliasItemHtml).join("")}</ul>${more}${anomaliasStatsHtml(result.stats)}`;
}

function renderAnomalias(engine) {
  const box = qs("anomaliasCuerpo");
  if (!box || !engine) return;
  attachAnomalias(document); // idempotente: la pantalla se pinta antes de que init() termine y un clic temprano no puede perderse
  try {
    const result = engine.detect({ today: isoLocalDate(new Date()), transactions: canonicalLedgerTransactions(), answers: anomaliasLoad() });
    anomaliasShown = result.items;
    const html = anomaliasBodyHtml(result);
    if (box.__anomaliasHtml !== html) {
      box.innerHTML = html;
      box.__anomaliasHtml = html;
    }
  } catch (error) {
    console.error(`renderAnomalias: ${error.message}`);
  }
}

function anomaliasNote(message, withUndo = false) {
  const note = qs("anomaliasNota");
  if (note) {
    note.textContent = message;
    if (withUndo) {
      note.append(" ");
      const undo = document.createElement("button");
      undo.type = "button";
      undo.className = "link-button ano-deshacer";
      undo.dataset.anomaliaDeshacer = "1";
      undo.textContent = "Deshacer";
      note.append(undo);
    }
  }
  announceStatus(message);
}

function anomaliasAnswer(response, id) {
  const engine = globalThis.FinanceCanonicalStatementAnomalies;
  const item = anomaliasShown.find((candidate) => candidate.id === id);
  if (!item) return;
  anomaliasUndo = { before: anomaliasLoad() };
  anomaliasSave(engine.applyAnswer(anomaliasUndo.before, item, response, isoLocalDate(new Date())));
  renderAnomalias(engine);
  const text = { real: "Anotado como algo real.", normal: "Anotado: era normal.", normalAlways: "Anotado: es normal siempre, no volveré a marcar este patrón." }[response];
  anomaliasNote(text, true);
}

// Una sola vez, por delegación.
function attachAnomalias(doc) {
  if (!doc || doc.__anomaliasAttached) return false;
  doc.__anomaliasAttached = true;
  doc.addEventListener("click", (event) => {
    const answer = event.target?.closest?.("[data-anomalia-respuesta]");
    if (answer) { anomaliasAnswer(answer.dataset.anomaliaRespuesta, answer.dataset.anomaliaRef); return; }
    if (event.target?.closest?.("[data-anomalia-deshacer]") && anomaliasUndo) {
      anomaliasSave(anomaliasUndo.before);
      anomaliasUndo = null;
      renderAnomalias(globalThis.FinanceCanonicalStatementAnomalies);
      anomaliasNote("Respuesta deshecha: el aviso vuelve a aparecer.");
    }
  });
  return true;
}
