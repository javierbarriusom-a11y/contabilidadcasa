// XPR-07 · PR-1 «El arreglo más barato para un descubierto»: la tarjeta «Para no bajar del suelo el …» de Plan › Previsión. El cálculo vive
// en canonical-overdraft-fix.js (puro). La trayectoria y el suelo son los de la banda de caja (cash-band-ui.js), que ya se calculan; el gasto
// discrecional, el que el hogar marcó en «Previsión en capas» (WP-35, capas-ui.js); la línea de crédito, la de Ajustes.
// Nace apagada en Funciones en prueba (XGO-03) y, encendida, solo se ve si hay un descubierto previsto en los próximos 30 días. No hace nada:
// enseña la combinación más barata y deja a cada palanca su enlace.
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, escapeHtml, money, state, cashBandLastInput, cashBandLastResult,
// cuadroMandosAllMonths, capasItems, capasLoad, emergencyCreditLimit, emergencyCreditRate…). Sin llamadas al DOM al cargarse: app.js llama a
// `renderDescubierto` después de pintar la banda de caja.

const DESCUBIERTO_MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function descubiertoOn() {
  return globalThis.FinanceFuncionesEnPrueba?.encendida?.("descubierto") === true;
}

function descubiertoFecha(iso) {
  const [, month, day] = String(iso).split("-").map(Number);
  return `${day} de ${DESCUBIERTO_MESES[month - 1]}`;
}

// Lo que el hogar marcó como discrecional (WP-35) y que caería ENTRE HOY Y EL PUNTO MÁS BAJO: solo eso, aplazado, evita bajar del suelo. Cada mes
// cuenta en proporción a sus días dentro de ese tramo (un gasto mensual se reparte por el mes, como el variable en la banda). Las capas
// sugeridas nunca son discrecionales: solo cuenta lo declarado.
function descubiertoDiscrecional(today, until) {
  const layers = globalThis.FinanceCanonicalForecastLayers;
  if (!layers) return null;
  const store = capasLoad();
  const dayOf = (iso) => Number(iso.slice(8, 10));
  let amount = 0;
  const labels = new Map();
  cuadroMandosAllMonths().filter((month) => month.key >= today.slice(0, 7) && month.key <= until.slice(0, 7)).forEach((month) => {
    const reading = layers.buildReading({ monthKey: month.key, partidas: capasItems(month), store, gaps: [] });
    const layer = reading.calculable ? reading.layers.find((item) => item.id === "discrecional") : null;
    if (!layer || layer.amount <= 0) return;
    const [year, number] = month.key.split("-").map(Number);
    const length = new Date(year, number, 0).getDate();
    const from = month.key === today.slice(0, 7) ? dayOf(today) : 1;
    const to = month.key === until.slice(0, 7) ? dayOf(until) : length;
    const share = Math.max(0, to - from + 1) / length;
    amount += layer.amount * share;
    layer.items.forEach((item) => labels.set(item.label, (labels.get(item.label) || 0) + item.amount * share));
  });
  amount = Math.round(amount * 100) / 100;
  return amount > 0 ? { amount, items: [...labels].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, amount: Math.round(value * 100) / 100 })) } : null;
}

function descubiertoParteHtml(part, deficit) {
  if (part.id === "discrecional") {
    const de = part.items?.length ? ` (${part.items.map((item) => item.label).join(", ")})` : "";
    return `aplazar ${escapeHtml(money(part.amount, true))} del gasto que marcasteis como discrecional y que caería antes del ${escapeHtml(descubiertoFecha(deficit.lowestDate))}${escapeHtml(de)}, sin coste`;
  }
  if (part.id === "colchon") {
    return `aceptar bajar ${escapeHtml(money(part.amount, true))} por debajo del suelo: no cuesta nada, pero el colchón queda en ${escapeHtml(money(deficit.floor - part.amount, true))} ese día`;
  }
  return `usar ${escapeHtml(money(part.amount, true))} de la línea de crédito de emergencia (${String(part.ratePct).replace(".", ",")} %): unos ${escapeHtml(money(part.cost, true))} de intereses si se devuelve en ${part.months} meses`;
}

function descubiertoHtml(engine, deficit, solution, missing) {
  const opciones = solution.options.map((option, at) => `<li class="desc-opcion"><strong>${at === 0 ? "La más barata" : `Opción ${at + 1}`} · ${escapeHtml(money(option.cost, true))}</strong>: ${option.parts.map((part) => descubiertoParteHtml(part, deficit)).join("; además, ")}.</li>`).join("");
  const faltan = [
    missing.includes("discrecional") ? `Ningún gasto de aquí al ${escapeHtml(descubiertoFecha(deficit.lowestDate))} está marcado como discrecional: márcalo en «Previsión en capas» (más abajo) y saldrá como palanca sin coste.` : "",
    missing.includes("credito") ? "Sin línea de crédito de emergencia declarada (Ajustes › Reserva): si la tenéis, su coste entraría en la comparación." : "",
  ].filter(Boolean).map((text) => `<p class="e19-kpi-note">${text}</p>`).join("");
  return `<p class="desc-frase">Según el plan, la liquidez baja del suelo (${escapeHtml(money(deficit.floor, true))}) el ${escapeHtml(descubiertoFecha(deficit.date))} y llega a ${escapeHtml(money(deficit.lowest, true))} el ${escapeHtml(descubiertoFecha(deficit.lowestDate))}: <strong>faltan ${escapeHtml(money(deficit.shortfall, true))}</strong>.</p>
    <ol class="desc-opciones">${opciones}</ol>
    ${faltan}
    <p class="e19-kpi-note">Es la trayectoria «según el plan» de la banda de caja: cada cosa en el día que supone el plan. No incluye mover dinero entre vuestras cuentas (la previsión es de la liquidez total) ni aplazar un cargo de tarjeta. La app no hace nada: enseña.</p>`;
}

function renderDescubierto(engine) {
  const card = qs("descubiertoCard");
  if (!card) return;
  const input = typeof cashBandLastInput !== "undefined" ? cashBandLastInput : null;
  const result = typeof cashBandLastResult !== "undefined" ? cashBandLastResult : null;
  const off = () => { card.hidden = true; };
  if (!engine || !descubiertoOn() || !input || !result || result.status !== "ok") return off();
  try {
    const days = result.days.filter((day) => day.date >= input.today);
    const deficit = engine.findDeficit({ days, floor: input.floor });
    if (!deficit) return off();
    const levers = engine.levers({ discretionary: descubiertoDiscrecional(input.today, deficit.lowestDate), cushion: true, creditLine: { limit: emergencyCreditLimit(), ratePct: emergencyCreditRate(), months: 3 } });
    const solution = engine.solve({ shortfall: deficit.shortfall, levers: levers.list });
    qs("descubiertoTitulo").textContent = `Para no bajar del suelo el ${descubiertoFecha(deficit.date)}`;
    qs("descubiertoCuerpo").innerHTML = descubiertoHtml(engine, deficit, solution, levers.missing);
    card.hidden = false;
    globalThis.FinanceMedidor?.anotar("descubierto", "vista"); // XGO-02: un día visto cuenta una vez
  } catch (error) {
    console.error(`renderDescubierto: ${error.message}`);
    off();
  }
}
