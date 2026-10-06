// Herramientas avanzadas › Fiscal: «Campaña fiscal de fin de año» (WP-23 · FIS-01 + DAC-02 + FIS-02, canonical-year-end-tax.js).
// Script clásico cargado antes de app.js (comparte su ámbito global: qs, money, escapeHtml, isoLocalDate…), fuera de app.js por su techo
// de líneas (ARQ-4). La lógica vive en el motor puro; aquí solo se pinta.
//
// Mientras el hogar no entregue sus datos fiscales (H-03), la lista se calcula con un hogar de EJEMPLO con cifras ficticias y la tarjeta lo
// dice de cuatro maneras que no dependen del color: una etiqueta «Ejemplo», un aviso con texto, el sombreado diagonal de la tarjeta y
// el subrayado punteado de cada cifra (con «cifra de ejemplo» para el lector de pantalla). Cuando haya datos reales, `campaign.example`
// es false y la misma pantalla se pinta sin ninguna de esas marcas.

const FISCAL_CAMPAIGN_MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function fiscalCampaignDate(iso) {
  const [year, month, day] = String(iso).split("-").map(Number);
  return `${day} de ${FISCAL_CAMPAIGN_MONTHS[month - 1]} de ${year}`;
}

// Una cifra en euros; en el ejemplo lleva la marca punteada y el texto para lectores de pantalla.
function fiscalCampaignAmount(value, example) {
  const shown = escapeHtml(money(value));
  return example ? `<span class="fc-cifra fc-cifra-ejemplo">${shown}<span class="sr-only"> (cifra de ejemplo)</span></span>` : `<span class="fc-cifra">${shown}</span>`;
}

function fiscalCampaignCountdown(campaign) {
  if (campaign.phase === "cerrada") return `La campaña de ${campaign.year} terminó el ${fiscalCampaignDate(campaign.deadline)}.`;
  const left = `Quedan ${campaign.daysLeft} ${campaign.daysLeft === 1 ? "día" : "días"} hasta el ${fiscalCampaignDate(campaign.deadline)}`;
  if (campaign.phase === "preparacion") return `La campaña se abre el ${fiscalCampaignDate(campaign.opens)} (en ${campaign.daysToOpen} ${campaign.daysToOpen === 1 ? "día" : "días"}). ${left}.`;
  return `${left}.`;
}

// Qué dice cada acción para cada declarante, en una frase que se entiende sin abrir nada.
function fiscalCampaignHolderLine(action, row, example) {
  const result = row.result;
  const amount = (value) => fiscalCampaignAmount(value, example);
  if (result.status === "sin_dato") return `Falta: ${escapeHtml(result.missing.join("; "))}.`;
  if (result.status === "no_aplica") return escapeHtml(result.reason);
  switch (action.id) {
    case "vivienda":
      return result.full
        ? `Tope de ${amount(result.annualCap)} ya lleno${result.overCap ? `: lo pagado de más (${amount(result.overCap)}) no deduce` : ""}. Amortizar más no ahorra impuestos.`
        : `Has pagado ${amount(result.paidYear)} de ${amount(result.annualCap)}: caben ${amount(result.room)} más. A ${result.ratePct} % ahorra ${amount(result.savingEur)}.`;
    case "pensiones":
      return result.full
        ? `Límite de ${amount(result.limit)} ya cubierto.`
        : `Aportado ${amount(result.contributedYear)} de ${amount(result.limit)}: caben ${amount(result.room)} más. Con tipo marginal del ${result.ratePct} % ahorra ${amount(result.savingEur)} y el coste real es ${amount(result.netCostEur)}.`;
    case "compensacion":
      return `Plusvalía neta de ${amount(result.realizedNet)} y minusvalías latentes de ${amount(result.latentLosses)}: realizar ${amount(result.amount)} ahorra ${amount(result.savingEur)} (a ${result.ratePct} %).`;
    case "donativos":
      return `${amount(result.amount)} donados: los primeros ${amount(result.firstTierAmount)} deducen al ${result.firstTierRatePct} % y el resto al ${result.restRatePct} %. Ahorra ${amount(result.savingEur)}; el coste real es ${amount(result.netCostEur)}.`;
    case "retencion":
      return `Se espera pagar ${amount(result.resultEur)} en junio. Pedir ${String(result.extraPct).replace(".", ",")} puntos más de retención${result.suggestedPct === null ? "" : ` (de ${String(result.currentPct).replace(".", ",")} % a ${String(result.suggestedPct).replace(".", ",")} %)`} lo repartiría en las nóminas de 2027.`;
    default:
      return "";
  }
}

