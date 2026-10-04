(function attachCanonicalPersonalAllowance(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalPersonalAllowance = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalPersonalAllowance() {
  "use strict";

  // WP-24 (HOG-02, docs/PLAN_DESARROLLO_DEFINITIVO.md): asignación personal sin detalle. Cada persona recibe una
  // transferencia al mes a una cuenta propia que la app NO importa: lo que gaste de ahí no se registra ni se
  // clasifica. En el plan es una partida por persona («Asignación personal · Nombre») en Gastos variables.
  //
  // Decisiones del hogar (4/10/2026): (1) se paga por transferencia a una cuenta propia; (2) el dinero SALE del
  // gasto variable: el «Gasto variable estimado» baja lo que sumen las asignaciones de ese mes (venga de la fórmula
  // o de una cifra fijada a mano), así que el gasto total previsto no cambia; (3) una por persona (las dos del hogar).
  //
  // Las partidas tienen un id estable por persona (`personal-allowance-<id>`), no una fila por mes: así el día de
  // la transferencia (WP-08), la regla que casa la transferencia del extracto y los reales valen todos los meses.
  // Se guarda en un almacén local (`personal-allowances`) que viaja con la copia y la nube, como WP-08 y WP-09.

  const STORE_NAME = "personal-allowances";
  const SECTION = "Gastos variables";
  const ID_PREFIX = "personal-allowance-";
  const LABEL_PREFIX = "Asignación personal · ";
  const MAX_NAME = 40;
  const MAX_AMOUNT = 100000;
  const MAX_PEOPLE = 6;
  const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

  function cleanName(value) {
    return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  }

  function slug(value) {
    const text = cleanName(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return text.slice(0, 30) || "persona";
  }

  function validPerson(entry) {
    const amount = Number(entry?.amount);
    const name = cleanName(entry?.name);
    return Boolean(
      entry && /^[a-z0-9-]{1,30}$/.test(String(entry.id || "")) && name && name.length <= MAX_NAME && !/[<>]/.test(name)
      && Number.isFinite(amount) && amount > 0 && amount <= MAX_AMOUNT && MONTH.test(String(entry.from || ""))
      && (!entry.to || (MONTH.test(String(entry.to)) && String(entry.to) >= String(entry.from))),
    );
  }

  // Lo dañado o manipulado se descarta entero (no se «arregla» a medias); ids repetidos: vale el primero.
  function normalizeStore(raw) {
    const list = raw && typeof raw === "object" && Array.isArray(raw.people) ? raw.people : [];
    const seen = new Set();
    const people = [];
    list.forEach((entry) => {
      if (!validPerson(entry) || seen.has(entry.id) || people.length >= MAX_PEOPLE) return;
      seen.add(entry.id);
      people.push({ id: String(entry.id), name: cleanName(entry.name), amount: Math.round(Number(entry.amount) * 100) / 100, from: String(entry.from), to: entry.to ? String(entry.to) : "" });
    });
    return { people };
  }

  /**
   * Alta o cambio de una persona. Devuelve el almacén nuevo o, si algo no vale, los errores por campo (y el almacén
   * sin tocar). El importe llega ya leído (número o null): la app lo lee con el lector de importes de WP-11.
   * @param {any} store
   * @param {{ id?: string, name?: string, amount?: number | null, from?: string, to?: string }} input
   */
  function upsertPerson(store, input) {
    const current = normalizeStore(store);
    const name = cleanName(input.name);
    /** @type {Record<string, string>} */
    const errors = {};
    if (!name) errors.name = "Escribe el nombre.";
    else if (name.length > MAX_NAME) errors.name = `Como mucho ${MAX_NAME} caracteres.`;
    else if (/[<>]/.test(name)) errors.name = "El nombre no puede llevar «<» ni «>».";
    const amount = input.amount === null || input.amount === undefined ? null : Number(input.amount);
    if (amount === null || !Number.isFinite(amount)) errors.amount = "Escribe el importe al mes, como 300 o 1.250,50.";
    else if (amount <= 0) errors.amount = "El importe tiene que ser mayor que cero.";
    else if (amount > MAX_AMOUNT) errors.amount = "Importe fuera de rango.";
    if (!MONTH.test(String(input.from || ""))) errors.from = "Elige el mes de la primera transferencia.";
    else if (input.to && (!MONTH.test(String(input.to)) || String(input.to) < String(input.from))) errors.to = "El último mes no puede ser anterior al primero.";
    const existing = input.id ? current.people.find((person) => person.id === input.id) : null;
    if (input.id && !existing) errors.name = errors.name || "Esa persona ya no está en la lista: recarga la pantalla.";
    if (!existing && current.people.length >= MAX_PEOPLE) errors.name = errors.name || `Como mucho ${MAX_PEOPLE} personas.`;
    if (Object.keys(errors).length) return { store: current, errors, person: null };
    let id = existing?.id || slug(name);
    if (!existing) for (let index = 2; current.people.some((person) => person.id === id); index += 1) id = `${slug(name).slice(0, 27)}-${index}`;
    const person = { id, name, amount: Math.round(amount * 100) / 100, from: String(input.from), to: input.to ? String(input.to) : "" };
    const people = existing ? current.people.map((item) => (item.id === id ? person : item)) : [...current.people, person];
    return { store: { people }, errors: {}, person };
  }

  function removePerson(store, id) {
    return { people: normalizeStore(store).people.filter((person) => person.id !== id) };
  }

  function isActive(person, monthKey) {
    return Boolean(monthKey) && person.from <= monthKey && (!person.to || monthKey <= person.to);
  }

  function rowFor(person, monthKey) {
    return { id: `${ID_PREFIX}${person.id}`, personalAllowance: true, kind: "expense", sectionName: SECTION, label: `${LABEL_PREFIX}${person.name}`, plannedValue: person.amount, monthKey };
  }

  /**
   * Las partidas de un mes. No son `custom` (esas viven una por mes en customPlanningRows): su previsto lo da
   * `amountForMonth`, que la app consulta desde basePlannedValueForRow como el de cualquier otra partida.
   */
  function rowsForMonth(store, { kind, sectionName, monthKey }) {
    if (kind !== "expense" || sectionName !== SECTION) return [];
    return normalizeStore(store).people.filter((person) => isActive(person, monthKey)).map((person) => rowFor(person, monthKey));
  }

  /** Una partida por persona, sin mes: para la lista de partidas a las que se asigna un movimiento. */
  function seriesRows(store, kind) {
    return kind === "expense" ? normalizeStore(store).people.map((person) => rowFor(person, "")) : [];
  }

  /** El previsto de la partida de una persona en un mes: su importe si está activa, 0 si no (o si ya no existe). */
  function amountForMonth(store, rowId, monthKey) {
    const person = normalizeStore(store).people.find((item) => `${ID_PREFIX}${item.id}` === rowId);
    return person && isActive(person, monthKey) ? person.amount : 0;
  }

  /** La suma de las asignaciones activas de un mes (para la tarjeta y las pruebas). */
  function totalForMonth(store, monthKey) {
    return Math.round(normalizeStore(store).people.filter((person) => isActive(person, monthKey)).reduce((sum, person) => sum + person.amount, 0) * 100) / 100;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function summaryText(store) {
    const { people } = normalizeStore(store);
    if (!people.length) return "Asignación personal: sin configurar";
    return `Asignación personal: ${people.map((person) => person.name).join(" y ")}`;
  }

  /**
   * La tarjeta de Plan › Partidas: una ficha por persona y otra vacía para añadir. Cada ficha es un formulario.
   * @param {any} store
   * @param {{ months: Array<{ key: string, label: string }>, defaultFrom?: string, formatAmount?: (value: number) => string, notes?: string[] }} options
   */
  function renderHtml(store, { months, defaultFrom = "", formatAmount = String, notes = [] }) {
    const { people } = normalizeStore(store);
    const monthOptions = (selected, empty) => (empty ? [`<option value="">${empty}</option>`] : [])
      .concat(months.map((month) => `<option value="${escapeHtml(month.key)}"${month.key === selected ? " selected" : ""}>${escapeHtml(month.label)}</option>`)).join("");
    const card = (person, index) => {
      const id = person ? person.id : "nueva";
      const prefix = `asignacion-${index}`;
      return `<form class="asignacion-persona" data-asignacion="${escapeHtml(id)}" novalidate>`
        + `<p class="asignacion-titulo"><strong>${person ? escapeHtml(`${LABEL_PREFIX}${person.name}`) : "Añadir una persona"}</strong></p>`
        + `<div class="asignacion-campos">`
        + `<label for="${prefix}-nombre"><span>Nombre</span><input id="${prefix}-nombre" name="name" type="text" maxlength="${MAX_NAME}" autocomplete="off" value="${person ? escapeHtml(person.name) : ""}" required /></label>`
        + `<label for="${prefix}-importe"><span>Importe al mes</span><input id="${prefix}-importe" name="amount" type="text" inputmode="decimal" autocomplete="off" data-amount-input value="${person ? escapeHtml(formatAmount(person.amount)) : ""}" required /></label>`
        + `<label for="${prefix}-desde"><span>Primera transferencia</span><select id="${prefix}-desde" name="from">${monthOptions(person ? person.from : defaultFrom, "")}</select></label>`
        + `<label for="${prefix}-hasta"><span>Última</span><select id="${prefix}-hasta" name="to">${monthOptions(person ? person.to : "", "Sin fecha de fin")}</select></label>`
        + `</div>`
        + `<p class="e19-kpi-note asignacion-error" id="${prefix}-error" role="alert"></p>`
        + `<div class="asignacion-acciones"><button type="submit" class="secondary-button">${person ? "Guardar cambios" : "Añadir"}</button>`
        + (person ? ` <button type="button" class="ghost-button" data-asignacion-quitar="${escapeHtml(person.id)}">Quitar</button>` : "")
        + `</div></form>`;
    };
    const intro = `<p class="e19-kpi-note">Una transferencia al mes a una cuenta propia de cada persona. Lo que se gaste de esa cuenta no se registra ni se clasifica: la app no la importa. <strong>Sale del gasto variable</strong>: el «Gasto variable estimado» de cada mes baja lo que sumen las asignaciones (también si lo fijaste a mano), así que el gasto total previsto no cambia.</p>`
      + `<p class="e19-kpi-note">Después: indica el día de la transferencia en <strong>Días de cargo</strong> (justo debajo) y, al importar el extracto, asigna la transferencia de cada uno a su partida una vez; la app lo recuerda y pone el real cada mes.</p>`;
    const extra = notes.map((note) => `<p class="e19-kpi-note is-warn">${escapeHtml(note)}</p>`).join("");
    return `${intro}${extra}<div class="asignacion-lista">${people.map((person, index) => card(person, index)).join("")}${people.length < MAX_PEOPLE ? card(null, people.length) : ""}</div><p class="e19-kpi-note" id="asignacionEstado" role="status" aria-live="polite"></p>`;
  }

  return { STORE_NAME, SECTION, ID_PREFIX, LABEL_PREFIX, MAX_PEOPLE, normalizeStore, upsertPerson, removePerson, isActive, rowsForMonth, seriesRows, amountForMonth, totalForMonth, summaryText, renderHtml };
});
