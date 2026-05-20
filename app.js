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

const MODEL_END_YEAR = 2040;
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
let state;
let lastSimulation = [];
let lastBaseSimulation = [];
let lastPlannedSimulation = [];
let currentScenario = "Base";
let projects = [];
let debtLiquidations = [];
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
let selectorSignature = "";
let visualMonthSelectorSignature = "";
let visualAddSectionSignature = "";
let visualBulkEditorSignature = "";
let dataEntryMonthSignature = "";
let seriesEditorSignature = "";
let renderFrame = 0;
let expandedPlanningSections = {
  income: new Set(),
  expense: new Set(),
};

const WORKBOOK_OVERRIDE_KEY = "financeDashboard:workbookOverride:v1";
const REMOTE_SOURCE_KEY = "finance-dashboard-main";

const DEBT_PORTFOLIO = [
  { entity: "Cetelem", type: "Crédito", number: "40037624105825", initialPrincipal: 1547.08, originalPayment: 262.34, currentPayment: 259, reunified: true, amortized: 0, currentPrincipal: 0, maturity: "", remainingInstallments: 130 },
  { entity: "Cetelem", type: "Crédito", number: "40037624105827", initialPrincipal: 3559.33, originalPayment: 212.03, currentPayment: 259, reunified: true, amortized: 0, currentPrincipal: 0, maturity: "", remainingInstallments: 130 },
  { entity: "Cetelem", type: "Tarjeta", number: "5100341635315001", initialPrincipal: 7508, originalPayment: 256.98, currentPayment: 259, reunified: true, amortized: 0, currentPrincipal: 0, maturity: "", remainingInstallments: 130 },
  { entity: "Cetelem", type: "Tarjeta", number: "5100341647655006", initialPrincipal: 8000, originalPayment: 289.62, currentPayment: 259, reunified: true, amortized: 0, currentPrincipal: 0, maturity: "", remainingInstallments: 130 },
  { entity: "Wizink", type: "Tarjeta", number: "5267 5209 1552 8008", initialPrincipal: 7381.63, originalPayment: 191.72, currentPayment: 0, reunified: false, amortized: 0, currentPrincipal: 7381.63, maturity: "", remainingInstallments: null },
  { entity: "Wizink", type: "Tarjeta", number: "5489 1808 1365 8688", initialPrincipal: 3117.23, originalPayment: 114.37, currentPayment: 0, reunified: false, amortized: 1300, currentPrincipal: 0, maturity: "", remainingInstallments: null },
  { entity: "Bankintercard", type: "Crédito", number: "0128/9830/051.1130377", initialPrincipal: 14975.01, originalPayment: 426.49, currentPayment: 0, reunified: false, amortized: 0, currentPrincipal: 14975.01, maturity: "19/8/29", remainingInstallments: 43 },
  { entity: "Bankintercard", type: "Tarjeta", number: "4966630612068823", initialPrincipal: 6477.07, originalPayment: 508.2, currentPayment: 0, reunified: false, amortized: 0, currentPrincipal: 6477.07, maturity: "", remainingInstallments: null },
  { entity: "Mediamarkt", type: "Tarjeta", number: "4010 2111 8083 0013", initialPrincipal: 1376.71, originalPayment: 115, currentPayment: 0, reunified: false, amortized: 0, currentPrincipal: 1376.71, maturity: "", remainingInstallments: null },
  { entity: "Ikea", type: "Tarjeta", number: "4552 4698 2929 5014", initialPrincipal: 2594.88, originalPayment: 120, currentPayment: 0, reunified: false, amortized: 0, currentPrincipal: 2594.88, maturity: "", remainingInstallments: null },
  { entity: "Caixabank PC", type: "Crédito", number: "8197109", initialPrincipal: 464.62, originalPayment: 86.41, currentPayment: 0, reunified: false, amortized: 0, currentPrincipal: 464.62, maturity: "30/7/26", remainingInstallments: 6 },
  { entity: "Caixabank PC", type: "Crédito", number: "40354", initialPrincipal: 2195.07, originalPayment: 167.68, currentPayment: 0, reunified: false, amortized: 0, currentPrincipal: 2195.07, maturity: "30/3/27", remainingInstallments: 14 },
  { entity: "Caixabank PC", type: "Crédito", number: "40353", initialPrincipal: 491.6, originalPayment: 159.72, currentPayment: 0, reunified: false, amortized: 0, currentPrincipal: 491.6, maturity: "30/4/26", remainingInstallments: 3 },
].map((item, index) => ({ ...item, id: `debt-${index + 1}` }));

const CURRENT_REUNIFIED_DEBT_PAYMENT = 259;
const CURRENT_REUNIFIED_DEBT_INSTALLMENTS = 130;
const CURRENT_REUNIFIED_DEBT_COST = CURRENT_REUNIFIED_DEBT_PAYMENT * CURRENT_REUNIFIED_DEBT_INSTALLMENTS;

