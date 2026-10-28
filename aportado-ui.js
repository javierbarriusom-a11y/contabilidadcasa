// WP-18 · PR-1 (NIN-03) «Aportado frente a valor»: la tarjeta de Inversión › Cartera. El cálculo vive en canonical-portfolio-valuation.js
// (puro): de cada 100 € de la cartera, cuántos pusisteis y cuántos el mercado, y la rentabilidad ponderada por tiempo (TWR) sobre la serie
// de valoraciones de la hoja (WP-15), junto a la XIRR de siempre. Las posiciones salen de iv1PositionsList() normalizadas por el motor de
// cartera; las valoraciones, de loadPortfolioValuations() (valoracion-ui.js).
// Nace apagada en Funciones en prueba (XGO-03). No cambia ningún dato y no recomienda comprar ni vender: enseña dos cifras y qué significan.
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, escapeHtml, money, displayShortDate, iv1PositionsList,
// iv2XirrLabel, iv2Pct, loadPortfolioValuations, openValoracionHoja…). Sin llamadas al DOM al cargarse: views/inversion.js llama a `renderAportado`
// al pintar Inversión › Cartera, que engancha la escucha la primera vez.

function aportadoOn() {
  return globalThis.FinanceFuncionesEnPrueba?.encendida?.("aportado") === true;
}

function aportadoPct(value) {
  return `${value > 0 ? "+" : ""}${String(value).replace(".", ",")} %`;
}

function aportadoTwrTexto(twr) {
  if (!twr.calculable) return "";
  const periodo = `del ${displayShortDate(twr.from)} al ${displayShortDate(twr.to)}`;
  return twr.annualizedPct === null ? `${aportadoPct(twr.cumulativePct)} ${periodo}` : `${aportadoPct(twr.annualizedPct)} al año (${aportadoPct(twr.cumulativePct)} ${periodo})`;
}

// La XIRR del motor de cartera sin la etiqueta «XIRR» (la tarjeta ya la nombra); si no se puede calcular, el motivo de siempre.
function aportadoXirrTexto(xirr) {
  if (!xirr || xirr.ratePct === null || xirr.ratePct === undefined) return iv2XirrLabel(xirr);
  return `${iv2Pct(xirr.ratePct, true)} al año`;
}

function aportadoFraseHtml(cv) {
  if (cv.direction === "gana") {
    return `<p class="apv-frase">De cada 100 € de vuestra cartera, <strong>${cv.yoursPer100} los pusisteis vosotros y ${cv.marketPer100} los ganó el mercado</strong>.</p>`;
  }
  return `<p class="apv-frase">Habéis puesto ${escapeHtml(money(cv.cost, true))} y hoy vale ${escapeHtml(money(cv.value, true))}: <strong>el mercado se ha llevado ${escapeHtml(money(-cv.gain, true))}</strong> (${String(cv.lostPct).replace(".", ",")} % de lo puesto).</p>`;
}

function aportadoHtml(engine, positions, summary, store) {
  const cv = engine.contributedVsValue(summary);
  const twr = engine.portfolioTwr(positions, store);
  const twrTexto = aportadoTwrTexto(twr);
  const filas = positions.map((position) => {
    const own = engine.positionTwr(position, store);
    return `<tr><th scope="row">${escapeHtml(position.label)}</th><td class="num">${escapeHtml(money(position.costBasis, true))}</td><td class="num">${escapeHtml(money(position.currentValue, true))}</td><td class="apv-texto">${own.calculable ? escapeHtml(aportadoTwrTexto(own)) : "falta otra valoración con fecha"}</td><td class="apv-texto">${escapeHtml(aportadoXirrTexto(position.xirr))}</td></tr>`;
  }).join("");
  const arrastra = twr.calculable && twr.carried > 0
    ? `<p class="e19-kpi-note">${twr.carried} ${twr.carried === 1 ? "valor cuenta" : "valores cuentan"} con la última valoración de su posición, porque esa posición no se valoró ese día.</p>`
    : "";
  return `${cv.calculable ? aportadoFraseHtml(cv) : ""}
    <p class="e19-kpi-note">Sobre lo que sigue en cartera: lo que os costó frente a lo que vale hoy.</p>
    <dl class="apv-rent">
      <div><dt>Lo que hizo el mercado (TWR)</dt><dd>${twrTexto ? escapeHtml(twrTexto) : "Falta otra valoración con fecha"}</dd></div>
      <div><dt>Lo que ganó vuestro dinero (XIRR)</dt><dd>${escapeHtml(aportadoXirrTexto(summary.xirr))}</dd></div>
    </dl>
    ${twr.calculable ? "" : `<p class="e19-kpi-note">La TWR necesita dos fechas con valor: el alta de una posición y una valoración posterior, o dos valoraciones. <button type="button" class="e19-btn e19-btn-secondary" data-aportado-valorar>Actualizar valoración</button></p>`}
    <p class="e19-kpi-note">La TWR mide solo lo que hizo el mercado con cada euro; la XIRR cuenta también cuándo pusisteis cada uno. ${twr.calculable && twr.annualizedPct === null ? "Con menos de un año de valoraciones, la TWR es la del periodo y la XIRR está pasada a un año: no se comparan directamente." : "Si la XIRR queda por debajo de la TWR, aportasteis más justo antes de las bajadas o menos antes de las subidas."} Entre dos valoraciones, cada aportación o venta cuenta por los días que estuvo invertida: con valoraciones cada mes, la diferencia con la cifra exacta es pequeña.</p>
    ${arrastra}
    <details class="apv-detalle"><summary>Por posición</summary>
      <div class="apv-scroll"><table class="apv-tabla"><thead><tr><th scope="col">Posición</th><th scope="col" class="num">Lo que costó</th><th scope="col" class="num">Valor</th><th scope="col">Mercado (TWR)</th><th scope="col">Vuestro dinero (XIRR)</th></tr></thead><tbody>${filas}</tbody></table></div>
    </details>`;
}

function renderAportado(engine) {
  const card = qs("aportadoCard");
  if (!card) return;
  attachAportado(card);
  const portfolio = globalThis.FinanceCanonicalPortfolio;
  const rows = typeof iv1PositionsList === "function" ? iv1PositionsList() : [];
  if (!engine || !portfolio || !aportadoOn() || !rows.length) {
    card.hidden = true;
    return;
  }
  try {
    const result = portfolio.normalizePositions(rows);
    const store = typeof loadPortfolioValuations === "function" ? loadPortfolioValuations() : null;
    qs("aportadoCuerpo").innerHTML = aportadoHtml(engine, result.positions, result.summary, store);
    card.hidden = false;
    globalThis.FinanceMedidor?.anotar("aportado", "vista"); // XGO-02: un día visto cuenta una vez
  } catch (error) {
    console.error(`renderAportado: ${error.message}`);
    card.hidden = true;
  }
}

function attachAportado(card) {
  if (card.__aportadoAttached) return;
  card.__aportadoAttached = true;
  card.addEventListener("click", (event) => {
    if (!event.target.closest("[data-aportado-valorar]")) return;
    globalThis.FinanceMedidor?.anotar("aportado", "accion"); // XGO-02: ir a dar el dato que falta
    if (typeof openValoracionHoja === "function") openValoracionHoja();
  });
}
