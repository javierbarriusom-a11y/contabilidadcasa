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
let memoryStorage = {};
let supabaseClient = null;
let remoteUser = null;
let remoteSaveTimer = null;
let remoteSaveInFlight = false;
let selectedCashflowIndex = null;
let expandedCashflowYears = new Set();
let expandedVisualSections = new Set();
let visualDraftCells = {};
let visualDraftLabels = {};
let visualDraftDeletes = {};
let visualDraftProjectDeletes = {};
let visualSelectedRows = new Set();
let expandedPlanningSections = {
  income: new Set(),
  expense: new Set(),
};

const WORKBOOK_OVERRIDE_KEY = "financeDashboard:workbookOverride:v1";
const REMOTE_SOURCE_KEY = "finance-dashboard-main";

const viewTitles = {
  overview: {
    eyebrow: "Cuadro de mando financiero",
    title: "Planifica liquidez, ahorro y refinanciación desde la fecha de análisis",
  },
  "visual-detail": {
    eyebrow: "Detalle visual",
    title: "Edita la matriz mensual como en Contabilidad New Life",
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
  "monthly-detail": {
    eyebrow: "Contabilidad New Life",
    title: "Controla ingresos y gastos previstos frente a reales",
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

function modelMonthCount() {
  const planningCount = baseData.monthlyPlanning?.months?.length || baseData.metadata.forecastMonths;
  return Math.min(baseData.metadata.forecastMonths + 1, Math.max(1, planningCount - modelStartIndex()));
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
  };
}

function applyPersistedPayload(payload = {}) {
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
  }
}

function normalizeLoadedProjects() {
  const months = forecastMonths();
  let changed = false;
  const normalizeItem = (project) => {
    if (project.mode !== "fixed" && project.mode !== "spread") return project;
    const next = { ...project };
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
  const id = (window.location.hash || "#overview").replace("#", "");
  if (id === "monthly-detail") return "overview";
  return document.getElementById(id)?.classList.contains("view-section") ? id : "overview";
}

function setActiveView(viewId = viewFromHash()) {
  document.querySelectorAll(".view-section").forEach((section) => {
    section.hidden = section.id !== viewId && !(viewId === "overview" && section.id === "monthly-detail");
  });
  document.querySelectorAll(".side-nav a").forEach((link) => {
    const isActive = link.getAttribute("href") === `#${viewId}`;
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  const copy = viewTitles[viewId] || viewTitles.overview;
  if (qs("viewEyebrow")) qs("viewEyebrow").textContent = copy.eyebrow;
  if (qs("viewTitle")) qs("viewTitle").textContent = copy.title;
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
  return basePlannedValueForRow(row, month);
}

function basePlannedValueForRow(row, month) {
  return row.custom ? Number(row.plannedValue || 0) : Number(row.planned[month.index] || 0);
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
  const months = baseData.monthlyPlanning?.months || [];
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
  const rawRows = window.XLSX.utils.sheet_to_json(sheet, { range: 2, defval: "", raw: true });
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
        month: date.slice(0, 7),
      };
      transaction.category = classifyTransaction(transaction);
      return transaction;
    })
    .filter(Boolean);
}

function loadTransactionsFromWorkbook(workbook) {
  const movementSheets = workbook.SheetNames.filter((name) =>
    normalizedText(name).replace(/[^a-z0-9]/g, "").startsWith("movimientoscuenta"),
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

function sectionWorkbookTotal(section, month) {
  if (!Array.isArray(section.totals) || section.totals[month.index] === undefined) return null;
  return Number(section.totals[month.index] || 0);
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
  const foundIndex = planning.months.findIndex((month) => month.key === key);
  const index =
    foundIndex >= 0
      ? foundIndex
      : Math.min(Math.max(0, forecastIndex), planning.months.length - 1);
  return { ...planning.months[index], index };
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
    const workbookTotal = sectionWorkbookTotal(section, month);
    const sourceRows = workbookTotal === null ? section.rows.filter((row) => !row.custom) : section.sourceRows || section.rows.filter((row) => !row.custom);
    const customRows = section.rows.filter((row) => row.custom);
    const calculationRows = [...sourceRows, ...customRows];
    let rowTotal = 0;
    let sectionDelta = 0;
    let sectionCoreSpend = 0;
    let sectionCar = 0;
    let sectionRefi = 0;
    let sectionPrePayrollIncome = 0;

    calculationRows.forEach((row) => {
      const deleted = deletedPlanningRows[deleteKeyForRow(row, month)] || seriesOverrideForRow(row, month)?.deleted;
      const value = deleted ? 0 : useActuals ? actualAwareValue(row, month) : plannedValueForRow(row, month);
      const baseValue = row.custom ? 0 : basePlannedValueForRow(row, month);
      rowTotal += value;
      sectionDelta += row.custom ? value : value - baseValue;
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

    const sectionTotal = workbookTotal === null ? rowTotal : workbookTotal + sectionDelta;
    const workbookAdjustment = workbookTotal === null ? 0 : sectionTotal - rowTotal;
    if (section.kind === "income") {
      breakdown.income += sectionTotal;
      breakdown.prePayrollIncome += sectionPrePayrollIncome;
      return;
    }
    if (section.kind !== "expense") return;

    breakdown.expenseTotal += sectionTotal;
    breakdown.car += sectionCar;
    breakdown.refi += sectionRefi;
    breakdown.coreSpend += sectionCoreSpend + workbookAdjustment;
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

function projectsForForecastIndex(forecastIndex) {
  return projectPlan.placements
    .filter((project) => {
      const duration = Math.max(1, Number(project.duration || 1));
      return forecastIndex >= project.startIndex && forecastIndex < project.startIndex + duration;
    })
    .map((project) => ({
      ...project,
      monthlyAmount: Number(project.amount || 0) / Math.max(1, Number(project.duration || 1)),
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
  addHelpToControl("projectAmount", "Coste total del proyecto. Si dura varios meses, se reparte linealmente.");
  addHelpToControl("projectDuration", "Número de meses durante los que se reparte el importe total.");
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
  qs("kpiEndingDelta").textContent = projects.length
    ? `${endingDelta >= 0 ? "+" : ""}${money(endingDelta, true)} vs. sin proyectos`
    : "Sin proyectos cargados";
  qs("kpiEndingDelta").className = endingDelta < 0 ? "negative" : "positive";
  qs("miniSavingsRate").textContent = `${(savingsRate * 100).toFixed(0)}%`;
  qs("miniRunway").textContent = bufferMonths.toFixed(1);
  qs("miniDebtShift").textContent = money(oldCreditAverage);

  if (first.netBeforeSaving <= 0) {
    qs("scenarioStatus").textContent = "Necesita ajustar gasto o ahorro antes de ejecutarlo.";
  } else if (bufferMonths < state.emergencyBufferMonths) {
    qs("scenarioStatus").textContent = "Viable, pero conviene reforzar colchón al inicio.";
  } else if (projects.length && endingDelta < 0) {
    qs("scenarioStatus").textContent = `Proyectos cargados: impacto ${money(endingDelta)} al final.`;
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

  if (projects.length) {
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

  const legendItems = projects.length
    ? [
        { label: "Cuenta", color: "#2c6be0" },
        { label: "Ahorro", color: "#267f4e" },
        { label: "Total con", color: "#6657d2" },
        { label: "Total sin", color: "#7a8890", dashed: true },
      ]
    : series.map((serie) => ({ label: serie.label, color: serie.color }));

  legendItems.forEach((serie, idx) => {
    const x0 = width - pad.right - (projects.length ? 330 : 230) + idx * (projects.length ? 82 : 78);
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
  const totalProjects = projects.reduce((sum, project) => sum + Number(project.amount || 0), 0);
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

  if (projects.length) {
    list.push({
      type: projectImpact < 0 ? "warning" : "good",
      title: "Impacto de proyectos visible",
      body: `Hay ${projects.length} proyecto(s) por ${money(totalProjects, true)}. La liquidez final cambia ${projectImpact >= 0 ? "+" : ""}${money(projectImpact, true)} frente al escenario sin proyectos.`,
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
        `<div class="advice-item ${item.type}"><strong>${item.title}</strong><p>${item.body}</p></div>`,
    )
    .join("");
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
      mode: item.mode === "spread" ? "fixed" : item.mode,
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
      addProjectOutflow(outflows, project, startIndex);
      placements.push({ ...project, startIndex, status: project.source === "debt" ? "debt" : "fixed", monthLabel: months[startIndex].label });
    } else {
      optimizable.push(project);
    }
  });

  optimizable
    .slice()
    .sort((a, b) => Number(b.amount) / Number(b.duration || 1) - Number(a.amount) / Number(a.duration || 1))
    .forEach((project) => {
      const duration = Math.max(1, Number(project.duration || 1));
      let best = null;
      for (let startIndex = 0; startIndex <= months.length - duration; startIndex += 1) {
        const candidate = outflows.slice();
        addProjectOutflow(candidate, project, startIndex);
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
  const amount = Number(qs("projectAmount").value);
  const duration = Math.max(1, Number(qs("projectDuration").value || 1));
  const mode = document.querySelector('input[name="projectMode"]:checked')?.value || "optimize";
  const monthIndex = Number(qs("projectMonth").value || 0);
  const monthKeyForProject = forecastMonths()[monthIndex]?.key;
  if (!amount || amount <= 0) return;

  projects.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    amount,
    duration,
    mode,
    monthIndex,
    monthKey: monthKeyForProject,
  });
  qs("projectName").value = "";
  qs("projectAmount").value = "";
  qs("projectDuration").value = 1;
  document.querySelector('input[name="projectMode"][value="optimize"]').checked = true;
  updateProjectModeUi();
  saveProjects();
  render();
}

function removeProject(id) {
  projects = projects.filter((project) => project.id !== id);
  saveProjects();
  render();
}

function removeDebtLiquidation(id) {
  debtLiquidations = debtLiquidations.filter((item) => item.id !== id);
  saveDebtLiquidations();
  render();
}

function debtControlStats() {
  const oldDebt = Number(baseData?.derived?.oldCreditPrincipal || baseData?.sourcePlan?.oldDebtPrincipal || 0);
  const oldMonthly = Number(baseData?.derived?.oldCreditMonthlyAverageJanMar2026 || baseData?.sourcePlan?.oldDebtMonthlyPayments || 0);
  const remainingPlanDebt = lastBaseSimulation.length ? sumRows(lastBaseSimulation, (row) => row.refi) : Number(baseData?.sourcePlan?.debtServiceMonthlyTotal || 0);
  const currentMonthly12 = lastBaseSimulation.length
    ? averageRows(lastBaseSimulation.slice(0, Math.min(12, lastBaseSimulation.length)), (row) => row.refi)
    : Number(baseData?.assumptions?.refiLaterPayment || 0);
  const liquidationTotal = debtLiquidations.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return {
    oldDebt,
    oldMonthly,
    remainingPlanDebt,
    currentMonthly12,
    liquidationTotal,
    afterLiquidations: Math.max(0, remainingPlanDebt - liquidationTotal),
    monthlyRelief: Math.max(0, oldMonthly - currentMonthly12),
  };
}

function handleAddDebtLiquidation() {
  const amount = parseAmount(qs("debtPayoffAmount").value);
  if (!amount || amount <= 0) return;
  const mode = qs("debtPayoffMode").value || "fixed";
  const duration = mode === "spread" ? Math.max(1, Number(qs("debtPayoffDuration").value || 1)) : 1;
  const monthIndex = Number(qs("debtPayoffMonth").value || 0);
  const monthKeyForDebt = forecastMonths()[monthIndex]?.key;
  debtLiquidations.push({
    id: `debt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: qs("debtPayoffName").value.trim() || "Liquidación deuda",
    amount: round2(amount),
    duration,
    mode: "fixed",
    payoffMode: mode,
    monthIndex,
    monthKey: monthKeyForDebt,
  });
  qs("debtPayoffName").value = "";
  qs("debtPayoffAmount").value = "";
  qs("debtPayoffDuration").value = 1;
  saveDebtLiquidations();
  render();
}

function renderDebtPayoffChart() {
  const svg = qs("debtPayoffChart");
  if (!svg) return;
  const months = forecastMonths().slice(0, 36);
  const values = months.map((month) =>
    projectPlan.placements
      .filter((item) => item.source === "debt")
      .reduce((sum, item) => {
        const duration = Math.max(1, Number(item.duration || 1));
        const active = month.index >= item.startIndex && month.index < item.startIndex + duration;
        return sum + (active ? Number(item.amount || 0) / duration : 0);
      }, 0),
  );
  const width = svg.clientWidth || 520;
  const height = 180;
  const pad = { left: 42, right: 12, top: 14, bottom: 34 };
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const max = Math.max(...values, 1);
  const barW = (width - pad.left - pad.right) / Math.max(values.length, 1);
  svg.innerHTML = values
    .map((value, index) => {
      const h = ((height - pad.top - pad.bottom) * value) / max;
      const x = pad.left + index * barW + 2;
      const y = height - pad.bottom - h;
      const label = index % 6 === 0 ? `<text class="chart-label" x="${x}" y="${height - 10}">${months[index].label}</text>` : "";
      return `<rect class="bar debt-bar" x="${x}" y="${y}" width="${Math.max(3, barW - 4)}" height="${h}" rx="3"></rect>${label}`;
    })
    .join("");
}

function renderDebtControl() {
  if (!qs("debtControlSummary")) return;
  const stats = debtControlStats();
  qs("debtControlSummary").innerHTML = [
    ["Debía antes", money(stats.oldDebt, true), ""],
    ["Pago mensual anterior", money(stats.oldMonthly, true), "negative"],
    ["Deuda futura plan", money(stats.remainingPlanDebt, true), ""],
    ["Tras liquidaciones", money(stats.afterLiquidations, true), stats.afterLiquidations < stats.remainingPlanDebt ? "positive" : ""],
  ]
    .map(([label, value, klass]) => `<div class="expense-summary-card"><span>${label}</span><strong class="${klass}">${value}</strong></div>`)
    .join("");

  qs("debtPayoffList").innerHTML = debtLiquidations.length
    ? debtLiquidations
        .map((item) => {
          const monthly = Number(item.amount || 0) / Math.max(1, Number(item.duration || 1));
          const month = forecastMonths().find((candidate) => candidate.key === item.monthKey) || forecastMonths()[item.monthIndex || 0];
          return `<div class="project-item debt-item">
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <p>${money(item.amount, true)} desde ${escapeHtml(month?.label || "")}, ${item.duration} mes(es). Impacto mensual: ${money(monthly, true)}.</p>
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
  projects = [];
  saveProjects();
  render();
}

function renderProjectSimulator(baseRows, rows) {
  const baseEnding = baseRows[baseRows.length - 1].totalLiquidity;
  const ending = rows[rows.length - 1].totalLiquidity;
  const impact = ending - baseEnding;
  const totalProjects = [...projects, ...debtLiquidations].reduce((sum, project) => sum + Number(project.amount || 0), 0);
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
      '<div class="project-item"><div><strong>Sin proyectos cargados</strong><p>Añade un importe y elige mes fijo u optimización automática.</p></div></div>';
    return;
  }

  qs("projectList").innerHTML = projectPlan.placements
    .map((project) => {
      const monthly = Number(project.amount || 0) / Math.max(1, Number(project.duration || 1));
      const statusText =
        project.status === "debt"
          ? "Liquidación de deuda programada"
          : project.status === "fixed"
          ? "Mes fijado manualmente"
          : project.status === "warning"
            ? "Sin hueco plenamente cómodo; colocado en el mejor mes disponible"
            : "Mes optimizado automáticamente";
      return `<div class="project-item ${project.status === "warning" ? "warning" : ""}">
        <div>
          <strong>${project.name}</strong>
          <p>${money(project.amount, true)} en ${project.duration} mes(es), desde ${project.monthLabel}. ${statusText}. Impacto mensual: ${money(monthly, true)}.</p>
        </div>
        <button data-remove-project="${project.id}" data-remove-project-source="${project.source || "project"}">Quitar</button>
      </div>`;
    })
    .join("");

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
  const maxMonthlyImpact = Math.max(...rows.map((row) => row.projectOutflow || 0), 0);

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

  const impactedMonths = rows
    .map((row, index) => ({ row, index }))
    .filter((item) => item.row.projectOutflow > 0)
    .slice(0, 7);

  qs("projectGlobalTimeline").innerHTML = impactedMonths.length
    ? impactedMonths
        .map(({ row }) => {
          const width = maxMonthlyImpact ? Math.max(4, (row.projectOutflow / maxMonthlyImpact) * 100) : 0;
          const delta = row.totalLiquidity - (baseRows[row.index - 1]?.totalLiquidity || row.totalLiquidity);
          return `<div class="timeline-item">
            <span>${row.month}</span>
            <div class="timeline-bar"><i style="width:${width.toFixed(1)}%"></i></div>
            <strong class="${delta < 0 ? "negative" : "positive"}">${money(delta, true)}</strong>
          </div>`;
        })
        .join("")
    : '<p class="month-detail-empty">Sin proyectos cargados: la curva coincide con el escenario base.</p>';
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

  if (projects.length) {
    svg.insertAdjacentHTML("beforeend", `<path d="${impactArea}" fill="#c44945" opacity="0.08" />`);
  }

  svg.insertAdjacentHTML(
    "beforeend",
    `<path d="${pathFor(baseRows, "totalLiquidity")}" fill="none" stroke="#7a8890" stroke-width="2.2" stroke-dasharray="6 6" stroke-linecap="round" />
     <path d="${pathFor(rows, "totalLiquidity")}" fill="none" stroke="#6657d2" stroke-width="3" stroke-linecap="round" />`,
  );

  chartTickIndexes(rows).forEach((idx) => {
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
     <text class="legend" x="${legendX + 20}" y="42">Sin proyectos</text>`,
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
  const maxMonthly = Math.max(...monthly, 0);
  const minDelta = Math.min(...deltas, 0);
  const maxDelta = Math.max(...deltas, 0);
  const yMax = Math.max(maxMonthly, Math.abs(minDelta), Math.abs(maxDelta), 1);
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const barW = Math.max(2, plotW / rows.length - 2);
  const x = (i) => pad.left + (i / rows.length) * plotW;
  const yBar = (value) => height - pad.bottom - (value / yMax) * plotH;
  const yDelta = (value) => height - pad.bottom - ((value + yMax) / (yMax * 2)) * plotH;
  const totalImpact = deltas[deltas.length - 1] || 0;
  const loadedMonths = monthly.filter(Boolean).length;

  qs("impactChartTitle").textContent = projects.length
    ? `${loadedMonths} mes(es) con impacto · ${totalImpact >= 0 ? "+" : ""}${money(totalImpact)} al final`
    : "Sin impactos cargados";

  svg.insertAdjacentHTML(
    "beforeend",
    `<line class="tick" x1="${pad.left}" x2="${width - pad.right}" y1="${height - pad.bottom}" y2="${height - pad.bottom}" />
     <text class="chart-label" x="0" y="${height - pad.bottom + 4}">0 €</text>`,
  );

  monthly.forEach((value, index) => {
    if (!value) return;
    const h = height - pad.bottom - yBar(value);
    svg.insertAdjacentHTML(
      "beforeend",
      `<rect x="${x(index)}" y="${yBar(value)}" width="${barW}" height="${h}" rx="2" fill="#c44945" opacity="0.78" />`,
    );
  });

  if (projects.length) {
    const path = deltas
      .map((value, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${yDelta(value).toFixed(2)}`)
      .join(" ");
    svg.insertAdjacentHTML(
      "beforeend",
      `<path d="${path}" fill="none" stroke="#6657d2" stroke-width="2.5" stroke-linecap="round" />
       <circle cx="${x(deltas.length - 1)}" cy="${yDelta(deltas[deltas.length - 1])}" r="4" fill="#6657d2" stroke="#fff" stroke-width="2" />`,
    );
  }

  chartTickIndexes(rows).forEach((idx) => {
    svg.insertAdjacentHTML(
      "beforeend",
      `<text class="chart-label" x="${x(idx) - 14}" y="${height - 6}">${rows[idx].month}</text>`,
    );
  });
}

function updateProjectModeUi() {
  const mode = document.querySelector('input[name="projectMode"]:checked')?.value || "optimize";
  const monthSelect = qs("projectMonth");
  const monthField = qs("projectMonthField");
  const isManual = mode === "fixed";
  monthSelect.disabled = !isManual;
  monthField.classList.toggle("month-disabled", !isManual);
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
  return {
    startLiquidity: first.row.startLiquidity,
    income: group.items.reduce((sum, item) => sum + item.row.income, 0),
    coreSpend: group.items.reduce((sum, item) => sum + item.row.coreSpend, 0),
    car: group.items.reduce((sum, item) => sum + item.row.car, 0),
    refi: group.items.reduce((sum, item) => sum + item.row.refi, 0),
    projectOutflow: group.items.reduce((sum, item) => sum + item.row.projectOutflow, 0),
    savingBase: group.items.reduce((sum, item) => sum + item.base.saving, 0),
    saving: group.items.reduce((sum, item) => sum + item.row.saving, 0),
    checkingBase: last.base.checking,
    checking: last.row.checking,
    liquidityBase: last.base.totalLiquidity,
    liquidity: last.row.totalLiquidity,
    impact: last.row.totalLiquidity - last.base.totalLiquidity,
  };
}

function renderCashflowYearRow(group) {
  const expanded = expandedCashflowYears.has(group.year);
  const summary = summarizeCashflowYear(group);
  return `<tr class="cashflow-year-row ${expanded ? "expanded" : ""}" data-cashflow-year="${group.year}" tabindex="0" role="button" aria-expanded="${expanded ? "true" : "false"}">
    <td><span class="cashflow-toggle">${expanded ? "-" : "+"}</span><strong>${group.year}</strong> <small>${group.items.length} meses</small></td>
    <td>${money(summary.startLiquidity, true)}</td>
    <td class="positive">${money(summary.income, true)}</td>
    <td class="negative">${money(summary.coreSpend, true)}</td>
    <td class="negative">${money(summary.car, true)}</td>
    <td class="negative">${money(summary.refi, true)}</td>
    <td class="${summary.projectOutflow ? "negative" : ""}">${money(summary.projectOutflow, true)}</td>
    <td>${money(summary.savingBase, true)}</td>
    <td>${money(summary.saving, true)}</td>
    <td>${money(summary.checkingBase, true)}</td>
    <td class="${summary.checking < 0 ? "negative" : ""}">${money(summary.checking, true)}</td>
    <td>${money(summary.liquidityBase, true)}</td>
    <td>${money(summary.liquidity, true)}</td>
    <td class="${summary.impact < 0 ? "negative" : summary.impact > 0 ? "positive" : ""}">${money(summary.impact, true)}</td>
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
    return '<p class="month-detail-empty">Sin proyectos o imprevistos cargados en este mes.</p>';
  }

  return projectsInMonth
    .map(
      (project) => `<div class="month-detail-line">
        <div>
          <strong>${escapeHtml(project.name)}</strong>
          <span>${project.status === "fixed" ? "Mes manual" : "Mes optimizado"} · ${project.duration} mes(es)</span>
        </div>
        <strong class="negative">${money(project.monthlyAmount, true)}</strong>
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
    <td colspan="14">
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

  qs("cashflowRows").innerHTML = groups
    .map((group) => {
      const yearRow = renderCashflowYearRow(group);
      if (!expandedCashflowYears.has(group.year)) return yearRow;

      const monthRows = group.items
        .map(({ row, base, index }) => {
          const liquidityImpact = row.totalLiquidity - base.totalLiquidity;
          const checkingImpact = row.checking - base.checking;
          const isSelected = selectedCashflowIndex === index;
          const mainRow = `<tr class="cashflow-row ${isSelected ? "selected" : ""}" data-cashflow-index="${index}" tabindex="0" role="button" aria-expanded="${isSelected ? "true" : "false"}" title="Ver detalle de ${row.month}">
        <td><span class="cashflow-toggle">${isSelected ? "-" : "+"}</span>${row.month}</td>
        <td>${money(row.startLiquidity, true)}</td>
        <td class="positive">${money(row.income, true)}</td>
        <td class="negative">${money(row.coreSpend, true)}</td>
        <td class="negative">${money(row.car, true)}</td>
        <td class="negative">${money(row.refi, true)}</td>
        <td class="${row.projectOutflow ? "negative" : ""}">${money(row.projectOutflow, true)}</td>
        <td>${money(base.saving, true)}</td>
        <td>${money(row.saving, true)}</td>
        <td>${money(base.checking, true)}</td>
        <td class="${row.checking < 0 ? "negative" : ""}">${money(row.checking, true)}</td>
        <td>${money(base.totalLiquidity, true)}</td>
        <td>${money(row.totalLiquidity, true)}</td>
        <td class="${liquidityImpact < 0 ? "negative" : liquidityImpact > 0 ? "positive" : ""}" title="Impacto en cuenta: ${money(checkingImpact, true)}">${money(liquidityImpact, true)}</td>
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
  const planning = baseData.monthlyPlanning;
  const forecastStartKey = forecastMonths()[0]?.key || baseData.metadata.forecastStart.slice(0, 7);
  const found = planning.months.findIndex((month) => month.key === forecastStartKey);
  return Math.max(0, found);
}

function monthOptionsHtml(selectedKey = "") {
  return baseData.monthlyPlanning.months
    .map((month) => `<option value="${month.key}" ${month.key === selectedKey ? "selected" : ""}>${escapeHtml(month.label)}</option>`)
    .join("");
}

function populateVisualControls() {
  const months = baseData.monthlyPlanning?.months || [];
  if (!months.length || !qs("visualStartMonth")) return;
  const defaultStart = visualDefaultStartIndex();
  const defaultEnd = Math.min(defaultStart + 17, months.length - 1);
  const selectIds = ["visualStartMonth", "visualEndMonth", "visualAddStartMonth", "visualAddEndMonth"];
  selectIds.forEach((id) => {
    const select = qs(id);
    if (!select) return;
    const previous = select.value;
    const fallbackIndex = id.includes("End") ? defaultEnd : defaultStart;
    const selected = months.some((month) => month.key === previous) ? previous : months[fallbackIndex]?.key;
    select.innerHTML = monthOptionsHtml(selected);
    select.value = selected;
  });
  populateVisualAddSections();
}

function populateVisualAddSections() {
  const kind = qs("visualAddKind")?.value || "expense";
  const sectionSelect = qs("visualAddSection");
  if (!sectionSelect) return;
  const previous = sectionSelect.value;
  sectionSelect.innerHTML = baseData.monthlyPlanning.sections
    .filter((section) => section.kind === kind)
    .map((section) => `<option value="${escapeHtml(section.name)}">${escapeHtml(section.name)}</option>`)
    .join("");
  if ([...sectionSelect.options].some((option) => option.value === previous)) sectionSelect.value = previous;
}

function visualMonths() {
  const months = baseData.monthlyPlanning.months;
  const startKey = qs("visualStartMonth")?.value || months[visualDefaultStartIndex()]?.key;
  const endKey = qs("visualEndMonth")?.value || months[Math.min(visualDefaultStartIndex() + 17, months.length - 1)]?.key;
  return monthsInRange(startKey, endKey);
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
        const active =
          forecastIndex !== undefined &&
          forecastIndex >= project.startIndex &&
          forecastIndex < project.startIndex + duration;
        return active ? monthlyAmount : 0;
      });
      return { ...project, monthlyAmount, values };
    })
    .filter((project) => project.values.some((value) => value !== 0));
}

function updateVisualCell(input) {
  const row = rowForSeriesKey(input.dataset.rowKey);
  const month = baseData.monthlyPlanning.months.find((item) => item.key === input.dataset.monthKey);
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
    ? `Se guardarán: ${parts.join(", ")}. Los cambios afectarán a Detalle visual, Previsión, flujo de caja, simulador y detalle mensual.`
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
    const month = baseData.monthlyPlanning.months.find((item) => item.key === draft.monthKey);
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
  const mode = qs("visualValueMode")?.value || "planned";
  const monthHeaders = months.map((month) => `<th>${escapeHtml(month.label)}</th>`).join("");
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
    const sectionTotals = months.map((month) => round2(visualSectionTotal(section, rows, months, mode, month)));
    sectionTotals.forEach((value) => {
      if (section.kind === "income") totals.income += value;
      else totals.expense += value;
    });
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
        ${months
          .map((month) => {
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
    const sectionTotals = months.map((_, index) =>
      round2(projectRows.reduce((sum, project) => sum + (isVisualProjectPendingDelete(project.id) ? 0 : project.values[index]), 0)),
    );
    sectionTotals.forEach((value) => {
      totals.expense += value;
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
          ${project.values
            .map((value) => `<td><input class="visual-amount-input derived-control" type="number" step="0.01" value="${value ? amountInputValue(value) : ""}" readonly /></td>`)
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

  qs("visualDetailTable").innerHTML = `<thead><tr><th>Partida</th>${monthHeaders}<th>Acción</th></tr></thead><tbody>${body.join("")}</tbody>`;

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
  renderVisualSavePanel();
}

function handleVisualAddRow() {
  const kind = qs("visualAddKind").value;
  const sectionName = qs("visualAddSection").value;
  const label = qs("visualAddLabel").value.trim();
  const amountInput = qs("visualAddAmount").value;
  const parsedAmount = parseAmount(amountInput);
  const amount = amountInput === "" || parsedAmount === null ? 0 : round2(parsedAmount);
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
  monthsInRange(qs("visualAddStartMonth").value, qs("visualAddEndMonth").value).forEach((month) => {
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
    qs("visualAddFeedback").textContent = `${label} añadida. Puedes editar sus importes directamente en la tabla.`;
    qs("visualAddFeedback").className = "inline-feedback success";
  }
  showImportLog("Línea añadida", `${label} se ha incorporado al rango indicado y ya recalcula todo el dashboard.`);
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

function renderPrevisionGroup(title, klass = "") {
  return `<tr class="prevision-group-row ${klass}"><td colspan="20">${escapeHtml(title)}</td></tr>`;
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
  const rows = [
    renderPrevisionGroup("Reales", "real"),
    renderPrevisionValueRow("Resultado mes", items, (item) => previsionMetric(item.row).result),
    renderPrevisionValueRow("Saldo máximo", items, (item) => previsionMetric(item.row).max, "positive"),
    renderPrevisionValueRow("Mínimo", items, (item) => previsionMetric(item.row).min),
    renderPrevisionGroup("Reales · flujo ajustado", "adjusted"),
    renderPrevisionValueRow("Saldo máximo", items, (item) => previsionMetric(item.row).adjustedMax, "positive"),
    renderPrevisionValueRow("Mínimo ajustado", items, (item) => previsionMetric(item.row).adjustedMin),
  ];

  qs("previsionTable").innerHTML = `<thead><tr><th>Indicador</th>${headers}</tr></thead><tbody>${rows.join("")}</tbody>`;
}

function statusDot(type) {
  const label = type === "good" ? "En plan" : type === "warn" ? "Vigilancia" : "Crítico";
  return `<span class="status-dot ${type}"></span>${label}`;
}

const savingsPlanFieldMeta = [
  ["baseHouseholdIncome", "Ingreso neto mensual base hogar", "€"],
  ["extraApril", "Extra abril", "€"],
  ["extraDecember", "Extra diciembre", "€"],
  ["mortgagePayment", "Hipoteca mensual", "€"],
  ["bmwPayment", "BMW mensual", "€"],
  ["unifiedCreditPayment", "Cuota créditos unificados", "€"],
  ["otherFixedNonDebt", "Otros gastos fijos no deuda", "€"],
  ["variableSpendTarget", "Gasto variable objetivo", "€"],
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
  const fallbacks = {
    emergencyBufferMonths: state?.emergencyBufferMonths ?? plan.emergencyBufferMonths,
    extraToBufferPct: 70,
    extraToAmortizationPct: 30,
    cashTargetPct: 5,
    initialEmergencyFund: plan.initialEmergencyFund ?? assumptions.initialCash,
  };
  return plan[key] ?? assumptions[key] ?? fallbacks[key] ?? 0;
}

function savingsPlanOverrides() {
  scenarioSettings.savingsPlan = scenarioSettings.savingsPlan || {};
  return scenarioSettings.savingsPlan;
}

function savingsPlanValue(key) {
  const overrides = savingsPlanOverrides();
  if (overrides[key] !== undefined) return Number(overrides[key] || 0);
  if (key === "baseHouseholdIncome") return Number(savingsPlanBaseValue(key) || 0) * Number(state?.incomeFactor ?? 1);
  if (key === "otherFixedNonDebt" || key === "variableSpendTarget") {
    return Number(savingsPlanBaseValue(key) || 0) * Number(state?.expenseFactor ?? 1);
  }
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
  const monthlyIncomeTotal = v.baseHouseholdIncome + (v.extraApril + v.extraDecember) / 12;
  const debtServiceMonthlyTotal =
    v.mortgagePayment + v.bmwPayment + v.unifiedCreditPayment + v.bankinterOutsidePlanPayment + v.cetelemOutsidePlanPayment;
  const totalSpendTarget = debtServiceMonthlyTotal + v.otherFixedNonDebt + v.variableSpendTarget;
  const monthlySavingPotential = monthlyIncomeTotal - totalSpendTarget;
  const savingsRate = monthlyIncomeTotal ? monthlySavingPotential / monthlyIncomeTotal : 0;
  const debtToIncomeRatio = monthlyIncomeTotal ? debtServiceMonthlyTotal / monthlyIncomeTotal : 0;
  const emergencyFundTarget = totalSpendTarget * v.emergencyBufferMonths;
  const emergencyFundGap = Math.max(0, emergencyFundTarget - v.initialEmergencyFund);
  const minMonthlyForBuffer = emergencyFundGap / 9;
  const monthsToComplete = monthlySavingPotential > 0 ? emergencyFundGap / monthlySavingPotential : 0;
  const recommendedSaving = Math.max(0, minMonthlyForBuffer);
  const suggestedAmortization = Math.max(0, monthlySavingPotential - recommendedSaving) * (v.extraToAmortizationPct / 100);
  return {
    values: v,
    monthlyIncomeTotal,
    debtServiceMonthlyTotal,
    totalSpendTarget,
    monthlySavingPotential,
    savingsRate,
    debtToIncomeRatio,
    emergencyFundTarget,
    emergencyFundGap,
    minMonthlyForBuffer,
    monthsToComplete,
    recommendedSaving,
    suggestedAmortization,
  };
}

function applySavingsPlanToScenario({ silent = false } = {}) {
  const c = savingsPlanCalculations();
  const base = baseData.sourcePlan || {};
  state.incomeFactor = base.baseHouseholdIncome ? c.values.baseHouseholdIncome / base.baseHouseholdIncome : 1;
  const baseOperational = Number(base.otherFixedNonDebt || 0) + Number(base.variableSpendTarget || 0);
  const nextOperational = c.values.otherFixedNonDebt + c.values.variableSpendTarget;
  state.expenseFactor = baseOperational ? nextOperational / baseOperational : 1;
  state.recommendedSavings = round2(c.recommendedSaving);
  state.emergencyBufferMonths = c.values.emergencyBufferMonths;
  if (qs("recommendedSavings")) qs("recommendedSavings").value = state.recommendedSavings.toFixed(2);
  if (qs("emergencyBufferMonths")) qs("emergencyBufferMonths").value = state.emergencyBufferMonths;
  saveScenarioSettings();
  if (!silent && qs("savingsPlanFeedback")) {
    qs("savingsPlanFeedback").textContent = "Supuestos aplicados al modelo: ingresos, gasto operativo, colchón y ahorro objetivo recalculados.";
    qs("savingsPlanFeedback").className = "inline-feedback success";
  }
}

function handleSavingsPlanInput(input) {
  const key = input.dataset.savingsPlanField;
  const parsed = parseAmount(input.value);
  if (!key || parsed === null) return;
  savingsPlanOverrides()[key] = parsed;
  if (key === "recommendedSaving") state.recommendedSavings = parsed;
  applySavingsPlanToScenario({ silent: true });
  render();
  if (qs("savingsPlanFeedback")) {
    qs("savingsPlanFeedback").textContent = "Cambio aplicado y recalculado en el resto del dashboard.";
    qs("savingsPlanFeedback").className = "inline-feedback success";
  }
}

function renderSavingsPlanAssumptionInput(key, label, unit) {
  return `<label class="savings-assumption-input">
    <span>${escapeHtml(label)}</span>
    <input data-savings-plan-field="${escapeHtml(key)}" type="number" step="${unit === "n" ? "1" : "0.01"}" value="${savingsInputValue(key, unit)}" />
  </label>`;
}

function renderSavingsPlan() {
  if (!qs("savingsTable") || !lastSimulation.length) return;
  const rows = lastSimulation.slice(0, Math.min(48, lastSimulation.length));
  const first = rows[0];
  const last = rows[rows.length - 1];
  const calc = savingsPlanCalculations();
  const avgIncome = calc.monthlyIncomeTotal;
  const avgDebt = calc.debtServiceMonthlyTotal;
  const avgSaving = averageRows(rows, (row) => row.saving);
  const firstOutflow = calc.totalSpendTarget;
  const bufferTarget = calc.emergencyFundTarget;
  const debtRatio = calc.debtToIncomeRatio;
  const savingsRate = calc.savingsRate;
  const currentCoverage = calc.totalSpendTarget ? calc.values.initialEmergencyFund / calc.totalSpendTarget : 0;
  const amortizationSuggested = rows.reduce((sum, row) => sum + Math.max(0, row.saving - state.recommendedSavings), 0);

  qs("savingsAssumptions").innerHTML = savingsPlanFieldMeta
    .map(([key, label, unit]) => renderSavingsPlanAssumptionInput(key, label, unit))
    .join("");

  qs("savingsKpis").innerHTML = [
    ["Tasa de ahorro", `${(savingsRate * 100).toFixed(1)}%`, ">= 20%", savingsRate >= 0.2 ? "good" : "danger"],
    ["Ratio deuda / ingresos", `${(debtRatio * 100).toFixed(1)}%`, "<= 32%", debtRatio <= 0.32 ? "good" : debtRatio <= 0.4 ? "warn" : "danger"],
    ["Cobertura actual", `${currentCoverage.toFixed(1)} meses`, `>= ${calc.values.emergencyBufferMonths}`, currentCoverage >= Number(calc.values.emergencyBufferMonths) ? "good" : currentCoverage >= 3 ? "warn" : "danger"],
    ["Desvío ahorro", money(sumRows(rows, (row) => row.saving - state.recommendedSavings), true), ">= 0", sumRows(rows, (row) => row.saving - state.recommendedSavings) >= 0 ? "good" : "danger"],
  ]
    .map(
      ([kpi, value, objective, status]) => `<div class="savings-kpi ${status}">
        <span>${kpi}</span><strong>${value}</strong><small>Objetivo: ${objective}</small><em>${statusDot(status)}</em>
      </div>`,
    )
    .join("");

  qs("savingsSummary").innerHTML = [
    ["Colchón final estimado", money(last.savings, true), last.savings >= bufferTarget ? "positive" : "negative"],
    ["Meses cobertura final", `${(last.savings / Math.max(1, firstOutflow)).toFixed(1)}`, last.savings >= bufferTarget ? "positive" : "negative"],
    ["Total ahorro 48m", money(sumRows(rows, (row) => row.saving), true), "positive"],
    ["Amortización sugerida", money(calc.suggestedAmortization, true), calc.suggestedAmortization > 0 ? "positive" : ""],
  ]
    .map(([label, value, klass]) => `<div class="expense-summary-card"><span>${label}</span><strong class="${klass}">${value}</strong></div>`)
    .join("");

  const tableRows = rows.map((row) => {
    const coverage = firstOutflow ? row.savings / firstOutflow : 0;
    const deviation = row.saving - state.recommendedSavings;
    const status = coverage >= Number(calc.values.emergencyBufferMonths || 6) ? "good" : coverage >= Number(calc.values.emergencyBufferMonths || 6) * 0.7 ? "warn" : "danger";
    return `<tr>
      <td>${escapeHtml(row.month)}</td>
      <td>${money(state.recommendedSavings, true)}</td>
      <td>${money(row.saving, true)}</td>
      <td class="${deviation < 0 ? "negative" : "positive"}">${money(deviation, true)}</td>
      <td>${money(row.startLiquidity, true)}</td>
      <td>${money(row.savings, true)}</td>
      <td>${coverage.toFixed(1)}</td>
      <td>${statusDot(status)}</td>
      <td>${money(Math.max(0, row.saving - state.recommendedSavings), true)}</td>
    </tr>`;
  });
  qs("savingsTable").innerHTML = `<thead><tr>
    <th>Mes</th><th>Ahorro objetivo</th><th>Ahorro real</th><th>Desviación</th><th>Liquidez inicio</th><th>Colchón fin</th><th>Meses cobertura</th><th>Estado</th><th>Amortización sugerida</th>
  </tr></thead><tbody>${tableRows.join("")}</tbody>`;

  const formulaRows = [
    ["Ingreso mensual total", "Base hogar + (extra abril + extra diciembre) / 12", `${money(calc.values.baseHouseholdIncome, true)} + (${money(calc.values.extraApril, true)} + ${money(calc.values.extraDecember, true)}) / 12`, money(calc.monthlyIncomeTotal, true)],
    ["Servicio deuda mensual total", "Hipoteca + BMW + cuota unificada + Bankinter + Cetelem", `${money(calc.values.mortgagePayment, true)} + ${money(calc.values.bmwPayment, true)} + ${money(calc.values.unifiedCreditPayment, true)} + ${money(calc.values.bankinterOutsidePlanPayment, true)} + ${money(calc.values.cetelemOutsidePlanPayment, true)}`, money(calc.debtServiceMonthlyTotal, true)],
    ["Ratio deuda / ingresos", "Servicio deuda / ingreso total", `${money(calc.debtServiceMonthlyTotal, true)} / ${money(calc.monthlyIncomeTotal, true)}`, `${(calc.debtToIncomeRatio * 100).toFixed(1)}%`],
    ["Gasto total objetivo mensual", "Servicio deuda + otros fijos + variable", `${money(calc.debtServiceMonthlyTotal, true)} + ${money(calc.values.otherFixedNonDebt, true)} + ${money(calc.values.variableSpendTarget, true)}`, money(calc.totalSpendTarget, true)],
    ["Ahorro mensual base potencial", "Ingreso total - gasto total objetivo", `${money(calc.monthlyIncomeTotal, true)} - ${money(calc.totalSpendTarget, true)}`, money(calc.monthlySavingPotential, true)],
    ["Tasa de ahorro", "Ahorro base potencial / ingreso total", `${money(calc.monthlySavingPotential, true)} / ${money(calc.monthlyIncomeTotal, true)}`, `${(calc.savingsRate * 100).toFixed(1)}%`],
    ["Colchón objetivo", "Gasto total objetivo * meses objetivo", `${money(calc.totalSpendTarget, true)} * ${calc.values.emergencyBufferMonths}`, money(calc.emergencyFundTarget, true)],
    ["Gap para colchón", "Colchón objetivo - colchón inicial", `${money(calc.emergencyFundTarget, true)} - ${money(calc.values.initialEmergencyFund, true)}`, money(calc.emergencyFundGap, true)],
    ["Ahorro mínimo mensual para colchón", "Gap / 9 meses", `${money(calc.emergencyFundGap, true)} / 9`, money(calc.minMonthlyForBuffer, true)],
    ["Meses estimados para completar", "Gap / ahorro base potencial", `${money(calc.emergencyFundGap, true)} / ${money(calc.monthlySavingPotential, true)}`, calc.monthsToComplete.toFixed(1)],
    ["Ahorro automático recomendado", "Ahorro mínimo mensual redondeado", money(calc.minMonthlyForBuffer, true), money(calc.recommendedSaving, true)],
    ["Amortización mensual sugerida", "Excedente sobre ahorro recomendado * % amortización", `(${money(calc.monthlySavingPotential, true)} - ${money(calc.recommendedSaving, true)}) * ${calc.values.extraToAmortizationPct.toFixed(1)}%`, money(calc.suggestedAmortization, true)],
  ];
  qs("savingsCalculationTable").innerHTML = `<thead><tr><th>Cálculo</th><th>Fórmula</th><th>Valores usados</th><th>Resultado</th></tr></thead><tbody>${formulaRows
    .map(([name, formula, values, result]) => `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(formula)}</td><td>${escapeHtml(values)}</td><td><strong>${escapeHtml(result)}</strong></td></tr>`)
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
  renderDetailedMovements();
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
  const month = planning.months[monthIndex];
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
    monthSelect.innerHTML = baseData.monthlyPlanning.months
      .map((month) => `<option value="${month.key}">${escapeHtml(month.label)}</option>`)
      .join("");
    if ([...monthSelect.options].some((option) => option.value === previous)) monthSelect.value = previous;
  }
  updateManualDataKindUi();
  populateSeriesEditor();
}

function updateManualDataKindUi() {
  const kind = qs("manualDataKind")?.value || "expense";
  const sectionSelect = qs("manualDataSection");
  if (sectionSelect) {
    sectionSelect.disabled = kind === "project";
    const sections = baseData.monthlyPlanning.sections.filter((section) => section.kind === kind);
    sectionSelect.innerHTML = sections
      .map((section) => `<option value="${escapeHtml(section.name)}">${escapeHtml(section.name)}</option>`)
      .join("");
  }
  document.querySelectorAll(".manual-project-field").forEach((field) => {
    field.classList.toggle("is-hidden", kind !== "project");
  });
  qs("manualDataPlanned")?.closest("label")?.classList.toggle("is-hidden", kind === "project");
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
  rowSelect.innerHTML = rows
    .map((row) => `<option value="${escapeHtml(seriesKeyForRow(row))}">${escapeHtml(row.sectionName)} · ${escapeHtml(displayLabelForRow(row))}</option>`)
    .join("");
  if ([...rowSelect.options].some((option) => option.value === previousRow)) rowSelect.value = previousRow;

  [startSelect, endSelect].forEach((select) => {
    const previous = select.value;
    select.innerHTML = baseData.monthlyPlanning.months
      .map((month) => `<option value="${month.key}">${escapeHtml(month.label)}</option>`)
      .join("");
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  });
  if (!endSelect.value) endSelect.value = baseData.monthlyPlanning.months.at(-1)?.key || "";
  updateSeriesPreview();
}

function monthsInRange(startKey, endKey) {
  const months = baseData.monthlyPlanning.months;
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
  render();
  populateDataEntryControls();
  showImportLog(
    `Serie actualizada: ${displayLabelForRow(row)}`,
    `${changed} mes(es) modificados. El cambio ya afecta a detalle mensual, simulador, flujo de caja y proyección.`,
  );
}

function showImportLog(title, body, tone = "") {
  const log = qs("dataImportLog");
  if (!log) return;
  log.classList.toggle("warning", tone === "warning");
  log.classList.toggle("danger", tone === "danger");
  log.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p>`;
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
  const month = monthFromInput(record.month) || baseData.monthlyPlanning.months[0];
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

function processDataRecords(records, sourceLabel = "datos") {
  let imported = 0;
  const warnings = [];
  records.forEach((record, index) => {
    const kind = normalizeDataKind(record.kind);
    const result = kind === "project" ? upsertProjectRecord(record) : upsertPlanningRecord({ ...record, kind });
    if (result.ok) imported += 1;
    else warnings.push(`Línea ${index + 1}: ${result.reason}`);
  });

  saveCustomPlanningRows();
  saveIncomeActuals();
  saveExpenseActuals();
  saveProjects();
  render();
  populateDataEntryControls();

  const warningText = warnings.length ? ` Avisos: ${warnings.slice(0, 4).join(" · ")}${warnings.length > 4 ? "..." : ""}` : "";
  showImportLog(
    `${imported} registro(s) importado(s)`,
    `Origen: ${sourceLabel}. El flujo, detalle mensual, simulador y proyección se han recalculado.${warningText}`,
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
  populateSelectors();
  updateSourceNote();
  qs("scenarioName").textContent = currentScenario;
  saveLocalSnapshot();
  queueRemoteSave();
  render();

  const monthCount = baseData.monthlyPlanning?.months?.length || 0;
  const sectionCount = baseData.monthlyPlanning?.sections?.length || 0;
  const transactionCount = baseData.transactions?.length || 0;
  showImportLog(
    "Libro Excel cargado completo",
    `${fileName}: ${monthCount} meses, ${sectionCount} bloques de planificación y ${transactionCount} movimientos incorporados al modelo.`,
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
  const month = planning.months[monthIndex];
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

function populateSelectors() {
  const previousProjectMonth = qs("projectMonth")?.value;
  const previousDebtMonth = qs("debtPayoffMonth")?.value;
  const previousDetailMonth = qs("detailMonth")?.value;
  const projectOptions = forecastMonths()
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

  const planning = baseData.monthlyPlanning;
  const planningOptions = planning.months
    .map((month, index) => `<option value="${index}">${month.label}</option>`)
    .join("");
  qs("detailMonth").innerHTML = planningOptions;
  const forecastStartKey = forecastMonths()[0]?.key || baseData.metadata.forecastStart.slice(0, 7);
  const defaultPlanningIndex = Math.max(
    0,
    planning.months.findIndex((month) => month.key === forecastStartKey),
  );
  qs("detailMonth").value = [...qs("detailMonth").options].some((option) => option.value === previousDetailMonth)
    ? previousDetailMonth
    : defaultPlanningIndex;
  populateDataEntryControls();
  populateVisualControls();
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
  link.download = "simulacion_financiera_60_meses.csv";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1000);
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
  renderBalanceChart(lastSimulation, lastBaseSimulation);
  renderCategoryChart();
  renderAdvice(lastSimulation, lastBaseSimulation);
  renderProjectSimulator(lastBaseSimulation, lastSimulation);
  renderDebtControl();
  renderTable(lastSimulation, lastBaseSimulation);
  renderVisualDetail();
  renderPrevision();
  renderSavingsPlan();
  renderMonthlyDetails();
  renderMerchants();
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
  populateSelectors();
  updateSourceNote();
  qs("scenarioName").textContent = currentScenario;

  controls.forEach((key) => qs(key).addEventListener("input", render));
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
  qs("clearProjects").addEventListener("click", handleClearProjects);
  qs("addDebtPayoff").addEventListener("click", handleAddDebtLiquidation);
  qs("debtPayoffMode").addEventListener("change", () => {
    qs("debtPayoffDuration").disabled = qs("debtPayoffMode").value !== "spread";
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
  ["visualStartMonth", "visualEndMonth", "visualValueMode"].forEach((id) => {
    qs(id).addEventListener("change", render);
  });
  ["visualBalanceDate", "visualBalanceMode"].forEach((id) => {
    qs(id).addEventListener("change", handleVisualBalanceControlChange);
  });
  ["visualCaixaBalance", "visualMediolanumBalance"].forEach((id) => {
    qs(id).addEventListener("change", handleVisualAccountBalanceInput);
  });
  qs("previsionYear").addEventListener("change", renderPrevision);
  qs("visualAddKind").addEventListener("change", populateVisualAddSections);
  qs("visualAddRow").addEventListener("click", handleVisualAddRow);
  qs("visualSaveChanges").addEventListener("click", saveVisualChanges);
  qs("visualDiscardChanges").addEventListener("click", discardVisualChanges);
  qs("visualBulkDelete").addEventListener("click", stageSelectedVisualDeletes);
  qs("movementMonthFilter").addEventListener("change", renderDetailedMovements);
  qs("movementSearch").addEventListener("input", renderDetailedMovements);
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
  window.addEventListener("resize", render);
  updateProjectModeUi();
  if (qs("debtPayoffDuration")) qs("debtPayoffDuration").disabled = qs("debtPayoffMode").value !== "spread";
  render();
  setupViewNavigation();
  await setupSupabaseSync();
}

init().catch((error) => {
  document.body.innerHTML = `<main><h1>No se pudo cargar la app</h1><p>${error.message}</p></main>`;
});
