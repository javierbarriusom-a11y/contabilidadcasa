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

// «Hecho» (PR-3): una línea por declarante con algo que hacer. Lo marca el hogar y la app no lo comprueba; la fecha es la del día en que se marcó. Con el ejemplo no se muestra.
function fiscalCampaignDoneHtml(action, campaign) {
  if (campaign.example) return "";
  const rows = action.rows.filter((row) => row.actionable);
  if (!rows.length) return "";
  const date = (iso) => String(iso).split("-").reverse().map(Number).join("/");
  const items = rows.map((row) => {
    const data = `data-accion="${escapeHtml(action.id)}" data-declarante="${escapeHtml(row.holderId)}"`;
    return row.done
      ? `<li class="fc-hecho-fila fc-hecho-hecha"><span class="fc-hecho-estado"><span aria-hidden="true">✓ </span><strong>${escapeHtml(row.label)}</strong>: hecho (marcado el ${escapeHtml(date(row.done.at))})</span> <button type="button" class="fc-rellenar" data-fiscal-deshacer ${data} aria-label="Quitar la marca de hecho: ${escapeHtml(row.label)}, ${escapeHtml(action.title)}">Quitar marca</button></li>`
      : `<li class="fc-hecho-fila"><span class="fc-hecho-estado"><strong>${escapeHtml(row.label)}</strong>: pendiente</span> <button type="button" class="e19-btn e19-btn-secondary" data-fiscal-hecho ${data} aria-label="Marcar como hecho: ${escapeHtml(row.label)}, ${escapeHtml(action.title)}">Marcar como hecho</button></li>`;
  }).join("");
  return `<ul class="fc-hecho" aria-label="Estado de esta tarea por declarante">${items}</ul>`;
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
  const missing = action.status === "sin_dato" && action.missing.length ? `<p class="e19-kpi-note fc-falta">Para calcularla necesito: ${escapeHtml(action.missing.join("; "))}. <button type="button" class="fc-rellenar" data-fiscal-abrir>Rellenar mis datos</button></p>` : "";
  const verified = action.verified ? "" : " Parámetros legales pendientes de contrastar con la fuente oficial.";
  return `<li class="fc-accion fc-accion-${escapeHtml(action.status)}">
    <span class="fc-orden" aria-hidden="true">${index + 1}</span>
    <div class="fc-accion-cuerpo">
      <div class="fc-accion-cabecera"><h4>${escapeHtml(action.title)}</h4>${state}</div>
      <p class="fc-accion-etiquetas">${deadline}${!campaign.example && action.doneCount > 0 && action.pendingCount === 0 ? ' <span class="e19-pill">Hecha</span>' : ""}</p>
      ${fiscalCampaignDoneHtml(action, campaign)}
      ${missing}
      <details class="fc-detalle"><summary>Por declarante y fuente</summary>
        <ul class="fc-por-declarante">${holders}</ul>
        <p class="e19-kpi-note">${escapeHtml(action.reference)}${escapeHtml(verified)}</p>
      </details>
    </div>
  </li>`;
}

// Cuántas tareas con fecha límite están marcadas. «Sin tareas» no se pinta como «todo hecho». Con el ejemplo no hay progreso.
function fiscalCampaignProgressHtml(campaign) {
  const progress = campaign.progress;
  if (campaign.example || !progress || progress.total === 0) return "";
  const tasks = (count) => `${count} ${count === 1 ? "tarea" : "tareas"}`;
  const text = progress.allDone
    ? `<strong>Hecho: ${tasks(progress.total)} de ${progress.total}.</strong> Todas marcadas como hechas`
    : `<strong>Hecho: ${progress.done} de ${tasks(progress.total)}.</strong> Quedan ${progress.pending} antes del 31 de diciembre, con ${fiscalCampaignAmount(progress.pendingSavingEur, false)} de ahorro estimado por hacer`;
  return `<p class="fc-progreso" role="status">${text}. Lo marcáis vosotros: la app no comprueba que se hiciera. Si lo hecho cambia vuestras cifras (por ejemplo, lo aportado a pensiones), actualizadlas en «Tus datos fiscales» para que lo que queda esté bien calculado.</p>`;
}