const viewTitles = {
  "visual-detail": {
    eyebrow: "Cuadro de mandos",
    title: "Planifica liquidez, ahorro y refinanciación desde la fecha de análisis",
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
    title: "Visualiza la evolución de liquidez durante 60 meses",
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

function loadWorkbookOverride() {
  const stored = storageGet(WORKBOOK_OVERRIDE_KEY, "");
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    if (parsed?.metadata && parsed?.monthlyPlanning) baseData = parsed;
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
  if (payload.workbookData?.metadata && payload.workbookData?.monthlyPlanning) {
    baseData = payload.workbookData;
    saveWorkbookOverride();
  }
  projects = Array.isArray(payload.projects) ? payload.projects : [];
  debtLiquidations = Array.isArray(payload.debtLiquidations) ? payload.debtLiquidations : [];
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
  debtLiquidations = debtLiquidations.map(normalizeItem);
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
  scenarioSettings = {
    currentScenario,
    recommendedSavings: state.recommendedSavings,
    annualInflation: state.annualInflation,
    annualIncomeGrowth: state.annualIncomeGrowth,
    emergencyBufferMonths: state.emergencyBufferMonths,
    autoCapSavings: state.autoCapSavings,
    incomeFactor: state.incomeFactor,
    expenseFactor: state.expenseFactor,
    savingsPlan: scenarioSettings.savingsPlan || {},
  };
  storageSet(storageKey("scenarioSettings"), JSON.stringify(scenarioSettings));
  queueRemoteSave();
}

function saveBalanceSettings() {
  if (!baseData) return;
  balanceSettings = {
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
  storageSet(storageKey("balanceSettings"), JSON.stringify(balanceSettings));
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
  const id = (window.location.hash || "#visual-detail").replace("#", "");
  if (id === "overview") return "visual-detail";
  if (id === "monthly-detail") return "prevision";
  return document.getElementById(id)?.classList.contains("view-section") ? id : "visual-detail";
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
  const override = seriesOverrideForRow(row, month);
  if (override?.deleted) return 0;
  if (override?.planned !== undefined && override?.planned !== "") return Number(override.planned || 0);
  const debtProjection = adjustedDebtPlannedValue(row, month);
  if (debtProjection !== null) return debtProjection;
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
  const oldFinancingLabels = [
    "tarjeta eci",
    "anticipo eci",
    "mastercard credito",
    "mastecard credito",
    "financiacion express",
    "pass javi credito",
    "mastercard tere",
    "visa go tere",
    "visa go javi",
    "mycard javi",
    "tarjeta tere",
    "prestamo tere",
    "prestamo cetelem tere",
    "mastercard pdh",
  ];
  return oldFinancingLabels.some((item) => label.includes(item)) ? 0 : null;
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
  const normalized = normalizedText(raw).replace(/\./g, "");
  const keyMatch = normalized.match(/^(\d{4})[-/](\d{1,2})$/);
  if (keyMatch) {
    const key = `${keyMatch[1]}-${String(Number(keyMatch[2])).padStart(2, "0")}`;
    const index = months.findIndex((month) => month.key === key);
    return index >= 0 ? { ...months[index], index } : null;
  }
  const dateMatch = normalized.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dateMatch) {
    const year = Number(dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]);
    const key = `${year}-${String(Number(dateMatch[2])).padStart(2, "0")}`;
    const index = months.findIndex((month) => month.key === key);
    return index >= 0 ? { ...months[index], index } : null;
  }
  const index = months.findIndex((month) => normalizedText(month.label).replace(/\./g, "") === normalized);
  return index >= 0 ? { ...months[index], index } : null;
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
  if (text.includes("repart") || text.includes("varios") || text.includes("mensual") || Number(duration) > 1) return "spread";
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
      const rows = [];
      for (let row = startRow; row <= endRow; row += 1) {
        const label = cellByIndex(sheet, row, 1);
        if (label === null || label === undefined || label === "") continue;
        const planned = columns.map((col) => Math.abs(parseAmount(cellByIndex(sheet, row, col)) ?? 0));
        if (!planned.some(Boolean)) continue;
        rows.push({
          id: `${sectionName.toLowerCase().replaceAll(" ", "-")}-${row + 1}`,
          label: String(label).trim(),
          row: row + 1,
          kind,
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
  const coreCategories = ["Tarjeta Mastercard", "Suministros y telecom", "Vivienda/comunidad", "Efectivo", "Seguros", "Alimentacion", "Otros gastos"];
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
        !deletedPlanningRows[deleteKeyForRow(row, month)] &&
        !seriesOverrideForRow(row, month)?.deleted,
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
        .filter((row) => !deletedPlanningRows[deleteKeyForRow(row, month)] && !seriesOverrideForRow(row, month)?.deleted)
        .concat(customRowsForSection(section.kind, section.name, month));
      return { ...section, rows, sourceRows: section.rows, sourceRowCount };
    });

  customPlanningRows
    .filter((row) => (!kind || row.kind === kind) && row.monthKey === month.key)
    .forEach((row) => {
      if (sections.some((section) => section.kind === row.kind && section.name === row.sectionName)) return;
      if (deletedPlanningRows[deleteKeyForRow(row, month)]) return;
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

function isPrePayrollIncomeRow(row) {
  const label = normalizedText(displayLabelForRow(row));
  return label === "local" || /(^|\b)(nomina|salario)\s+tere(\b|$)/.test(label) || /\btere\b.*\b(nomina|salario)\b/.test(label);
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
  };

  planningSectionsForMonth(null, month).forEach((section) => {
    const calculationRows = section.rows;
    let rowTotal = 0;
    let sectionCoreSpend = 0;
    let sectionCar = 0;
    let sectionRefi = 0;
    let sectionPrePayrollIncome = 0;

    calculationRows.forEach((row) => {
      const deleted = deletedPlanningRows[deleteKeyForRow(row, month)] || seriesOverrideForRow(row, month)?.deleted;
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
        sectionCoreSpend += value;
      }
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
  });

  return breakdown;
}

function planningDetailSectionsForForecastIndex(forecastIndex) {
  const date = addMonths(modelStartDate(), forecastIndex);
  const month = planningMonthForDate(date, forecastIndex);
  return {
    month,
    sections: planningSectionsForMonth(null, month)
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
      .filter((section) => section.lines.length),
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
  const reliefMonths = Math.max(1, Number(project.reliefMonths || modelMonthCount()));
  const reliefActive =
    project.source === "debt" &&
    Number(project.monthlyRelief || 0) > 0 &&
    forecastIndex >= reliefStart &&
    forecastIndex < reliefStart + reliefMonths;
  const relief = reliefActive ? -Number(project.monthlyRelief || 0) : 0;
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
    const coreSpend =
      detail.coreSpend *
      (state.expenseFactor ?? 1) *
      Math.pow(1 + state.annualInflation / 100, i / 12);
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
  const next12 = rows.slice(0, Math.min(12, rows.length));
  const activeRefiMonths = rows.filter((row) => row.refi > 0).length;
  const values = {
    startingAccountBalance: rows[0]?.startChecking || 0,
    monthlyIncome: averageRows(next12, (row) => row.income),
    coreSpend: averageRows(next12, (row) => row.coreSpend),
    carPayment: sumRows(next12, (row) => row.car),
    remainingHighRefiPayments: activeRefiMonths,
    refiFirstPayment: averageRows(next12, (row) => row.refi),
    refiLaterPayment: sumRows(rows, (row) => row.refi),
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
    const coreSpend =
      detail.coreSpend *
      (state.expenseFactor ?? 1) *
      Math.pow(1 + state.annualInflation / 100, i / 12);
    const carPayment = detail.car;
    const refi = detail.refi;
    const projectOutflow = Number(projectOutflows[i] || 0);
    const outflowsBeforeSaving = coreSpend + carPayment + refi + projectOutflow;
    const prePayrollIncome =
      detail.prePayrollIncome *
      (state.incomeFactor ?? 1) *
      Math.pow(1 + state.annualIncomeGrowth / 100, i / 12);
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
      car: carPayment,
      refi,
      projectOutflow,
      outflowsBeforeSaving,
      prePayrollIncome,
      saving: appliedSaving,
      checking,
      savings,
      totalLiquidity,
      netBeforeSaving: income - outflowsBeforeSaving,
    });
  }

  return rows;
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
    "Tarjeta Mastercard",
    "Suministros y telecom",
    "Vivienda/comunidad",
    "Efectivo",
    "Seguros",
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

function addProjectOutflow(outflows, project, startIndex) {
  const duration = Math.max(1, Number(project.duration || 1));
  const monthlyAmount = Number(project.amount || 0) / duration;
  for (let i = 0; i < duration; i += 1) {
    const index = startIndex + i;
    if (index >= 0 && index < outflows.length) {
      outflows[index] += monthlyAmount;
    }
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

function addDebtRelief(outflows, item, startIndex) {
  const monthlyRelief = Math.max(0, Number(item.monthlyRelief || 0));
  if (!monthlyRelief) return;
  const duration = Math.max(1, Number(item.duration || 1));
  const reliefStart = Math.min(outflows.length, startIndex + duration);
  const reliefMonths = Math.max(1, Number(item.reliefMonths || outflows.length));
  const reliefEnd = Math.min(outflows.length, reliefStart + reliefMonths);
  for (let i = reliefStart; i < reliefEnd; i += 1) {
    outflows[i] -= monthlyRelief;
  }
}

function addScheduledDecisionOutflow(outflows, item, startIndex) {
  addProjectOutflow(outflows, item, startIndex);
  if (item.source === "debt") addDebtRelief(outflows, item, startIndex);
}

function decisionGrossCost(item) {
  return round2(Number(item.amount || 0) + Number(item.recurringAmount || 0) * Math.max(0, Number(item.recurringDuration || 0)));
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
      addScheduledDecisionOutflow(outflows, project, startIndex);
      placements.push({ ...project, startIndex, status: project.source === "debt" ? "debt" : "fixed", monthLabel: months[startIndex].label });
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
        placements.push({
          ...project,
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

function handleAddProject() {
  const name = qs("projectName").value.trim() || "Proyecto sin nombre";
  const amount = parseAmount(qs("projectAmount").value) ?? 0;
  const duration = Math.max(1, Number(qs("projectDuration").value || 1));
  const recurringAmount = parseAmount(qs("projectRecurringAmount")?.value) ?? 0;
  const recurringDuration = Math.max(0, Number(qs("projectRecurringDuration")?.value || 0));
  const recurringStartOffset = qs("projectRecurringDelay")?.value === "same" ? 0 : duration;
  const mode = document.querySelector('input[name="projectMode"]:checked')?.value || "optimize";
  const monthIndex = Number(qs("projectMonth").value || 0);
  const monthKeyForProject = forecastMonths()[monthIndex]?.key;
  if ((!amount || amount <= 0) && (!recurringAmount || recurringAmount <= 0)) return;

  const project = {
    id: editingProjectId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    amount: round2(amount),
    duration,
    recurringAmount: round2(recurringAmount),
    recurringDuration,
    recurringStartOffset,
    mode,
    monthIndex,
    monthKey: monthKeyForProject,
  };
  if (editingProjectId) {
    projects = projects.map((item) => (item.id === editingProjectId ? project : item));
  } else {
    projects.push(project);
  }
  clearProjectForm();
  saveProjects();
  render();
}

function clearProjectForm() {
  editingProjectId = null;
  qs("projectName").value = "";
  qs("projectAmount").value = "";
  qs("projectDuration").value = 1;
  if (qs("projectRecurringAmount")) qs("projectRecurringAmount").value = "";
  if (qs("projectRecurringDuration")) qs("projectRecurringDuration").value = 0;
  if (qs("projectRecurringDelay")) qs("projectRecurringDelay").value = "after";
  document.querySelector('input[name="projectMode"][value="optimize"]').checked = true;
  updateProjectModeUi();
  renderProjectPlanPreview();
}

function editProject(id) {
  const project = projects.find((item) => item.id === id);
  if (!project) return;
  editingProjectId = id;
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
  updateProjectModeUi();
  renderProjectPlanPreview();
  qs("projectName").focus();
}

function removeProject(id) {
  if (editingProjectId === id) clearProjectForm();
  projects = projects.filter((project) => project.id !== id);
  saveProjects();
  render();
}

function removeDebtLiquidation(id) {
  debtLiquidations = debtLiquidations.filter((item) => item.id !== id);
  saveDebtLiquidations();
  render();
}

function debtPortfolioRows() {
  return DEBT_PORTFOLIO;
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

function debtTargetOptions() {
  const current = currentDebtPaymentBreakdown();
  return [
    {
      id: "plan-unificado",
      entity: "Plan refinanciado",
      type: "Cuota unificada",
      number: "PZ Finanz / Cetelem",
      principal: CURRENT_REUNIFIED_DEBT_COST,
      currentPrincipal: CURRENT_REUNIFIED_DEBT_COST,
      payment: current.unified,
      maturity: "10 años aprox.",
      remainingInstallments: CURRENT_REUNIFIED_DEBT_INSTALLMENTS,
    },
    ...debtPortfolioRows()
      .filter((item) => Number(item.currentPrincipal || 0) > 0)
      .map((item) => ({
        ...item,
        principal: item.currentPrincipal,
        payment: item.currentPayment || item.originalPayment,
      })),
  ];
}

function selectedDebtTarget() {
  const targetId = qs("debtTargetSelect")?.value || "plan-unificado";
  return debtTargetOptions().find((item) => item.id === targetId) || debtTargetOptions()[0];
}

function populateDebtTargetSelect() {
  const select = qs("debtTargetSelect");
  if (!select) return;
  const previous = select.value;
  const hadOptions = select.options.length > 0;
  select.innerHTML = debtTargetOptions()
    .map((item) => {
      const suffix = item.id === "plan-unificado" ? "plan actual" : item.number;
      return `<option value="${escapeHtml(item.id)}">${escapeHtml(item.entity)} · ${escapeHtml(item.type)} · ${escapeHtml(suffix)} · ${money(item.currentPrincipal ?? item.principal, true)}</option>`;
    })
    .join("");
  select.value = [...select.options].some((option) => option.value === previous) ? previous : "plan-unificado";
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
  if (force || !qs("debtPayoffRelief")?.value) qs("debtPayoffRelief").value = target.payment ? target.payment.toFixed(2) : "";
  renderDebtAgreementPreview();
}

function debtModeLabel(mode) {
  if (mode === "optimize") return "mes óptimo";
  if (mode === "spread") return "pago repartido";
  if (mode === "refinance-optimize") return "reunificación con inicio óptimo";
  if (mode === "refinance") return "refinanciación";
  return "mes fijo";
}

function isDebtRefinanceMode(mode) {
  return mode === "refinance" || mode === "refinance-optimize";
}

function updateDebtModeUi() {
  const mode = qs("debtPayoffMode")?.value || "optimize";
  const isRefinance = isDebtRefinanceMode(mode);
  if (qs("debtPayoffDuration")) {
    qs("debtPayoffDuration").disabled = !isRefinance;
    if (!isRefinance) qs("debtPayoffDuration").value = 1;
  }
  if (qs("debtPayoffMonth")) qs("debtPayoffMonth").disabled = mode === "optimize" || mode === "refinance-optimize";
  qs("debtPayoffDuration")?.closest("label")?.classList.toggle("muted-control", !isRefinance);
  qs("debtPayoffMonth")?.closest("label")?.classList.toggle("muted-control", mode === "optimize" || mode === "refinance-optimize");
  renderDebtAgreementPreview();
}

function debtCandidateMonths(months = forecastMonths(), mode = "full") {
  if (mode === "priority") {
    return months.filter((month) => month.index < 24 || (month.index < 84 && month.index % 3 === 0) || month.index % 12 === 0);
  }
  return months.filter((month) => month.index < 36 || (month.index < 120 && month.index % 6 === 0) || month.index % 12 === 0);
}

function evaluateDebtCandidate(target, amount, relief, duration = 1, mode = "full") {
  if (!lastBaseSimulation.length) return null;
  const months = forecastMonths();
  const baselineOutflows = projectPlan?.outflows?.length === months.length ? projectPlan.outflows : Array(months.length).fill(0);
  const baseline = evaluateOutflows(baselineOutflows);
  let best = null;
  debtCandidateMonths(months, mode).forEach((month) => {
    const candidate = baselineOutflows.slice();
    const item = { source: "debt", amount, duration, monthlyRelief: relief, targetId: target?.id };
    addScheduledDecisionOutflow(candidate, item, month.index);
    const evaluation = evaluateOutflows(candidate);
    const netGain = evaluation.ending - baseline.ending;
    const feasible = evaluation.minChecking > Math.max(0, relief);
    const discount = Math.max(0, Number(target?.currentPrincipal ?? target?.principal ?? 0) - Number(amount || 0));
    const score = (feasible ? 1_000_000 : 0) + discount * 3 + Number(relief || 0) * 18 + evaluation.minChecking * 0.2 + netGain - month.index * 5;
    if (!best || score > best.score) best = { month, evaluation, netGain, feasible, score };
  });
  return best;
}

function recommendedDebtDecision() {
  const target = selectedDebtTarget();
  const amount = parseAmount(qs("debtPayoffAmount")?.value) ?? Number(target?.principal || 0);
  const relief = parseAmount(qs("debtPayoffRelief")?.value) ?? Number(target?.payment || 0);
  const mode = qs("debtPayoffMode")?.value || "optimize";
  const duration = isDebtRefinanceMode(mode) ? Math.max(1, Number(qs("debtPayoffDuration")?.value || 1)) : 1;
  return evaluateDebtCandidate(target, amount, relief, duration);
}

function renderDebtAgreementPreview() {
  const target = selectedDebtTarget();
  const element = qs("debtAgreementPreview");
  if (!target || !element) return;
  const original = Number(target.currentPrincipal ?? target.principal ?? 0);
  const agreed = parseAmount(qs("debtPayoffAmount")?.value) ?? original;
  const relief = parseAmount(qs("debtPayoffRelief")?.value) ?? Number(target.payment || 0);
  const income12 = lastSimulation.length
    ? averageRows(lastSimulation.slice(0, Math.min(12, lastSimulation.length)), (row) => row.income)
    : 0;
  const debt12 = lastSimulation.length
    ? averageRows(lastSimulation.slice(0, Math.min(12, lastSimulation.length)), (row) => row.car + row.refi)
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
  const currentMonthly12 = lastBaseSimulation.length
    ? averageRows(lastBaseSimulation.slice(0, Math.min(12, lastBaseSimulation.length)), (row) => row.refi)
    : currentPayment.total;
  const liquidationTotal = debtLiquidations.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const principalCovered = debtLiquidations.reduce((sum, item) => sum + Number(item.targetPrincipal || item.amount || 0), 0);
  const relief = debtLiquidations.reduce((sum, item) => sum + Number(item.monthlyRelief || 0), 0);
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
  const amount = parseAmount(qs("debtPayoffAmount").value);
  if (!amount || amount <= 0) return;
  const target = selectedDebtTarget();
  const rawMode = qs("debtPayoffMode").value || "optimize";
  const duration = isDebtRefinanceMode(rawMode) ? Math.max(1, Number(qs("debtPayoffDuration").value || 1)) : 1;
  const monthIndex = Number(qs("debtPayoffMonth").value || 0);
  const monthKeyForDebt = forecastMonths()[monthIndex]?.key;
  const monthlyRelief = parseAmount(qs("debtPayoffRelief").value) ?? Number(target?.payment || 0);
  const originalPrincipal = round2(Number(target?.currentPrincipal ?? target?.principal ?? amount));
  debtLiquidations.push({
    id: `debt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: qs("debtPayoffName").value.trim() || debtTargetDisplayName(target),
    amount: round2(amount),
    targetId: target?.id || "plan-unificado",
    targetPrincipal: originalPrincipal,
    originalPrincipal,
    discount: round2(Math.max(0, originalPrincipal - amount)),
    monthlyRelief: round2(monthlyRelief),
    duration,
    mode: rawMode === "optimize" || rawMode === "refinance-optimize" ? "optimize" : "fixed",
    payoffMode: rawMode,
    monthIndex,
    monthKey: monthKeyForDebt,
  });
  qs("debtPayoffName").value = "";
  qs("debtPayoffAmount").value = "";
  qs("debtPayoffRelief").value = "";
  qs("debtPayoffDuration").value = 1;
  saveDebtLiquidations();
  render();
}

function debtPriorityCandidates() {
  return debtTargetOptions()
    .filter((target) => target.id !== "plan-unificado")
    .map((target) => {
      const principal = Number(target.currentPrincipal ?? target.principal ?? 0);
      const payment = Number(target.payment || 0);
      const suggestedRow =
        lastSimulation.find((row) => Number(row.checking || 0) - principal > Math.max(0, Number(row.outflowsBeforeSaving || 0) * 0.35)) ||
        lastSimulation.find((row) => Number(row.totalLiquidity || 0) - principal > Math.max(0, Number(row.outflowsBeforeSaving || 0))) ||
        lastSimulation.at(-1);
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
  const months = forecastMonths().slice(0, 36);
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
            .map((line) => `${line.number}${line.reunified ? " · reunificado" : ""}${line.remainingInstallments ? ` · ${line.remainingInstallments} cuotas` : ""}`)
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
        const status = row.reunified ? "Reunificada" : Number(row.currentPrincipal || 0) > 0 ? "Viva" : "Saldada";
        const currentPaymentLabel = row.reunified ? `Incluida en ${money(CURRENT_REUNIFIED_DEBT_PAYMENT, true)}` : money(row.currentPayment, true);
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
          <p><b>${escapeHtml(status)}</b>${row.remainingInstallments ? ` · ${row.remainingInstallments} cuotas` : ""}${discount ? ` · mejora ${money(discount, true)}` : ""}</p>
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
          const monthly = Number(item.amount || 0) / Math.max(1, Number(item.duration || 1));
          const placement = projectPlan.placements.find((candidate) => candidate.source === "debt" && candidate.id === item.id);
          const month = placement
            ? forecastMonths()[placement.startIndex]
            : forecastMonths().find((candidate) => candidate.key === item.monthKey) || forecastMonths()[item.monthIndex || 0];
          return `<div class="project-item debt-item">
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <p>${debtModeLabel(item.payoffMode || item.mode)} · pactado ${money(item.amount, true)} vs deuda ${money(item.originalPrincipal || item.targetPrincipal || item.amount, true)} · mejora ${money(item.discount || 0, true)} · desde ${escapeHtml(placement?.monthLabel || month?.label || "")}, ${item.duration} mes(es). Pago mensual: ${money(monthly, true)}. Cuota eliminada posterior: ${money(item.monthlyRelief || 0, true)}.</p>
            </div>
            <button data-remove-debt-liquidation="${escapeHtml(item.id)}">Quitar</button>
          </div>`;
        })
        .join("")
    : '<div class="project-item"><div><strong>Sin liquidaciones cargadas</strong><p>Añade una liquidación para ver el impacto mensual y en el resto de secciones.</p></div></div>';

  document.querySelectorAll("[data-remove-debt-liquidation]").forEach((button) => {
    button.addEventListener("click", () => removeDebtLiquidation(button.dataset.removeDebtLiquidation));
  });
  renderDebtPayoffChart();
}

function handleClearProjects() {
  clearProjectForm();
  projects = [];
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

  if (!projects.length && !debtLiquidations.length) {
    qs("projectList").innerHTML =
      '<div class="project-item"><div><strong>Sin decisiones cargadas</strong><p>Añade un plan con impacto puntual, recurrente o una decisión de deuda desde Control de deuda.</p></div></div>';
    return;
  }

  qs("projectList").innerHTML = projectPlan.placements
    .map((project) => {
      const monthly = decisionPeakMonthlyImpact(project);
      const totalCost = decisionGrossCost(project);
      const recurrenceText = Number(project.recurringAmount || 0)
        ? ` Cuota recurrente: ${money(project.recurringAmount, true)} durante ${project.recurringDuration} mes(es).`
        : "";
      const statusText =
        project.status === "debt"
          ? "Liquidación de deuda programada"
          : project.status === "fixed"
          ? "Mes fijado manualmente"
          : project.status === "warning"
            ? "Sin hueco plenamente cómodo; colocado en el mejor mes disponible"
            : "Mes optimizado automáticamente";
      const actions =
        project.source === "debt"
          ? `<button data-remove-project="${project.id}" data-remove-project-source="debt">Quitar</button>`
          : `<button data-edit-project="${project.id}">Editar</button><button data-remove-project="${project.id}" data-remove-project-source="project">Quitar</button>`;
      return `<div class="project-item ${project.status === "warning" ? "warning" : ""} ${project.source === "debt" ? "debt-item" : ""}">
        <div>
          <strong>${project.name}</strong>
          <p>${project.source === "debt" ? "Deuda" : "Proyecto"} · ${money(totalCost, true)} total, desde ${project.monthLabel}. ${statusText}. Pico mensual: ${money(monthly, true)}.${recurrenceText}</p>
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
  const amount = parseAmount(qs("projectAmount")?.value) ?? 0;
  const duration = Math.max(1, Number(qs("projectDuration")?.value || 1));
  const recurringAmount = parseAmount(qs("projectRecurringAmount")?.value) ?? 0;
  const recurringDuration = Math.max(0, Number(qs("projectRecurringDuration")?.value || 0));
  const recurringDelay = qs("projectRecurringDelay")?.value || "after";
  const mode = document.querySelector('input[name="projectMode"]:checked')?.value || "optimize";
  const monthLabelText = mode === "fixed" ? qs("projectMonth")?.selectedOptions?.[0]?.textContent || "mes manual" : "mes óptimo";
  const total = round2(amount + recurringAmount * recurringDuration);
  element.innerHTML = `<strong>${editingProjectId ? "Editando plan" : "Resumen del plan"}</strong>
    <div class="project-preview-grid">
      <span>Inicio: ${escapeHtml(monthLabelText)}</span>
      <span>Coste total: ${money(total, true)}</span>
      <span>Inicial: ${money(amount, true)} en ${duration} mes(es)</span>
      <span>Recurrente: ${recurringAmount ? `${money(recurringAmount, true)} durante ${recurringDuration} mes(es), ${recurringDelay === "same" ? "desde el mismo mes" : "tras el impacto inicial"}` : "sin cuota recurrente"}</span>
    </div>`;
  qs("addProject").textContent = editingProjectId ? "Guardar plan" : "Añadir plan";
  qs("cancelProjectEdit").hidden = !editingProjectId;
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

function selectableMonths() {
  try {
    if (baseData && state) return forecastMonths();
  } catch (error) {
    // Fall back to the imported workbook months while the app is still booting.
  }
  return baseData?.monthlyPlanning?.months || [];
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
  return actualAwareInfo(scopedRow, month);
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
      if (seriesOverrideForRow(row, month)?.deleted) return false;
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
  return plannedValueForVisualRow(row, month) || "";
}

function visualSectionTotal(section, rows, months, mode, month) {
  return rows.reduce((sum, row) => {
    if (isVisualRowPendingDelete(seriesKeyForRow(row))) return sum;
    if (seriesOverrideForRow(row, month)?.deleted) return sum;
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

  months.forEach((month) => {
    if (row.custom && row.monthKey !== month.key) return;
    seriesOverrides[overrideKeyForRow(row, month)] = { deleted: true };
  });
  return before !== customPlanningRows.length;
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
        body.push(`<tr class="visual-line-row visual-project-row ${pendingDelete ? "pending-delete" : ""}">
          <td>
            <input class="visual-label-input derived-control" value="${escapeHtml(project.name)}" readonly />
            <small>${escapeHtml(project.status === "optimized" ? "mes óptimo" : "mes manual")} · ${escapeHtml(project.monthLabel)}${pendingDelete ? " · se borrará al guardar" : ""}</small>
          </td>
          ${columns
            .map((column) => {
              const value = sumColumnMonths(column, (month) => project.values[monthIndexByKey.get(month.key)] || 0);
              if (compactYears && column.kind === "year-summary") return `<td class="visual-year-cell negative">${value ? money(value, true) : ""}</td>`;
              return `<td><input class="visual-amount-input derived-control" type="number" step="0.01" value="${value ? amountInputValue(value) : ""}" readonly /></td>`;
            })
            .join("")}
          <td><button class="row-delete-button" type="button" data-visual-project-delete="${escapeHtml(project.id)}" ${pendingDelete ? "disabled" : ""}>${pendingDelete ? "Pendiente" : "Eliminar"}</button></td>
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
  const result = row.netBeforeSaving ?? Number(row.totalLiquidity || 0) - Number(row.startLiquidity || 0);
  const max = Number(row.startLiquidity || 0) + result;
  const min = Number(row.startLiquidity || 0) - outflowsBeforeIncome;
  const adjustedMin = min + Number(row.prePayrollIncome || 0);
  return {
    result,
    max,
    min,
    adjustedMax: max,
    adjustedMin,
  };
}

function previsionYears() {
  return [...new Set(lastSimulation.map((row) => cashflowYear(row)))].filter(Boolean);
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
    .filter((item) => cashflowYear(item.row) === year);
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
    max: maxItem.metric.max,
    maxMonth: maxItem.row.month,
    adjustedMin: adjustedMinItem.metric.adjustedMin,
    adjustedMinMonth: adjustedMinItem.row.month,
    adjustedIncome: Number(adjustedMinItem.row.prePayrollIncome || 0),
  };
}

function renderVisualRangeKpis() {
  const panel = qs("visualRangeKpis");
  if (!panel) return;
  const metrics = rangeKpiMetric(lastSimulation);
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
        <p>${escapeHtml(metrics.adjustedMinMonth)} · mínimo antes de nómina Javi, sumando Tere + local (${money(metrics.adjustedIncome, true)}).</p>
      </div>
      <div class="range-kpi-card minimum">
        <span>Min</span>
        <strong>${money(metrics.min, true)}</strong>
        <p>${escapeHtml(metrics.minMonth)} · peor punto de caja antes de cobrar los ingresos principales del mes.</p>
      </div>
      <div class="range-kpi-card maximum">
        <span>Max</span>
        <strong>${money(metrics.max, true)}</strong>
        <p>${escapeHtml(metrics.maxMonth)} · mayor liquidez estimada con proyectos, deuda y ahorro aplicados.</p>
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

  qs("previsionSummary").innerHTML = [
    ["Resultado anual", money(resultYear, true), resultYear >= 0 ? "positive" : "negative"],
    ["Saldo máximo", money(maxTotal, true), "positive"],
    ["Mínimo", money(minTotal, true), minTotal < 0 ? "negative" : ""],
    ["Mínimo ajustado", `${money(minAdjusted, true)} · ${worstItem.row.month}`, minAdjusted < 0 ? "negative" : ""],
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
  return lastSimulation.slice(0, Math.min(months, lastSimulation.length));
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
  const operationalAverage = round2(averageRows(first12, (row) => row.coreSpend));
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
  ["otherFixedNonDebt", "Gasto operativo medio", "€"],
  ["variableSpendTarget", "Objetivo variable revisable", "€"],
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
  if (key === "otherFixedNonDebt") return detected.operationalAverage;
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
  if (key === "otherFixedNonDebt") return `Media real/proyectada de gasto operativo ${monthLabelText}, excluyendo coche, financiación y proyectos.`;
  if (key === "variableSpendTarget") return "Objetivo de control manual; se compara contra el gasto operativo real calculado.";
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
  const operationalMonthlyTotal = detected.operationalAverage;
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
    ["Gasto operativo próximo 12m", "CoreSpend del modelo / 12", "Gastos no clasificados como coche, financiación o proyectos.", money(calc.operationalMonthlyTotal, true), calc.operationalMonthlyTotal > 0 ? "OK si el detalle visual contiene todos los gastos recurrentes." : "Revisar: gasto operativo a cero."],
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
        const planned = plannedValueForRow(row, month);
        const key = actualKeyForRow(row, month);
        const stored = actuals[key];
        const hasActual = stored !== undefined && stored !== "";
        if (hasActual) {
          sectionCapturedRows += 1;
          sectionActual += Number(stored);
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
        const planned = plannedValueForRow(row, month);
        const key = actualKeyForRow(row, month);
        const deleteKey = deleteKeyForRow(row, month);
        const stored = actuals[key];
        const hasActual = stored !== undefined && stored !== "";
        const actual = hasActual ? Number(stored) : "";
        const variance = hasActual ? Number(actual) - planned : "";
        const varianceClass = varianceClassForKind(kind, variance);
        html.push(`<tr class="planning-line-row ${row.custom ? "custom-line" : ""}" data-parent-section="${escapeHtml(sectionKey)}">
          <td>${escapeHtml(section.name)}</td>
          <td>${escapeHtml(displayLabelForRow(row))}${row.custom ? " <small>nuevo</small>" : ""}</td>
          <td>${money(planned, true)}</td>
          <td><input ${actualDataKey}="${key}" type="number" step="0.01" value="${hasActual ? actual : ""}" placeholder="Real" /></td>
          <td class="${varianceClass}">${hasActual ? money(variance, true) : ""}</td>
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
        const key = seriesKeyForRow(row);
        if (seen.has(key)) return;
        seen.add(key);
        rows.push({ ...row, sectionName: section.name });
      });
    });
  customPlanningRows
    .filter((row) => row.kind === kind)
    .forEach((row) => {
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
  return months.slice(from, to + 1).map((month, offset) => ({ ...month, index: from + offset }));
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
  const planning = baseData.monthlyPlanning;
  const signature = `${forecast.map((month) => month.key).join("|")}::${planning.months.map((month) => month.key).join("|")}`;
  if (!force && selectorSignature === signature) return;
  selectorSignature = signature;
  const previousProjectMonth = qs("projectMonth")?.value;
  const previousDebtMonth = qs("debtPayoffMonth")?.value;
  const previousDetailMonth = qs("detailMonth")?.value;
  const projectOptions = forecast
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

  const planningOptions = planning.months
    .map((month, index) => `<option value="${index}">${month.label}</option>`)
    .join("");
  qs("detailMonth").innerHTML = planningOptions;
  const forecastStartKey = forecast[0]?.key || baseData.metadata.forecastStart.slice(0, 7);
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
  const lines = lastSimulation.map((row, index) => {
    const base = lastBaseSimulation[index] || row;
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
  link.download = "simulacion_financiera_hasta_2040.csv";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1000);
}

function renderActiveSection(viewId = viewFromHash()) {
  if (!lastSimulation.length) return;
  switch (viewId) {
    case "visual-detail":
      renderVisualDetail();
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
  const rows = lastSimulation.length ? lastSimulation : simulate(projectPlan.outflows || []);
  const baseRows = lastBaseSimulation.length ? lastBaseSimulation : simulate();
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
  populateSelectors();
  lastBaseSimulation = simulate();
  projectPlan = buildProjectSchedule();
  lastSimulation = simulate(projectPlan.outflows);
  lastPlannedSimulation = simulate(projectPlan.outflows, { useActuals: false });
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
    baseData = window.FINANCE_DATA;
  } else {
    const response = await fetch("../data/finance_data.json");
    baseData = await response.json();
  }
  loadWorkbookOverride();
  loadLocalState();
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
  ["projectName", "projectAmount", "projectDuration", "projectRecurringAmount", "projectRecurringDuration", "projectRecurringDelay", "projectMonth"].forEach((id) => {
    qs(id)?.addEventListener("input", renderProjectPlanPreview);
    qs(id)?.addEventListener("change", renderProjectPlanPreview);
  });
  qs("clearProjects").addEventListener("click", handleClearProjects);
  qs("addDebtPayoff").addEventListener("click", handleAddDebtLiquidation);
  qs("debtTargetSelect").addEventListener("change", () => updateDebtTargetDefaults(true));
  qs("debtPayoffMode").addEventListener("change", () => {
    updateDebtModeUi();
    renderDebtControl();
  });
  ["debtPayoffAmount", "debtPayoffRelief", "debtPayoffDuration", "debtPayoffMonth"].forEach((id) => {
    qs(id).addEventListener("input", renderDebtControl);
    qs(id).addEventListener("change", renderDebtControl);
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
  qs("clearBatchData").addEventListener("click", () => {
    qs("batchDataInput").value = "";
    showImportLog("Lote limpio", "Puedes pegar una nueva tabla cuando quieras.");
  });
  qs("excelDataFile").addEventListener("change", handleExcelImport);
  qs("detailMonth").addEventListener("change", renderMonthlyDetails);
  document.querySelectorAll('input[name="projectMode"]').forEach((input) => {
    input.addEventListener("change", updateProjectModeUi);
  });
  document.querySelectorAll(".mode-switch label").forEach((label) => {
    label.addEventListener("click", () => {
      const input = label.querySelector('input[name="projectMode"]');
      if (input) setProjectMode(input.value);
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
