const controls = [
  "initialCash",
  "recommendedSavings",
  "annualInflation",
  "annualIncomeGrowth",
  "emergencyBufferMonths",
];

const derivedControlIds = [
  "startingAccountBalance",
  "monthlyIncome",
  "coreSpend",
  "carPayment",
  "remainingHighRefiPayments",
  "refiFirstPayment",
  "refiLaterPayment",
];

const MODEL_END_YEAR = 2036;
const MODEL_END_MONTH = 11;

const euro = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const euroPrecise = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

let baseData;
let packagedFinanceData;
let state;
let lastSimulation = [];
let lastBaseSimulation = [];
let lastPlannedSimulation = [];
let currentScenario = "Base";
let projects = [];
let debtLiquidations = [];
let decisionEvents = [];
let projectPlan = { outflows: [], placements: [] };
let incomeActuals = {};
let expenseActuals = {};
let balanceSettings = {};
let scenarioSettings = {};
let customPlanningRows = [];
let deletedPlanningRows = {};
let seriesOverrides = {};
let rowLabelOverrides = {};
let movementMappings = {};
let pendingMovementMappings = [];
let editingProjectId = null;
let memoryStorage = {};
let supabaseClient = null;
let remoteUser = null;
let remoteSaveTimer = null;
let remoteSaveInFlight = false;
let selectedCashflowIndex = null;
let expandedCashflowYears = new Set();
let expandedVisualSections = new Set();
let expandedVisualYears = new Set();
let visualDraftCells = {};
let visualDraftLabels = {};
let visualDraftDeletes = {};
let visualDraftProjectDeletes = {};
let visualSelectedRows = new Set();
let pendingDebtDecision = null;
let pendingProjectDecision = null;
let agentDebtOptimizationCache = { key: "", value: null };
let executiveAdvisorRenderTimer = null;
let selectorSignature = "";
let visualMonthSelectorSignature = "";
let visualAddSectionSignature = "";
let visualBulkEditorSignature = "";
let dataEntryMonthSignature = "";
let seriesEditorSignature = "";
let simulationSignature = "";
let renderFrame = 0;
let expandedPlanningSections = {
  income: new Set(),
  expense: new Set(),
};

const WORKBOOK_OVERRIDE_KEY = "financeDashboard:workbookOverride:v1";
const REMOTE_SOURCE_KEY = "finance-dashboard-main";
const AGENT_ROUTE_SIMULATION_TAG = "agent-optimal-debt-route";

const DEBT_PORTFOLIO = [
  { entity: "Cetelem", type: "Crédito", number: "40037624105825", initialPrincipal: 1547.08, originalPayment: 262.34, currentPayment: 259, reunified: true, amortized: 0, currentPrincipal: 0, maturity: "", remainingInstallments: 130 },
  { entity: "Cetelem", type: "Crédito", number: "40037624105827", initialPrincipal: 3559.33, originalPayment: 212.03, currentPayment: 259, reunified: true, amortized: 0, currentPrincipal: 0, maturity: "", remainingInstallments: 130 },
  { entity: "Cetelem", type: "Tarjeta", number: "5100341635315001", initialPrincipal: 7508, originalPayment: 256.98, currentPayment: 259, reunified: true, amortized: 0, currentPrincipal: 0, maturity: "", remainingInstallments: 130 },
  { entity: "Cetelem", type: "Tarjeta", number: "5100341647655006", initialPrincipal: 8000, originalPayment: 289.62, currentPayment: 259, reunified: true, amortized: 0, currentPrincipal: 0, maturity: "", remainingInstallments: 130 },
  { entity: "Wizink", type: "Tarjeta", number: "5267 5209 1552 8008", initialPrincipal: 7381.63, originalPayment: 191.72, currentPayment: 0, reunified: false, amortized: 0, currentPrincipal: 7381.63, maturity: "", remainingInstallments: 0 },
  { entity: "Wizink", type: "Tarjeta", number: "5489 1808 1365 8688", initialPrincipal: 3117.23, originalPayment: 114.37, currentPayment: 0, reunified: false, amortized: 1300, currentPrincipal: 0, maturity: "", remainingInstallments: 0 },
  { entity: "Bankintercard", type: "Crédito", number: "0128/9830/051.1130377", initialPrincipal: 14975.01, originalPayment: 426.49, currentPayment: 0, reunified: false, amortized: 0, currentPrincipal: 14975.01, maturity: "19/8/29", remainingInstallments: 46 },
  { entity: "Bankintercard", type: "Tarjeta", number: "4966630612068823", initialPrincipal: 6477.07, originalPayment: 508.2, currentPayment: 0, reunified: false, amortized: 0, currentPrincipal: 6477.07, maturity: "", remainingInstallments: 15 },
  { entity: "Mediamarkt", type: "Tarjeta", number: "4010 2111 8083 0013", initialPrincipal: 1376.71, originalPayment: 115, currentPayment: 0, reunified: false, amortized: 0, currentPrincipal: 1376.71, maturity: "", remainingInstallments: 15 },
  { entity: "Ikea", type: "Tarjeta", number: "4552 4698 2929 5014", initialPrincipal: 2594.88, originalPayment: 120, currentPayment: 0, reunified: false, amortized: 0, currentPrincipal: 2594.88, maturity: "", remainingInstallments: 15 },
  { entity: "Caixabank PC", type: "Crédito", number: "8197109", initialPrincipal: 464.62, originalPayment: 86.41, currentPayment: 0, reunified: false, amortized: 0, currentPrincipal: 464.62, maturity: "30/7/26", remainingInstallments: 6 },
  { entity: "Caixabank PC", type: "Crédito", number: "40354", initialPrincipal: 2195.07, originalPayment: 167.68, currentPayment: 0, reunified: false, amortized: 0, currentPrincipal: 2195.07, maturity: "30/3/27", remainingInstallments: 14 },
  { entity: "Caixabank PC", type: "Crédito", number: "40353", initialPrincipal: 491.6, originalPayment: 159.72, currentPayment: 0, reunified: false, amortized: 0, currentPrincipal: 491.6, maturity: "30/4/26", remainingInstallments: 3 },
].map((item, index) => ({ ...item, id: `debt-${index + 1}` }));

const CURRENT_REUNIFIED_DEBT_PAYMENT = 259;
const CURRENT_REUNIFIED_DEBT_INSTALLMENTS = 130;
const CURRENT_REUNIFIED_DEBT_COST = CURRENT_REUNIFIED_DEBT_PAYMENT * CURRENT_REUNIFIED_DEBT_INSTALLMENTS;
const DEBT_LIQUIDATION_ASSUMPTIONS = {
  baseStartingLiquidity: 13464.57,
  targetReserve: 4000,
  monthlyFundTarget: 2000,
  monthlyReserveTarget: 800,
  demandAmount: 12000,
  demandMonth: "2027-02",
  cirbe: {
    december2025: { total: 177910, overdue: 0, interest: 0, available: 79320 },
    may2026: { total: 152401, overdue: 10205, interest: 1253, available: 76271 },
  },
  asnef: [
    { entity: "CaixaBank Payments", amount: 4397.67, rows: 5 },
    { entity: "Bankinter Consumer", amount: 5036.72, rows: 2 },
    { entity: "Wizink", amount: 1343.29, rows: 1 },
  ],
  settlements: [
    { id: "caixa", wave: "g1", entity: "CaixaBank Payments", principal: 13411, discount: 0.35, source: "CIRBE mayo 2026" },
    { id: "carrefour", wave: "g1", entity: "Carrefour", principal: 5774, discount: 0.40, source: "CIRBE mayo 2026" },
    { id: "retail", wave: "g1", entity: "MediaMarkt + IKEA", principal: 3971.59, discount: 0.30, source: "Portfolio app" },
    { id: "bankinter-credit", wave: "g2", entity: "Bankinter credito", principal: 16070, discount: 0.33, source: "CIRBE mayo 2026" },
    { id: "bankinter-card", wave: "g2", entity: "Bankinter tarjeta", principal: 7613, discount: 0.40, source: "CIRBE mayo 2026" },
    { id: "bankinter-other", wave: "g2", entity: "Bankinter resto", principal: 2006, discount: 0.30, source: "ASNEF/CIRBE" },
  ],
  wizink: {
    principal: 8393,
    discount: 0.30,
    months: 96,
    apr: 0,
  },
};
const VARIABLE_OPERATIONAL_SECTION = "Gastos variables";
const VARIABLE_OPERATIONAL_ROW_ID = "variable-operational-spend";
const VARIABLE_OPERATIONAL_ROW_LABEL = "Gasto variable estimado";
const VARIABLE_OPERATIONAL_MIGRATION_KEY = "migration:variable-operational-1750-from-2026-06-v2";
const VARIABLE_OPERATIONAL_MAY_ZERO_KEY = "migration:variable-operational-may-2026-zero-v1";
const VARIABLE_OPERATIONAL_MIGRATION_START = "2026-06";
const VARIABLE_OPERATIONAL_MIGRATION_VALUE = 1750;
const VARIABLE_OPERATIONAL_FORMULA_TARGET = 1750;
const VARIABLE_FORMULA_FINANCING_EXCLUSIONS = [
  "caixabank|mastercard tere",
  "caixabank|visa go tere",
  "caixabank|visa go javi",
  "caixabank|mycard tere",
  "caixabank|mycard javi",
  "bankintercard|tarjeta tere",
  "bankintercard|prestamo tere",
  "otros|prestamo cetelem tere",
];
const FINANCING_SUBGROUP_LABELS = [
  "ECI",
  "Pass Carrefour Tere",
  "Pass Carrefour Javi",
  "Caixabank",
  "Bankintercard",
  "Otros",
];
const FINANCING_ROW_TEMPLATES = [
  { row: 61, group: "ECI", label: "Tarjeta ECI" },
  { row: 62, group: "ECI", label: "Anticipo ECI" },
  { row: 64, group: "Pass Carrefour Tere", label: "Mastercard contado" },
  { row: 65, group: "Pass Carrefour Tere", label: "Mastercard credito" },
  { row: 66, group: "Pass Carrefour Tere", label: "Financiacion express 1" },
  { row: 67, group: "Pass Carrefour Tere", label: "Financiacion express 2" },
  { row: 68, group: "Pass Carrefour Tere", label: "Financiacion express 3" },
  { row: 69, group: "Pass Carrefour Tere", label: "Financiacion express 4" },
  { row: 70, group: "Pass Carrefour Tere", label: "Financiacion express 5" },
  { row: 71, group: "Pass Carrefour Tere", label: "Financiacion express 6" },
  { row: 73, group: "Pass Carrefour Javi", label: "Pass Javi Credito" },
  { row: 74, group: "Pass Carrefour Javi", label: "Mastercard contado" },
  { row: 75, group: "Pass Carrefour Javi", label: "Mastecard credito" },
  { row: 76, group: "Pass Carrefour Javi", label: "Financiacion express 1" },
  { row: 78, group: "Caixabank", label: "MasterCard Tere" },
  { row: 79, group: "Caixabank", label: "Visa Go Tere" },
  { row: 80, group: "Caixabank", label: "Visa Go Javi" },
  { row: 81, group: "Caixabank", label: "Mycard Tere" },
  { row: 82, group: "Caixabank", label: "Mycard Javi" },
  { row: 84, group: "Bankintercard", label: "Tarjeta Tere" },
  { row: 85, group: "Bankintercard", label: "Prestamo Tere" },
  { row: 87, group: "Otros", label: "Prestamo cetelem Tere" },
  { row: 88, group: "Otros", label: "Refinanciacion Cetelem" },
  { row: 89, group: "Otros", label: "Mastercard PDH" },
];
const USER_REMOVED_FINANCING_KEYS = new Set([
  financingTemplateKey("Pass Carrefour Tere", "Financiacion express 5"),
  financingTemplateKey("Pass Carrefour Javi", "Financiacion express 1"),
]);

const viewTitles = {
  home: {
    eyebrow: "Inicio",
    title: "Control diario de caja, deuda y decisiones",
  },
  "executive-advisor": {
    eyebrow: "Asesor ejecutivo",
    title: "Qué hacer ahora con caja, deuda y coche",
  },
  "visual-detail": {
    eyebrow: "Cuadro de mandos",
    title: "Planifica liquidez, ahorro y refinanciación desde la fecha de análisis",
  },
  "debt-liquidation-plan": {
    eyebrow: "Plan deuda óptimo",
    title: "Prioriza quitas, CIRBE, ASNEF y colchón de caja",
  },
  "savings-agent": {
    eyebrow: "Agente ahorro",
    title: "Automatiza traspasos, huchas y decisiones de deuda",
  },
  "virtual-advisor": {
    eyebrow: "Asesor virtual",
    title: "Prioriza decisiones con una lectura accionable del plan",
  },
  "debt-control": {
    eyebrow: "Control de deuda",
    title: "Compara la deuda anterior con el plan actual y simula liquidaciones",
  },
  prevision: {
    eyebrow: "Previsión",
    title: "Resultados mensuales previstos, reales y ajustados",
  },
  simulator: {
    eyebrow: "Escenarios y proyectos",
    title: "Decide proyectos, imprevistos y ahorro con impacto completo",
  },
  forecast: {
    eyebrow: "Proyección",
    title: "Visualiza la evolución de liquidez hasta 2036",
  },
  "savings-plan": {
    eyebrow: "Plan ahorro",
    title: "Seguimiento de colchón, ahorro objetivo y semáforo de control",
  },
  "data-entry": {
    eyebrow: "Carga de datos",
    title: "Añade datos manuales, por lotes o desde Excel",
  },
  cashflow: {
    eyebrow: "Flujo mensual",
    title: "Audita cada mes con detalle de ingresos, gastos y proyectos",
  },
  movements: {
    eyebrow: "Base del modelo",
    title: "Revisa los movimientos usados para construir el escenario",
  },
};

function qs(id) {
  return document.getElementById(id);
}

function money(value, precise = false) {
  return (precise ? euroPrecise : euro).format(value || 0);
}

function monthLabel(date) {
  return date.toLocaleDateString("es-ES", { month: "short", year: "2-digit" });
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function dateFromMonthKey(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function monthEndDate(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function lastBusinessDayOfMonth(date) {
  const result = monthEndDate(date);
  while (result.getDay() === 0 || result.getDay() === 6) result.setDate(result.getDate() - 1);
  return result;
}

function dateInMonth(date, day) {
  const cappedDay = Math.min(Math.max(1, Number(day) || 1), monthEndDate(date).getDate());
  return new Date(date.getFullYear(), date.getMonth(), cappedDay);
}

function shortDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" }).replace(/\./g, "");
}

function dateWithMonthLabel(date, day) {
  return shortDate(dateInMonth(date, day));
}

function defaultBalanceDate() {
  return (
    baseData?.metadata?.generatedAt?.slice(0, 10) ||
    baseData?.sourceBalances?.valuationDate ||
    baseData?.metadata?.forecastStart?.slice(0, 10) ||
    new Date().toISOString().slice(0, 10)
  );
}

function baseModelStartDate() {
  const firstPlanningMonth = baseData.monthlyPlanning?.months?.[0]?.key;
  return firstPlanningMonth ? dateFromMonthKey(firstPlanningMonth) : new Date(baseData.metadata.forecastStart);
}

function modelStartIndex() {
  const months = baseData.monthlyPlanning?.months || [];
  if (!months.length) return 0;
  const key = monthKey(state?.balanceDate ? new Date(state.balanceDate) : new Date(defaultBalanceDate()));
  const exactIndex = months.findIndex((month) => month.key === key);
  if (exactIndex >= 0) return exactIndex;
  const first = dateFromMonthKey(months[0].key);
  const target = dateFromMonthKey(key);
  const roughIndex = (target.getFullYear() - first.getFullYear()) * 12 + target.getMonth() - first.getMonth();
  return Math.min(Math.max(0, roughIndex), Math.max(0, months.length - 1));
}

function modelStartDate() {
  const months = baseData.monthlyPlanning?.months || [];
  const startIndex = modelStartIndex();
  return months[startIndex]?.key ? dateFromMonthKey(months[startIndex].key) : addMonths(baseModelStartDate(), startIndex);
}

function modelEndDate() {
  return new Date(MODEL_END_YEAR, MODEL_END_MONTH, 1);
}

function monthSpanInclusive(start, end) {
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
}

function modelMonthCount() {
  return Math.max(1, monthSpanInclusive(modelStartDate(), modelEndDate()));
}

function chartTickIndexes(rows) {
  const ticks = [0, 11, 23, 35, 47];
  const last = rows.length - 1;
  if (!ticks.includes(last)) ticks.push(last);
  return ticks.filter((idx) => rows[idx]);
}

function averageRows(rows, getValue) {
  return rows.length ? rows.reduce((sum, row) => sum + getValue(row), 0) / rows.length : 0;
}

function sumRows(rows, getValue) {
  return rows.reduce((sum, row) => sum + getValue(row), 0);
}

function baseAccountBalances() {
  const source = baseData?.sourceBalances || {};
  const mediolanum = round2(source.mediolanumBalance ?? baseData?.assumptions?.newAccountBalance ?? 0);
  const total = round2(source.totalBalance ?? baseData?.assumptions?.initialCash ?? 0);
  const caixa = round2(source.caixaBalance ?? total - mediolanum);
  return { caixa, mediolanum, total: round2(caixa + mediolanum) };
}

function isActiveInMonth(monthStart, endDate) {
  if (!endDate) return true;
  const end = new Date(endDate);
  return monthStart <= new Date(end.getFullYear(), end.getMonth(), 1);
}

function storageKey(name) {
  const source = baseData?.metadata?.sourceWorkbook || "finance";
  return `${name}:${source}`;
}

function storageGet(key, fallback = "") {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return memoryStorage[key] ?? fallback;
  }
}

function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    memoryStorage[key] = value;
  }
}

function cloneFinanceData(data) {
  if (!data) return null;
  return JSON.parse(JSON.stringify(data));
}

function loadWorkbookOverride() {
  const stored = storageGet(WORKBOOK_OVERRIDE_KEY, "");
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    if (parsed?.metadata && parsed?.monthlyPlanning) {
      baseData = parsed;
      ensureCompleteFinancingSection();
      repairFinancingSectionFromReference();
      ensureVariableOperationalSection();
    }
  } catch {
    storageSet(WORKBOOK_OVERRIDE_KEY, "");
  }
}

function saveWorkbookOverride() {
  if (!baseData?.metadata || !baseData?.monthlyPlanning) return;
  storageSet(WORKBOOK_OVERRIDE_KEY, JSON.stringify(baseData));
}

function sourceStateKey() {
  return REMOTE_SOURCE_KEY;
}

function appStatePayload() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    sourceWorkbook: sourceStateKey(),
    workbookData: baseData?.metadata?.sourceWorkbookStatus === "Leído desde la app" ? baseData : null,
    projects,
    debtLiquidations,
    decisionEvents,
    savingsPlan: scenarioSettings.savingsPlan || {},
    incomeActuals,
    expenseActuals,
    balanceSettings,
    scenarioSettings,
    customPlanningRows,
    deletedPlanningRows,
    seriesOverrides,
    rowLabelOverrides,
    movementMappings,
  };
}

function applyPersistedPayload(payload = {}) {
  selectorSignature = "";
  visualMonthSelectorSignature = "";
  visualAddSectionSignature = "";
  visualBulkEditorSignature = "";
  dataEntryMonthSignature = "";
  seriesEditorSignature = "";
  simulationSignature = "";
  if (payload.workbookData?.metadata && payload.workbookData?.monthlyPlanning) {
    baseData = payload.workbookData;
    ensureCompleteFinancingSection();
    repairFinancingSectionFromReference();
    ensureVariableOperationalSection();
    saveWorkbookOverride();
  }
  projects = Array.isArray(payload.projects) ? payload.projects : [];
  debtLiquidations = Array.isArray(payload.debtLiquidations) ? payload.debtLiquidations : [];
  decisionEvents = Array.isArray(payload.decisionEvents) ? payload.decisionEvents : [];
  incomeActuals = payload.incomeActuals && typeof payload.incomeActuals === "object" ? payload.incomeActuals : {};
  expenseActuals = payload.expenseActuals && typeof payload.expenseActuals === "object" ? payload.expenseActuals : {};
  balanceSettings = payload.balanceSettings && typeof payload.balanceSettings === "object" ? payload.balanceSettings : {};
  scenarioSettings = payload.scenarioSettings && typeof payload.scenarioSettings === "object" ? payload.scenarioSettings : {};
  customPlanningRows = Array.isArray(payload.customPlanningRows) ? payload.customPlanningRows : [];
  deletedPlanningRows =
    payload.deletedPlanningRows && typeof payload.deletedPlanningRows === "object" ? payload.deletedPlanningRows : {};
  seriesOverrides = payload.seriesOverrides && typeof payload.seriesOverrides === "object" ? payload.seriesOverrides : {};
  rowLabelOverrides = payload.rowLabelOverrides && typeof payload.rowLabelOverrides === "object" ? payload.rowLabelOverrides : {};
  movementMappings = payload.movementMappings && typeof payload.movementMappings === "object" ? payload.movementMappings : {};
  currentScenario = scenarioSettings.currentScenario || "Base";
  normalizeLoadedProjects();
}

function saveLocalSnapshot() {
  storageSet(storageKey("projects"), JSON.stringify(projects));
  storageSet(storageKey("debtLiquidations"), JSON.stringify(debtLiquidations));
  storageSet(storageKey("decisionEvents"), JSON.stringify(decisionEvents));
  storageSet(storageKey("incomeActuals"), JSON.stringify(incomeActuals));
  storageSet(storageKey("expenseActuals"), JSON.stringify(expenseActuals));
  storageSet(storageKey("balanceSettings"), JSON.stringify(balanceSettings));
  storageSet(storageKey("scenarioSettings"), JSON.stringify(scenarioSettings));
  storageSet(storageKey("customPlanningRows"), JSON.stringify(customPlanningRows));
  storageSet(storageKey("deletedPlanningRows"), JSON.stringify(deletedPlanningRows));
  storageSet(storageKey("seriesOverrides"), JSON.stringify(seriesOverrides));
  storageSet(storageKey("rowLabelOverrides"), JSON.stringify(rowLabelOverrides));
  storageSet(storageKey("movementMappings"), JSON.stringify(movementMappings));
}

function queueRemoteSave() {
  if (!remoteUser || !supabaseClient) return;
  window.clearTimeout(remoteSaveTimer);
  remoteSaveTimer = window.setTimeout(() => {
    saveRemoteState();
  }, 650);
}

function loadLocalState() {
  try {
    applyPersistedPayload({
      projects: JSON.parse(storageGet(storageKey("projects"), "[]")),
      debtLiquidations: JSON.parse(storageGet(storageKey("debtLiquidations"), "[]")),
      decisionEvents: JSON.parse(storageGet(storageKey("decisionEvents"), "[]")),
      incomeActuals: JSON.parse(storageGet(storageKey("incomeActuals"), "{}")),
      expenseActuals: JSON.parse(storageGet(storageKey("expenseActuals"), "{}")),
      balanceSettings: JSON.parse(storageGet(storageKey("balanceSettings"), "{}")),
      scenarioSettings: JSON.parse(storageGet(storageKey("scenarioSettings"), "{}")),
      customPlanningRows: JSON.parse(storageGet(storageKey("customPlanningRows"), "[]")),
      deletedPlanningRows: JSON.parse(storageGet(storageKey("deletedPlanningRows"), "{}")),
      seriesOverrides: JSON.parse(storageGet(storageKey("seriesOverrides"), "{}")),
      rowLabelOverrides: JSON.parse(storageGet(storageKey("rowLabelOverrides"), "{}")),
      movementMappings: JSON.parse(storageGet(storageKey("movementMappings"), "{}")),
    });
  } catch {
    projects = [];
    debtLiquidations = [];
    decisionEvents = [];
    incomeActuals = {};
    expenseActuals = {};
    balanceSettings = {};
    scenarioSettings = {};
    customPlanningRows = [];
    deletedPlanningRows = {};
    seriesOverrides = {};
    rowLabelOverrides = {};
    movementMappings = {};
  }
}

function normalizeLoadedProjects() {
  const months = forecastMonths();
  let changed = false;
  const normalizeItem = (project) => {
    const next = { ...project };
    next.amount = round2(Number(next.amount || 0));
    next.duration = Math.max(1, Number(next.duration || 1));
    next.recurringAmount = round2(Number(next.recurringAmount || 0));
    next.recurringDuration = Math.max(0, Number(next.recurringDuration || 0));
    next.recurringStartOffset = Math.max(0, Number(next.recurringStartOffset || 0));
    next.locked = Boolean(next.locked);
    if (!next.locked) delete next.lockedAt;
    if (project.mode !== "fixed" && project.mode !== "spread") return next;
    if (next.monthKey) {
      const indexFromKey = months.findIndex((month) => month.key === next.monthKey);
      if (indexFromKey >= 0 && Number(next.monthIndex) !== indexFromKey) {
        next.monthIndex = indexFromKey;
        changed = true;
      }
      return next;
    }

    const legacyIndex = Number(next.monthIndex || 0);
    const shiftedIndex = Math.min(Math.max(legacyIndex + 1, 0), months.length - 1);
    next.monthIndex = shiftedIndex;
    next.monthKey = months[shiftedIndex]?.key;
    changed = true;
    return next;
  };
  projects = projects.map(normalizeItem);
  debtLiquidations = debtLiquidations.map((item) => {
    const next = { ...item };
    if (next.mode === "optimize") {
      const index = Math.min(Math.max(Number(next.monthIndex || 0), 0), months.length - 1);
      next.mode = "fixed";
      next.monthKey = next.monthKey || months[index]?.key;
      changed = true;
    }
    if (isAgentRouteSimulationDecision(next) && next.payoffMode === "optimize") {
      next.payoffMode = "fixed";
      changed = true;
    }
    return normalizeItem(next);
  });
  if (changed) {
    saveProjects();
    saveDebtLiquidations();
  }
}

function saveProjects() {
  storageSet(storageKey("projects"), JSON.stringify(projects));
  queueRemoteSave();
}

function saveDebtLiquidations() {
  storageSet(storageKey("debtLiquidations"), JSON.stringify(debtLiquidations));
  queueRemoteSave();
}

function saveDecisionEvents() {
  decisionEvents = decisionEvents.slice(0, 120);
  storageSet(storageKey("decisionEvents"), JSON.stringify(decisionEvents));
  queueRemoteSave();
}

function recordDecisionEvent(status, item, note = "") {
  if (!item) return;
  const source = item.source === "debt" || item.targetId ? "debt" : "project";
  decisionEvents.unshift({
    id: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date: new Date().toISOString(),
    source,
    itemId: item.id || item.targetId || "",
    name: item.name || item.label || item.entity || "Decisión",
    status,
    owner: item.creditOwner || item.owner || inferDecisionOwner(item),
    amount: decisionGrossCost(item),
    creditCapital: decisionCreditCapital(item),
    monthLabel: item.monthLabel || forecastMonths()[item.monthIndex || 0]?.label || "",
    note,
  });
  saveDecisionEvents();
}

function decisionLockedBadge(item) {
  return item?.locked ? '<span class="decision-lock-badge">Fijo en plan</span>' : "";
}

function setDecisionLocked(source, id, locked) {
  const stamp = locked ? new Date().toISOString() : null;
  let changedItem = null;
  if (source === "debt") {
    debtLiquidations = debtLiquidations.map((item) =>
      item.id === id
        ? {
            ...item,
            locked: Boolean(locked),
            lockedAt: stamp || undefined,
          }
        : item,
    );
    changedItem = debtLiquidations.find((item) => item.id === id);
    saveDebtLiquidations();
  } else {
    projects = projects.map((item) =>
      item.id === id
        ? {
            ...item,
            locked: Boolean(locked),
            lockedAt: stamp || undefined,
          }
        : item,
    );
    changedItem = projects.find((item) => item.id === id);
    saveProjects();
  }
  if (changedItem) {
    recordDecisionEvent(
      locked ? "fijo en plan" : "devuelto a simulación",
      { ...changedItem, source },
      locked ? "La decisión queda bloqueada en el plan." : "La decisión vuelve a estar editable.",
    );
  }
  render();
}

function returnDecisionToSimulator(source, id) {
  const normalizedSource = source === "debt" ? "debt" : "project";
  setDecisionLocked(normalizedSource, id, false);
  if (qs("visualAddFeedback")) {
    qs("visualAddFeedback").textContent =
      "Decisión devuelta al simulador. Ya puedes modificarla, quitarla o volver a fijarla cuando estés seguro.";
    qs("visualAddFeedback").className = "inline-feedback success";
  }
}

function saveIncomeActuals() {
  storageSet(storageKey("incomeActuals"), JSON.stringify(incomeActuals));
  queueRemoteSave();
}

function saveExpenseActuals() {
  storageSet(storageKey("expenseActuals"), JSON.stringify(expenseActuals));
  queueRemoteSave();
}

function saveCustomPlanningRows() {
  storageSet(storageKey("customPlanningRows"), JSON.stringify(customPlanningRows));
  queueRemoteSave();
}

function saveDeletedPlanningRows() {
  storageSet(storageKey("deletedPlanningRows"), JSON.stringify(deletedPlanningRows));
  queueRemoteSave();
}

function saveSeriesOverrides() {
  storageSet(storageKey("seriesOverrides"), JSON.stringify(seriesOverrides));
  queueRemoteSave();
}

function saveRowLabelOverrides() {
  storageSet(storageKey("rowLabelOverrides"), JSON.stringify(rowLabelOverrides));
  queueRemoteSave();
}

function saveMovementMappings() {
  storageSet(storageKey("movementMappings"), JSON.stringify(movementMappings));
  queueRemoteSave();
}

function saveScenarioSettings() {
  if (!state) return;
  const next = {
    currentScenario,
    recommendedSavings: state.recommendedSavings,
    annualInflation: state.annualInflation,
    annualIncomeGrowth: state.annualIncomeGrowth,
    emergencyBufferMonths: state.emergencyBufferMonths,
    autoCapSavings: state.autoCapSavings,
    incomeFactor: state.incomeFactor,
    expenseFactor: state.expenseFactor,
    savingsPlan: scenarioSettings.savingsPlan || {},
    savingsAgent: scenarioSettings.savingsAgent || {},
    executiveAdvisor: scenarioSettings.executiveAdvisor || {},
    migrations: scenarioSettings.migrations || {},
  };
  const serialized = JSON.stringify(next);
  scenarioSettings = next;
  if (serialized === storageGet(storageKey("scenarioSettings"), "")) return;
  storageSet(storageKey("scenarioSettings"), serialized);
  queueRemoteSave();
}

function saveBalanceSettings() {
  if (!baseData) return;
  const previous = JSON.stringify(balanceSettings);
  const next = {
    balanceDate: state?.balanceDate || defaultBalanceDate(),
    balanceMode: state?.balanceMode || "auto",
    manualInitialCash:
      state?.balanceMode === "manual" ? state.initialCash : (balanceSettings.manualInitialCash ?? state?.initialCash),
    manualCaixaBalance:
      state?.balanceMode === "manual" ? state.caixaBalance : (balanceSettings.manualCaixaBalance ?? state?.caixaBalance),
    manualMediolanumBalance:
      state?.balanceMode === "manual"
        ? state.mediolanumBalance
        : (balanceSettings.manualMediolanumBalance ?? state?.mediolanumBalance),
  };
  const serialized = JSON.stringify(next);
  balanceSettings = next;
  if (serialized === previous) return;
  storageSet(storageKey("balanceSettings"), serialized);
  queueRemoteSave();
}

function supabaseConfig() {
  return window.SUPABASE_CONFIG || {};
}

function isSupabaseConfigured() {
  const config = supabaseConfig();
  return Boolean(
    window.supabase &&
      config.url &&
      config.anonKey &&
      !config.url.includes("TU_PROYECTO") &&
      !config.anonKey.includes("TU_SUPABASE"),
  );
}

function updateSyncUi(message, tone = "local") {
  const badge = qs("syncBadge");
  const status = qs("syncStatus");
  if (!badge || !status) return;
  badge.classList.toggle("sync-cloud", tone === "cloud");
  badge.classList.toggle("sync-warn", tone === "warn");
  badge.textContent = tone === "cloud" ? "Nube" : tone === "warn" ? "Aviso" : "Local";
  status.textContent = message;
}

function syncErrorMessage(error) {
  const message = error?.message || String(error || "");
  const normalized = message.toLowerCase();
  if (normalized.includes("email not confirmed")) {
    return "Email pendiente de confirmar. Revisa Gmail y Spam, o pulsa Reenviar email.";
  }
  if (normalized.includes("invalid login credentials")) {
    return "Email o contraseña incorrectos.";
  }
  if (normalized.includes("user already registered") || normalized.includes("already registered")) {
    return "Este email ya tiene cuenta. Usa Entrar o reenvía el email de confirmación.";
  }
  if (normalized.includes("password")) {
    return "Revisa la contraseña. Supabase suele exigir al menos 6 caracteres.";
  }
  return message;
}

function renderSyncPanel() {
  const form = qs("syncForm");
  const session = qs("syncSession");
  const user = qs("syncUser");
  if (!form || !session || !user) return;

  if (!isSupabaseConfigured()) {
    form.hidden = true;
    session.hidden = true;
    updateSyncUi("Configura Supabase para sincronizar entre ordenadores.", "warn");
    return;
  }

  form.hidden = Boolean(remoteUser);
  session.hidden = !remoteUser;
  user.textContent = remoteUser?.email || "";
  updateSyncUi(
    remoteUser ? "Cambios sincronizados con Supabase." : "Entra para guardar cambios en la nube.",
    remoteUser ? "cloud" : "local",
  );
}

function viewFromHash() {
  const id = (window.location.hash || "#home").replace("#", "");
  if (id === "overview") return "home";
  if (id === "monthly-detail") return "prevision";
  return document.getElementById(id)?.classList.contains("view-section") ? id : "home";
}

function setActiveView(viewId = viewFromHash()) {
  document.querySelectorAll(".view-section").forEach((section) => {
    section.hidden = section.id !== viewId;
  });
  document.querySelectorAll(".side-nav a").forEach((link) => {
    const isActive = link.getAttribute("href") === `#${viewId}`;
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  const copy = viewTitles[viewId] || viewTitles["visual-detail"];
  if (qs("viewEyebrow")) qs("viewEyebrow").textContent = copy.eyebrow;
  if (qs("viewTitle")) qs("viewTitle").textContent = copy.title;
  renderActiveSection(viewId);
  window.scrollTo({ top: 0, behavior: "instant" });
}

function setupViewNavigation() {
  document.querySelectorAll(".side-nav a").forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href?.startsWith("#")) return;
      const viewId = href.slice(1);
      if (!document.getElementById(viewId)?.classList.contains("view-section")) return;
      event.preventDefault();
      history.pushState(null, "", href);
      setActiveView(viewId);
    });
  });
  window.addEventListener("hashchange", () => setActiveView());
  window.addEventListener("popstate", () => setActiveView());
  setActiveView();
}

function updateSourceNote() {
  const sourceNote = qs("sourceNote");
  if (!sourceNote || !baseData?.metadata) return;
  const sourceFile = (baseData.metadata.sourceWorkbook || "").split("/").pop() || "Excel financiero";
  sourceNote.textContent =
    `Fuente: ${sourceFile}. Lee Plan_Ahorro_821, Contabilidad New Life, Importe devolucion recibos y movimientos de cuenta.`;
}

function initSupabaseClient() {
  if (supabaseClient || !isSupabaseConfigured()) return supabaseClient;
  const config = supabaseConfig();
  supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return supabaseClient;
}

function refreshFromPersistedState() {
  updateSourceNote();
  writeControls({ ...baseData.assumptions, ...scenarioSettings, autoCapSavings: scenarioSettings.autoCapSavings ?? true });
  qs("scenarioName").textContent = currentScenario;
  document.querySelectorAll(".scenario-buttons button").forEach((button) => {
    const label = button.textContent.trim();
    button.classList.toggle("active", label === currentScenario);
  });
  render();
}

async function loadRemoteState() {
  if (!supabaseClient || !remoteUser) return;
  updateSyncUi("Cargando datos guardados en Supabase...", "cloud");
  const { data, error } = await supabaseClient
    .from("finance_dashboard_states")
    .select("state, updated_at")
    .eq("source_key", sourceStateKey())
    .maybeSingle();

  if (error) {
    updateSyncUi(`No se pudo cargar Supabase: ${error.message}`, "warn");
    return;
  }

  if (data?.state) {
    applyPersistedPayload(data.state);
    ensureCompleteFinancingSection();
    repairFinancingSectionFromReference();
    ensureVariableOperationalSection();
    applyVariableOperationalMigration();
    saveLocalSnapshot();
    refreshFromPersistedState();
    updateSyncUi(`Sincronizado. Último cambio: ${new Date(data.updated_at).toLocaleString("es-ES")}.`, "cloud");
    return;
  }

  await saveRemoteState(true);
}

async function saveRemoteState(force = false) {
  if (!supabaseClient || !remoteUser || remoteSaveInFlight) return;
  remoteSaveInFlight = true;
  if (!force) updateSyncUi("Guardando cambios en Supabase...", "cloud");
  const { error } = await supabaseClient.from("finance_dashboard_states").upsert(
    {
      user_id: remoteUser.id,
      source_key: sourceStateKey(),
      state: appStatePayload(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,source_key" },
  );
  remoteSaveInFlight = false;
  updateSyncUi(error ? `No se pudo guardar: ${error.message}` : "Cambios sincronizados con Supabase.", error ? "warn" : "cloud");
}

async function handleSyncAuth(mode) {
  if (!supabaseClient) return;
  const email = qs("syncEmail").value.trim();
  const password = qs("syncPassword").value;
  if (!email || !password) {
    updateSyncUi("Introduce email y contraseña.", "warn");
    return;
  }
  updateSyncUi(mode === "signup" ? "Creando cuenta..." : "Entrando...", "cloud");
  const result =
    mode === "signup"
      ? await supabaseClient.auth.signUp({ email, password })
      : await supabaseClient.auth.signInWithPassword({ email, password });
  if (result.error) {
    updateSyncUi(syncErrorMessage(result.error), "warn");
    return;
  }
  remoteUser = result.data.user || result.data.session?.user || null;
  if (remoteUser) {
    qs("syncPassword").value = "";
    renderSyncPanel();
    await loadRemoteState();
  } else {
    updateSyncUi("Cuenta creada. Revisa el email si Supabase pide confirmación.", "warn");
  }
}

async function handleResendConfirmation() {
  if (!supabaseClient) return;
  const email = qs("syncEmail").value.trim();
  if (!email) {
    updateSyncUi("Introduce tu email para reenviar la confirmación.", "warn");
    qs("syncEmail").focus();
    return;
  }
  updateSyncUi("Reenviando email de confirmación...", "cloud");
  const { error } = await supabaseClient.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: window.location.href.split("#")[0],
    },
  });
  updateSyncUi(
    error ? syncErrorMessage(error) : "Email reenviado. Revisa Gmail, Spam o Promociones y confirma la cuenta.",
    error ? "warn" : "cloud",
  );
}

async function handleSyncLogout() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  remoteUser = null;
  renderSyncPanel();
}

async function setupSupabaseSync() {
  initSupabaseClient();
  renderSyncPanel();
  if (!supabaseClient) return;

  const { data } = await supabaseClient.auth.getSession();
  remoteUser = data.session?.user || null;
  renderSyncPanel();
  if (remoteUser) await loadRemoteState();

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    remoteUser = session?.user || null;
    renderSyncPanel();
    if (remoteUser) await loadRemoteState();
  });
}

function actualAwareValue(row, month) {
  return actualAwareInfo(row, month).value;
}

function actualsForKind(kind) {
  return kind === "income" ? incomeActuals : expenseActuals;
}

function saveActualsForKind(kind) {
  return kind === "income" ? saveIncomeActuals : saveExpenseActuals;
}

function actualKeyForRow(row, month) {
  return `${row.id}|${month.key}`;
}

function deleteKeyForRow(row, month) {
  return `${row.kind}|${row.id}|${month.key}`;
}

function seriesKeyForRow(row) {
  return `${row.kind}|${row.id}`;
}

function seriesDeletionKeyForRow(row, sectionName = "") {
  return `series-delete|${row.kind || ""}|${normalizedText(sectionName || row.sectionName || "")}|${normalizedText(displayLabelForRow(row))}`;
}

function isPlanningRowSeriesDeleted(row, sectionName = "") {
  return Boolean(deletedPlanningRows[seriesDeletionKeyForRow(row, sectionName)]);
}

function isPlanningRowDeleted(row, month, sectionName = "") {
  return (
    Boolean(deletedPlanningRows[deleteKeyForRow(row, month)]) ||
    isPlanningRowSeriesDeleted(row, sectionName) ||
    Boolean(seriesOverrideForRow(row, month)?.deleted)
  );
}

function displayLabelForRow(row) {
  return rowLabelOverrides[seriesKeyForRow(row)] || row.label || "Concepto";
}

function overrideKeyForRow(row, month) {
  return `${seriesKeyForRow(row)}|${month.key}`;
}

function seriesOverrideForRow(row, month) {
  return seriesOverrides[overrideKeyForRow(row, month)] || null;
}

function plannedValueForRow(row, month) {
  if (isVariableOperationalRow(row)) {
    const override = seriesOverrideForRow(row, month);
    if (override?.deleted) return 0;
    if (override?.planned !== undefined && override?.planned !== "") return Number(override.planned || 0);
    return variableOperationalFormulaValue(month);
  }
  return plannedValueForRowRaw(row, month);
}

function plannedValueForRowRaw(row, month) {
  const override = seriesOverrideForRow(row, month);
  if (override?.deleted) return 0;
  if (override?.planned !== undefined && override?.planned !== "") return Number(override.planned || 0);
  const debtProjection = adjustedDebtPlannedValue(row, month);
  if (debtProjection !== null) return debtProjection;
  return basePlannedValueForRow(row, month);
}

function sourcePlannedValueForRow(row, month) {
  const override = seriesOverrideForRow(row, month);
  if (override?.deleted) return 0;
  if (override?.planned !== undefined && override?.planned !== "") return Number(override.planned || 0);
  return basePlannedValueForRow(row, month);
}

function basePlannedValueForRow(row, month) {
  if (row.custom) return Number(row.plannedValue || 0);
  const sourceMonth = sourcePlanningMonthForMonth(month);
  return Number(row.planned[sourceMonth.index] || 0);
}

function sourcePlanningMonthForMonth(month) {
  const planning = baseData.monthlyPlanning;
  if (!planning?.months?.length || !month?.key) return month || { index: 0, key: "", label: "" };
  const exactIndex = planning.months.findIndex((item) => item.key === month.key);
  if (exactIndex >= 0) return { ...planning.months[exactIndex], index: exactIndex, key: month.key, label: month.label || planning.months[exactIndex].label };
  const monthNumber = month.key.slice(5, 7);
  for (let index = planning.months.length - 1; index >= 0; index -= 1) {
    if (planning.months[index].key.slice(5, 7) === monthNumber) {
      return { ...planning.months[index], index, key: month.key, label: month.label || monthLabel(dateFromMonthKey(month.key)) };
    }
  }
  const fallbackIndex = Math.min(Math.max(0, Number(month.index || 0)), planning.months.length - 1);
  return { ...planning.months[fallbackIndex], index: fallbackIndex, key: month.key, label: month.label || planning.months[fallbackIndex].label };
}

function adjustedDebtPlannedValue(row, month) {
  if (row.custom || row.kind !== "expense") return null;
  if (!month?.key || month.key < "2026-05") return null;
  const label = normalizedText(displayLabelForRow(row));
  if (label.includes("refinanciacion cetelem")) return CURRENT_REUNIFIED_DEBT_PAYMENT;
  return null;
}

function actualAwareInfo(row, month) {
  const actuals = actualsForKind(row.kind);
  const key = actualKeyForRow(row, month);
  const override = seriesOverrideForRow(row, month);
  if (override?.deleted) {
    return {
      planned: 0,
      actual: null,
      hasActual: false,
      value: 0,
      source: "Eliminado",
    };
  }
  const stored = actuals[key];
  const planned = plannedValueForRow(row, month);
  const hasOverrideActual = override?.actual !== undefined && override?.actual !== "";
  const hasActual = hasOverrideActual || (stored !== undefined && stored !== "");
  const actual = hasOverrideActual ? Number(override.actual) : hasActual ? Number(stored) : null;
  return {
    planned,
    actual,
    hasActual,
    value: hasActual ? actual : planned,
    source: hasActual ? "Real" : "Previsto",
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const compact = raw
    .replace(/\s/g, "")
    .replace(/€/g, "")
    .replace(/[^\d,.-]/g, "");
  const hasComma = compact.includes(",");
  const hasDot = compact.includes(".");
  const cleaned =
    hasComma && hasDot
      ? compact.replace(/\./g, "").replace(",", ".")
      : hasComma
        ? compact.replace(",", ".")
        : compact;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function amountInputValue(value) {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(value);
  return Number.isFinite(number) ? round2(number).toFixed(2) : "";
}

function monthFromInput(value) {
  const raw = String(value ?? "").trim();
  const months = selectableMonths();
  if (!raw) return null;
  const withOriginalIndex = (month, fallbackIndex) => ({
    ...month,
    index: Number.isFinite(Number(month?.index)) ? Number(month.index) : fallbackIndex,
  });
  const normalized = normalizedText(raw).replace(/\./g, "");
  const keyMatch = normalized.match(/^(\d{4})[-/](\d{1,2})$/);
  if (keyMatch) {
    const key = `${keyMatch[1]}-${String(Number(keyMatch[2])).padStart(2, "0")}`;
    const index = months.findIndex((month) => month.key === key);
    return index >= 0 ? withOriginalIndex(months[index], index) : null;
  }
  const dateMatch = normalized.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dateMatch) {
    const year = Number(dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]);
    const key = `${year}-${String(Number(dateMatch[2])).padStart(2, "0")}`;
    const index = months.findIndex((month) => month.key === key);
    return index >= 0 ? withOriginalIndex(months[index], index) : null;
  }
  const index = months.findIndex((month) => normalizedText(month.label).replace(/\./g, "") === normalized);
  return index >= 0 ? withOriginalIndex(months[index], index) : null;
}

function normalizeDataKind(value) {
  const text = normalizedText(value);
  if (text.includes("proy") || text.includes("imprev")) return "project";
  if (text.includes("deud") || text.includes("debt") || text.includes("liquid") || text.includes("amort") || text.includes("refin") || text.includes("payoff")) return "debt";
  if (text.includes("ing")) return "income";
  return "expense";
}

function canonicalHeader(value) {
  const text = normalizedText(value).replace(/[^a-z0-9]/g, "");
  const aliases = {
    tipo: "kind",
    clase: "kind",
    mes: "month",
    fecha: "month",
    bloque: "sectionName",
    partida: "sectionName",
    categoria: "sectionName",
    seccion: "sectionName",
    concepto: "label",
    descripcion: "label",
    nombre: "label",
    previsto: "planned",
    presupuesto: "planned",
    real: "actual",
    importe: "actual",
    cantidad: "actual",
    duracion: "duration",
    meses: "duration",
    modo: "mode",
    planificacion: "mode",
  };
  return aliases[text] || text;
}

function normalizeProjectMode(value) {
  const text = normalizedText(value);
  return text.includes("opt") ? "optimize" : "fixed";
}

function normalizeDebtPayoffMode(value, duration = 1) {
  const text = normalizedText(value);
  if (text.includes("retomar")) return "retomar";
  if (text.includes("refinanc") || text.includes("reunific")) return "refinance";
  if (text.includes("fraccion") || text.includes("repart") || text.includes("varios") || text.includes("mensual") || Number(duration) > 1) return "spread";
  return "fixed";
}

function workbookSheet(workbook, candidates) {
  const names = workbook.SheetNames || [];
  return names.find((name) => candidates.some((candidate) => normalizedText(name) === normalizedText(candidate))) || null;
}

function cellValue(sheet, address, fallback = null) {
  const cell = sheet?.[address];
  return cell ? (cell.v ?? fallback) : fallback;
}

function numberCell(sheet, address, fallback = 0) {
  const value = cellValue(sheet, address, fallback);
  const number = parseAmount(value);
  return number ?? fallback;
}

function dateCell(sheet, address) {
  return isoFromWorkbookValue(cellValue(sheet, address));
}

function isoFromWorkbookValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && window.XLSX?.SSF?.parse_date_code) {
    const parsed = window.XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const raw = String(value).trim();
  const spanishDate = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (spanishDate) {
    const year = spanishDate[3].length === 2 ? `20${spanishDate[3]}` : spanishDate[3];
    return `${year}-${String(Number(spanishDate[2])).padStart(2, "0")}-${String(Number(spanishDate[1])).padStart(2, "0")}`;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? raw : date.toISOString().slice(0, 10);
}

function monthKeyFromWorkbookValue(value) {
  const iso = isoFromWorkbookValue(value);
  return iso?.match(/^\d{4}-\d{2}/)?.[0] || null;
}

function cellByIndex(sheet, rowIndex, colIndex) {
  return sheet?.[window.XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })]?.v;
}

function loadMonthlyPlanningFromWorkbook(workbook) {
  const sheetName = workbookSheet(workbook, ["Contabilidad New Life", "Contabilidad New Life (2)"]);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("No encuentro la pestaña Contabilidad New Life.");
  const range = window.XLSX.utils.decode_range(sheet["!ref"]);
  const months = [];
  const columns = [];

  for (let col = 2; col <= range.e.c; col += 1) {
    const key = monthKeyFromWorkbookValue(cellByIndex(sheet, 4, col));
    if (!key) continue;
    months.push({ key, label: monthLabel(dateFromMonthKey(key)) });
    columns.push(col);
  }

  const sectionDefs = [
    ["Ingresos", "INGRESOS", "income"],
    ["Gastos fijos", "GASTOS FIJOS", "expense"],
    ["Suscripciones", "SUSCRIPCIONES", "expense"],
    ["Financiaciones", "FINANCIACIONES", "expense"],
    ["Imprevistos / otros", "IMPREVISTOS", "expense"],
  ];

  const sections = sectionDefs
    .map(([sectionName, marker, kind]) => {
      let startRow = -1;
      let endRow = -1;
      for (let row = 0; row <= range.e.r; row += 1) {
        const label = cellByIndex(sheet, row, 1);
        if (typeof label === "string" && label.toUpperCase().includes(marker)) {
          startRow = row + 1;
          break;
        }
      }
      if (startRow < 0) return null;
      for (let row = startRow; row <= range.e.r; row += 1) {
        const label = cellByIndex(sheet, row, 1);
        if (typeof label === "string" && label.trim().toUpperCase() === "TOTAL") {
          endRow = row - 1;
          break;
        }
      }
      if (endRow < startRow) return null;
      const totalRow = endRow + 1;
      const financingSubgroups = new Set(FINANCING_SUBGROUP_LABELS.map((item) => normalizedText(item)));
      const rows = [];
      let currentGroup = "";
      for (let row = startRow; row <= endRow; row += 1) {
        const label = cellByIndex(sheet, row, 1);
        if (label === null || label === undefined || label === "") continue;
        const labelText = String(label).trim().replace(/\s+/g, " ");
        const planned = columns.map((col) => Math.abs(parseAmount(cellByIndex(sheet, row, col)) ?? 0));
        const hasValue = planned.some(Boolean);
        if (sectionName === "Financiaciones" && financingSubgroups.has(normalizedText(labelText)) && !hasValue) {
          currentGroup = labelText;
          continue;
        }
        if (!hasValue && sectionName !== "Financiaciones") continue;
        const displayLabel = sectionName === "Financiaciones" && currentGroup ? `${currentGroup} · ${labelText}` : labelText;
        rows.push({
          id: `${sectionName.toLowerCase().replaceAll(" ", "-")}-${row + 1}`,
          label: displayLabel,
          row: row + 1,
          kind,
          group: currentGroup || null,
          planned,
        });
      }
      if (!rows.length) return null;
      return {
        name: sectionName,
        kind,
        rows,
        totals: columns.map((col, index) => {
          const totalValue = parseAmount(cellByIndex(sheet, totalRow, col));
          return round2(totalValue !== null ? Math.abs(totalValue) : rows.reduce((sum, row) => sum + Number(row.planned[index] || 0), 0));
        }),
      };
    })
    .filter(Boolean);

  return { months, sections };
}

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function classifyTransaction(row) {
  const text = `${row.movement || ""} ${row.details || ""}`.toUpperCase();
  const amount = Number(row.amount || 0);
  const hasAny = (needles) => needles.some((needle) => text.includes(needle));
  if (amount > 0) {
    if (text.includes("NOMINA")) return "Ingresos nomina";
    if (text.includes("JESUS SANTOS")) return "Ingreso recurrente 800";
    if (hasAny(["DEVOLUCION", "DEVOLUCIONES", "TARJ.FINANC.RECIBO", "LIQUID.VISA", "BANKINTER CONS", "WIZINK", "BANCO CETELEM", "ABON.TARJ.CREDITO"])) return "Devoluciones/creditos";
    return "Otros ingresos";
  }
  if (hasAny(["PZ FINANZ", "JAVIER BARRIUSO M"])) return "Refinanciacion";
  if (text.includes("BMW BANK")) return "Coche";
  if (hasAny(["RECIBO ENTIDAD DE FINANCIACION", "RECIBO ENTIDAD DE FINANCIACIÓN", "FINANCIE", "FIN.EL CORTE", "ECITC", "ECIVP", "CRD010", "BANKINTER CONS", "LIQUID.VISA ORO", "WIZINK", "CAIXABANK PAYM", "PRS304", "VISA GO", "MYCARD", "LC ASSET"])) return "Creditos antiguos";
  if (text.includes("MASTER BASICA")) return "Tarjeta Mastercard";
  if (hasAny(["TELEFONICA", "REPSOL ELECT", "ENDESA", "IBERDROLA", "CANAL DE ISAB", "AGUA", "SUMINIST"])) return "Suministros y telecom";
  if (hasAny(["CP LA FRONTERA", "FINCAS", "ALQUILER", "TRASTERO"])) return "Vivienda/comunidad";
  if (text.includes("REINT.CAJERO")) return "Efectivo";
  if (text.includes("TRASPASO")) return "Traspasos/ahorro";
  if (hasAny(["GENERALI", "PROSEGUR", "SEG.", "SEGURO"])) return "Seguros";
  if (hasAny(["SUPERMERC", "MERCADONA", "CARREFOUR", "LIDL", "ALCAMPO", "CONSUM"])) return "Alimentacion";
  return "Otros gastos";
}

function isMasterBasicaTransaction(row) {
  return normalizedText(`${row?.movement || ""} ${row?.details || ""}`).includes("master basica");
}

function isVariableOperationalTransaction(row) {
  if (!row || Number(row.amount || 0) >= 0 || isMasterBasicaTransaction(row)) return false;
  const blockedCategories = new Set([
    "Creditos antiguos",
    "Refinanciacion",
    "Coche",
    "Suministros y telecom",
    "Vivienda/comunidad",
    "Seguros",
    "Traspasos/ahorro",
    "Devoluciones/creditos",
    "Tarjeta Mastercard",
  ]);
  if (blockedCategories.has(row.category)) return false;
  return ["Alimentacion", "Efectivo", "Otros gastos"].includes(row.category);
}

let variableOperationalSpendCacheKey = "";
let variableOperationalSpendCache = null;

function variableOperationalSpendModel() {
  const transactions = baseData?.transactions || [];
  const key = `${transactions.length}|${transactions[0]?.date || ""}|${transactions.at(-1)?.date || ""}`;
  if (variableOperationalSpendCacheKey === key && variableOperationalSpendCache) return variableOperationalSpendCache;

  const candidateMonths = [
    ...new Set(transactions.filter((row) => row.month >= "2026-01").map((row) => row.month)),
  ].sort();
  const visibleMonths = candidateMonths.slice(-6);
  const monthTotals = new Map(visibleMonths.map((month) => [month, 0]));

  transactions
    .filter((row) => visibleMonths.includes(row.month) && isVariableOperationalTransaction(row))
    .forEach((row) => {
      monthTotals.set(row.month, round2((monthTotals.get(row.month) || 0) + Math.abs(Number(row.amount || 0))));
    });

  const values = [...monthTotals.values()];
  const average = values.length ? round2(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  variableOperationalSpendCacheKey = key;
  variableOperationalSpendCache = {
    average,
    months: visibleMonths,
    totals: [...monthTotals.entries()].map(([month, amount]) => ({ month, amount })),
    excluded: "MASTER BASICA",
  };
  return variableOperationalSpendCache;
}

function variableOperationalSpendForForecastIndex(forecastIndex) {
  const override = scenarioSettings?.savingsPlan?.variableSpendTarget;
  const base = override !== undefined ? Number(override || 0) : variableOperationalSpendModel().average;
  return round2(base);
}

function variableOperationalPlannedSeries() {
  const months = baseData?.monthlyPlanning?.months || [];
  const override = scenarioSettings?.savingsPlan?.variableSpendTarget;
  const estimate = override !== undefined ? Number(override || 0) : variableOperationalSpendModel().average;
  return months.map(() => estimate);
}

function ensureVariableOperationalSection() {
  if (!baseData?.monthlyPlanning?.sections?.length) return;
  const sections = baseData.monthlyPlanning.sections;
  const planned = variableOperationalPlannedSeries();
  let section = sections.find((item) => item.kind === "expense" && item.name === VARIABLE_OPERATIONAL_SECTION);
  if (!section) {
    section = { name: VARIABLE_OPERATIONAL_SECTION, kind: "expense", rows: [] };
    const fixedIndex = sections.findIndex((item) => item.kind === "expense" && normalizedText(item.name).includes("gastos fijos"));
    const insertAt = fixedIndex >= 0 ? fixedIndex + 1 : sections.findIndex((item) => item.kind === "expense");
    sections.splice(insertAt >= 0 ? insertAt : sections.length, 0, section);
  } else {
    const currentIndex = sections.indexOf(section);
    const fixedIndex = sections.findIndex((item) => item.kind === "expense" && normalizedText(item.name).includes("gastos fijos"));
    if (fixedIndex >= 0 && currentIndex !== fixedIndex + 1) {
      sections.splice(currentIndex, 1);
      sections.splice(fixedIndex + (currentIndex < fixedIndex ? 0 : 1), 0, section);
    }
  }
  const row = section.rows.find((item) => item.id === VARIABLE_OPERATIONAL_ROW_ID);
  if (row) {
    row.kind = "expense";
    row.label = row.label || VARIABLE_OPERATIONAL_ROW_LABEL;
    row.planned = planned;
  } else {
    section.rows.push({
      id: VARIABLE_OPERATIONAL_ROW_ID,
      kind: "expense",
      label: VARIABLE_OPERATIONAL_ROW_LABEL,
      planned,
    });
  }
}

function variableOperationalPlanningRow() {
  return baseData?.monthlyPlanning?.sections
    ?.find((section) => section.kind === "expense" && section.name === VARIABLE_OPERATIONAL_SECTION)
    ?.rows?.find((row) => row.id === VARIABLE_OPERATIONAL_ROW_ID) || null;
}

function shouldApplyVariableOperationalMigration(row, months) {
  return months.some((month) => {
    const override = seriesOverrideForRow(row, month);
    if (override?.deleted) return false;
    if (override?.planned === VARIABLE_OPERATIONAL_MIGRATION_VALUE) return false;
    const base = basePlannedValueForRow(row, month);
    if (override?.planned === undefined || override?.planned === "") return base !== VARIABLE_OPERATIONAL_MIGRATION_VALUE;
    return Math.abs(Number(override.planned || 0) - base) < 0.01;
  });
}

function applyVariableOperationalMigration() {
  scenarioSettings.migrations = scenarioSettings.migrations || {};
  ensureVariableOperationalSection();
  const row = variableOperationalPlanningRow();
  if (!row) return;
  const months = forecastMonths().filter((month) => month.key >= VARIABLE_OPERATIONAL_MIGRATION_START);
  if (!shouldApplyVariableOperationalMigration(row, months)) {
    scenarioSettings.migrations[VARIABLE_OPERATIONAL_MIGRATION_KEY] =
      scenarioSettings.migrations[VARIABLE_OPERATIONAL_MIGRATION_KEY] || new Date().toISOString();
    return;
  }
  months.forEach((month) => {
    const key = overrideKeyForRow(row, month);
    const current = seriesOverrides[key] || {};
    const base = basePlannedValueForRow(row, month);
    if (
      current.deleted ||
      current.planned === VARIABLE_OPERATIONAL_MIGRATION_VALUE ||
      (current.planned !== undefined && current.planned !== "" && Math.abs(Number(current.planned || 0) - base) >= 0.01)
    ) {
      return;
    }
    seriesOverrides[key] = {
      ...current,
      planned: VARIABLE_OPERATIONAL_MIGRATION_VALUE,
      deleted: false,
    };
  });
  const markerKey = storageKey(VARIABLE_OPERATIONAL_MIGRATION_KEY);
  storageSet(markerKey, "done");
  scenarioSettings.migrations[VARIABLE_OPERATIONAL_MIGRATION_KEY] = new Date().toISOString();
  saveSeriesOverrides();
  saveScenarioSettings();
}

function applyVariableOperationalMayZeroDefault() {
  scenarioSettings.migrations = scenarioSettings.migrations || {};
  if (scenarioSettings.migrations[VARIABLE_OPERATIONAL_MAY_ZERO_KEY]) return;
  ensureVariableOperationalSection();
  const row = variableOperationalPlanningRow();
  const month = forecastMonths().find((item) => item.key === "2026-05");
  if (!row || !month) return;
  const key = overrideKeyForRow(row, month);
  const current = seriesOverrides[key] || {};
  if (current.planned === undefined || current.planned === "") {
    seriesOverrides[key] = { ...current, planned: 0, deleted: false };
    saveSeriesOverrides();
  }
  scenarioSettings.migrations[VARIABLE_OPERATIONAL_MAY_ZERO_KEY] = new Date().toISOString();
  saveScenarioSettings();
}

function ensureCompleteFinancingSection() {
  if (!baseData?.monthlyPlanning?.sections?.length) return;
  const section = baseData.monthlyPlanning.sections.find((item) => item.name === "Financiaciones");
  if (!section) return;
  const months = baseData.monthlyPlanning.months || [];
  const monthCount = months.length;
  const rowsById = new Map(section.rows.map((row) => [row.id, row]));
  const rowsByKey = new Map(section.rows.map((row) => [financingRowKey(row), row]));
  const referenceRowsByKey = financingReferenceRowsByKey();
  const templateIds = new Set(FINANCING_ROW_TEMPLATES.map((item) => `financiaciones-${item.row}`));
  const templateKeys = new Set(FINANCING_ROW_TEMPLATES.map((item) => financingTemplateKey(item.group, item.label)));
  const templateRows = FINANCING_ROW_TEMPLATES.map((template) => {
    const id = `financiaciones-${template.row}`;
    const key = financingTemplateKey(template.group, template.label);
    const existing = rowsById.get(id) || rowsByKey.get(key) || {};
    const reference = referenceRowsByKey.get(key);
    const source = hasPlannedValues(existing.planned) || !reference ? existing : reference;
    return {
      ...existing,
      id,
      row: template.row,
      kind: "expense",
      group: template.group,
      label: `${template.group} · ${template.label}`,
      planned: fitPlannedValues(source.planned, monthCount),
    };
  }).filter((row) => !USER_REMOVED_FINANCING_KEYS.has(financingRowKey(row)) && !isPlanningRowSeriesDeleted(row, "Financiaciones"));
  const extraRows = section.rows
    .filter((row) => !templateIds.has(row.id) && !templateKeys.has(financingRowKey(row)))
    .filter((row) => !USER_REMOVED_FINANCING_KEYS.has(financingRowKey(row)))
    .filter((row) => !isPlanningRowSeriesDeleted(row, "Financiaciones"))
    .map((row) => ({
      ...row,
      kind: "expense",
      planned: fitPlannedValues(row.planned, monthCount),
    }));
  section.kind = "expense";
  section.rows = [...templateRows, ...extraRows];
  section.totals = months.map((_, index) =>
    round2(section.rows.reduce((sum, row) => sum + Number(row.planned?.[index] || 0), 0)),
  );
}

function fitPlannedValues(planned = [], monthCount = 0) {
  const values = Array.isArray(planned)
    ? planned.slice(0, monthCount).map((value) => round2(Number(value || 0)))
    : [];
  while (values.length < monthCount) values.push(0);
  return values;
}

function hasPlannedValues(planned = []) {
  return Array.isArray(planned) && planned.some((value) => Math.abs(Number(value || 0)) >= 0.01);
}

function financingTemplateKey(group, label) {
  return `${normalizedText(group).trim()}|${normalizedText(label).trim()}`;
}

function financingRowKey(row = {}) {
  const label = String(row.label || "");
  const parts = label.split("·").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return financingTemplateKey(parts[0], parts.slice(1).join(" · "));
  return financingTemplateKey(row.group || "", label);
}

function financingReferenceRowsByKey() {
  if (!shouldUsePackagedFinancingReference()) return new Map();
  const referenceSection = packagedFinanceData?.monthlyPlanning?.sections?.find((item) => item.name === "Financiaciones");
  const map = new Map();
  if (!referenceSection?.rows?.length) return map;
  referenceSection.rows.forEach((row) => {
    const key = financingRowKey(row);
    if (!key || map.has(key)) return;
    map.set(key, row);
  });
  return map;
}

function sourceWorkbookBaseName(data) {
  return String(data?.metadata?.sourceWorkbook || "")
    .split(/[\\/]/)
    .pop();
}

function shouldUsePackagedFinancingReference() {
  if (!packagedFinanceData?.monthlyPlanning?.sections?.length) return false;
  const packagedSource = sourceWorkbookBaseName(packagedFinanceData);
  const currentSource = sourceWorkbookBaseName(baseData);
  if (!packagedSource) return false;
  if (!currentSource) return true;
  return normalizedText(currentSource) === normalizedText(packagedSource);
}

function repairFinancingSectionFromReference() {
  if (!baseData?.monthlyPlanning?.sections?.length || !packagedFinanceData?.monthlyPlanning?.sections?.length) return;
  const section = baseData.monthlyPlanning.sections.find((item) => item.name === "Financiaciones");
  if (!section?.rows?.length) return;
  const referenceRowsByKey = financingReferenceRowsByKey();
  if (!referenceRowsByKey.size) return;
  const monthCount = baseData.monthlyPlanning.months?.length || 0;
  let repaired = false;
  section.rows.forEach((row) => {
    if (USER_REMOVED_FINANCING_KEYS.has(financingRowKey(row))) return;
    if (isPlanningRowSeriesDeleted(row, "Financiaciones")) return;
    if (hasPlannedValues(row.planned)) return;
    const reference = referenceRowsByKey.get(financingRowKey(row));
    if (!reference || !hasPlannedValues(reference.planned)) return;
    row.planned = fitPlannedValues(reference.planned, monthCount);
    repaired = true;
  });
  if (repaired) {
    const months = baseData.monthlyPlanning.months || [];
    section.totals = months.map((_, index) =>
      round2(section.rows.reduce((sum, row) => sum + Number(row.planned?.[index] || 0), 0)),
    );
    saveWorkbookOverride();
  }
}

function rowsFromMovementSheet(workbook, sheetName, sourceRank) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet?.["!ref"]) return [];
  const range = window.XLSX.utils.decode_range(sheet["!ref"]);
  let headerRow = 2;
  for (let row = range.s.r; row <= Math.min(range.e.r, 6); row += 1) {
    const labels = [];
    for (let col = range.s.c; col <= Math.min(range.e.c, 10); col += 1) {
      labels.push(normalizedText(cellByIndex(sheet, row, col)).replace(/[^a-z0-9]/g, ""));
    }
    if (labels.includes("fecha") && labels.includes("movimiento") && labels.includes("importe") && labels.includes("saldo")) {
      headerRow = row;
      break;
    }
  }
  const rawRows = window.XLSX.utils.sheet_to_json(sheet, { range: headerRow, defval: "", raw: true });
  return rawRows
    .map((row) => {
      const date = isoFromWorkbookValue(row.Fecha);
      const amount = parseAmount(row.Importe);
      if (!date || !row.Movimiento || amount === null) return null;
      const transaction = {
        date,
        valueDate: isoFromWorkbookValue(row["Fecha valor"]) || date,
        movement: String(row.Movimiento),
        details: String(row["Más datos"] || row["Mas datos"] || ""),
        amount: round2(amount),
        balance: parseAmount(row.Saldo),
        category: "",
        source: sheetName,
        sourceRank,
        statementOrder: Number(row.__rowNum__ || 0),
        month: date.slice(0, 7),
      };
      transaction.category = classifyTransaction(transaction);
      return transaction;
    })
    .filter(Boolean);
}

function sheetLooksLikeMovementSheet(sheet) {
  if (!sheet?.["!ref"]) return false;
  const range = window.XLSX.utils.decode_range(sheet["!ref"]);
  const lastHeaderRow = Math.min(range.e.r, 6);
  for (let row = range.s.r; row <= lastHeaderRow; row += 1) {
    const labels = [];
    for (let col = range.s.c; col <= Math.min(range.e.c, 10); col += 1) {
      labels.push(normalizedText(cellByIndex(sheet, row, col)).replace(/[^a-z0-9]/g, ""));
    }
    if (labels.includes("fecha") && labels.includes("movimiento") && labels.includes("importe") && labels.includes("saldo")) {
      return true;
    }
  }
  return false;
}

function loadTransactionsFromWorkbook(workbook) {
  const movementSheets = workbook.SheetNames.filter((name) =>
    normalizedText(name).replace(/[^a-z0-9]/g, "").startsWith("movimientoscuenta") ||
    sheetLooksLikeMovementSheet(workbook.Sheets[name]),
  );
  const deduped = new Map();
  movementSheets.forEach((sheetName, sourceRank) => {
    rowsFromMovementSheet(workbook, sheetName, sourceRank).forEach((row) => {
      const key = `${row.date}|${row.movement}|${row.details}|${row.amount}`;
      const previous = deduped.get(key);
      if (!previous || row.sourceRank >= previous.sourceRank) deduped.set(key, row);
    });
  });
  return [...deduped.values()]
    .sort((a, b) => `${a.date}|${a.sourceRank}|${a.movement}`.localeCompare(`${b.date}|${b.sourceRank}|${b.movement}`))
    .map(({ sourceRank, ...row }) => row);
}

function buildRollupsFromTransactions(transactions) {
  const recent = transactions.filter((row) => row.date >= "2025-11-01");
  const current = recent.filter((row) => row.month >= "2026-01" && row.month <= "2026-03");
  const coreCategories = ["Suministros y telecom", "Vivienda/comunidad", "Efectivo", "Seguros", "Alimentacion", "Otros gastos"];
  const recurringIncomeCategories = ["Ingresos nomina", "Ingreso recurrente 800"];
  const group = (rows, keyer, valuer) =>
    rows.reduce((map, row) => {
      const key = keyer(row);
      map.set(key, round2((map.get(key) || 0) + valuer(row)));
      return map;
    }, new Map());
  const categoryMonthly = [...group(recent, (row) => `${row.month}|${row.category}`, (row) => row.amount)].map(([key, amount]) => {
    const [month, Categoria] = key.split("|");
    return { month, Categoria, amount };
  });
  const coreMonthly = [...group(current.filter((row) => row.amount < 0 && coreCategories.includes(row.category)), (row) => row.month, (row) => -row.amount).values()];
  const incomeMonthly = [...group(current.filter((row) => recurringIncomeCategories.includes(row.category)), (row) => row.month, (row) => row.amount).values()];
  const topMerchants = [...group(current.filter((row) => row.amount < 0 && coreCategories.includes(row.category)), (row) => `${row.movement}|${row.category}`, (row) => -row.amount)]
    .map(([key, amount]) => {
      const [Movimiento, Categoria] = key.split("|");
      return { Movimiento, Categoria, amount: round2(amount) };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 20);
  return {
    categoryMonthly,
    topMerchants,
    historicalCoreSpend: coreMonthly.length ? round2(coreMonthly.reduce((a, b) => a + b, 0) / coreMonthly.length) : 0,
    historicalIncome: incomeMonthly.length ? round2(incomeMonthly.reduce((a, b) => a + b, 0) / incomeMonthly.length) : 0,
  };
}

function buildFinanceDataFromWorkbook(workbook, fileName) {
  const planSheet = workbook.Sheets[workbookSheet(workbook, ["Plan_Ahorro_821"])];
  const lifeSheet = workbook.Sheets[workbookSheet(workbook, ["Contabilidad New Life", "Contabilidad New Life (2)"])];
  const refundSheet = workbook.Sheets[workbookSheet(workbook, ["Importe devolucion recibos", "Importe devolución recibos"])];
  if (!planSheet || !lifeSheet) throw new Error("El libro no contiene Plan_Ahorro_821 y Contabilidad New Life.");

  const monthlyPlanning = loadMonthlyPlanningFromWorkbook(workbook);
  const sourcePlan = {
    baseHouseholdIncome: numberCell(planSheet, "B5"),
    incomeWithExtrasProrated: numberCell(planSheet, "F5"),
    extraApril: numberCell(planSheet, "B6"),
    extraDecember: numberCell(planSheet, "B7"),
    mortgagePayment: numberCell(planSheet, "B8"),
    bmwPayment: numberCell(planSheet, "B9"),
    unifiedCreditPayment: numberCell(planSheet, "B10"),
    otherFixedNonDebt: numberCell(planSheet, "B11"),
    variableSpendTarget: numberCell(planSheet, "B12"),
    initialEmergencyFund: numberCell(planSheet, "B13"),
    emergencyBufferMonths: numberCell(planSheet, "B14", 6),
    debtServiceMonthlyTotal: numberCell(planSheet, "F6"),
    debtToIncomeRatio: numberCell(planSheet, "F7"),
    totalSpendTarget: numberCell(planSheet, "F8"),
    monthlySavingPotential: numberCell(planSheet, "F9"),
    savingsRate: numberCell(planSheet, "F10"),
    emergencyFundTarget: numberCell(planSheet, "F11"),
    emergencyFundGap: numberCell(planSheet, "F12"),
    recommendedSaving: numberCell(planSheet, "F16", baseData.assumptions.recommendedSavings),
    suggestedAmortization: numberCell(planSheet, "F17"),
    bankinterOutsidePlanPayment: numberCell(planSheet, "B18"),
    cetelemOutsidePlanPayment: numberCell(planSheet, "B19"),
    carEndDate: dateCell(planSheet, "F18"),
    bankinterEndDate: dateCell(planSheet, "H18"),
    cetelemEndDate: dateCell(planSheet, "F19"),
    monthWithoutBmwCetelem: dateCell(planSheet, "H19"),
    oldDebtPrincipal: refundSheet ? numberCell(refundSheet, "K16") : 0,
    oldDebtMonthlyPayments: refundSheet ? numberCell(refundSheet, "L16") : 0,
  };
  const sourceBalances = {
    valuationDate: dateCell(lifeSheet, "C1") || defaultBalanceDate(),
    caixaBalance: numberCell(lifeSheet, "C3"),
    mediolanumBalance: numberCell(lifeSheet, "D3"),
    totalBalance: numberCell(lifeSheet, "E3"),
  };
  const transactions = loadTransactionsFromWorkbook(workbook);
  const rollups = buildRollupsFromTransactions(transactions);
  const baseSpendWithMortgage = sourcePlan.otherFixedNonDebt + sourcePlan.variableSpendTarget + sourcePlan.mortgagePayment;
  const assumptions = {
    ...baseData.assumptions,
    initialCash: round2(sourceBalances.totalBalance || sourceBalances.caixaBalance + sourceBalances.mediolanumBalance),
    caixaBalanceBeforeCar: round2(sourceBalances.caixaBalance),
    newAccountBalance: round2(sourceBalances.mediolanumBalance),
    currentCarAdjustment: 0,
    monthlyIncome: round2(sourcePlan.incomeWithExtrasProrated),
    baseHouseholdIncome: round2(sourcePlan.baseHouseholdIncome),
    coreSpend: round2(baseSpendWithMortgage),
    otherFixedNonDebt: round2(sourcePlan.otherFixedNonDebt),
    variableSpendTarget: round2(sourcePlan.variableSpendTarget),
    mortgagePayment: round2(sourcePlan.mortgagePayment),
    carPayment: round2(sourcePlan.bmwPayment),
    carEndDate: sourcePlan.carEndDate,
    refiFirstPayment: round2(sourcePlan.unifiedCreditPayment),
    remainingHighRefiPayments: 1,
    extraDebts: [
      { name: "Bankinter fuera del plan", payment: round2(sourcePlan.bankinterOutsidePlanPayment), endDate: sourcePlan.bankinterEndDate },
      { name: "Cetelem fuera del plan", payment: round2(sourcePlan.cetelemOutsidePlanPayment), endDate: sourcePlan.cetelemEndDate },
    ],
    recommendedSavings: round2(sourcePlan.recommendedSaving),
    emergencyBufferMonths: round2(sourcePlan.emergencyBufferMonths),
    annualInflation: 0,
    annualIncomeGrowth: 0,
  };
  const monthlySurplus = assumptions.monthlyIncome - assumptions.coreSpend - assumptions.carPayment - assumptions.refiFirstPayment - assumptions.extraDebts.reduce((sum, item) => sum + item.payment, 0);
  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      sourceWorkbook: fileName,
      sourceWorkbookStatus: "Leído desde la app",
      forecastStart: `${monthlyPlanning.months[0]?.key || "2026-05"}-01`,
      forecastMonths: 60,
      currency: "EUR",
    },
    assumptions,
    sourcePlan,
    sourceBalances,
    monthlyPlanning,
    derived: {
      coreMonthlyAverageJanMar2026: rollups.historicalCoreSpend,
      incomeMonthlyAverageJanMar2026: rollups.historicalIncome,
      monthlySurplusAfterRefiAndCar: round2(monthlySurplus),
      oldCreditMonthlyAverageJanMar2026: round2(sourcePlan.oldDebtMonthlyPayments),
      oldCreditPrincipal: round2(sourcePlan.oldDebtPrincipal),
      debtToIncomeRatio: round2(sourcePlan.debtToIncomeRatio),
      planSavingsRate: round2(sourcePlan.savingsRate),
      emergencyFundTarget: round2(sourcePlan.emergencyFundTarget),
      emergencyFundGap: round2(sourcePlan.emergencyFundGap),
    },
    categoryMonthly: rollups.categoryMonthly,
    topMerchants: rollups.topMerchants,
    transactions,
  };
}

function customRowsForSection(kind, sectionName, month) {
  return customPlanningRows
    .filter(
      (row) =>
        row.kind === kind &&
        row.sectionName === sectionName &&
        row.monthKey === month.key &&
        !isPlanningRowDeleted(row, month, sectionName),
    )
    .map((row) => ({
      ...row,
      label: row.label || "Concepto personalizado",
      plannedValue: Number(row.plannedValue || 0),
    }));
}

function planningSectionsForMonth(kind, month) {
  const sections = baseData.monthlyPlanning.sections
    .filter((section) => !kind || section.kind === kind)
    .map((section) => {
      const sourceRowCount = section.rows.length;
      const rows = section.rows
        .filter((row) => !isPlanningRowDeleted(row, month, section.name))
        .concat(customRowsForSection(section.kind, section.name, month));
      return { ...section, rows, sourceRows: section.rows, sourceRowCount };
    });

  customPlanningRows
    .filter((row) => (!kind || row.kind === kind) && row.monthKey === month.key)
    .forEach((row) => {
      if (sections.some((section) => section.kind === row.kind && section.name === row.sectionName)) return;
      if (isPlanningRowDeleted(row, month, row.sectionName)) return;
      sections.push({
        name: row.sectionName,
        kind: row.kind,
        rows: [{ ...row, plannedValue: Number(row.plannedValue || 0) }],
      });
    });

  return sections.filter((section) => section.rows.length);
}

function varianceClassForKind(kind, variance) {
  if (variance === "" || variance === null || variance === undefined || Number(variance) === 0) {
    return "";
  }
  if (kind === "income") {
    return Number(variance) > 0 ? "positive" : "negative";
  }
  return Number(variance) > 0 ? "negative" : "positive";
}

function normalizedText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isCarPlanningRow(row) {
  return /\b(coche|bmw)\b/.test(normalizedText(displayLabelForRow(row)));
}

function isFinancingPlanningRow(section, row) {
  const sectionName = normalizedText(section.name);
  const label = normalizedText(displayLabelForRow(row));
  return (
    sectionName.includes("financi") ||
    /refinanci|libre deuda|prestamo|tarjeta|credito|mycard|visa|mastercard|cetelem|bankinter|pdh/.test(
      label,
    )
  );
}

function isVariableOperationalRow(row) {
  return row?.id === VARIABLE_OPERATIONAL_ROW_ID;
}

function variableFormulaFinancingExclusionKey(row) {
  const label = String(displayLabelForRow(row) || "");
  const parts = label.split("·").map((part) => normalizedText(part).trim()).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]}|${parts.slice(1).join(" · ")}`;
  return `${normalizedText(row.group || "")}|${normalizedText(label)}`;
}

function isVariableFormulaFinancingExcluded(row) {
  const key = variableFormulaFinancingExclusionKey(row);
  return VARIABLE_FORMULA_FINANCING_EXCLUSIONS.some((excluded) => key.includes(excluded));
}

function variableOperationalFormulaValue(month) {
  if (!baseData?.monthlyPlanning?.sections?.length || !month?.key) return 0;
  let subscriptions = 0;
  let financing = 0;
  baseData.monthlyPlanning.sections.forEach((section) => {
    if (section.kind !== "expense") return;
    const sectionName = normalizedText(section.name);
    if (!sectionName.includes("suscrip") && !sectionName.includes("financi")) return;
    section.rows.forEach((row) => {
      if (isPlanningRowDeleted(row, month, section.name)) return;
      if (sectionName.includes("financi") && isVariableFormulaFinancingExcluded(row)) return;
      const value = plannedValueForRowRaw(row, month);
      if (sectionName.includes("suscrip")) subscriptions += value;
      else financing += value;
    });
  });
  return round2(Math.max(0, VARIABLE_OPERATIONAL_FORMULA_TARGET - subscriptions - financing));
}

function isPrePayrollIncomeRow(row) {
  const label = normalizedText(displayLabelForRow(row));
  return label === "local" || /(^|\b)(nomina|salario)\s+tere(\b|$)/.test(label) || /\btere\b.*\b(nomina|salario)\b/.test(label);
}

function incomeTimingFromMovements(row, month, amount) {
  const label = normalizedText(displayLabelForRow(row));
  const monthKeyValue = month?.key || "";
  if (!label || !monthKeyValue || !amount) return null;
  const candidates = (baseData?.transactions || [])
    .filter((transaction) => transaction.month === monthKeyValue && Number(transaction.amount || 0) > 0)
    .map((transaction) => {
      const text = normalizedText(`${transaction.movement || ""} ${transaction.details || ""} ${transaction.category || ""}`);
      const amountDistance = Math.abs(Number(transaction.amount || 0) - Number(amount || 0));
      let score = 0;
      if (label.includes("local") && (text.includes("ingreso recurrente 800") || text.includes("transfer inmediata"))) score += 5;
      if ((label.includes("nomina") || label.includes("salario")) && text.includes("nomina")) score += 4;
      if (label.includes("hacienda") && (text.includes("hacienda") || text.includes("tributaria") || text.includes("devoluciones tributaria"))) score += 4;
      if (label.includes("wash") && text.includes("wash")) score += 4;
      if (label.includes("bonus") && (text.includes("bonus") || text.includes("nomina"))) score += 2;
      if (amountDistance <= 1) score += 3;
      else if (amountDistance <= Math.max(10, Math.abs(amount) * 0.05)) score += 1;
      return { transaction, score, amountDistance };
    })
    .filter((item) => item.score >= 5)
    .sort((a, b) => b.score - a.score || a.amountDistance - b.amountDistance);
  const best = candidates[0]?.transaction;
  if (!best?.date) return null;
  const date = new Date(best.date);
  if (Number.isNaN(date.getTime())) return null;
  return {
    day: date.getDate(),
    source: "movimiento real identificado",
    label: shortDate(date),
  };
}

function incomeTimingForRow(row, month, amount) {
  const label = normalizedText(displayLabelForRow(row));
  const date = dateFromMonthKey(month.key);
  if (label.includes("local")) {
    return { day: 1, source: "regla local", label: dateWithMonthLabel(date, 1) };
  }
  if (/(\bnomina\b|\bsalario\b).*\btere\b|\btere\b.*(\bnomina\b|\bsalario\b)/.test(label)) {
    return { day: 25, source: "regla salario Tere", label: dateWithMonthLabel(date, 25) };
  }
  if (
    label.includes("bonus") ||
    label.includes("bono") ||
    (date.getMonth() === 11 && (label.includes("hacienda") || label.includes("extra") || Number(amount || 0) >= 2500))
  ) {
    const day = date.getMonth() === 11 ? 15 : lastBusinessDayOfMonth(date).getDate();
    return { day, source: date.getMonth() === 11 ? "regla bono diciembre" : "regla bonus Javi", label: dateWithMonthLabel(date, day) };
  }
  if (/(^|\b)(nomina|salario)\s+javi(\b|$)|\bjavi\b.*\b(nomina|salario)\b/.test(label)) {
    const day = lastBusinessDayOfMonth(date).getDate();
    return { day, source: "regla nómina Javi", label: dateWithMonthLabel(date, day) };
  }
  const movementTiming = incomeTimingFromMovements(row, month, amount);
  if (movementTiming) return movementTiming;
  return { day: 8, source: "estimación alisada 1-15", label: dateWithMonthLabel(date, 8) };
}

function isEndOfMonthExpenseRow(row) {
  const label = normalizedText(displayLabelForRow(row));
  return (
    label.includes("trastero") ||
    label.includes("parking") ||
    label.includes("psicologo") ||
    /psicologo.*sergio|sergio.*psicologo/.test(label) ||
    /pag[ao].*sergio|sergio.*pag[ao]/.test(label)
  );
}

function expenseTimingForRow(row, month) {
  const date = dateFromMonthKey(month.key);
  if (isEndOfMonthExpenseRow(row)) {
    const day = monthEndDate(date).getDate();
    return { day, source: "regla gasto fin de mes", label: dateWithMonthLabel(date, day), endOfMonth: true };
  }
  return null;
}

function incomeEventsForMonth(month, forecastIndex, options = {}) {
  const useActuals = options.useActuals !== false;
  const incomeFactor = (state.incomeFactor ?? 1) * Math.pow(1 + state.annualIncomeGrowth / 100, forecastIndex / 12);
  const events = [];
  planningSectionsForMonth("income", month).forEach((section) => {
    section.rows.forEach((row) => {
      if (isPlanningRowDeleted(row, month, section.name)) return;
      const rawValue = useActuals ? actualAwareValue(row, month) : plannedValueForRow(row, month);
      const amount = round2(Number(rawValue || 0) * incomeFactor);
      if (!amount) return;
      const timing = incomeTimingForRow(row, month, amount);
      events.push({
        concept: displayLabelForRow(row),
        amount,
        day: timing.day,
        dateLabel: timing.label,
        source: timing.source,
      });
    });
  });
  events.sort((a, b) => a.day - b.day || String(a.concept).localeCompare(String(b.concept)));
  return events;
}

function planningMonthForDate(date, forecastIndex) {
  const planning = baseData.monthlyPlanning;
  const key = monthKey(date);
  const label = monthLabel(date);
  return sourcePlanningMonthForMonth({ key, label, index: forecastIndex });
}

function planningBreakdownForForecastMonth(forecastIndex, date, options = {}) {
  const planning = baseData.monthlyPlanning;
  const month = planningMonthForDate(date, forecastIndex);
  const useActuals = options.useActuals !== false;
  const breakdown = {
    monthKey: month.key,
    income: 0,
    coreSpend: 0,
    car: 0,
    refi: 0,
    expenseTotal: 0,
    prePayrollIncome: 0,
    variableOperationalSpend: 0,
    endOfMonthSpend: 0,
    incomeEvents: [],
  };

  planningSectionsForMonth(null, month).forEach((section) => {
    const calculationRows = section.rows;
    let rowTotal = 0;
    let sectionCoreSpend = 0;
    let sectionCar = 0;
    let sectionRefi = 0;
    let sectionPrePayrollIncome = 0;
    let sectionVariableOperationalSpend = 0;
    let sectionEndOfMonthSpend = 0;

    calculationRows.forEach((row) => {
      const deleted = isPlanningRowDeleted(row, month, section.name);
      const value = deleted ? 0 : useActuals ? actualAwareValue(row, month) : plannedValueForRow(row, month);
      rowTotal += value;
      if (section.kind === "income") {
        if (isPrePayrollIncomeRow(row)) sectionPrePayrollIncome += value;
        return;
      }
      if (section.kind !== "expense") return;

      if (isCarPlanningRow(row)) {
        sectionCar += value;
      } else if (isFinancingPlanningRow(section, row)) {
        sectionRefi += value;
      } else {
        if (isVariableOperationalRow(row)) sectionVariableOperationalSpend += value;
        sectionCoreSpend += value;
      }
      if (expenseTimingForRow(row, month)?.endOfMonth) sectionEndOfMonthSpend += value;
    });

    if (section.kind === "income") {
      breakdown.income += rowTotal;
      breakdown.prePayrollIncome += sectionPrePayrollIncome;
      return;
    }
    if (section.kind !== "expense") return;

    breakdown.expenseTotal += rowTotal;
    breakdown.car += sectionCar;
    breakdown.refi += sectionRefi;
    breakdown.coreSpend += sectionCoreSpend;
    breakdown.variableOperationalSpend += sectionVariableOperationalSpend;
    breakdown.endOfMonthSpend += sectionEndOfMonthSpend;
  });

  breakdown.incomeEvents = incomeEventsForMonth(month, forecastIndex, options);
  if (breakdown.incomeEvents.length) {
    const monthDate = dateFromMonthKey(month.key);
    const payrollDay = lastBusinessDayOfMonth(monthDate).getDate();
    breakdown.prePayrollIncome = sumRows(
      breakdown.incomeEvents.filter((event) => event.day < payrollDay),
      (event) => event.amount,
    );
  }

  return breakdown;
}

function planningDetailSectionsForForecastIndex(forecastIndex) {
  const date = addMonths(modelStartDate(), forecastIndex);
  const month = planningMonthForDate(date, forecastIndex);
  const sections = planningSectionsForMonth(null, month)
    .map((section) => {
      const lines = section.rows
        .map((row) => {
          const info = actualAwareInfo(row, month);
          const include = info.value !== 0 || info.planned !== 0 || info.hasActual;
          if (!include) return null;
          const type =
            section.kind === "income"
              ? "Ingreso"
              : isCarPlanningRow(row)
                ? "Coche"
                : isFinancingPlanningRow(section, row)
                  ? "Financiación"
                  : "Gasto";
          return {
            label: displayLabelForRow(row),
            type,
            value: info.value,
            planned: info.planned,
            actual: info.actual,
            source: info.source,
            hasActual: info.hasActual,
          };
        })
        .filter(Boolean);
      const total = lines.reduce((sum, line) => sum + line.value, 0);
      return { name: section.name, kind: section.kind, total, lines };
    })
    .filter((section) => section.lines.length);
  return {
    month,
    sections,
  };
}

function scheduledDecisionMonthlyImpact(project, forecastIndex) {
  const duration = Math.max(1, Number(project.duration || 1));
  const costActive = forecastIndex >= project.startIndex && forecastIndex < project.startIndex + duration;
  const cost = costActive ? Number(project.amount || 0) / duration : 0;
  const recurringAmount = Number(project.recurringAmount || 0);
  const recurringDuration = Math.max(0, Number(project.recurringDuration || 0));
  const recurringStartOffset = Math.max(0, Number(project.recurringStartOffset || 0));
  const recurringActive =
    recurringDuration > 0 &&
    forecastIndex >= project.startIndex + recurringStartOffset &&
    forecastIndex < project.startIndex + recurringStartOffset + recurringDuration;
  const recurring = recurringActive ? recurringAmount : 0;
  const reliefStart = project.startIndex + duration;
  const reliefMonths = debtReliefMonthsForItem(project, reliefStart);
  const effectiveRelief = effectiveDebtDecisionMonthlyRelief(project);
  const reliefActive =
    project.source === "debt" &&
    effectiveRelief > 0 &&
    reliefMonths > 0 &&
    forecastIndex >= reliefStart &&
    forecastIndex < reliefStart + reliefMonths;
  const relief = reliefActive ? -effectiveRelief : 0;
  return round2(cost + recurring + relief);
}

function projectsForForecastIndex(forecastIndex) {
  return projectPlan.placements
    .filter((project) => scheduledDecisionMonthlyImpact(project, forecastIndex) !== 0)
    .map((project) => ({
      ...project,
      monthlyAmount: scheduledDecisionMonthlyImpact(project, forecastIndex),
    }));
}

function projectedAccountBalancesForStartIndex(startIndex) {
  const source = baseAccountBalances();
  let checking = source.caixa;
  let savings = source.mediolanum;

  for (let i = 0; i < Math.max(0, startIndex); i += 1) {
    const date = addMonths(baseModelStartDate(), i);
    const detail = planningBreakdownForForecastMonth(i, date);
    const income =
      detail.income *
      (state.incomeFactor ?? 1) *
      Math.pow(1 + state.annualIncomeGrowth / 100, i / 12);
    const expenseMultiplier = (state.expenseFactor ?? 1) * Math.pow(1 + state.annualInflation / 100, i / 12);
    const variableOperationalSpend = detail.variableOperationalSpend * expenseMultiplier;
    const fixedCoreSpend = Math.max(0, detail.coreSpend - detail.variableOperationalSpend) * expenseMultiplier;
    const coreSpend = fixedCoreSpend + variableOperationalSpend;
    const endOfMonthOutflows = detail.endOfMonthSpend * expenseMultiplier;
    const outflowsBeforeSaving = coreSpend + detail.car + detail.refi;
    const availableBeforeSaving = checking + income - outflowsBeforeSaving;
    const appliedSaving = state.autoCapSavings
      ? Math.max(0, Math.min(state.recommendedSavings, availableBeforeSaving - outflowsBeforeSaving))
      : state.recommendedSavings;
    checking = availableBeforeSaving - appliedSaving;
    savings += appliedSaving;
  }

  return {
    caixa: round2(checking),
    mediolanum: round2(savings),
    total: round2(checking + savings),
  };
}

function projectedInitialCashForStartIndex(startIndex) {
  return projectedAccountBalancesForStartIndex(startIndex).total;
}

function accountBalancesFromState() {
  const base = baseAccountBalances();
  const mediolanum = Number.isFinite(Number(state?.mediolanumBalance))
    ? Number(state.mediolanumBalance)
    : Math.min(base.mediolanum, Math.max(0, Number(state?.initialCash ?? base.total)));
  const caixa = Number.isFinite(Number(state?.caixaBalance))
    ? Number(state.caixaBalance)
    : Number(state?.initialCash ?? base.total) - mediolanum;
  return {
    caixa: round2(caixa),
    mediolanum: round2(mediolanum),
    total: round2(caixa + mediolanum),
  };
}

function setStateAccountBalances(balances) {
  state.caixaBalance = round2(balances.caixa);
  state.mediolanumBalance = round2(balances.mediolanum);
  state.initialCash = round2(state.caixaBalance + state.mediolanumBalance);
  if (qs("initialCash")) qs("initialCash").value = state.initialCash.toFixed(2);
}

function applyAutomaticAccountBalances() {
  setStateAccountBalances(projectedAccountBalancesForStartIndex(modelStartIndex()));
}

function updateBalanceModeUi() {
  const initialCash = qs("initialCash");
  if (!initialCash) return;
  const auto = (qs("balanceMode")?.value || state?.balanceMode) === "auto";
  initialCash.readOnly = auto;
  initialCash.classList.toggle("derived-control", auto);
  ["visualCaixaBalance", "visualMediolanumBalance"].forEach((id) => {
    const input = qs(id);
    if (!input) return;
    input.readOnly = auto;
    input.classList.toggle("derived-control", auto);
  });
}

function applyBalanceModeChange() {
  const mode = qs("balanceMode").value || "auto";
  state.balanceDate = qs("balanceDate").value || defaultBalanceDate();
  state.balanceMode = mode;
  if (mode === "manual") {
    const fallback = accountBalancesFromState();
    setStateAccountBalances({
      caixa: balanceSettings.manualCaixaBalance ?? fallback.caixa,
      mediolanum: balanceSettings.manualMediolanumBalance ?? fallback.mediolanum,
    });
  } else {
    applyAutomaticAccountBalances();
  }
  updateBalanceModeUi();
  renderAccountBalancePanels();
  saveBalanceSettings();
}

function readStateFromControls() {
  controls.forEach((key) => {
    state[key] = Number(qs(key).value);
  });
  state.autoCapSavings = qs("autoCapSavings").checked;
  state.balanceDate = qs("balanceDate").value || defaultBalanceDate();
  state.balanceMode = qs("balanceMode").value || "auto";
  if (state.balanceMode === "auto") {
    applyAutomaticAccountBalances();
  } else if (!Number.isFinite(Number(state.caixaBalance)) || !Number.isFinite(Number(state.mediolanumBalance))) {
    const fallbackSavings = balanceSettings.manualMediolanumBalance ?? baseAccountBalances().mediolanum;
    setStateAccountBalances({
      caixa: Number(state.initialCash || 0) - Number(fallbackSavings || 0),
      mediolanum: Number(fallbackSavings || 0),
    });
  }
  updateBalanceModeUi();
  saveBalanceSettings();
  saveScenarioSettings();
}

function writeControls(nextState) {
  state = { ...nextState, ...scenarioSettings };
  state.balanceDate = state.balanceDate || balanceSettings.balanceDate || defaultBalanceDate();
  state.balanceMode = state.balanceMode || balanceSettings.balanceMode || "auto";
  if (state.balanceMode === "manual") {
    const base = baseAccountBalances();
    setStateAccountBalances({
      caixa: balanceSettings.manualCaixaBalance ?? Number(balanceSettings.manualInitialCash ?? state.initialCash ?? base.total) - (balanceSettings.manualMediolanumBalance ?? base.mediolanum),
      mediolanum: balanceSettings.manualMediolanumBalance ?? base.mediolanum,
    });
  }
  controls.forEach((key) => {
    qs(key).value = state[key];
  });
  qs("balanceDate").value = state.balanceDate;
  qs("balanceMode").value = state.balanceMode;
  qs("autoCapSavings").checked = state.autoCapSavings ?? true;
  if (state.balanceMode === "auto") {
    applyAutomaticAccountBalances();
  }
  updateBalanceModeUi();
  renderAccountBalancePanels();
}

function writeDerivedControls(rows) {
  const activeRows = openSimulationRows(rows);
  const visibleRows = activeRows.length ? activeRows : rows;
  const next12 = visibleRows.slice(0, Math.min(12, visibleRows.length));
  const activeRefiMonths = visibleRows.filter((row) => row.refi > 0).length;
  const values = {
    startingAccountBalance: visibleRows[0]?.startChecking || 0,
    monthlyIncome: averageRows(next12, (row) => row.income),
    coreSpend: averageRows(next12, (row) => row.coreSpend),
    carPayment: sumRows(next12, (row) => row.car),
    remainingHighRefiPayments: activeRefiMonths,
    refiFirstPayment: averageRows(next12, (row) => row.refi),
    refiLaterPayment: sumRows(visibleRows, (row) => row.refi),
  };
  Object.entries(values).forEach(([key, value]) => {
    qs(key).value = Number.isInteger(value) ? value : Number(value || 0).toFixed(2);
  });
}

function renderAccountBalancePanels() {
  if (!state) return;
  const balances = accountBalancesFromState();
  const mode = state.balanceMode || "auto";
  if (qs("visualBalanceDate")) qs("visualBalanceDate").value = state.balanceDate || defaultBalanceDate();
  if (qs("visualBalanceMode")) qs("visualBalanceMode").value = mode;
  if (qs("visualCaixaBalance")) qs("visualCaixaBalance").value = balances.caixa.toFixed(2);
  if (qs("visualMediolanumBalance")) qs("visualMediolanumBalance").value = balances.mediolanum.toFixed(2);
  if (qs("visualTotalBalance")) qs("visualTotalBalance").value = balances.total.toFixed(2);
  if (qs("overviewBalanceBreakdown")) {
    qs("overviewBalanceBreakdown").innerHTML = [
      ["CaixaBank", balances.caixa],
      ["Mediolanum", balances.mediolanum],
      ["Total", balances.total],
    ]
      .map(([label, value]) => `<div><span>${label}</span><strong>${money(value, true)}</strong></div>`)
      .join("");
  }
  if (qs("previsionBalanceSummary")) {
    qs("previsionBalanceSummary").innerHTML = [
      ["Fecha", formatIsoDate(state.balanceDate || defaultBalanceDate())],
      ["CaixaBank", money(balances.caixa, true)],
      ["Mediolanum", money(balances.mediolanum, true)],
      ["Liquidez total", money(balances.total, true)],
    ]
      .map(([label, value]) => `<div class="account-balance-chip"><span>${label}</span><strong>${value}</strong></div>`)
      .join("");
  }
  updateBalanceModeUi();
}

function handleVisualBalanceControlChange() {
  if (!state) return;
  qs("balanceDate").value = qs("visualBalanceDate").value || defaultBalanceDate();
  qs("balanceMode").value = qs("visualBalanceMode").value || "auto";
  applyBalanceModeChange();
  render();
}

function handleVisualAccountBalanceInput() {
  if (!state) return;
  qs("balanceMode").value = "manual";
  qs("visualBalanceMode").value = "manual";
  state.balanceMode = "manual";
  state.balanceDate = qs("visualBalanceDate").value || qs("balanceDate").value || defaultBalanceDate();
  qs("balanceDate").value = state.balanceDate;
  setStateAccountBalances({
    caixa: parseAmount(qs("visualCaixaBalance").value) ?? 0,
    mediolanum: parseAmount(qs("visualMediolanumBalance").value) ?? 0,
  });
  renderAccountBalancePanels();
  saveBalanceSettings();
  render();
}

function addHelpToControl(id, text) {
  qs(id)?.closest("label")?.setAttribute("data-help", text);
}

function addHelpToCard(id, text) {
  qs(id)?.closest("article, .project-summary-card, .expense-summary-card, .advice-item")?.setAttribute("data-help", text);
}

function applyHelpTooltips() {
  addHelpToCard(
    "kpiEnding",
    "Liquidez total al final de la simulación: cuenta corriente más cuenta de ahorro, ya aplicando ahorro, deuda refinanciada y proyectos.",
  );
  addHelpToCard(
    "kpiInitial",
    "Saldo desde el que arranca la simulación. Puede venir calculado por fecha o ser el saldo real que introduzcas manualmente.",
  );
  addHelpToCard(
    "kpiSurplus",
    "Margen operativo del primer mes antes de enviar dinero al ahorro. Si baja demasiado, el ahorro objetivo puede forzar la caja.",
  );
  addHelpToCard(
    "kpiSaving",
    "Media mensual que realmente acaba en ahorro. Puede ser menor que el objetivo si está activado el ajuste automático de caja.",
  );

  addHelpToControl("projectName", "Nombre interno para reconocer el proyecto o imprevisto en el impacto mensual.");
  addHelpToControl("projectAmount", "Impacto inicial del plan. Puede ser un pago único o repartirse en varios meses.");
  addHelpToControl("projectDuration", "Meses durante los que se reparte el impacto inicial.");
  addHelpToControl("projectRecurringAmount", "Cuota mensual adicional si el proyecto se financia o genera un pago recurrente.");
  addHelpToControl("projectRecurringDuration", "Número de meses de la cuota recurrente. Déjalo en 0 si solo hay un impacto puntual.");
  addHelpToControl("projectRecurringDelay", "Define si la cuota recurrente empieza el mismo mes o después del impacto inicial.");
  addHelpToControl("projectMonth", "Solo se activa con Mes manual. Si usas Mes óptimo, el algoritmo busca el hueco con mejor caja.");
  document
    .querySelector(".mode-switch")
    ?.setAttribute("data-help", "Mes óptimo busca automáticamente el mejor momento; Mes manual respeta el mes que elijas.");

  addHelpToControl("initialCash", "Liquidez total disponible al arrancar la simulación. En modo manual puedes poner aquí el saldo real.");
  addHelpToControl(
    "startingAccountBalance",
    "Saldo estimado de la cuenta operativa en la fecha elegida. Se calcula con el modo automático o con la liquidez manual menos el ahorro separado.",
  );
  addHelpToControl(
    "balanceDate",
    "Fecha desde la que arranca el modelo. En automático se usa el saldo proyectado del mes de esa fecha.",
  );
  addHelpToControl(
    "balanceMode",
    "Auto calcula el saldo según la fecha; Real manual te deja introducir el saldo total actual de tus cuentas.",
  );
  qs("visualBalancePanel")?.setAttribute(
    "data-help",
    "Estos saldos gobiernan el arranque de todo el modelo. En automático se estiman por fecha; en manual puedes introducir CaixaBank y Mediolanum reales.",
  );
  addHelpToControl(
    "monthlyIncome",
    "Referencia calculada: media de ingresos previstos o reales de los próximos 12 meses, no un único mes aislado.",
  );
  addHelpToControl("annualIncomeGrowth", "Ajuste anual editable para simular subida o bajada de ingresos futuros.");
  addHelpToControl(
    "emergencyBufferMonths",
    "Meses de gastos que quieres poder cubrir con liquidez antes de asumir más riesgo.",
  );
  addHelpToControl(
    "coreSpend",
    "Referencia calculada: media de gastos de detalle de los próximos 12 meses, excluyendo coche, deuda y proyectos.",
  );
  addHelpToControl("annualInflation", "Ajuste anual editable para encarecer o abaratar los gastos futuros.");
  addHelpToControl("carPayment", "Total previsto de cuotas de coche en los próximos 12 meses.");
  addHelpToControl("remainingHighRefiPayments", "Número de meses futuros con pagos de financiación/refinanciación.");
  addHelpToControl("refiFirstPayment", "Media mensual de financiación prevista durante los próximos 12 meses.");
  addHelpToControl("refiLaterPayment", "Importe total de financiación previsto en todo el horizonte de simulación.");
  addHelpToControl("recommendedSavings", "Ahorro mensual objetivo. El modelo lo aplica salvo que falte caja y esté activado el ajuste automático.");
  addHelpToControl("autoCapSavings", "Si la caja queda justa, reduce temporalmente el ahorro para no dejar la cuenta operativa en tensión.");
  addHelpToControl("detailMonth", "Este selector gobierna ingresos y gastos a la vez para que ambos bloques siempre hablen del mismo mes.");
  qs("incomeConceptEditor")?.setAttribute("data-help", "Añade ingresos extra para el mes seleccionado. El concepto entra en el detalle, el flujo y el simulador.");
  qs("expenseConceptEditor")?.setAttribute("data-help", "Añade gastos extra para el mes seleccionado. El concepto entra en el detalle, el flujo y el simulador.");

  document
    .querySelector(".scenario-buttons")
    ?.setAttribute("data-help", "Base mantiene el plan actual, Prudente baja ingresos y sube gastos, Ahorro alto exige más ahorro.");
  qs("downloadCsv")?.setAttribute("data-help", "Descarga el flujo mensual completo con importes con y sin proyectos.");
  qs("projectGlobalSummary")?.setAttribute("data-help", "Compara el recorrido completo con y sin proyectos, no solo el mes en que se cargan.");
  qs("cashflow")?.querySelector(".section-title")?.setAttribute("data-help", "Cada año se puede abrir y cada mes despliega el detalle de ingresos, gastos, deuda y proyectos.");
  qs("monthly-detail")
    ?.querySelector(".section-title")
    ?.setAttribute("data-help", "Aquí puedes registrar importes reales por línea. Esos reales alimentan el simulador y el flujo de caja.");
  qs("movementExcelFile")
    ?.closest(".movement-import-card")
    ?.setAttribute("data-help", "Importa un extracto bancario. La app aprende cómo relacionar cada movimiento con las partidas del Cuadro de mandos y usa el saldo más reciente como saldo real de CaixaBank.");
}

function applyScenario(name) {
  const a = baseData.assumptions;
  const labels = {
    base: "Base",
    prudente: "Prudente",
    ahorro: "Ahorro alto",
  };
  const scenarios = {
    base: {
      ...a,
      incomeFactor: 1,
      expenseFactor: 1,
      autoCapSavings: true,
    },
    prudente: {
      ...a,
      incomeFactor: 0.95,
      expenseFactor: 1.12,
      recommendedSavings: Math.max(800, Math.round((a.recommendedSavings * 0.65) / 50) * 50),
      annualInflation: 3.5,
      autoCapSavings: true,
    },
    ahorro: {
      ...a,
      incomeFactor: 1,
      expenseFactor: 0.9,
      recommendedSavings: Math.round((a.recommendedSavings * 1.2) / 50) * 50,
      emergencyBufferMonths: 3,
      autoCapSavings: true,
    },
  };
  const preservedBalance = {
    initialCash: state.initialCash,
    balanceDate: state.balanceDate,
    balanceMode: state.balanceMode,
  };
  currentScenario = labels[name];
  writeControls({ ...scenarios[name], ...preservedBalance });
  qs("scenarioName").textContent = currentScenario;
  document.querySelectorAll(".scenario-buttons button").forEach((button) => {
    button.classList.toggle("active", button.dataset.scenario === name);
  });
  render();
}

function simulate(projectOutflows = [], options = {}) {
  const rows = [];
  const start = modelStartDate();
  const startingBalances = accountBalancesFromState();
  let checking = startingBalances.caixa;
  let savings = startingBalances.mediolanum;

  for (let i = 0; i < modelMonthCount(); i += 1) {
    const date = addMonths(start, i);
    const detail = planningBreakdownForForecastMonth(i, date, options);
    const income =
      detail.income *
      (state.incomeFactor ?? 1) *
      Math.pow(1 + state.annualIncomeGrowth / 100, i / 12);
    const expenseMultiplier = (state.expenseFactor ?? 1) * Math.pow(1 + state.annualInflation / 100, i / 12);
    const variableOperationalSpend = detail.variableOperationalSpend * expenseMultiplier;
    const fixedCoreSpend = Math.max(0, detail.coreSpend - detail.variableOperationalSpend) * expenseMultiplier;
    const coreSpend = fixedCoreSpend + variableOperationalSpend;
    const carPayment = detail.car;
    const refi = detail.refi;
    const projectOutflow = Number(projectOutflows[i] || 0);
    const endOfMonthOutflows = detail.endOfMonthSpend * expenseMultiplier;
    const outflowsBeforeSaving = coreSpend + carPayment + refi + projectOutflow;
    const incomeEvents = detail.incomeEvents || [];
    const monthDate = dateFromMonthKey(detail.monthKey);
    const payrollDate = lastBusinessDayOfMonth(monthDate);
    const lastIncomeDay = incomeEvents.length ? Math.max(...incomeEvents.map((event) => Number(event.day || 1))) : payrollDate.getDate();
    const prePayrollIncome = detail.prePayrollIncome;
    const transferDateLabel = shortDate(payrollDate);
    const startChecking = checking;
    const startLiquidity = checking + savings;
    const availableBeforeSaving = checking + income - outflowsBeforeSaving;
    const oneMonthFloor = outflowsBeforeSaving;
    const plannedSaving = state.recommendedSavings;
    const appliedSaving = state.autoCapSavings
      ? Math.max(0, Math.min(plannedSaving, availableBeforeSaving - oneMonthFloor))
      : plannedSaving;
    checking = availableBeforeSaving - appliedSaving;
    savings += appliedSaving;
    const totalLiquidity = checking + savings;

    rows.push({
      index: i + 1,
      month: monthLabel(date),
      detailMonthKey: detail.monthKey,
      startChecking,
      startLiquidity,
      income,
      coreSpend,
      fixedCoreSpend,
      variableOperationalSpend,
      car: carPayment,
      refi,
      projectOutflow,
      outflowsBeforeSaving,
      endOfMonthOutflows,
      prePayrollIncome,
      incomeEvents,
      firstIncomeDateLabel: incomeEvents[0]?.dateLabel || dateWithMonthLabel(monthDate, 8),
      mainPayrollDateLabel: shortDate(payrollDate),
      lastIncomeDateLabel: dateWithMonthLabel(monthDate, lastIncomeDay),
      transferDateLabel,
      minDateLabel: dateWithMonthLabel(monthDate, 1),
      adjustedMinDateLabel: shortDate(payrollDate),
      saving: appliedSaving,
      checking,
      savings,
      totalLiquidity,
      netBeforeSaving: income - outflowsBeforeSaving,
    });
  }

  return rows;
}

function modelComputationSignature() {
  return JSON.stringify({
    end: `${MODEL_END_YEAR}-${MODEL_END_MONTH}`,
    source: baseData?.metadata?.generatedAt || baseData?.metadata?.sourceWorkbook || "",
    startDate: monthKey(modelStartDate()),
    planningMonths: baseData?.monthlyPlanning?.months?.length || 0,
    state: {
      initialCash: round2(state.initialCash),
      caixaBalance: round2(state.caixaBalance),
      mediolanumBalance: round2(state.mediolanumBalance),
      recommendedSavings: round2(state.recommendedSavings),
      annualInflation: round2(state.annualInflation),
      annualIncomeGrowth: round2(state.annualIncomeGrowth),
      emergencyBufferMonths: round2(state.emergencyBufferMonths),
      autoCapSavings: Boolean(state.autoCapSavings),
      incomeFactor: state.incomeFactor ?? 1,
      expenseFactor: state.expenseFactor ?? 1,
      balanceDate: state.balanceDate || "",
      balanceMode: state.balanceMode || "auto",
    },
    projects,
    debtLiquidations,
    savingsPlan: scenarioSettings.savingsPlan || {},
    incomeActuals,
    expenseActuals,
    customPlanningRows,
    deletedPlanningRows,
    seriesOverrides,
    rowLabelOverrides,
  });
}

function recomputeModelIfNeeded(force = false) {
  const nextSignature = modelComputationSignature();
  if (!force && simulationSignature === nextSignature && lastSimulation.length && lastBaseSimulation.length) {
    return;
  }
  simulationSignature = nextSignature;
  lastBaseSimulation = simulate();
  projectPlan = buildProjectSchedule();
  lastSimulation = simulate(projectPlan.outflows);
  lastPlannedSimulation = simulate(projectPlan.outflows, { useActuals: false });
}

function updateKpis(rows, baseRows = rows) {
  const first = rows[0];
  const last = rows[rows.length - 1];
  const baseLast = baseRows[baseRows.length - 1];
  const averageSaving = rows.reduce((sum, row) => sum + row.saving, 0) / rows.length;
  const firstOutflow = first.coreSpend + first.car + first.refi;
  const bufferMonths = state.initialCash / firstOutflow;
  const savingsRate = first.income ? averageSaving / first.income : 0;
  const oldCreditAverage = baseData.derived.oldCreditMonthlyAverageJanMar2026;
  qs("kpiInitial").textContent = money(state.initialCash, true);
  qs("kpiSurplus").textContent = money(first.netBeforeSaving, true);
  qs("kpiSaving").textContent = money(averageSaving, true);
  qs("kpiEnding").textContent = money(last.totalLiquidity, true);
  const endingDelta = last.totalLiquidity - baseLast.totalLiquidity;
  qs("kpiEndingDelta").textContent = projectPlan.placements.length
    ? `${endingDelta >= 0 ? "+" : ""}${money(endingDelta, true)} vs. sin decisiones`
    : "Sin decisiones cargadas";
  qs("kpiEndingDelta").className = endingDelta < 0 ? "negative" : "positive";
  qs("miniSavingsRate").textContent = `${(savingsRate * 100).toFixed(0)}%`;
  qs("miniRunway").textContent = bufferMonths.toFixed(1);
  qs("miniDebtShift").textContent = money(oldCreditAverage);

  if (first.netBeforeSaving <= 0) {
    qs("scenarioStatus").textContent = "Necesita ajustar gasto o ahorro antes de ejecutarlo.";
  } else if (bufferMonths < state.emergencyBufferMonths) {
    qs("scenarioStatus").textContent = "Viable, pero conviene reforzar colchón al inicio.";
  } else if (projectPlan.placements.length && endingDelta < 0) {
    qs("scenarioStatus").textContent = `Decisiones cargadas: impacto ${money(endingDelta)} al final.`;
  } else if (savingsRate > 0.35) {
    qs("scenarioStatus").textContent = "Ahorro potente; vigila tarjeta y gasto variable.";
  } else {
    qs("scenarioStatus").textContent = "Plan viable con ahorro controlado.";
  }

  qs("kpiSurplus").className = first.netBeforeSaving < 0 ? "negative" : "positive";
  qs("kpiEnding").className = last.totalLiquidity < state.initialCash ? "negative" : "positive";
}

function renderBalanceChart(rows, baseRows = rows) {
  const svg = qs("balanceChart");
  const width = svg.clientWidth || 900;
  const height = 340;
  const pad = { left: 62, right: 24, top: 24, bottom: 42 };
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";

  const series = [
    { key: "checking", label: "Cuenta", color: "#2c6be0" },
    { key: "savings", label: "Ahorro", color: "#267f4e" },
    { key: "totalLiquidity", label: "Total", color: "#6657d2" },
  ];
  const values = [
    ...rows.flatMap((row) => series.map((serie) => row[serie.key])),
    ...baseRows.map((row) => row.totalLiquidity),
  ];
  const min = Math.min(0, ...values);
  const max = Math.max(...values) * 1.04;
  const x = (i) => pad.left + (i / (rows.length - 1)) * (width - pad.left - pad.right);
  const y = (value) =>
    height - pad.bottom - ((value - min) / (max - min || 1)) * (height - pad.top - pad.bottom);

  for (let i = 0; i <= 4; i += 1) {
    const value = min + ((max - min) * i) / 4;
    const yy = y(value);
    svg.insertAdjacentHTML(
      "beforeend",
      `<line class="tick" x1="${pad.left}" x2="${width - pad.right}" y1="${yy}" y2="${yy}" />
       <text class="chart-label" x="8" y="${yy + 4}">${money(value)}</text>`,
    );
  }

  const areaPath = [
    ...rows.map((row, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(row.totalLiquidity).toFixed(2)}`),
    `L ${x(rows.length - 1).toFixed(2)} ${y(min).toFixed(2)}`,
    `L ${x(0).toFixed(2)} ${y(min).toFixed(2)}`,
    "Z",
  ].join(" ");
  svg.insertAdjacentHTML("beforeend", `<path d="${areaPath}" fill="#6657d2" opacity="0.08" />`);

  series.forEach((serie) => {
    const path = rows
      .map((row, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(row[serie.key]).toFixed(2)}`)
      .join(" ");
    svg.insertAdjacentHTML(
      "beforeend",
      `<path d="${path}" fill="none" stroke="${serie.color}" stroke-width="3" stroke-linecap="round" />`,
    );
  });

  const hasDecisionImpact = projectPlan.placements.length > 0;
  if (hasDecisionImpact) {
    const baselinePath = baseRows
      .map((row, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(row.totalLiquidity).toFixed(2)}`)
      .join(" ");
    svg.insertAdjacentHTML(
      "beforeend",
      `<path d="${baselinePath}" fill="none" stroke="#7a8890" stroke-width="2.5" stroke-dasharray="7 7" stroke-linecap="round" />`,
    );
  }

  series.forEach((serie) => {
    const lastIndex = rows.length - 1;
    svg.insertAdjacentHTML(
      "beforeend",
      `<circle cx="${x(lastIndex)}" cy="${y(rows[lastIndex][serie.key])}" r="4.5" fill="${serie.color}" stroke="#fff" stroke-width="2" />`,
    );
  });

  chartTickIndexes(rows).forEach((idx) => {
    svg.insertAdjacentHTML(
      "beforeend",
      `<text class="chart-label" x="${x(idx) - 18}" y="${height - 12}">${rows[idx].month}</text>`,
    );
  });

  const legendItems = hasDecisionImpact
    ? [
        { label: "Cuenta", color: "#2c6be0" },
        { label: "Ahorro", color: "#267f4e" },
        { label: "Total con", color: "#6657d2" },
        { label: "Total sin", color: "#7a8890", dashed: true },
      ]
    : series.map((serie) => ({ label: serie.label, color: serie.color }));

  legendItems.forEach((serie, idx) => {
    const x0 = width - pad.right - (hasDecisionImpact ? 330 : 230) + idx * (hasDecisionImpact ? 82 : 78);
    svg.insertAdjacentHTML(
      "beforeend",
      `${serie.dashed ? `<line x1="${x0 - 5}" x2="${x0 + 5}" y1="16" y2="16" stroke="${serie.color}" stroke-width="2.5" stroke-dasharray="4 3" />` : `<circle cx="${x0}" cy="16" r="5" fill="${serie.color}" />`}
       <text class="legend" x="${x0 + 9}" y="20">${serie.label}</text>`,
    );
  });
}

function renderCategoryChart() {
  const svg = qs("categoryChart");
  const width = svg.clientWidth || 420;
  const height = 330;
  const pad = { left: 142, right: 24, top: 12, bottom: 22 };
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";

  const wanted = new Set([
    "Suministros y telecom",
    "Vivienda/comunidad",
    "Efectivo",
    "Seguros",
    "Alimentacion",
    "Otros gastos",
  ]);
  const months = new Set(["2026-01", "2026-02", "2026-03"]);
  const grouped = new Map();
  baseData.categoryMonthly.forEach((row) => {
    if (!wanted.has(row.Categoria) || !months.has(row.month) || row.amount >= 0) return;
    grouped.set(row.Categoria, (grouped.get(row.Categoria) || 0) + Math.abs(row.amount) / 3);
  });

  const bars = [...grouped.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const max = Math.max(...bars.map((bar) => bar.value), 1);
  const barHeight = 28;
  const gap = 16;

  bars.forEach((bar, idx) => {
    const y = pad.top + idx * (barHeight + gap);
    const widthBar = ((width - pad.left - pad.right) * bar.value) / max;
    const valueX = Math.min(pad.left + widthBar + 8, width - 62);
    const color = ["#1f6feb", "#0f8f8c", "#248a50", "#c98216", "#6b5bd6", "#62717c"][idx % 6];
    svg.insertAdjacentHTML(
      "beforeend",
      `<text class="chart-label" x="0" y="${y + 19}">${bar.name}</text>
       <rect x="${pad.left}" y="${y}" width="${widthBar}" height="${barHeight}" rx="4" fill="${color}" />
       <text class="legend" x="${valueX}" y="${y + 19}">${money(bar.value)}</text>`,
    );
  });
}

function renderAdvice(rows, baseRows = rows) {
  const visibleRows = openSimulationRows(rows);
  if (visibleRows.length) {
    rows = visibleRows;
    baseRows = rows.map((row) => baseRows[(row.index || 1) - 1] || row);
  }
  const last = rows[rows.length - 1];
  const next12 = rows.slice(0, Math.min(12, rows.length));
  const avgSaving = rows.reduce((sum, row) => sum + row.saving, 0) / rows.length;
  const monthlyOutflow = averageRows(next12, (row) => row.coreSpend + row.car + row.refi);
  const avgNetBeforeSaving = averageRows(next12, (row) => row.netBeforeSaving);
  const bufferTarget = monthlyOutflow * state.emergencyBufferMonths;
  const bufferMonths = state.initialCash / monthlyOutflow;
  const avgIncome12 = averageRows(next12, (row) => row.income);
  const avgExpense12 = averageRows(next12, (row) => row.coreSpend + row.car + row.refi);
  const savingsRate = avgIncome12 ? avgSaving / avgIncome12 : 0;
  const projectImpact = rows[rows.length - 1].totalLiquidity - baseRows[baseRows.length - 1].totalLiquidity;
  const decisions = projectPlan.placements || [];
  const totalProjects = decisions.reduce((sum, project) => sum + decisionGrossCost(project), 0);
  const projectCount = decisions.filter((item) => item.source !== "debt").length;
  const debtCount = decisions.filter((item) => item.source === "debt").length;
  const minChecking = Math.min(...rows.map((row) => row.checking));
  const minCheckingRow = rows.find((row) => row.checking === minChecking) || rows[0];
  const list = [];

  if (avgNetBeforeSaving <= 0) {
    list.push({
      type: "danger",
      title: "El escenario no respira",
      body: `En la media de los próximos 12 meses faltan ${money(Math.abs(avgNetBeforeSaving), true)} antes de ahorrar. Baja gasto base o ahorro hasta que la caja mensual vuelva a positivo.`,
    });
  } else {
    list.push({
      type: "good",
      title: "Ahorro recomendado viable",
      body: `Con estos supuestos quedan ${money(avgNetBeforeSaving, true)} de media 12m antes de ahorrar. El objetivo de ${money(state.recommendedSavings, true)} deja margen operativo mensual.`,
    });
  }

  if (bufferMonths < state.emergencyBufferMonths) {
    list.push({
      type: "warning",
      title: "Prioriza colchón al principio",
      body: `La liquidez inicial cubre ${bufferMonths.toFixed(1)} meses. Tu objetivo de ${state.emergencyBufferMonths} meses equivale a ${money(bufferTarget, true)}.`,
    });
  } else {
    list.push({
      type: "good",
      title: "Colchón razonable",
      body: `La liquidez inicial supera el colchón objetivo de ${money(bufferTarget, true)} para este escenario.`,
    });
  }

  list.push({
    type: "good",
    title: "Detalle conectado al flujo",
    body: `El escenario mira el calendario futuro: media 12m de ${money(avgIncome12, true)} en ingresos y ${money(avgExpense12, true)} en gastos. Si introduces reales en un mes, sustituyen al previsto de esa línea.`,
  });

  if (decisions.length) {
    list.push({
      type: projectImpact < 0 ? "warning" : "good",
      title: "Decisiones coordinadas",
      body: `Hay ${projectCount} proyecto(s) y ${debtCount} decisión(es) de deuda por ${money(totalProjects, true)}. La liquidez final cambia ${projectImpact >= 0 ? "+" : ""}${money(projectImpact, true)} frente al escenario base.`,
    });
    list.push({
      type: minChecking < 0 ? "danger" : minChecking < monthlyOutflow * 0.4 ? "warning" : "good",
      title: "Semáforo de caja",
      body: `El punto de mayor tensión es ${minCheckingRow.month}, con ${money(minChecking, true)} en cuenta corriente tras aplicar proyectos, refinanciaciones y ahorro automático.`,
    });
  }

  if (savingsRate > 0.35) {
    list.push({
      type: "warning",
      title: "Ahorro ambicioso",
      body: `La tasa de ahorro ronda el ${(savingsRate * 100).toFixed(0)}%. Es potente, pero revisa tarjeta y gastos variables cada mes para no compensarlo con crédito.`,
    });
  } else {
    list.push({
      type: "good",
      title: "Ritmo sostenible",
      body: `La tasa de ahorro ronda el ${(savingsRate * 100).toFixed(0)}%, con liquidez total final proyectada de ${money(last.totalLiquidity, true)}.`,
    });
  }

  qs("adviceList").innerHTML = list
    .map(
      (item) =>
        `<div class="advice-item ${item.type}"><span>${adviceStatusLabel(item.type)}</span><strong>${item.title}</strong><p>${item.body}</p></div>`,
    )
    .join("");
}

function adviceStatusLabel(type) {
  if (type === "good") return "OK";
  if (type === "warning") return "Vigilar";
  return "Acción";
}

function forecastMonths() {
  const start = modelStartDate();
  return Array.from({ length: modelMonthCount() }, (_, i) => {
    const date = addMonths(start, i);
    return { index: i, key: monthKey(date), label: monthLabel(date) };
  });
}

function openMonthCutoffKey() {
  return monthKey(new Date());
}

function isClosedMonthKey(key) {
  return Boolean(key) && key < openMonthCutoffKey();
}

function openForecastMonths(months = forecastMonths()) {
  const open = months.filter((month) => !isClosedMonthKey(month.key));
  return open.length ? open : months.slice(-1);
}

function openSimulationItems(rows = lastSimulation, baseRows = rows) {
  return rows
    .map((row, index) => ({
      row,
      base: baseRows[index] || row,
      index,
    }))
    .filter((item) => !isClosedMonthKey(item.row.detailMonthKey));
}

function openSimulationRows(rows = lastSimulation) {
  return openSimulationItems(rows, rows).map((item) => item.row);
}

function firstOpenRows(rows = lastSimulation, count = 12) {
  const openRows = openSimulationRows(rows);
  return openRows.slice(0, Math.min(count, openRows.length));
}

function addProjectOutflow(outflows, project, startIndex) {
  const duration = Math.max(1, Number(project.duration || 1));
  const monthlyAmount = Number(project.amount || 0) / duration;
  for (let i = 0; i < duration; i += 1) {
    const index = startIndex + i;
    if (index >= 0 && index < outflows.length) {
      outflows[index] += monthlyAmount;
    }
  }
  const creditCapital = Math.max(0, Number(project.creditCapital || 0));
  if (creditCapital) {
    const index = Math.min(Math.max(Number(startIndex || 0), 0), outflows.length - 1);
    outflows[index] -= creditCapital;
  }
  const recurringAmount = Number(project.recurringAmount || 0);
  const recurringDuration = Math.max(0, Number(project.recurringDuration || 0));
  const recurringStartOffset = Math.max(0, Number(project.recurringStartOffset || 0));
  if (!recurringAmount || !recurringDuration) return;
  for (let i = 0; i < recurringDuration; i += 1) {
    const index = startIndex + recurringStartOffset + i;
    if (index >= 0 && index < outflows.length) {
      outflows[index] += recurringAmount;
    }
  }
}

function parseDebtMaturityIndex(value) {
  if (!value) return null;
  const text = String(value).trim().toLowerCase();
  const numeric = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  let date = null;
  if (numeric) {
    const month = Number(numeric[2]) - 1;
    const rawYear = Number(numeric[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    date = new Date(year, month, 1);
  } else {
    const monthNames = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "sep", "oct", "nov", "dic"];
    const match = text.match(/([a-záéíóúñ]{3,5})[-\s/]+(\d{2,4})/);
    if (match) {
      const normalized = match[1].normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const monthIndex = monthNames.findIndex((name) => normalized.startsWith(name));
      if (monthIndex >= 0) {
        const rawYear = Number(match[2]);
        const year = rawYear < 100 ? 2000 + rawYear : rawYear;
        date = new Date(year, monthIndex > 8 ? monthIndex - 1 : monthIndex, 1);
      }
    }
  }
  if (!date) return null;
  const start = modelStartDate();
  return (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth());
}

function debtTargetForDecision(item) {
  return debtPortfolioRows().find((row) => row.id === item?.targetId) || null;
}

function debtTargetIsSuspended(target) {
  return (
    Boolean(target) &&
    !target.reunified &&
    Number(target.currentPrincipal ?? target.principal ?? 0) > 0 &&
    Number(target.currentPayment || 0) <= 0
  );
}

function isDebtResumeMode(mode) {
  return mode === "retomar" || mode === "retomar-optimize";
}

function debtMonthlyReliefForMode(target, mode) {
  if (!target || isDebtResumeMode(mode) || debtTargetIsSuspended(target)) return 0;
  return round2(Number(target.currentPayment || target.payment || 0));
}

function effectiveDebtDecisionMonthlyRelief(item) {
  if (!item || isDebtResumeMode(item.payoffMode || item.mode)) return 0;
  const target = debtTargetForDecision(item);
  if (debtTargetIsSuspended(target)) return 0;
  return Math.max(0, Number(item.monthlyRelief || 0));
}

function monthDistance(fromDate, toDate) {
  return (toDate.getFullYear() - fromDate.getFullYear()) * 12 + (toDate.getMonth() - fromDate.getMonth());
}

function suspendedDebtArrearsMonths(startIndex = 0) {
  const arrearsStart = new Date(2026, 0, 1);
  const startDate = addMonths(modelStartDate(), Math.max(0, Number(startIndex || 0)));
  return Math.max(0, monthDistance(arrearsStart, startDate));
}

function debtResumeRemainingMonths(target, startIndex = 0) {
  const maturityIndex = parseDebtMaturityIndex(target?.maturity);
  if (maturityIndex !== null) return Math.max(0, maturityIndex - Number(startIndex || 0) + 1);
  const remainingInstallments = Number(target?.remainingInstallments || 0);
  if (remainingInstallments > 0) return Math.max(0, Math.ceil(remainingInstallments));
  const principal = Math.max(0, Number(target?.currentPrincipal ?? target?.principal ?? 0));
  const payment = Math.max(0, Number(target?.originalPayment || 0));
  return payment ? Math.max(1, Math.ceil(principal / payment)) : 0;
}

function debtResumePlan(target, startIndex = 0) {
  const originalPayment = round2(Number(target?.originalPayment || 0));
  const arrearsMonths = suspendedDebtArrearsMonths(startIndex);
  const arrears = round2(originalPayment * arrearsMonths);
  const recurringDuration = debtResumeRemainingMonths(target, startIndex);
  return {
    arrearsMonths,
    arrears,
    recurringAmount: originalPayment,
    recurringDuration,
    total: round2(arrears + originalPayment * recurringDuration),
  };
}

function resolvedDebtDecisionForStart(item, startIndex = 0) {
  if (!isDebtResumeMode(item?.payoffMode || item?.mode)) return item;
  const target = debtTargetForDecision(item) || item?.target || null;
  const plan = debtResumePlan(target, startIndex);
  return {
    ...item,
    amount: plan.arrears,
    duration: 1,
    recurringAmount: plan.recurringAmount,
    recurringDuration: plan.recurringDuration,
    recurringStartOffset: 0,
    monthlyRelief: 0,
    reliefMonths: 0,
    resumeArrearsMonths: plan.arrearsMonths,
    resumeTotalCost: plan.total,
  };
}

function debtReliefMonthsForItem(item, reliefStartIndex = 0) {
  const monthlyRelief = Math.max(0, Number(item?.monthlyRelief || 0));
  if (!monthlyRelief) return 0;
  if (isDebtResumeMode(item?.payoffMode || item?.mode)) return 0;
  const target = debtTargetForDecision(item);
  if (debtTargetIsSuspended(target)) return 0;
  if (Number.isFinite(Number(item?.reliefMonths)) && Number(item.reliefMonths) >= 0) {
    return Math.max(0, Math.floor(Number(item.reliefMonths)));
  }
  const maturityIndex = parseDebtMaturityIndex(target?.maturity);
  if (maturityIndex !== null) return Math.max(0, maturityIndex - reliefStartIndex + 1);
  const remainingInstallments = Number(target?.remainingInstallments ?? item?.remainingInstallments ?? 0);
  if (remainingInstallments > 0) return Math.max(0, Math.ceil(remainingInstallments - reliefStartIndex));
  const principal = Math.max(
    0,
    Number(item?.targetPrincipal ?? item?.originalPrincipal ?? target?.currentPrincipal ?? target?.principal ?? item?.amount ?? 0),
  );
  return Math.max(0, Math.ceil((principal + monthlyRelief * 2) / monthlyRelief));
}

function addDebtRelief(outflows, item, startIndex) {
  if (isDebtResumeMode(item?.payoffMode || item?.mode)) return;
  if (debtTargetIsSuspended(debtTargetForDecision(item))) return;
  const monthlyRelief = Math.max(0, Number(item.monthlyRelief || 0));
  if (!monthlyRelief) return;
  const duration = Math.max(1, Number(item.duration || 1));
  const reliefStart = Math.min(outflows.length, startIndex + duration);
  const reliefMonths = debtReliefMonthsForItem(item, reliefStart);
  if (!reliefMonths) return;
  const reliefEnd = Math.min(outflows.length, reliefStart + reliefMonths);
  for (let i = reliefStart; i < reliefEnd; i += 1) {
    outflows[i] -= monthlyRelief;
  }
}

function addScheduledDecisionOutflow(outflows, item, startIndex) {
  const resolvedItem = item.source === "debt" ? resolvedDebtDecisionForStart(item, startIndex) : item;
  addProjectOutflow(outflows, resolvedItem, startIndex);
  if (resolvedItem.source === "debt") addDebtRelief(outflows, resolvedItem, startIndex);
}

function decisionGrossCost(item) {
  return round2(Number(item.amount || 0) + Number(item.recurringAmount || 0) * Math.max(0, Number(item.recurringDuration || 0)));
}

function decisionCreditCapital(item) {
  return Math.max(0, Number(item?.creditCapital || 0));
}

function decisionNetCashCost(item) {
  return round2(decisionGrossCost(item) - decisionCreditCapital(item));
}

function projectKindLabel(item) {
  if (item?.projectKind === "external-credit" || decisionCreditCapital(item) > 0) {
    return `Crédito externo${item.creditOwner ? ` · ${item.creditOwner}` : ""}`;
  }
  return item?.source === "debt" ? "Deuda" : "Proyecto";
}

function inferDecisionOwner(item = {}) {
  const text = normalizedText(`${item.name || ""} ${item.label || ""} ${item.entity || ""} ${item.number || ""}`);
  if (text.includes("tere")) return "Tere";
  if (text.includes("javi") || text.includes("javier")) return "Javi";
  return "Hogar";
}

function decisionWindowMonths(item) {
  const initial = Math.max(1, Number(item.duration || 1));
  const recurring = Math.max(0, Number(item.recurringDuration || 0));
  const offset = Math.max(0, Number(item.recurringStartOffset || 0));
  return Math.max(initial, recurring ? offset + recurring : initial);
}

function decisionPeakMonthlyImpact(item) {
  const initialMonthly = Number(item.amount || 0) / Math.max(1, Number(item.duration || 1));
  return round2(Math.max(initialMonthly, Number(item.recurringAmount || 0)));
}

function evaluateOutflows(outflows) {
  const rows = simulate(outflows);
  return {
    rows,
    ending: rows[rows.length - 1].totalLiquidity,
    minChecking: Math.min(...rows.map((row) => row.checking)),
    minLiquidity: Math.min(...rows.map((row) => row.totalLiquidity)),
  };
}

function decisionBaselineOutflows(excludeId = null) {
  const months = forecastMonths();
  if (!excludeId || !projectPlan?.placements?.length) {
    return projectPlan?.outflows?.length === months.length ? projectPlan.outflows.slice() : Array(months.length).fill(0);
  }
  const outflows = Array(months.length).fill(0);
  projectPlan.placements
    .filter((item) => item.id !== excludeId)
    .forEach((item) => {
      addScheduledDecisionOutflow(outflows, item, Number(item.startIndex || 0));
    });
  return outflows;
}

function buildProjectSchedule() {
  const months = forecastMonths();
  const outflows = Array(months.length).fill(0);
  const placements = [];
  const optimizable = [];

  const scheduledItems = [
    ...projects.map((project) => ({ ...project, source: "project" })),
    ...debtLiquidations.map((item) => ({
      ...item,
      source: "debt",
      mode: item.mode === "spread" || item.mode === "refinance" ? "fixed" : item.mode,
      duration: item.duration || 1,
    })),
  ];

  scheduledItems.forEach((project) => {
    if (project.mode === "fixed") {
      const indexFromKey = project.monthKey
        ? months.findIndex((month) => month.key === project.monthKey)
        : -1;
      const startIndex =
        indexFromKey >= 0
          ? indexFromKey
          : Math.min(Math.max(Number(project.monthIndex || 0), 0), months.length - 1);
      const resolvedProject = project.source === "debt" ? resolvedDebtDecisionForStart(project, startIndex) : project;
      addScheduledDecisionOutflow(outflows, resolvedProject, startIndex);
      placements.push({ ...resolvedProject, startIndex, status: project.source === "debt" ? "debt" : "fixed", monthLabel: months[startIndex].label });
    } else {
      optimizable.push(project);
    }
  });

  optimizable
    .slice()
    .sort((a, b) => decisionPeakMonthlyImpact(b) - decisionPeakMonthlyImpact(a))
    .forEach((project) => {
      const duration = decisionWindowMonths(project);
      let best = null;
      for (let startIndex = 0; startIndex <= months.length - duration; startIndex += 1) {
        const candidate = outflows.slice();
        addScheduledDecisionOutflow(candidate, project, startIndex);
        const evaluation = evaluateOutflows(candidate);
        const feasible = evaluation.minChecking >= 0;
        const score =
          (feasible ? 1_000_000_000 : 0) +
          evaluation.minChecking * 1000 +
          evaluation.minLiquidity +
          evaluation.ending * 0.01 -
          startIndex;
        if (!best || score > best.score) {
          best = { startIndex, score, feasible, evaluation, candidate };
        }
      }
      if (best) {
        best.candidate.forEach((value, index) => {
          outflows[index] = value;
        });
        const resolvedProject = project.source === "debt" ? resolvedDebtDecisionForStart(project, best.startIndex) : project;
        placements.push({
          ...resolvedProject,
          startIndex: best.startIndex,
          status: best.feasible ? "optimized" : "warning",
          monthLabel: months[best.startIndex].label,
          minChecking: best.evaluation.minChecking,
        });
      }
    });

  placements.sort((a, b) => a.startIndex - b.startIndex);
  return { outflows, placements };
}

function evaluateProjectCandidate(project, mode = "full") {
  if (!lastBaseSimulation.length) return null;
  const months = forecastMonths();
  const baselineOutflows = decisionBaselineOutflows(project?.id);
  const baseline = evaluateOutflows(baselineOutflows);
  const duration = decisionWindowMonths(project);
  let best = null;
  debtCandidateMonths(months, mode).forEach((month) => {
    if (month.index > months.length - duration) return;
    const candidate = baselineOutflows.slice();
    addScheduledDecisionOutflow(candidate, { ...project, source: "project" }, month.index);
    const evaluation = evaluateOutflows(candidate);
    const netGain = evaluation.ending - baseline.ending;
    const feasible = evaluation.minChecking >= 0;
    const score =
      (feasible ? 1_000_000 : 0) +
      evaluation.minChecking * 0.45 +
      evaluation.minLiquidity * 0.08 +
      evaluation.ending * 0.01 -
      month.index * 6;
    if (!best || score > best.score) best = { month, evaluation, netGain, feasible, score };
  });
  return best;
}

function projectDecisionFromForm({
  title,
  amountOverride,
  durationOverride,
  recurringAmountOverride,
  recurringDurationOverride,
  recurringStartOffsetOverride,
  creditCapitalOverride,
  projectKindOverride,
  modeOverride,
  forceOptimize,
} = {}) {
  const name = qs("projectName").value.trim() || "Proyecto sin nombre";
  const projectKind = projectKindOverride || qs("projectKind")?.value || "standard";
  const creditOwner = qs("projectCreditOwner")?.value || "";
  const formAmount = parseAmount(qs("projectAmount").value) ?? 0;
  const amount = round2(amountOverride ?? formAmount);
  const duration = Math.max(1, Number(durationOverride ?? qs("projectDuration").value ?? 1));
  const recurringAmount = round2(recurringAmountOverride ?? (parseAmount(qs("projectRecurringAmount")?.value) ?? 0));
  const recurringDuration = Math.max(0, Number(recurringDurationOverride ?? qs("projectRecurringDuration")?.value ?? 0));
  const creditCapital = round2(creditCapitalOverride ?? (parseAmount(qs("projectCreditCapital")?.value) ?? 0));
  const recurringStartOffset =
    recurringStartOffsetOverride ?? (qs("projectRecurringDelay")?.value === "same" ? 0 : duration);
  const rawMode = modeOverride || document.querySelector('input[name="projectMode"]:checked')?.value || "optimize";
  const mode = forceOptimize ? "optimize" : rawMode;
  if ((!amount || amount <= 0) && (!recurringAmount || recurringAmount <= 0) && (!creditCapital || creditCapital <= 0)) return;
  const baseProject = {
    id: editingProjectId || `project-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    title: title || "Opción configurada",
    projectKind,
    creditOwner,
    creditCapital,
    amount,
    duration,
    recurringAmount,
    recurringDuration,
    recurringStartOffset,
    mode,
  };
  const best = mode === "optimize" ? evaluateProjectCandidate(baseProject) : null;
  const monthIndex =
    mode === "optimize"
      ? Number(best?.month?.index ?? qs("projectMonth").value ?? 0)
      : Number(qs("projectMonth").value || 0);
  const month = forecastMonths()[Math.max(0, Math.min(monthIndex, forecastMonths().length - 1))];
  return {
    ...baseProject,
    monthIndex: month?.index || 0,
    monthKey: month?.key,
    preview: best,
  };
}

function evaluateProjectDecisionItem(item) {
  const months = forecastMonths();
  const baselineOutflows = decisionBaselineOutflows(item?.id);
  const candidate = baselineOutflows.slice();
  addScheduledDecisionOutflow(candidate, { ...item, source: "project" }, item.monthIndex || 0);
  const baseline = evaluateOutflows(baselineOutflows);
  const evaluation = evaluateOutflows(candidate);
  return {
    evaluation,
    netGain: round2(evaluation.ending - baseline.ending),
    monthly: decisionPeakMonthlyImpact(item),
  };
}

function applyProjectDecision(project) {
  if (!project) return;
  const { preview, title, ...cleanProject } = project;
  const nextProject = {
    ...cleanProject,
    id: editingProjectId || `project-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  };
  if (editingProjectId) {
    const previous = projects.find((item) => item.id === editingProjectId);
    if (previous?.locked) return;
    projects = projects.map((item) =>
      item.id === editingProjectId ? { ...nextProject, locked: Boolean(item.locked), lockedAt: item.lockedAt } : item,
    );
    recordDecisionEvent("aprobado", { ...nextProject, source: "project" }, "Proyecto modificado desde el simulador.");
  } else {
    projects.push(nextProject);
    recordDecisionEvent("aprobado", { ...nextProject, source: "project" }, "Proyecto incorporado tras comparar alternativas.");
  }
  clearProjectForm();
  saveProjects();
  render();
}

function handleAddProject() {
  if (editingProjectId) {
    applyProjectDecision(projectDecisionFromForm());
    return;
  }
  pendingProjectDecision = projectDecisionFromForm();
  renderProjectDecisionReview(pendingProjectDecision);
  renderDecisionHistory();
}

function clearProjectForm() {
  editingProjectId = null;
  pendingProjectDecision = null;
  if (qs("projectKind")) qs("projectKind").value = "standard";
  if (qs("projectCreditOwner")) qs("projectCreditOwner").value = "Tere";
  if (qs("projectCreditCapital")) qs("projectCreditCapital").value = "";
  qs("projectName").value = "";
  qs("projectAmount").value = "";
  qs("projectDuration").value = 1;
  if (qs("projectRecurringAmount")) qs("projectRecurringAmount").value = "";
  if (qs("projectRecurringDuration")) qs("projectRecurringDuration").value = 0;
  if (qs("projectRecurringDelay")) qs("projectRecurringDelay").value = "after";
  document.querySelector('input[name="projectMode"][value="optimize"]').checked = true;
  updateProjectKindUi();
  updateProjectModeUi();
  renderProjectPlanPreview();
  renderProjectDecisionReview();
}

function projectReviewOptionCard(option, selected = false) {
  const klass = option.feasible ? "good" : "warn";
  return `<article class="debt-review-card project-review-card ${klass} ${selected ? "selected" : ""}">
    <span>${escapeHtml(option.title)}</span>
    <strong>${escapeHtml(option.monthLabel)} · ${money(option.monthly, true)}/mes</strong>
    <p>${escapeHtml(option.detail)}</p>
    ${option.creditCapital ? `<div><small>Capital prestado</small><b>${money(option.creditCapital, true)}</b></div>` : ""}
    <div>
      <small>Caja mínima</small><b>${money(option.minChecking, true)}</b>
    </div>
    <div>
      <small>Liquidez final</small><b>${option.netGain >= 0 ? "+" : ""}${money(option.netGain, true)}</b>
    </div>
    <button type="button" data-apply-project-option="${escapeHtml(option.key || "")}" data-amount="${escapeHtml(String(option.amountOverride ?? ""))}" data-credit-capital="${escapeHtml(String(option.creditCapital || 0))}" data-project-kind="${escapeHtml(option.projectKind || "")}" data-duration="${escapeHtml(String(option.duration || 1))}" data-recurring-amount="${escapeHtml(String(option.recurringAmount || 0))}" data-recurring-duration="${escapeHtml(String(option.recurringDuration || 0))}" data-recurring-offset="${escapeHtml(String(option.recurringStartOffset || 0))}" data-mode="${escapeHtml(option.mode || "optimize")}">
      ${selected ? "Aplicar opción original" : "Aplicar esta sugerencia"}
    </button>
  </article>`;
}

function projectReviewVariants(decision) {
  const baseAmount = Number(decision?.amount || 0);
  const creditBase = Number(decision?.creditCapital || 0);
  if (!baseAmount && !creditBase) return [];
  const variants = [
    {
      key: "single",
      title: "Pago único óptimo",
      detail: "Busca el mejor mes para pagar todo el importe de una vez.",
      amountOverride: baseAmount,
      duration: 1,
      recurringAmount: 0,
      recurringDuration: 0,
      recurringStartOffset: 0,
      mode: "optimize",
    },
    {
      key: "split-3",
      title: "Repartir 3 meses",
      detail: "Divide el importe inicial en tres pagos mensuales.",
      amountOverride: baseAmount,
      duration: 3,
      recurringAmount: 0,
      recurringDuration: 0,
      recurringStartOffset: 0,
      mode: "optimize",
    },
    {
      key: "split-6",
      title: "Repartir 6 meses",
      detail: "Reduce la presión mensual repartiendo el impacto.",
      amountOverride: baseAmount,
      duration: 6,
      recurringAmount: 0,
      recurringDuration: 0,
      recurringStartOffset: 0,
      mode: "optimize",
    },
    {
      key: "finance-12",
      title: "Financiar 12 meses",
      detail: "Sin pago inicial; convierte el proyecto en cuota mensual.",
      amountOverride: 0,
      duration: 1,
      recurringAmount: round2(baseAmount / 12),
      recurringDuration: 12,
      recurringStartOffset: 0,
      mode: "optimize",
    },
    {
      key: "finance-24",
      title: "Financiar 24 meses",
      detail: "Menor cuota mensual, impacto más largo en el plan.",
      amountOverride: 0,
      duration: 1,
      recurringAmount: round2(baseAmount / 24),
      recurringDuration: 24,
      recurringStartOffset: 0,
      mode: "optimize",
    },
  ];
  const financeBase = Math.max(baseAmount, creditBase);
  if (financeBase > 0) {
    variants.push(
      {
        key: "external-36",
        title: "Crédito externo 36 meses",
        detail: "Entrada inicial del capital y cuota a 36 meses para adelantar el proyecto.",
        amountOverride: baseAmount,
        creditCapital: financeBase,
        projectKind: "external-credit",
        duration: Math.max(1, Number(decision.duration || 1)),
        recurringAmount: round2(financeBase / 36),
        recurringDuration: 36,
        recurringStartOffset: 1,
        mode: "optimize",
      },
      {
        key: "external-60",
        title: "Crédito externo 60 meses",
        detail: "Mayor plazo, menor cuota; útil si la prioridad es proteger caja mensual.",
        amountOverride: baseAmount,
        creditCapital: financeBase,
        projectKind: "external-credit",
        duration: Math.max(1, Number(decision.duration || 1)),
        recurringAmount: round2(financeBase / 60),
        recurringDuration: 60,
        recurringStartOffset: 1,
        mode: "optimize",
      },
    );
  }
  return variants;
}

function renderProjectDecisionReview(decision = pendingProjectDecision) {
  const panel = qs("projectDecisionReview");
  if (!panel) return;
  if (!decision) {
    panel.innerHTML = `<div class="debt-review-empty">
      <strong>Compara antes de aplicar</strong>
      <p>Configura un proyecto y revisa alternativas de pago único, reparto o financiación. Nada impacta el dashboard hasta aplicar una opción.</p>
    </div>`;
    return;
  }
  const currentEval = evaluateProjectDecisionItem(decision);
  const currentMonth = forecastMonths()[decision.monthIndex]?.label || "-";
  const originalOption = {
    key: "original",
    title: "Opción original",
    detail: "Aplica exactamente la configuración que has introducido arriba.",
    amountOverride: decision.amount,
    creditCapital: decisionCreditCapital(decision),
    projectKind: decision.projectKind || "standard",
    duration: decision.duration,
    recurringAmount: decision.recurringAmount,
    recurringDuration: decision.recurringDuration,
    recurringStartOffset: decision.recurringStartOffset,
    mode: decision.mode,
    monthly: currentEval.monthly,
    minChecking: currentEval.evaluation.minChecking,
    netGain: currentEval.netGain,
    monthLabel: currentMonth,
    feasible: currentEval.evaluation.minChecking >= 0,
  };
  const variants = projectReviewVariants(decision)
    .map((option) => {
      const candidate = projectDecisionFromForm({
        title: option.title,
        amountOverride: option.amountOverride,
        durationOverride: option.duration,
        recurringAmountOverride: option.recurringAmount,
        recurringDurationOverride: option.recurringDuration,
        recurringStartOffsetOverride: option.recurringStartOffset,
        creditCapitalOverride: option.creditCapital || 0,
        projectKindOverride: option.projectKind || decision.projectKind || "standard",
        modeOverride: option.mode,
        forceOptimize: option.mode === "optimize",
      });
      if (!candidate) return null;
      const evaluation = evaluateProjectDecisionItem(candidate);
      return {
        ...option,
        monthly: evaluation.monthly,
        creditCapital: Number(candidate.creditCapital || 0),
        minChecking: evaluation.evaluation.minChecking,
        netGain: evaluation.netGain,
        monthLabel: forecastMonths()[candidate.monthIndex]?.label || "-",
        feasible: evaluation.evaluation.minChecking >= 0,
      };
    })
    .filter(Boolean);
  panel.innerHTML = `<div class="debt-review-head project-review-head">
      <div>
        <p class="panel-kicker">Revisión previa</p>
        <h4>${escapeHtml(decision.name)}</h4>
        <p>Compara formas de acometerlo antes de incorporarlo. Después podrás fijarlo en plan para convertirlo en definitivo.</p>
      </div>
      <div class="debt-review-badge">${decision.mode === "fixed" ? "mes manual" : "mes óptimo"} · ${currentMonth}</div>
    </div>
    <div class="debt-review-summary">
      <div><span>Coste total</span><strong>${money(decisionGrossCost(decision), true)}</strong></div>
      <div><span>Capital prestado</span><strong>${decisionCreditCapital(decision) ? money(decisionCreditCapital(decision), true) : "No"}</strong></div>
      <div><span>Impacto neto</span><strong>${decisionNetCashCost(decision) >= 0 ? "" : "+"}${money(decisionNetCashCost(decision), true)}</strong></div>
      <div><span>Opción seleccionada</span><strong>${money(currentEval.monthly, true)}/mes</strong></div>
      <div><span>Caja mínima</span><strong class="${currentEval.evaluation.minChecking < 0 ? "negative" : "positive"}">${money(currentEval.evaluation.minChecking, true)}</strong></div>
      <div><span>Liquidez final</span><strong>${currentEval.netGain >= 0 ? "+" : ""}${money(currentEval.netGain, true)}</strong></div>
      <div><span>Inicio</span><strong>${escapeHtml(currentMonth)}</strong></div>
      <div><span>Tipo</span><strong>${decision.recurringAmount ? "Con cuota" : "Sin cuota"}</strong></div>
    </div>
    <div class="debt-review-options project-review-options">
      ${projectReviewOptionCard(originalOption, true)}
      ${variants.map((option) => projectReviewOptionCard(option)).join("")}
    </div>`;
  panel.querySelectorAll("[data-apply-project-option]").forEach((button) => {
    button.addEventListener("click", () => applyProjectReviewOption(button));
  });
}

function applyProjectReviewOption(button) {
  const key = button.dataset.applyProjectOption;
  const decision =
    key === "original"
      ? pendingProjectDecision || projectDecisionFromForm()
      : projectDecisionFromForm({
          amountOverride: button.dataset.amount === "" ? undefined : Number(button.dataset.amount || 0),
          durationOverride: Number(button.dataset.duration || 1),
          recurringAmountOverride: Number(button.dataset.recurringAmount || 0),
          recurringDurationOverride: Number(button.dataset.recurringDuration || 0),
          recurringStartOffsetOverride: Number(button.dataset.recurringOffset || 0),
          creditCapitalOverride: Number(button.dataset.creditCapital || 0),
          projectKindOverride: button.dataset.projectKind || undefined,
          modeOverride: button.dataset.mode || "optimize",
          forceOptimize: true,
        });
  applyProjectDecision(decision);
}

function editProject(id) {
  const project = projects.find((item) => item.id === id);
  if (!project) return;
  if (project.locked) return;
  editingProjectId = id;
  if (qs("projectKind")) qs("projectKind").value = project.projectKind || (Number(project.creditCapital || 0) > 0 ? "external-credit" : "standard");
  if (qs("projectCreditOwner")) qs("projectCreditOwner").value = project.creditOwner || "Tere";
  if (qs("projectCreditCapital")) qs("projectCreditCapital").value = Number(project.creditCapital || 0) ? amountInputValue(project.creditCapital) : "";
  qs("projectName").value = project.name || "";
  qs("projectAmount").value = amountInputValue(Number(project.amount || 0));
  qs("projectDuration").value = Math.max(1, Number(project.duration || 1));
  if (qs("projectRecurringAmount")) qs("projectRecurringAmount").value = Number(project.recurringAmount || 0) ? amountInputValue(project.recurringAmount) : "";
  if (qs("projectRecurringDuration")) qs("projectRecurringDuration").value = Math.max(0, Number(project.recurringDuration || 0));
  if (qs("projectRecurringDelay")) {
    qs("projectRecurringDelay").value = Number(project.recurringStartOffset || 0) === 0 ? "same" : "after";
  }
  setProjectMode(project.mode === "fixed" ? "fixed" : "optimize");
  if (qs("projectMonth") && Number.isFinite(Number(project.monthIndex))) qs("projectMonth").value = Number(project.monthIndex);
  updateProjectKindUi();
  updateProjectModeUi();
  renderProjectPlanPreview();
  qs("projectName").focus();
}

function removeProject(id) {
  const project = projects.find((item) => item.id === id);
  if (project?.locked) return;
  if (editingProjectId === id) clearProjectForm();
  projects = projects.filter((project) => project.id !== id);
  recordDecisionEvent("cancelado", { ...project, source: "project" }, "Proyecto retirado del simulador.");
  saveProjects();
  render();
}

function removeDebtLiquidation(id) {
  const item = debtLiquidations.find((candidate) => candidate.id === id);
  if (item?.locked) return;
  debtLiquidations = debtLiquidations.filter((item) => item.id !== id);
  recordDecisionEvent("cancelado", { ...item, source: "debt" }, "Decisión de deuda retirada del plan.");
  saveDebtLiquidations();
  render();
}

function debtPortfolioRows() {
  return DEBT_PORTFOLIO;
}

function installmentLabel(row) {
  return row.remainingInstallments === null || row.remainingInstallments === undefined
    ? ""
    : ` · ${row.remainingInstallments} cuotas`;
}

function debtPortfolioTotals(rows = debtPortfolioRows()) {
  return {
    initialPrincipal: round2(sumRows(rows, (item) => item.initialPrincipal)),
    originalPayment: round2(sumRows(rows, (item) => item.originalPayment)),
    currentPayment: round2(CURRENT_REUNIFIED_DEBT_PAYMENT + sumRows(rows.filter((item) => !item.reunified), (item) => item.currentPayment)),
    amortized: round2(sumRows(rows, (item) => item.amortized)),
    currentPrincipal: round2(sumRows(rows, (item) => item.currentPrincipal)),
    reunifiedPrincipal: round2(sumRows(rows.filter((item) => item.reunified), (item) => item.initialPrincipal)),
    creditPrincipal: round2(sumRows(rows.filter((item) => normalizedText(item.type).includes("credito")), (item) => item.currentPrincipal)),
    cardPrincipal: round2(sumRows(rows.filter((item) => normalizedText(item.type).includes("tarjeta")), (item) => item.currentPrincipal)),
  };
}

function currentOutsideDebtPayment() {
  const start = modelStartDate();
  return round2(
    (baseData?.assumptions?.extraDebts || []).reduce((sum, item) => {
      if (!item?.endDate) return sum + Number(item.payment || 0);
      return new Date(item.endDate) >= start ? sum + Number(item.payment || 0) : sum;
    }, 0),
  );
}

function currentDebtPaymentBreakdown() {
  const unified = CURRENT_REUNIFIED_DEBT_PAYMENT;
  const outside = round2(sumRows(debtPortfolioRows().filter((item) => !item.reunified), (item) => item.currentPayment));
  return {
    unified: round2(unified),
    outside,
    total: round2(unified + outside),
  };
}

function debtTargetOptions({ includePlanned = false } = {}) {
  const alreadyPlanned = new Set(debtLiquidations.map((item) => item.targetId).filter(Boolean));
  return debtPortfolioRows()
    .filter((item) => Number(item.currentPrincipal || 0) > 0 && (includePlanned || !alreadyPlanned.has(item.id)))
    .map((item) => ({
      ...item,
      principal: item.currentPrincipal,
      payment: debtTargetIsSuspended(item) ? 0 : Number(item.currentPayment || 0),
      suspendedPayment: debtTargetIsSuspended(item),
    }));
}

function defaultDebtTargetId() {
  return debtTargetOptions()[0]?.id || "";
}

function selectedDebtTarget() {
  const targetId = qs("debtTargetSelect")?.value || defaultDebtTargetId();
  return debtTargetOptions({ includePlanned: true }).find((item) => item.id === targetId) || debtTargetOptions()[0];
}

function debtTargetById(targetId, { includePlanned = true } = {}) {
  return debtTargetOptions({ includePlanned }).find((item) => item.id === targetId) || null;
}

function populateDebtTargetSelect() {
  const select = qs("debtTargetSelect");
  if (!select) return;
  const previous = select.value;
  const hadOptions = select.options.length > 0;
  select.innerHTML = debtTargetOptions()
    .map((item) => {
      return `<option value="${escapeHtml(item.id)}">${escapeHtml(item.entity)} · ${escapeHtml(item.type)} · ${escapeHtml(item.number || "")} · ${money(item.currentPrincipal ?? item.principal, true)}</option>`;
    })
    .join("");
  select.value = [...select.options].some((option) => option.value === previous) ? previous : defaultDebtTargetId();
  if (!hadOptions) updateDebtTargetDefaults(false);
}

function debtTargetDisplayName(target) {
  if (!target) return "Liquidación deuda";
  if (target.id === "plan-unificado") return "Amortización plan refinanciado";
  const number = target.number ? ` ${target.number}` : "";
  return `Acuerdo ${target.entity} ${target.type}${number}`;
}

function updateDebtTargetDefaults(force = true) {
  const target = selectedDebtTarget();
  if (!target) return;
  if (force || !qs("debtPayoffName")?.value) {
    qs("debtPayoffName").value = debtTargetDisplayName(target);
  }
  const targetPrincipal = Number(target.currentPrincipal ?? target.principal ?? 0);
  if (force || !qs("debtPayoffAmount")?.value) qs("debtPayoffAmount").value = targetPrincipal ? targetPrincipal.toFixed(2) : "";
  const mode = qs("debtPayoffMode")?.value || "optimize";
  const monthlyRelief = debtMonthlyReliefForMode(target, mode);
  if (force || !qs("debtPayoffRelief")?.value) qs("debtPayoffRelief").value = monthlyRelief ? monthlyRelief.toFixed(2) : "0.00";
  renderDebtAgreementPreview();
}

function debtModeLabel(mode) {
  if (mode === "optimize") return "amortización óptima";
  if (mode === "fixed") return "amortización manual";
  if (mode === "spread") return "amortización fraccionada";
  if (mode === "spread-optimize") return "amortización fraccionada con inicio óptimo";
  if (mode === "retomar-optimize") return "retomar pagos con inicio óptimo";
  if (mode === "retomar") return "retomar pagos";
  if (mode === "refinance-optimize") return "reunificación con inicio óptimo";
  if (mode === "refinance") return "refinanciación";
  return "amortización manual";
}

function debtModeHelpText(mode) {
  if (mode === "spread" || mode === "spread-optimize") {
    return "Amortización fraccionada: reparte el importe pactado en varios meses. Si la deuda está suspendida, no suma cuota liberada como ingreso.";
  }
  if (mode === "retomar" || mode === "retomar-optimize") {
    return "Retomar: calcula atrasos desde enero de 2026, vuelve a pagar la cuota original y respeta el vencimiento inicial si está informado.";
  }
  if (mode === "refinance" || mode === "refinance-optimize") {
    return "Reunificación: sustituye la deuda por una cuota nueva repartida en el plazo indicado.";
  }
  return "Amortización: pago único para cerrar o reducir deuda en un mes. La opción óptima solo calcula el mejor mes; al confirmar queda fijada.";
}

function isDebtRefinanceMode(mode) {
  return mode === "refinance" || mode === "refinance-optimize";
}

function isDebtMultiMonthMode(mode) {
  return isDebtRefinanceMode(mode) || isDebtResumeMode(mode) || mode === "spread" || mode === "spread-optimize";
}

function updateDebtModeUi() {
  const mode = qs("debtPayoffMode")?.value || "optimize";
  const isMultiMonth = isDebtMultiMonthMode(mode);
  const locksDuration = isDebtResumeMode(mode);
  if (qs("debtPayoffDuration")) {
    qs("debtPayoffDuration").disabled = !isMultiMonth || locksDuration;
    if (!isMultiMonth) qs("debtPayoffDuration").value = 1;
  }
  const optimizesMonth = mode === "optimize" || mode === "refinance-optimize" || mode === "spread-optimize" || mode === "retomar-optimize";
  if (qs("debtPayoffMonth")) qs("debtPayoffMonth").disabled = optimizesMonth;
  qs("debtPayoffDuration")?.closest("label")?.classList.toggle("muted-control", !isMultiMonth || locksDuration);
  qs("debtPayoffMonth")?.closest("label")?.classList.toggle("muted-control", optimizesMonth);
  if (isDebtResumeMode(mode)) {
    const target = selectedDebtTarget();
    const startIndex = Number(qs("debtPayoffMonth")?.value || 0);
    const plan = debtResumePlan(target, startIndex);
    if (qs("debtPayoffAmount")) qs("debtPayoffAmount").value = plan.arrears.toFixed(2);
    if (qs("debtPayoffRelief")) qs("debtPayoffRelief").value = "0.00";
    if (qs("debtPayoffDuration")) qs("debtPayoffDuration").value = Math.max(1, plan.recurringDuration || 1);
  }
  if (qs("debtModeHelp")) qs("debtModeHelp").textContent = debtModeHelpText(mode);
  updateDebtConfirmState();
  renderDebtAgreementPreview();
}

function debtCandidateMonths(months = forecastMonths(), mode = "full") {
  if (mode === "priority") {
    return months.filter((month) => month.index < 24 || (month.index < 84 && month.index % 3 === 0) || month.index % 12 === 0);
  }
  return months.filter((month) => month.index < 36 || (month.index < 120 && month.index % 6 === 0) || month.index % 12 === 0);
}

function evaluateDebtCandidate(target, amount, relief, duration = 1, mode = "full", options = {}) {
  if (!lastBaseSimulation.length) return null;
  const months = forecastMonths();
  const baselineOutflows = projectPlan?.outflows?.length === months.length ? projectPlan.outflows : Array(months.length).fill(0);
  const baseline = evaluateOutflows(baselineOutflows);
  let best = null;
  debtCandidateMonths(months, mode).forEach((month) => {
    const candidate = baselineOutflows.slice();
    const item = options.resume
      ? {
          source: "debt",
          targetId: target?.id,
          payoffMode: "retomar-optimize",
          mode: "optimize",
          ...debtResumePlan(target, month.index),
        }
      : { source: "debt", amount, duration, monthlyRelief: relief, targetId: target?.id };
    if (options.resume) {
      item.amount = item.arrears;
      item.duration = 1;
      item.recurringAmount = Number(target?.originalPayment || 0);
      item.recurringStartOffset = 0;
      item.monthlyRelief = 0;
    }
    addScheduledDecisionOutflow(candidate, item, month.index);
    const evaluation = evaluateOutflows(candidate);
    const netGain = evaluation.ending - baseline.ending;
    const feasible = evaluation.minChecking > Math.max(0, relief);
    const discount = Math.max(0, Number(target?.currentPrincipal ?? target?.principal ?? 0) - Number(amount || 0));
    const totalCost = decisionGrossCost(item);
    const score = options.resume
      ? (feasible ? 1_000_000 : 0) + evaluation.minChecking * 0.25 - totalCost / 10 - month.index * 4
      : (feasible ? 1_000_000 : 0) + discount * 3 + Number(relief || 0) * 18 + evaluation.minChecking * 0.2 + netGain - month.index * 5;
    if (!best || score > best.score) best = { month, evaluation, netGain, feasible, score };
  });
  return best;
}

function debtDecisionModeFromRaw(rawMode) {
  return rawMode === "optimize" || rawMode === "refinance-optimize" || rawMode === "spread-optimize" || rawMode === "retomar-optimize" ? "optimize" : "fixed";
}

function debtDecisionDurationFromMode(rawMode) {
  return isDebtMultiMonthMode(rawMode) ? Math.max(1, Number(qs("debtPayoffDuration")?.value || 1)) : 1;
}

function debtDecisionFromValues({
  targetId,
  name,
  amount: amountValue,
  relief: reliefValue,
  rawMode = "optimize",
  monthIndex: monthIndexValue,
  duration: durationValue,
  forceOptimize = false,
} = {}) {
  const target = debtTargetById(targetId) || selectedDebtTarget();
  const resumeMode = isDebtResumeMode(rawMode);
  let amount = Number(amountValue);
  if (!Number.isFinite(amount)) amount = parseAmount(String(amountValue ?? ""));
  if (!resumeMode && (!amount || amount <= 0)) return null;
  const duration = resumeMode ? 1 : Math.max(1, Number(durationValue || 1));
  const defaultRelief = debtMonthlyReliefForMode(target, rawMode);
  let parsedRelief = Number(reliefValue);
  if (!Number.isFinite(parsedRelief)) parsedRelief = parseAmount(String(reliefValue ?? ""));
  const monthlyRelief = debtTargetIsSuspended(target) || resumeMode ? 0 : (parsedRelief ?? defaultRelief);
  const originalPrincipal = round2(Number(target?.currentPrincipal ?? target?.principal ?? amount));
  const optimized = forceOptimize || rawMode === "optimize" || rawMode === "refinance-optimize" || rawMode === "spread-optimize" || rawMode === "retomar-optimize";
  const best = optimized ? evaluateDebtCandidate(target, amount || originalPrincipal, monthlyRelief, duration, "full", { resume: resumeMode }) : null;
  const monthIndex = optimized
    ? Number(best?.month?.index ?? monthIndexValue ?? 0)
    : Number(monthIndexValue || 0);
  const month = forecastMonths()[Math.max(0, Math.min(monthIndex, forecastMonths().length - 1))];
  const resumePlan = resumeMode ? debtResumePlan(target, month?.index || 0) : null;
  if (resumeMode) amount = resumePlan.arrears;
  const reliefMonths = debtReliefMonthsForItem(
    {
      targetId: target?.id,
      targetPrincipal: originalPrincipal,
      originalPrincipal,
      monthlyRelief,
      remainingInstallments: target?.remainingInstallments,
    },
    (month?.index || 0) + duration,
  );
  return {
    id: `debt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: String(name || "").trim() || debtTargetDisplayName(target),
    amount: round2(amount),
    targetId: target?.id || defaultDebtTargetId(),
    targetPrincipal: originalPrincipal,
    originalPrincipal,
    discount: round2(Math.max(0, originalPrincipal - amount)),
    monthlyRelief: round2(monthlyRelief),
    reliefMonths,
    duration,
    recurringAmount: resumePlan ? resumePlan.recurringAmount : 0,
    recurringDuration: resumePlan ? resumePlan.recurringDuration : 0,
    recurringStartOffset: 0,
    resumeArrearsMonths: resumePlan ? resumePlan.arrearsMonths : 0,
    resumeTotalCost: resumePlan ? resumePlan.total : 0,
    mode: "fixed",
    payoffMode: rawMode,
    monthIndex: month?.index || 0,
    monthKey: month?.key,
    preview: best,
  };
}

function debtDecisionFromForm({ rawModeOverride, durationOverride, forceOptimize } = {}) {
  const rawMode = rawModeOverride || qs("debtPayoffMode")?.value || "optimize";
  return debtDecisionFromValues({
    targetId: qs("debtTargetSelect")?.value,
    name: qs("debtPayoffName")?.value,
    amount: parseAmount(qs("debtPayoffAmount")?.value),
    relief: parseAmount(qs("debtPayoffRelief")?.value),
    rawMode,
    monthIndex: Number(qs("debtPayoffMonth")?.value || 0),
    duration: durationOverride || debtDecisionDurationFromMode(rawMode),
    forceOptimize,
  });
}

function evaluateDebtDecisionItem(item) {
  const months = forecastMonths();
  const baselineOutflows = projectPlan?.outflows?.length === months.length ? projectPlan.outflows : Array(months.length).fill(0);
  const candidate = baselineOutflows.slice();
  addScheduledDecisionOutflow(candidate, { ...item, source: "debt" }, item.monthIndex || 0);
  const baseline = evaluateOutflows(baselineOutflows);
  const evaluation = evaluateOutflows(candidate);
  return {
    evaluation,
    netGain: round2(evaluation.ending - baseline.ending),
    monthly: decisionPeakMonthlyImpact(item),
  };
}

function updateDebtConfirmState() {
  const confirm = qs("addDebtPayoff");
  if (!confirm) return;
  confirm.disabled = !pendingDebtDecision;
  confirm.textContent = pendingDebtDecision ? "Confirmar y aplicar" : "Primero compara la decisión";
}

function debtReviewOptionCard(option, selected = false) {
  const klass = option.feasible ? "good" : "warn";
  return `<article class="debt-review-card ${klass} ${selected ? "selected" : ""}">
    <span>${escapeHtml(option.title)}</span>
    <strong>${escapeHtml(option.monthLabel)} · ${money(option.monthly, true)}/mes</strong>
    <p>${escapeHtml(option.detail)}</p>
    <div>
      <small>Caja mínima</small><b>${money(option.minChecking, true)}</b>
    </div>
    <div>
      <small>Liquidez final</small><b>${option.netGain >= 0 ? "+" : ""}${money(option.netGain, true)}</b>
    </div>
    <button type="button" data-apply-debt-option="${escapeHtml(option.key || "")}" data-raw-mode="${escapeHtml(option.rawMode || "")}" data-duration="${escapeHtml(String(option.duration || 1))}">
      ${selected ? "Aplicar opción original" : "Aplicar esta sugerencia"}
    </button>
  </article>`;
}

function resetDebtDecisionForm() {
  pendingDebtDecision = null;
  if (qs("debtPayoffName")) qs("debtPayoffName").value = "";
  if (qs("debtPayoffAmount")) qs("debtPayoffAmount").value = "";
  if (qs("debtPayoffRelief")) qs("debtPayoffRelief").value = "";
  if (qs("debtPayoffDuration")) qs("debtPayoffDuration").value = 1;
}

function applyDebtDecision(decision) {
  if (!decision) return;
  if (decision.targetId && debtLiquidations.some((item) => item.targetId === decision.targetId)) {
    if (qs("debtDecisionReview")) {
      qs("debtDecisionReview").innerHTML = `<div class="debt-review-empty">
        <strong>Decisión ya incorporada</strong>
        <p>Esta deuda ya tiene una decisión cargada. Elimínala o desbloquéala antes de volver a simularla.</p>
      </div>`;
    }
    updateDebtConfirmState();
    return;
  }
  const { preview, ...cleanDecision } = decision;
  const nextDecision = {
    ...cleanDecision,
    id: `debt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  };
  debtLiquidations.push(nextDecision);
  recordDecisionEvent("aprobado", { ...nextDecision, source: "debt" }, "Decisión de deuda incorporada tras revisión previa.");
  resetDebtDecisionForm();
  saveDebtLiquidations();
  render();
}

function applyDebtReviewOption(button) {
  const key = button.dataset.applyDebtOption;
  const decision =
    key === "original"
      ? pendingDebtDecision || debtDecisionFromForm()
      : debtDecisionFromForm({
          rawModeOverride: button.dataset.rawMode,
          durationOverride: Number(button.dataset.duration || 1),
          forceOptimize: true,
        });
  applyDebtDecision(decision);
}

function renderDebtDecisionReview(decision = pendingDebtDecision) {
  const panel = qs("debtDecisionReview");
  if (!panel) return;
  if (!decision) {
    panel.innerHTML = `<div class="debt-review-empty">
      <strong>Compara antes de aplicar</strong>
      <p>Elige deuda, importe pactado y modalidad. La decisión no afectará al resto de secciones hasta que confirmes.</p>
    </div>`;
    updateDebtConfirmState();
    return;
  }
  const target = selectedDebtTarget();
  const currentEval = evaluateDebtDecisionItem(decision);
  const targetPrincipal = Number(target?.currentPrincipal ?? target?.principal ?? decision.originalPrincipal ?? decision.amount);
  const suspended = debtTargetIsSuspended(target);
  const variants = [
    { title: "Pago único óptimo", rawMode: "optimize", duration: 1, detail: suspended ? "Liquida deuda suspendida; no genera alivio mensual porque hoy no se paga cuota." : "Liquida en un solo mes y elimina cuota después." },
    { title: "Fraccionar 6 meses", rawMode: "spread-optimize", duration: 6, detail: "Divide el importe pactado y busca inicio óptimo." },
    { title: "Reunificar 12 meses", rawMode: "refinance-optimize", duration: 12, detail: "Menos presión mensual, más tiempo hasta cerrar el acuerdo." },
    { title: "Reunificar 24 meses", rawMode: "refinance-optimize", duration: 24, detail: "Menor cuota mensual, impacto más suave en caja." },
    suspended
      ? { title: "Retomar pagos", rawMode: "retomar-optimize", duration: 1, detail: "Paga atrasos desde enero 2026 y retoma la cuota original hasta vencimiento." }
      : null,
  ]
    .filter(Boolean)
    .filter((option) => targetPrincipal > 0 || option.rawMode !== "optimize")
    .map((option) => {
      const candidate = debtDecisionFromForm({ rawModeOverride: option.rawMode, durationOverride: option.duration, forceOptimize: true });
      if (!candidate) return null;
      const evaluation = evaluateDebtDecisionItem(candidate);
      return {
        ...option,
        monthly: evaluation.monthly,
        minChecking: evaluation.evaluation.minChecking,
        netGain: evaluation.netGain,
        monthLabel: forecastMonths()[candidate.monthIndex]?.label || "-",
        feasible: evaluation.evaluation.minChecking >= 0,
      };
    })
    .filter(Boolean);
  const currentMonth = forecastMonths()[decision.monthIndex]?.label || "-";
  const discountPct = decision.originalPrincipal ? decision.discount / decision.originalPrincipal : 0;
  const resumeText = isDebtResumeMode(decision.payoffMode)
    ? `<p class="debt-review-note">Retomar no amortiza con quita: añade ${money(decision.amount, true)} de atrasos (${decision.resumeArrearsMonths || 0} mes(es)) y después ${money(decision.recurringAmount || 0, true)}/mes durante ${decision.recurringDuration || 0} mes(es), según el vencimiento inicial si existe.</p>`
    : suspended
      ? `<p class="debt-review-note">Pagos suspendidos: esta liquidación no crea flujo positivo posterior. La cuota original solo se usa si eliges “retomar”.</p>`
      : "";
  const originalOption = {
    key: "original",
    title: "Opción original",
    rawMode: decision.payoffMode,
    duration: decision.duration,
    detail: "Aplica exactamente la modalidad y el mes que has configurado arriba.",
    monthly: currentEval.monthly,
    minChecking: currentEval.evaluation.minChecking,
    netGain: currentEval.netGain,
    monthLabel: currentMonth,
    feasible: currentEval.evaluation.minChecking >= 0,
  };
  panel.innerHTML = `<div class="debt-review-head">
      <div>
        <p class="panel-kicker">Revisión previa</p>
        <h4>${escapeHtml(decision.name)}</h4>
        <p>Se aplicará al dashboard solo al confirmar. Objetivo: evitar duplicados y validar caja antes de comprometer la decisión.</p>
      </div>
      <div class="debt-review-badge">${debtModeLabel(decision.payoffMode)} · ${currentMonth}</div>
    </div>
    <div class="debt-review-summary">
      <div><span>Deuda original</span><strong>${money(decision.originalPrincipal, true)}</strong></div>
      <div><span>Importe pactado</span><strong>${money(decision.amount, true)}</strong></div>
      <div><span>Mejora</span><strong class="${decision.discount ? "positive" : ""}">${money(decision.discount, true)} · ${(discountPct * 100).toFixed(1)}%</strong></div>
      <div><span>Opción seleccionada</span><strong>${money(currentEval.monthly, true)}/mes</strong></div>
      <div><span>Caja mínima</span><strong class="${currentEval.evaluation.minChecking < 0 ? "negative" : "positive"}">${money(currentEval.evaluation.minChecking, true)}</strong></div>
      <div><span>Liquidez final</span><strong>${currentEval.netGain >= 0 ? "+" : ""}${money(currentEval.netGain, true)}</strong></div>
    </div>
    ${resumeText}
    <div class="debt-review-options">
      ${debtReviewOptionCard(originalOption, true)}
      ${variants.map((option) => debtReviewOptionCard({ ...option, key: "suggested" })).join("")}
    </div>`;
  panel.querySelectorAll("[data-apply-debt-option]").forEach((button) => {
    button.addEventListener("click", () => applyDebtReviewOption(button));
  });
  updateDebtConfirmState();
}

function stageDebtDecision() {
  pendingDebtDecision = debtDecisionFromForm();
  renderDebtDecisionReview(pendingDebtDecision);
}

function recommendedDebtDecision() {
  const target = selectedDebtTarget();
  const amount = parseAmount(qs("debtPayoffAmount")?.value) ?? Number(target?.principal || 0);
  const mode = qs("debtPayoffMode")?.value || "optimize";
  const relief = debtTargetIsSuspended(target) || isDebtResumeMode(mode)
    ? 0
    : (parseAmount(qs("debtPayoffRelief")?.value) ?? debtMonthlyReliefForMode(target, mode));
  const duration = isDebtMultiMonthMode(mode) ? Math.max(1, Number(qs("debtPayoffDuration")?.value || 1)) : 1;
  return evaluateDebtCandidate(target, amount, relief, duration, "full", { resume: isDebtResumeMode(mode) });
}

function renderDebtAgreementPreview() {
  const target = selectedDebtTarget();
  const element = qs("debtAgreementPreview");
  if (!target || !element) return;
  const original = Number(target.currentPrincipal ?? target.principal ?? 0);
  const agreed = parseAmount(qs("debtPayoffAmount")?.value) ?? original;
  const mode = qs("debtPayoffMode")?.value || "optimize";
  const relief = debtTargetIsSuspended(target) || isDebtResumeMode(mode)
    ? 0
    : (parseAmount(qs("debtPayoffRelief")?.value) ?? debtMonthlyReliefForMode(target, mode));
  const next12 = firstOpenRows(lastSimulation, 12);
  const income12 = next12.length
    ? averageRows(next12, (row) => row.income)
    : 0;
  const debt12 = next12.length
    ? averageRows(next12, (row) => row.car + row.refi)
    : 0;
  const ratioBefore = income12 ? debt12 / income12 : 0;
  const ratioAfter = income12 ? Math.max(0, debt12 - relief) / income12 : 0;
  const discount = Math.max(0, original - agreed);
  const discountPct = original ? discount / original : 0;
  element.innerHTML = `<div>
      <span>Deuda original</span><strong>${money(original, true)}</strong>
    </div>
    <div>
      <span>Importe pactado</span><strong>${money(agreed, true)}</strong>
    </div>
    <div>
      <span>Quita / mejora</span><strong class="${discount ? "positive" : ""}">${money(discount, true)} · ${(discountPct * 100).toFixed(1)}%</strong>
    </div>
    <div>
      <span>Ratio deuda</span><strong>${(ratioBefore * 100).toFixed(1)}% → ${(ratioAfter * 100).toFixed(1)}%</strong>
    </div>`;
}

function debtControlStats() {
  const portfolioTotals = debtPortfolioTotals();
  const currentPayment = currentDebtPaymentBreakdown();
  const oldDebt = portfolioTotals.initialPrincipal;
  const oldMonthly = portfolioTotals.originalPayment;
  const remainingPlanDebt = lastBaseSimulation.length ? sumRows(lastBaseSimulation, (row) => row.refi) : Number(baseData?.sourcePlan?.debtServiceMonthlyTotal || 0);
  const nextBase12 = firstOpenRows(lastBaseSimulation, 12);
  const currentMonthly12 = nextBase12.length
    ? averageRows(nextBase12, (row) => row.refi)
    : currentPayment.total;
  const liquidationTotal = debtLiquidations.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const principalCovered = debtLiquidations.reduce(
    (sum, item) => sum + (isDebtResumeMode(item.payoffMode || item.mode) ? 0 : Number(item.targetPrincipal || item.amount || 0)),
    0,
  );
  const relief = debtLiquidations.reduce((sum, item) => sum + effectiveDebtDecisionMonthlyRelief(item), 0);
  return {
    oldDebt,
    oldMonthly,
    portfolioTotals,
    currentPayment,
    remainingPlanDebt,
    currentMonthly12,
    liquidationTotal,
    principalAfterAgreements: Math.max(0, portfolioTotals.currentPrincipal - principalCovered),
    afterLiquidations: Math.max(0, remainingPlanDebt - liquidationTotal),
    monthlyAfterDecisions: Math.max(0, currentPayment.total - relief),
    monthlyRelief: Math.max(0, oldMonthly - currentMonthly12),
  };
}

function handleAddDebtLiquidation() {
  if (!pendingDebtDecision) {
    stageDebtDecision();
    return;
  }
  applyDebtDecision(pendingDebtDecision);
}

function debtPriorityCandidates() {
  const alreadyPlanned = new Set(debtLiquidations.map((item) => item.targetId).filter(Boolean));
  const rows = openSimulationRows(lastSimulation);
  return debtTargetOptions()
    .filter((target) => !alreadyPlanned.has(target.id))
    .map((target) => {
      const principal = Number(target.currentPrincipal ?? target.principal ?? 0);
      const payment = Number(target.payment || 0);
      const suggestedRow =
        rows.find((row) => Number(row.checking || 0) - principal > Math.max(0, Number(row.outflowsBeforeSaving || 0) * 0.35)) ||
        rows.find((row) => Number(row.totalLiquidity || 0) - principal > Math.max(0, Number(row.outflowsBeforeSaving || 0))) ||
        rows.at(-1);
      const pressure = principal ? payment / principal : 0;
      const monthPenalty = suggestedRow ? suggestedRow.index * 0.8 : 999;
      const priorityScore = pressure * 100000 + payment * 2 - principal / 1000 - monthPenalty;
      return { target, principal, payment, best: suggestedRow ? { month: { label: suggestedRow.month } } : null, priorityScore };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

function renderDebtPayoffChart() {
  const svg = qs("debtPayoffChart");
  if (!svg) return;
  const months = openForecastMonths(forecastMonths()).slice(0, 36);
  const values = months.map((month) =>
    projectPlan.placements
      .filter((item) => item.source === "debt")
      .reduce((sum, item) => sum + scheduledDecisionMonthlyImpact(item, month.index), 0),
  );
  const width = svg.clientWidth || 520;
  const height = 180;
  const pad = { left: 42, right: 12, top: 14, bottom: 34 };
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const max = Math.max(...values.map((value) => Math.abs(value)), 1);
  const zeroY = height - pad.bottom - (height - pad.top - pad.bottom) * 0.5;
  const barW = (width - pad.left - pad.right) / Math.max(values.length, 1);
  svg.innerHTML = values
    .map((value, index) => {
      const h = (((height - pad.top - pad.bottom) * 0.48) * Math.abs(value)) / max;
      const x = pad.left + index * barW + 2;
      const y = value >= 0 ? zeroY - h : zeroY;
      const label = index % 6 === 0 ? `<text class="chart-label" x="${x}" y="${height - 10}">${months[index].label}</text>` : "";
      return `<rect class="bar debt-bar ${value < 0 ? "saving" : ""}" x="${x}" y="${y}" width="${Math.max(3, barW - 4)}" height="${h}" rx="3"></rect>${label}`;
    })
    .join("") + `<line class="chart-grid-line" x1="${pad.left}" x2="${width - pad.right}" y1="${zeroY}" y2="${zeroY}"></line>`;
}

function renderDebtControl() {
  if (!qs("debtControlSummary")) return;
  populateDebtTargetSelect();
  updateDebtModeUi();
  const stats = debtControlStats();
  qs("debtControlSummary").innerHTML = [
    ["Capital inicial", money(stats.oldDebt, true), ""],
    ["Capital actual", money(stats.portfolioTotals.currentPrincipal, true), ""],
    ["Pago mensual anterior", money(stats.oldMonthly, true), "negative"],
    ["Pago mensual actual", money(stats.currentPayment.total, true), ""],
    ["Capital tras acuerdos", money(stats.principalAfterAgreements, true), stats.principalAfterAgreements < stats.portfolioTotals.currentPrincipal ? "positive" : ""],
    ["Tras decisiones", money(stats.monthlyAfterDecisions, true), stats.monthlyAfterDecisions < stats.currentPayment.total ? "positive" : ""],
  ]
    .map(([label, value, klass]) => `<div class="expense-summary-card"><span>${label}</span><strong class="${klass}">${value}</strong></div>`)
    .join("");

  if (qs("debtBreakdownCards")) {
    qs("debtBreakdownCards").innerHTML = [
      ["Reunificado", money(stats.portfolioTotals.reunifiedPrincipal, true), `${money(stats.currentPayment.unified, true)}/mes · ${CURRENT_REUNIFIED_DEBT_INSTALLMENTS} cuotas`],
      ["Capital actual", money(stats.portfolioTotals.currentPrincipal, true), "No reunificado pendiente"],
      ["Amortizado", money(stats.portfolioTotals.amortized, true), "Acuerdos ya aplicados"],
      ["Pago mensual actual", money(stats.currentPayment.total, true), "Desde mayo 2026"],
    ]
      .map(([label, value, detail]) => `<div class="debt-mini-card"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`)
      .join("");
  }

  if (qs("debtPortfolioTable")) {
    const rows = debtPortfolioRows();
    const grouped = new Map();
    rows.forEach((row) => {
      const displayType = row.reunified ? "Reunificado" : row.type;
      const key = `${row.entity}|${displayType}`;
      const current = grouped.get(key) || { entity: row.entity, type: displayType, initialPrincipal: 0, originalPayment: 0, currentPayment: 0, amortized: 0, currentPrincipal: 0, reunified: false, lines: [] };
      current.initialPrincipal += Number(row.initialPrincipal || 0);
      current.originalPayment += Number(row.originalPayment || 0);
      current.currentPayment = row.reunified ? Math.max(current.currentPayment, Number(row.currentPayment || 0)) : current.currentPayment + Number(row.currentPayment || 0);
      current.amortized += Number(row.amortized || 0);
      current.currentPrincipal += Number(row.currentPrincipal || 0);
      current.reunified = current.reunified || Boolean(row.reunified);
      current.lines.push(row);
      grouped.set(key, current);
    });
    qs("debtPortfolioTable").innerHTML = `<thead>
      <tr><th>Entidad / tipo</th><th>Capital inicial</th><th>Mensualidad original</th><th>Desde mayo 2026</th><th>Amortizado</th><th>Capital actual</th><th>Productos</th></tr>
    </thead><tbody>
      ${[...grouped.values()]
        .map((group) => {
          const details = group.lines
            .map((line) => `${line.number}${line.reunified ? " · reunificado" : ""}${installmentLabel(line)}`)
            .join("<br>");
          return `<tr>
            <td><strong>${escapeHtml(group.entity)}</strong><small>${escapeHtml(group.type)}</small></td>
            <td>${money(group.initialPrincipal, true)}</td>
            <td class="negative">${money(group.originalPayment, true)}</td>
            <td class="${group.currentPayment ? "negative" : ""}">${money(group.currentPayment, true)}</td>
            <td>${money(group.amortized, true)}</td>
            <td>${money(group.currentPrincipal, true)}</td>
            <td>${details}</td>
          </tr>`;
        })
        .join("")}
    </tbody>`;
  }

  if (qs("debtProductGrid")) {
    const activeRows = debtPortfolioRows().filter((row) => Number(row.currentPrincipal || 0) > 0 || row.reunified);
    qs("debtProductGrid").innerHTML = activeRows
      .map((row) => {
        const discount = Math.max(0, Number(row.initialPrincipal || 0) - Number(row.currentPrincipal || 0) - Number(row.amortized || 0));
        const suspended = debtTargetIsSuspended(row);
        const status = row.reunified ? "Reunificada" : suspended ? "Suspendida / pendiente de acuerdo" : Number(row.currentPrincipal || 0) > 0 ? "Viva" : "Saldada";
        const currentPaymentLabel = row.reunified
          ? `Incluida en ${money(CURRENT_REUNIFIED_DEBT_PAYMENT, true)}`
          : suspended
            ? "0,00 € suspendida"
            : money(row.currentPayment, true);
        return `<article class="debt-product-card ${row.reunified ? "reunified" : ""}">
          <div class="debt-product-title">
            <strong>${escapeHtml(row.entity)}</strong>
            <span>${escapeHtml(row.type)} · ${escapeHtml(row.number)}</span>
          </div>
          <div class="debt-product-metrics">
            <div><span>Inicial</span><strong>${money(row.initialPrincipal, true)}</strong></div>
            <div><span>Actual</span><strong>${money(row.currentPrincipal, true)}</strong></div>
            <div><span>Cuota antes</span><strong class="negative">${money(row.originalPayment, true)}</strong></div>
            <div><span>Cuota ahora</span><strong>${escapeHtml(currentPaymentLabel)}</strong></div>
          </div>
          <p><b>${escapeHtml(status)}</b>${installmentLabel(row)}${discount ? ` · mejora ${money(discount, true)}` : ""}</p>
        </article>`;
      })
      .join("");
  }

  if (qs("debtRecommendation")) {
    const recommendation = recommendedDebtDecision();
    qs("debtRecommendation").innerHTML = recommendation
      ? `<strong>${recommendation.feasible ? "Mejor hueco sugerido" : "Hueco menos malo"}</strong>
        <span>${escapeHtml(recommendation.month.label)} · calcula con proyectos cargados · impacto final ${money(recommendation.netGain, true)} · caja mínima ${money(recommendation.evaluation.minChecking, true)}</span>`
      : "<strong>Introduce una deuda</strong><span>El simulador propondrá mes y modalidad con impacto en caja.</span>";
  }
  renderDebtAgreementPreview();
  renderDebtDecisionReview();

  if (qs("debtPriorityPlan")) {
    const candidates = debtPriorityCandidates().slice(0, 5);
    qs("debtPriorityPlan").innerHTML = candidates.length
      ? `<div class="debt-priority-header"><strong>Prioridad recomendada</strong><span>Orden optimizado con proyectos ya cargados</span></div>${candidates
          .map((item, index) => `<div class="debt-priority-item">
            <span>${index + 1}</span>
            <div><strong>${escapeHtml(item.target.entity)} · ${escapeHtml(item.target.type)}</strong><small>${escapeHtml(item.target.number || "")} · ${money(item.principal, true)} · cuota ${money(item.payment, true)} · mes sugerido ${escapeHtml(item.best?.month?.label || "-")}</small></div>
          </div>`)
          .join("")}`
      : `<div class="debt-priority-header"><strong>Sin deuda viva fuera del plan</strong><span>No hay productos pendientes para priorizar.</span></div>`;
  }

  qs("debtPayoffList").innerHTML = debtLiquidations.length
    ? debtLiquidations
        .map((item) => {
          const monthly = decisionPeakMonthlyImpact(item);
          const placement = projectPlan.placements.find((candidate) => candidate.source === "debt" && candidate.id === item.id);
          const month = placement
            ? forecastMonths()[placement.startIndex]
            : forecastMonths().find((candidate) => candidate.key === item.monthKey) || forecastMonths()[item.monthIndex || 0];
          const resolvedItem = placement || resolvedDebtDecisionForStart(item, item.monthIndex || 0);
          const relief = effectiveDebtDecisionMonthlyRelief(item);
          const reliefMonths = debtReliefMonthsForItem(item, (placement?.startIndex ?? item.monthIndex ?? 0) + Math.max(1, Number(item.duration || 1)));
          const detail = isDebtResumeMode(item.payoffMode || item.mode)
            ? `${debtModeLabel(item.payoffMode || item.mode)} · atrasos ${money(resolvedItem.amount || 0, true)} (${resolvedItem.resumeArrearsMonths || 0} mes(es)) · retoma ${money(resolvedItem.recurringAmount || 0, true)}/mes durante ${resolvedItem.recurringDuration || 0} mes(es) · desde ${escapeHtml(placement?.monthLabel || month?.label || "")}.`
            : `${debtModeLabel(item.payoffMode || item.mode)} · pactado ${money(item.amount, true)} vs deuda ${money(item.originalPrincipal || item.targetPrincipal || item.amount, true)} · mejora ${money(item.discount || 0, true)} · desde ${escapeHtml(placement?.monthLabel || month?.label || "")}, ${item.duration} mes(es). Pago mensual: ${money(monthly, true)}. Cuota eliminada posterior: ${money(relief, true)} durante ${reliefMonths} mes(es).`;
          const actions = item.locked
            ? `<button class="lock-action" data-lock-debt-liquidation="${escapeHtml(item.id)}" data-lock-value="false">Desbloquear</button>`
            : `<button class="lock-action" data-lock-debt-liquidation="${escapeHtml(item.id)}" data-lock-value="true">Fijar en plan</button><button data-remove-debt-liquidation="${escapeHtml(item.id)}">Quitar</button>`;
          return `<div class="project-item debt-item ${item.locked ? "locked" : ""}">
            <div>
              <strong>${escapeHtml(item.name)} ${decisionLockedBadge(item)}</strong>
              <p>${detail}</p>
            </div>
            <div class="project-item-actions">${actions}</div>
          </div>`;
        })
        .join("")
    : '<div class="project-item"><div><strong>Sin liquidaciones cargadas</strong><p>Añade una liquidación para ver el impacto mensual y en el resto de secciones.</p></div></div>';

  document.querySelectorAll("[data-remove-debt-liquidation]").forEach((button) => {
    button.addEventListener("click", () => removeDebtLiquidation(button.dataset.removeDebtLiquidation));
  });
  document.querySelectorAll("[data-lock-debt-liquidation]").forEach((button) => {
    button.addEventListener("click", () =>
      setDecisionLocked("debt", button.dataset.lockDebtLiquidation, button.dataset.lockValue === "true"),
    );
  });
  renderDebtPayoffChart();
}

function handleClearProjects() {
  clearProjectForm();
  projects = projects.filter((project) => project.locked);
  saveProjects();
  render();
}

function renderProjectSimulator(baseRows, rows) {
  const baseEnding = baseRows[baseRows.length - 1].totalLiquidity;
  const ending = rows[rows.length - 1].totalLiquidity;
  const impact = ending - baseEnding;
  const totalProjects = projectPlan.placements.reduce((sum, project) => sum + decisionGrossCost(project), 0);
  const warningCount = projectPlan.placements.filter((item) => item.status === "warning").length;

  qs("projectSummary").innerHTML = [
    ["Impacto final", money(impact, true), impact < 0 ? "negative" : "positive"],
    ["Importe cargado", money(totalProjects, true), ""],
    ["Alertas de caja", String(warningCount), warningCount ? "negative" : "positive"],
  ]
    .map(
      ([label, value, klass]) =>
        `<div class="project-summary-card"><span>${label}</span><strong class="${klass}">${value}</strong></div>`,
    )
    .join("");

  renderProjectImpactChart(baseRows, rows);
  renderProjectGlobalImpact(baseRows, rows);
  renderProjectDecisionLedger(baseRows, rows);
  renderDecisionComparator(baseRows, rows);
  renderDecisionHistory();

  if (!projects.length && !debtLiquidations.length) {
    qs("projectList").innerHTML =
      '<div class="project-item"><div><strong>Sin decisiones cargadas</strong><p>Añade un plan con impacto puntual, recurrente o una decisión de deuda desde Control de deuda.</p></div></div>';
    return;
  }

  qs("projectList").innerHTML = projectPlan.placements
    .map((project) => {
      const monthly = decisionPeakMonthlyImpact(project);
      const totalCost = decisionGrossCost(project);
      const creditCapital = decisionCreditCapital(project);
      const netCost = decisionNetCashCost(project);
      const recurrenceText = Number(project.recurringAmount || 0)
        ? ` Cuota recurrente: ${money(project.recurringAmount, true)} durante ${project.recurringDuration} mes(es).`
        : "";
      const creditText = creditCapital
        ? ` Capital prestado: ${money(creditCapital, true)}${project.creditOwner ? ` (${escapeHtml(project.creditOwner)})` : ""}; impacto neto ${netCost >= 0 ? "" : "+"}${money(netCost, true)}.`
        : "";
      const statusText =
        project.status === "debt"
          ? "Liquidación de deuda programada"
          : project.status === "fixed"
          ? "Mes fijado manualmente"
          : project.status === "warning"
            ? "Sin hueco plenamente cómodo; colocado en el mejor mes disponible"
            : "Mes optimizado automáticamente";
      const source = project.source === "debt" ? "debt" : "project";
      const actions = project.locked
        ? `<button class="lock-action" data-lock-project="${escapeHtml(project.id)}" data-lock-project-source="${source}" data-lock-value="false">Desbloquear</button>`
        : source === "debt"
          ? `<button class="lock-action" data-lock-project="${escapeHtml(project.id)}" data-lock-project-source="debt" data-lock-value="true">Fijar en plan</button><button data-remove-project="${escapeHtml(project.id)}" data-remove-project-source="debt">Quitar</button>`
          : `<button data-edit-project="${escapeHtml(project.id)}">Editar</button><button class="lock-action" data-lock-project="${escapeHtml(project.id)}" data-lock-project-source="project" data-lock-value="true">Fijar en plan</button><button data-remove-project="${escapeHtml(project.id)}" data-remove-project-source="project">Quitar</button>`;
      return `<div class="project-item ${project.status === "warning" ? "warning" : ""} ${project.source === "debt" ? "debt-item" : ""} ${project.locked ? "locked" : ""}">
        <div>
          <strong>${escapeHtml(project.name)} ${decisionLockedBadge(project)}</strong>
          <p>${escapeHtml(projectKindLabel(project))} · ${money(totalCost, true)} total, desde ${project.monthLabel}. ${statusText}. Pico mensual: ${money(monthly, true)}.${creditText}${recurrenceText}</p>
        </div>
        <div class="project-item-actions">${actions}</div>
      </div>`;
    })
    .join("");

  document.querySelectorAll("[data-edit-project]").forEach((button) => {
    button.addEventListener("click", () => editProject(button.dataset.editProject));
  });
  document.querySelectorAll("[data-remove-project]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.removeProjectSource === "debt") removeDebtLiquidation(button.dataset.removeProject);
      else removeProject(button.dataset.removeProject);
    });
  });
  document.querySelectorAll("[data-lock-project]").forEach((button) => {
    button.addEventListener("click", () =>
      setDecisionLocked(button.dataset.lockProjectSource, button.dataset.lockProject, button.dataset.lockValue === "true"),
    );
  });
}

function decisionStatusLabel(item) {
  if (item.locked) return "Fijo en plan";
  if (item.executed) return "Ejecutado";
  if (item.cancelled) return "Cancelado";
  if (item.source === "debt") return "Aprobado · deuda";
  return item.mode === "fixed" ? "Aprobado · mes manual" : "Aprobado · mes óptimo";
}

function renderProjectDecisionLedger(baseRows, rows) {
  const target = qs("projectDecisionLedger");
  if (!target) return;
  const decisions = projectPlan.placements || [];
  const baseFinal = baseRows[baseRows.length - 1]?.totalLiquidity || 0;
  const final = rows[rows.length - 1]?.totalLiquidity || 0;
  const creditCapital = round2(sumRows(decisions, (item) => decisionCreditCapital(item)));
  const locked = decisions.filter((item) => item.locked).length;
  const pending = Math.max(0, decisions.length - locked);
  const freeCapacity = monthlyFreeCapacity(rows);
  const ownerSummary = decisionOwnerSummary(decisions);
  if (!decisions.length) {
    target.innerHTML = `<article class="decision-ledger-empty">
      <strong>Sin decisiones en curso</strong>
      <p>Añade un proyecto, crédito externo o acuerdo de deuda para comparar impacto antes de fijarlo.</p>
    </article>`;
    return;
  }
  const next = decisions
    .slice()
    .sort((a, b) => Number(a.startIndex || 0) - Number(b.startIndex || 0))[0];
  target.innerHTML = `<article class="decision-ledger-card">
      <div>
        <p class="panel-kicker">Centro de decisiones</p>
        <h4>${decisions.length} decisión(es) consideradas</h4>
        <p>${pending} pendiente(s), ${locked} fija(s). Impacto final ${final - baseFinal >= 0 ? "+" : ""}${money(final - baseFinal, true)}.</p>
      </div>
      <div class="decision-ledger-metrics">
        <span><b>${money(creditCapital, true)}</b><small>Capital externo</small></span>
        <span><b>${next ? escapeHtml(next.monthLabel) : "-"}</b><small>Siguiente impacto</small></span>
        <span><b>${money(Math.min(...rows.map((row) => row.checking)), true)}</b><small>Caja mínima</small></span>
        <span><b>${money(freeCapacity, true)}</b><small>Capacidad libre/mes</small></span>
      </div>
      <div class="decision-owner-strip">
        ${ownerSummary
          .map((item) => `<span><b>${escapeHtml(item.owner)}</b>${item.count} decisión(es) · ${money(item.creditCapital, true)} crédito</span>`)
          .join("")}
      </div>
    </article>
    <div class="decision-ledger-list">
      ${decisions
        .map(
          (item) => `<div class="decision-ledger-row ${item.locked ? "locked" : ""}">
            <span>${escapeHtml(decisionStatusLabel(item))}</span>
            <strong>${escapeHtml(item.name)}</strong>
            <small>${escapeHtml(projectKindLabel(item))} · ${escapeHtml(item.monthLabel || "")} · neto ${decisionNetCashCost(item) >= 0 ? "" : "+"}${money(decisionNetCashCost(item), true)}</small>
          </div>`,
        )
        .join("")}
    </div>`;
}

function monthlyFreeCapacity(rows) {
  const openRows = openSimulationRows(rows);
  const sample = (openRows.length ? openRows : rows).slice(0, 12);
  if (!sample.length) return 0;
  const avgNet = sumRows(sample, (row) => Number(row.netBeforeSaving || 0)) / sample.length;
  return round2(avgNet - Number(state?.recommendedSavings || 0));
}

function decisionOwnerSummary(decisions = []) {
  const owners = ["Javi", "Tere", "Hogar"];
  return owners.map((owner) => {
    const items = decisions.filter((item) => (item.creditOwner || inferDecisionOwner(item)) === owner);
    return {
      owner,
      count: items.length,
      creditCapital: round2(sumRows(items, (item) => decisionCreditCapital(item))),
      gross: round2(sumRows(items, (item) => decisionGrossCost(item))),
    };
  });
}

function decisionOutflowsForPlacements(placements) {
  const months = forecastMonths();
  const outflows = Array(months.length).fill(0);
  placements.forEach((item) => addScheduledDecisionOutflow(outflows, item, Number(item.startIndex || item.monthIndex || 0)));
  return outflows;
}

function decisionOutflowsExcluding(predicate) {
  const placements = projectPlan?.placements || [];
  return decisionOutflowsForPlacements(placements.filter((item) => !predicate(item)));
}

function decisionScenarioMetrics(label, placements) {
  const rows = simulate(decisionOutflowsForPlacements(placements));
  const minChecking = Math.min(...rows.map((row) => row.checking));
  const finalSavings = rows[rows.length - 1]?.savings || 0;
  const finalLiquidity = rows[rows.length - 1]?.totalLiquidity || 0;
  const debtPaid = round2(sumRows(placements.filter((item) => item.source === "debt"), (item) => Number(item.amount || item.principal || 0)));
  const debtRemaining = Math.max(0, round2(debtPortfolioTotals().currentPrincipal - debtPaid));
  const firstImpact = placements
    .slice()
    .sort((a, b) => Number(a.startIndex || 0) - Number(b.startIndex || 0))
    .find((item) => decisionGrossCost(item) || decisionCreditCapital(item));
  return {
    label,
    rows,
    minChecking,
    finalSavings,
    finalLiquidity,
    debtRemaining,
    firstImpactLabel: firstImpact?.monthLabel || "-",
  };
}

function renderDecisionComparator(baseRows, rows) {
  const target = qs("decisionComparator");
  if (!target) return;
  const placements = projectPlan.placements || [];
  const noExternalCredit = placements.filter((item) => decisionCreditCapital(item) <= 0 && item.projectKind !== "external-credit");
  const tereCredit = placements.filter(
    (item) => item.source !== "debt" && (decisionCreditCapital(item) <= 0 || (item.creditOwner || inferDecisionOwner(item)) === "Tere"),
  );
  const allLoaded = placements;
  const scenarios = [
    decisionScenarioMetrics("Sin crédito externo", noExternalCredit),
    decisionScenarioMetrics("Con crédito de Tere", tereCredit),
    decisionScenarioMetrics("Crédito + deuda", allLoaded),
  ];
  const bestMin = Math.max(...scenarios.map((item) => item.minChecking));
  target.innerHTML = `<article class="decision-comparator-card">
    <div class="decision-comparator-head">
      <div>
        <p class="panel-kicker">Comparador global</p>
        <h4>3 escenarios completos</h4>
        <p>Caja mínima, ahorro final y deuda pendiente en una lectura única.</p>
      </div>
      <strong>Mejor caja: ${money(bestMin, true)}</strong>
    </div>
    <div class="decision-comparison-table" role="table" aria-label="Comparador de escenarios">
      <div class="decision-comparison-header" role="row">
        <span>Escenario</span>
        <span>Caja mínima</span>
        <span>Ahorro final</span>
        <span>Deuda pendiente</span>
        <span>Primer impacto</span>
      </div>
      ${scenarios
        .map(
          (item) => `<div class="decision-comparison-row ${item.minChecking === bestMin ? "best" : ""}" role="row">
            <strong>${escapeHtml(item.label)}</strong>
            <b>${money(item.minChecking, true)}</b>
            <span>${money(item.finalSavings, true)}</span>
            <span>${money(item.debtRemaining, true)}</span>
            <span>${escapeHtml(item.firstImpactLabel)}</span>
          </div>`,
        )
        .join("")}
    </div>
  </article>
  ${renderExecutiveDecisionAlerts(rows)}`;
}

function renderExecutiveDecisionAlerts(rows) {
  const openRows = openSimulationRows(rows);
  const visibleRows = openRows.length ? openRows : rows;
  const minChecking = visibleRows.length ? Math.min(...visibleRows.map((row) => row.checking)) : 0;
  const avgIncome = averageRows(visibleRows.slice(0, 12), (row) => row.income);
  const debtRatio = avgIncome ? (currentDebtPaymentBreakdown().total / avgIncome) * 100 : 0;
  const bestAgreement = agentDebtPayoffCandidates().sort((a, b) => Number(b.agreementSavings || 0) - Number(a.agreementSavings || 0))[0];
  const alerts = [
    {
      tone: minChecking < agentCaixaFloor() ? "danger" : "good",
      text: `No ejecutar proyectos si CaixaBank baja de ${money(agentCaixaFloor(), true)}. Mínimo actual: ${money(minChecking, true)}.`,
    },
    {
      tone: debtRatio > 32 ? "danger" : "good",
      text: `No aceptar financiación si el ratio deuda supera 32%. Ratio actual estimado: ${debtRatio.toFixed(1)}%.`,
    },
    {
      tone: bestAgreement?.agreementSavings > 0 ? "warn" : "good",
      text: bestAgreement?.agreementSavings > 0
        ? `Priorizar deuda antes de proyecto si la mejora supera ${money(bestAgreement.agreementSavings, true)} (${bestAgreement.entity}).`
        : "Sin quitas detectadas pendientes por encima del criterio actual.",
    },
  ];
  return `<article class="decision-alerts-card">
    <p class="panel-kicker">Alertas ejecutivas</p>
    <div>
      ${alerts.map((item) => `<span class="${item.tone}">${escapeHtml(item.text)}</span>`).join("")}
    </div>
  </article>`;
}

function renderDecisionHistory() {
  const target = qs("decisionHistory");
  if (!target) return;
  const current = (projectPlan.placements || []).map((item) => ({
    date: item.lockedAt || "",
    name: item.name,
    status: decisionStatusLabel(item),
    amount: decisionGrossCost(item),
    monthLabel: item.monthLabel,
    owner: item.creditOwner || inferDecisionOwner(item),
  }));
  if (pendingProjectDecision) {
    current.unshift({
      date: "",
      name: pendingProjectDecision.name,
      status: "Simulado · pendiente de decidir",
      amount: decisionGrossCost(pendingProjectDecision),
      monthLabel: forecastMonths()[pendingProjectDecision.monthIndex || 0]?.label || "",
      owner: pendingProjectDecision.creditOwner || inferDecisionOwner(pendingProjectDecision),
    });
  }
  if (pendingDebtDecision) {
    current.unshift({
      date: "",
      name: pendingDebtDecision.name,
      status: "Simulado · pendiente de decidir",
      amount: decisionGrossCost(pendingDebtDecision),
      monthLabel: forecastMonths()[pendingDebtDecision.monthIndex || 0]?.label || "",
      owner: inferDecisionOwner(pendingDebtDecision),
    });
  }
  const events = decisionEvents.slice(0, 12);
  target.innerHTML = `<article class="decision-history-card">
    <div class="decision-history-head">
      <div>
        <p class="panel-kicker">Registro de decisiones</p>
        <h4>Historial y estados</h4>
        <p>Simulado, aprobado, fijo, ejecutado o cancelado queda visible para evitar duplicados.</p>
      </div>
      <strong>${current.length} activas</strong>
    </div>
    <div class="decision-history-columns">
      <div>
        <span>Estado actual</span>
        ${current.length ? current
          .map((item) => `<p><b>${escapeHtml(item.status)}</b> · ${escapeHtml(item.name)} · ${escapeHtml(item.owner)} · ${money(item.amount, true)} · ${escapeHtml(item.monthLabel || "-")}</p>`)
          .join("") : "<p>Sin decisiones activas.</p>"}
      </div>
      <div>
        <span>Últimos movimientos</span>
        ${events.length ? events
          .map((item) => `<p><b>${escapeHtml(item.status)}</b> · ${escapeHtml(item.name)} · ${escapeHtml(item.owner || "Hogar")} · ${money(item.amount, true)} · ${escapeHtml(item.note || "")}</p>`)
          .join("") : "<p>Aún no hay historial guardado.</p>"}
      </div>
    </div>
  </article>`;
}

function renderProjectGlobalImpact(baseRows, rows) {
  const lastIndex = rows.length - 1;
  const idx12 = Math.min(12, lastIndex);
  const idx24 = Math.min(24, lastIndex);
  const deltas = rows.map((row, index) => row.totalLiquidity - (baseRows[index]?.totalLiquidity || row.totalLiquidity));
  const impact12 = deltas[idx12] || 0;
  const impact24 = deltas[idx24] || 0;
  const impactFinal = deltas[lastIndex] || 0;
  const minChecking = Math.min(...rows.map((row) => row.checking));
  const minCheckingRow = rows.find((row) => row.checking === minChecking) || rows[0];
  const maxAbsMonthlyImpact = Math.max(...rows.map((row) => Math.abs(row.projectOutflow || 0)), 0);

  qs("projectGlobalSummary").innerHTML = [
    ["Impacto 12m", money(impact12, true), impact12 < 0 ? "negative" : "positive"],
    ["Impacto 24m", money(impact24, true), impact24 < 0 ? "negative" : "positive"],
    ["Impacto final", money(impactFinal, true), impactFinal < 0 ? "negative" : "positive"],
    [`Peor caja (${minCheckingRow.month})`, money(minChecking, true), minChecking < 0 ? "negative" : ""],
  ]
    .map(
      ([label, value, klass]) =>
        `<div class="global-impact-card"><span>${label}</span><strong class="${klass}">${value}</strong></div>`,
    )
    .join("");

  renderProjectGlobalChart(baseRows, rows);
  renderScenarioSensitivity(baseRows, rows);

  const impactedMonths = rows
    .map((row, index) => ({ row, index }))
    .filter((item) => Math.abs(item.row.projectOutflow || 0) > 0)
    .slice(0, 7);

  qs("projectGlobalTimeline").innerHTML = impactedMonths.length
    ? impactedMonths
        .map(({ row }) => {
          const width = maxAbsMonthlyImpact ? Math.max(4, (Math.abs(row.projectOutflow) / maxAbsMonthlyImpact) * 100) : 0;
          const delta = row.totalLiquidity - (baseRows[row.index - 1]?.totalLiquidity || row.totalLiquidity);
          return `<div class="timeline-item">
            <span>${row.month}</span>
            <div class="timeline-bar ${row.projectOutflow < 0 ? "saving" : ""}"><i style="width:${width.toFixed(1)}%"></i></div>
            <strong class="${delta < 0 ? "negative" : "positive"}">${money(delta, true)}</strong>
          </div>`;
        })
        .join("")
    : '<p class="month-detail-empty">Sin decisiones cargadas: la curva coincide con el escenario base.</p>';
}

function renderScenarioSensitivity(baseRows, rows) {
  const panel = qs("scenarioSensitivity");
  if (!panel || !rows.length) return;
  const plannedTotal = sumRows(rows, () => Number(state.recommendedSavings || 0));
  const appliedTotal = sumRows(rows, (row) => row.saving);
  const adjustedMonths = rows.filter((row) => Math.abs(row.saving - Number(state.recommendedSavings || 0)) > 0.01).length;
  const withheld = round2(plannedTotal - appliedTotal);
  const metrics = rangeKpiMetric(rows);
  const baseMetrics = rangeKpiMetric(baseRows);
  const avgChecking = round2(averageRows(rows, (row) => row.checking));
  const minDelta = metrics && baseMetrics ? metrics.min - baseMetrics.min : 0;
  panel.innerHTML = `<div class="scenario-sensitivity-head">
      <div>
        <p class="panel-kicker">Caja y ahorro automático</p>
        <h4>Qué cambia si falta caja</h4>
      </div>
      <span class="${state.autoCapSavings ? "positive" : "negative"}">${state.autoCapSavings ? "Activo" : "Desactivado"}</span>
    </div>
    <div class="scenario-sensitivity-grid">
      <div><span>Ahorro objetivo total</span><strong>${money(plannedTotal, true)}</strong></div>
      <div><span>Ahorro aplicado</span><strong>${money(appliedTotal, true)}</strong></div>
      <div><span>No aplicado por caja</span><strong class="${withheld > 0 ? "negative" : "positive"}">${money(withheld, true)}</strong></div>
      <div><span>Meses ajustados</span><strong>${adjustedMonths}</strong></div>
      <div><span>Mínimo caja</span><strong class="${metrics?.min < 0 ? "negative" : ""}">${metrics ? money(metrics.min, true) : "-"}</strong></div>
      <div><span>Mínimo ajustado</span><strong>${metrics ? money(metrics.adjustedMin, true) : "-"}</strong></div>
      <div><span>Máximo liquidez</span><strong>${metrics ? money(metrics.max, true) : "-"}</strong></div>
      <div><span>Caja media</span><strong>${money(avgChecking, true)}</strong></div>
    </div>
    <p>El mínimo cambia ${minDelta >= 0 ? "+" : ""}${money(minDelta, true)} frente al escenario sin decisiones. Si el ajuste automático está activo, el ahorro se reduce solo cuando la cuenta se queda demasiado justa.</p>`;
}

function renderProjectGlobalChart(baseRows, rows) {
  const svg = qs("projectGlobalChart");
  const width = svg.clientWidth || 430;
  const height = 245;
  const pad = { left: 52, right: 18, top: 16, bottom: 34 };
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";

  const values = [...rows.map((row) => row.totalLiquidity), ...baseRows.map((row) => row.totalLiquidity)];
  const min = Math.min(0, ...values);
  const max = Math.max(...values) * 1.04;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (i) => pad.left + (i / (rows.length - 1 || 1)) * plotW;
  const y = (value) => height - pad.bottom - ((value - min) / (max - min || 1)) * plotH;

  for (let i = 0; i <= 3; i += 1) {
    const value = min + ((max - min) * i) / 3;
    const yy = y(value);
    svg.insertAdjacentHTML(
      "beforeend",
      `<line class="tick" x1="${pad.left}" x2="${width - pad.right}" y1="${yy}" y2="${yy}" />
       <text class="chart-label" x="0" y="${yy + 4}">${money(value)}</text>`,
    );
  }

  const pathFor = (items, key) =>
    items
      .map((row, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${y(row[key]).toFixed(2)}`)
      .join(" ");

  const impactArea = [
    ...rows.map((row, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${y(row.totalLiquidity).toFixed(2)}`),
    ...baseRows
      .slice()
      .reverse()
      .map((row, reverseIndex) => {
        const index = baseRows.length - 1 - reverseIndex;
        return `L ${x(index).toFixed(2)} ${y(row.totalLiquidity).toFixed(2)}`;
      }),
    "Z",
  ].join(" ");

  if (projectPlan.placements.length) {
    svg.insertAdjacentHTML("beforeend", `<path d="${impactArea}" fill="#c44945" opacity="0.08" />`);
  }

  svg.insertAdjacentHTML(
    "beforeend",
    `<path d="${pathFor(baseRows, "totalLiquidity")}" fill="none" stroke="#7a8890" stroke-width="2.2" stroke-dasharray="6 6" stroke-linecap="round" />
     <path d="${pathFor(rows, "totalLiquidity")}" fill="none" stroke="#6657d2" stroke-width="3" stroke-linecap="round" />`,
  );

  projectChartTickIndexes(rows, width).forEach((idx) => {
    svg.insertAdjacentHTML(
      "beforeend",
      `<text class="chart-label" x="${x(idx) - 16}" y="${height - 8}">${rows[idx].month}</text>`,
    );
  });

  const legendX = width - 188;
  svg.insertAdjacentHTML(
    "beforeend",
    `<line x1="${legendX}" x2="${legendX + 14}" y1="18" y2="18" stroke="#6657d2" stroke-width="3" />
     <text class="legend" x="${legendX + 20}" y="22">Con proyectos</text>
     <line x1="${legendX}" x2="${legendX + 14}" y1="38" y2="38" stroke="#7a8890" stroke-width="2.2" stroke-dasharray="5 4" />
     <text class="legend" x="${legendX + 20}" y="42">Escenario base</text>`,
  );
}

function renderProjectImpactChart(baseRows, rows) {
  const svg = qs("projectImpactChart");
  const width = svg.clientWidth || 520;
  const height = 150;
  const pad = { left: 44, right: 18, top: 16, bottom: 26 };
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";

  const monthly = rows.map((row) => row.projectOutflow || 0);
  const deltas = rows.map((row, index) => row.totalLiquidity - (baseRows[index]?.totalLiquidity || row.totalLiquidity));
  const maxMonthly = Math.max(...monthly.map((value) => Math.abs(value)), 0);
  const minDelta = Math.min(...deltas, 0);
  const maxDelta = Math.max(...deltas, 0);
  const yMax = Math.max(maxMonthly, Math.abs(minDelta), Math.abs(maxDelta), 1);
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const barW = Math.max(2, plotW / rows.length - 2);
  const x = (i) => pad.left + (i / rows.length) * plotW;
  const zeroY = pad.top + plotH / 2;
  const halfPlot = plotH * 0.45;
  const yDelta = (value) => zeroY - (value / yMax) * halfPlot;
  const totalImpact = deltas[deltas.length - 1] || 0;
  const loadedMonths = monthly.filter((value) => Math.abs(value) > 0.01).length;

  const decisionCount = projectPlan.placements.length;
  qs("impactChartTitle").textContent = decisionCount
    ? `${loadedMonths} mes(es) con impacto · ${totalImpact >= 0 ? "+" : ""}${money(totalImpact)} al final`
    : "Sin impactos cargados";

  svg.insertAdjacentHTML(
    "beforeend",
    `<line class="tick" x1="${pad.left}" x2="${width - pad.right}" y1="${zeroY}" y2="${zeroY}" />
     <text class="chart-label" x="0" y="${zeroY + 4}">0 €</text>`,
  );

  monthly.forEach((value, index) => {
    if (!value) return;
    const h = (Math.abs(value) / yMax) * halfPlot;
    const y = value >= 0 ? zeroY - h : zeroY;
    svg.insertAdjacentHTML(
      "beforeend",
      `<rect x="${x(index)}" y="${y}" width="${barW}" height="${h}" rx="2" fill="${value < 0 ? "#248a50" : "#c44945"}" opacity="0.78" />`,
    );
  });

  if (decisionCount) {
    const path = deltas
      .map((value, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${yDelta(value).toFixed(2)}`)
      .join(" ");
    svg.insertAdjacentHTML(
      "beforeend",
      `<path d="${path}" fill="none" stroke="#6657d2" stroke-width="2.5" stroke-linecap="round" />
       <circle cx="${x(deltas.length - 1)}" cy="${yDelta(deltas[deltas.length - 1])}" r="4" fill="#6657d2" stroke="#fff" stroke-width="2" />`,
    );
  }

  projectChartTickIndexes(rows, width).forEach((idx) => {
    svg.insertAdjacentHTML(
      "beforeend",
      `<text class="chart-label" x="${x(idx) - 14}" y="${height - 6}">${rows[idx].month}</text>`,
    );
  });
}

function projectChartTickIndexes(rows, width) {
  const last = rows.length - 1;
  if (last <= 0) return [0];
  const base = width < 620 ? [0, Math.floor(last / 2), last] : [0, 11, 23, 35, 47, last];
  return [...new Set(base.map((idx) => Math.min(Math.max(idx, 0), last)))].filter((idx) => rows[idx]);
}

function renderProjectPlanPreview() {
  const element = qs("projectPlanPreview");
  if (!element) return;
  const projectKind = qs("projectKind")?.value || "standard";
  const creditOwner = qs("projectCreditOwner")?.value || "Tere";
  const creditCapital = parseAmount(qs("projectCreditCapital")?.value) ?? 0;
  const amount = parseAmount(qs("projectAmount")?.value) ?? 0;
  const duration = Math.max(1, Number(qs("projectDuration")?.value || 1));
  const recurringAmount = parseAmount(qs("projectRecurringAmount")?.value) ?? 0;
  const recurringDuration = Math.max(0, Number(qs("projectRecurringDuration")?.value || 0));
  const recurringDelay = qs("projectRecurringDelay")?.value || "after";
  const mode = document.querySelector('input[name="projectMode"]:checked')?.value || "optimize";
  const monthLabelText = mode === "fixed" ? qs("projectMonth")?.selectedOptions?.[0]?.textContent || "mes manual" : "mes óptimo";
  const total = round2(amount + recurringAmount * recurringDuration);
  const net = round2(total - creditCapital);
  element.innerHTML = `<strong>${editingProjectId ? "Editando plan" : "Resumen del plan"}</strong>
    <div class="project-preview-grid">
      <span>Tipo: ${projectKind === "external-credit" ? `crédito externo (${escapeHtml(creditOwner)})` : "proyecto propio"}</span>
      <span>Inicio: ${escapeHtml(monthLabelText)}</span>
      <span>Coste total: ${money(total, true)}</span>
      <span>Capital prestado: ${creditCapital ? money(creditCapital, true) : "sin financiación externa"}</span>
      <span>Impacto neto total: ${net >= 0 ? "" : "+"}${money(net, true)}</span>
      <span>Inicial: ${money(amount, true)} en ${duration} mes(es)</span>
      <span>Recurrente: ${recurringAmount ? `${money(recurringAmount, true)} durante ${recurringDuration} mes(es), ${recurringDelay === "same" ? "desde el mismo mes" : "tras el impacto inicial"}` : "sin cuota recurrente"}</span>
    </div>`;
  qs("addProject").textContent = editingProjectId ? "Guardar plan" : "Comparar plan";
  qs("cancelProjectEdit").hidden = !editingProjectId;
}

function updateProjectKindUi() {
  const kind = qs("projectKind")?.value || "standard";
  const isCredit = kind === "external-credit";
  document.querySelectorAll(".project-credit-field").forEach((field) => {
    field.classList.toggle("is-visible", isCredit);
  });
  if (isCredit) {
    if (qs("projectRecurringDelay")) qs("projectRecurringDelay").value = "same";
    if (qs("projectCreditCapital") && !qs("projectCreditCapital").value && qs("projectAmount")?.value) {
      qs("projectCreditCapital").value = qs("projectAmount").value;
    }
  }
  renderProjectPlanPreview();
}

function updateProjectModeUi() {
  const mode = document.querySelector('input[name="projectMode"]:checked')?.value || "optimize";
  const monthSelect = qs("projectMonth");
  const monthField = qs("projectMonthField");
  const isManual = mode === "fixed";
  monthSelect.disabled = !isManual;
  monthField.classList.toggle("month-disabled", !isManual);
  renderProjectPlanPreview();
}

function setProjectMode(mode) {
  const input = document.querySelector(`input[name="projectMode"][value="${mode}"]`);
  if (input) {
    input.checked = true;
  }
  updateProjectModeUi();
}

function toggleCashflowDetail(index) {
  selectedCashflowIndex = selectedCashflowIndex === index ? null : index;
  renderTable(lastSimulation, lastBaseSimulation);
}

function cashflowYear(row) {
  return String(row.detailMonthKey || "").slice(0, 4) || "Sin año";
}

function groupCashflowByYear(rows, baseRows) {
  const groups = [];
  rows.forEach((row, index) => {
    if (isClosedMonthKey(row.detailMonthKey)) return;
    const year = cashflowYear(row);
    let group = groups.find((item) => item.year === year);
    if (!group) {
      group = { year, items: [] };
      groups.push(group);
    }
    group.items.push({ row, base: baseRows[index] || row, index });
  });
  return groups;
}

function ensureCashflowYearDefaults(groups) {
  if (expandedCashflowYears.size || !groups.length) return;
  expandedCashflowYears.add(groups[0].year);
}

function toggleCashflowYear(year) {
  if (expandedCashflowYears.has(year)) {
    expandedCashflowYears.delete(year);
  } else {
    expandedCashflowYears.add(year);
  }
  renderTable(lastSimulation, lastBaseSimulation);
}

function summarizeCashflowYear(group) {
  const first = group.items[0];
  const last = group.items[group.items.length - 1];
  const totalDebtAndCar = group.items.reduce((sum, item) => sum + item.row.car + item.row.refi, 0);
  const totalOutflow = group.items.reduce((sum, item) => sum + item.row.coreSpend + item.row.car + item.row.refi + item.row.projectOutflow, 0);
  return {
    startLiquidity: first.row.startLiquidity,
    income: group.items.reduce((sum, item) => sum + item.row.income, 0),
    coreSpend: group.items.reduce((sum, item) => sum + item.row.coreSpend, 0),
    car: group.items.reduce((sum, item) => sum + item.row.car, 0),
    refi: group.items.reduce((sum, item) => sum + item.row.refi, 0),
    debtAndCar: totalDebtAndCar,
    outflow: totalOutflow,
    projectOutflow: group.items.reduce((sum, item) => sum + item.row.projectOutflow, 0),
    savingBase: group.items.reduce((sum, item) => sum + item.base.saving, 0),
    saving: group.items.reduce((sum, item) => sum + item.row.saving, 0),
    checkingBase: last.base.checking,
    checking: last.row.checking,
    liquidityBase: last.base.totalLiquidity,
    liquidity: last.row.totalLiquidity,
    impact: last.row.totalLiquidity - last.base.totalLiquidity,
    result: last.row.totalLiquidity - first.row.startLiquidity,
    minLiquidity: Math.min(...group.items.map((item) => item.row.totalLiquidity)),
    maxProjectMonth: group.items.reduce(
      (max, item) => (Math.abs(item.row.projectOutflow) > Math.abs(max.row.projectOutflow) ? item : max),
      group.items[0],
    ),
  };
}

function cashflowYearConclusion(group) {
  const summary = summarizeCashflowYear(group);
  const savingRate = summary.income ? summary.saving / summary.income : 0;
  const debtRate = summary.income ? summary.debtAndCar / summary.income : 0;
  const projectImpact = summary.projectOutflow;
  const hasProjectPressure = projectImpact > summary.income * 0.05;
  const hasDebtPressure = debtRate > 0.35;
  const isStrongSaving = savingRate >= 0.3;
  const liquidityGrows = summary.result >= 0;
  let tone = "good";
  let title = "Año sólido";
  let body = `La liquidez crece ${money(summary.result, true)} y cierra en ${money(summary.liquidity, true)}.`;
  if (!liquidityGrows) {
    tone = "danger";
    title = "Año con caída de liquidez";
    body = `La liquidez baja ${money(Math.abs(summary.result), true)}. Revisa proyectos, ahorro y deuda antes de cerrar este año.`;
  } else if (hasProjectPressure) {
    tone = "warn";
    title = "Año condicionado por proyectos";
    body = `Hay ${money(projectImpact, true)} en proyectos. El mes más exigente es ${summary.maxProjectMonth.row.month}.`;
  } else if (hasDebtPressure) {
    tone = "warn";
    title = "Deuda todavía pesa";
    body = `Deuda y coche absorben el ${(debtRate * 100).toFixed(0)}% de los ingresos del año.`;
  } else if (isStrongSaving) {
    title = "Buen ritmo de ahorro";
    body = `Ahorro anual de ${money(summary.saving, true)} (${(savingRate * 100).toFixed(0)}% de ingresos).`;
  }
  return { tone, title, body, savingRate, debtRate };
}

function renderCashflowExecutive(groups) {
  const container = qs("cashflowExecutive");
  if (!container || !groups.length) return;
  const first = groups[0];
  const last = groups.at(-1);
  const firstSummary = summarizeCashflowYear(first);
  const lastSummary = summarizeCashflowYear(last);
  const fullIncome = sumRows(groups, (group) => summarizeCashflowYear(group).income);
  const fullSaving = sumRows(groups, (group) => summarizeCashflowYear(group).saving);
  const fullProjects = sumRows(groups, (group) => summarizeCashflowYear(group).projectOutflow);
  const weakest = groups
    .map((group) => ({ group, summary: summarizeCashflowYear(group), conclusion: cashflowYearConclusion(group) }))
    .sort((a, b) => a.summary.minLiquidity - b.summary.minLiquidity)[0];
  container.innerHTML = [
    ["Horizonte visible", `${first.year}-${last.year}`, `De ${money(firstSummary.startLiquidity, true)} a ${money(lastSummary.liquidity, true)}.`],
    ["Ahorro acumulado", money(fullSaving, true), `${fullIncome ? ((fullSaving / fullIncome) * 100).toFixed(0) : "0"}% de los ingresos visibles.`],
    ["Proyectos cargados", money(fullProjects, true), fullProjects ? "Impactan en la liquidez y en la cuenta final." : "Sin presión por proyectos en el rango."],
    ["Año a vigilar", weakest.group.year, `${weakest.conclusion.title}. Mínimo: ${money(weakest.summary.minLiquidity, true)}.`],
  ]
    .map(([label, value, note]) => `<article><span>${label}</span><strong>${value}</strong><p>${note}</p></article>`)
    .join("");
}

function renderCashflowYearInsights(groups) {
  const container = qs("cashflowYearInsights");
  if (!container) return;
  container.innerHTML = groups
    .map((group) => {
      const summary = summarizeCashflowYear(group);
      const conclusion = cashflowYearConclusion(group);
      const expanded = expandedCashflowYears.has(group.year);
      return `<article class="cashflow-insight ${conclusion.tone}">
        <button type="button" data-cashflow-year-card="${escapeHtml(group.year)}" aria-expanded="${expanded ? "true" : "false"}">
          <span>${expanded ? "-" : "+"}</span>
          <strong>${escapeHtml(group.year)}</strong>
        </button>
        <h3>${escapeHtml(conclusion.title)}</h3>
        <p>${escapeHtml(conclusion.body)}</p>
        <dl>
          <div><dt>Cierre</dt><dd title="${money(summary.liquidity, true)}">${money(summary.liquidity, true)}</dd></div>
          <div><dt>Ahorro</dt><dd title="${money(summary.saving, true)}">${money(summary.saving, true)}</dd></div>
          <div><dt>Deuda + coche</dt><dd title="${money(summary.debtAndCar, true)}">${money(summary.debtAndCar, true)}</dd></div>
        </dl>
      </article>`;
    })
    .join("");
  document.querySelectorAll("[data-cashflow-year-card]").forEach((button) => {
    button.addEventListener("click", () => toggleCashflowYear(button.dataset.cashflowYearCard));
  });
}

function renderCashflowYearRow(group) {
  const expanded = expandedCashflowYears.has(group.year);
  const summary = summarizeCashflowYear(group);
  const conclusion = cashflowYearConclusion(group);
  return `<tr class="cashflow-year-row ${expanded ? "expanded" : ""}" data-cashflow-year="${group.year}" tabindex="0" role="button" aria-expanded="${expanded ? "true" : "false"}">
    <td><span class="cashflow-toggle">${expanded ? "-" : "+"}</span><strong>${group.year}</strong> <small>${group.items.length} meses</small></td>
    <td class="positive">${money(summary.income, true)}</td>
    <td class="negative">${money(summary.coreSpend, true)}</td>
    <td class="negative">${money(summary.debtAndCar, true)}</td>
    <td class="${summary.projectOutflow ? "negative" : ""}">${money(summary.projectOutflow, true)}</td>
    <td>${money(summary.saving, true)}</td>
    <td>${money(summary.liquidity, true)}</td>
    <td><span class="cashflow-conclusion ${conclusion.tone}">${escapeHtml(conclusion.title)}</span></td>
  </tr>`;
}

function renderMonthDetailList(sections, kind) {
  const filtered = sections.filter((section) => section.kind === kind);
  if (!filtered.length) {
    return '<p class="month-detail-empty">Sin líneas para este mes.</p>';
  }

  return filtered
    .map(
      (section) => `<div class="month-detail-group">
        <div class="month-detail-group-title">
          <strong>${escapeHtml(section.name)}</strong>
          <span>${money(section.total, true)}</span>
        </div>
        ${section.lines
          .map(
            (line) => `<div class="month-detail-line">
              <div>
                <strong>${escapeHtml(line.label)}</strong>
                <span>${escapeHtml(line.type)} · ${line.source}${line.hasActual ? ` vs previsto ${money(line.planned, true)}` : ""}</span>
              </div>
              <strong class="${kind === "income" ? "positive" : "negative"}">${money(line.value, true)}</strong>
            </div>`,
          )
          .join("")}
      </div>`,
    )
    .join("");
}

function renderProjectMonthDetails(projectsInMonth) {
  if (!projectsInMonth.length) {
    return '<p class="month-detail-empty">Sin proyectos, imprevistos ni decisiones de deuda en este mes.</p>';
  }

  return projectsInMonth
    .map(
      (project) => `<div class="month-detail-line">
        <div>
          <strong>${escapeHtml(project.name)}</strong>
          <span>${project.source === "debt" ? "Decisión de deuda" : project.status === "fixed" ? "Mes manual" : "Mes optimizado"} · ${project.duration} mes(es)</span>
        </div>
        <strong class="${project.monthlyAmount < 0 ? "positive" : "negative"}">${money(project.monthlyAmount, true)}</strong>
      </div>`,
    )
    .join("");
}

function renderCashflowDetailRow(row, index, base) {
  const { sections } = planningDetailSectionsForForecastIndex(index);
  const projectsInMonth = projectsForForecastIndex(index);
  const totalExpenses = row.coreSpend + row.car + row.refi + row.projectOutflow;
  const liquidityImpact = row.totalLiquidity - base.totalLiquidity;

  return `<tr class="cashflow-detail-row">
    <td colspan="8">
      <div class="cashflow-detail-panel">
        <div class="cashflow-detail-head">
          <div>
            <span>Detalle del mes</span>
            <strong>${row.month}</strong>
          </div>
          <div class="cashflow-detail-metrics">
            <span>Ingresos ${money(row.income, true)}</span>
            <span>Gastos ${money(totalExpenses, true)}</span>
            <span>Ahorro ${money(row.saving, true)}</span>
            <span class="${liquidityImpact < 0 ? "negative" : "positive"}">Impacto ${money(liquidityImpact, true)}</span>
          </div>
        </div>
        <div class="cashflow-detail-grid">
          <section class="month-detail-card income">
            <h3>Ingresos</h3>
            ${renderMonthDetailList(sections, "income")}
          </section>
          <section class="month-detail-card expense">
            <h3>Gastos y deuda</h3>
            ${renderMonthDetailList(sections, "expense")}
          </section>
          <section class="month-detail-card projects">
            <h3>Proyectos</h3>
            ${renderProjectMonthDetails(projectsInMonth)}
          </section>
        </div>
      </div>
    </td>
  </tr>`;
}

function renderTable(rows, baseRows = rows) {
  const groups = groupCashflowByYear(rows, baseRows);
  ensureCashflowYearDefaults(groups);
  renderCashflowExecutive(groups);
  renderCashflowYearInsights(groups);

  qs("cashflowRows").innerHTML = groups
    .map((group) => {
      const yearRow = renderCashflowYearRow(group);
      if (!expandedCashflowYears.has(group.year)) return yearRow;

      const monthRows = group.items
        .map(({ row, base, index }) => {
          const liquidityImpact = row.totalLiquidity - base.totalLiquidity;
          const debtAndCar = row.car + row.refi;
          const conclusion =
            row.projectOutflow > 0
              ? `Proyecto: ${money(row.projectOutflow, true)}`
              : debtAndCar > row.income * 0.45
                ? "Mes tensionado por deuda"
                : row.totalLiquidity >= row.startLiquidity
                  ? "Liquidez sube"
                  : "Liquidez baja";
          const isSelected = selectedCashflowIndex === index;
          const mainRow = `<tr class="cashflow-row ${isSelected ? "selected" : ""}" data-cashflow-index="${index}" tabindex="0" role="button" aria-expanded="${isSelected ? "true" : "false"}" title="Ver detalle de ${row.month}">
        <td><span class="cashflow-toggle">${isSelected ? "-" : "+"}</span>${row.month}</td>
        <td class="positive">${money(row.income, true)}</td>
        <td class="negative">${money(row.coreSpend, true)}</td>
        <td class="negative">${money(debtAndCar, true)}</td>
        <td class="${row.projectOutflow < 0 ? "positive" : row.projectOutflow ? "negative" : ""}">${money(row.projectOutflow, true)}</td>
        <td>${money(row.saving, true)}</td>
        <td>${money(row.totalLiquidity, true)}</td>
        <td><span class="cashflow-conclusion ${liquidityImpact < 0 ? "warn" : "good"}">${escapeHtml(conclusion)}</span></td>
      </tr>`;
          return mainRow + (isSelected ? renderCashflowDetailRow(row, index, base) : "");
        })
        .join("");
      return yearRow + monthRows;
    })
    .join("");

  document.querySelectorAll("[data-cashflow-year]").forEach((rowElement) => {
    rowElement.addEventListener("click", () => toggleCashflowYear(rowElement.dataset.cashflowYear));
    rowElement.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleCashflowYear(rowElement.dataset.cashflowYear);
    });
  });

  document.querySelectorAll("[data-cashflow-index]").forEach((rowElement) => {
    rowElement.addEventListener("click", () => toggleCashflowDetail(Number(rowElement.dataset.cashflowIndex)));
    rowElement.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleCashflowDetail(Number(rowElement.dataset.cashflowIndex));
    });
  });
}

function visualDefaultStartIndex() {
  return 0;
}

function selectableMonths({ includeClosed = false } = {}) {
  try {
    if (baseData && state) {
      const months = forecastMonths();
      return includeClosed ? months : openForecastMonths(months);
    }
  } catch (error) {
    // Fall back to the imported workbook months while the app is still booting.
  }
  const months = baseData?.monthlyPlanning?.months || [];
  return includeClosed ? months : openForecastMonths(months);
}

function monthOptionsHtml(selectedKey = "", months = selectableMonths()) {
  return months
    .map((month) => `<option value="${month.key}" ${month.key === selectedKey ? "selected" : ""}>${escapeHtml(month.label)}</option>`)
    .join("");
}

function populateVisualControls() {
  const months = selectableMonths();
  if (!months.length || !qs("visualStartMonth")) return;
  const timeMode = qs("visualTimeMode")?.value || "year";
  const defaultStart = visualDefaultStartIndex();
  const defaultEnd = timeMode === "year" ? months.length - 1 : Math.min(defaultStart + 17, months.length - 1);
  const selectIds = [
    "visualStartMonth",
    "visualEndMonth",
    "visualAddStartMonth",
    "visualAddEndMonth",
    "visualEditStartMonth",
    "visualEditEndMonth",
    "visualEditMonths",
  ];
  const monthSignature = months.map((month) => month.key).join("|");
  const optionHtml = visualMonthSelectorSignature === monthSignature ? null : monthOptionsHtml("", months);
  selectIds.forEach((id) => {
    const select = qs(id);
    if (!select) return;
    const previous = select.value;
    const fallbackIndex = id.includes("End") ? defaultEnd : defaultStart;
    const selected = months.some((month) => month.key === previous) ? previous : months[fallbackIndex]?.key;
    if (select.dataset.monthSignature !== monthSignature) {
      select.innerHTML = optionHtml ?? monthOptionsHtml("", months);
      select.dataset.monthSignature = monthSignature;
    }
    select.value = selected;
  });
  visualMonthSelectorSignature = monthSignature;
  populateVisualAddSections();
  populateVisualBulkEditor();
  updateVisualAddScopeUi();
  updateVisualBulkEditScopeUi();
}

function populateVisualAddSections() {
  const kind = qs("visualAddKind")?.value || "expense";
  const sectionSelect = qs("visualAddSection");
  if (!sectionSelect) return;
  const previous = sectionSelect.value;
  const sections = baseData.monthlyPlanning.sections.filter((section) => section.kind === kind);
  const signature = `${kind}:${sections.map((section) => section.name).join("|")}`;
  if (visualAddSectionSignature !== signature) {
    sectionSelect.innerHTML = sections
      .map((section) => `<option value="${escapeHtml(section.name)}">${escapeHtml(section.name)}</option>`)
      .join("");
    visualAddSectionSignature = signature;
  }
  if ([...sectionSelect.options].some((option) => option.value === previous)) sectionSelect.value = previous;
}

function visualAddSingleMonthMode() {
  return (qs("visualAddScope")?.value || "single") === "single";
}

function updateVisualAddScopeUi() {
  const start = qs("visualAddStartMonth");
  const end = qs("visualAddEndMonth");
  if (!start || !end) return;
  if (visualAddSingleMonthMode()) {
    end.value = start.value;
    end.disabled = true;
    end.closest("label")?.classList.add("muted-control");
  } else {
    end.disabled = false;
    end.closest("label")?.classList.remove("muted-control");
  }
}

function populateVisualBulkEditor() {
  const kind = qs("visualEditKind")?.value || "expense";
  const rowSelect = qs("visualEditRow");
  if (!rowSelect) return;
  const previous = rowSelect.value;
  const rows = availableSeriesRows(kind);
  const signature = `${kind}:${rows.map((row) => `${seriesKeyForRow(row)}:${displayLabelForRow(row)}:${row.sectionName}`).join("|")}`;
  if (visualBulkEditorSignature !== signature) {
    rowSelect.innerHTML = rows
      .map((row) => `<option value="${escapeHtml(seriesKeyForRow(row))}">${escapeHtml(row.sectionName)} · ${escapeHtml(displayLabelForRow(row))}</option>`)
      .join("");
    visualBulkEditorSignature = signature;
  }
  if ([...rowSelect.options].some((option) => option.value === previous)) rowSelect.value = previous;
}

function updateVisualBulkEditScopeUi() {
  const scope = qs("visualEditScope")?.value || "single";
  const start = qs("visualEditStartMonth");
  const end = qs("visualEditEndMonth");
  const endField = qs("visualEditEndMonthField");
  const multiField = qs("visualEditMultiMonthField");
  if (!start || !end || !endField || !multiField) return;
  const isRange = scope === "range";
  const isMultiple = scope === "multiple";
  endField.classList.toggle("is-hidden", !isRange);
  multiField.classList.toggle("is-hidden", !isMultiple);
  start.closest("label")?.classList.toggle("is-hidden", isMultiple);
  if (scope === "single") end.value = start.value;
}

function selectedVisualBulkEditRow() {
  const kind = qs("visualEditKind")?.value || "expense";
  const key = qs("visualEditRow")?.value || "";
  return availableSeriesRows(kind).find((row) => seriesKeyForRow(row) === key) || null;
}

function visualBulkEditTargetMonths() {
  const months = selectableMonths();
  const scope = qs("visualEditScope")?.value || "single";
  if (scope === "multiple") {
    return [...(qs("visualEditMonths")?.selectedOptions || [])]
      .map((option) => monthByKey(option.value, months))
      .filter(Boolean);
  }
  const startKey = qs("visualEditStartMonth")?.value || months[0]?.key;
  const endKey = scope === "range" ? qs("visualEditEndMonth")?.value : startKey;
  return monthsInRange(startKey, endKey, months);
}

function stageVisualBulkEdit() {
  const row = selectedVisualBulkEditRow();
  const parsed = parseAmount(qs("visualEditAmount")?.value);
  const mode = qs("visualEditMode")?.value || "planned";
  const feedback = qs("visualBulkEditFeedback");
  if (!row) {
    if (feedback) {
      feedback.textContent = "Selecciona una partida para modificar.";
      feedback.className = "inline-feedback warning";
    }
    return;
  }
  if (parsed === null) {
    if (feedback) {
      feedback.textContent = "Introduce el importe que quieres aplicar.";
      feedback.className = "inline-feedback warning";
    }
    qs("visualEditAmount")?.focus();
    return;
  }
  const months = visualBulkEditTargetMonths();
  if (!months.length) {
    if (feedback) {
      feedback.textContent = "Selecciona al menos un mes.";
      feedback.className = "inline-feedback warning";
    }
    return;
  }
  const value = round2(parsed);
  months.forEach((month) => {
    const key = visualDraftCellKey(seriesKeyForRow(row), month.key, mode);
    const currentValue = mode === "planned" ? plannedValueForVisualRow(row, month) : actualAwareInfoForVisualRow(row, month).actual;
    if (Number(currentValue ?? 0) === value && !(mode === "actual" && currentValue === null)) {
      delete visualDraftCells[key];
    } else {
      visualDraftCells[key] = {
        rowKey: seriesKeyForRow(row),
        monthKey: month.key,
        monthLabel: month.label,
        mode,
        label: displayLabelForRow(row),
        value,
        oldValue: currentValue,
      };
    }
  });
  if (feedback) {
    const scopeText =
      months.length === 1 ? months[0].label : `${months[0].label} - ${months.at(-1).label}${qs("visualEditScope")?.value === "multiple" ? ` (${months.length} meses concretos)` : ""}`;
    feedback.textContent = `${displayLabelForRow(row)} preparado en ${scopeText}. Pulsa Guardar cambios para recalcular toda la app.`;
    feedback.className = "inline-feedback success";
  }
  expandedVisualSections.add(`${row.kind}:${row.sectionName}`);
  renderVisualDetail();
}

function visualMonths() {
  const months = selectableMonths();
  const startKey = qs("visualStartMonth")?.value || months[visualDefaultStartIndex()]?.key;
  const defaultEndIndex = (qs("visualTimeMode")?.value || "year") === "year" ? months.length - 1 : Math.min(visualDefaultStartIndex() + 17, months.length - 1);
  const endKey = qs("visualEndMonth")?.value || months[defaultEndIndex]?.key;
  return monthsInRange(startKey, endKey, months);
}

function visualTimeMode() {
  return qs("visualTimeMode")?.value || "year";
}

function visualYearGroups(months) {
  const groups = [];
  months.forEach((month) => {
    const year = month.key.slice(0, 4);
    let group = groups.at(-1);
    if (!group || group.key !== year) {
      group = { key: year, label: year, months: [], kind: "year" };
      groups.push(group);
    }
    group.months.push(month);
  });
  return groups;
}

function ensureVisualYearDefaults(months) {
  if (visualTimeMode() !== "year" || expandedVisualYears.size || !months.length) return;
  expandedVisualYears.add(months[0].key.slice(0, 4));
}

function visualColumns(months) {
  if (visualTimeMode() !== "year") {
    return months.map((month) => ({ key: month.key, label: month.label, months: [month], kind: "month", year: month.key.slice(0, 4) }));
  }
  ensureVisualYearDefaults(months);
  return visualYearGroups(months).flatMap((group) => {
    const expanded = expandedVisualYears.has(group.key);
    const summaryColumn = {
      key: `${group.key}:summary`,
      label: expanded ? `Total ${group.key}` : group.key,
      months: group.months,
      kind: "year-summary",
      year: group.key,
      expanded,
    };
    if (!expanded) return [summaryColumn];
    return [
      ...group.months.map((month) => ({ key: month.key, label: month.label, months: [month], kind: "month", year: group.key })),
      summaryColumn,
    ];
  });
}

function renderVisualColumnHeader(column) {
  if (visualTimeMode() === "year" && column.kind === "year-summary") {
    return `<th class="visual-year-header">
      <button type="button" data-visual-year-toggle="${escapeHtml(column.year)}" aria-expanded="${column.expanded ? "true" : "false"}">
        <span>${column.expanded ? "-" : "+"}</span>${escapeHtml(column.label)}
      </button>
    </th>`;
  }
  return `<th class="${column.kind === "month" && visualTimeMode() === "year" ? "visual-month-header" : ""}">${escapeHtml(column.label)}</th>`;
}

function toggleVisualYear(year) {
  if (expandedVisualYears.has(year)) expandedVisualYears.delete(year);
  else expandedVisualYears.add(year);
  renderVisualDetail();
}

function sumColumnMonths(column, getter) {
  return round2(column.months.reduce((sum, month) => sum + Number(getter(month) || 0), 0));
}

function plannedValueForVisualRow(row, month) {
  const scopedRow = row.custom ? customRowForVisualMonth(row, month) : row;
  if (!scopedRow) return 0;
  return plannedValueForRow(scopedRow, month);
}

function visualDraftCellKey(rowKey, monthKey, mode) {
  return `${rowKey}|${monthKey}|${mode}`;
}

function visualDraftForCell(row, month, mode) {
  return visualDraftCells[visualDraftCellKey(seriesKeyForRow(row), month.key, mode)] || null;
}

function isVisualRowPendingDelete(rowKey) {
  return Boolean(visualDraftDeletes[rowKey]);
}

function isVisualProjectPendingDelete(projectId) {
  return Boolean(visualDraftProjectDeletes[projectId]);
}

function visualDisplayLabel(row) {
  return visualDraftLabels[seriesKeyForRow(row)]?.value ?? displayLabelForRow(row);
}

function actualAwareInfoForVisualRow(row, month) {
  const scopedRow = row.custom ? customRowForVisualMonth(row, month) : row;
  if (!scopedRow) {
    return { planned: 0, actual: null, hasActual: false, value: 0, source: "Previsto" };
  }
  const info = actualAwareInfo(scopedRow, month);
  const planned = plannedValueForRow(scopedRow, month);
  return {
    ...info,
    planned,
    value: info.hasActual ? info.actual : planned,
  };
}

function customRowForVisualMonth(row, month) {
  return customPlanningRows.find(
    (item) => item.kind === row.kind && item.id === row.id && item.monthKey === month.key,
  );
}

function visualRowsForSection(section, months) {
  const monthKeys = new Set(months.map((month) => month.key));
  const rows = section.rows.slice();
  customPlanningRows
    .filter((row) => row.kind === section.kind && row.sectionName === section.name && monthKeys.has(row.monthKey))
    .forEach((row) => {
      if (!rows.some((item) => seriesKeyForRow(item) === seriesKeyForRow(row))) rows.push(row);
    });
  return rows.filter((row) =>
    months.some((month) => {
      if (isPlanningRowDeleted(row, month, section.name)) return false;
      if (row.custom && monthKeys.has(month.key) && customRowForVisualMonth(row, month)) return true;
      const info = actualAwareInfoForVisualRow(row, month);
      return info.value !== 0 || info.planned !== 0 || info.hasActual;
    }),
  );
}

function visualCellValue(row, month, mode) {
  const draft = visualDraftForCell(row, month, mode);
  if (draft) return draft.value;
  if (mode === "actual") {
    const info = actualAwareInfoForVisualRow(row, month);
    return info.hasActual ? Number(info.actual || 0) : "";
  }
  const scopedRow = row.custom ? customRowForVisualMonth(row, month) : row;
  const override = scopedRow ? seriesOverrideForRow(scopedRow, month) : null;
  const planned = plannedValueForVisualRow(row, month);
  return planned !== 0 || (override?.planned !== undefined && override?.planned !== "") ? planned : "";
}

function visualSectionTotal(section, rows, months, mode, month) {
  return rows.reduce((sum, row) => {
    if (isVisualRowPendingDelete(seriesKeyForRow(row))) return sum;
    if (isPlanningRowDeleted(row, month, section.name)) return sum;
    const drafted = visualDraftForCell(row, month, mode);
    if (drafted) return sum + Number(drafted.value || 0);
    if (mode === "planned") return sum + plannedValueForVisualRow(row, month);
    return sum + actualAwareInfoForVisualRow(row, month).value;
  }, 0);
}

function visualCellClass(section) {
  return section.kind === "income" ? "positive" : "negative";
}

function visualSectionKey(section) {
  return `${section.kind}:${section.name}`;
}

function toggleVisualSection(key) {
  if (expandedVisualSections.has(key)) expandedVisualSections.delete(key);
  else expandedVisualSections.add(key);
  renderVisualDetail();
}

function projectRowsForVisualMonths(months) {
  if (!projectPlan.placements.length) return [];
  const forecast = forecastMonths();
  const monthIndexByKey = new Map(forecast.map((month) => [month.key, month.index]));
  return projectPlan.placements
    .map((project) => {
      const duration = Math.max(1, Number(project.duration || 1));
      const monthlyAmount = Number(project.amount || 0) / duration;
      const values = months.map((month) => {
        const forecastIndex = monthIndexByKey.get(month.key);
        return forecastIndex !== undefined ? scheduledDecisionMonthlyImpact(project, forecastIndex) : 0;
      });
      return { ...project, monthlyAmount, values };
    })
    .filter((project) => project.values.some((value) => value !== 0));
}

function updateVisualCell(input) {
  const row = rowForSeriesKey(input.dataset.rowKey);
  const month = monthByKey(input.dataset.monthKey);
  if (!row || !month) return;
  const parsed = parseAmount(input.value);
  const value = input.value === "" || parsed === null ? 0 : round2(parsed);
  const mode = input.dataset.mode;
  const key = visualDraftCellKey(input.dataset.rowKey, month.key, mode);
  const currentValue = mode === "planned" ? plannedValueForVisualRow(row, month) : actualAwareInfoForVisualRow(row, month).actual;
  if (Number(currentValue ?? 0) === value && !(mode === "actual" && currentValue === null)) {
    delete visualDraftCells[key];
  } else {
    visualDraftCells[key] = {
      rowKey: input.dataset.rowKey,
      monthKey: month.key,
      monthLabel: month.label,
      mode,
      label: displayLabelForRow(row),
      value,
      oldValue: currentValue,
    };
  }
  input.value = amountInputValue(value);
  renderVisualDetail();
}

function updateVisualLabel(input) {
  const row = rowForSeriesKey(input.dataset.rowKey);
  if (!row) return;
  const label = input.value.trim();
  const key = seriesKeyForRow(row);
  if (!label || label === displayLabelForRow(row)) delete visualDraftLabels[key];
  else {
    visualDraftLabels[key] = {
      rowKey: key,
      oldValue: displayLabelForRow(row),
      value: label,
    };
  }
  renderVisualDetail();
}

function rowForSeriesKey(key) {
  const rows = [];
  baseData.monthlyPlanning.sections.forEach((section) => {
    section.rows.forEach((row) => rows.push({ ...row, sectionName: section.name }));
  });
  customPlanningRows.forEach((row) => rows.push(row));
  return rows.find((row) => seriesKeyForRow(row) === key) || null;
}

function deleteVisualRow(rowKey) {
  const row = rowForSeriesKey(rowKey);
  if (!row) return;
  visualDraftDeletes[rowKey] = {
    rowKey,
    label: displayLabelForRow(row),
  };
  visualSelectedRows.delete(rowKey);
  renderVisualDetail();
}

function applyVisualDeleteRow(rowKey, months) {
  const row = rowForSeriesKey(rowKey);
  if (!row) return;
  const monthKeys = new Set(months.map((month) => month.key));
  const before = customPlanningRows.length;
  customPlanningRows = customPlanningRows.filter((item) => !(seriesKeyForRow(item) === rowKey && monthKeys.has(item.monthKey)));

  deletedPlanningRows[seriesDeletionKeyForRow(row, row.sectionName)] = true;
  months.forEach((month) => {
    if (row.custom && row.monthKey !== month.key) return;
    seriesOverrides[overrideKeyForRow(row, month)] = { deleted: true };
  });
  return before !== customPlanningRows.length || true;
}

function visualPendingCounts() {
  return {
    cells: Object.keys(visualDraftCells).length,
    labels: Object.keys(visualDraftLabels).length,
    deletes: Object.keys(visualDraftDeletes).length + Object.keys(visualDraftProjectDeletes).length,
    selected: visualSelectedRows.size,
  };
}

function visualHasPendingChanges() {
  const counts = visualPendingCounts();
  return counts.cells + counts.labels + counts.deletes > 0;
}

function renderVisualSavePanel() {
  if (!qs("visualSavePanel")) return;
  const counts = visualPendingCounts();
  const pending = counts.cells + counts.labels + counts.deletes;
  qs("visualSaveTitle").textContent = pending ? `${pending} cambio(s) pendiente(s)` : "Sin cambios pendientes";
  const parts = [];
  if (counts.cells) parts.push(`${counts.cells} importe(s)`);
  if (counts.labels) parts.push(`${counts.labels} nombre(s)`);
  if (counts.deletes) parts.push(`${counts.deletes} partida(s) para borrar`);
  if (counts.selected) parts.push(`${counts.selected} seleccionada(s)`);
  qs("visualSaveSummary").textContent = parts.length
    ? `Se guardarán: ${parts.join(", ")}. Los cambios afectarán a Cuadro de mandos, Previsión, flujo de caja, simulador y detalle mensual.`
    : "Edita importes, nombres o selecciona partidas para borrar antes de guardar.";
  qs("visualSavePanel").classList.toggle("has-pending", pending > 0 || counts.selected > 0);
  qs("visualSaveChanges").disabled = pending === 0;
  qs("visualDiscardChanges").disabled = pending === 0 && counts.selected === 0;
  qs("visualBulkDelete").disabled = counts.selected === 0;
}

function toggleVisualRowSelection(rowKey, checked) {
  if (checked) visualSelectedRows.add(rowKey);
  else visualSelectedRows.delete(rowKey);
  renderVisualDetail();
}

function stageSelectedVisualDeletes() {
  visualSelectedRows.forEach((rowKey) => {
    const row = rowForSeriesKey(rowKey);
    if (row) {
      visualDraftDeletes[rowKey] = {
        rowKey,
        label: displayLabelForRow(row),
      };
    }
  });
  visualSelectedRows.clear();
  renderVisualDetail();
}

function stageVisualProjectDelete(id) {
  const project = projects.find((item) => item.id === id) || debtLiquidations.find((item) => item.id === id);
  if (!project) return;
  if (project.locked) {
    if (qs("visualAddFeedback")) {
      qs("visualAddFeedback").textContent = "Esta decisión está fija en el plan. Desbloquéala antes de eliminarla.";
      qs("visualAddFeedback").className = "inline-feedback warning";
    }
    return;
  }
  visualDraftProjectDeletes[id] = { id, label: project.name || "Proyecto" };
  renderVisualDetail();
}

function discardVisualChanges() {
  visualDraftCells = {};
  visualDraftLabels = {};
  visualDraftDeletes = {};
  visualDraftProjectDeletes = {};
  visualSelectedRows.clear();
  renderVisualDetail();
}

function saveVisualChanges() {
  const months = visualMonths();
  let savedCells = 0;
  let savedLabels = 0;
  let savedDeletes = 0;
  let customChanged = false;
  let projectsChanged = false;

  Object.values(visualDraftCells).forEach((draft) => {
    const row = rowForSeriesKey(draft.rowKey);
    const month = monthByKey(draft.monthKey);
    if (!row || !month) return;
    const key = overrideKeyForRow(row, month);
    const next = { ...(seriesOverrides[key] || {}) };
    delete next.deleted;
    if (draft.mode === "planned") next.planned = draft.value;
    else next.actual = draft.value;
    seriesOverrides[key] = next;
    savedCells += 1;
  });

  Object.values(visualDraftLabels).forEach((draft) => {
    const row = rowForSeriesKey(draft.rowKey);
    if (!row) return;
    const label = String(draft.value || "").trim();
    if (!label) return;
    if (label === row.label) delete rowLabelOverrides[draft.rowKey];
    else rowLabelOverrides[draft.rowKey] = label;
    if (row.custom) {
      customPlanningRows
        .filter((item) => seriesKeyForRow(item) === draft.rowKey)
        .forEach((item) => {
          item.label = label;
        });
      customChanged = true;
    }
    savedLabels += 1;
  });

  Object.keys(visualDraftDeletes).forEach((rowKey) => {
    if (applyVisualDeleteRow(rowKey, months)) customChanged = true;
    savedDeletes += 1;
  });

  Object.keys(visualDraftProjectDeletes).forEach((id) => {
    if (projects.some((project) => project.id === id && project.locked)) return;
    if (debtLiquidations.some((item) => item.id === id && item.locked)) return;
    const before = projects.length;
    projects = projects.filter((project) => project.id !== id);
    if (projects.length !== before) {
      projectsChanged = true;
      savedDeletes += 1;
    }
    const beforeDebt = debtLiquidations.length;
    debtLiquidations = debtLiquidations.filter((item) => item.id !== id);
    if (debtLiquidations.length !== beforeDebt) {
      savedDeletes += 1;
    }
  });

  if (savedCells || savedDeletes) saveSeriesOverrides();
  if (savedDeletes) saveDeletedPlanningRows();
  if (savedLabels) saveRowLabelOverrides();
  if (customChanged) saveCustomPlanningRows();
  if (projectsChanged) saveProjects();
  saveDebtLiquidations();

  const summary = [];
  if (savedCells) summary.push(`${savedCells} importe(s)`);
  if (savedLabels) summary.push(`${savedLabels} nombre(s)`);
  if (savedDeletes) summary.push(`${savedDeletes} borrado(s)`);
  visualDraftCells = {};
  visualDraftLabels = {};
  visualDraftDeletes = {};
  visualDraftProjectDeletes = {};
  visualSelectedRows.clear();
  render();
  if (qs("visualAddFeedback")) {
    qs("visualAddFeedback").textContent = summary.length ? `Guardado: ${summary.join(", ")}.` : "No había cambios que guardar.";
    qs("visualAddFeedback").className = "inline-feedback success";
  }
}

function renderVisualDetail() {
  if (!qs("visualDetailTable")) return;
  populateVisualControls();
  const months = visualMonths();
  const columns = visualColumns(months);
  const compactYears = visualTimeMode() === "year";
  const mode = qs("visualValueMode")?.value || "planned";
  const monthHeaders = columns.map((column) => renderVisualColumnHeader(column)).join("");
  const body = [];
  const totals = { income: 0, expense: 0, realRows: 0, lines: 0 };

  baseData.monthlyPlanning.sections.forEach((section) => {
    const rows = visualRowsForSection(section, months);
    if (!rows.length) return;
    const sectionKey = visualSectionKey(section);
    const expanded = expandedVisualSections.has(sectionKey);
    totals.lines += rows.length;
    rows.forEach((row) => {
      if (isVisualRowPendingDelete(seriesKeyForRow(row))) return;
      months.forEach((month) => {
        if (actualAwareInfoForVisualRow(row, month).hasActual) totals.realRows += 1;
      });
    });
    const sectionTotals = columns.map((column) =>
      sumColumnMonths(column, (month) => visualSectionTotal(section, rows, months, mode, month)),
    );
    const sectionRangeTotal = sumColumnMonths({ months }, (month) => visualSectionTotal(section, rows, months, mode, month));
    if (section.kind === "income") totals.income += sectionRangeTotal;
    else totals.expense += sectionRangeTotal;
    body.push(`<tr class="visual-section-row ${section.kind} ${expanded ? "expanded" : ""}" data-visual-section-row="${escapeHtml(sectionKey)}">
      <td>
        <button class="visual-section-button" type="button" data-visual-section-toggle="${escapeHtml(sectionKey)}" aria-expanded="${expanded ? "true" : "false"}">
          <span class="visual-toggle">${expanded ? "-" : "+"}</span>
          <span><strong>${escapeHtml(section.name)}</strong><small>${rows.length} líneas</small></span>
        </button>
      </td>
      ${sectionTotals.map((value) => `<td class="${visualCellClass(section)}">${money(value, true)}</td>`).join("")}
      <td></td>
    </tr>`);

    if (!expanded) return;

    rows.forEach((row) => {
      const label = visualDisplayLabel(row);
      const rowKey = seriesKeyForRow(row);
      const pendingDelete = isVisualRowPendingDelete(rowKey);
      const selected = visualSelectedRows.has(rowKey);
      body.push(`<tr class="visual-line-row ${pendingDelete ? "pending-delete" : ""} ${selected ? "selected" : ""}">
        <td>
          <div class="visual-row-heading">
            <input class="visual-select-row" data-visual-select-row="${escapeHtml(rowKey)}" type="checkbox" ${selected ? "checked" : ""} ${pendingDelete ? "disabled" : ""} aria-label="Seleccionar ${escapeHtml(label)}" />
            <div>
              <input class="visual-label-input" data-visual-label-key="${escapeHtml(rowKey)}" value="${escapeHtml(label)}" ${pendingDelete ? "disabled" : ""} />
              <small>${escapeHtml(section.name)}${row.custom ? " · nuevo" : ""}${pendingDelete ? " · se borrará al guardar" : ""}</small>
            </div>
          </div>
        </td>
        ${columns
          .map((column) => {
            if (compactYears && column.kind === "year-summary") {
              const value = sumColumnMonths(column, (month) => visualCellValue(row, month, mode));
              return `<td class="visual-year-cell ${value < 0 ? "negative" : value > 0 ? "positive" : ""}">${value ? money(value, true) : ""}</td>`;
            }
            const month = column.months[0];
            const info = actualAwareInfoForVisualRow(row, month);
            const value = visualCellValue(row, month, mode);
            const placeholder = mode === "actual" && info.planned ? `prev. ${money(info.planned, true)}` : "";
            return `<td>
              <input class="visual-amount-input" data-visual-cell data-row-key="${escapeHtml(rowKey)}" data-month-key="${month.key}" data-mode="${mode}" type="number" step="0.01" value="${amountInputValue(value)}" placeholder="${placeholder}" ${pendingDelete ? "disabled" : ""} />
            </td>`;
          })
          .join("")}
        <td><button class="row-delete-button" type="button" data-visual-delete="${escapeHtml(rowKey)}" ${pendingDelete ? "disabled" : ""}>${pendingDelete ? "Pendiente" : "Eliminar"}</button></td>
      </tr>`);
    });
  });

  const projectRows = projectRowsForVisualMonths(months);
  if (projectRows.length) {
    const projectSectionKey = "project:projects";
    const expanded = expandedVisualSections.has(projectSectionKey);
    const monthIndexByKey = new Map(months.map((month, index) => [month.key, index]));
    const sectionTotals = columns.map((column) =>
      sumColumnMonths(column, (month) => {
        const monthIndex = monthIndexByKey.get(month.key);
        return projectRows.reduce((sum, project) => sum + (isVisualProjectPendingDelete(project.id) ? 0 : project.values[monthIndex] || 0), 0);
      }),
    );
    totals.expense += sumColumnMonths({ months }, (month) => {
      const monthIndex = monthIndexByKey.get(month.key);
      return projectRows.reduce((sum, project) => sum + (isVisualProjectPendingDelete(project.id) ? 0 : project.values[monthIndex] || 0), 0);
    });
    totals.lines += projectRows.length;
    body.push(`<tr class="visual-section-row expense project-section ${expanded ? "expanded" : ""}" data-visual-section-row="${escapeHtml(projectSectionKey)}">
      <td>
        <button class="visual-section-button" type="button" data-visual-section-toggle="${escapeHtml(projectSectionKey)}" aria-expanded="${expanded ? "true" : "false"}">
          <span class="visual-toggle">${expanded ? "-" : "+"}</span>
          <span><strong>Proyectos e imprevistos</strong><small>${projectRows.length} proyectos</small></span>
        </button>
      </td>
      ${sectionTotals.map((value) => `<td class="negative">${money(value, true)}</td>`).join("")}
      <td></td>
    </tr>`);

    if (expanded) {
      projectRows.forEach((project) => {
        const pendingDelete = isVisualProjectPendingDelete(project.id);
        const locked = Boolean(project.locked);
        const source = project.source === "debt" ? "debt" : "project";
        const actionCell = locked
          ? `<div class="visual-action-stack">
              <span class="decision-lock-badge">Fijo</span>
              <button class="visual-return-button" type="button" data-visual-project-unlock="${escapeHtml(project.id)}" data-visual-project-source="${source}">Devolver a simulador</button>
            </div>`
          : `<button class="row-delete-button" type="button" data-visual-project-delete="${escapeHtml(project.id)}" ${pendingDelete ? "disabled" : ""}>${pendingDelete ? "Pendiente" : "Eliminar"}</button>`;
        body.push(`<tr class="visual-line-row visual-project-row ${pendingDelete ? "pending-delete" : ""} ${locked ? "locked" : ""}">
          <td>
            <input class="visual-label-input derived-control" value="${escapeHtml(project.name)}" readonly />
            <small>${escapeHtml(project.status === "optimized" ? "mes óptimo" : "mes manual")} · ${escapeHtml(project.monthLabel)}${locked ? " · fijo en plan" : ""}${pendingDelete ? " · se borrará al guardar" : ""}</small>
            ${renderProjectSavingsProgress(project, true)}
          </td>
          ${columns
            .map((column) => {
              const value = sumColumnMonths(column, (month) => project.values[monthIndexByKey.get(month.key)] || 0);
              if (compactYears && column.kind === "year-summary") return `<td class="visual-year-cell negative">${value ? money(value, true) : ""}</td>`;
              return `<td><input class="visual-amount-input derived-control" type="number" step="0.01" value="${value ? amountInputValue(value) : ""}" readonly /></td>`;
            })
            .join("")}
          <td>${actionCell}</td>
        </tr>`);
      });
    }
  }

  qs("visualSummary").innerHTML = [
    ["Ingresos rango", money(totals.income, true), "positive"],
    ["Gastos rango", money(totals.expense, true), "negative"],
    ["Neto rango", money(totals.income - totals.expense, true), totals.income - totals.expense >= 0 ? "positive" : "negative"],
    ["Líneas / reales", `${totals.lines} líneas · ${totals.realRows} reales`, ""],
  ]
    .map(([label, value, klass]) => `<div class="expense-summary-card"><span>${label}</span><strong class="${klass}">${value}</strong></div>`)
    .join("");

  qs("visualDetailTable").className = `visual-matrix ${compactYears ? "compact-years" : ""}`;
  qs("visualDetailTable").innerHTML = `<thead><tr><th>Partida</th>${monthHeaders}<th>Acción</th></tr></thead><tbody>${body.join("")}</tbody>`;

  document.querySelectorAll("[data-visual-year-toggle]").forEach((button) => {
    button.addEventListener("click", () => toggleVisualYear(button.dataset.visualYearToggle));
  });
  document.querySelectorAll("[data-visual-section-toggle]").forEach((button) => {
    button.addEventListener("click", () => toggleVisualSection(button.dataset.visualSectionToggle));
  });
  document.querySelectorAll("[data-visual-select-row]").forEach((input) => {
    input.addEventListener("change", () => toggleVisualRowSelection(input.dataset.visualSelectRow, input.checked));
  });
  document.querySelectorAll("[data-visual-cell]").forEach((input) => {
    input.addEventListener("change", () => updateVisualCell(input));
  });
  document.querySelectorAll("[data-visual-label-key]").forEach((input) => {
    input.addEventListener("change", () => updateVisualLabel(input));
  });
  document.querySelectorAll("[data-visual-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteVisualRow(button.dataset.visualDelete));
  });
  document.querySelectorAll("[data-visual-project-delete]").forEach((button) => {
    button.addEventListener("click", () => stageVisualProjectDelete(button.dataset.visualProjectDelete));
  });
  document.querySelectorAll("[data-visual-project-unlock]").forEach((button) => {
    button.addEventListener("click", () =>
      returnDecisionToSimulator(button.dataset.visualProjectSource, button.dataset.visualProjectUnlock),
    );
  });
  renderVisualPrevision(months);
  renderVisualSavePanel();
}

function handleVisualAddRow() {
  const kind = qs("visualAddKind").value;
  const sectionName = qs("visualAddSection").value;
  const label = qs("visualAddLabel").value.trim();
  const amountInput = qs("visualAddAmount").value;
  const parsedAmount = parseAmount(amountInput);
  const amount = amountInput === "" || parsedAmount === null ? 0 : round2(parsedAmount);
  const startKey = qs("visualAddStartMonth").value;
  const endKey = visualAddSingleMonthMode() ? startKey : qs("visualAddEndMonth").value;
  const feedback = qs("visualAddFeedback");
  if (!label) {
    if (feedback) {
      feedback.textContent = "Pon un nombre de concepto para crear la línea.";
      feedback.className = "inline-feedback warning";
    }
    qs("visualAddLabel").focus();
    return;
  }
  const sharedId = `custom-${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const targetMonths = monthsInRange(startKey, endKey);
  targetMonths.forEach((month) => {
    customPlanningRows.push({
      id: sharedId,
      custom: true,
      kind,
      sectionName,
      label,
      monthKey: month.key,
      plannedValue: amount,
    });
  });
  expandedVisualSections.add(`${kind}:${sectionName}`);
  expandedPlanningSections[kind].add(`${kind}:${sectionName}`);
  saveCustomPlanningRows();
  qs("visualAddLabel").value = "";
  qs("visualAddAmount").value = "";
  render();
  if (qs("visualAddFeedback")) {
    const scopeText = targetMonths.length === 1 ? `solo en ${targetMonths[0].label}` : `de ${targetMonths[0]?.label} a ${targetMonths.at(-1)?.label}`;
    qs("visualAddFeedback").textContent = `${label} añadida ${scopeText}. Puedes editar sus importes directamente en la tabla.`;
    qs("visualAddFeedback").className = "inline-feedback success";
  }
  showImportLog("Línea añadida", `${label} se ha incorporado a ${targetMonths.length} mes(es) y ya recalcula todo el dashboard.`);
}

function previsionMetric(row) {
  const outflowsBeforeIncome =
    row.outflowsBeforeSaving ?? Number(row.coreSpend || 0) + Number(row.car || 0) + Number(row.refi || 0) + Number(row.projectOutflow || 0);
  const lateOutflows = Math.max(0, Number(row.endOfMonthOutflows || 0));
  const earlyOutflowsBeforeIncome = Math.max(0, outflowsBeforeIncome - lateOutflows);
  const result = row.netBeforeSaving ?? Number(row.totalLiquidity || 0) - Number(row.startLiquidity || 0);
  const max = Number(row.startLiquidity || 0) + result;
  const min = Number(row.startLiquidity || 0) - earlyOutflowsBeforeIncome;
  const adjustedMin = min + Number(row.prePayrollIncome || 0);
  return {
    result,
    max,
    min,
    adjustedMax: max,
    adjustedMin,
    minDateLabel: row.minDateLabel || row.firstIncomeDateLabel || row.month,
    maxDateLabel: row.lastIncomeDateLabel || row.mainPayrollDateLabel || row.month,
    adjustedMinDateLabel: row.adjustedMinDateLabel || row.mainPayrollDateLabel || row.month,
  };
}

function previsionYears() {
  return [...new Set(openSimulationRows(lastSimulation).map((row) => cashflowYear(row)))].filter(Boolean);
}

function populatePrevisionYearSelect() {
  const select = qs("previsionYear");
  if (!select) return;
  const previous = select.value;
  const years = previsionYears();
  select.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join("");
  select.value = years.includes(previous) ? previous : years[0] || "";
}

function previsionRowsForYear(year) {
  return lastSimulation
    .map((row, index) => ({
      row,
      planned: lastPlannedSimulation[index] || row,
      index,
    }))
    .filter((item) => !isClosedMonthKey(item.row.detailMonthKey) && cashflowYear(item.row) === year);
}

function previsionRowsForMonths(months) {
  const monthKeys = new Set(months.map((month) => month.key));
  return lastSimulation
    .map((row, index) => ({
      row,
      planned: lastPlannedSimulation[index] || row,
      index,
    }))
    .filter((item) => monthKeys.has(item.row.detailMonthKey));
}

function previsionCell(value, mode = "") {
  const klass = mode || (value < 0 ? "negative" : value > 0 ? "positive" : "");
  return `<td class="${klass}">${money(value, true)}</td>`;
}

function renderPrevisionValueRow(label, items, getter, mode = "") {
  return `<tr>
    <td>${escapeHtml(label)}</td>
    ${items.map((item) => previsionCell(getter(item), mode)).join("")}
  </tr>`;
}

function renderPrevisionSimulationRow(label, items, rows, mode = "positive") {
  return renderPrevisionValueRow(label, items, (item) => rows[item.index]?.totalLiquidity ?? 0, mode);
}

function renderPrevisionGroup(title, klass = "", colspan = 20) {
  return `<tr class="prevision-group-row ${klass}"><td colspan="${colspan}">${escapeHtml(title)}</td></tr>`;
}

function decisionComparisonRows(items) {
  if (!projectPlan.placements.length) return [];
  const rows = [
    renderPrevisionGroup("Comparativa de decisiones", "comparison", Math.max(2, items.length + 1)),
    renderPrevisionSimulationRow("Sin proyectos ni deuda", items, lastBaseSimulation, ""),
    renderPrevisionSimulationRow("Con todo lo cargado", items, lastSimulation, "positive"),
  ];
  const months = forecastMonths();
  projectPlan.placements.forEach((placement) => {
    const outflows = Array(months.length).fill(0);
    addScheduledDecisionOutflow(outflows, placement, placement.startIndex);
    const simulatedRows = simulate(outflows);
    const prefix = placement.source === "debt" ? "Deuda" : "Proyecto";
    const label = `${prefix} · ${placement.name || "Sin nombre"}`;
    rows.push(renderPrevisionSimulationRow(label, items, simulatedRows, "positive"));
  });
  return rows;
}

function renderPrevisionRows(items) {
  const colspan = Math.max(2, items.length + 1);
  return [
    renderPrevisionGroup("Reales", "real", colspan),
    renderPrevisionValueRow("Resultado mes", items, (item) => previsionMetric(item.row).result),
    renderPrevisionValueRow("Saldo máximo", items, (item) => previsionMetric(item.row).max, "positive"),
    renderPrevisionValueRow("Mínimo", items, (item) => previsionMetric(item.row).min),
    renderPrevisionGroup("Reales · flujo ajustado", "adjusted", colspan),
    renderPrevisionValueRow("Saldo máximo", items, (item) => previsionMetric(item.row).adjustedMax, "positive"),
    renderPrevisionValueRow("Mínimo ajustado", items, (item) => previsionMetric(item.row).adjustedMin),
    ...decisionComparisonRows(items),
  ];
}

function groupPrevisionItemsByYear(items) {
  const groups = [];
  items.forEach((item) => {
    const year = String(cashflowYear(item.row));
    let group = groups.at(-1);
    if (!group || group.key !== year) {
      group = { key: year, label: year, items: [], index: item.index, row: item.row };
      groups.push(group);
    }
    group.items.push(item);
    group.index = item.index;
    group.row = item.row;
  });
  return groups;
}

function renderPrevisionAnnualValueRow(label, groups, getter, mode = "") {
  return `<tr>
    <td>${escapeHtml(label)}</td>
    ${groups.map((group) => previsionCell(getter(group), mode)).join("")}
  </tr>`;
}

function renderPrevisionAnnualRows(groups) {
  const colspan = Math.max(2, groups.length + 1);
  return [
    renderPrevisionGroup("Reales", "real", colspan),
    renderPrevisionAnnualValueRow("Resultado año", groups, (group) =>
      sumRows(group.items, (item) => previsionMetric(item.row).result),
    ),
    renderPrevisionAnnualValueRow("Saldo máximo", groups, (group) =>
      Math.max(...group.items.map((item) => previsionMetric(item.row).max)),
    "positive"),
    renderPrevisionAnnualValueRow("Mínimo", groups, (group) =>
      Math.min(...group.items.map((item) => previsionMetric(item.row).min)),
    ),
    renderPrevisionGroup("Reales · flujo ajustado", "adjusted", colspan),
    renderPrevisionAnnualValueRow("Saldo máximo", groups, (group) =>
      Math.max(...group.items.map((item) => previsionMetric(item.row).adjustedMax)),
    "positive"),
    renderPrevisionAnnualValueRow("Mínimo ajustado", groups, (group) =>
      Math.min(...group.items.map((item) => previsionMetric(item.row).adjustedMin)),
    ),
    ...decisionComparisonRows(groups),
  ];
}

function previsionDisplayItemsForColumns(columns, monthlyItems) {
  const byKey = new Map(monthlyItems.map((item) => [item.row.detailMonthKey, item]));
  return columns
    .map((column) => {
      if (column.kind === "month") {
        const item = byKey.get(column.key);
        return item ? { ...item, label: column.label, kind: "month", items: [item] } : null;
      }
      const items = column.months.map((month) => byKey.get(month.key)).filter(Boolean);
      const last = items.at(-1);
      return last ? { key: column.key, label: column.label, kind: "year-summary", items, index: last.index, row: last.row } : null;
    })
    .filter(Boolean);
}

function previsionDisplayValue(item, metricName) {
  const metrics = item.items.map((entry) => previsionMetric(entry.row));
  if (metricName === "result") return sumRows(metrics, (metric) => metric.result);
  if (metricName === "max") return Math.max(...metrics.map((metric) => metric.max));
  if (metricName === "min") return Math.min(...metrics.map((metric) => metric.min));
  if (metricName === "adjustedMax") return Math.max(...metrics.map((metric) => metric.adjustedMax));
  if (metricName === "adjustedMin") return Math.min(...metrics.map((metric) => metric.adjustedMin));
  return 0;
}

function renderPrevisionDisplayRows(items) {
  const colspan = Math.max(2, items.length + 1);
  return [
    renderPrevisionGroup("Reales", "real", colspan),
    renderPrevisionValueRow("Resultado", items, (item) => previsionDisplayValue(item, "result")),
    renderPrevisionValueRow("Saldo máximo", items, (item) => previsionDisplayValue(item, "max"), "positive"),
    renderPrevisionValueRow("Mínimo", items, (item) => previsionDisplayValue(item, "min")),
    renderPrevisionGroup("Reales · flujo ajustado", "adjusted", colspan),
    renderPrevisionValueRow("Saldo máximo", items, (item) => previsionDisplayValue(item, "adjustedMax"), "positive"),
    renderPrevisionValueRow("Mínimo ajustado", items, (item) => previsionDisplayValue(item, "adjustedMin")),
    ...decisionComparisonRows(items),
  ];
}

function rangeKpiMetric(rows) {
  const metrics = rows.map((row) => ({ row, metric: previsionMetric(row) }));
  if (!metrics.length) return null;
  const minItem = metrics.reduce((best, item) => (item.metric.min < best.metric.min ? item : best), metrics[0]);
  const maxItem = metrics.reduce((best, item) => (item.metric.max > best.metric.max ? item : best), metrics[0]);
  const adjustedMinItem = metrics.reduce(
    (best, item) => (item.metric.adjustedMin < best.metric.adjustedMin ? item : best),
    metrics[0],
  );
  return {
    min: minItem.metric.min,
    minMonth: minItem.row.month,
    minDate: minItem.metric.minDateLabel,
    max: maxItem.metric.max,
    maxMonth: maxItem.row.month,
    maxDate: maxItem.metric.maxDateLabel,
    adjustedMin: adjustedMinItem.metric.adjustedMin,
    adjustedMinMonth: adjustedMinItem.row.month,
    adjustedMinDate: adjustedMinItem.metric.adjustedMinDateLabel,
    adjustedIncome: Number(adjustedMinItem.row.prePayrollIncome || 0),
  };
}

function renderVisualRangeKpis() {
  const panel = qs("visualRangeKpis");
  if (!panel) return;
  const metrics = rangeKpiMetric(openSimulationRows(lastSimulation));
  if (!metrics) {
    panel.innerHTML = "";
    return;
  }
  panel.innerHTML = `<div class="section-title compact">
      <div>
        <p class="panel-kicker">Resumen de caja</p>
        <h3>Mínimos y máximo del horizonte</h3>
        <p>Lectura rápida de la tensión de caja hasta el final de la simulación.</p>
      </div>
    </div>
    <div class="range-kpi-grid">
      <div class="range-kpi-card adjusted">
        <span>Min ajustado</span>
        <strong>${money(metrics.adjustedMin, true)}</strong>
        <p>${escapeHtml(metrics.adjustedMinMonth)} · ${escapeHtml(metrics.adjustedMinDate || "")} · antes de nómina Javi, sumando cobros previos (${money(metrics.adjustedIncome, true)}).</p>
      </div>
      <div class="range-kpi-card minimum">
        <span>Min</span>
        <strong>${money(metrics.min, true)}</strong>
        <p>${escapeHtml(metrics.minMonth)} · ${escapeHtml(metrics.minDate || "")} · peor punto antes de cobros del mes.</p>
      </div>
      <div class="range-kpi-card maximum">
        <span>Max</span>
        <strong>${money(metrics.max, true)}</strong>
        <p>${escapeHtml(metrics.maxMonth)} · ${escapeHtml(metrics.maxDate || "")} · mayor liquidez estimada tras cobros.</p>
      </div>
    </div>`;
}

function renderVisualPrevision(months = visualMonths()) {
  if (!qs("visualPrevisionTable")) return;
  const items = previsionRowsForMonths(months);
  if (!items.length) {
    qs("visualPrevisionTable").innerHTML = "";
    renderVisualRangeKpis();
    return;
  }
  const compactYears = visualTimeMode() === "year";
  const displayItems = compactYears ? previsionDisplayItemsForColumns(visualColumns(months), items) : items;
  const headers = displayItems
    .map((item) => (compactYears ? renderVisualColumnHeader({ kind: item.kind, key: item.key || item.row.detailMonthKey, label: item.label, year: String(cashflowYear(item.row)), expanded: expandedVisualYears.has(String(cashflowYear(item.row))) }) : `<th>${escapeHtml(item.row.month)}</th>`))
    .join("");
  const rows = compactYears ? renderPrevisionDisplayRows(displayItems) : renderPrevisionRows(displayItems);
  qs("visualPrevisionTable").className = `prevision-table visual-prevision-table ${compactYears ? "compact-years" : ""}`;
  qs("visualPrevisionTable").innerHTML = `<thead><tr><th>Indicador</th>${headers}</tr></thead><tbody>${rows.join("")}</tbody>`;
  document.querySelectorAll("#visualPrevisionTable [data-visual-year-toggle]").forEach((button) => {
    button.addEventListener("click", () => toggleVisualYear(button.dataset.visualYearToggle));
  });
  renderVisualRangeKpis();
}

const DEFAULT_AGENT_CAIXA_FLOOR = 2500;

function savingsAgentSettings() {
  scenarioSettings.savingsAgent = scenarioSettings.savingsAgent || {};
  return scenarioSettings.savingsAgent;
}

function agentDebtOptimizerSettings() {
  const settings = savingsAgentSettings();
  settings.debtOptimizer = settings.debtOptimizer || { mode: "optimized", order: {}, agreements: {} };
  settings.debtOptimizer.order = settings.debtOptimizer.order || {};
  settings.debtOptimizer.agreements = settings.debtOptimizer.agreements || {};
  settings.debtOptimizer.mode = settings.debtOptimizer.mode || "optimized";
  return settings.debtOptimizer;
}

function agentDebtAgreementAmount(id, originalPrincipal) {
  const raw = agentDebtOptimizerSettings().agreements?.[id];
  const parsed = parseAmount(raw);
  if (parsed === null || parsed <= 0) return round2(originalPrincipal);
  return round2(Math.min(parsed, originalPrincipal));
}

function agentDebtManualRank(id) {
  const value = Number(agentDebtOptimizerSettings().order?.[id]);
  return Number.isFinite(value) && value > 0 ? value : 999;
}

function normalizeAgentDebtManualOrder(settings, candidates = null) {
  const available = candidates || agentDebtPayoffCandidates();
  const originalOrder = new Map(available.map((item, index) => [item.id, index]));
  const ranked = available
    .map((item) => ({
      id: item.id,
      value: Number(settings.order?.[item.id]),
      original: originalOrder.get(item.id) ?? 999,
    }))
    .sort((a, b) => {
      const rankA = Number.isFinite(a.value) && a.value > 0 ? a.value : 9999;
      const rankB = Number.isFinite(b.value) && b.value > 0 ? b.value : 9999;
      return rankA - rankB || a.original - b.original;
    });
  settings.order = {};
  ranked.forEach((item, index) => {
    settings.order[item.id] = index + 1;
  });
  return settings.order;
}

function agentCaixaFloor() {
  const value = Number(savingsAgentSettings().caixaFloor);
  return Number.isFinite(value) && value >= 0 ? round2(value) : DEFAULT_AGENT_CAIXA_FLOOR;
}

function setAgentCaixaFloor(value) {
  const parsed = parseAmount(value);
  savingsAgentSettings().caixaFloor = parsed === null ? DEFAULT_AGENT_CAIXA_FLOOR : Math.max(0, round2(parsed));
  saveScenarioSettings();
}

function handleAgentCaixaFloorChange() {
  setAgentCaixaFloor(qs("agentCaixaFloor")?.value);
  renderSavingsAgent();
}

function agentNextMonthReserve(sourceRows, index, caixaFloor = agentCaixaFloor()) {
  const next = sourceRows[index + 1];
  if (!next) return caixaFloor;
  return round2(caixaFloor + Math.max(0, Number(next.outflowsBeforeSaving || 0)));
}

function buildSavingsAgentPlan(sourceRowsOverride = null) {
  const sourceRows = sourceRowsOverride || (lastSimulation.length ? lastSimulation : simulate(projectPlan.outflows || []));
  const start = accountBalancesFromState();
  const caixaFloor = agentCaixaFloor();
  let caixa = Number(start.caixa || 0);
  let mediolanum = Number(start.mediolanum || 0);
  let totalTransferred = 0;
  let totalRescued = 0;
  let shortage = 0;
  let projectSpend = 0;
  const rows = sourceRows.map((row, index) => {
    const result = round2(row.income - row.coreSpend - row.car - row.refi - row.projectOutflow);
    const beforeTransfer = round2(caixa + result);
    const requiredReserve = agentNextMonthReserve(sourceRows, index, caixaFloor);
    const rescue = beforeTransfer < requiredReserve ? round2(Math.min(mediolanum, requiredReserve - beforeTransfer)) : 0;
    const protectedCaixa = round2(beforeTransfer + rescue);
    const monthShortage = Math.max(0, round2(requiredReserve - protectedCaixa));
    const transfer = Math.max(0, round2(protectedCaixa - requiredReserve));
    caixa = round2(protectedCaixa - transfer);
    mediolanum = round2(mediolanum + transfer - rescue);
    totalTransferred = round2(totalTransferred + transfer);
    totalRescued = round2(totalRescued + rescue);
    shortage = round2(shortage + monthShortage);
    projectSpend = round2(projectSpend + Math.max(0, Number(row.projectOutflow || 0)));
    return {
      ...row,
      agentIndex: index,
      operatingResult: result,
      requiredReserve,
      transferToSavings: transfer,
      rescueFromSavings: rescue,
      shortage: monthShortage,
      agentCaixa: caixa,
      agentMediolanum: mediolanum,
      agentTotal: round2(caixa + mediolanum),
    };
  });
  const plannedDebtPrincipal = round2(
    sumRows(debtLiquidations, (item) =>
      isDebtResumeMode(item.payoffMode || item.mode) ? 0 : Number(item.originalPrincipal || item.targetPrincipal || item.amount || 0),
    ),
  );
  const openDebtPrincipal = round2(sumRows(debtTargetOptions({ includePlanned: true }), (item) => Number(item.currentPrincipal || item.principal || 0)));
  const remainingDebt = Math.max(0, round2(openDebtPrincipal - plannedDebtPrincipal));
  const final = rows.at(-1) || {};
  return {
    rows,
    caixaFloor,
    totalTransferred,
    totalRescued,
    shortage,
    projectSpend,
    plannedDebtPrincipal,
    remainingDebt,
    finalCaixa: round2(final.agentCaixa || start.caixa || 0),
    finalMediolanum: round2(final.agentMediolanum || start.mediolanum || 0),
    finalTotal: round2(final.agentTotal || start.total || 0),
    netWorth: round2((final.agentTotal || start.total || 0) - remainingDebt),
    minCaixa: rows.length ? Math.min(...rows.map((row) => row.agentCaixa)) : start.caixa,
    minReserveCoverage: rows.length ? Math.min(...rows.map((row) => row.agentCaixa - row.requiredReserve)) : 0,
    maxSavings: rows.length ? Math.max(...rows.map((row) => row.agentMediolanum)) : start.mediolanum,
  };
}

function agentVisibleRows(plan) {
  const rows = plan?.rows || [];
  const visible = openSimulationRows(rows);
  return visible.length ? visible : rows;
}

function agentYears(plan) {
  return [...new Set(agentVisibleRows(plan).map((row) => String(cashflowYear(row))))].filter(Boolean);
}

function populateAgentYearSelect(plan) {
  const select = qs("agentYear");
  if (!select) return;
  const years = agentYears(plan);
  const previous = select.value;
  select.innerHTML = years.map((year) => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`).join("");
  select.value = years.includes(previous) ? previous : years[0] || "";
}

function agentRowsForYear(plan, year) {
  return agentVisibleRows(plan).filter((row) => String(cashflowYear(row)) === String(year));
}

function agentStatusForRow(row) {
  if (row.shortage > 0) return { label: "Falta caja", tone: "danger" };
  if (row.rescueFromSavings > 0) return { label: "Usa ahorro", tone: "warn" };
  if (row.transferToSavings > 0) return { label: "Ahorra", tone: "good" };
  return { label: "Reserva operativa", tone: "neutral" };
}

function agentAffordabilityMonth(plan, amount, buffer = 0) {
  const threshold = Number(amount || 0) + Number(buffer || 0);
  const startingSavings = Number(accountBalancesFromState().mediolanum || 0);
  const rows = agentVisibleRows(plan);
  return rows.find((row, index) => {
    const savingsBeforeMonth = index === 0 ? startingSavings : Number(rows[index - 1]?.agentMediolanum || 0);
    return savingsBeforeMonth >= threshold;
  });
}

function agentDebtRecommendations(plan) {
  const alreadyPlanned = new Set(debtLiquidations.map((item) => item.targetId).filter(Boolean));
  const settings = agentDebtOptimizerSettings();
  return debtTargetOptions({ includePlanned: false })
    .filter((item) => !alreadyPlanned.has(item.id) && Number(item.currentPrincipal || item.principal || 0) > 0)
    .map((item) => {
      const principal = round2(Number(item.currentPrincipal || item.principal || 0));
      const payment = debtMonthlyReliefForMode(item, "optimize");
      const originalPayment = round2(Number(item.originalPayment || 0));
      const affordability = agentAffordabilityMonth(plan, principal, plan.caixaFloor * 0.35);
      const efficiency = principal ? payment / principal : 0;
      return {
        ...item,
        principal,
        payment,
        originalPayment,
        affordability,
        monthLabel: affordability?.month || "No alcanzado",
        efficiency,
        manualRank: agentDebtManualRank(item.id),
        score: (affordability ? 1000 - affordability.agentIndex : 0) + efficiency * 10000 + payment + (debtTargetIsSuspended(item) ? 150 : 0),
      };
    })
    .sort((a, b) =>
      settings.mode === "manual" || settings.mode === "agreements"
        ? a.manualRank - b.manualRank || b.score - a.score
        : b.score - a.score,
    )
    .slice(0, 5);
}

function agentDebtPayoffCandidates() {
  const alreadyPlanned = new Set(debtLiquidations.map((item) => item.targetId).filter(Boolean));
  return debtTargetOptions({ includePlanned: false })
    .filter((item) => !alreadyPlanned.has(item.id) && Number(item.currentPrincipal || item.principal || 0) > 0)
    .map((item) => {
      const originalPrincipal = round2(Number(item.currentPrincipal || item.principal || 0));
      const principal = agentDebtAgreementAmount(item.id, originalPrincipal);
      const suspended = debtTargetIsSuspended(item);
      const payment = debtMonthlyReliefForMode(item, "optimize");
      const originalPayment = round2(Number(item.originalPayment || item.currentPayment || item.payment || 0));
      return {
        ...item,
        originalPrincipal,
        principal,
        payment,
        originalPayment,
        suspended,
        agreementSavings: round2(originalPrincipal - principal),
        manualRank: agentDebtManualRank(item.id),
        effectiveRelief: suspended ? 0 : payment,
        efficiency: principal ? (suspended ? 0 : payment / principal) : 0,
      };
    })
    .filter((item) => item.principal > 0);
}

function agentDebtDecisionForCandidate(candidate, startIndex) {
  const months = forecastMonths();
  return {
    id: `agent-opt-${candidate.id}-${startIndex}`,
    source: "debt",
    targetId: candidate.id,
    targetPrincipal: candidate.principal,
    originalPrincipal: candidate.originalPrincipal || candidate.principal,
    name: debtTargetDisplayName(candidate),
    amount: candidate.principal,
    duration: 1,
    monthlyRelief: candidate.effectiveRelief,
    reliefMonths: debtReliefMonthsForItem(
      {
        targetId: candidate.id,
        monthlyRelief: candidate.effectiveRelief,
        targetPrincipal: candidate.principal,
        originalPrincipal: candidate.principal,
      },
      startIndex + 1,
    ),
    payoffMode: "fixed",
    mode: "fixed",
    optimizedFromAgent: true,
    monthIndex: startIndex,
    monthKey: months[startIndex]?.key,
  };
}

function isAgentRouteSimulationDecision(item) {
  return item?.routeSimulation === AGENT_ROUTE_SIMULATION_TAG;
}

function agentRouteSimulationDecisions() {
  return debtLiquidations.filter(isAgentRouteSimulationDecision);
}

function clearAgentRouteSimulation({ rerender = true, record = true } = {}) {
  const removed = agentRouteSimulationDecisions();
  if (!removed.length) return 0;
  debtLiquidations = debtLiquidations.filter((item) => !isAgentRouteSimulationDecision(item));
  agentDebtOptimizationCache = { key: "", value: null };
  simulationSignature = "";
  if (record) {
    decisionEvents.unshift({
      id: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      date: new Date().toISOString(),
      source: "debt",
      itemId: "agent-route",
      name: "Ruta óptima de deuda",
      status: "devuelta a simulación",
      owner: "Hogar",
      amount: round2(sumRows(removed, (item) => Number(item.amount || item.targetPrincipal || 0))),
      creditCapital: 0,
      monthLabel: "",
      note: "Simulación completa de amortizaciones retirada del cuadro de mandos y del flujo mensual.",
    });
    saveDecisionEvents();
  }
  saveDebtLiquidations();
  if (rerender) render();
  return removed.length;
}

function applyAgentRouteSimulation() {
  clearAgentRouteSimulation({ rerender: false, record: false });
  recomputeModelIfNeeded(true);
  agentDebtOptimizationCache = { key: "", value: null };
  const optimization = agentOptimalDebtPayoffPlan();
  const steps = optimization?.steps || [];
  if (!steps.length) {
    renderSavingsAgent();
    return 0;
  }
  const reservedTargets = new Set(debtLiquidations.map((item) => item.targetId).filter(Boolean));
  const additions = steps
    .filter((step) => step?.candidate?.id && !reservedTargets.has(step.candidate.id))
    .map((step) => {
      reservedTargets.add(step.candidate.id);
      const decision = step.decision || agentDebtDecisionForCandidate(step.candidate, step.monthIndex);
      return {
        ...decision,
        id: `debt-route-${step.candidate.id}-${step.monthIndex}-${Date.now()}`,
        name: `Ruta óptima · ${debtTargetDisplayName(step.candidate)}`,
        amount: round2(step.candidate.principal),
        targetPrincipal: round2(step.candidate.principal),
        originalPrincipal: round2(step.candidate.originalPrincipal || step.candidate.principal),
        monthlyRelief: round2(step.candidate.effectiveRelief || 0),
        mode: "fixed",
        payoffMode: decision.payoffMode === "retomar-optimize" ? "retomar" : "fixed",
        monthIndex: step.monthIndex,
        monthKey: forecastMonths()[step.monthIndex]?.key,
        routeSimulation: AGENT_ROUTE_SIMULATION_TAG,
        routeOrder: step.order,
        status: "simulated",
        locked: false,
        monthLabel: step.monthLabel,
      };
    });
  if (!additions.length) {
    renderSavingsAgent();
    return 0;
  }
  debtLiquidations.push(...additions);
  decisionEvents.unshift({
    id: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date: new Date().toISOString(),
    source: "debt",
    itemId: "agent-route",
    name: "Ruta óptima de deuda",
    status: "simulado",
    owner: "Hogar",
    amount: round2(sumRows(additions, (item) => Number(item.amount || item.targetPrincipal || 0))),
    creditCapital: 0,
    monthLabel: additions.at(-1)?.monthLabel || "",
    note: "Simulación completa aplicada temporalmente al cuadro de mandos y al flujo mensual. Se puede retirar sin borrar decisiones fijas.",
  });
  agentDebtOptimizationCache = { key: "", value: null };
  simulationSignature = "";
  saveDebtLiquidations();
  saveDecisionEvents();
  render();
  return additions.length;
}

function routeSimulationSummaryFromActive(plan) {
  const active = agentRouteSimulationDecisions();
  if (!active.length) return null;
  const baseline = buildAgentPlanFromOutflows(decisionOutflowsExcluding(isAgentRouteSimulationDecision));
  const current = plan || buildSavingsAgentPlan();
  const months = forecastMonths();
  const ordered = active.slice().sort((a, b) => Number(a.monthIndex || 0) - Number(b.monthIndex || 0));
  return {
    active: true,
    count: active.length,
    total: round2(sumRows(active, (item) => Number(item.amount || item.targetPrincipal || 0))),
    debtReduced: round2(sumRows(active, (item) => Number(item.originalPrincipal || item.targetPrincipal || item.amount || 0))),
    firstMonth: months[ordered[0]?.monthIndex || 0]?.label || ordered[0]?.monthLabel || "",
    lastMonth: months[ordered.at(-1)?.monthIndex || 0]?.label || ordered.at(-1)?.monthLabel || "",
    liquidityDelta: round2((current.finalTotal || 0) - (baseline.finalTotal || 0)),
    netWorthDelta: round2((current.netWorth || 0) - (baseline.netWorth || 0)),
    minCaixa: current.minCaixa,
    minReserveCoverage: current.minReserveCoverage,
  };
}

function routeSimulationSummaryFromOptimization(optimization) {
  const steps = optimization?.steps || [];
  if (!steps.length) return null;
  return {
    active: false,
    count: steps.length,
    total: round2(sumRows(steps, (step) => Number(step.candidate?.principal || 0))),
    debtReduced: optimization.totalOriginalPrincipal || round2(sumRows(steps, (step) => Number(step.candidate?.originalPrincipal || step.candidate?.principal || 0))),
    firstMonth: steps[0]?.monthLabel || "",
    lastMonth: optimization.lastMonth || steps.at(-1)?.monthLabel || "",
    liquidityDelta: round2((optimization.finalPlan?.finalTotal || 0) - (optimization.baselinePlan?.finalTotal || 0)),
    netWorthDelta: optimization.netWorthDelta || 0,
    minCaixa: optimization.finalPlan?.minCaixa || 0,
    minReserveCoverage: optimization.finalPlan?.minReserveCoverage || 0,
  };
}

function buildAgentPlanFromOutflows(outflows) {
  return buildSavingsAgentPlan(simulate(outflows));
}

function agentDebtOptimizationFeasible(plan, startIndex) {
  if (!plan?.rows?.length) return false;
  const fromStart = plan.rows.slice(Math.max(0, startIndex));
  return plan.shortage <= 0 && fromStart.every((row) => Number(row.agentCaixa || 0) + 0.01 >= Number(row.requiredReserve || 0));
}

function findAgentBestDebtPayoffStep(baseOutflows, candidates, startIndex = 0) {
  const months = forecastMonths();
  const currentPlan = buildAgentPlanFromOutflows(baseOutflows);
  const startingSavings = Number(accountBalancesFromState().mediolanum || 0);
  const optimizerMode = agentDebtOptimizerSettings().mode;
  const evaluated = [];
  candidates.forEach((candidate) => {
    let bestForCandidate = null;
    for (let monthIndex = Math.max(0, startIndex); monthIndex < months.length; monthIndex += 1) {
      if (isClosedMonthKey(months[monthIndex]?.key)) continue;
      const savingsBeforeMonth =
        monthIndex === 0 ? startingSavings : Number(currentPlan.rows[monthIndex - 1]?.agentMediolanum || 0);
      if (savingsBeforeMonth + 0.01 < candidate.principal) continue;
      const testOutflows = baseOutflows.slice();
      const decision = agentDebtDecisionForCandidate(candidate, monthIndex);
      addScheduledDecisionOutflow(testOutflows, decision, monthIndex);
      const testPlan = buildAgentPlanFromOutflows(testOutflows);
      if (agentDebtOptimizationFeasible(testPlan, monthIndex)) {
        const monthRow = testPlan.rows[monthIndex] || {};
        const reliefScore = candidate.effectiveRelief * 6;
        const prudenceScore = Math.min(5000, Math.max(0, Number(monthRow.agentMediolanum || 0)));
        const agreementScore = optimizerMode === "agreements" ? Number(candidate.agreementSavings || 0) * 120 : 0;
        const manualPenalty = optimizerMode === "manual" || optimizerMode === "agreements" ? agentDebtManualRank(candidate.id) * 10000000 : 0;
        bestForCandidate = {
          candidate,
          decision,
          monthIndex,
          monthLabel: months[monthIndex]?.label || "",
          plan: testPlan,
          minReserveCoverage: testPlan.minReserveCoverage,
          finalMediolanum: testPlan.finalMediolanum,
          score:
            manualPenalty +
            monthIndex * 100000 -
            reliefScore -
            candidate.efficiency * 50000 -
            Math.min(candidate.principal, 10000) -
            prudenceScore * 0.02 -
            agreementScore,
        };
        break;
      }
    }
    if (bestForCandidate) evaluated.push(bestForCandidate);
  });
  return evaluated.sort((a, b) => a.score - b.score)[0] || null;
}

function agentOptimalDebtPayoffPlan() {
  const cacheKey = JSON.stringify({
    signature: simulationSignature || modelComputationSignature(),
    caixaFloor: agentCaixaFloor(),
    balances: accountBalancesFromState(),
    optimizer: agentDebtOptimizerSettings(),
  });
  if (agentDebtOptimizationCache.key === cacheKey && agentDebtOptimizationCache.value) {
    return agentDebtOptimizationCache.value;
  }
  const baseOutflows = decisionBaselineOutflows();
  const baselinePlan = buildAgentPlanFromOutflows(baseOutflows);
  let workingOutflows = baseOutflows.slice();
  let candidates = agentDebtPayoffCandidates();
  const steps = [];
  const maxSteps = Math.min(candidates.length, 12);

  for (let guard = 0; guard < maxSteps && candidates.length; guard += 1) {
    const best = findAgentBestDebtPayoffStep(workingOutflows, candidates, 0);
    if (!best) break;
    addScheduledDecisionOutflow(workingOutflows, best.decision, best.monthIndex);
    const updatedPlan = buildAgentPlanFromOutflows(workingOutflows);
    const step = {
      ...best,
      plan: updatedPlan,
      order: steps.length + 1,
      cumulativePrincipal: round2(sumRows(steps, (item) => item.candidate.principal) + best.candidate.principal),
      cumulativeRelief: round2(sumRows(steps, (item) => item.candidate.effectiveRelief) + best.candidate.effectiveRelief),
      finalMediolanum: updatedPlan.finalMediolanum,
      minReserveCoverage: updatedPlan.minReserveCoverage,
    };
    steps.push(step);
    workingOutflows = workingOutflows.slice();
    candidates = candidates.filter((item) => item.id !== best.candidate.id);
  }

  const finalPlan = buildAgentPlanFromOutflows(workingOutflows);
  const totalPrincipal = round2(sumRows(steps, (item) => item.candidate.principal));
  const totalOriginalPrincipal = round2(sumRows(steps, (item) => item.candidate.originalPrincipal || item.candidate.principal));
  const optimizedRemainingDebt = Math.max(0, round2((baselinePlan.remainingDebt || 0) - totalOriginalPrincipal));
  const optimizedNetWorth = round2((finalPlan.finalTotal || 0) - optimizedRemainingDebt);
  const result = {
    baselinePlan,
    finalPlan,
    steps,
    remaining: candidates,
    totalPrincipal,
    totalOriginalPrincipal,
    totalRelief: round2(sumRows(steps, (item) => item.candidate.effectiveRelief)),
    optimizedRemainingDebt,
    optimizedNetWorth,
    netWorthDelta: round2(optimizedNetWorth - (baselinePlan.netWorth || 0)),
    lastMonth: steps.at(-1)?.monthLabel || "Sin fecha",
  };
  agentDebtOptimizationCache = { key: cacheKey, value: result };
  return result;
}

function agentProjectTargetIndex(project) {
  const placement = projectPlan?.placements?.find((item) => item.id === project.id);
  if (Number.isFinite(Number(placement?.startIndex))) return Number(placement.startIndex);
  const months = forecastMonths();
  if (project.monthKey) {
    const indexFromKey = months.findIndex((month) => month.key === project.monthKey);
    if (indexFromKey >= 0) return indexFromKey;
  }
  return Math.max(0, Math.min(Number(project.monthIndex || 0), months.length - 1));
}

function projectSavingsProgress(project, plan = null) {
  const months = forecastMonths();
  const amount = decisionGrossCost(project);
  const targetIndex = agentProjectTargetIndex(project);
  const currentSavings = Math.max(0, Number(accountBalancesFromState().mediolanum || 0));
  const targetRow = plan?.rows?.[targetIndex];
  const preExecutionSavings = targetRow
    ? Math.max(0, Number(targetRow.agentMediolanum || 0) + Math.max(0, Number(targetRow.projectOutflow || 0)))
    : currentSavings;
  const monthsToTarget = Math.max(1, targetIndex + 1);
  const saved = round2(Math.min(amount, currentSavings));
  const projected = round2(Math.min(amount, Math.max(saved, preExecutionSavings)));
  const remaining = round2(Math.max(0, amount - saved));
  const remainingAtTarget = round2(Math.max(0, amount - projected));
  const monthlyPot = round2(remaining / monthsToTarget);
  return {
    amount,
    saved,
    projected,
    remaining,
    remainingAtTarget,
    monthlyPot,
    percent: amount > 0 ? Math.min(100, Math.max(0, (saved / amount) * 100)) : 0,
    projectedPercent: amount > 0 ? Math.min(100, Math.max(0, (projected / amount) * 100)) : 0,
    startLabel: months[0]?.label || "",
    targetLabel: months[targetIndex]?.label || project.monthLabel || "",
    monthsToTarget,
  };
}

function renderProjectSavingsProgress(project, compact = false, progressOverride = null) {
  if (!project || project.source === "debt" || project.locked || decisionGrossCost(project) <= 0) return "";
  if (decisionCreditCapital(project) > 0) {
    return `<div class="project-savings-progress ${compact ? "compact" : ""}">
      <div class="project-savings-progress-head">
        <span>Financiación externa</span>
        <strong>${money(decisionCreditCapital(project), true)} de capital</strong>
      </div>
      <div class="project-savings-progress-foot">
        <span>${project.creditOwner ? `Titular: ${escapeHtml(project.creditOwner)}` : "Titular no indicado"}</span>
        <span>Cuota prevista ${money(project.recurringAmount || 0, true)} durante ${project.recurringDuration || 0} mes(es)</span>
      </div>
    </div>`;
  }
  const progress = progressOverride || projectSavingsProgress(project);
  return `<div class="project-savings-progress ${compact ? "compact" : ""}">
    <div class="project-savings-progress-head">
      <span>Hucha desde ${escapeHtml(progress.startLabel)}</span>
      <strong>${money(progress.projected, true)} / ${money(progress.amount, true)}</strong>
    </div>
    <div class="project-savings-bar" aria-label="Progreso de hucha">
      <span style="width:${progress.percent.toFixed(1)}%"></span>
      <i style="left:${progress.projectedPercent.toFixed(1)}%"></i>
    </div>
    <div class="project-savings-progress-foot">
      <span>Ahora ${money(progress.saved, true)} · objetivo ${escapeHtml(progress.targetLabel)}</span>
      <span>Faltan ${money(progress.remainingAtTarget, true)} al objetivo · ${money(progress.monthlyPot, true)}/mes</span>
    </div>
  </div>`;
}

function agentLifeProjectRecommendations(plan) {
  return projects
    .filter((project) => !project.locked && Number(decisionGrossCost(project)) > 0)
    .map((project) => {
      const amount = decisionGrossCost(project);
      const targetIndex = agentProjectTargetIndex(project);
      const targetRow = plan.rows[targetIndex];
      const monthsToGoal = Math.max(1, targetIndex + 1);
      const progress = projectSavingsProgress(project, plan);
      const pot = Number.isFinite(Number(progress.monthlyPot)) ? progress.monthlyPot : round2(amount / monthsToGoal);
      const evaluation = evaluateProjectDecisionItem({ ...project, monthIndex: targetIndex });
      return {
        ...project,
        amount,
        affordability: targetRow,
        monthLabel: targetRow?.month || forecastMonths()[targetIndex]?.label || "No alcanzado",
        pot,
        progress,
        targetIndex,
        minChecking: evaluation?.evaluation?.minChecking,
        netGain: evaluation?.netGain,
      };
    })
    .sort((a, b) => (a.targetIndex ?? 999) - (b.targetIndex ?? 999))
    .slice(0, 5);
}

function agentInsightCards(plan, debtRecs, projectRecs) {
  const rows = agentVisibleRows(plan);
  const firstShortage = rows.find((row) => row.shortage > 0);
  const nextTransfer = rows.find((row) => row.transferToSavings > 0);
  const topDebt = debtRecs[0];
  const topProject = projectRecs[0];
  const cards = [];
  cards.push({
    title: firstShortage ? "Hay meses sin caja suficiente" : "Regla de caja viable",
    text: firstShortage
      ? `${firstShortage.month}: faltarían ${money(firstShortage.shortage, true)} para cubrir la reserva operativa del mes siguiente. Revisa proyectos o ahorro antes de fijar más decisiones.`
      : `CaixaBank retiene ${money(plan.caixaFloor, true)} más los pagos previstos del mes siguiente. Primer traspaso posible: ${nextTransfer ? `${money(nextTransfer.transferToSavings, true)} en ${nextTransfer.month} (${nextTransfer.transferDateLabel || "fin de mes"})` : "sin excedente próximo"}.`,
    tone: firstShortage ? "danger" : "good",
  });
  cards.push({
    title: topDebt ? "Mejor deuda candidata" : "Sin deuda candidata",
    text: topDebt
      ? `${topDebt.entity} ${topDebt.type}: ${money(topDebt.principal, true)}. El ahorro la cubriría en ${topDebt.monthLabel}; cuota liberable ${money(topDebt.payment, true)}.`
      : "No hay deuda viva sin plan cargado. El agente priorizará proyectos o colchón.",
    tone: topDebt ? "warn" : "good",
  });
  cards.push({
    title: topProject ? "Proyecto de vida más cercano" : "Sin proyectos pendientes",
    text: topProject
      ? `${topProject.name}: hucha sugerida ${money(topProject.pot, true)}/mes; objetivo alcanzable en ${topProject.monthLabel}.`
      : "Añade proyectos en el simulador para que el agente calcule huchas, fecha objetivo y modalidad.",
    tone: topProject ? "good" : "neutral",
  });
  return cards;
}

function agentTodayCards(plan) {
  const rows = agentVisibleRows(plan);
  const today = rows[0] || {};
  const next = rows[1] || {};
  const transferableNow = Math.max(0, Number(today.transferToSavings || 0));
  const reserveGap = Math.max(0, round2(Number(today.requiredReserve || plan.caixaFloor) - Number(today.agentCaixa || 0)));
  const nextOutflows = Number(next.outflowsBeforeSaving || 0);
  return [
    {
      label: "Puedes traspasar hoy",
      value: money(transferableNow, true),
      detail: transferableNow
        ? `Fecha sugerida ${today.transferDateLabel || today.month}; manteniendo ${money(plan.caixaFloor, true)} y cubriendo ${money(nextOutflows, true)} del mes siguiente.`
        : "No hay excedente seguro; conserva la caja operativa.",
      tone: transferableNow ? "good" : "warn",
    },
    {
      label: "Reserva protegida",
      value: money(today.requiredReserve || plan.caixaFloor, true),
      detail: `Saldo operativo ${money(plan.caixaFloor, true)} + pagos previstos del próximo mes.`,
      tone: reserveGap ? "danger" : "good",
    },
    {
      label: "Resultado del mes",
      value: money(today.operatingResult || 0, true),
      detail: `${escapeHtml(today.month || "Mes actual")} · cobros hasta ${today.lastIncomeDateLabel || today.mainPayrollDateLabel || "fin de mes"}; antes del traspaso automático.`,
      tone: Number(today.operatingResult || 0) >= 0 ? "good" : "danger",
    },
    {
      label: "Ahorro disponible",
      value: money(today.agentMediolanum || 0, true),
      detail: "Mediolanum tras aplicar traspasos/rescates del mes.",
      tone: "neutral",
    },
  ];
}

function renderAgentToday(plan) {
  const target = qs("agentToday");
  if (!target) return;
  target.innerHTML = agentTodayCards(plan)
    .map(
      (card) => `<article class="agent-today-card ${card.tone}">
        <span>${escapeHtml(card.label)}</span>
        <strong>${card.value}</strong>
        <p>${escapeHtml(card.detail)}</p>
      </article>`,
    )
    .join("");
}

function renderAgentQuarterPlan(plan) {
  const target = qs("agentQuarterPlan");
  if (!target) return;
  const rows = agentVisibleRows(plan).slice(0, 3);
  target.innerHTML = rows.length
    ? rows
        .map((row) => {
          const status = agentStatusForRow(row);
          return `<article class="agent-month-card ${status.tone}">
            <div>
              <span>${escapeHtml(row.month)}</span>
              <strong>${escapeHtml(status.label)}</strong>
            </div>
            <dl>
              <div><dt>Resultado</dt><dd class="${row.operatingResult < 0 ? "negative" : "positive"}">${money(row.operatingResult, true)}</dd></div>
              <div><dt>Reserva</dt><dd>${money(row.requiredReserve, true)}</dd></div>
              <div><dt>Traspaso</dt><dd class="positive">${money(row.transferToSavings, true)}<small>${escapeHtml(row.transferDateLabel || "cierre de mes")}</small></dd></div>
              <div><dt>Mediolanum</dt><dd>${money(row.agentMediolanum, true)}</dd></div>
            </dl>
          </article>`;
        })
        .join("")
    : `<div class="empty-state compact">Sin meses suficientes para agenda.</div>`;
}

function agentPriorityQueue(plan, debtRecs, projectRecs) {
  const queue = [];
  const rows = agentVisibleRows(plan);
  const firstShortage = rows.find((row) => row.shortage > 0);
  const firstTransfer = rows.find((row) => row.transferToSavings > 0);
  if (firstShortage) {
    queue.push({
      tone: "danger",
      title: "Proteger caja antes de decidir",
      meta: `${firstShortage.month}: faltan ${money(firstShortage.shortage, true)} frente a la reserva del mes siguiente.`,
      action: "Revisar simulador",
      target: "simulator",
      score: 10000,
    });
  } else {
    queue.push({
      tone: "good",
      title: "Traspaso prudente a Mediolanum",
      meta: firstTransfer
        ? `${money(firstTransfer.transferToSavings, true)} el ${firstTransfer.transferDateLabel || firstTransfer.month}, manteniendo pagos del mes siguiente cubiertos.`
        : "Sin excedente inmediato: esperar al próximo ingreso antes de mover ahorro.",
      action: "Ver evolución",
      target: "savings-agent",
      score: 9000,
    });
  }
  debtRecs.slice(0, 3).forEach((item, index) => {
    const suspended = debtTargetIsSuspended(item);
    queue.push({
      tone: suspended ? "warn" : item.affordability ? "good" : "warn",
      title: `${suspended ? "Negociar" : "Liquidar"} ${item.entity} ${item.type}`,
      meta: suspended
        ? `${money(item.principal, true)} pendiente y pagos suspendidos: buscar quita/reunificación; no cuenta como cuota liberable.`
        : `${money(item.principal, true)}; mes sugerido ${item.monthLabel}; cuota liberable ${money(item.payment, true)}.`,
      action: "Preparar deuda",
      debtId: item.id,
      score: 7000 - index * 100 + item.score,
    });
  });
  projectRecs.slice(0, 3).forEach((item, index) => {
    queue.push({
      tone: item.affordability ? "good" : "warn",
      title: `Hucha ${item.name}`,
      meta: `${money(item.pot, true)}/mes hasta ${item.monthLabel}; acumulado previsto ${money(item.progress?.projected || 0, true)}; faltan ${money(item.progress?.remainingAtTarget || 0, true)}.`,
      action: "Revisar proyecto",
      projectId: item.id,
      score: 6200 - index * 100 - Number(item.targetIndex || 0),
    });
  });
  return queue.sort((a, b) => b.score - a.score).slice(0, 7);
}

function renderAgentPriorityQueue(plan, debtRecs, projectRecs) {
  const target = qs("agentPriorityQueue");
  if (!target) return;
  const queue = agentPriorityQueue(plan, debtRecs, projectRecs);
  target.innerHTML = queue.length
    ? queue
        .map(
          (item, index) => `<article class="agent-priority-card ${item.tone}">
            <span>${index + 1}</span>
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.meta)}</p>
            </div>
            ${
              item.debtId
                ? `<button type="button" data-agent-debt-target="${escapeHtml(item.debtId)}">${escapeHtml(item.action)}</button>`
                : item.projectId
                  ? `<button type="button" data-agent-project-id="${escapeHtml(item.projectId)}">${escapeHtml(item.action)}</button>`
                  : `<button type="button" data-home-nav="${escapeHtml(item.target || "savings-agent")}">${escapeHtml(item.action)}</button>`
            }
          </article>`,
        )
        .join("")
    : `<div class="empty-state compact">Sin acciones recomendadas ahora mismo.</div>`;
}

function agentPlanSummary(plan) {
  const visibleRows = agentVisibleRows(plan);
  const decisions = [
    ...projects.map((item) => ({ ...item, source: "project" })),
    ...debtLiquidations.map((item) => ({ ...item, source: "debt" })),
  ];
  const pending = decisions.filter((item) => !item.locked);
  const locked = decisions.filter((item) => item.locked);
  const nextImpact = visibleRows.find((row) => Math.abs(Number(row.projectOutflow || 0)) >= 0.01);
  const pendingAmount = round2(sumRows(pending, (item) => decisionGrossCost(item)));
  const fixedAmount = round2(sumRows(locked, (item) => decisionGrossCost(item)));
  const debtCount = decisions.filter((item) => item.source === "debt").length;
  const projectCount = decisions.filter((item) => item.source === "project").length;
  return {
    total: decisions.length,
    pending: pending.length,
    locked: locked.length,
    debtCount,
    projectCount,
    pendingAmount,
    fixedAmount,
    nextImpactMonth: nextImpact?.month || "Sin impacto próximo",
    nextImpactAmount: round2(nextImpact?.projectOutflow || 0),
  };
}

function agentTwelveMonthCapacity(plan) {
  const visibleRows = agentVisibleRows(plan);
  const rows = visibleRows.slice(0, 12);
  const firstShortage = visibleRows.find((row) => row.shortage > 0);
  const nextImpact = visibleRows.find((row) => Math.abs(Number(row.projectOutflow || 0)) >= 0.01);
  const lowestReserveRow = visibleRows.reduce((lowest, row) => {
    if (!lowest) return row;
    return Number(row.agentCaixa || 0) - Number(row.requiredReserve || 0) <
      Number(lowest.agentCaixa || 0) - Number(lowest.requiredReserve || 0)
      ? row
      : lowest;
  }, null);
  return {
    totalTransfer12m: round2(sumRows(rows, (row) => row.transferToSavings)),
    avgTransfer12m: rows.length ? round2(sumRows(rows, (row) => row.transferToSavings) / rows.length) : 0,
    totalResult12m: round2(sumRows(rows, (row) => row.operatingResult)),
    firstShortage,
    nextImpact,
    lowestReserveRow,
  };
}

function renderAgentDecisionBoard(plan, debtRecs, projectRecs) {
  const target = qs("agentDecisionBoard");
  if (!target) return;
  const capacity = agentTwelveMonthCapacity(plan);
  const today = agentVisibleRows(plan)[0] || {};
  const topDebt = debtRecs[0];
  const topProject = projectRecs[0];
  const nextDecision = topDebt && (!topProject || topDebt.score > 7200)
    ? {
        title: `Preparar deuda: ${topDebt.entity}`,
        value: money(topDebt.principal, true),
        detail: `${topDebt.monthLabel}. ${debtTargetIsSuspended(topDebt) ? "Negociar quita/reunificación; no imputar ahorro ficticio." : `Cuota liberable ${money(topDebt.payment, true)}.`}`,
        tone: "warn",
        action: "Preparar deuda",
        debtId: topDebt.id,
      }
    : topProject
      ? {
          title: `Hucha: ${topProject.name}`,
          value: money(topProject.progress?.remainingAtTarget ?? topProject.amount, true),
          detail: `${money(topProject.pot, true)}/mes hasta ${topProject.monthLabel}. Acumulado previsto ${money(topProject.progress?.projected || 0, true)}.`,
          tone: "good",
          action: "Revisar proyecto",
          projectId: topProject.id,
        }
      : {
          title: "Sin decisión urgente",
          value: "Esperar",
          detail: "No hay deuda o proyecto pendiente con mejor prioridad que proteger caja y transferir ahorro.",
          tone: "neutral",
          action: "Ver plan",
          target: "savings-agent",
        };
  const cards = [
    {
      title: "Traspaso prudente ahora",
      value: money(today.transferToSavings || 0, true),
      detail: `Después de reservar ${money(today.requiredReserve || plan.caixaFloor, true)} para CaixaBank.`,
      tone: Number(today.transferToSavings || 0) > 0 ? "good" : "warn",
    },
    {
      title: nextDecision.title,
      value: nextDecision.value,
      detail: nextDecision.detail,
      tone: nextDecision.tone,
      action: nextDecision.action,
      debtId: nextDecision.debtId,
      projectId: nextDecision.projectId,
      target: nextDecision.target,
    },
    {
      title: "Capacidad 12 meses",
      value: money(capacity.totalTransfer12m, true),
      detail: `Media mensual transferible ${money(capacity.avgTransfer12m, true)}; resultado acumulado ${money(capacity.totalResult12m, true)}.`,
      tone: capacity.totalTransfer12m > 0 ? "good" : "warn",
    },
    {
      title: capacity.firstShortage ? "Riesgo de caja" : "Margen mínimo de caja",
      value: capacity.firstShortage ? money(capacity.firstShortage.shortage, true) : money((capacity.lowestReserveRow?.agentCaixa || 0) - (capacity.lowestReserveRow?.requiredReserve || 0), true),
      detail: capacity.firstShortage
        ? `${capacity.firstShortage.month}: falta frente a la reserva del mes siguiente.`
        : `${capacity.lowestReserveRow?.month || "Plan"} mantiene CaixaBank sobre la reserva definida.`,
      tone: capacity.firstShortage ? "danger" : "good",
    },
  ];
  target.innerHTML = cards
    .map(
      (card) => `<article class="agent-decision-card ${card.tone}">
        <span>${escapeHtml(card.title)}</span>
        <strong>${card.value}</strong>
        <p>${escapeHtml(card.detail)}</p>
        ${
          card.debtId
            ? `<button type="button" data-agent-debt-target="${escapeHtml(card.debtId)}">${escapeHtml(card.action)}</button>`
            : card.projectId
              ? `<button type="button" data-agent-project-id="${escapeHtml(card.projectId)}">${escapeHtml(card.action)}</button>`
              : card.target
                ? `<button type="button" data-home-nav="${escapeHtml(card.target)}">${escapeHtml(card.action)}</button>`
                : ""
        }
      </article>`,
    )
    .join("");
}

function executiveToneForAmount(value) {
  if (Number(value || 0) < 0) return "danger";
  if (Number(value || 0) === 0) return "warn";
  return "good";
}

function renderAgentExecutive(plan, debtRecs, projectRecs, debtOptimization) {
  const target = qs("agentExecutive");
  if (!target) return;
  const rows = agentVisibleRows(plan);
  const today = rows[0] || {};
  const nextMonth = rows[1] || {};
  const planSummary = agentPlanSummary(plan);
  const capacity = agentTwelveMonthCapacity(plan);
  const firstDebtStep = debtOptimization?.steps?.[0] || null;
  const bestDebt = firstDebtStep?.candidate || debtRecs[0] || null;
  const bestProject = projectRecs[0] || null;
  const marginNow = round2(Number(today.agentCaixa || 0) - Number(today.requiredReserve || plan.caixaFloor));
  const nextImpactText = planSummary.nextImpactAmount
    ? `${money(planSummary.nextImpactAmount, true)} en ${planSummary.nextImpactMonth}`
    : "Sin impactos próximos cargados";
  const immediateActions = [];

  if (today.shortage > 0) {
    immediateActions.push({
      tone: "danger",
      title: "No traspasar todavía",
      meta: `${today.month}: faltan ${money(today.shortage, true)} frente a la reserva operativa. Revisa gastos/proyectos antes de fijar más decisiones.`,
      action: "Ver simulador",
      target: "simulator",
    });
  } else if (today.transferToSavings > 0) {
    immediateActions.push({
      tone: "good",
      title: "Traspaso seguro a Mediolanum",
      meta: `Mover ${money(today.transferToSavings, true)} el ${today.transferDateLabel || "cierre de mes"} y dejar CaixaBank cubriendo ${money(today.requiredReserve || plan.caixaFloor, true)}.`,
      action: "Ver flujo",
      target: "cashflow",
    });
  } else {
    immediateActions.push({
      tone: "warn",
      title: "Esperar a próximo ingreso",
      meta: `Hoy la caja queda justa. Próximo cierre de cobros: ${today.lastIncomeDateLabel || today.mainPayrollDateLabel || today.month}. Mantén CaixaBank en ${money(today.requiredReserve || plan.caixaFloor, true)} antes de transferir ahorro.`,
      action: "Ver previsión",
      target: "forecast",
    });
  }

  if (bestDebt) {
    const monthLabel = firstDebtStep?.monthLabel || bestDebt.monthLabel || "mes por calcular";
    const pactado = firstDebtStep?.candidate?.principal ?? bestDebt.principal;
    const original = firstDebtStep?.candidate?.originalPrincipal ?? bestDebt.originalPrincipal ?? bestDebt.principal;
    const agreementText = original && original > pactado ? ` · quita ${money(original - pactado, true)}` : "";
    immediateActions.push({
      tone: "warn",
      title: `Preparar deuda: ${bestDebt.entity} ${bestDebt.type}`,
      meta: `${money(pactado, true)} en ${monthLabel}${agreementText}. Pagos suspendidos: no sumar cuota liberada como ingreso si no se paga ahora.`,
      action: "Preparar deuda",
      debtId: bestDebt.id,
    });
  }

  if (bestProject) {
    immediateActions.push({
      tone: "good",
      title: `Hucha/proyecto: ${bestProject.name}`,
      meta: `${money(bestProject.pot, true)}/mes hasta ${bestProject.monthLabel}. Acumulado previsto ${money(bestProject.progress?.projected || 0, true)}.`,
      action: "Revisar proyecto",
      projectId: bestProject.id,
    });
  }

  if (!bestDebt && !bestProject && today.shortage <= 0) {
    immediateActions.push({
      tone: "neutral",
      title: "Sin decisión nueva urgente",
      meta: "Prioriza traspaso automático y mantenimiento de colchón. Añade proyectos o acuerdos para que el agente proponga ruta.",
      action: "Añadir proyecto",
      target: "simulator",
    });
  }
  const mergedActions = immediateActions.slice();
  agentPriorityQueue(plan, debtRecs, projectRecs).forEach((item) => {
    const duplicate = mergedActions.some((existing) =>
      (item.debtId && existing.debtId === item.debtId) ||
      (item.projectId && existing.projectId === item.projectId) ||
      (normalizedText(item.title).includes("traspaso") && normalizedText(existing.title).includes("traspaso")) ||
      (!item.debtId && !item.projectId && existing.target === item.target && existing.action === item.action),
    );
    if (!duplicate) mergedActions.push(item);
  });

  const guardrails = [
    {
      label: "Margen caja hoy",
      value: money(marginNow, true),
      tone: marginNow >= 0 ? "good" : "danger",
      note: `Sobre reserva de ${money(today.requiredReserve || plan.caixaFloor, true)}.`,
    },
    {
      label: "Pagos mes siguiente",
      value: money(Math.max(0, Number(nextMonth.outflowsBeforeSaving || 0)), true),
      tone: "neutral",
      note: nextMonth.month ? `Reserva previa para ${nextMonth.month}.` : "Sin mes posterior.",
    },
    {
      label: "Capacidad libre real",
      value: money(monthlyFreeCapacity(plan.rows || []), true),
      tone: executiveToneForAmount(monthlyFreeCapacity(plan.rows || [])),
      note: "Media mensual tras gastos, deuda, proyectos y ahorro objetivo.",
    },
    {
      label: "Planes considerados",
      value: `${planSummary.pending} pend. · ${planSummary.locked} fijo(s)`,
      tone: planSummary.pending ? "warn" : "good",
      note: `Próximo impacto: ${nextImpactText}.`,
    },
    {
      label: "Ruta deuda",
      value: debtOptimization?.lastMonth || "Sin ruta",
      tone: debtOptimization?.steps?.length ? "warn" : "neutral",
      note: debtOptimization?.steps?.length
        ? `${debtOptimization.steps.length} paso(s), ${money(debtOptimization.totalPrincipal, true)} pactados.`
        : "No hay deudas vivas optimizables.",
    },
  ];

  const alerts = [];
  if (capacity.firstShortage) {
    alerts.push(`Caja: ${capacity.firstShortage.month} tiene déficit de ${money(capacity.firstShortage.shortage, true)}.`);
  }
  if (planSummary.nextImpactAmount > 0) {
    alerts.push(`Proyecto/deuda cargada: impacto próximo de ${money(planSummary.nextImpactAmount, true)} en ${planSummary.nextImpactMonth}.`);
  }
  if (debtOptimization?.steps?.[0]?.candidate?.agreementSavings > 0) {
    alerts.push(`Acuerdo interesante: primera deuda con mejora de ${money(debtOptimization.steps[0].candidate.agreementSavings, true)}.`);
  }
  if (!alerts.length) alerts.push("Sin alertas críticas: mantener traspaso prudente y revisar acuerdos antes de fijarlos.");

  target.innerHTML = `<div class="agent-executive-grid">
    <div class="agent-executive-actions">
      ${mergedActions
        .slice(0, 6)
        .map(
          (item, index) => `<article class="agent-executive-action ${item.tone}">
            <span>${index + 1}</span>
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.meta)}</p>
            </div>
            ${
              item.debtId
                ? `<button type="button" data-agent-debt-target="${escapeHtml(item.debtId)}">${escapeHtml(item.action)}</button>`
                : item.projectId
                  ? `<button type="button" data-agent-project-id="${escapeHtml(item.projectId)}">${escapeHtml(item.action)}</button>`
                  : `<button type="button" data-home-nav="${escapeHtml(item.target || "savings-agent")}">${escapeHtml(item.action)}</button>`
            }
          </article>`,
        )
        .join("")}
    </div>
    <aside class="agent-executive-side">
      <div class="agent-executive-metrics">
        ${guardrails
          .map(
            (item) => `<div class="${item.tone}">
              <span>${escapeHtml(item.label)}</span>
              <strong>${typeof item.value === "string" ? escapeHtml(item.value) : item.value}</strong>
              <small>${escapeHtml(item.note)}</small>
            </div>`,
          )
          .join("")}
      </div>
      <div class="agent-executive-alerts">
        <span>Checklist de control</span>
        <ul>${alerts.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
    </aside>
  </div>`;
}

function renderAgentDebtOptimizerControls() {
  const settings = agentDebtOptimizerSettings();
  const candidates = agentDebtPayoffCandidates();
  if (!candidates.length) return "";
  const usedOrders = new Map();
  candidates.forEach((item, index) => {
    const value = settings.order[item.id] ?? index + 1;
    const key = String(value);
    usedOrders.set(key, (usedOrders.get(key) || 0) + 1);
  });
  const hasDuplicateOrders = [...usedOrders.values()].some((count) => count > 1);
  return `<div class="agent-debt-controls">
    <div class="agent-debt-control-head">
      <div>
        <span class="panel-kicker">Criterio de ruta</span>
        <strong>Orden y acuerdos</strong>
        <p>Define el orden y los importes pactados que usará el agente para calcular la ruta. No aplica ninguna deuda al cuadro de mandos hasta que prepares o simules una decisión.</p>
        ${hasDuplicateOrders ? `<p class="agent-debt-order-warning">Hay órdenes repetidas. Al aplicar el criterio se normalizarán automáticamente para que no haya duplicados.</p>` : ""}
      </div>
      <label>
        <span>Modo</span>
        <select id="agentDebtOptimizerMode">
          <option value="optimized" ${settings.mode === "optimized" ? "selected" : ""}>Optimizado automático</option>
          <option value="manual" ${settings.mode === "manual" ? "selected" : ""}>Orden manual</option>
          <option value="agreements" ${settings.mode === "agreements" ? "selected" : ""}>Priorizar acuerdos pactados</option>
        </select>
      </label>
    </div>
    <div class="agent-debt-control-list">
      ${candidates
        .map((item, index) => {
          const order = settings.order[item.id] ?? index + 1;
          const agreement = settings.agreements[item.id] ?? "";
          return `<div class="agent-debt-control-row">
            <span>${escapeHtml(item.entity)} · ${escapeHtml(item.type)} <small>${escapeHtml(item.number || "")}</small></span>
            <label><small>Orden</small><input data-agent-debt-order="${escapeHtml(item.id)}" type="number" min="1" step="1" value="${escapeHtml(order)}" /></label>
            <label><small>Pactado</small><input data-agent-debt-agreement="${escapeHtml(item.id)}" type="number" min="0" step="0.01" placeholder="${amountInputValue(item.originalPrincipal || item.principal)}" value="${agreement === "" ? "" : amountInputValue(agreement)}" /></label>
          </div>`;
        })
        .join("")}
    </div>
    <div class="agent-debt-save-row">
      <p>Guarda este criterio y recalcula la ruta sugerida. Sirve para que el agente respete tus prioridades, pero no mueve dinero ni crea amortizaciones por sí solo.</p>
      <button type="button" class="secondary-button agent-debt-save" data-agent-debt-settings-save>Guardar criterio y recalcular ruta</button>
    </div>
  </div>`;
}

function saveAgentDebtOptimizerSettingsFromForm() {
  const settings = agentDebtOptimizerSettings();
  settings.mode = qs("agentDebtOptimizerMode")?.value || "optimized";
  settings.order = {};
  settings.agreements = {};
  const candidates = agentDebtPayoffCandidates();
  document.querySelectorAll("[data-agent-debt-order]").forEach((input) => {
    const value = Number(input.value);
    if (Number.isFinite(value) && value > 0) settings.order[input.dataset.agentDebtOrder] = Math.round(value);
  });
  normalizeAgentDebtManualOrder(settings, candidates);
  document.querySelectorAll("[data-agent-debt-agreement]").forEach((input) => {
    const parsed = parseAmount(input.value);
    if (parsed !== null && parsed > 0) settings.agreements[input.dataset.agentDebtAgreement] = round2(parsed);
  });
  agentDebtOptimizationCache = { key: "", value: null };
  saveScenarioSettings();
  renderSavingsAgent();
}

function renderAgentRouteSimulationPanel(optimization) {
  const activeSummary = routeSimulationSummaryFromActive();
  const summary = activeSummary || routeSimulationSummaryFromOptimization(optimization);
  if (!summary) return "";
  const statusText = summary.active
    ? "Ruta simulada en el modelo"
    : "Ruta lista para simular";
  const note = summary.active
    ? "Estas amortizaciones ya están entrando temporalmente en cuadro de mandos, previsión y flujo mensual. Puedes retirarlas sin tocar decisiones fijas."
    : "Añade toda la ruta óptima como decisiones simuladas para comparar el impacto completo antes de fijar nada.";
  return `<section class="agent-route-simulation ${summary.active ? "active" : ""}">
    <div class="agent-route-copy">
      <span>Simulación global</span>
      <h3>${escapeHtml(statusText)}</h3>
      <p>${escapeHtml(note)}</p>
    </div>
    <div class="agent-route-metrics">
      <div><small>Amortizaciones</small><strong>${summary.count}</strong><span>${escapeHtml(summary.firstMonth)} - ${escapeHtml(summary.lastMonth)}</span></div>
      <div><small>Total aplicado</small><strong>${money(summary.total, true)}</strong><span>${money(summary.debtReduced, true)} deuda baja</span></div>
      <div><small>Liquidez vs base</small><strong class="${summary.liquidityDelta >= 0 ? "positive" : "negative"}">${money(summary.liquidityDelta, true)}</strong><span>efecto caja</span></div>
      <div><small>Patrimonio vs base</small><strong class="${summary.netWorthDelta >= 0 ? "positive" : "negative"}">${money(summary.netWorthDelta, true)}</strong><span>incluye quitas</span></div>
      <div><small>Caja mínima</small><strong>${money(summary.minCaixa, true)}</strong><span>margen ${money(summary.minReserveCoverage, true)}</span></div>
    </div>
    <div class="agent-route-actions">
      <button type="button" data-agent-route-simulate>${summary.active ? "Recalcular ruta completa" : "Simular ruta completa"}</button>
      ${summary.active ? `<button type="button" class="secondary" data-agent-route-clear>Quitar simulación</button>` : ""}
      <button type="button" class="secondary" data-home-nav="visual-detail">Ver cuadro de mandos</button>
      <button type="button" class="secondary" data-home-nav="cashflow">Ver flujo mensual</button>
    </div>
  </section>`;
}

function renderAgentDebtOptimization(optimization) {
  const target = qs("agentDebtOptimization");
  if (!target) return;
  const controls = renderAgentDebtOptimizerControls();
  const routePanel = renderAgentRouteSimulationPanel(optimization);
  const steps = optimization?.steps || [];
  if (!steps.length) {
    const remaining = optimization?.remaining?.length || 0;
    target.innerHTML = `${controls}${routePanel}<div class="empty-state compact">
      ${remaining ? "No hay una amortización viable manteniendo la reserva operativa actual. Prueba a subir plazo, reducir importe pactado o esperar a más ahorro." : "No quedan deudas vivas sin decisión cargada para optimizar."}
    </div>`;
    return;
  }
  const finalDelta = round2((optimization.finalPlan?.finalMediolanum || 0) - (optimization.baselinePlan?.finalMediolanum || 0));
  const summaryCards = [
    ["Deuda liquidada", money(optimization.totalPrincipal, true), `${steps.length} deuda(s) en ruta`],
    ["Fin de ruta", optimization.lastMonth, "Última amortización sugerida"],
    ["Cuota liberable real", money(optimization.totalRelief, true), "No suma cuotas suspendidas como ingreso"],
    ["Patrimonio vs base", money(optimization.netWorthDelta, true), `Mediolanum final: ${money(finalDelta, true)} frente a no amortizar`],
  ];
  target.innerHTML = `${controls}<div class="agent-optimization-summary">
      ${summaryCards
        .map(
          ([label, value, note]) => `<div>
            <span>${escapeHtml(label)}</span>
            <strong>${typeof value === "string" ? escapeHtml(value) : value}</strong>
            <small>${escapeHtml(note)}</small>
          </div>`,
        )
        .join("")}
    </div>
    ${routePanel}
    <div class="agent-optimization-steps">
      ${steps
        .map((step) => {
          const item = step.candidate;
          const suspendedNote = item.suspended
            ? "Pagos suspendidos: liquidar reduce deuda, pero no genera una cuota liberable adicional en caja."
            : `Libera ${money(item.effectiveRelief, true)}/mes desde el mes posterior, hasta vencimiento o límite prudente.`;
          return `<article class="agent-optimization-step ${item.suspended ? "warn" : "good"}">
            <span class="agent-step-number">${step.order}</span>
            <div class="agent-step-main">
              <strong>${escapeHtml(item.entity)} · ${escapeHtml(item.type)}</strong>
              <p>${escapeHtml(item.number || "")} · ${escapeHtml(suspendedNote)}</p>
              ${item.agreementSavings > 0 ? `<p class="agent-agreement-note">Acuerdo pactado: ${money(item.principal, true)} frente a ${money(item.originalPrincipal, true)} (${money(item.agreementSavings, true)} de mejora).</p>` : ""}
            </div>
            <div class="agent-step-metrics">
              <div><small>Mes óptimo</small><b>${escapeHtml(step.monthLabel)}</b></div>
              <div><small>Amortización</small><b>${money(item.principal, true)}</b></div>
              <div><small>Caja mínima</small><b>${money(step.plan.minCaixa, true)}</b></div>
              <div><small>Margen reserva</small><b>${money(step.minReserveCoverage, true)}</b></div>
            </div>
            <button type="button" data-agent-debt-target="${escapeHtml(item.id)}" data-agent-debt-month="${escapeHtml(String(step.monthIndex))}" data-agent-debt-amount="${escapeHtml(String(item.principal))}">Preparar esta amortización</button>
          </article>`;
        })
        .join("")}
    </div>`;
}

function renderAgentPlanSummary(plan) {
  const target = qs("agentPlanSummary");
  if (!target) return;
  const summary = agentPlanSummary(plan);
  const hasPlans = summary.total > 0;
  target.innerHTML = `<div>
      <p class="panel-kicker">Planes en cálculo</p>
      <h3>${hasPlans ? `${summary.total} plan(es) considerados` : "Sin planes cargados"}</h3>
      <p>${hasPlans ? "El agente ya los incorpora al flujo hasta que los elimines o los fijes definitivamente." : "Añade proyectos o decisiones de deuda para que el agente calcule impacto, hucha y prioridad."}</p>
    </div>
    <div class="agent-plan-summary-grid">
      <div><span>Pendientes</span><strong>${summary.pending}</strong><small>${money(summary.pendingAmount, true)}</small></div>
      <div><span>Fijos</span><strong>${summary.locked}</strong><small>${money(summary.fixedAmount, true)}</small></div>
      <div><span>Deuda / vida</span><strong>${summary.debtCount} / ${summary.projectCount}</strong><small>decisiones activas</small></div>
      <div><span>Próximo impacto</span><strong class="${summary.nextImpactAmount < 0 ? "positive" : summary.nextImpactAmount > 0 ? "negative" : ""}">${money(summary.nextImpactAmount, true)}</strong><small>${escapeHtml(summary.nextImpactMonth)}</small></div>
    </div>`;
}

function renderAgentRecommendationCard(item, type) {
  if (type === "debt") {
    const canPay = Boolean(item.affordability);
    const suspended = debtTargetIsSuspended(item);
    return `<article class="agent-rec-card ${canPay ? "good" : "warn"}">
      <div>
        <span>Deuda</span>
        <strong>${escapeHtml(item.entity)} · ${escapeHtml(item.type)}</strong>
        <p>${escapeHtml(item.number || "")}${suspended ? " · pagos suspendidos" : ""}</p>
      </div>
      <div class="agent-rec-metrics">
        <div><small>Pendiente</small><b>${money(item.principal, true)}</b></div>
        <div><small>${suspended ? "Cuota original" : "Cuota liberable"}</small><b>${money(suspended ? item.originalPayment : item.payment, true)}</b></div>
        <div><small>Mes sugerido</small><b>${escapeHtml(item.monthLabel)}</b></div>
        <div><small>${suspended ? "Flujo liberable" : "Eficiencia"}</small><b>${suspended ? "0,0%" : `${(item.efficiency * 100).toFixed(1)}%`}</b></div>
      </div>
      <button type="button" data-agent-debt-target="${escapeHtml(item.id)}" data-agent-debt-month="${escapeHtml(String(item.affordability?.agentIndex ?? ""))}" data-agent-debt-amount="${escapeHtml(String(item.principal || ""))}">Preparar en control de deuda</button>
    </article>`;
  }
  const canPay = Boolean(item.affordability);
  const creditCapital = decisionCreditCapital(item);
  return `<article class="agent-rec-card ${canPay ? "good" : "warn"}">
    <div>
      <span>${creditCapital ? "Proyecto financiado" : "Proyecto"}</span>
      <strong>${escapeHtml(item.name)}</strong>
      <p>${item.locked ? "Fijo en plan" : "Pendiente de decisión final"}${creditCapital ? ` · capital externo ${money(creditCapital, true)}` : ""}</p>
      ${renderProjectSavingsProgress(item, false, item.progress)}
    </div>
    <div class="agent-rec-metrics">
      <div><small>Coste</small><b>${money(item.amount, true)}</b></div>
      ${creditCapital ? `<div><small>Capital prestado</small><b>${money(creditCapital, true)}</b></div>` : ""}
      <div><small>Hucha sugerida</small><b>${money(item.pot, true)}/mes</b></div>
      <div><small>Mes objetivo</small><b>${escapeHtml(item.monthLabel)}</b></div>
      <div><small>Caja mínima plan</small><b>${money(item.minChecking, true)}</b></div>
    </div>
    <button type="button" data-agent-project-id="${escapeHtml(item.id)}">Revisar en simulador</button>
  </article>`;
}

function renderAgentTable(plan, year) {
  const rows = agentRowsForYear(plan, year);
  if (!qs("agentTable")) return;
  if (!rows.length) {
    qs("agentTable").innerHTML = "";
    return;
  }
  const headers = rows.map((row) => `<th>${escapeHtml(row.month)}</th>`).join("");
  const line = (label, getter, klass = "") =>
    `<tr><td>${escapeHtml(label)}</td>${rows.map((row) => `<td class="${klass || (getter(row) < 0 ? "negative" : getter(row) > 0 ? "positive" : "")}">${typeof getter(row) === "string" ? escapeHtml(getter(row)) : money(getter(row), true)}</td>`).join("")}</tr>`;
  qs("agentTable").innerHTML = `<thead><tr><th>Indicador</th>${headers}</tr></thead><tbody>
    <tr class="prevision-group-row"><td colspan="${rows.length + 1}">Caja operativa</td></tr>
    ${line("Resultado del mes", (row) => row.operatingResult)}
    ${line("Pagos mes siguiente", (row) => Math.max(0, Number(row.requiredReserve || 0) - plan.caixaFloor))}
    ${line("Margen sobre reserva", (row) => round2(Number(row.agentCaixa || 0) - Number(row.requiredReserve || 0)))}
    ${line("Reserva mes siguiente", (row) => row.requiredReserve)}
    ${line("Traspaso a Mediolanum", (row) => row.transferToSavings, "positive")}
    ${line("Rescate desde Mediolanum", (row) => row.rescueFromSavings, "negative")}
    ${line("CaixaBank cierre", (row) => row.agentCaixa)}
    ${line("Mediolanum cierre", (row) => row.agentMediolanum, "positive")}
    ${line("Patrimonio total", (row) => row.agentTotal, "positive")}
    <tr class="prevision-group-row comparison"><td colspan="${rows.length + 1}">Control</td></tr>
    ${line("Impacto proyectos/deuda", (row) => row.projectOutflow)}
    ${line("Estado", (row) => agentStatusForRow(row).label)}
  </tbody>`;
}

function prepareAgentDebtDecision(targetId, options = {}) {
  history.pushState(null, "", "#debt-control");
  setActiveView("debt-control");
  window.requestAnimationFrame(() => {
    if (qs("debtTargetSelect")) qs("debtTargetSelect").value = targetId;
    pendingDebtDecision = null;
    updateDebtTargetDefaults(true);
    const rawMonthIndex = options.monthIndex;
    const hasSuggestedMonth = rawMonthIndex !== undefined && rawMonthIndex !== null && String(rawMonthIndex) !== "";
    const monthIndex = hasSuggestedMonth ? Number(rawMonthIndex) : NaN;
    if (Number.isFinite(monthIndex) && monthIndex >= 0) {
      if (qs("debtPayoffMode")) qs("debtPayoffMode").value = "fixed";
      if (qs("debtPayoffMonth")) qs("debtPayoffMonth").value = String(monthIndex);
    } else if (qs("debtPayoffMode")) {
      qs("debtPayoffMode").value = "optimize";
    }
    const amount = Number(options.amount);
    if (Number.isFinite(amount) && amount > 0 && qs("debtPayoffAmount")) {
      qs("debtPayoffAmount").value = amount.toFixed(2);
    }
    updateDebtModeUi();
    stageDebtDecision();
  });
}

function prepareAgentProjectDecision(projectId) {
  history.pushState(null, "", "#simulator");
  setActiveView("simulator");
  window.requestAnimationFrame(() => {
    editProject(projectId);
    pendingProjectDecision = projectDecisionFromForm({ forceOptimize: true });
    renderProjectDecisionReview(pendingProjectDecision);
  });
}

const DEFAULT_EXECUTIVE_CAR_COST = 25000;
const DEFAULT_EXECUTIVE_CAR_RESERVE = 8000;
const DEFAULT_EXECUTIVE_TERE_CREDIT_CAPITAL = 15000;
const DEFAULT_EXECUTIVE_TERE_CREDIT_PAYMENT = 320;
const DEFAULT_EXECUTIVE_TERE_CREDIT_MONTHS = 60;

function executiveAdvisorSettings() {
  scenarioSettings.executiveAdvisor = scenarioSettings.executiveAdvisor || {};
  const settings = scenarioSettings.executiveAdvisor;
  return {
    carCost: Number.isFinite(Number(settings.carCost)) ? round2(Number(settings.carCost)) : DEFAULT_EXECUTIVE_CAR_COST,
    carReserve: Number.isFinite(Number(settings.carReserve)) ? round2(Number(settings.carReserve)) : DEFAULT_EXECUTIVE_CAR_RESERVE,
    tereCreditCapital: Number.isFinite(Number(settings.tereCreditCapital))
      ? round2(Number(settings.tereCreditCapital))
      : DEFAULT_EXECUTIVE_TERE_CREDIT_CAPITAL,
    tereCreditPayment: Number.isFinite(Number(settings.tereCreditPayment))
      ? round2(Number(settings.tereCreditPayment))
      : DEFAULT_EXECUTIVE_TERE_CREDIT_PAYMENT,
    tereCreditMonths: Number.isFinite(Number(settings.tereCreditMonths))
      ? Math.max(1, Number(settings.tereCreditMonths))
      : DEFAULT_EXECUTIVE_TERE_CREDIT_MONTHS,
  };
}

function scheduleExecutiveAdvisorRender() {
  if (executiveAdvisorRenderTimer) window.clearTimeout(executiveAdvisorRenderTimer);
  executiveAdvisorRenderTimer = window.setTimeout(() => {
    executiveAdvisorRenderTimer = null;
    if (viewFromHash() === "executive-advisor") renderExecutiveAdvisor();
  }, 120);
}

function saveExecutiveAdvisorSettingsFromControls({ rerender = true } = {}) {
  const settings = executiveAdvisorSettings();
  const caixaFloor = parseAmount(qs("executiveCaixaFloor")?.value);
  if (caixaFloor !== null) {
    savingsAgentSettings().caixaFloor = Math.max(0, round2(caixaFloor));
  }
  scenarioSettings.executiveAdvisor = {
    ...settings,
    carReserve: parseAmount(qs("executiveCarReserve")?.value) ?? settings.carReserve,
    carCost: parseAmount(qs("executiveCarCost")?.value) ?? settings.carCost,
    tereCreditCapital: parseAmount(qs("executiveTereCreditCapital")?.value) ?? settings.tereCreditCapital,
    tereCreditPayment: parseAmount(qs("executiveTereCreditPayment")?.value) ?? settings.tereCreditPayment,
    tereCreditMonths: settings.tereCreditMonths,
  };
  agentDebtOptimizationCache = { key: "", value: null };
  if (qs("agentCaixaFloor")) qs("agentCaixaFloor").value = amountInputValue(agentCaixaFloor());
  saveScenarioSettings();
  if (rerender) scheduleExecutiveAdvisorRender();
}

function firstMonthReachingMediolanum(plan, amount) {
  const rows = agentVisibleRows(plan);
  const threshold = Math.max(0, Number(amount || 0));
  if (!rows.length) return null;
  if (threshold <= Number(accountBalancesFromState().mediolanum || 0)) return rows[0];
  return rows.find((row) => Number(row.agentMediolanum || 0) >= threshold) || null;
}

function executiveAdvisorContext() {
  const plan = buildSavingsAgentPlan();
  const rows = agentVisibleRows(plan);
  const today = rows[0] || {};
  const next = rows[1] || {};
  const balances = accountBalancesFromState();
  const settings = executiveAdvisorSettings();
  const debtOptimization = agentOptimalDebtPayoffPlan();
  const routeSummary = routeSimulationSummaryFromActive(plan) || routeSimulationSummaryFromOptimization(debtOptimization);
  const summary = agentPlanSummary(plan);
  const capacity = agentTwelveMonthCapacity(plan);
  const first12 = rows.slice(0, 12);
  const avgIncome = first12.length ? averageRows(first12, (row) => row.income) : 0;
  const avgDebt = first12.length ? averageRows(first12, (row) => row.car + row.refi) : 0;
  const debtRatio = avgIncome ? (avgDebt / avgIncome) * 100 : 0;
  const debtRatioWithTere = avgIncome ? ((avgDebt + settings.tereCreditPayment) / avgIncome) * 100 : 0;
  const maxSafeTerePayment = Math.max(0, round2(avgIncome * 0.32 - avgDebt));
  const bestDebtStep = debtOptimization?.steps?.[0] || null;
  const bestDebt = bestDebtStep?.candidate || agentDebtRecommendations(plan)[0] || null;
  const carReserveGap = Math.max(0, round2(settings.carReserve - Number(balances.mediolanum || 0)));
  const rawCarPot = Number(capacity.avgTransfer12m || 0) * 0.35;
  const carMonthlyPot = carReserveGap && rawCarPot > 0 ? round2(Math.min(carReserveGap, Math.max(150, rawCarPot))) : 0;
  const carReserveMonth = firstMonthReachingMediolanum(plan, settings.carReserve);
  const carWithCreditCashNeed = Math.max(0, round2(settings.carCost - settings.tereCreditCapital));
  const carWithCreditMonth = firstMonthReachingMediolanum(plan, carWithCreditCashNeed);
  const safeCredit = debtRatioWithTere <= 32 && settings.tereCreditPayment <= Math.max(1, maxSafeTerePayment);
  return {
    plan,
    rows,
    today,
    next,
    balances,
    settings,
    debtOptimization,
    routeSummary,
    summary,
    capacity,
    avgIncome,
    avgDebt,
    debtRatio,
    debtRatioWithTere,
    maxSafeTerePayment,
    bestDebtStep,
    bestDebt,
    carReserveGap,
    carMonthlyPot,
    carReserveMonth,
    carWithCreditCashNeed,
    carWithCreditMonth,
    safeCredit,
  };
}

function executiveActionButton(item) {
  if (item.action === "simulate-route") {
    return `<button type="button" data-executive-action="simulate-route">${escapeHtml(item.label)}</button>`;
  }
  if (item.action === "clear-route") {
    return `<button type="button" class="secondary" data-executive-action="clear-route">${escapeHtml(item.label)}</button>`;
  }
  if (item.debtId) {
    return `<button type="button" data-executive-debt-target="${escapeHtml(item.debtId)}" data-executive-debt-month="${escapeHtml(String(item.monthIndex ?? ""))}" data-executive-debt-amount="${escapeHtml(String(item.amount ?? ""))}">${escapeHtml(item.label)}</button>`;
  }
  if (item.action === "car-project") {
    return `<button type="button" data-executive-action="prepare-car-project">${escapeHtml(item.label)}</button>`;
  }
  if (item.action === "tere-credit") {
    return `<button type="button" data-executive-action="prepare-tere-credit">${escapeHtml(item.label)}</button>`;
  }
  return `<button type="button" data-home-nav="${escapeHtml(item.target || "savings-agent")}">${escapeHtml(item.label)}</button>`;
}

function executivePrimaryDecision(ctx) {
  const { today, plan, routeSummary, debtOptimization, bestDebt, bestDebtStep } = ctx;
  if (Number(today.shortage || 0) > 0) {
    return {
      tone: "danger",
      title: "No tomes decisiones nuevas hoy",
      text: `Faltan ${money(today.shortage, true)} para mantener CaixaBank con la reserva operativa y los pagos del mes siguiente. Primero ajustaría gasto, ahorro o fecha de proyectos.`,
      action: "Ver flujo",
      target: "cashflow",
    };
  }
  if (Number(today.transferToSavings || 0) > 0) {
    return {
      tone: "good",
      title: `Traspasar ${money(today.transferToSavings, true)} a Mediolanum`,
      text: `Después del traspaso CaixaBank queda en ${money(today.agentCaixa, true)} y Mediolanum en ${money(today.agentMediolanum, true)}. Se conserva reserva de ${money(today.requiredReserve || plan.caixaFloor, true)}.`,
      action: "Ver evolución",
      target: "savings-agent",
    };
  }
  if (routeSummary?.active) {
    return {
      tone: "warn",
      title: "Validar ruta de deuda ya simulada",
      text: `${routeSummary.count} decisión(es) impactan el cuadro de mandos. Revisa el flujo y fija solo las que vayas a ejecutar.`,
      action: "Ver cuadro",
      target: "visual-detail",
    };
  }
  if (debtOptimization?.steps?.length) {
    return {
      tone: "warn",
      title: "Simular toda la ruta de deuda",
      text: `${debtOptimization.steps.length} paso(s), ${money(debtOptimization.totalPrincipal, true)} pactados hasta ${debtOptimization.lastMonth}. Es la mejor forma de ver impacto global antes de fijar nada.`,
      action: "simulate-route",
      label: "Simular ruta",
    };
  }
  if (bestDebt) {
    return {
      tone: "warn",
      title: `Preparar acuerdo ${bestDebt.entity}`,
      text: `${money(bestDebtStep?.candidate?.principal ?? bestDebt.principal, true)} en ${bestDebtStep?.monthLabel || bestDebt.monthLabel}. Conviene compararlo en Control de deuda.`,
      debtId: bestDebt.id,
      monthIndex: bestDebtStep?.monthIndex ?? bestDebt.affordability?.agentIndex,
      amount: bestDebtStep?.candidate?.principal ?? bestDebt.principal,
      label: "Preparar deuda",
    };
  }
  return {
    tone: "neutral",
    title: "Mantener disciplina de caja",
    text: `No hay una acción urgente mejor que proteger CaixaBank en ${money(plan.caixaFloor, true)} y acumular ahorro en Mediolanum.`,
    action: "savings-agent",
    label: "Ver agente",
  };
}

function executiveActions(ctx) {
  const actions = [];
  const primary = executivePrimaryDecision(ctx);
  actions.push({
    ...primary,
    label: primary.label || primary.action || "Abrir",
    rank: 1,
  });
  if (ctx.routeSummary?.active) {
    actions.push({
      tone: "warn",
      title: "Ruta de deuda cargada temporalmente",
      text: `${ctx.routeSummary.count} paso(s) de deuda ya afectan a saldos y flujo. Si era solo prueba, retírala antes de decidir coche.`,
      action: "clear-route",
      label: "Retirar simulación",
      rank: 2,
    });
  } else if (ctx.debtOptimization?.steps?.length) {
    actions.push({
      tone: "warn",
      title: "Ver deuda como plan completo",
      text: `${money(ctx.debtOptimization.totalPrincipal, true)} pactados hasta ${ctx.debtOptimization.lastMonth}; caja mínima estimada ${money(ctx.debtOptimization.finalPlan?.minCaixa || 0, true)}.`,
      action: "simulate-route",
      label: "Simular ruta",
      rank: 2,
    });
  }
  actions.push({
    tone: ctx.carReserveGap > 0 ? "good" : "neutral",
    title: "Crear colchón coche",
    text: ctx.carReserveGap > 0
      ? `Faltan ${money(ctx.carReserveGap, true)} para el colchón de ${money(ctx.settings.carReserve, true)}. Reservaría ${money(ctx.carMonthlyPot, true)}/mes si la caja lo permite.`
      : `El colchón coche de ${money(ctx.settings.carReserve, true)} ya estaría cubierto en Mediolanum.`,
    action: "car-project",
    label: "Preparar hucha",
    rank: 3,
  });
  actions.push({
    tone: ctx.safeCredit ? "good" : "danger",
    title: "Financiación de Tere para coche",
    text: ctx.safeCredit
      ? `Con ${money(ctx.settings.tereCreditCapital, true)} de capital y cuota ${money(ctx.settings.tereCreditPayment, true)}, el ratio deuda estimado pasaría de ${ctx.debtRatio.toFixed(1)}% a ${ctx.debtRatioWithTere.toFixed(1)}%.`
      : `Con cuota ${money(ctx.settings.tereCreditPayment, true)} el ratio subiría a ${ctx.debtRatioWithTere.toFixed(1)}%. Yo no lo aceptaría si supera el 32% o deja caja sin margen.`,
    action: "tere-credit",
    label: "Simular crédito",
    rank: 4,
  });
  return actions;
}

function renderExecutiveHero(ctx) {
  const target = qs("executiveAdvisorHero");
  if (!target) return;
  const decision = executivePrimaryDecision(ctx);
  target.className = `executive-hero ${decision.tone}`;
  target.innerHTML = `<div class="executive-hero-main">
      <span>${decision.tone === "danger" ? "Prioridad: proteger caja" : decision.tone === "warn" ? "Prioridad: decidir deuda" : "Prioridad: ejecutar"}</span>
      <h2>${escapeHtml(decision.title)}</h2>
      <p>${escapeHtml(decision.text)}</p>
    </div>
    <div class="executive-hero-metrics">
      <div><span>CaixaBank cierre</span><strong>${money(ctx.today.agentCaixa ?? ctx.balances.caixa, true)}</strong></div>
      <div><span>Mediolanum cierre</span><strong>${money(ctx.today.agentMediolanum ?? ctx.balances.mediolanum, true)}</strong></div>
      <div><span>Reserva requerida</span><strong>${money(ctx.today.requiredReserve || ctx.plan.caixaFloor, true)}</strong></div>
    </div>`;
}

function renderExecutiveActions(ctx) {
  const target = qs("executiveActionPlan");
  if (!target) return;
  target.innerHTML = executiveActions(ctx)
    .map((item) => `<article class="executive-action ${item.tone}">
      <span>${item.rank}</span>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.text)}</p>
      </div>
      ${executiveActionButton(item)}
    </article>`)
    .join("");
}

function renderExecutiveAccounts(ctx) {
  const target = qs("executiveAccounts");
  if (!target) return;
  const rows = ctx.rows;
  const first12 = rows.slice(0, 12);
  const minCaixaRow = first12.length
    ? first12.reduce((best, row) => (Number(row.agentCaixa || 0) < Number(best.agentCaixa || 0) ? row : best), first12[0])
    : null;
  const minCaixa12 = minCaixaRow ? Number(minCaixaRow.agentCaixa || 0) : Number(ctx.balances.caixa || 0);
  const nextDebt = ctx.debtOptimization?.steps?.[0];
  const balanceDateText = state.balanceDate || defaultBalanceDate();
  const cards = [
    ["CaixaBank ahora", money(ctx.balances.caixa, true), `Saldo a ${balanceDateText}. Reserva operativa: ${money(ctx.plan.caixaFloor, true)}.`],
    ["Mediolanum ahora", money(ctx.balances.mediolanum, true), `Saldo a ${balanceDateText}. Cuenta de ahorro y huchas.`],
    ["CaixaBank tras decisión", money(ctx.today.agentCaixa ?? ctx.balances.caixa, true), `Cierre ${ctx.today.month || ""} (${ctx.today.transferDateLabel || "fin de mes"}).`],
    ["Mediolanum tras decisión", money(ctx.today.agentMediolanum ?? ctx.balances.mediolanum, true), ctx.today.transferToSavings ? `Incluye traspaso ${money(ctx.today.transferToSavings, true)} el ${ctx.today.transferDateLabel || "fin de mes"}.` : "Sin traspaso seguro este mes."],
    ["Peor caja 12m", money(minCaixa12, true), minCaixaRow ? `${minCaixaRow.month} · ${minCaixaRow.transferDateLabel || "cierre de mes"}. Debe quedar sobre reserva.` : "Debe quedar por encima de la reserva."],
    ["Siguiente deuda", nextDebt ? `${nextDebt.monthLabel} · ${money(nextDebt.candidate.principal, true)}` : "Sin paso", nextDebt ? debtTargetDisplayName(nextDebt.candidate) : "No hay ruta pendiente."],
  ];
  target.innerHTML = cards
    .map(([label, value, note]) => `<div class="executive-mini-card">
      <span>${escapeHtml(label)}</span>
      <strong>${typeof value === "string" ? escapeHtml(value) : value}</strong>
      <p>${escapeHtml(note)}</p>
    </div>`)
    .join("");
}

function renderExecutiveDebtRoute(ctx) {
  const target = qs("executiveDebtRoute");
  if (!target) return;
  const steps = ctx.debtOptimization?.steps || [];
  const summary = ctx.routeSummary;
  const header = `<div class="executive-route-summary ${summary?.active ? "active" : ""}">
    <div><span>${summary?.active ? "Ruta simulada" : "Ruta sugerida"}</span><strong>${summary ? `${summary.count} paso(s)` : "Sin ruta"}</strong></div>
    <div><span>Importe pactado</span><strong>${summary ? money(summary.total, true) : money(0, true)}</strong></div>
    <div><span>Último paso</span><strong>${escapeHtml(summary?.lastMonth || "-")}</strong></div>
    <div><span>Patrimonio vs base</span><strong class="${(summary?.netWorthDelta || 0) >= 0 ? "positive" : "negative"}">${summary ? money(summary.netWorthDelta, true) : money(0, true)}</strong></div>
  </div>`;
  const controls = summary?.active
    ? `<button type="button" class="secondary" data-executive-action="clear-route">Retirar ruta simulada</button>`
    : steps.length
      ? `<button type="button" data-executive-action="simulate-route">Simular ruta completa en el dashboard</button>`
      : "";
  const rows = steps.slice(0, 6).map((step) => `<article class="executive-debt-step">
    <span>${step.order}</span>
    <div>
      <strong>${escapeHtml(debtTargetDisplayName(step.candidate))}</strong>
      <p>${escapeHtml(step.candidate.number || "")} · ${debtTargetIsSuspended(step.candidate) ? "pagos suspendidos; no suma ingreso ficticio" : `libera ${money(step.candidate.effectiveRelief || 0, true)}/mes`}</p>
    </div>
    <dl>
      <div><dt>Mes</dt><dd>${escapeHtml(step.monthLabel)}</dd></div>
      <div><dt>Pactado</dt><dd>${money(step.candidate.principal, true)}</dd></div>
      <div><dt>Mejora</dt><dd class="positive">${money(step.candidate.agreementSavings || 0, true)}</dd></div>
    </dl>
    <button type="button" data-executive-debt-target="${escapeHtml(step.candidate.id)}" data-executive-debt-month="${escapeHtml(String(step.monthIndex))}" data-executive-debt-amount="${escapeHtml(String(step.candidate.principal))}">Preparar</button>
  </article>`).join("");
  target.innerHTML = `${header}${controls ? `<div class="executive-route-actions">${controls}</div>` : ""}${rows || `<div class="empty-state compact">No hay deuda optimizable pendiente.</div>`}`;
}

function renderExecutiveCarPlan(ctx) {
  const target = qs("executiveCarPlan");
  if (!target) return;
  const monthNoCredit = ctx.carReserveMonth?.month || "No alcanzado";
  const monthWithCredit = ctx.carWithCreditMonth?.month || "No alcanzado";
  target.innerHTML = `<div class="executive-car-kpis">
      <div><span>Coste objetivo</span><strong>${money(ctx.settings.carCost, true)}</strong></div>
      <div><span>Colchón mínimo</span><strong>${money(ctx.settings.carReserve, true)}</strong></div>
      <div><span>Falta de hucha</span><strong>${money(ctx.carReserveGap, true)}</strong></div>
      <div><span>Hucha sugerida</span><strong>${money(ctx.carMonthlyPot, true)}/mes</strong></div>
    </div>
    <div class="executive-car-options">
      <article class="executive-car-option good">
        <span>Opción conservadora</span>
        <strong>Comprar cuando Mediolanum cubra colchón</strong>
        <p>Mes estimado: ${escapeHtml(monthNoCredit)}. Mantiene deuda baja y prioriza acuerdos pendientes.</p>
        <button type="button" data-executive-action="prepare-car-project">Preparar hucha coche</button>
      </article>
      <article class="executive-car-option ${ctx.safeCredit ? "good" : "danger"}">
        <span>Financiación Tere</span>
        <strong>${money(ctx.settings.tereCreditCapital, true)} ahora · ${money(ctx.settings.tereCreditPayment, true)}/mes</strong>
        <p>Mes estimado con crédito: ${escapeHtml(monthWithCredit)}. Ratio deuda: ${ctx.debtRatio.toFixed(1)}% -> ${ctx.debtRatioWithTere.toFixed(1)}%. Cuota máxima prudente: ${money(ctx.maxSafeTerePayment, true)}.</p>
        <button type="button" data-executive-action="prepare-tere-credit">Simular financiación</button>
      </article>
    </div>`;
}

function renderExecutiveMonthAgenda(ctx) {
  const target = qs("executiveMonthAgenda");
  if (!target) return;
  target.innerHTML = ctx.rows.slice(0, 6)
    .map((row) => {
      const status = agentStatusForRow(row);
      return `<article class="executive-month ${status.tone}">
        <div><span>${escapeHtml(row.month)}</span><strong>${escapeHtml(status.label)}</strong></div>
        <dl>
          <div><dt>Resultado</dt><dd class="${row.operatingResult >= 0 ? "positive" : "negative"}">${money(row.operatingResult, true)}</dd></div>
          <div><dt>Traspaso</dt><dd>${money(row.transferToSavings, true)}<small>${escapeHtml(row.transferDateLabel || "cierre de mes")}</small></dd></div>
          <div><dt>Caixa</dt><dd>${money(row.agentCaixa, true)}</dd></div>
          <div><dt>Mediolanum</dt><dd>${money(row.agentMediolanum, true)}</dd></div>
        </dl>
      </article>`;
    })
    .join("");
}

function renderExecutiveAdvisor() {
  if (!qs("executiveAdvisorHero")) return;
  const ctx = executiveAdvisorContext();
  if (qs("executiveCaixaFloor")) qs("executiveCaixaFloor").value = amountInputValue(ctx.plan.caixaFloor);
  if (qs("executiveCarReserve")) qs("executiveCarReserve").value = amountInputValue(ctx.settings.carReserve);
  if (qs("executiveCarCost")) qs("executiveCarCost").value = amountInputValue(ctx.settings.carCost);
  if (qs("executiveTereCreditCapital")) qs("executiveTereCreditCapital").value = amountInputValue(ctx.settings.tereCreditCapital);
  if (qs("executiveTereCreditPayment")) qs("executiveTereCreditPayment").value = amountInputValue(ctx.settings.tereCreditPayment);
  renderExecutiveHero(ctx);
  renderExecutiveActions(ctx);
  renderExecutiveAccounts(ctx);
  renderExecutiveDebtRoute(ctx);
  renderExecutiveCarPlan(ctx);
  renderExecutiveMonthAgenda(ctx);
}

function prepareExecutiveCarProject(useCredit = false) {
  const settings = executiveAdvisorSettings();
  history.pushState(null, "", "#simulator");
  setActiveView("simulator");
  window.requestAnimationFrame(() => {
    clearProjectForm();
    if (qs("projectKind")) qs("projectKind").value = useCredit ? "external-credit" : "standard";
    if (qs("projectCreditOwner")) qs("projectCreditOwner").value = "Tere";
    if (qs("projectName")) qs("projectName").value = useCredit ? "Compra coche con financiación Tere" : "Colchón coche";
    if (qs("projectAmount")) qs("projectAmount").value = amountInputValue(useCredit ? settings.carCost : settings.carReserve);
    if (qs("projectDuration")) qs("projectDuration").value = "1";
    if (qs("projectCreditCapital")) qs("projectCreditCapital").value = useCredit ? amountInputValue(settings.tereCreditCapital) : "";
    if (qs("projectRecurringAmount")) qs("projectRecurringAmount").value = useCredit ? amountInputValue(settings.tereCreditPayment) : "";
    if (qs("projectRecurringDuration")) qs("projectRecurringDuration").value = useCredit ? String(settings.tereCreditMonths) : "0";
    if (qs("projectRecurringDelay")) qs("projectRecurringDelay").value = "same";
    setProjectMode("optimize");
    updateProjectKindUi();
    updateProjectModeUi();
    pendingProjectDecision = projectDecisionFromForm({ forceOptimize: true });
    renderProjectPlanPreview();
    renderProjectDecisionReview(pendingProjectDecision);
  });
}

function virtualAdvisorContext() {
  const plan = buildSavingsAgentPlan();
  const debtRecs = agentDebtRecommendations(plan);
  const projectRecs = agentLifeProjectRecommendations(plan);
  const debtOptimization = agentOptimalDebtPayoffPlan();
  const routeSummary = routeSimulationSummaryFromActive(plan) || routeSimulationSummaryFromOptimization(debtOptimization);
  const summary = agentPlanSummary(plan);
  const capacity = agentTwelveMonthCapacity(plan);
  const visibleRows = agentVisibleRows(plan);
  const today = visibleRows[0] || {};
  const next = visibleRows[1] || {};
  const bestStep = debtOptimization?.steps?.[0] || null;
  const bestDebt = bestStep?.candidate || debtRecs[0] || null;
  const bestProject = projectRecs[0] || null;
  return {
    plan,
    debtRecs,
    projectRecs,
    debtOptimization,
    routeSummary,
    summary,
    capacity,
    today,
    next,
    bestStep,
    bestDebt,
    bestProject,
  };
}

function advisorStatusLabel(tone) {
  if (tone === "danger") return "Bloqueado";
  if (tone === "warn") return "Revisar";
  return "Listo";
}

function advisorMainRecommendation(ctx) {
  const { plan, today, bestStep, bestDebt, bestProject, routeSummary, debtOptimization } = ctx;
  if (Number(today.shortage || 0) > 0) {
    return {
      tone: "danger",
      label: "Caja primero",
      title: "No fijaría nuevas decisiones hoy",
      text: `${today.month}: faltan ${money(today.shortage, true)} para proteger CaixaBank y los pagos del mes siguiente. Antes de aplicar deuda o proyectos, revisa flujo y baja impactos.`,
      metric: money(today.shortage, true),
      metricLabel: "déficit",
      action: "Ver flujo mensual",
      target: "cashflow",
    };
  }
  if (routeSummary?.active) {
    return {
      tone: "good",
      label: "Ruta simulada",
      title: "La ruta óptima ya impacta el modelo",
      text: `${routeSummary.count} amortización(es) entre ${routeSummary.firstMonth} y ${routeSummary.lastMonth}. Revisa cuadro de mandos y flujo antes de fijar definitivamente cada decisión.`,
      metric: money(routeSummary.netWorthDelta, true),
      metricLabel: "patrimonio vs base",
      action: "Ver cuadro de mandos",
      target: "visual-detail",
      secondaryAction: "Quitar simulación",
      advisorAction: "clear-route",
    };
  }
  if (debtOptimization?.steps?.length) {
    return {
      tone: "warn",
      label: "Mejor siguiente paso",
      title: "Simular ruta óptima completa de deuda",
      text: `${debtOptimization.steps.length} paso(s), ${money(debtOptimization.totalPrincipal, true)} pactados hasta ${debtOptimization.lastMonth}. Esto permite comparar el cuadro de mandos y el flujo con toda la estrategia cargada.`,
      metric: money(debtOptimization.netWorthDelta, true),
      metricLabel: "mejora patrimonial",
      action: "Simular ruta completa",
      advisorAction: "simulate-route",
    };
  }
  if (bestDebt) {
    return {
      tone: "warn",
      label: "Deuda candidata",
      title: `Preparar ${bestDebt.entity} ${bestDebt.type}`,
      text: `${money(bestDebt.principal, true)} en ${bestStep?.monthLabel || bestDebt.monthLabel}. El asesor la prepara en Control de deuda para comparar pago único, fraccionado, reunificación o retomar.`,
      metric: money(bestDebt.principal, true),
      metricLabel: "importe",
      action: "Preparar deuda",
      debtId: bestDebt.id,
      monthIndex: bestStep?.monthIndex ?? bestDebt.affordability?.agentIndex,
      amount: bestStep?.candidate?.principal ?? bestDebt.principal,
    };
  }
  if (bestProject) {
    return {
      tone: "good",
      label: "Proyecto preparado",
      title: `Revisar ${bestProject.name}`,
      text: `Hucha sugerida de ${money(bestProject.pot, true)}/mes y objetivo ${bestProject.monthLabel}. Puedes comparar pago único, reparto o financiación antes de fijarlo.`,
      metric: money(bestProject.amount, true),
      metricLabel: "coste",
      action: "Revisar proyecto",
      projectId: bestProject.id,
    };
  }
  return {
    tone: Number(today.transferToSavings || 0) > 0 ? "good" : "neutral",
    label: "Sin bloqueo",
    title: Number(today.transferToSavings || 0) > 0 ? "Priorizar traspaso prudente" : "Esperar al siguiente ingreso",
    text: Number(today.transferToSavings || 0) > 0
      ? `Puedes mover ${money(today.transferToSavings, true)} a Mediolanum dejando CaixaBank con ${money(today.requiredReserve || plan.caixaFloor, true)} para operar.`
      : `Mantén CaixaBank cubierto en ${money(today.requiredReserve || plan.caixaFloor, true)} y revisa nuevos acuerdos cuando entre más caja.`,
    metric: money(today.transferToSavings || 0, true),
    metricLabel: "traspaso seguro",
    action: "Ver evolución",
    target: "savings-agent",
  };
}

function advisorActionButton(item) {
  if (item.advisorAction) {
    return `<button type="button" data-advisor-action="${escapeHtml(item.advisorAction)}">${escapeHtml(item.action)}</button>`;
  }
  if (item.debtId) {
    return `<button type="button" data-advisor-debt-target="${escapeHtml(item.debtId)}" data-advisor-debt-month="${escapeHtml(String(item.monthIndex ?? ""))}" data-advisor-debt-amount="${escapeHtml(String(item.amount ?? ""))}">${escapeHtml(item.action)}</button>`;
  }
  if (item.projectId) {
    return `<button type="button" data-advisor-project-id="${escapeHtml(item.projectId)}">${escapeHtml(item.action)}</button>`;
  }
  return `<button type="button" data-home-nav="${escapeHtml(item.target || "savings-agent")}">${escapeHtml(item.action)}</button>`;
}

function advisorDebtTargetOptions() {
  return debtTargetOptions({ includePlanned: false })
    .filter((item) => Number(item.currentPrincipal ?? item.principal ?? 0) > 0)
    .filter((item) => !debtLiquidations.some((decision) => decision.targetId === item.id && decision.locked));
}

function advisorDebtInitialTargetId(ctx) {
  const preferred = ctx?.bestDebt?.id;
  const options = advisorDebtTargetOptions();
  if (preferred && options.some((item) => item.id === preferred)) return preferred;
  return options[0]?.id || "";
}

function advisorDebtControlValues(ctx) {
  const options = advisorDebtTargetOptions();
  const targetSelect = qs("advisorDebtTarget");
  const currentTargetId = targetSelect?.value && options.some((item) => item.id === targetSelect.value)
    ? targetSelect.value
    : advisorDebtInitialTargetId(ctx);
  const target = debtTargetById(currentTargetId, { includePlanned: true }) || options[0] || null;
  const amountInput = qs("advisorDebtAmount");
  const amount = parseAmount(amountInput?.value) ?? Number(target?.currentPrincipal ?? target?.principal ?? 0);
  const rawMode = qs("advisorDebtMode")?.value || "optimize";
  const duration = Math.max(1, Number(qs("advisorDebtDuration")?.value || (isDebtMultiMonthMode(rawMode) ? 6 : 1)));
  const monthIndex = Number(qs("advisorDebtMonth")?.value || 0);
  return { target, targetId: target?.id || "", amount, rawMode, duration, monthIndex };
}

function populateAdvisorDebtControls(ctx) {
  const targetSelect = qs("advisorDebtTarget");
  const monthSelect = qs("advisorDebtMonth");
  if (!targetSelect || !monthSelect) return;
  const options = advisorDebtTargetOptions();
  const previousTarget = targetSelect.value;
  const selectedId = previousTarget && options.some((item) => item.id === previousTarget)
    ? previousTarget
    : advisorDebtInitialTargetId(ctx);
  targetSelect.innerHTML = options
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.entity)} · ${escapeHtml(item.type)} · ${escapeHtml(item.number || "")} · ${money(item.currentPrincipal ?? item.principal, true)}</option>`)
    .join("");
  targetSelect.value = selectedId;
  const previousMonth = monthSelect.value;
  monthSelect.innerHTML = forecastMonths()
    .map((month) => `<option value="${month.index}">${escapeHtml(month.label)}</option>`)
    .join("");
  monthSelect.value = previousMonth && [...monthSelect.options].some((option) => option.value === previousMonth) ? previousMonth : "0";
  const target = debtTargetById(selectedId, { includePlanned: true });
  if (qs("advisorDebtAmount") && !qs("advisorDebtAmount").value) {
    qs("advisorDebtAmount").value = amountInputValue(Number(target?.currentPrincipal ?? target?.principal ?? 0));
  }
  const mode = qs("advisorDebtMode")?.value || "optimize";
  const optimizes = ["optimize", "spread-optimize", "refinance-optimize", "retomar-optimize"].includes(mode);
  const multi = isDebtMultiMonthMode(mode);
  if (qs("advisorDebtMonth")) qs("advisorDebtMonth").disabled = optimizes;
  if (qs("advisorDebtDuration")) {
    qs("advisorDebtDuration").disabled = isDebtResumeMode(mode) || !multi;
    if (!multi) qs("advisorDebtDuration").value = 1;
    if (multi && !Number(qs("advisorDebtDuration").value)) qs("advisorDebtDuration").value = 6;
  }
}

function advisorDebtDecisionFromCurrent({ rawModeOverride, durationOverride, forceOptimize } = {}) {
  const values = advisorDebtControlValues();
  const rawMode = rawModeOverride || values.rawMode;
  const target = values.target;
  const amount = isDebtResumeMode(rawMode) ? Number(target?.currentPrincipal ?? target?.principal ?? 0) : values.amount;
  return debtDecisionFromValues({
    targetId: values.targetId,
    name: debtTargetDisplayName(target),
    amount,
    relief: debtMonthlyReliefForMode(target, rawMode),
    rawMode,
    monthIndex: values.monthIndex,
    duration: durationOverride || (isDebtMultiMonthMode(rawMode) ? values.duration : 1),
    forceOptimize,
  });
}

function advisorDebtOption(rawMode, duration, title, detail) {
  const decision = advisorDebtDecisionFromCurrent({ rawModeOverride: rawMode, durationOverride: duration, forceOptimize: true });
  if (!decision) return null;
  const evaluated = evaluateDebtDecisionItem(decision);
  return {
    rawMode,
    duration,
    title,
    detail,
    decision,
    monthly: evaluated.monthly,
    minChecking: evaluated.evaluation.minChecking,
    netGain: evaluated.netGain,
    monthLabel: forecastMonths()[decision.monthIndex]?.label || "-",
    feasible: evaluated.evaluation.minChecking >= 0,
  };
}

function advisorDebtReviewCard(option, selected = false) {
  return `<article class="advisor-debt-option ${option.feasible ? "good" : "warn"} ${selected ? "selected" : ""}">
    <div>
      <span>${escapeHtml(option.title)}</span>
      <strong>${escapeHtml(option.monthLabel)} · ${money(option.monthly, true)}/mes</strong>
      <p>${escapeHtml(option.detail)}</p>
    </div>
    <dl>
      <div><dt>Caja mínima</dt><dd>${money(option.minChecking, true)}</dd></div>
      <div><dt>Liquidez final</dt><dd class="${option.netGain >= 0 ? "positive" : "negative"}">${option.netGain >= 0 ? "+" : ""}${money(option.netGain, true)}</dd></div>
    </dl>
    <button type="button" data-advisor-apply-debt-option="${selected ? "current" : "suggested"}" data-raw-mode="${escapeHtml(option.rawMode)}" data-duration="${escapeHtml(String(option.duration))}">
      ${selected ? "Aplicar esta configuración" : "Aplicar sugerencia"}
    </button>
  </article>`;
}

function renderAdvisorDebtSandbox(ctx = virtualAdvisorContext()) {
  populateAdvisorDebtControls(ctx);
  const panel = qs("advisorDebtReview");
  if (!panel) return;
  const values = advisorDebtControlValues(ctx);
  const target = values.target;
  if (!target) {
    panel.innerHTML = `<div class="empty-state compact">No hay deudas pendientes disponibles para simular.</div>`;
    return;
  }
  const current = advisorDebtDecisionFromCurrent();
  if (!current) {
    panel.innerHTML = `<div class="advisor-debt-empty">
      <strong>Introduce un importe pactado</strong>
      <p>El asesor comparará opciones sin tocar el cuadro de mandos hasta que apliques una.</p>
    </div>`;
    return;
  }
  const evaluated = evaluateDebtDecisionItem(current);
  const original = {
    rawMode: values.rawMode,
    duration: values.duration,
    title: "Configuración actual",
    detail: debtModeHelpText(values.rawMode),
    decision: current,
    monthly: evaluated.monthly,
    minChecking: evaluated.evaluation.minChecking,
    netGain: evaluated.netGain,
    monthLabel: forecastMonths()[current.monthIndex]?.label || "-",
    feasible: evaluated.evaluation.minChecking >= 0,
  };
  const suspended = debtTargetIsSuspended(target);
  const options = [
    advisorDebtOption("optimize", 1, "Pago único óptimo", suspended ? "Liquida deuda suspendida sin sumar cuota liberada ficticia." : "Cierra o reduce deuda y libera cuota después."),
    advisorDebtOption("spread-optimize", 6, "Fraccionar 6 meses", "Reparte el pacto y busca inicio óptimo."),
    advisorDebtOption("refinance-optimize", 12, "Reunificar 12 meses", "Cuota más suave a cambio de más plazo."),
    advisorDebtOption("refinance-optimize", 24, "Reunificar 24 meses", "Menor presión mensual y más tiempo."),
    suspended ? advisorDebtOption("retomar-optimize", 1, "Retomar pagos", "Calcula atrasos desde enero 2026 y retoma vencimiento original.") : null,
  ].filter(Boolean);
  const discount = Math.max(0, Number(current.originalPrincipal || 0) - Number(current.amount || 0));
  panel.innerHTML = `<div class="advisor-debt-head">
      <div>
        <span>Deuda seleccionada</span>
        <strong>${escapeHtml(target.entity)} · ${escapeHtml(target.type)}</strong>
        <p>${escapeHtml(target.number || "")}${suspended ? " · pagos suspendidos: no se cuenta como ingreso al liquidar" : ""}</p>
      </div>
      <div><span>Mejora pactada</span><strong class="${discount ? "positive" : ""}">${money(discount, true)}</strong></div>
      <div><span>Ratio deuda</span><strong>${escapeHtml(renderDebtRatioText(current))}</strong></div>
    </div>
    <div class="advisor-debt-options">
      ${advisorDebtReviewCard(original, true)}
      ${options.map((option) => advisorDebtReviewCard(option)).join("")}
    </div>`;
}

function renderDebtRatioText(decision) {
  const rows = firstOpenRows(lastSimulation, 12);
  const income12 = rows.length ? averageRows(rows, (row) => row.income) : 0;
  const debt12 = rows.length ? averageRows(rows, (row) => row.car + row.refi) : 0;
  const relief = Number(decision?.monthlyRelief || 0);
  const before = income12 ? (debt12 / income12) * 100 : 0;
  const after = income12 ? (Math.max(0, debt12 - relief) / income12) * 100 : 0;
  return `${before.toFixed(1)}% -> ${after.toFixed(1)}%`;
}

function applyAdvisorDebtOption(button) {
  const rawMode = button.dataset.rawMode || qs("advisorDebtMode")?.value || "optimize";
  const duration = Number(button.dataset.duration || qs("advisorDebtDuration")?.value || 1);
  const forceOptimize = button.dataset.advisorApplyDebtOption !== "current" || rawMode.includes("optimize");
  const decision = advisorDebtDecisionFromCurrent({ rawModeOverride: rawMode, durationOverride: duration, forceOptimize });
  applyDebtDecision(decision);
}

function virtualAdvisorActions(ctx) {
  const { today, plan, routeSummary, debtOptimization, bestStep, bestDebt, bestProject, summary, capacity } = ctx;
  const actions = [];
  if (Number(today.shortage || 0) > 0) {
    actions.push({
      tone: "danger",
      title: "Recortar o aplazar impactos",
      text: `${today.month}: déficit de ${money(today.shortage, true)} frente a la reserva. No fijes deuda/proyectos hasta corregirlo.`,
      action: "Ver simulador",
      target: "simulator",
    });
  }
  if (routeSummary?.active) {
    actions.push({
      tone: "good",
      title: "Validar ruta simulada",
      text: `${routeSummary.count} amortización(es) ya impactan cuadro de mandos y flujo. Si no te convence, retírala y vuelve a simular.`,
      action: "Ver flujo",
      target: "cashflow",
    });
    actions.push({
      tone: "warn",
      title: "Retirar simulación completa",
      text: "Devuelve la ruta de deuda al simulador sin borrar decisiones fijas.",
      action: "Quitar simulación",
      advisorAction: "clear-route",
    });
  } else if (debtOptimization?.steps?.length) {
    actions.push({
      tone: "warn",
      title: "Cargar ruta óptima de deuda",
      text: `${debtOptimization.steps.length} paso(s) hasta ${debtOptimization.lastMonth}. Se aplica como simulación temporal para ver impacto completo.`,
      action: "Simular ruta completa",
      advisorAction: "simulate-route",
    });
  }
  if (bestDebt) {
    const amount = bestStep?.candidate?.principal ?? bestDebt.principal;
    const monthIndex = bestStep?.monthIndex ?? bestDebt.affordability?.agentIndex;
    actions.push({
      tone: "warn",
      title: `Preparar ${bestDebt.entity} ${bestDebt.type}`,
      text: `${money(amount, true)} en ${bestStep?.monthLabel || bestDebt.monthLabel}. Compara amortización, fraccionado, reunificación o retomar antes de fijar.`,
      action: "Preparar deuda",
      debtId: bestDebt.id,
      monthIndex,
      amount,
    });
  }
  if (bestProject) {
    actions.push({
      tone: "good",
      title: `Preparar proyecto: ${bestProject.name}`,
      text: `${money(bestProject.pot, true)}/mes de hucha sugerida; objetivo ${bestProject.monthLabel}. Revisa alternativas antes de fijar.`,
      action: "Revisar proyecto",
      projectId: bestProject.id,
    });
  }
  if (Number(today.transferToSavings || 0) > 0) {
    actions.push({
      tone: "good",
      title: "Traspaso prudente a Mediolanum",
      text: `${money(today.transferToSavings, true)} el ${today.transferDateLabel || "cierre de mes"}, manteniendo reserva de ${money(today.requiredReserve || plan.caixaFloor, true)}.`,
      action: "Ver evolución",
      target: "savings-agent",
    });
  }
  actions.push({
    tone: summary.pending ? "warn" : "neutral",
    title: "Auditar planes cargados",
    text: `${summary.pending} pendiente(s), ${summary.locked} fijo(s). Próximo impacto: ${summary.nextImpactAmount ? `${money(summary.nextImpactAmount, true)} en ${summary.nextImpactMonth}` : "sin impacto próximo"}.`,
    action: "Ver cuadro",
    target: "visual-detail",
  });
  if (capacity.firstShortage) {
    actions.push({
      tone: "danger",
      title: "Mes con tensión detectado",
      text: `${capacity.firstShortage.month}: faltan ${money(capacity.firstShortage.shortage, true)}. Prioridad: aplazar proyectos o reducir ahorro automático.`,
      action: "Ver previsión",
      target: "prevision",
    });
  }
  return actions.slice(0, 7);
}

function renderAdvisorPriority(ctx) {
  const target = qs("virtualAdvisorPriority");
  if (!target) return;
  const main = advisorMainRecommendation(ctx);
  target.innerHTML = `<div class="advisor-priority-card ${main.tone}">
    <div>
      <span>${escapeHtml(main.label)}</span>
      <h3>${escapeHtml(main.title)}</h3>
      <p>${escapeHtml(main.text)}</p>
    </div>
    <aside>
      <small>${escapeHtml(main.metricLabel)}</small>
      <strong>${main.metric}</strong>
      ${advisorActionButton(main)}
      ${main.secondaryAction ? `<button type="button" class="secondary" data-advisor-action="${escapeHtml(main.advisorAction)}">${escapeHtml(main.secondaryAction)}</button>` : ""}
    </aside>
  </div>`;
}

function renderAdvisorKpis(ctx) {
  const target = qs("virtualAdvisorKpis");
  if (!target) return;
  const { plan, today, summary, routeSummary, debtOptimization } = ctx;
  const routeText = routeSummary?.active
    ? `${routeSummary.count} simulada(s)`
    : debtOptimization?.steps?.length
      ? `${debtOptimization.steps.length} sugerida(s)`
      : "Sin ruta";
  const cards = [
    ["Caja protegida", money(plan.minCaixa, true), `Mínimo con reserva: ${money(plan.minReserveCoverage, true)}.`, plan.minReserveCoverage >= 0 ? "good" : "danger"],
    ["Capacidad libre real", money(monthlyFreeCapacity(plan.rows || []), true), "Media 12m tras ahorro objetivo y decisiones cargadas.", executiveToneForAmount(monthlyFreeCapacity(plan.rows || []))],
    ["Planes en cálculo", `${summary.pending} pend. · ${summary.locked} fijo(s)`, summary.nextImpactAmount ? `Próximo: ${money(summary.nextImpactAmount, true)} en ${summary.nextImpactMonth}.` : "Sin impacto próximo.", summary.pending ? "warn" : "good"],
    ["Ruta deuda", routeText, routeSummary ? `Impacto patrimonio: ${money(routeSummary.netWorthDelta, true)}.` : "Sin deuda optimizable.", routeSummary ? "warn" : "neutral"],
    ["Traspaso seguro", money(today.transferToSavings || 0, true), `Fecha: ${today.transferDateLabel || "cierre de mes"}. Reserva actual: ${money(today.requiredReserve || plan.caixaFloor, true)}.`, Number(today.transferToSavings || 0) > 0 ? "good" : "warn"],
  ];
  target.innerHTML = cards
    .map(([label, value, note, tone]) => `<article class="advisor-kpi ${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${typeof value === "string" ? escapeHtml(value) : value}</strong>
      <p>${escapeHtml(note)}</p>
    </article>`)
    .join("");
}

function renderAdvisorStatus(ctx) {
  const target = qs("virtualAdvisorStatus");
  if (!target) return;
  const { plan, today, next, summary, capacity, routeSummary } = ctx;
  const checks = [
    {
      label: "Caja operativa",
      value: money(today.agentCaixa || 0, true),
      note: `Reserva requerida: ${money(today.requiredReserve || plan.caixaFloor, true)}.`,
      tone: Number(today.shortage || 0) > 0 ? "danger" : "good",
    },
    {
      label: "Mes siguiente cubierto",
      value: money(Math.max(0, Number(next.outflowsBeforeSaving || 0)), true),
      note: next.month ? `Pagos previstos para ${next.month}.` : "Sin mes posterior.",
      tone: "neutral",
    },
    {
      label: "Simulaciones activas",
      value: routeSummary?.active ? `${routeSummary.count} deuda(s)` : `${summary.pending} pendiente(s)`,
      note: routeSummary?.active ? "Ya impactan el modelo." : "Pendientes de fijar o descartar.",
      tone: routeSummary?.active || summary.pending ? "warn" : "good",
    },
    {
      label: "Primer riesgo",
      value: capacity.firstShortage?.month || "Sin déficit",
      note: capacity.firstShortage ? money(capacity.firstShortage.shortage, true) : "No hay faltas de caja en el horizonte.",
      tone: capacity.firstShortage ? "danger" : "good",
    },
  ];
  target.innerHTML = `<div class="advisor-status-head">
    <span>Semáforo operativo</span>
    <strong>${escapeHtml(advisorStatusLabel(checks.some((item) => item.tone === "danger") ? "danger" : checks.some((item) => item.tone === "warn") ? "warn" : "good"))}</strong>
    <p>El asesor usa las simulaciones pendientes, los planes fijos y los datos del cuadro de mandos.</p>
  </div>
  <div class="advisor-status-grid">
    ${checks
      .map((item) => `<div class="${item.tone}">
        <span>${escapeHtml(item.label)}</span>
        <strong>${typeof item.value === "string" ? escapeHtml(item.value) : item.value}</strong>
        <small>${escapeHtml(item.note)}</small>
      </div>`)
      .join("")}
  </div>`;
}

function renderAdvisorActions(ctx) {
  const target = qs("virtualAdvisorActions");
  if (!target) return;
  const actions = virtualAdvisorActions(ctx);
  target.innerHTML = actions.length
    ? actions
        .map((item, index) => `<article class="advisor-action ${item.tone}">
          <span>${index + 1}</span>
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <p>${escapeHtml(item.text)}</p>
          </div>
          ${advisorActionButton(item)}
        </article>`)
        .join("")
    : `<div class="empty-state compact">Sin acciones necesarias ahora mismo.</div>`;
}

function renderAdvisorMonths(ctx) {
  const target = qs("virtualAdvisorMonths");
  if (!target) return;
  const rows = agentVisibleRows(ctx.plan).slice(0, 6);
  target.innerHTML = rows
    .map((row) => {
      const status = agentStatusForRow(row);
      return `<article class="advisor-month ${status.tone}">
        <div>
          <span>${escapeHtml(row.month)}</span>
          <strong>${escapeHtml(status.label)}</strong>
        </div>
        <dl>
          <div><dt>Resultado</dt><dd class="${row.operatingResult < 0 ? "negative" : "positive"}">${money(row.operatingResult, true)}</dd></div>
          <div><dt>Proyectos/deuda</dt><dd>${money(row.projectOutflow, true)}</dd></div>
          <div><dt>Traspaso</dt><dd class="positive">${money(row.transferToSavings, true)}<small>${escapeHtml(row.transferDateLabel || "cierre de mes")}</small></dd></div>
          <div><dt>Caja cierre</dt><dd>${money(row.agentCaixa, true)}</dd></div>
        </dl>
      </article>`;
    })
    .join("");
}

function renderAdvisorModel(ctx) {
  const target = qs("virtualAdvisorModel");
  if (!target) return;
  const { summary, routeSummary, debtOptimization, bestDebt, bestProject, plan } = ctx;
  const visibleRows = agentVisibleRows(plan);
  const modelItems = [
    ["Datos usados", "Cuadro de mandos + simulador + control de deuda + saldos", "Se recalcula al entrar en la sección o al aplicar una acción."],
    ["Planes considerados", `${summary.pending} pendientes, ${summary.locked} fijos`, summary.nextImpactAmount ? `${money(summary.nextImpactAmount, true)} en ${summary.nextImpactMonth}` : "Sin impacto próximo."],
    ["Deuda prioritaria", bestDebt ? `${bestDebt.entity} ${bestDebt.type}` : "Sin deuda viva", bestDebt ? `${money(bestDebt.principal, true)} · ${debtOptimization?.steps?.[0]?.monthLabel || bestDebt.monthLabel}` : "No hay objetivo optimizable."],
    ["Proyecto prioritario", bestProject ? bestProject.name : "Sin proyecto pendiente", bestProject ? `${money(bestProject.pot, true)}/mes · objetivo ${bestProject.monthLabel}` : "Añade proyectos para crear huchas."],
    ["Ruta completa", routeSummary ? `${routeSummary.count} paso(s)` : "Sin ruta", routeSummary ? `${routeSummary.firstMonth} - ${routeSummary.lastMonth}; caja mínima ${money(routeSummary.minCaixa, true)}` : "No aplicada ni sugerida."],
    ["Horizonte", `${visibleRows[0]?.month || ""} - ${visibleRows.at(-1)?.month || ""}`, `Patrimonio neto final: ${money(plan.netWorth, true)}.`],
  ];
  target.innerHTML = modelItems
    .map(([label, value, note]) => `<div>
      <span>${escapeHtml(label)}</span>
      <strong>${typeof value === "string" ? escapeHtml(value) : value}</strong>
      <p>${escapeHtml(note)}</p>
    </div>`)
    .join("");
}

function renderVirtualAdvisor() {
  if (!qs("virtualAdvisorKpis")) return;
  const ctx = virtualAdvisorContext();
  renderAdvisorKpis(ctx);
  renderAdvisorPriority(ctx);
  renderAdvisorStatus(ctx);
  renderAdvisorDebtSandbox(ctx);
  renderAdvisorActions(ctx);
  renderAdvisorMonths(ctx);
  renderAdvisorModel(ctx);
}

function renderSavingsAgent() {
  if (!qs("agentKpis")) return;
  const plan = buildSavingsAgentPlan();
  if (qs("agentCaixaFloor")) qs("agentCaixaFloor").value = amountInputValue(plan.caixaFloor);
  populateAgentYearSelect(plan);
  const selectedYear = qs("agentYear")?.value || agentYears(plan)[0];
  const debtRecs = agentDebtRecommendations(plan);
  const projectRecs = agentLifeProjectRecommendations(plan);
  const debtOptimization = agentOptimalDebtPayoffPlan();
  const firstYearRows = agentRowsForYear(plan, selectedYear);
  const yearTransferred = sumRows(firstYearRows, (row) => row.transferToSavings);
  const yearResult = sumRows(firstYearRows, (row) => row.operatingResult);
  renderAgentToday(plan);
  renderAgentQuarterPlan(plan);
  renderAgentPriorityQueue(plan, debtRecs, projectRecs);
  qs("agentKpis").innerHTML = [
    ["Patrimonio neto final", money(plan.netWorth, true), `Liquidez final menos deuda viva no planificada (${money(plan.remainingDebt, true)}).`, plan.netWorth >= 0 ? "good" : "danger"],
    ["Ahorrado en Mediolanum", money(plan.finalMediolanum, true), `Traspasos acumulados: ${money(plan.totalTransferred, true)}.`, "good"],
    ["Caja mínima protegida", money(plan.minCaixa, true), `Reserva: ${money(plan.caixaFloor, true)} + pagos del mes siguiente. Margen mínimo: ${money(plan.minReserveCoverage, true)}.`, plan.minReserveCoverage >= 0 ? "good" : "danger"],
    ["Proyectos y deuda cargados", money(plan.projectSpend, true), `Deuda planificada: ${money(plan.plannedDebtPrincipal, true)}.`, plan.projectSpend > 0 ? "warn" : "neutral"],
  ]
    .map(([label, value, note, tone]) => `<article class="agent-kpi-card ${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
      <p>${escapeHtml(note)}</p>
    </article>`)
    .join("");
  renderAgentExecutive(plan, debtRecs, projectRecs, debtOptimization);
  renderAgentPlanSummary(plan);
  renderAgentDecisionBoard(plan, debtRecs, projectRecs);
  renderAgentDebtOptimization(debtOptimization);

  qs("agentRules").innerHTML = [
    ["Regla de traspaso", `Cada mes mueve a Mediolanum solo lo que exceda ${money(plan.caixaFloor, true)} más los pagos previstos del mes siguiente.`],
    ["Año seleccionado", `${selectedYear}: resultado acumulado ${money(yearResult, true)} y traspaso estimado ${money(yearTransferred, true)}.`],
    ["Uso del ahorro", "Primero protege caja, después calcula deudas y proyectos financiables con Mediolanum."],
    ["Decisiones definitivas", "Nada se aplica al cuadro de mandos hasta preparar la decisión y fijarla en su simulador."],
  ]
    .map(([title, text]) => `<div><span>${escapeHtml(title)}</span><strong>${escapeHtml(text)}</strong></div>`)
    .join("");

  qs("agentInsights").innerHTML = agentInsightCards(plan, debtRecs, projectRecs)
    .map((item) => `<article class="agent-insight ${item.tone}">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.text)}</p>
    </article>`)
    .join("");

  qs("agentDebtList").innerHTML = debtRecs.length
    ? debtRecs.map((item) => renderAgentRecommendationCard(item, "debt")).join("")
    : `<div class="empty-state compact">No hay deudas vivas sin plan pendiente de simular.</div>`;
  qs("agentProjectList").innerHTML = projectRecs.length
    ? projectRecs.map((item) => renderAgentRecommendationCard(item, "project")).join("")
    : `<div class="empty-state compact">No hay proyectos de vida pendientes. Añade uno en el simulador para que el agente calcule hucha y mes objetivo.</div>`;
  renderAgentTable(plan, selectedYear);
}

function renderPrevision() {
  if (!qs("previsionTable")) return;
  populatePrevisionYearSelect();
  const selectedYear = qs("previsionYear")?.value || previsionYears()[0];
  const items = previsionRowsForYear(selectedYear);
  if (!items.length) {
    qs("previsionSummary").innerHTML = "";
    qs("previsionTable").innerHTML = "";
    return;
  }

  const realMetrics = items.map((item) => previsionMetric(item.row));
  const resultYear = sumRows(realMetrics, (metric) => metric.result);
  const minAdjusted = Math.min(...realMetrics.map((metric) => metric.adjustedMin));
  const minTotal = Math.min(...realMetrics.map((metric) => metric.min));
  const maxTotal = Math.max(...realMetrics.map((metric) => metric.max));
  const worstItem = items[realMetrics.findIndex((metric) => metric.adjustedMin === minAdjusted)] || items[0];
  const minItem = items[realMetrics.findIndex((metric) => metric.min === minTotal)] || items[0];
  const maxItem = items[realMetrics.findIndex((metric) => metric.max === maxTotal)] || items[0];

  qs("previsionSummary").innerHTML = [
    ["Resultado anual", money(resultYear, true), resultYear >= 0 ? "positive" : "negative"],
    ["Saldo máximo", `${money(maxTotal, true)} · ${maxItem.row.month} · ${previsionMetric(maxItem.row).maxDateLabel || ""}`, "positive"],
    ["Mínimo", `${money(minTotal, true)} · ${minItem.row.month} · ${previsionMetric(minItem.row).minDateLabel || ""}`, minTotal < 0 ? "negative" : ""],
    ["Mínimo ajustado", `${money(minAdjusted, true)} · ${worstItem.row.month} · ${previsionMetric(worstItem.row).adjustedMinDateLabel || ""}`, minAdjusted < 0 ? "negative" : ""],
  ]
    .map(([label, value, klass]) => `<div class="expense-summary-card"><span>${label}</span><strong class="${klass}">${value}</strong></div>`)
    .join("");

  const headers = items.map((item) => `<th>${escapeHtml(item.row.month)}</th>`).join("");
  const rows = renderPrevisionRows(items);

  qs("previsionTable").innerHTML = `<thead><tr><th>Indicador</th>${headers}</tr></thead><tbody>${rows.join("")}</tbody>`;
}

function statusDot(type) {
  const label = type === "good" ? "En plan" : type === "warn" ? "Vigilancia" : "Crítico";
  return `<span class="status-dot ${type}"></span>${label}`;
}

function isUnifiedCreditTransaction(transaction) {
  const text = normalizedText(`${transaction?.movement || ""} ${transaction?.details || ""} ${transaction?.category || ""}`);
  return Number(transaction?.amount || 0) < 0 && (text.includes("pz finanz") || text.includes("libre deuda"));
}

function observedUnifiedCreditPayment() {
  const forecastStart = baseData?.metadata?.forecastStart?.slice(0, 7) || baseData?.monthlyPlanning?.months?.[0]?.key || "";
  const monthTotals = new Map();
  (baseData?.transactions || [])
    .filter((transaction) => transaction.month >= forecastStart && isUnifiedCreditTransaction(transaction))
    .forEach((transaction) => {
      monthTotals.set(transaction.month, round2((monthTotals.get(transaction.month) || 0) + Math.abs(Number(transaction.amount || 0))));
    });
  const monthlyValues = [...monthTotals.values()].filter((value) => value > 0);
  const observed = monthlyValues.length ? round2(monthlyValues.reduce((sum, value) => sum + value, 0) / monthlyValues.length) : 0;
  return {
    value: observed,
    monthCount: monthlyValues.length,
    forecastStart,
    plannedReference: Number(baseData?.sourcePlan?.unifiedCreditPayment || 0),
  };
}

function medianValue(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function savingsRows(months = 48) {
  const rows = openSimulationRows(lastSimulation);
  return rows.slice(0, Math.min(months, rows.length));
}

function savingsPlanningLineAverage(rows, predicate) {
  const values = rows.map((row) => {
    const month = planningMonthForDate(dateFromMonthKey(row.detailMonthKey), row.index - 1);
    return sumRows(planningSectionsForMonth("expense", month), (section) =>
      sumRows(section.rows, (line) => (predicate(section, line) ? actualAwareValue(line, month) : 0)),
    );
  });
  return round2(averageRows(values, (value) => value));
}

function savingsDecisionImpact(rows) {
  const rowIndexes = rows.map((row) => row.index - 1);
  const summary = {
    projectCost: 0,
    debtAmortization: 0,
    debtRelief: 0,
    netDecisionImpact: 0,
    projectCount: projects.length,
    debtDecisionCount: debtLiquidations.length,
    labels: [],
  };
  projectPlan.placements.forEach((item) => {
    let cost = 0;
    let relief = 0;
    rowIndexes.forEach((forecastIndex) => {
      const impact = scheduledDecisionMonthlyImpact(item, forecastIndex);
      if (impact > 0) cost += impact;
      if (impact < 0) relief += Math.abs(impact);
    });
    if (!cost && !relief) return;
    summary.netDecisionImpact += cost - relief;
    if (item.source === "debt") {
      summary.debtAmortization += cost;
      summary.debtRelief += relief;
      summary.labels.push(`${item.name || "Amortización deuda"}: ${money(cost, true)}${relief ? `, alivio ${money(relief, true)}` : ""}`);
    } else {
      summary.projectCost += cost;
      summary.labels.push(`${item.name || "Proyecto"}: ${money(cost, true)}`);
    }
  });
  return {
    ...summary,
    projectCost: round2(summary.projectCost),
    debtAmortization: round2(summary.debtAmortization),
    debtRelief: round2(summary.debtRelief),
    netDecisionImpact: round2(summary.netDecisionImpact),
  };
}

function savingsDetectedModel() {
  const rows = savingsRows(48);
  const first12 = rows.slice(0, Math.min(12, rows.length));
  const first24 = rows.slice(0, Math.min(24, rows.length));
  const incomeValues = first12.map((row) => Number(row.income || 0)).filter((value) => value > 0);
  const recurringIncome = round2(medianValue(incomeValues));
  const extraThreshold = Math.max(500, recurringIncome * 0.16);
  const detectedExtras = first24
    .map((row) => {
      const extra = Math.max(0, Number(row.income || 0) - recurringIncome);
      return extra > extraThreshold ? { row, amount: round2(extra) } : null;
    })
    .filter(Boolean);
  const extraByMonth = (monthNumber) => {
    const matches = detectedExtras.filter((item) => Number(item.row.detailMonthKey.slice(5, 7)) === monthNumber);
    return round2(averageRows(matches, (item) => item.amount));
  };
  const bmwRows = rows.filter((row) => Number(row.car || 0) > 0);
  const lastBmwRow = bmwRows.at(-1);
  const mortgageAverage = savingsPlanningLineAverage(first12, (_section, line) =>
    /\b(hipoteca|prs|crd)\b/.test(normalizedText(displayLabelForRow(line))),
  );
  const bankinterAverage = savingsPlanningLineAverage(first12, (_section, line) =>
    normalizedText(displayLabelForRow(line)).includes("bankinter"),
  );
  const cetelemAverage = savingsPlanningLineAverage(first12, (_section, line) =>
    normalizedText(displayLabelForRow(line)).includes("cetelem"),
  );
  const reunifiedAverage = savingsPlanningLineAverage(first12, (section, line) => {
    const text = normalizedText(`${section.name} ${displayLabelForRow(line)}`);
    return isFinancingPlanningRow(section, line) && /cetelem|pz finanz|libre deuda|reunific|refinanci/.test(text);
  });
  const decisionImpact12 = savingsDecisionImpact(first12);
  const decisionImpact48 = savingsDecisionImpact(rows);
  const variableOperational = variableOperationalSpendModel();
  const variableOperationalAverage = round2(averageRows(first12, (row) => row.variableOperationalSpend || 0) || variableOperational.average);
  const fixedOperationalAverage = round2(averageRows(first12, (row) => row.fixedCoreSpend ?? Math.max(0, Number(row.coreSpend || 0) - Number(row.variableOperationalSpend || 0))));
  const operationalAverage = round2(fixedOperationalAverage + variableOperationalAverage);
  const debtAverage = round2(averageRows(first12, (row) => row.car + row.refi));
  const availableAverage = round2(averageRows(first12, (row) => row.netBeforeSaving));
  const startingSavings = round2(accountBalancesFromState().mediolanum || first12[0]?.savings || 0);
  const essentialAverage = round2(operationalAverage + debtAverage);

  return {
    rows,
    first12,
    first24,
    recurringIncome,
    detectedExtras,
    extraApril: extraByMonth(4),
    extraDecember: extraByMonth(12),
    mortgageAverage,
    bankinterAverage,
    cetelemAverage,
    reunifiedAverage,
    bmwPositiveAverage: round2(averageRows(bmwRows, (row) => row.car)),
    bmwMonthsRemaining: bmwRows.length,
    bmwEndLabel: lastBmwRow ? lastBmwRow.month : "",
    operationalAverage,
    fixedOperationalAverage,
    variableOperationalAverage,
    variableOperationalMonths: variableOperational.months,
    variableOperationalTotals: variableOperational.totals,
    coreWithoutMortgageAverage: round2(Math.max(0, operationalAverage - mortgageAverage)),
    debtAverage,
    projectAverage: round2(averageRows(first12, (row) => row.projectOutflow)),
    availableAverage,
    startingSavings,
    essentialAverage,
    firstIncome: round2(first12[0]?.income || 0),
    firstDebt: round2((first12[0]?.car || 0) + (first12[0]?.refi || 0)),
    decisionImpact12,
    decisionImpact48,
  };
}

const savingsPlanFieldMeta = [
  ["baseHouseholdIncome", "Ingreso recurrente detectado", "€"],
  ["extraApril", "Extra abril detectada", "€"],
  ["extraDecember", "Extra diciembre detectada", "€"],
  ["mortgagePayment", "Hipoteca detectada", "€"],
  ["bmwPayment", "BMW detectado", "€"],
  ["unifiedCreditPayment", "Cuota unificada real", "€"],
  ["otherFixedNonDebt", "Gasto fijo operativo", "€"],
  ["variableSpendTarget", "Gasto variable tarjeta", "€"],
  ["initialEmergencyFund", "Colchón inicial", "€"],
  ["emergencyBufferMonths", "Meses objetivo de colchón", "n"],
  ["extraToBufferPct", "% extra destinado a colchón", "%"],
  ["extraToAmortizationPct", "% extra destinado a amortización", "%"],
  ["cashTargetPct", "% objetivo gasto en efectivo", "%"],
  ["bankinterOutsidePlanPayment", "Financiación fuera plan - Bankinter", "€"],
  ["cetelemOutsidePlanPayment", "Financiación fuera plan - Cetelem", "€"],
];

function savingsPlanBaseValue(key) {
  const plan = baseData.sourcePlan || {};
  const assumptions = baseData.assumptions || {};
  const detected = savingsDetectedModel();
  if (key === "unifiedCreditPayment") return detected.reunifiedAverage || observedUnifiedCreditPayment().value;
  if (key === "baseHouseholdIncome") return detected.recurringIncome;
  if (key === "extraApril") return detected.extraApril;
  if (key === "extraDecember") return detected.extraDecember;
  if (key === "mortgagePayment") return detected.mortgageAverage || plan.mortgagePayment || 0;
  if (key === "bmwPayment") return detected.bmwPositiveAverage;
  if (key === "otherFixedNonDebt") return detected.fixedOperationalAverage;
  if (key === "variableSpendTarget") return detected.variableOperationalAverage;
  if (key === "initialEmergencyFund") return detected.startingSavings;
  if (key === "bankinterOutsidePlanPayment") return detected.bankinterAverage || plan.bankinterOutsidePlanPayment || 0;
  if (key === "cetelemOutsidePlanPayment") return detected.cetelemAverage || plan.cetelemOutsidePlanPayment || 0;
  const fallbacks = {
    emergencyBufferMonths: state?.emergencyBufferMonths ?? plan.emergencyBufferMonths,
    extraToBufferPct: 70,
    extraToAmortizationPct: 30,
    cashTargetPct: 5,
    initialEmergencyFund: plan.initialEmergencyFund ?? assumptions.initialCash,
  };
  return plan[key] ?? assumptions[key] ?? fallbacks[key] ?? 0;
}

function savingsPlanFieldSource(key) {
  const detected = savingsDetectedModel();
  const monthLabelText = detected.first12[0]?.month ? `desde ${detected.first12[0].month}` : "desde el inicio del modelo";
  if (key === "baseHouseholdIncome") return `Mediana de ingresos de los próximos 12 meses; las extras se tratan en su mes real.`;
  if (key === "extraApril" || key === "extraDecember") return `Detectada como pico de ingresos frente al recurrente; no se prorratea en el flujo mensual.`;
  if (key === "mortgagePayment") return detected.mortgageAverage
    ? `Detectada por líneas de hipoteca en detalle mensual.`
    : `No aislada en el detalle; queda como referencia revisable.`;
  if (key === "bmwPayment") {
    return detected.bmwMonthsRemaining
      ? `Detectado ${money(detected.bmwPositiveAverage, true)} durante ${detected.bmwMonthsRemaining} mes(es); último mes ${detected.bmwEndLabel}.`
      : "Sin pagos BMW futuros detectados en el flujo.";
  }
  if (key === "unifiedCreditPayment") {
    const observed = observedUnifiedCreditPayment();
    const modelValue = detected.reunifiedAverage || currentDebtPaymentBreakdown().unified;
    const source = detected.reunifiedAverage
      ? `reunificación detectada en el modelo: ${money(detected.reunifiedAverage, true)} de media 12m`
      : `reunificación de cartera: ${money(modelValue, true)}/mes`;
    const reference = `referencia Plan_Ahorro_821: ${money(observed.plannedReference, true)}`;
    return `${source}; real bancario observado: ${money(observed.value, true)}; ${reference}.`;
  }
  if (key === "otherFixedNonDebt") return `Media de partidas fijas/operativas ${monthLabelText}, separando coche, financiación, proyectos y tarjeta variable.`;
  if (key === "variableSpendTarget") {
    const months = detected.variableOperationalMonths?.length ? detected.variableOperationalMonths.join(", ") : "sin meses suficientes";
    return `Promedio de movimientos variables de tarjeta (${months}), excluyendo MASTER BASICA y deuda. Editable si quieres tensionar o relajar el objetivo.`;
  }
  if (key === "initialEmergencyFund") return "Saldo de ahorro separado estimado a la fecha de análisis o saldo manual introducido.";
  if (key === "bankinterOutsidePlanPayment" || key === "cetelemOutsidePlanPayment") return "Media detectada por concepto si existe; si no, referencia editable.";
  return "";
}

function savingsPlanOverrides() {
  scenarioSettings.savingsPlan = scenarioSettings.savingsPlan || {};
  return scenarioSettings.savingsPlan;
}

function savingsPlanValue(key) {
  const overrides = savingsPlanOverrides();
  if (key === "unifiedCreditPayment") {
    const observed = observedUnifiedCreditPayment();
    if (overrides[key] !== undefined) {
      const overrideValue = Number(overrides[key] || 0);
      const isLegacyPlanValue =
        !overrides.__manualUnifiedCreditPayment &&
        observed.monthCount === 0 &&
        Math.abs(overrideValue - observed.plannedReference) < 0.01;
      if (!isLegacyPlanValue) return overrideValue;
    }
    return savingsPlanBaseValue(key);
  }
  if (overrides[key] !== undefined) return Number(overrides[key] || 0);
  if (key === "emergencyBufferMonths") return Number(state?.emergencyBufferMonths ?? savingsPlanBaseValue(key) ?? 0);
  return Number(savingsPlanBaseValue(key) || 0);
}

function savingsPlanValues() {
  return Object.fromEntries(savingsPlanFieldMeta.map(([key]) => [key, savingsPlanValue(key)]));
}

function savingsInputValue(key, unit) {
  const value = savingsPlanValue(key);
  if (unit === "%") return value.toFixed(1);
  if (unit === "n") return Number.isInteger(value) ? String(value) : value.toFixed(1);
  return amountInputValue(value);
}

function savingsPlanCalculations() {
  const v = savingsPlanValues();
  const detected = savingsDetectedModel();
  const rows = detected.first12;
  const horizon = Math.max(1, rows.length);
  const monthlyIncomeTotal = round2(sumRows(rows, (row) => row.income) / horizon);
  const recurringIncome = v.baseHouseholdIncome;
  const debtServiceMonthlyTotal = detected.debtAverage;
  const operationalMonthlyTotal = round2(Number(v.otherFixedNonDebt || 0) + Number(v.variableSpendTarget || 0));
  const projectMonthlyTotal = detected.projectAverage;
  const decisionMonthlyNet = round2(detected.decisionImpact12.netDecisionImpact / horizon);
  const totalSpendTarget = round2(operationalMonthlyTotal + debtServiceMonthlyTotal + projectMonthlyTotal);
  const monthlySavingPotential = round2(sumRows(rows, (row) => row.netBeforeSaving) / horizon);
  const savingsRate = monthlyIncomeTotal ? monthlySavingPotential / monthlyIncomeTotal : 0;
  const debtToIncomeRatio = monthlyIncomeTotal ? debtServiceMonthlyTotal / monthlyIncomeTotal : 0;
  const emergencyFundTarget = round2(Math.max(1, operationalMonthlyTotal + debtServiceMonthlyTotal) * v.emergencyBufferMonths);
  const emergencyFundGap = Math.max(0, emergencyFundTarget - v.initialEmergencyFund);
  const currentCoverage = totalSpendTarget ? v.initialEmergencyFund / Math.max(1, operationalMonthlyTotal + debtServiceMonthlyTotal) : 0;
  const buildMonths = currentCoverage < 3 ? 9 : 12;
  const minMonthlyForBuffer = emergencyFundGap / buildMonths;
  const monthsToComplete = monthlySavingPotential > 0 ? emergencyFundGap / monthlySavingPotential : 0;
  const recommendedSaving = round2(
    monthlySavingPotential > 0 ? Math.min(monthlySavingPotential, Math.max(minMonthlyForBuffer, monthlySavingPotential * 0.55)) : 0,
  );
  const extraTotal = round2(sumRows(rows, (row) => Math.max(0, row.income - recurringIncome)));
  const suggestedAmortization = round2((extraTotal * (v.extraToAmortizationPct / 100)) / horizon);
  const currentSavingTarget = round2(Number(state.recommendedSavings || 0));
  const currentAppliedAverage = round2(averageRows(rows, (row) => row.saving));
  const projectedCoverage12 = rows.at(-1)
    ? rows.at(-1).savings / Math.max(1, operationalMonthlyTotal + debtServiceMonthlyTotal)
    : currentCoverage;
  return {
    values: v,
    detected,
    rows,
    monthlyIncomeTotal,
    operationalMonthlyTotal,
    projectMonthlyTotal,
    decisionMonthlyNet,
    debtServiceMonthlyTotal,
    totalSpendTarget,
    monthlySavingPotential,
    savingsRate,
    debtToIncomeRatio,
    emergencyFundTarget,
    emergencyFundGap,
    minMonthlyForBuffer,
    buildMonths,
    monthsToComplete,
    recommendedSaving,
    suggestedAmortization,
    currentCoverage,
    projectedCoverage12,
    currentSavingTarget,
    currentAppliedAverage,
    extraTotal,
  };
}

function applySavingsPlanToScenario({ silent = false } = {}) {
  const c = savingsPlanCalculations();
  state.recommendedSavings = round2(c.recommendedSaving);
  state.emergencyBufferMonths = c.values.emergencyBufferMonths;
  if (qs("recommendedSavings")) qs("recommendedSavings").value = state.recommendedSavings.toFixed(2);
  if (qs("emergencyBufferMonths")) qs("emergencyBufferMonths").value = state.emergencyBufferMonths;
  saveScenarioSettings();
  if (!silent && qs("savingsPlanFeedback")) {
    qs("savingsPlanFeedback").textContent = "Plan aplicado al modelo: ahorro objetivo y colchón recalculados con el flujo real/proyectado.";
    qs("savingsPlanFeedback").className = "inline-feedback success";
  }
}

function handleSavingsPlanInput(input) {
  const key = input.dataset.savingsPlanField;
  const parsed = parseAmount(input.value);
  if (!key || parsed === null) return;
  const overrides = savingsPlanOverrides();
  overrides[key] = parsed;
  if (key === "unifiedCreditPayment") overrides.__manualUnifiedCreditPayment = true;
  if (key === "recommendedSaving") state.recommendedSavings = parsed;
  applySavingsPlanToScenario({ silent: true });
  render();
  if (qs("savingsPlanFeedback")) {
    qs("savingsPlanFeedback").textContent = "Cambio aplicado y recalculado en el resto del dashboard.";
    qs("savingsPlanFeedback").className = "inline-feedback success";
  }
}

function renderSavingsPlanAssumptionInput(key, label, unit) {
  const source = savingsPlanFieldSource(key);
  return `<label class="savings-assumption-input">
    <span>${escapeHtml(label)}</span>
    <input data-savings-plan-field="${escapeHtml(key)}" type="number" step="${unit === "n" ? "1" : "0.01"}" value="${savingsInputValue(key, unit)}" />
    ${source ? `<small class="savings-field-source">${escapeHtml(source)}</small>` : ""}
  </label>`;
}

function savingsStatusLabel(type) {
  return type === "good" ? "Optimizado" : type === "warn" ? "Ajustable" : "Revisar";
}

function renderSavingsKpiComparison({ title, actual, current, advised, note, status }) {
  return `<div class="savings-kpi savings-kpi-comparison ${status}">
    <div class="savings-kpi-header">
      <span>${escapeHtml(title)}</span>
      <em>${statusDot(status)}</em>
    </div>
    <div class="savings-kpi-columns">
      <div><small>Actual</small><strong>${escapeHtml(actual)}</strong></div>
      <div><small>Corriente</small><strong>${escapeHtml(current)}</strong></div>
      <div><small>Aconsejable</small><strong>${escapeHtml(advised)}</strong></div>
    </div>
    <p>${escapeHtml(note)}</p>
  </div>`;
}

function savingsMonthlyAdvice(row, calc) {
  const extraIncome = Math.max(0, Number(row.income || 0) - Number(calc.values.baseHouseholdIncome || 0));
  const extraToBuffer = extraIncome * (Number(calc.values.extraToBufferPct || 0) / 100);
  const available = Math.max(0, Number(row.netBeforeSaving || 0));
  const advised = round2(Math.min(available, calc.recommendedSaving + extraToBuffer));
  const amortization = round2(Math.max(0, extraIncome * (Number(calc.values.extraToAmortizationPct || 0) / 100)));
  const decisions = projectsForForecastIndex(row.index - 1);
  const decisionNote = decisions.length
    ? decisions
        .map((item) => `${item.source === "debt" ? "Deuda" : "Proyecto"}: ${item.name || "sin nombre"} ${money(item.monthlyAmount, true)}`)
        .join("; ")
    : "";
  const note = decisionNote
    ? decisionNote
    : extraIncome > 500
    ? `Extra detectada: ${money(extraIncome, true)}. Se propone reforzar colchón y reservar ${money(amortization, true)} para amortizar.`
    : row.car > 0 && calc.detected.bmwEndLabel
      ? `BMW activo; termina en ${calc.detected.bmwEndLabel}.`
      : "Mes ordinario calculado desde ingresos y gastos previstos/reales.";
  return { advised, amortization, extraIncome, note };
}

function renderSavingsPeriodAdvice(rows, calc) {
  const container = qs("savingsPeriodAdvice");
  if (!container) return;
  const groups = new Map();
  rows.forEach((row) => {
    const year = String(cashflowYear(row));
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(row);
  });
  container.innerHTML = [...groups.entries()]
    .map(([year, items]) => {
      const advisedAvg = round2(averageRows(items, (row) => savingsMonthlyAdvice(row, calc).advised));
      const currentAvg = round2(averageRows(items, (row) => row.saving));
      const netAvg = round2(averageRows(items, (row) => row.netBeforeSaving));
      const projectAvg = round2(averageRows(items, (row) => row.projectOutflow));
      const minCash = Math.min(...items.map((row) => previsionMetric(row).min));
      const status = minCash < 0 ? "danger" : currentAvg >= advisedAvg * 0.95 ? "good" : "warn";
      const statusText = status === "good" ? "En ritmo" : status === "warn" ? "Ajustar" : "Caja crítica";
      return `<article class="savings-period-item ${status}">
        <div class="savings-period-head">
          <strong>${escapeHtml(year)}</strong>
          <span>${statusText}</span>
        </div>
        <div class="savings-period-metrics">
          <div><small>Ahorro sugerido medio</small><b>${money(advisedAvg, true)}</b></div>
          <div><small>Ahorro aplicado medio</small><b>${money(currentAvg, true)}</b></div>
          <div><small>Margen medio</small><b>${money(netAvg, true)}</b></div>
          <div><small>Proyectos/deuda medio</small><b>${money(projectAvg, true)}</b></div>
        </div>
        <p>${status === "danger" ? "Conviene mover proyectos o reducir ahorro antes de ejecutar." : status === "warn" ? "Hay margen, pero el ahorro aplicado queda por debajo del recomendado." : "El ahorro sugerido encaja con el flujo y las decisiones cargadas."}</p>
      </article>`;
    })
    .join("");
}

function renderSavingsPlan() {
  if (!qs("savingsTable") || !lastSimulation.length) return;
  const rows = savingsRows(48);
  const first = rows[0];
  const last = rows[rows.length - 1];
  const calc = savingsPlanCalculations();
  const firstOutflow = Math.max(1, calc.operationalMonthlyTotal + calc.debtServiceMonthlyTotal);
  const bufferTarget = calc.emergencyFundTarget;
  const debtRatio = calc.debtToIncomeRatio;
  const savingsRate = calc.savingsRate;
  const appliedVsAdvised = sumRows(calc.rows, (row) => row.saving - savingsMonthlyAdvice(row, calc).advised);

  qs("savingsAssumptions").innerHTML = savingsPlanFieldMeta
    .map(([key, label, unit]) => renderSavingsPlanAssumptionInput(key, label, unit))
    .join("");

  qs("savingsKpis").innerHTML = [
    renderSavingsKpiComparison({
      title: "Ahorro mensual",
      actual: money(calc.currentSavingTarget, true),
      current: money(calc.currentAppliedAverage, true),
      advised: money(calc.recommendedSaving, true),
      note: "Actual es el objetivo cargado; corriente es lo que el flujo permite; aconsejable se recalcula con colchón y margen.",
      status: calc.currentAppliedAverage >= calc.recommendedSaving * 0.95 ? "good" : calc.currentAppliedAverage >= calc.recommendedSaving * 0.75 ? "warn" : "danger",
    }),
    renderSavingsKpiComparison({
      title: "Tasa de ahorro",
      actual: `${((first?.saving || 0) / Math.max(1, first?.income || 1) * 100).toFixed(1)}%`,
      current: `${(savingsRate * 100).toFixed(1)}%`,
      advised: ">= 20%",
      note: "Calculada con ingresos y gastos de los próximos 12 meses; las extras entran en abril/diciembre, no prorrateadas.",
      status: savingsRate >= 0.2 ? "good" : savingsRate >= 0.12 ? "warn" : "danger",
    }),
    renderSavingsKpiComparison({
      title: "Cobertura de colchón",
      actual: `${calc.currentCoverage.toFixed(1)} meses`,
      current: `${calc.projectedCoverage12.toFixed(1)} meses`,
      advised: `${Number(calc.values.emergencyBufferMonths || 6).toFixed(0)} meses`,
      note: "Mide el ahorro separado frente a gasto operativo + deuda media. Si sube el flujo, el objetivo se alcanza antes.",
      status: calc.projectedCoverage12 >= Number(calc.values.emergencyBufferMonths || 6) ? "good" : calc.projectedCoverage12 >= 3 ? "warn" : "danger",
    }),
    renderSavingsKpiComparison({
      title: "Deuda / ingresos",
      actual: `${(calc.detected.firstIncome ? (calc.detected.firstDebt / calc.detected.firstIncome) * 100 : 0).toFixed(1)}%`,
      current: `${(debtRatio * 100).toFixed(1)}%`,
      advised: "<= 32%",
      note: "Incluye coche y financiaciones detectadas mes a mes. El BMW desaparece automáticamente al terminar.",
      status: debtRatio <= 0.32 ? "good" : debtRatio <= 0.4 ? "warn" : "danger",
    }),
    renderSavingsKpiComparison({
      title: "Proyectos y deuda simulada",
      actual: `${calc.detected.decisionImpact12.projectCount + calc.detected.decisionImpact12.debtDecisionCount} cargados`,
      current: money(calc.decisionMonthlyNet, true),
      advised: calc.detected.decisionImpact12.netDecisionImpact <= calc.monthlySavingPotential * 12 ? "Asumible 12m" : "Reordenar",
      note: `Proyectos: ${money(calc.detected.decisionImpact12.projectCost, true)}. Amortizaciones: ${money(calc.detected.decisionImpact12.debtAmortization, true)}. Alivio posterior: ${money(calc.detected.decisionImpact12.debtRelief, true)}.`,
      status: calc.detected.decisionImpact12.netDecisionImpact <= calc.monthlySavingPotential * 12 ? "good" : "warn",
    }),
  ]
    .join("");

  qs("savingsSummary").innerHTML = [
    ["Colchón final estimado", money(last.savings, true), last.savings >= bufferTarget ? "positive" : "negative"],
    ["Meses cobertura final", `${(last.savings / Math.max(1, firstOutflow)).toFixed(1)}`, last.savings >= bufferTarget ? "positive" : "negative"],
    ["Total ahorro 48m", money(sumRows(rows, (row) => row.saving), true), "positive"],
    ["Decisiones cargadas 48m", money(calc.detected.decisionImpact48.netDecisionImpact, true), calc.detected.decisionImpact48.netDecisionImpact <= 0 ? "positive" : "negative"],
  ]
    .map(([label, value, klass]) => `<div class="expense-summary-card"><span>${label}</span><strong class="${klass}">${value}</strong></div>`)
    .join("");
  renderSavingsPeriodAdvice(rows, calc);

  const tableRows = rows.map((row) => {
    const coverage = firstOutflow ? row.savings / firstOutflow : 0;
    const advice = savingsMonthlyAdvice(row, calc);
    const deviation = row.saving - advice.advised;
    const status = coverage >= Number(calc.values.emergencyBufferMonths || 6) ? "good" : coverage >= Number(calc.values.emergencyBufferMonths || 6) * 0.7 ? "warn" : "danger";
    return `<tr>
      <td>${escapeHtml(row.month)}</td>
      <td>${money(row.netBeforeSaving, true)}</td>
      <td>${money(row.saving, true)}</td>
      <td>${money(advice.advised, true)}</td>
      <td class="${deviation < 0 ? "negative" : "positive"}">${money(deviation, true)}</td>
      <td>${money(row.savings, true)}</td>
      <td>${coverage.toFixed(1)}</td>
      <td>${statusDot(status)}</td>
      <td>${money(advice.amortization, true)}</td>
      <td>${escapeHtml(advice.note)}</td>
    </tr>`;
  });
  qs("savingsTable").innerHTML = `<thead><tr>
    <th>Mes</th><th>Margen antes de ahorrar</th><th>Ahorro corriente</th><th>Ahorro aconsejable</th><th>Desvío</th><th>Colchón fin</th><th>Meses cobertura</th><th>Estado</th><th>Amortización extra</th><th>Lectura</th>
  </tr></thead><tbody>${tableRows.join("")}</tbody>`;

  const formulaRows = [
    ["Ingresos próximos 12m", "Suma mensual real/proyectada / 12", `Incluye extras en su mes: abril ${money(calc.values.extraApril, true)}, diciembre ${money(calc.values.extraDecember, true)}`, money(calc.monthlyIncomeTotal, true), calc.values.extraApril || calc.values.extraDecember ? "OK: extras no prorrateadas en el flujo." : "Revisar si falta alguna extra prevista."],
    [
      "Gasto operativo próximo 12m",
      "Fijos operativos + variable tarjeta",
      `Fijos ${money(calc.values.otherFixedNonDebt, true)} + tarjeta variable ${money(calc.values.variableSpendTarget, true)}; excluye MASTER BASICA, coche, deuda y proyectos.`,
      money(calc.operationalMonthlyTotal, true),
      calc.values.variableSpendTarget > 0 ? "OK: la liquidez descuenta un colchón de gasto variable real." : "Revisar: no hay gasto variable de tarjeta detectado.",
    ],
    ["Deuda reunificada actual", "Líneas de refinanciación/reunificación detectadas", `Modelo 12m: ${money(calc.detected.reunifiedAverage, true)}; cartera actual: ${money(currentDebtPaymentBreakdown().unified, true)}/mes`, money(calc.values.unifiedCreditPayment, true), calc.values.unifiedCreditPayment ? "OK: incluida en la deuda mensual del flujo." : "Revisar: no se detecta reunificación futura."],
    ["Deuda + coche próximo 12m", "Coche + financiaciones del modelo / 12", calc.detected.bmwMonthsRemaining ? `BMW detectado hasta ${calc.detected.bmwEndLabel}; cuota media positiva ${money(calc.values.bmwPayment, true)}.` : "Sin BMW futuro detectado.", money(calc.debtServiceMonthlyTotal, true), calc.debtToIncomeRatio <= 0.32 ? "OK frente al umbral <=32%." : "Revisar deuda: supera el umbral aconsejable."],
    ["Proyectos cargados", "Impactos de proyectos / 12", `${calc.detected.decisionImpact12.projectCount} proyecto(s): ${money(calc.detected.decisionImpact12.projectCost, true)}`, money(calc.detected.decisionImpact12.projectCost / Math.max(1, calc.rows.length), true), calc.detected.decisionImpact12.projectCost ? "OK: proyecto incluido en caja y ahorro." : "Sin proyectos en el periodo."],
    ["Amortizaciones/liquidaciones cargadas", "Coste de liquidación menos alivio posterior", `${calc.detected.decisionImpact12.debtDecisionCount} decisión(es): coste ${money(calc.detected.decisionImpact12.debtAmortization, true)}; alivio ${money(calc.detected.decisionImpact12.debtRelief, true)}`, money(calc.detected.decisionImpact12.netDecisionImpact / Math.max(1, calc.rows.length), true), calc.detected.decisionImpact12.debtDecisionCount ? "OK: amortizaciones y alivios incluidos." : "Sin amortizaciones simuladas en el periodo."],
    ["Margen medio antes de ahorrar", "Ingresos - gasto operativo - deuda - proyectos", `${money(calc.monthlyIncomeTotal, true)} - ${money(calc.totalSpendTarget, true)}`, money(calc.monthlySavingPotential, true), calc.monthlySavingPotential > 0 ? "OK: hay margen positivo." : "Revisar: no hay margen para ahorrar."],
    ["Colchón objetivo", "Gasto esencial medio * meses objetivo", `${money(calc.operationalMonthlyTotal + calc.debtServiceMonthlyTotal, true)} * ${calc.values.emergencyBufferMonths}`, money(calc.emergencyFundTarget, true), "Ajustable según tolerancia de riesgo."],
    ["Gap de colchón", "Colchón objetivo - colchón actual", `${money(calc.emergencyFundTarget, true)} - ${money(calc.values.initialEmergencyFund, true)}`, money(calc.emergencyFundGap, true), calc.emergencyFundGap > 0 ? "Priorizar colchón antes de amortizar agresivamente." : "Colchón cubierto; se puede priorizar amortización/inversión."],
    ["Ahorro aconsejable", "Máximo entre gap repartido y 55% del margen, limitado por caja", `Gap / ${calc.buildMonths} meses y margen ${money(calc.monthlySavingPotential, true)}`, money(calc.recommendedSaving, true), calc.recommendedSaving <= calc.monthlySavingPotential ? "OK: compatible con flujo actual." : "Revisar: supera el margen disponible."],
    ["Amortización extra orientativa", "% de extras destinado a amortizar", `${money(calc.extraTotal, true)} * ${calc.values.extraToAmortizationPct.toFixed(1)}% / 12`, money(calc.suggestedAmortization, true), calc.suggestedAmortization ? "Aplicar en meses de extra o al liquidar deuda concreta." : "Sin extras detectadas en próximos 12 meses."],
  ];
  qs("savingsCalculationTable").innerHTML = `<thead><tr><th>Cálculo</th><th>Criterio</th><th>Dato real usado</th><th>Resultado</th><th>Revisión</th></tr></thead><tbody>${formulaRows
    .map(([name, formula, values, result, review]) => `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(formula)}</td><td>${escapeHtml(values)}</td><td><strong>${escapeHtml(result)}</strong></td><td>${escapeHtml(review)}</td></tr>`)
    .join("")}</tbody>`;

  document.querySelectorAll("[data-savings-plan-field]").forEach((input) => {
    input.addEventListener("change", () => handleSavingsPlanInput(input));
  });
}

function renderMerchants() {
  qs("merchantList").innerHTML = baseData.topMerchants
    .slice(0, 12)
    .map(
      (item) => `<div class="merchant">
        <div><strong>${item.Movimiento}</strong><br><span>${item.Categoria}</span></div>
        <strong>${money(item.amount, true)}</strong>
      </div>`,
    )
    .join("");
  renderMovementImportReview();
  renderDetailedMovements();
}

function movementKindFromAmount(amount) {
  return Number(amount || 0) >= 0 ? "income" : "expense";
}

function movementMappingKey(transaction) {
  const kind = movementKindFromAmount(transaction?.amount);
  const movement = normalizedText(transaction?.movement || "").replace(/[^a-z0-9]+/g, " ").trim();
  const details = normalizedText(transaction?.details || "").replace(/[^a-z0-9]+/g, " ").trim();
  return `${kind}|${movement}|${details}`;
}

function movementDisplayName(transaction) {
  const details = String(transaction?.details || "").trim();
  return details ? `${transaction.movement} · ${details}` : String(transaction?.movement || "Movimiento");
}

function planningRowBySeriesKey(kind, key) {
  return availableSeriesRows(kind).find((row) => seriesKeyForRow(row) === key) || null;
}

function exactMovementPlanningMatch(transaction) {
  const kind = movementKindFromAmount(transaction.amount);
  const movement = normalizedText(transaction.movement || "");
  const details = normalizedText(transaction.details || "");
  const combined = normalizedText(`${transaction.movement || ""} ${transaction.details || ""}`);
  if (!movement && !details) return null;
  return (
    availableSeriesRows(kind).find((row) => {
      const label = normalizedText(displayLabelForRow(row));
      return label && (label === movement || label === details || label === combined);
    }) || null
  );
}

function mappingForMovement(transaction) {
  const kind = movementKindFromAmount(transaction.amount);
  const stored = movementMappings[movementMappingKey(transaction)];
  const storedRow = stored?.kind === kind ? planningRowBySeriesKey(kind, stored.rowKey) : null;
  if (storedRow) return { kind, row: storedRow, source: "dictionary" };
  const exact = exactMovementPlanningMatch(transaction);
  return exact ? { kind, row: exact, source: "exact" } : null;
}

function movementMappingOptions(kind, selected = "") {
  return [
    `<option value="">Sin asignar todavía</option>`,
    ...availableSeriesRows(kind).map((row) => {
      const key = seriesKeyForRow(row);
      return `<option value="${escapeHtml(key)}" ${key === selected ? "selected" : ""}>${escapeHtml(row.sectionName)} · ${escapeHtml(displayLabelForRow(row))}</option>`;
    }),
  ].join("");
}

function buildPendingMovementMappings(transactions) {
  const groups = new Map();
  transactions.forEach((transaction) => {
    if (!transaction || !Number(transaction.amount)) return;
    if (mappingForMovement(transaction)) return;
    const key = movementMappingKey(transaction);
    const current = groups.get(key) || {
      key,
      kind: movementKindFromAmount(transaction.amount),
      label: movementDisplayName(transaction),
      count: 0,
      total: 0,
      examples: [],
    };
    current.count += 1;
    current.total = round2(current.total + Math.abs(Number(transaction.amount || 0)));
    if (current.examples.length < 2) current.examples.push(transaction);
    groups.set(key, current);
  });
  return [...groups.values()].sort((a, b) => b.total - a.total);
}

function renderMovementImportReview() {
  const panel = qs("movementMappingReview");
  if (!panel) return;
  const dictionaryCount = Object.keys(movementMappings).length;
  if (!pendingMovementMappings.length) {
    panel.hidden = false;
    panel.innerHTML = `<div class="movement-mapping-empty">
      <strong>Diccionario activo: ${dictionaryCount} relación(es)</strong>
      <p>Cuando un movimiento no coincida con ninguna partida del Cuadro de mandos, aparecerá aquí para asignarlo.</p>
    </div>`;
    return;
  }
  panel.hidden = false;
  panel.innerHTML = `<div class="movement-mapping-head">
      <div>
        <strong>${pendingMovementMappings.length} movimiento(s) por relacionar</strong>
        <p>El signo del importe ya separa ingresos y gastos. Elige la partida del Cuadro de mandos y guardaremos la relación para próximos ficheros.</p>
      </div>
      <button id="applyMovementMappings" type="button">Guardar relaciones</button>
    </div>
    <div class="table-wrap movement-mapping-table-wrap">
      <table class="movement-mapping-table">
        <thead><tr><th>Tipo</th><th>Movimiento del banco</th><th>Total detectado</th><th>Asignar a partida</th></tr></thead>
        <tbody>
          ${pendingMovementMappings
            .map(
              (item) => `<tr>
                <td>${item.kind === "income" ? "Ingreso" : "Gasto"}</td>
                <td><strong>${escapeHtml(item.label)}</strong><small>${item.count} mov.; ejemplo ${escapeHtml(formatIsoDate(item.examples[0]?.date))}</small></td>
                <td>${money(item.total, true)}</td>
                <td><select data-movement-map-key="${escapeHtml(item.key)}" data-movement-map-kind="${escapeHtml(item.kind)}">${movementMappingOptions(item.kind)}</select></td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
  qs("applyMovementMappings")?.addEventListener("click", applyPendingMovementMappings);
}

function applyPendingMovementMappings() {
  let changed = 0;
  document.querySelectorAll("[data-movement-map-key]").forEach((select) => {
    if (!select.value) return;
    movementMappings[select.dataset.movementMapKey] = {
      kind: select.dataset.movementMapKind,
      rowKey: select.value,
      label: select.options[select.selectedIndex]?.textContent || "",
      updatedAt: new Date().toISOString(),
    };
    changed += 1;
  });
  if (!changed) {
    qs("movementImportStatus").innerHTML = `<strong>No se guardó ninguna relación</strong><p>Selecciona una partida antes de guardar.</p>`;
    return;
  }
  saveMovementMappings();
  const applied = applyMovementMappingsToActuals();
  pendingMovementMappings = buildPendingMovementMappings(baseData.transactions || []);
  saveIncomeActuals();
  saveExpenseActuals();
  refreshAllSectionsAfterDataChange();
  qs("movementImportStatus").innerHTML = `<strong>${changed} relación(es) guardada(s)</strong><p>${applied} importe(s) reales recalculados desde movimientos. ${fullRefreshMessage()}</p>`;
}

function applyMovementMappingsToActuals() {
  const monthlyTotals = {
    income: new Map(),
    expense: new Map(),
  };
  (baseData.transactions || []).forEach((transaction) => {
    const mapping = mappingForMovement(transaction);
    if (!mapping) return;
    const month = monthByKey(transaction.month, baseData.monthlyPlanning?.months || []);
    if (!month) return;
    const key = actualKeyForRow(mapping.row, month);
    const amount = mapping.kind === "income" ? Number(transaction.amount || 0) : Math.abs(Number(transaction.amount || 0));
    monthlyTotals[mapping.kind].set(key, round2((monthlyTotals[mapping.kind].get(key) || 0) + amount));
  });
  let applied = 0;
  monthlyTotals.income.forEach((value, key) => {
    incomeActuals[key] = value;
    applied += 1;
  });
  monthlyTotals.expense.forEach((value, key) => {
    expenseActuals[key] = value;
    applied += 1;
  });
  return applied;
}

function transactionIdentity(row) {
  return [
    row.date || "",
    row.valueDate || "",
    normalizedText(row.movement || ""),
    normalizedText(row.details || ""),
    round2(row.amount || 0),
    row.balance === null || row.balance === undefined ? "" : round2(row.balance),
  ].join("|");
}

function mergeTransactions(existing, imported) {
  const map = new Map();
  [...(existing || []), ...(imported || [])].forEach((row) => {
    if (!row?.date || !row?.movement) return;
    map.set(transactionIdentity(row), row);
  });
  return [...map.values()].sort((a, b) =>
    `${a.date}|${String(a.statementOrder || "").padStart(5, "0")}|${a.movement}`.localeCompare(
      `${b.date}|${String(b.statementOrder || "").padStart(5, "0")}|${b.movement}`,
    ),
  );
}

function latestStatementBalance(transactions) {
  return (transactions || [])
    .filter((row) => row.balance !== null && row.balance !== undefined && row.date)
    .sort((a, b) => {
      const dateCompare = String(b.date).localeCompare(String(a.date));
      if (dateCompare) return dateCompare;
      return Number(a.statementOrder || 0) - Number(b.statementOrder || 0);
    })[0];
}

function applyMovementBalance(transaction) {
  if (!transaction || transaction.balance === null || transaction.balance === undefined) return null;
  const current = accountBalancesFromState();
  qs("balanceMode").value = "manual";
  qs("balanceDate").value = transaction.date;
  state.balanceMode = "manual";
  state.balanceDate = transaction.date;
  setStateAccountBalances({
    caixa: Number(transaction.balance || 0),
    mediolanum: current.mediolanum,
  });
  saveBalanceSettings();
  return accountBalancesFromState();
}

function refreshMovementRollups() {
  variableOperationalSpendCacheKey = "";
  variableOperationalSpendCache = null;
  const rollups = buildRollupsFromTransactions(baseData.transactions || []);
  baseData = {
    ...baseData,
    metadata: {
      ...baseData.metadata,
      generatedAt: new Date().toISOString(),
      sourceWorkbookStatus: "Leído desde la app",
    },
    categoryMonthly: rollups.categoryMonthly,
    topMerchants: rollups.topMerchants,
    derived: {
      ...(baseData.derived || {}),
      historicalCoreSpend: rollups.historicalCoreSpend,
      historicalIncome: rollups.historicalIncome,
      coreMonthlyAverageJanMar2026: rollups.historicalCoreSpend,
      incomeMonthlyAverageJanMar2026: rollups.historicalIncome,
    },
  };
  ensureVariableOperationalSection();
}

async function handleMovementExcelImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!window.XLSX || typeof window.XLSX.read !== "function") {
    qs("movementImportStatus").innerHTML = `<strong>No se pudo leer Excel</strong><p>La librería de lectura de Excel no está disponible todavía.</p>`;
    return;
  }
  try {
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
    const imported = loadTransactionsFromWorkbook(workbook);
    if (!imported.length) {
      qs("movementImportStatus").innerHTML = `<strong>Sin movimientos detectados</strong><p>El fichero debe incluir una hoja Movimientos_cuenta con Fecha, Movimiento, Importe y Saldo.</p>`;
      return;
    }
    baseData.transactions = mergeTransactions(baseData.transactions || [], imported);
    refreshMovementRollups();
    const latest = latestStatementBalance(imported);
    const balances = applyMovementBalance(latest);
    const appliedActuals = applyMovementMappingsToActuals();
    pendingMovementMappings = buildPendingMovementMappings(imported);
    saveWorkbookOverride();
    saveIncomeActuals();
    saveExpenseActuals();
    saveLocalSnapshot();
    queueRemoteSave();
    refreshAllSectionsAfterDataChange();
    const balanceText = balances
      ? `Saldo CaixaBank actualizado a ${money(balances.caixa, true)} con fecha ${formatIsoDate(latest.date)}.`
      : "No se encontró saldo final utilizable en el fichero.";
    qs("movementImportStatus").innerHTML = `<strong>${imported.length} movimiento(s) importado(s)</strong><p>${balanceText} ${appliedActuals} real(es) aplicados. ${pendingMovementMappings.length} relación(es) pendiente(s).</p>`;
    renderMovementImportReview();
  } catch (error) {
    qs("movementImportStatus").innerHTML = `<strong>No se pudo importar el extracto</strong><p>${escapeHtml(error.message || "Revisa el formato del Excel.")}</p>`;
  } finally {
    event.target.value = "";
  }
}

function formatIsoDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return day && month && year ? `${day}/${month}/${year}` : String(value);
}

function populateMovementFilters(transactions) {
  const monthSelect = qs("movementMonthFilter");
  if (!monthSelect) return;
  const previous = monthSelect.value;
  const months = [...new Set(transactions.map((row) => row.month).filter(Boolean))].sort().reverse();
  monthSelect.innerHTML = `<option value="">Todos los meses</option>${months
    .map((month) => `<option value="${month}">${escapeHtml(monthLabel(dateFromMonthKey(month)))}</option>`)
    .join("")}`;
  if ([...monthSelect.options].some((option) => option.value === previous)) monthSelect.value = previous;
}

function renderDetailedMovements() {
  const rowsElement = qs("movementRows");
  if (!rowsElement) return;
  const transactions = (baseData.transactions || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  populateMovementFilters(transactions);
  const monthFilter = qs("movementMonthFilter")?.value || "";
  const search = normalizedText(qs("movementSearch")?.value || "");
  const filtered = transactions.filter((row) => {
    if (monthFilter && row.month !== monthFilter) return false;
    if (!search) return true;
    return normalizedText(`${row.date} ${row.movement} ${row.details} ${row.category} ${row.source}`).includes(search);
  });
  qs("movementCount").textContent = `${filtered.length} movimiento(s) reales${monthFilter ? ` en ${monthLabel(dateFromMonthKey(monthFilter))}` : ""}.`;
  rowsElement.innerHTML = filtered
    .map(
      (row) => `<tr>
        <td>${formatIsoDate(row.date)}</td>
        <td>${formatIsoDate(row.valueDate)}</td>
        <td>${escapeHtml(row.movement)}</td>
        <td>${escapeHtml(row.details)}</td>
        <td>${escapeHtml(row.category)}</td>
        <td class="${row.amount < 0 ? "negative" : "positive"}">${money(row.amount, true)}</td>
        <td>${row.balance === null || row.balance === undefined ? "" : money(row.balance, true)}</td>
        <td>${escapeHtml(row.source || "")}</td>
      </tr>`,
    )
    .join("");
}

function renderPlanningDetails({
  kind,
  monthSelectId,
  summaryId,
  rowsId,
  actuals,
  actualDataKey,
  saveActuals,
  renderAgain,
}) {
  const planning = baseData.monthlyPlanning;
  if (!planning?.months?.length) return;
  const monthIndex = Number(qs(monthSelectId).value || 0);
  const month = { ...planning.months[monthIndex], index: monthIndex };
  let totalPlanned = 0;
  let capturedActual = 0;
  let capturedPlanned = 0;
  let capturedRows = 0;
  const html = [];

  planningSectionsForMonth(kind, month)
    .forEach((section, sectionIndex) => {
      const sectionKey = `${kind}:${section.name}`;
      const expanded = expandedPlanningSections[kind].has(sectionKey);
      let sectionActual = 0;
      let sectionCapturedPlanned = 0;
      let sectionCapturedRows = 0;
      const sectionPlanned = section.rows.reduce((sum, row) => {
        const info = actualAwareInfo(row, month);
        const planned = info.planned;
        if (info.hasActual) {
          sectionCapturedRows += 1;
          sectionActual += Number(info.actual || 0);
          sectionCapturedPlanned += planned;
        }
        return sum + planned;
      }, 0);
      totalPlanned += sectionPlanned;
      capturedRows += sectionCapturedRows;
      capturedActual += sectionActual;
      capturedPlanned += sectionCapturedPlanned;
      const sectionVariance = sectionCapturedRows ? sectionActual - sectionCapturedPlanned : "";
      const sectionVarianceClass = varianceClassForKind(kind, sectionVariance);
      html.push(
        `<tr class="section-row planning-section-row ${expanded ? "expanded" : ""}">
          <td colspan="2">
            <button class="planning-section-button" data-planning-section="${escapeHtml(sectionKey)}" aria-expanded="${expanded ? "true" : "false"}">
              <span class="planning-toggle">${expanded ? "-" : "+"}</span>${escapeHtml(section.name)} <small>${section.rows.length} líneas</small>
            </button>
          </td>
          <td>${money(sectionPlanned, true)}</td>
          <td>${sectionCapturedRows ? money(sectionActual, true) : ""}</td>
          <td class="${sectionVarianceClass}">${sectionCapturedRows ? money(sectionVariance, true) : ""}</td>
          <td></td>
        </tr>`,
      );

      if (!expanded) return;

      section.rows.forEach((row) => {
        const info = actualAwareInfo(row, month);
        const planned = info.planned;
        const key = actualKeyForRow(row, month);
        const deleteKey = deleteKeyForRow(row, month);
        const actual = info.hasActual ? Number(info.actual || 0) : "";
        const variance = info.hasActual ? Number(actual) - planned : "";
        const varianceClass = varianceClassForKind(kind, variance);
        html.push(`<tr class="planning-line-row ${row.custom ? "custom-line" : ""}" data-parent-section="${escapeHtml(sectionKey)}">
          <td>${escapeHtml(section.name)}</td>
          <td>${escapeHtml(displayLabelForRow(row))}${row.custom ? " <small>nuevo</small>" : ""}</td>
          <td>${money(planned, true)}</td>
          <td><input ${actualDataKey}="${key}" type="number" step="0.01" value="${info.hasActual ? actual : ""}" placeholder="Real" /></td>
          <td class="${varianceClass}">${info.hasActual ? money(variance, true) : ""}</td>
          <td><button type="button" class="row-delete-button" data-delete-planning-row="${escapeHtml(deleteKey)}">Eliminar</button></td>
        </tr>`);
      });
    });

  const capturedVariance = capturedRows ? capturedActual - capturedPlanned : 0;
  const coverage = totalPlanned ? `${capturedRows} líneas` : "Sin datos";
  const summaryVarianceClass =
    kind === "income"
      ? capturedVariance >= 0
        ? "positive"
        : "negative"
      : capturedVariance > 0
        ? "negative"
        : "positive";
  qs(summaryId).innerHTML = [
    ["Previsto del mes", money(totalPlanned, true), ""],
    ["Real capturado", capturedRows ? money(capturedActual, true) : "Sin reales", ""],
    ["Desviación capturada", capturedRows ? money(capturedVariance, true) : "Pendiente", summaryVarianceClass],
    ["Cobertura", coverage, ""],
  ]
    .map(
      ([label, value, klass]) =>
        `<div class="expense-summary-card"><span>${label}</span><strong class="${klass}">${value}</strong></div>`,
    )
    .join("");
  qs(rowsId).innerHTML = html.join("");

  document.querySelectorAll(`#${rowsId} [data-planning-section]`).forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.planningSection;
      if (expandedPlanningSections[kind].has(key)) {
        expandedPlanningSections[kind].delete(key);
      } else {
        expandedPlanningSections[kind].add(key);
      }
      renderAgain();
    });
  });

  document.querySelectorAll(`[${actualDataKey}]`).forEach((input) => {
    input.addEventListener("change", () => {
      if (input.value === "") {
        delete actuals[input.getAttribute(actualDataKey)];
      } else {
        actuals[input.getAttribute(actualDataKey)] = Number(input.value);
      }
      saveActuals();
      renderAgain();
    });
  });

  document.querySelectorAll(`#${rowsId} [data-delete-planning-row]`).forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      deletePlanningRow(button.getAttribute("data-delete-planning-row"));
      renderAgain();
    });
  });
}

function selectedPlanningMonth() {
  const planning = baseData.monthlyPlanning;
  const monthIndex = Number(qs("detailMonth").value || 0);
  return { ...planning.months[monthIndex], index: monthIndex };
}

function populateCustomConceptForms() {
  ["income", "expense"].forEach((kind) => {
    const select = qs(`${kind}CustomSection`);
    if (!select) return;
    const previous = select.value;
    const options = baseData.monthlyPlanning.sections
      .filter((section) => section.kind === kind)
      .map((section) => `<option value="${escapeHtml(section.name)}">${escapeHtml(section.name)}</option>`)
      .join("");
    select.innerHTML = options;
    if ([...select.options].some((option) => option.value === previous)) {
      select.value = previous;
    }
  });
}

function populateDataEntryControls() {
  const monthSelect = qs("manualDataMonth");
  if (monthSelect) {
    const previous = monthSelect.value;
    const months = selectableMonths();
    const signature = months.map((month) => month.key).join("|");
    if (dataEntryMonthSignature !== signature) {
      monthSelect.innerHTML = months
        .map((month) => `<option value="${month.key}">${escapeHtml(month.label)}</option>`)
        .join("");
      dataEntryMonthSignature = signature;
    }
    if ([...monthSelect.options].some((option) => option.value === previous)) monthSelect.value = previous;
  }
  updateManualDataKindUi();
  populateSeriesEditor();
}

function updateManualDataKindUi() {
  const kind = qs("manualDataKind")?.value || "expense";
  const sectionSelect = qs("manualDataSection");
  if (sectionSelect) {
    const usesPlanningSection = kind === "income" || kind === "expense";
    sectionSelect.disabled = !usesPlanningSection;
    const sections = usesPlanningSection ? baseData.monthlyPlanning.sections.filter((section) => section.kind === kind) : [];
    sectionSelect.innerHTML = sections.length
      ? sections.map((section) => `<option value="${escapeHtml(section.name)}">${escapeHtml(section.name)}</option>`).join("")
      : '<option value="">No aplica</option>';
  }
  document.querySelectorAll(".manual-project-field").forEach((field) => {
    field.classList.toggle("is-hidden", kind !== "project" && kind !== "debt");
  });
  qs("manualDataPlanned")?.closest("label")?.classList.toggle("is-hidden", kind === "project" || kind === "debt");
}

function availableSeriesRows(kind) {
  const seen = new Set();
  const rows = [];
  baseData.monthlyPlanning.sections
    .filter((section) => section.kind === kind)
    .forEach((section) => {
      section.rows.forEach((row) => {
        if (isPlanningRowSeriesDeleted(row, section.name)) return;
        const key = seriesKeyForRow(row);
        if (seen.has(key)) return;
        seen.add(key);
        rows.push({ ...row, sectionName: section.name });
      });
    });
  customPlanningRows
    .filter((row) => row.kind === kind)
    .forEach((row) => {
      if (isPlanningRowSeriesDeleted(row, row.sectionName)) return;
      const key = seriesKeyForRow(row);
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(row);
    });
  return rows.sort((a, b) =>
    `${a.sectionName} ${displayLabelForRow(a)}`.localeCompare(`${b.sectionName} ${displayLabelForRow(b)}`, "es"),
  );
}

function selectedSeriesRow() {
  const kind = qs("seriesKind")?.value || "income";
  const key = qs("seriesRow")?.value || "";
  return availableSeriesRows(kind).find((row) => seriesKeyForRow(row) === key) || null;
}

function populateSeriesEditor() {
  const kindSelect = qs("seriesKind");
  const rowSelect = qs("seriesRow");
  const startSelect = qs("seriesStartMonth");
  const endSelect = qs("seriesEndMonth");
  if (!kindSelect || !rowSelect || !startSelect || !endSelect) return;

  const previousRow = rowSelect.value;
  const rows = availableSeriesRows(kindSelect.value);
  const months = selectableMonths();
  const signature = `${kindSelect.value}:${rows.map((row) => `${seriesKeyForRow(row)}:${displayLabelForRow(row)}:${row.sectionName}`).join("|")}::${months.map((month) => month.key).join("|")}`;
  if (seriesEditorSignature !== signature) {
    rowSelect.innerHTML = rows
      .map((row) => `<option value="${escapeHtml(seriesKeyForRow(row))}">${escapeHtml(row.sectionName)} · ${escapeHtml(displayLabelForRow(row))}</option>`)
      .join("");
    [startSelect, endSelect].forEach((select) => {
      const previous = select.value;
      select.innerHTML = months
        .map((month) => `<option value="${month.key}">${escapeHtml(month.label)}</option>`)
        .join("");
      if ([...select.options].some((option) => option.value === previous)) select.value = previous;
    });
    seriesEditorSignature = signature;
  }
  if ([...rowSelect.options].some((option) => option.value === previousRow)) rowSelect.value = previousRow;
  if (!endSelect.value) endSelect.value = selectableMonths().at(-1)?.key || "";
  updateSeriesPreview();
}

function monthByKey(key, months = selectableMonths()) {
  return months.find((item) => item.key === key) || null;
}

function monthsInRange(startKey, endKey, sourceMonths = selectableMonths()) {
  const months = sourceMonths;
  if (!months.length) return [];
  const startIndex = Math.max(0, months.findIndex((month) => month.key === startKey));
  const endIndexRaw = months.findIndex((month) => month.key === endKey);
  const endIndex = endIndexRaw >= 0 ? endIndexRaw : months.length - 1;
  const from = Math.min(startIndex, endIndex);
  const to = Math.max(startIndex, endIndex);
  return months.slice(from, to + 1).map((month, offset) => ({
    ...month,
    index: Number.isFinite(Number(month.index)) ? Number(month.index) : from + offset,
  }));
}

function updateSeriesPreview() {
  const preview = qs("seriesPreview");
  if (!preview) return;
  const row = selectedSeriesRow();
  if (!row) {
    preview.textContent = "Selecciona una serie para ver el alcance del cambio.";
    return;
  }
  const months = monthsInRange(qs("seriesStartMonth").value, qs("seriesEndMonth").value);
  const first = months[0];
  const last = months.at(-1);
  const current = first ? actualAwareInfo(row, first) : null;
  preview.innerHTML = `<strong>${escapeHtml(displayLabelForRow(row))}</strong> en ${escapeHtml(row.sectionName)}. Rango: ${escapeHtml(first?.label || "")} - ${escapeHtml(last?.label || "")} (${months.length} meses). Importe actual de inicio: ${current ? money(current.value, true) : "sin dato"}.`;
}

function applySeriesChange() {
  const row = selectedSeriesRow();
  if (!row) {
    showImportLog("No hay serie seleccionada", "Elige un concepto antes de aplicar cambios.", "danger");
    return;
  }
  const action = qs("seriesAction").value;
  const planned = parseAmount(qs("seriesPlannedAmount").value);
  const actual = parseAmount(qs("seriesActualAmount").value);
  const months = monthsInRange(qs("seriesStartMonth").value, qs("seriesEndMonth").value);
  let changed = 0;

  months.forEach((month) => {
    const key = overrideKeyForRow(row, month);
    if (action === "clear") {
      if (seriesOverrides[key]) {
        delete seriesOverrides[key];
        changed += 1;
      }
      return;
    }
    if (action === "delete") {
      seriesOverrides[key] = { deleted: true };
      changed += 1;
      return;
    }
    const next = { ...(seriesOverrides[key] || {}) };
    delete next.deleted;
    if (planned !== null) next.planned = planned;
    if (actual !== null) next.actual = actual;
    if (planned !== null || actual !== null) {
      seriesOverrides[key] = next;
      changed += 1;
    }
  });

  if (!changed) {
    showImportLog("Sin cambios aplicados", "Introduce un nuevo importe o elige eliminar/quitar ajustes.", "warning");
    return;
  }
  saveSeriesOverrides();
  refreshAllSectionsAfterDataChange();
  showImportLog(
    `Serie actualizada: ${displayLabelForRow(row)}`,
    `${changed} mes(es) modificados. ${fullRefreshMessage()}`,
  );
}

function showImportLog(title, body, tone = "") {
  const log = qs("dataImportLog");
  if (!log) return;
  log.classList.toggle("warning", tone === "warning");
  log.classList.toggle("danger", tone === "danger");
  log.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p>`;
}

function fullRefreshMessage() {
  return "Cuadro de mandos, control de deuda, previsión, simulador, proyección, plan ahorro, flujo mensual y movimientos quedan recalculados.";
}

function refreshAllSectionsAfterDataChange() {
  updateSourceNote();
  selectorSignature = "";
  visualMonthSelectorSignature = "";
  visualAddSectionSignature = "";
  visualBulkEditorSignature = "";
  dataEntryMonthSignature = "";
  seriesEditorSignature = "";
  simulationSignature = "";
  render();
  if (viewFromHash() === "data-entry") populateDataEntryControls();
}

function findPlanningRow(kind, sectionName, label, month) {
  const targetSection = normalizedText(sectionName);
  const targetLabel = normalizedText(label);
  const sections = planningSectionsForMonth(kind, month);
  for (const section of sections) {
    if (normalizedText(section.name) !== targetSection) continue;
    const row = section.rows.find((item) => normalizedText(displayLabelForRow(item)) === targetLabel);
    if (row) return row;
  }
  return null;
}

function upsertPlanningRecord(record) {
  const kind = normalizeDataKind(record.kind);
  const month = monthFromInput(record.month);
  const label = String(record.label || "").trim();
  if (!month) return { ok: false, reason: `Mes no reconocido: ${record.month || ""}` };
  if (!label) return { ok: false, reason: "Concepto vacío" };

  const fallbackSection = kind === "income" ? "INGRESOS" : "GASTOS FIJOS";
  const sectionName = String(record.sectionName || fallbackSection).trim() || fallbackSection;
  const planned = parseAmount(record.planned);
  const actual = parseAmount(record.actual);
  let row = findPlanningRow(kind, sectionName, label, month);

  if (!row) {
    row = {
      id: `custom-${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      custom: true,
      kind,
      sectionName,
      label,
      monthKey: month.key,
      plannedValue: planned ?? 0,
    };
    customPlanningRows.push(row);
  } else if (row.custom && planned !== null) {
    const stored = customPlanningRows.find((item) => item.id === row.id && item.monthKey === month.key);
    if (stored) stored.plannedValue = planned;
  }

  if (actual !== null) {
    const actuals = actualsForKind(kind);
    actuals[actualKeyForRow(row, month)] = actual;
  }
  expandedPlanningSections[kind].add(`${kind}:${sectionName}`);
  return { ok: true, kind, label, month: month.label };
}

function upsertProjectRecord(record) {
  const month = monthFromInput(record.month) || selectableMonths()[0];
  const label = String(record.label || record.concept || "").trim();
  const amount = parseAmount(record.actual ?? record.planned);
  if (!label) return { ok: false, reason: "Proyecto sin nombre" };
  if (!amount || amount <= 0) return { ok: false, reason: `Proyecto sin importe: ${label}` };
  const duration = Math.max(1, Number(record.duration || 1));
  const mode = normalizeProjectMode(record.mode || "fixed");
  const monthIndex = forecastMonths().findIndex((item) => item.key === month.key);
  projects.push({
    id: `project-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: label,
    amount,
    duration,
    mode,
    monthIndex: Math.max(0, monthIndex),
    monthKey: month.key,
  });
  return { ok: true, kind: "project", label, month: month.label };
}

function upsertDebtRecord(record) {
  const month = monthFromInput(record.month) || selectableMonths()[0];
  const label = String(record.label || record.concept || "").trim() || "Liquidación deuda";
  const amount = parseAmount(record.actual ?? record.planned ?? record.amount);
  if (!amount || amount <= 0) return { ok: false, reason: `Liquidación sin importe: ${label}` };
  const duration = Math.max(1, Number(record.duration || 1));
  const payoffMode = normalizeDebtPayoffMode(record.mode || "fixed", duration);
  const monthIndex = forecastMonths().findIndex((item) => item.key === month.key);
  debtLiquidations.push({
    id: `debt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: label,
    amount: round2(amount),
    duration,
    mode: "fixed",
    payoffMode,
    monthIndex: Math.max(0, monthIndex),
    monthKey: month.key,
  });
  return { ok: true, kind: "debt", label, month: month.label };
}

function processDataRecords(records, sourceLabel = "datos") {
  let imported = 0;
  let projectRows = 0;
  let debtRows = 0;
  let planningRows = 0;
  const warnings = [];
  records.forEach((record, index) => {
    const kind = normalizeDataKind(record.kind);
    const result =
      kind === "project"
        ? upsertProjectRecord(record)
        : kind === "debt"
          ? upsertDebtRecord(record)
          : upsertPlanningRecord({ ...record, kind });
    if (result.ok) {
      imported += 1;
      if (result.kind === "project") projectRows += 1;
      else if (result.kind === "debt") debtRows += 1;
      else planningRows += 1;
    } else warnings.push(`Línea ${index + 1}: ${result.reason}`);
  });

  saveCustomPlanningRows();
  saveIncomeActuals();
  saveExpenseActuals();
  saveProjects();
  saveDebtLiquidations();
  refreshAllSectionsAfterDataChange();

  const warningText = warnings.length ? ` Avisos: ${warnings.slice(0, 4).join(" · ")}${warnings.length > 4 ? "..." : ""}` : "";
  showImportLog(
    `${imported} registro(s) importado(s)`,
    `Origen: ${sourceLabel}. ${planningRows} concepto(s), ${projectRows} proyecto(s) y ${debtRows} liquidación(es) de deuda procesados. ${fullRefreshMessage()}${warningText}`,
    warnings.length ? "warning" : "",
  );
}

function handleManualData() {
  const kind = qs("manualDataKind").value;
  const record = {
    kind,
    month: qs("manualDataMonth").value,
    sectionName: qs("manualDataSection").value,
    label: qs("manualDataLabel").value,
    planned: qs("manualDataPlanned").value,
    actual: qs("manualDataActual").value,
    duration: qs("manualProjectDuration").value,
    mode: qs("manualProjectMode").value,
  };
  processDataRecords([record], "entrada manual");
  qs("manualDataLabel").value = "";
  qs("manualDataPlanned").value = "";
  qs("manualDataActual").value = "";
}

function splitDataLine(line) {
  const delimiters = ["\t", ";", ","];
  const delimiter = delimiters
    .map((item) => ({ item, count: line.split(item).length }))
    .sort((a, b) => b.count - a.count)[0].item;
  return line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

function parseTabularText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitDataLine(lines[0]).map(canonicalHeader);
  return lines.slice(1).map((line) => {
    const cells = splitDataLine(line);
    return headers.reduce((record, header, index) => {
      record[header] = cells[index] ?? "";
      return record;
    }, {});
  });
}

function handleBatchImport() {
  const records = parseTabularText(qs("batchDataInput").value);
  if (!records.length) {
    showImportLog("No hay datos importables", "Pega una tabla con cabeceras y al menos una línea.", "danger");
    return;
  }
  processDataRecords(records, "lote pegado");
}

function applyImportedWorkbookData(nextData, fileName) {
  baseData = nextData;
  ensureCompleteFinancingSection();
  ensureVariableOperationalSection();
  balanceSettings = {};
  scenarioSettings = {};
  currentScenario = "Base";
  selectedCashflowIndex = null;
  expandedCashflowYears = new Set();
  expandedPlanningSections = {
    income: new Set(),
    expense: new Set(),
  };
  saveWorkbookOverride();
  writeControls({ ...baseData.assumptions, autoCapSavings: true });
  updateSourceNote();
  qs("scenarioName").textContent = currentScenario;
  saveLocalSnapshot();
  queueRemoteSave();
  refreshAllSectionsAfterDataChange();

  const monthCount = baseData.monthlyPlanning?.months?.length || 0;
  const sectionCount = baseData.monthlyPlanning?.sections?.length || 0;
  const transactionCount = baseData.transactions?.length || 0;
  showImportLog(
    "Libro Excel cargado completo",
    `${fileName}: ${monthCount} meses, ${sectionCount} bloques de planificación y ${transactionCount} movimientos incorporados al modelo. ${fullRefreshMessage()}`,
    "success",
  );
}

async function handleExcelImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (qs("excelFileName")) qs("excelFileName").textContent = file.name;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".csv") || lowerName.endsWith(".txt")) {
    const records = parseTabularText(await file.text());
    if (!records.length) {
      showImportLog("Fichero vacío", "No se han encontrado filas importables.", "danger");
      return;
    }
    processDataRecords(records, file.name);
    event.target.value = "";
    return;
  }
  if (!window.XLSX || typeof window.XLSX.read !== "function") {
    showImportLog("No se pudo leer Excel", "La librería de lectura de Excel no está disponible todavía.", "danger");
    return;
  }
  const buffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(buffer, { type: "array" });
  try {
    applyImportedWorkbookData(buildFinanceDataFromWorkbook(workbook, file.name), file.name);
  } catch (error) {
    showImportLog(
      "No se pudo cargar el libro completo",
      `${error.message}. Comprueba que el Excel mantiene las pestañas Plan_Ahorro_821, Contabilidad New Life, Importe devolucion recibos y Movimientos_cuenta.`,
      "danger",
    );
  }
  event.target.value = "";
}

function handleAddCustomConcept(kind) {
  const month = selectedPlanningMonth();
  const sectionName = qs(`${kind}CustomSection`).value;
  const labelInput = qs(`${kind}CustomLabel`);
  const plannedInput = qs(`${kind}CustomPlanned`);
  const actualInput = qs(`${kind}CustomActual`);
  const label = labelInput.value.trim();
  if (!label) {
    labelInput.focus();
    return;
  }

  const row = {
    id: `custom-${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    custom: true,
    kind,
    sectionName,
    label,
    monthKey: month.key,
    plannedValue: Number(plannedInput.value || 0),
  };
  customPlanningRows.push(row);
  saveCustomPlanningRows();

  if (actualInput.value !== "") {
    const actuals = actualsForKind(kind);
    actuals[actualKeyForRow(row, month)] = Number(actualInput.value);
    saveActualsForKind(kind)();
  }

  expandedPlanningSections[kind].add(`${kind}:${sectionName}`);
  labelInput.value = "";
  plannedInput.value = "";
  actualInput.value = "";
  render();
}

function deletePlanningRow(rawKey) {
  const [kind, rowId, monthKeyValue] = rawKey.split("|");
  const actuals = actualsForKind(kind);
  delete actuals[`${rowId}|${monthKeyValue}`];
  saveActualsForKind(kind)();

  const beforeCount = customPlanningRows.length;
  customPlanningRows = customPlanningRows.filter(
    (row) => !(row.kind === kind && row.id === rowId && row.monthKey === monthKeyValue),
  );
  if (customPlanningRows.length !== beforeCount) {
    saveCustomPlanningRows();
    return;
  }

  deletedPlanningRows[rawKey] = true;
  saveDeletedPlanningRows();
}

function renderMonthlySummary() {
  const planning = baseData.monthlyPlanning;
  if (!planning?.months?.length) return;
  const monthIndex = Number(qs("detailMonth").value || 0);
  const month = { ...planning.months[monthIndex], index: monthIndex };
  const totals = {
    income: 0,
    expense: 0,
    actualRows: 0,
  };

  planningSectionsForMonth(null, month).forEach((section) => {
    section.rows.forEach((row) => {
      const info = actualAwareInfo(row, { ...month, index: monthIndex });
      if (section.kind === "income") totals.income += info.value;
      if (section.kind === "expense") totals.expense += info.value;
      if (info.hasActual) totals.actualRows += 1;
    });
  });

  const net = totals.income - totals.expense;
  qs("monthlySummary").innerHTML = [
    ["Ingresos del mes", money(totals.income, true), "positive"],
    ["Gastos del mes", money(totals.expense, true), "negative"],
    ["Neto antes de ahorrar", money(net, true), net >= 0 ? "positive" : "negative"],
    ["Reales capturados", `${totals.actualRows} líneas`, ""],
  ]
    .map(
      ([label, value, klass]) =>
        `<div class="expense-summary-card"><span>${label}</span><strong class="${klass}">${value}</strong></div>`,
    )
    .join("");
}

function renderIncomeDetails() {
  renderPlanningDetails({
    kind: "income",
    monthSelectId: "detailMonth",
    summaryId: "incomeSummary",
    rowsId: "incomeDetailRows",
    actuals: incomeActuals,
    actualDataKey: "data-income-actual-key",
    saveActuals: saveIncomeActuals,
    renderAgain: render,
  });
}

function renderExpenseDetails() {
  renderPlanningDetails({
    kind: "expense",
    monthSelectId: "detailMonth",
    summaryId: "expenseSummary",
    rowsId: "expenseDetailRows",
    actuals: expenseActuals,
    actualDataKey: "data-expense-actual-key",
    saveActuals: saveExpenseActuals,
    renderAgain: render,
  });
}

function renderMonthlyDetails() {
  populateCustomConceptForms();
  renderMonthlySummary();
  renderIncomeDetails();
  renderExpenseDetails();
}

function populateSelectors(force = false) {
  const forecast = forecastMonths();
  const openForecast = openForecastMonths(forecast);
  const planning = baseData.monthlyPlanning;
  const openPlanningMonths = planning.months
    .map((month, index) => ({ ...month, index }))
    .filter((month) => !isClosedMonthKey(month.key));
  const signature = `${openForecast.map((month) => month.key).join("|")}::${openPlanningMonths.map((month) => month.key).join("|")}`;
  if (!force && selectorSignature === signature) return;
  selectorSignature = signature;
  const previousProjectMonth = qs("projectMonth")?.value;
  const previousDebtMonth = qs("debtPayoffMonth")?.value;
  const previousDetailMonth = qs("detailMonth")?.value;
  const projectOptions = openForecast
    .map((month) => `<option value="${month.index}">${month.label}</option>`)
    .join("");
  qs("projectMonth").innerHTML = projectOptions;
  if ([...qs("projectMonth").options].some((option) => option.value === previousProjectMonth)) {
    qs("projectMonth").value = previousProjectMonth;
  }
  if (qs("debtPayoffMonth")) {
    qs("debtPayoffMonth").innerHTML = projectOptions;
    if ([...qs("debtPayoffMonth").options].some((option) => option.value === previousDebtMonth)) {
      qs("debtPayoffMonth").value = previousDebtMonth;
    }
  }

  const planningOptions = openPlanningMonths
    .map((month) => `<option value="${month.index}">${month.label}</option>`)
    .join("");
  qs("detailMonth").innerHTML = planningOptions;
  const forecastStartKey = openForecast[0]?.key || forecast[0]?.key || baseData.metadata.forecastStart.slice(0, 7);
  const defaultPlanningIndex = Math.max(
    0,
    planning.months.findIndex((month) => month.key === forecastStartKey),
  );
  qs("detailMonth").value = [...qs("detailMonth").options].some((option) => option.value === previousDetailMonth)
    ? previousDetailMonth
    : defaultPlanningIndex;
}

function csvValue(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv() {
  const header = [
    "Mes",
    "Inicio liquidez",
    "Ingresos",
    "Gasto detalle",
    "Coche detalle",
    "Financiacion detalle",
    "Proyectos",
    "Ahorro sin proyectos",
    "Ahorro con proyectos",
    "Cuenta sin proyectos",
    "Cuenta con proyectos",
    "Liquidez sin proyectos",
    "Liquidez con proyectos",
    "Impacto liquidez",
  ];
  const lines = openSimulationItems(lastSimulation, lastBaseSimulation).map(({ row, base }) => {
    return [
      row.month,
      row.startLiquidity,
      row.income,
      row.coreSpend,
      row.car,
      row.refi,
      row.projectOutflow,
      base.saving,
      row.saving,
      base.checking,
      row.checking,
      base.totalLiquidity,
      row.totalLiquidity,
      row.totalLiquidity - base.totalLiquidity,
    ].map(csvValue).join(";");
  });
  const csvContent = `\uFEFF${[header.map(csvValue).join(";"), ...lines].join("\r\n")}`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "simulacion_financiera_hasta_2036.csv";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1000);
}

function homeRowsForHorizon() {
  const rows = openSimulationRows(lastSimulation);
  const value = qs("homeHorizon")?.value || "12";
  const count = value === "all" ? rows.length : Number(value || 12);
  return rows.slice(0, Math.max(1, Math.min(count, rows.length)));
}

function homeStatusClass(value, warnAt = 0, dangerAt = 0) {
  if (value <= dangerAt) return "danger";
  if (value <= warnAt) return "warn";
  return "good";
}

function renderHomeKpi({ label, value, note, status = "good", cta, target }) {
  return `<article class="home-kpi-card ${status}">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
    <p>${escapeHtml(note)}</p>
    ${cta ? `<button type="button" data-home-nav="${escapeHtml(target || "")}">${escapeHtml(cta)}</button>` : ""}
  </article>`;
}

function renderHomeInsight({ title, text, status = "good", target, cta }) {
  return `<div class="home-insight ${status}">
    <div>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(text)}</p>
    </div>
    ${cta ? `<button type="button" data-home-nav="${escapeHtml(target || "")}">${escapeHtml(cta)}</button>` : ""}
  </div>`;
}

function renderHomeAction({ title, value, detail, target, tone = "neutral" }) {
  return `<button type="button" class="home-action-card ${tone}" data-home-nav="${escapeHtml(target)}">
    <span>${escapeHtml(title)}</span>
    <strong>${escapeHtml(value)}</strong>
    <small>${escapeHtml(detail)}</small>
  </button>`;
}

function renderHomePriority({ title, meta, value, target, status = "neutral" }) {
  return `<button type="button" class="home-priority-item ${status}" data-home-nav="${escapeHtml(target)}">
    <span>${escapeHtml(title)}</span>
    <small>${escapeHtml(meta)}</small>
    <strong>${escapeHtml(value)}</strong>
  </button>`;
}

function renderHomeDashboard() {
  if (!qs("homeKpis")) return;
  const rows = homeRowsForHorizon();
  if (!rows.length) return;
  const baseRows = rows.map((row) => lastBaseSimulation[(row.index || 1) - 1] || row);
  const metrics = rangeKpiMetric(rows);
  const savings = savingsPlanCalculations();
  const debtStats = debtControlStats();
  const firstRow = rows[0];
  const lastRow = rows.at(-1);
  const baseLastRow = baseRows.at(-1) || lastRow;
  const decisionImpact = round2(Number(lastRow?.totalLiquidity || 0) - Number(baseLastRow?.totalLiquidity || 0));
  const avgNet = round2(averageRows(rows, (row) => row.netBeforeSaving));
  const avgSaving = round2(averageRows(rows, (row) => row.saving));
  const avgProjects = round2(averageRows(rows, (row) => row.projectOutflow));
  const totalProjects = round2(sumRows(rows, (row) => row.projectOutflow));
  const debtPriorities = debtPriorityCandidates().slice(0, 3);
  const loadedDecisions = projectPlan.placements || [];
  const nextSensitiveMonths = rows
    .map((row) => ({ row, metric: previsionMetric(row) }))
    .sort((a, b) => a.metric.adjustedMin - b.metric.adjustedMin)
    .slice(0, 6);
  const adjustedWarn = Math.max(0, savings.emergencyFundTarget * 0.35);
  const adjustedStatus = metrics ? homeStatusClass(metrics.adjustedMin, adjustedWarn, 0) : "warn";
  const debtRatioStatus = savings.debtToIncomeRatio > 0.32 ? "danger" : savings.debtToIncomeRatio > 0.26 ? "warn" : "good";
  const decisionStatus = decisionImpact < 0 ? "warn" : "good";
  const coverageStatus = savings.currentCoverage < 3 ? "danger" : savings.currentCoverage < 6 ? "warn" : "good";
  const runwayNote = metrics
    ? `Mínimo ajustado: ${money(metrics.adjustedMin, true)} en ${metrics.adjustedMinMonth} (${metrics.adjustedMinDate || "fecha estimada"}).`
    : "Sin rango suficiente para calcular mínimos.";
  const balanceDateText = state.balanceDate || defaultBalanceDate();

  qs("homeKpis").innerHTML = [
    renderHomeKpi({
      label: "Liquidez de partida",
      value: money(state.initialCash, true),
      note: `Saldo base a ${balanceDateText}. ${runwayNote}`,
      status: adjustedStatus,
      cta: "Ver previsión",
      target: "prevision",
    }),
    renderHomeKpi({
      label: "Margen medio antes de ahorrar",
      value: money(avgNet, true),
      note: `Ahorro aplicado medio: ${money(avgSaving, true)} al mes.`,
      status: avgNet > savings.recommendedSaving ? "good" : "warn",
      cta: "Ajustar ahorro",
      target: "savings-plan",
    }),
    renderHomeKpi({
      label: "Deuda viva",
      value: money(debtStats.portfolioTotals.currentPrincipal, true),
      note: `Pago actual estimado: ${money(debtStats.currentPayment.total, true)}/mes. Ratio ${(savings.debtToIncomeRatio * 100).toFixed(1)}%.`,
      status: debtRatioStatus,
      cta: "Simular deuda",
      target: "debt-control",
    }),
    renderHomeKpi({
      label: "Impacto de decisiones",
      value: `${decisionImpact >= 0 ? "+" : ""}${money(decisionImpact, true)}`,
      note: `${loadedDecisions.length} decisión(es), ${money(totalProjects, true)} de impacto en el horizonte visible.`,
      status: decisionStatus,
      cta: "Ver simulador",
      target: "simulator",
    }),
  ].join("");

  const mainInsights = [];
  if (metrics?.adjustedMin < 0) {
    mainInsights.push({
      title: "Prioridad: proteger caja",
      text: `Hay un mínimo ajustado negativo en ${metrics.adjustedMinMonth}. Antes de amortizar o añadir proyectos, mueve impactos o baja ahorro temporalmente.`,
      status: "danger",
      target: "simulator",
      cta: "Corregir",
    });
  } else if (savings.currentCoverage < savings.values.emergencyBufferMonths) {
    mainInsights.push({
      title: "Construir colchón antes de acelerar",
      text: `Cobertura actual ${savings.currentCoverage.toFixed(1)} meses frente a objetivo ${savings.values.emergencyBufferMonths}. Ahorro sugerido: ${money(savings.recommendedSaving, true)}/mes.`,
      status: coverageStatus,
      target: "savings-plan",
      cta: "Plan ahorro",
    });
  } else {
    mainInsights.push({
      title: "Escenario operativo estable",
      text: `La caja mínima ajustada se mantiene positiva y el margen medio permite planificar deuda o proyectos sin tensionar el flujo mensual.`,
      status: "good",
      target: "simulator",
      cta: "Planificar",
    });
  }
  if (debtPriorities[0]) {
    mainInsights.push({
      title: "Siguiente deuda a mirar",
      text: `${debtTargetDisplayName(debtPriorities[0].target)}: ${money(debtPriorities[0].principal, true)} pendientes, ${money(debtPriorities[0].payment, true)}/mes. Mejor hueco sugerido: ${debtPriorities[0].best?.month?.label || "por calcular"}.`,
      status: debtRatioStatus,
      target: "debt-control",
      cta: "Optimizar",
    });
  }
  if (avgProjects > 0) {
    mainInsights.push({
      title: "Proyectos ya influyen en el plan",
      text: `El impacto medio de proyectos/deuda simulada es ${money(avgProjects, true)}/mes en este horizonte. Compáralo con el escenario sin decisiones antes de confirmar.`,
      status: decisionImpact < 0 ? "warn" : "good",
      target: "prevision",
      cta: "Comparar",
    });
  }
  qs("homeInsights").innerHTML = mainInsights.map(renderHomeInsight).join("");

  const bestProjectMonth = rows
    .map((row) => ({ row, metric: previsionMetric(row) }))
    .sort((a, b) => b.metric.adjustedMin - a.metric.adjustedMin)[0];
  qs("homeActions").innerHTML = [
    renderHomeAction(
      {
        title: "Ahorro sugerido",
        value: money(savings.recommendedSaving, true),
        detail: `Potencial medio: ${money(savings.monthlySavingPotential, true)}/mes`,
        target: "savings-plan",
        tone: "good",
      },
    ),
    renderHomeAction({
      title: "Mejor mes para proyecto",
      value: bestProjectMonth?.row.month || "-",
      detail: `Mínimo ajustado estimado: ${money(bestProjectMonth?.metric.adjustedMin || 0, true)}`,
      target: "simulator",
      tone: "neutral",
    }),
    renderHomeAction({
      title: "Revisar movimientos",
      value: money(Number(firstRow?.startLiquidity || 0), true),
      detail: "Actualiza saldos reales y clasificación bancaria",
      target: "movements",
      tone: "neutral",
    }),
    renderHomeAction({
      title: "Editar cuadro",
      value: firstRow?.month || "Mes actual",
      detail: "Previstos, reales y nuevas líneas",
      target: "visual-detail",
      tone: "neutral",
    }),
  ].join("");

  const debtPriorityHtml = debtPriorities.map((item, index) =>
    renderHomePriority({
      title: `${index + 1}. ${debtTargetDisplayName(item.target)}`,
      meta: `Mejor hueco: ${item.best?.month?.label || "por calcular"} · cuota ${money(item.payment, true)}/mes`,
      value: money(item.principal, true),
      target: "debt-control",
      status: index === 0 ? "warn" : "neutral",
    }),
  );
  const decisionPriorityHtml = loadedDecisions.slice(0, 3).map((item) =>
    renderHomePriority({
      title: `${item.source === "debt" ? "Deuda" : "Proyecto"} · ${item.name || "Sin nombre"}`,
      meta: `${forecastMonths()[item.startIndex]?.label || "sin mes"} · ${item.duration || 1} mes(es)`,
      value: money(Number(item.amount || 0), true),
      target: item.source === "debt" ? "debt-control" : "simulator",
      status: "neutral",
    }),
  );
  qs("homePriorities").innerHTML =
    [...debtPriorityHtml, ...decisionPriorityHtml].join("") ||
    `<div class="empty-state compact">No hay decisiones pendientes: puedes crear un proyecto o simular una amortización.</div>`;

  qs("homeMonthTable").innerHTML = `<thead><tr>
      <th>Mes</th>
      <th>Margen</th>
      <th>Mín. ajustado</th>
      <th>Decisiones</th>
      <th>Lectura</th>
    </tr></thead>
    <tbody>
      ${nextSensitiveMonths
        .map(({ row, metric }) => {
          const status = homeStatusClass(metric.adjustedMin, adjustedWarn, 0);
          const label = status === "danger" ? "Caja crítica" : status === "warn" ? "Vigilar" : "Cómodo";
          return `<tr>
            <td>${escapeHtml(row.month)}</td>
            <td class="${row.netBeforeSaving < 0 ? "negative" : "positive"}">${money(row.netBeforeSaving, true)}</td>
            <td class="${status === "danger" ? "negative" : "positive"}">${money(metric.adjustedMin, true)}</td>
            <td>${money(row.projectOutflow, true)}</td>
            <td><span class="status-pill ${status}">${label}</span></td>
          </tr>`;
        })
        .join("")}
    </tbody>`;
}

function liquidationSettlementCost(item, discountPenalty = 0) {
  const discount = Math.max(0, Number(item.discount || 0) - discountPenalty);
  return round2(Number(item.principal || 0) * (1 - discount));
}

function liquidationGroupCost(wave, discountPenalty = 0) {
  return round2(
    sumRows(
      DEBT_LIQUIDATION_ASSUMPTIONS.settlements.filter((item) => item.wave === wave),
      (item) => liquidationSettlementCost(item, discountPenalty),
    ),
  );
}

function liquidationMonthDate(key) {
  const [year, month] = String(key).split("-").map(Number);
  return new Date(year, (month || 1) - 1, 1);
}

function liquidationShiftMonth(key, months) {
  return monthKey(addMonths(liquidationMonthDate(key), months));
}

function liquidationComparableMonth(row) {
  return row?.detailMonthKey || monthKey(addMonths(modelStartDate(), Number(row?.index || 1) - 1));
}

function liquidationPlanRows() {
  const openRows = openSimulationRows(lastSimulation);
  const rows = openRows.length ? openRows : lastSimulation;
  return rows.filter((row) => liquidationComparableMonth(row) >= "2026-07").slice(0, 24);
}

function liquidationFreeCapacity(row, key) {
  const modelFree = Math.max(0, Number(row.netBeforeSaving || 0));
  const defaultFree =
    key === "2026-07" ? 2167 :
    key === "2026-12" || key === "2027-12" ? 5963 :
    key === "2027-04" ? 9963 :
    key >= "2028-01" ? 3181 :
    2963;
  return round2(Math.max(modelFree, defaultFree));
}

function buildLiquidationScenario({ label, demandDelay = 0, demandAmount = DEBT_LIQUIDATION_ASSUMPTIONS.demandAmount, discountPenalty = 0 } = {}) {
  const assumptions = DEBT_LIQUIDATION_ASSUMPTIONS;
  const balances = accountBalancesFromState();
  const pendingImmediateCash = Math.max(0, round2(assumptions.baseStartingLiquidity - balances.total));
  const startingLiquidity = round2(balances.total + Math.min(pendingImmediateCash, 3450));
  const g1Cost = liquidationGroupCost("g1", discountPenalty);
  const g2Cost = liquidationGroupCost("g2", discountPenalty);
  const demandMonth = demandAmount > 0 ? liquidationShiftMonth(assumptions.demandMonth, demandDelay) : "";
  const rows = liquidationPlanRows();
  let fund = Math.max(0, round2(startingLiquidity - assumptions.targetReserve));
  let reserve = Math.min(startingLiquidity, assumptions.targetReserve);
  let g1Month = "";
  let g2Month = "";
  let g1Done = false;
  let g2Done = false;
  let minReserve = reserve;
  const timeline = [];

  rows.forEach((row) => {
    const key = liquidationComparableMonth(row);
    const free = liquidationFreeCapacity(row, key);
    const fundContribution = g2Done ? 0 : Math.min(assumptions.monthlyFundTarget, Math.max(0, free - assumptions.monthlyReserveTarget));
    const reserveContribution = Math.max(0, Math.min(assumptions.monthlyReserveTarget, free - fundContribution));
    fund = round2(fund + fundContribution);
    reserve = round2(reserve + reserveContribution);
    const events = [];

    if (key === demandMonth) {
      fund = round2(fund + demandAmount);
      events.push(`Demanda +${money(demandAmount)}`);
    }

    if (!g1Done && key >= "2026-11" && fund >= g1Cost) {
      fund = round2(fund - g1Cost);
      g1Done = true;
      g1Month = row.month;
      events.push(`Golpe 1 ${money(g1Cost)}`);
    }

    if (g1Done && !g2Done && fund >= g2Cost) {
      fund = round2(fund - g2Cost);
      g2Done = true;
      g2Month = row.month;
      reserve = round2(reserve + fund);
      fund = 0;
      events.push(`Golpe 2 ${money(g2Cost)}`);
    }

    if (g2Done && free > 0) {
      reserve = round2(reserve + Math.max(0, free - reserveContribution - fundContribution));
    }

    minReserve = Math.min(minReserve, reserve);
    timeline.push({
      key,
      month: row.month,
      income: row.income,
      outflows: Number(row.outflowsBeforeSaving || row.coreSpend + row.car + row.refi || 0),
      free,
      fundContribution,
      reserveContribution,
      fund,
      reserve,
      total: round2(fund + reserve),
      events,
    });
  });

  return {
    label,
    startingLiquidity,
    pendingImmediateCash,
    g1Cost,
    g2Cost,
    demandMonth,
    demandAmount,
    g1Month,
    g2Month,
    minReserve,
    finalReserve: reserve,
    finalLiquidity: round2(fund + reserve),
    timeline,
    complete: g1Done && g2Done,
  };
}

function renderLiquidationMetric({ label, value, note, tone = "" }) {
  return `<article class="debt-plan-kpi ${tone}">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
    <p>${escapeHtml(note)}</p>
  </article>`;
}

function renderDebtLiquidationPlan() {
  if (!qs("debtPlanKpis")) return;
  const assumptions = DEBT_LIQUIDATION_ASSUMPTIONS;
  const best = buildLiquidationScenario({ label: "Óptimo base" });
  const delayed = buildLiquidationScenario({ label: "Demanda +2 meses", demandDelay: 2 });
  const noDemand = buildLiquidationScenario({ label: "Sin demanda", demandAmount: 0 });
  const worseDiscounts = buildLiquidationScenario({ label: "Quitas 10 pp peores", discountPenalty: 0.1 });
  const scenarios = [best, delayed, noDemand, worseDiscounts];
  const asnefTotal = round2(sumRows(assumptions.asnef, (item) => item.amount));
  const wizinkPrincipal = round2(assumptions.wizink.principal * (1 - assumptions.wizink.discount));
  const wizinkMonthly = round2(wizinkPrincipal / assumptions.wizink.months);
  const cirbeReduction = round2(assumptions.cirbe.december2025.total - assumptions.cirbe.may2026.total);
  const consumerDebt = round2(best.g1Cost + best.g2Cost + wizinkPrincipal);

  qs("debtPlanKpis").innerHTML = [
    renderLiquidationMetric({
      label: "CIRBE declarado",
      value: money(assumptions.cirbe.may2026.total, true),
      note: `Baja ${money(cirbeReduction, true)} desde dic 2025; vencido ${money(assumptions.cirbe.may2026.overdue, true)}.`,
      tone: "good",
    }),
    renderLiquidationMetric({
      label: "ASNEF visible",
      value: money(asnefTotal, true),
      note: "Suma de la captura: CaixaBank, Bankinter y Wizink.",
      tone: "warn",
    }),
    renderLiquidationMetric({
      label: "Coste objetivo",
      value: money(consumerDebt, true),
      note: `Golpes + Wizink pactado. Quitas estimadas, no garantizadas.`,
      tone: "warn",
    }),
    renderLiquidationMetric({
      label: "Wizink pactado",
      value: `${money(wizinkMonthly, true)}/mes`,
      note: `30% quita, 96 meses, 0% interés. Capital pactado ${money(wizinkPrincipal, true)}.`,
      tone: "good",
    }),
  ].join("");

  qs("debtPlanBestRoute").innerHTML = `<div class="module-heading">
      <div>
        <p class="panel-kicker">Ruta recomendada</p>
        <h3>${best.complete ? "Liquidar consumo en dos golpes" : "Acumular antes de ejecutar"}</h3>
      </div>
      <span class="status-pill ${best.complete ? "good" : "warn"}">${best.complete ? "Viable" : "Vigilar"}</span>
    </div>
    <div class="debt-route-steps">
      <div><span>Ahora</span><strong>Separar fondo</strong><p>${money(Math.max(0, best.startingLiquidity - assumptions.targetReserve), true)} a liquidación y ${money(Math.min(best.startingLiquidity, assumptions.targetReserve), true)} de colchón.</p></div>
      <div><span>Golpe 1</span><strong>${best.g1Month || "Pendiente"}</strong><p>CaixaBank Payments, Carrefour, MediaMarkt e IKEA: ${money(best.g1Cost, true)} estimados.</p></div>
      <div><span>Demanda</span><strong>${best.demandMonth ? formatIsoDate(`${best.demandMonth}-01`) : "Sin ingreso"}</strong><p>Si entran ${money(best.demandAmount, true)}, 100% al fondo de liquidación.</p></div>
      <div><span>Golpe 2</span><strong>${best.g2Month || "Pendiente"}</strong><p>Bankinter completo: ${money(best.g2Cost, true)} estimados. Después, solo hipotecas + Wizink pactado.</p></div>
    </div>`;

  qs("debtPlanSources").innerHTML = `<div class="module-heading">
      <div>
        <p class="panel-kicker">Fuentes y presión</p>
        <h3>CIRBE + ASNEF</h3>
      </div>
    </div>
    <div class="debt-source-list">
      <div><span>CIRBE dic 2025</span><strong>${money(assumptions.cirbe.december2025.total, true)}</strong><small>Riesgo dispuesto total.</small></div>
      <div><span>CIRBE mayo 2026</span><strong>${money(assumptions.cirbe.may2026.total, true)}</strong><small>Vencidos ${money(assumptions.cirbe.may2026.overdue, true)} + demora/gastos ${money(assumptions.cirbe.may2026.interest, true)}.</small></div>
      ${assumptions.asnef
        .map((item) => `<div><span>${escapeHtml(item.entity)}</span><strong>${money(item.amount, true)}</strong><small>${item.rows} apunte(s) visibles en ASNEF.</small></div>`)
        .join("")}
    </div>`;

  qs("debtPlanScenarios").innerHTML = scenarios
    .map(
      (item) => `<article class="debt-scenario-card ${item.complete ? "good" : "warn"}">
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.g2Month || "No cerrado en horizonte")}</strong>
        <p>Golpe 1: ${escapeHtml(item.g1Month || "pendiente")} · colchón mínimo ${money(item.minReserve, true)} · cierre final ${money(item.finalLiquidity, true)}.</p>
      </article>`,
    )
    .join("");

  qs("debtPlanTable").innerHTML = `<thead><tr>
      <th>Mes</th>
      <th>Libre</th>
      <th>Fondo</th>
      <th>Colchón</th>
      <th>Total</th>
      <th>Evento</th>
    </tr></thead>
    <tbody>
      ${best.timeline
        .slice(0, 18)
        .map((row) => `<tr class="${row.events.length ? "highlight" : ""}">
          <td>${escapeHtml(row.month)}</td>
          <td class="${row.free > 0 ? "positive" : "negative"}">${money(row.free, true)}</td>
          <td>${money(row.fund, true)}</td>
          <td>${money(row.reserve, true)}</td>
          <td><strong>${money(row.total, true)}</strong></td>
          <td>${row.events.length ? row.events.map(escapeHtml).join(" · ") : "-"}</td>
        </tr>`)
        .join("")}
    </tbody>`;
}

function renderActiveSection(viewId = viewFromHash()) {
  if (!lastSimulation.length) return;
  switch (viewId) {
    case "home":
      renderHomeDashboard();
      break;
    case "executive-advisor":
      renderExecutiveAdvisor();
      break;
    case "visual-detail":
      renderVisualDetail();
      break;
    case "debt-liquidation-plan":
      renderDebtLiquidationPlan();
      break;
    case "savings-agent":
      renderSavingsAgent();
      break;
    case "virtual-advisor":
      renderVirtualAdvisor();
      break;
    case "debt-control":
      renderDebtControl();
      break;
    case "prevision":
      renderPrevision();
      renderMonthlyDetails();
      break;
    case "simulator":
      renderProjectSimulator(lastBaseSimulation, lastSimulation);
      renderAdvice(lastSimulation, lastBaseSimulation);
      break;
    case "forecast":
      renderBalanceChart(lastSimulation, lastBaseSimulation);
      renderCategoryChart();
      break;
    case "savings-plan":
      renderSavingsPlan();
      break;
    case "cashflow":
      renderTable(lastSimulation, lastBaseSimulation);
      break;
    case "movements":
      renderMerchants();
      break;
    case "data-entry":
      populateDataEntryControls();
      break;
    default:
      break;
  }
}

function assistantDashboardContext() {
  const rawRows = lastSimulation.length ? lastSimulation : simulate(projectPlan.outflows || []);
  const rawBaseRows = lastBaseSimulation.length ? lastBaseSimulation : simulate();
  const rows = openSimulationRows(rawRows);
  const baseRows = rows.map((row) => rawBaseRows[(row.index || 1) - 1] || row);
  const next12 = rows.slice(0, 12);
  const metrics = rangeKpiMetric(rows);
  const savingsCalc = savingsPlanCalculations();
  const decisionImpact = rows.at(-1)?.totalLiquidity - (baseRows.at(-1)?.totalLiquidity || 0);
  const debtOpen = DEBT_PORTFOLIO.filter((row) => Number(row.currentPrincipal || 0) > 0);
  const debtPriority = debtOpen
    .slice()
    .sort((a, b) => Number(b.originalPayment || 0) / Math.max(1, Number(b.currentPrincipal || 0)) - Number(a.originalPayment || 0) / Math.max(1, Number(a.currentPrincipal || 0)))
    .slice(0, 3);
  return {
    rows,
    next12,
    metrics,
    savingsCalc,
    avgNet12: round2(averageRows(next12, (row) => row.netBeforeSaving)),
    avgSaving12: round2(averageRows(next12, (row) => row.saving)),
    avgProject12: round2(averageRows(next12, (row) => row.projectOutflow)),
    decisionImpact: round2(decisionImpact || 0),
    decisions: projectPlan.placements || [],
    debtPriority,
  };
}

function assistantRecommendationForQuestion(question, ctx) {
  const q = normalizedText(question);
  const lines = [];
  const minText = ctx.metrics ? `${money(ctx.metrics.min, true)} en ${ctx.metrics.minMonth}` : "sin mínimo calculado";
  const adjustedText = ctx.metrics ? `${money(ctx.metrics.adjustedMin, true)} en ${ctx.metrics.adjustedMinMonth}` : "sin mínimo ajustado calculado";

  if (q.includes("deuda") || q.includes("amort") || q.includes("refinanc")) {
    lines.push(`Deuda: priorizaría primero ${ctx.debtPriority.map((item) => `${item.entity} ${item.type} (${money(item.currentPrincipal, true)})`).join(", ") || "ninguna deuda viva detectada"}.`);
    lines.push("Criterio: mira el ahorro de cuota frente al capital pactado y evita meses en los que el mínimo de caja caiga por debajo de cero.");
  } else if (q.includes("proyecto") || q.includes("reforma") || q.includes("viaje") || q.includes("compr")) {
    lines.push(`Proyectos: ahora hay ${ctx.decisions.length} decisión(es) cargada(s) y cambian la liquidez final ${ctx.decisionImpact >= 0 ? "+" : ""}${money(ctx.decisionImpact, true)}.`);
    lines.push(`La caja más delicada queda en ${minText}; si el proyecto es nuevo, buscaría el mes que mantenga ese mínimo por encima de un mes de gastos.`);
  } else if (q.includes("ahorro") || q.includes("colchon") || q.includes("colchón")) {
    lines.push(`Ahorro: el sugerido por el plan es ${money(ctx.savingsCalc.recommendedSaving, true)} y el aplicado medio 12m es ${money(ctx.avgSaving12, true)}.`);
    lines.push(`Colchón: objetivo ${money(ctx.savingsCalc.emergencyFundTarget, true)}; gap ${money(ctx.savingsCalc.emergencyFundGap, true)}. El mínimo ajustado es ${adjustedText}.`);
  } else if (q.includes("caja") || q.includes("minimo") || q.includes("mínimo") || q.includes("saldo")) {
    lines.push(`Caja: mínimo ${minText}, mínimo ajustado ${adjustedText} y máximo ${ctx.metrics ? money(ctx.metrics.max, true) : "sin dato"}.`);
    lines.push("Si quieres proteger caja, mantén activo el ajuste automático de ahorro y mueve impactos grandes a meses con extra o margen positivo.");
  } else {
    lines.push(`Lectura general: margen medio 12m antes de ahorrar ${money(ctx.avgNet12, true)}, ahorro medio aplicado ${money(ctx.avgSaving12, true)} y decisiones/proyectos medios ${money(ctx.avgProject12, true)}.`);
    lines.push(`La decisión más prudente es proteger el mínimo de caja (${minText}) antes de subir ahorro o amortizar más rápido.`);
  }

  if (ctx.metrics?.min < 0) {
    lines.push("Alerta: hay al menos un punto de caja negativo. Antes de ejecutar, reduce ahorro, mueve proyecto o cambia una deuda a modalidad recurrente.");
  } else if (ctx.savingsCalc.debtToIncomeRatio > 0.32) {
    lines.push("Vigila deuda/ingresos: está por encima del umbral aconsejable del 32%; conviene simular acuerdos con quita o menor cuota.");
  } else {
    lines.push("Estado: el escenario es viable con los datos actuales, siempre que los importes reales se mantengan cerca de lo previsto.");
  }
  return lines;
}

function renderAssistantAnswer(question) {
  const ctx = assistantDashboardContext();
  const answer = assistantRecommendationForQuestion(question, ctx);
  const sectionName = viewTitles[viewFromHash()]?.eyebrow || "Dashboard";
  return `<strong>${escapeHtml(sectionName)} · análisis con datos actuales</strong>
    <ul>${answer.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
    <div class="assistant-mini-kpis">
      <span>Mín: <b>${ctx.metrics ? money(ctx.metrics.min, true) : "-"}</b></span>
      <span>Ajustado: <b>${ctx.metrics ? money(ctx.metrics.adjustedMin, true) : "-"}</b></span>
      <span>Ahorro sugerido: <b>${money(ctx.savingsCalc.recommendedSaving, true)}</b></span>
    </div>`;
}

function handleAssistantAsk(promptText = "") {
  const question = String(promptText || qs("assistantQuestion")?.value || "").trim();
  const answer = qs("assistantAnswer");
  if (!answer) return;
  answer.innerHTML = renderAssistantAnswer(question || "Dame una lectura general del dashboard");
  if (question && qs("assistantQuestion")) qs("assistantQuestion").value = question;
}

function toggleAssistant(open) {
  const panel = qs("assistantPanel");
  if (!panel) return;
  panel.hidden = open === undefined ? !panel.hidden : !open;
  if (!panel.hidden) handleAssistantAsk(qs("assistantQuestion")?.value || "");
}

function render() {
  readStateFromControls();
  ensureVariableOperationalSection();
  populateSelectors();
  recomputeModelIfNeeded();
  writeDerivedControls(lastSimulation);
  updateKpis(lastSimulation, lastBaseSimulation);
  renderAccountBalancePanels();
  renderActiveSection();
}

function scheduleRender() {
  if (renderFrame) window.cancelAnimationFrame(renderFrame);
  renderFrame = window.requestAnimationFrame(() => {
    renderFrame = 0;
    render();
  });
}

async function init() {
  if (window.FINANCE_DATA) {
    packagedFinanceData = cloneFinanceData(window.FINANCE_DATA);
    baseData = cloneFinanceData(window.FINANCE_DATA);
  } else {
    const response = await fetch("../data/finance_data.json");
    baseData = await response.json();
    packagedFinanceData = cloneFinanceData(baseData);
  }
  loadWorkbookOverride();
  loadLocalState();
  ensureCompleteFinancingSection();
  repairFinancingSectionFromReference();
  ensureVariableOperationalSection();
  applyVariableOperationalMigration();
  applyVariableOperationalMayZeroDefault();
  document.documentElement.dataset.xlsxReady = window.XLSX && typeof window.XLSX.read === "function" ? "true" : "false";
  writeControls({ ...baseData.assumptions, autoCapSavings: true });
  populateSelectors(true);
  updateSourceNote();
  qs("scenarioName").textContent = currentScenario;

  controls.forEach((key) => qs(key).addEventListener("input", scheduleRender));
  qs("balanceDate").addEventListener("change", () => {
    if (qs("balanceMode").value === "auto") applyBalanceModeChange();
    render();
  });
  qs("balanceMode").addEventListener("change", () => {
    applyBalanceModeChange();
    render();
  });
  derivedControlIds.forEach((key) => {
    qs(key).readOnly = true;
    qs(key).classList.add("derived-control");
  });
  applyHelpTooltips();
  qs("autoCapSavings").addEventListener("change", render);
  qs("downloadCsv").addEventListener("click", downloadCsv);
  qs("syncLogin").addEventListener("click", () => handleSyncAuth("login"));
  qs("syncSignup").addEventListener("click", () => handleSyncAuth("signup"));
  qs("syncResend").addEventListener("click", handleResendConfirmation);
  qs("syncLogout").addEventListener("click", handleSyncLogout);
  qs("syncNow").addEventListener("click", () => saveRemoteState(true));
  qs("addProject").addEventListener("click", handleAddProject);
  qs("cancelProjectEdit").addEventListener("click", () => {
    clearProjectForm();
    renderProjectSimulator(lastBaseSimulation, lastSimulation);
  });
  ["projectKind", "projectCreditOwner", "projectCreditCapital", "projectName", "projectAmount", "projectDuration", "projectRecurringAmount", "projectRecurringDuration", "projectRecurringDelay", "projectMonth"].forEach((id) => {
    qs(id)?.addEventListener("input", () => {
      pendingProjectDecision = null;
      if (id === "projectKind") updateProjectKindUi();
      if (id === "projectAmount" && qs("projectKind")?.value === "external-credit" && qs("projectCreditCapital") && !qs("projectCreditCapital").value) {
        qs("projectCreditCapital").value = qs("projectAmount")?.value || "";
      }
      renderProjectPlanPreview();
      renderProjectDecisionReview();
    });
    qs(id)?.addEventListener("change", () => {
      pendingProjectDecision = null;
      if (id === "projectKind") updateProjectKindUi();
      if (id === "projectAmount" && qs("projectKind")?.value === "external-credit" && qs("projectCreditCapital") && !qs("projectCreditCapital").value) {
        qs("projectCreditCapital").value = qs("projectAmount")?.value || "";
      }
      renderProjectPlanPreview();
      renderProjectDecisionReview();
    });
  });
  qs("clearProjects").addEventListener("click", handleClearProjects);
  qs("addDebtPayoff").addEventListener("click", handleAddDebtLiquidation);
  qs("reviewDebtPayoff")?.addEventListener("click", stageDebtDecision);
  qs("debtTargetSelect").addEventListener("change", () => {
    pendingDebtDecision = null;
    updateDebtTargetDefaults(true);
    renderDebtControl();
  });
  qs("debtPayoffMode").addEventListener("change", () => {
    pendingDebtDecision = null;
    updateDebtModeUi();
    renderDebtControl();
  });
  ["debtPayoffAmount", "debtPayoffRelief", "debtPayoffDuration", "debtPayoffMonth"].forEach((id) => {
    qs(id).addEventListener("input", () => {
      pendingDebtDecision = null;
      renderDebtControl();
    });
    qs(id).addEventListener("change", () => {
      pendingDebtDecision = null;
      renderDebtControl();
    });
  });
  qs("addIncomeConcept").addEventListener("click", () => handleAddCustomConcept("income"));
  qs("addExpenseConcept").addEventListener("click", () => handleAddCustomConcept("expense"));
  qs("manualDataKind").addEventListener("change", updateManualDataKindUi);
  qs("addManualData").addEventListener("click", handleManualData);
  qs("importBatchData").addEventListener("click", handleBatchImport);
  qs("seriesKind").addEventListener("change", populateSeriesEditor);
  qs("seriesRow").addEventListener("change", updateSeriesPreview);
  qs("seriesStartMonth").addEventListener("change", updateSeriesPreview);
  qs("seriesEndMonth").addEventListener("change", updateSeriesPreview);
  qs("applySeriesChange").addEventListener("click", applySeriesChange);
  ["visualTimeMode", "visualStartMonth", "visualEndMonth", "visualValueMode"].forEach((id) => {
    qs(id).addEventListener("change", renderVisualDetail);
  });
  qs("visualEditKind").addEventListener("change", () => {
    populateVisualBulkEditor();
    updateVisualBulkEditScopeUi();
  });
  qs("visualEditScope").addEventListener("change", updateVisualBulkEditScopeUi);
  qs("visualEditStartMonth").addEventListener("change", updateVisualBulkEditScopeUi);
  qs("visualStageBulkEdit").addEventListener("click", stageVisualBulkEdit);
  ["visualBalanceDate", "visualBalanceMode"].forEach((id) => {
    qs(id).addEventListener("change", handleVisualBalanceControlChange);
  });
  ["visualCaixaBalance", "visualMediolanumBalance"].forEach((id) => {
    qs(id).addEventListener("change", handleVisualAccountBalanceInput);
  });
  qs("previsionYear").addEventListener("change", renderPrevision);
  qs("agentYear")?.addEventListener("change", renderSavingsAgent);
  qs("agentCaixaFloor")?.addEventListener("change", handleAgentCaixaFloorChange);
  ["executiveCaixaFloor", "executiveCarReserve", "executiveCarCost", "executiveTereCreditCapital", "executiveTereCreditPayment"].forEach((id) => {
    qs(id)?.addEventListener("input", () => saveExecutiveAdvisorSettingsFromControls({ rerender: false }));
    qs(id)?.addEventListener("change", () => saveExecutiveAdvisorSettingsFromControls({ rerender: true }));
  });
  qs("executive-advisor")?.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-executive-action]");
    if (actionButton) {
      const action = actionButton.dataset.executiveAction;
      if (action === "simulate-route") {
        applyAgentRouteSimulation();
        return;
      }
      if (action === "clear-route") {
        clearAgentRouteSimulation();
        return;
      }
      if (action === "prepare-car-project") {
        prepareExecutiveCarProject(false);
        return;
      }
      if (action === "prepare-tere-credit") {
        prepareExecutiveCarProject(true);
        return;
      }
    }
    const debtButton = event.target.closest("[data-executive-debt-target]");
    if (debtButton) {
      prepareAgentDebtDecision(debtButton.dataset.executiveDebtTarget, {
        monthIndex: debtButton.dataset.executiveDebtMonth,
        amount: debtButton.dataset.executiveDebtAmount,
      });
      return;
    }
    const navButton = event.target.closest("[data-home-nav]");
    if (navButton) {
      history.pushState(null, "", `#${navButton.dataset.homeNav}`);
      setActiveView(navButton.dataset.homeNav);
    }
  });
  qs("savings-agent")?.addEventListener("click", (event) => {
    const settingsButton = event.target.closest("[data-agent-debt-settings-save]");
    if (settingsButton) {
      saveAgentDebtOptimizerSettingsFromForm();
      return;
    }
    const routeSimButton = event.target.closest("[data-agent-route-simulate]");
    if (routeSimButton) {
      applyAgentRouteSimulation();
      return;
    }
    const routeClearButton = event.target.closest("[data-agent-route-clear]");
    if (routeClearButton) {
      clearAgentRouteSimulation();
      return;
    }
    const debtButton = event.target.closest("[data-agent-debt-target]");
    if (debtButton) {
      prepareAgentDebtDecision(debtButton.dataset.agentDebtTarget, {
        monthIndex: debtButton.dataset.agentDebtMonth,
        amount: debtButton.dataset.agentDebtAmount,
      });
      return;
    }
    const projectButton = event.target.closest("[data-agent-project-id]");
    if (projectButton) prepareAgentProjectDecision(projectButton.dataset.agentProjectId);
    const navButton = event.target.closest("[data-home-nav]");
    if (navButton) {
      history.pushState(null, "", `#${navButton.dataset.homeNav}`);
      setActiveView(navButton.dataset.homeNav);
    }
  });
  qs("virtual-advisor")?.addEventListener("click", (event) => {
    const compareDebtButton = event.target.closest("#advisorDebtCompare");
    if (compareDebtButton) {
      renderAdvisorDebtSandbox();
      return;
    }
    const applyDebtOptionButton = event.target.closest("[data-advisor-apply-debt-option]");
    if (applyDebtOptionButton) {
      applyAdvisorDebtOption(applyDebtOptionButton);
      return;
    }
    const routeSimButton = event.target.closest("[data-advisor-action='simulate-route']");
    if (routeSimButton) {
      applyAgentRouteSimulation();
      return;
    }
    const routeClearButton = event.target.closest("[data-advisor-action='clear-route']");
    if (routeClearButton) {
      clearAgentRouteSimulation();
      return;
    }
    const debtButton = event.target.closest("[data-advisor-debt-target]");
    if (debtButton) {
      prepareAgentDebtDecision(debtButton.dataset.advisorDebtTarget, {
        monthIndex: debtButton.dataset.advisorDebtMonth,
        amount: debtButton.dataset.advisorDebtAmount,
      });
      return;
    }
    const projectButton = event.target.closest("[data-advisor-project-id]");
    if (projectButton) {
      prepareAgentProjectDecision(projectButton.dataset.advisorProjectId);
      return;
    }
    const navButton = event.target.closest("[data-home-nav]");
    if (navButton) {
      history.pushState(null, "", `#${navButton.dataset.homeNav}`);
      setActiveView(navButton.dataset.homeNav);
    }
  });
  ["advisorDebtTarget", "advisorDebtMode", "advisorDebtDuration", "advisorDebtMonth", "advisorDebtAmount"].forEach((id) => {
    qs(id)?.addEventListener("change", () => {
      if (id === "advisorDebtTarget") {
        const target = debtTargetById(qs("advisorDebtTarget")?.value, { includePlanned: true });
        if (qs("advisorDebtAmount")) qs("advisorDebtAmount").value = amountInputValue(Number(target?.currentPrincipal ?? target?.principal ?? 0));
      }
      renderAdvisorDebtSandbox();
    });
    qs(id)?.addEventListener("input", () => {
      if (id !== "advisorDebtTarget") renderAdvisorDebtSandbox();
    });
  });
  qs("visualAddKind").addEventListener("change", populateVisualAddSections);
  qs("visualAddScope").addEventListener("change", updateVisualAddScopeUi);
  qs("visualAddStartMonth").addEventListener("change", updateVisualAddScopeUi);
  qs("visualAddRow").addEventListener("click", handleVisualAddRow);
  qs("visualSaveChanges").addEventListener("click", saveVisualChanges);
  qs("visualDiscardChanges").addEventListener("click", discardVisualChanges);
  qs("visualBulkDelete").addEventListener("click", stageSelectedVisualDeletes);
  qs("movementMonthFilter").addEventListener("change", renderDetailedMovements);
  qs("movementSearch").addEventListener("input", renderDetailedMovements);
  qs("movementExcelFile").addEventListener("change", handleMovementExcelImport);
  qs("homeHorizon")?.addEventListener("change", renderHomeDashboard);
  qs("home")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-home-nav]");
    const target = button?.dataset.homeNav;
    if (!target || !document.getElementById(target)?.classList.contains("view-section")) return;
    history.pushState(null, "", `#${target}`);
    setActiveView(target);
  });
  qs("clearBatchData").addEventListener("click", () => {
    qs("batchDataInput").value = "";
    showImportLog("Lote limpio", "Puedes pegar una nueva tabla cuando quieras.");
  });
  qs("excelDataFile").addEventListener("change", handleExcelImport);
  qs("detailMonth").addEventListener("change", renderMonthlyDetails);
  document.querySelectorAll('input[name="projectMode"]').forEach((input) => {
    input.addEventListener("change", () => {
      pendingProjectDecision = null;
      updateProjectModeUi();
      renderProjectDecisionReview();
    });
  });
  document.querySelectorAll(".mode-switch label").forEach((label) => {
    label.addEventListener("click", () => {
      const input = label.querySelector('input[name="projectMode"]');
      if (input) {
        pendingProjectDecision = null;
        setProjectMode(input.value);
        renderProjectDecisionReview();
      }
    });
  });
  document.querySelectorAll(".scenario-buttons button").forEach((button) => {
    button.addEventListener("click", () => applyScenario(button.dataset.scenario));
  });
  qs("assistantToggle")?.addEventListener("click", () => toggleAssistant());
  qs("assistantClose")?.addEventListener("click", () => toggleAssistant(false));
  qs("assistantAsk")?.addEventListener("click", () => handleAssistantAsk());
  qs("assistantQuestion")?.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") handleAssistantAsk();
  });
  document.querySelectorAll("[data-assistant-prompt]").forEach((button) => {
    button.addEventListener("click", () => handleAssistantAsk(button.dataset.assistantPrompt));
  });
  window.addEventListener("resize", () => {
    if (renderFrame) window.cancelAnimationFrame(renderFrame);
    renderFrame = window.requestAnimationFrame(() => {
      renderFrame = 0;
      renderActiveSection();
    });
  });
  updateProjectModeUi();
  updateDebtModeUi();
  setupViewNavigation();
  render();
  await setupSupabaseSync();
}

init().catch((error) => {
  document.body.innerHTML = `<main><h1>No se pudo cargar la app</h1><p>${error.message}</p></main>`;
});