// `engine`: el motor puro; lo pasa app.js (renderActiveSection) al llegar a la pantalla, que es cuando la sección deja de estar oculta.
// `options.forceForm`: repinta también el formulario «Tus datos fiscales» aunque se esté escribiendo (tras guardar o quitar).
function renderFiscalCampaign(engine, options = {}) {
  const card = qs("campanaFiscalCard");
  if (!card || !engine) return;
  const today = isoLocalDate(new Date());
  const exampleHousehold = engine.EXAMPLE_HOUSEHOLD;
  const year = Math.max(exampleHousehold.year, Number(today.slice(0, 4)));
  // PR-2: si el hogar ha tecleado sus datos fiscales (fiscal-datos-ui.js) y son del año de la campaña, la lista se calcula con ellos y desaparecen las marcas de ejemplo;
  // si no hay datos, o son de otro año, sigue el ejemplo (y lo dice).
  const stored = typeof globalThis.fiscalDatosResolve === "function" ? globalThis.fiscalDatosResolve(engine, year) : null;
  const household = stored && stored.status === "real" ? stored.household : exampleHousehold;
  // PR-3: lo marcado «hecho». Con el ejemplo no se marca nada (son cifras de un hogar ficticio) y no se pasa.
  const done = stored && stored.status === "real" && typeof globalThis.fiscalHechoLoad === "function" ? globalThis.fiscalHechoLoad() : null;
  const campaign = engine.buildCampaign({ ...household, year }, { today, done });
  if (!campaign.calculable) {
    card.hidden = true;
    return;
  }
  const example = campaign.example;
  card.hidden = false;
  card.dataset.ejemplo = example ? "true" : "false";
  const stale = stored && stored.status === "stale-year"
    ? `<p class="fc-aviso" role="note"><strong>Tus datos son de ${escapeHtml(String(stored.storedYear || "otro año"))}.</strong> Esta campaña es la de ${campaign.year} y no se usan: revisa cada cifra en «Tus datos fiscales» y guarda.</p>`
    : "";
  const labels = campaign.holders.map((holder) => holder.label).join(" y ");
  const aviso = example
    ? `<p class="fc-aviso" role="note"><strong>Cifras de ejemplo.</strong> Esto muestra cómo quedará tu lista con un hogar ficticio de dos declarantes. Cuando teclees tus datos fiscales (abajo, en «Tus datos fiscales»), este ejemplo se sustituye por tus números y desaparecen las marcas.</p>${stale}`
    : stored && stored.status === "real"
      ? `<p class="fc-aviso fc-aviso-real" role="note"><strong>Con tus datos.</strong> ${campaign.holders.length === 1 ? "Declarante" : "Declarantes"}: ${escapeHtml(labels)}${stored.updatedAt ? `, datos del ${escapeHtml(stored.updatedAt.split("-").reverse().map(Number).join("/"))}` : ""}. Son estimaciones con parámetros legales por contrastar; lo que no has rellenado sale «sin calcular», no como 0 €.</p>`
      : "";
  const parametros = Object.entries({ Pensiones: campaign.parameters.pension, Vivienda: campaign.parameters.housing, Donativos: campaign.parameters.donations, Compensación: campaign.parameters.compensation, Retención: campaign.parameters.withholding })
    .map(([label, row]) => `<li><strong>${escapeHtml(label)}.</strong> ${escapeHtml(row.reference)} <em>${row.verified ? "Contrastado con la fuente oficial." : "Pendiente de contrastar con la fuente oficial."}</em></li>`).join("");
  qs("campanaFiscalCuerpo").innerHTML = `
    ${aviso}
    <p class="fc-cuenta-atras">${escapeHtml(fiscalCampaignCountdown(campaign))}</p>
    <p class="fc-total"><span class="fc-total-cifra">${fiscalCampaignAmount(campaign.totalSavingEur, example)}</span>
      <span class="fc-total-texto">de ahorro estimado en la Renta de ${campaign.rentaYear} si se hacen las ${campaign.calculableCount} acciones con ahorro${campaign.missingCount ? ` · ${campaign.missingCount} sin calcular` : ""}</span></p>
    ${fiscalCampaignProgressHtml(campaign)}
    <ol class="fc-lista">${campaign.actions.map((action, index) => fiscalCampaignActionHtml(action, index, campaign)).join("")}</ol>
    <details class="fc-detalle fc-parametros"><summary>Parámetros que usa el cálculo</summary><ul class="fc-por-declarante">${parametros}</ul></details>
    <p class="e19-kpi-note">${escapeHtml(campaign.warning)} La app nunca ejecuta nada por sí sola: aportar, amortizar, vender o donar lo decides tú.</p>`;
  if (typeof globalThis.renderFiscalDatos === "function") globalThis.renderFiscalDatos(engine, { year: campaign.year, force: Boolean(options.forceForm) });
}