function fiscalCampaignActionHtml(action, index, campaign) {
  const example = campaign.example;
  const state = action.status === "calculable"
    ? (action.hasSaving
      ? `<span class="fc-ahorro">${fiscalCampaignAmount(action.savingEur, example)}<small>${action.partial ? "ahorro parcial" : "ahorro estimado"}</small></span>`
      : `<span class="fc-ahorro">${fiscalCampaignAmount(action.cashEur, example)}<small>de caja en junio</small></span>`)
    : action.status === "sin_dato"
      ? `<span class="fc-ahorro fc-sin-dato"><span>Sin calcular</span><small>falta un dato</small></span>`
      : `<span class="fc-ahorro fc-sin-dato"><span>No aplica</span></span>`;
  const deadline = action.deadline ? `<span class="e19-pill e19-pill-warn">Antes del ${escapeHtml(fiscalCampaignDate(action.deadline).replace(/ de \d{4}$/, ""))}</span>` : `<span class="e19-pill">Sin fecha límite</span>`;
  const holders = action.rows.map((row) => `<li><strong>${escapeHtml(row.label)}.</strong> ${fiscalCampaignHolderLine(action, row, example)}</li>`).join("");
  const missing = action.status === "sin_dato" && action.missing.length ? `<p class="e19-kpi-note fc-falta">Para calcularla necesito: ${escapeHtml(action.missing.join("; "))}.</p>` : "";
  const verified = action.verified ? "" : " Parámetros legales pendientes de contrastar con la fuente oficial.";
  return `<li class="fc-accion fc-accion-${escapeHtml(action.status)}">
    <span class="fc-orden" aria-hidden="true">${index + 1}</span>
    <div class="fc-accion-cuerpo">
      <div class="fc-accion-cabecera"><h4>${escapeHtml(action.title)}</h4>${state}</div>
      <p class="fc-accion-etiquetas">${deadline}</p>
      ${missing}
      <details class="fc-detalle"><summary>Por declarante y fuente</summary>
        <ul class="fc-por-declarante">${holders}</ul>
        <p class="e19-kpi-note">${escapeHtml(action.reference)}${escapeHtml(verified)}</p>
      </details>
    </div>
  </li>`;
}

// `engine`: el motor puro; lo pasa app.js (renderActiveSection) al llegar a la pantalla, que es cuando la sección deja de estar oculta.
function renderFiscalCampaign(engine) {
  const card = qs("campanaFiscalCard");
  if (!card || !engine) return;
  const today = isoLocalDate(new Date());
  const household = engine.EXAMPLE_HOUSEHOLD;
  const campaign = engine.buildCampaign({ ...household, year: Math.max(household.year, Number(today.slice(0, 4))) }, { today });
  if (!campaign.calculable) {
    card.hidden = true;
    return;
  }
  const example = campaign.example;
  card.hidden = false;
  card.dataset.ejemplo = example ? "true" : "false";
  const aviso = example
    ? `<p class="fc-aviso" role="note"><strong>Cifras de ejemplo.</strong> Esto muestra cómo quedará tu lista con un hogar ficticio de dos declarantes. Cuando entregues tus datos fiscales, este ejemplo se sustituye por tus números y desaparecen las marcas.</p>`
    : "";
  const parametros = Object.entries({ Pensiones: campaign.parameters.pension, Vivienda: campaign.parameters.housing, Donativos: campaign.parameters.donations, Compensación: campaign.parameters.compensation, Retención: campaign.parameters.withholding })
    .map(([label, row]) => `<li><strong>${escapeHtml(label)}.</strong> ${escapeHtml(row.reference)} <em>${row.verified ? "Contrastado con la fuente oficial." : "Pendiente de contrastar con la fuente oficial."}</em></li>`).join("");
  qs("campanaFiscalCuerpo").innerHTML = `
    ${aviso}
    <p class="fc-cuenta-atras">${escapeHtml(fiscalCampaignCountdown(campaign))}</p>
    <p class="fc-total"><span class="fc-total-cifra">${fiscalCampaignAmount(campaign.totalSavingEur, example)}</span>
      <span class="fc-total-texto">de ahorro estimado en la Renta de ${campaign.rentaYear} si se hacen las ${campaign.calculableCount} acciones con ahorro${campaign.missingCount ? ` · ${campaign.missingCount} sin calcular` : ""}</span></p>
    <ol class="fc-lista">${campaign.actions.map((action, index) => fiscalCampaignActionHtml(action, index, campaign)).join("")}</ol>
    <details class="fc-detalle fc-parametros"><summary>Parámetros que usa el cálculo</summary><ul class="fc-por-declarante">${parametros}</ul></details>
    <p class="e19-kpi-note">${escapeHtml(campaign.warning)} La app nunca ejecuta nada por sí sola: aportar, amortizar, vender o donar lo decides tú.</p>`;
}
