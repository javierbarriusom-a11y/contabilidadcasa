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
let currentScenario = "Base";
let projects = [];
let projectPlan = { outflows: [], placements: [] };
let incomeActuals = {};
let expenseActuals = {};
let balanceSettings = {};
let scenarioSettings = {};
let customPlanningRows = [];
let deletedPlanningRows = {};
let memoryStorage = {};
let supabaseClient = null;
let remoteUser = null;
let remoteSaveTimer = null;
let remoteSaveInFlight = false;
let selectedCashflowIndex = null;
let expandedCashflowYears = new Set();
let expandedPlanningSections = {
  income: new Set(),
  expense: new Set(),
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

function sourceStateKey() {
  return baseData?.metadata?.sourceWorkbook || "finance-dashboard";
}

function appStatePayload() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    sourceWorkbook: sourceStateKey(),
    projects,
    incomeActuals,
    expenseActuals,
    balanceSettings,
    scenarioSettings,
    customPlanningRows,
    deletedPlanningRows,
  };
}

function applyPersistedPayload(payload = {}) {
  projects = Array.isArray(payload.projects) ? payload.projects : [];
  incomeActuals = payload.incomeActuals && typeof payload.incomeActuals === "object" ? payload.incomeActuals : {};
  expenseActuals = payload.expenseActuals && typeof payload.expenseActuals === "object" ? payload.expenseActuals : {};
  balanceSettings = payload.balanceSettings && typeof payload.balanceSettings === "object" ? payload.balanceSettings : {};
  scenarioSettings = payload.scenarioSettings && typeof payload.scenarioSettings === "object" ? payload.scenarioSettings : {};
  customPlanningRows = Array.isArray(payload.customPlanningRows) ? payload.customPlanningRows : [];
  deletedPlanningRows =
    payload.deletedPlanningRows && typeof payload.deletedPlanningRows === "object" ? payload.deletedPlanningRows : {};
  currentScenario = scenarioSettings.currentScenario || "Base";
  normalizeLoadedProjects();
}

function saveLocalSnapshot() {
  storageSet(storageKey("projects"), JSON.stringify(projects));
  storageSet(storageKey("incomeActuals"), JSON.stringify(incomeActuals));
  storageSet(storageKey("expenseActuals"), JSON.stringify(expenseActuals));
  storageSet(storageKey("balanceSettings"), JSON.stringify(balanceSettings));
  storageSet(storageKey("scenarioSettings"), JSON.stringify(scenarioSettings));
  storageSet(storageKey("customPlanningRows"), JSON.stringify(customPlanningRows));
  storageSet(storageKey("deletedPlanningRows"), JSON.stringify(deletedPlanningRows));
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
      incomeActuals: JSON.parse(storageGet(storageKey("incomeActuals"), "{}")),
      expenseActuals: JSON.parse(storageGet(storageKey("expenseActuals"), "{}")),
      balanceSettings: JSON.parse(storageGet(storageKey("balanceSettings"), "{}")),
      scenarioSettings: JSON.parse(storageGet(storageKey("scenarioSettings"), "{}")),
      customPlanningRows: JSON.parse(storageGet(storageKey("customPlanningRows"), "[]")),
      deletedPlanningRows: JSON.parse(storageGet(storageKey("deletedPlanningRows"), "{}")),
    });
  } catch {
    projects = [];
    incomeActuals = {};
    expenseActuals = {};
    balanceSettings = {};
    scenarioSettings = {};
    customPlanningRows = [];
    deletedPlanningRows = {};
  }
}

function normalizeLoadedProjects() {
  const months = forecastMonths();
  let changed = false;
  projects = projects.map((project) => {
    if (project.mode !== "fixed") return project;
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
  });
  if (changed) saveProjects();
}

function saveProjects() {
  storageSet(storageKey("projects"), JSON.stringify(projects));
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

function saveScenarioSettings() {
  if (!state) return;
  scenarioSettings = {
    currentScenario,
    initialCash: state.initialCash,
    recommendedSavings: state.recommendedSavings,
    annualInflation: state.annualInflation,
    annualIncomeGrowth: state.annualIncomeGrowth,
    emergencyBufferMonths: state.emergencyBufferMonths,
    autoCapSavings: state.autoCapSavings,
    incomeFactor: state.incomeFactor,
    expenseFactor: state.expenseFactor,
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
    updateSyncUi(result.error.message, "warn");
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

function plannedValueForRow(row, month) {
  return row.custom ? Number(row.plannedValue || 0) : Number(row.planned[month.index] || 0);
}

function actualAwareInfo(row, month) {
  const actuals = actualsForKind(row.kind);
  const key = actualKeyForRow(row, month);
  const stored = actuals[key];
  const planned = plannedValueForRow(row, month);
  const hasActual = stored !== undefined && stored !== "";
  const actual = hasActual ? Number(stored) : null;
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

function customRowsForSection(kind, sectionName, month) {
  return customPlanningRows
    .filter(
      (row) =>
        row.kind === kind &&
        row.sectionName === sectionName &&
        row.monthKey === month.key &&
        !deletedPlanningRows[deleteKeyForRow(row, month)],
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
      const rows = section.rows
        .filter((row) => !deletedPlanningRows[deleteKeyForRow(row, month)])
        .concat(customRowsForSection(section.kind, section.name, month));
      return { ...section, rows };
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
  return /\b(coche|bmw)\b/.test(normalizedText(row.label));
}

function isFinancingPlanningRow(section, row) {
  const sectionName = normalizedText(section.name);
  const label = normalizedText(row.label);
  return (
    sectionName.includes("financi") ||
    /refinanci|libre deuda|prestamo|tarjeta|credito|mycard|visa|mastercard|cetelem|bankinter|pdh/.test(
      label,
    )
  );
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

function planningBreakdownForForecastMonth(forecastIndex, date) {
  const planning = baseData.monthlyPlanning;
  const month = planningMonthForDate(date, forecastIndex);
  const breakdown = {
    monthKey: month.key,
    income: 0,
    coreSpend: 0,
    car: 0,
    refi: 0,
    expenseTotal: 0,
  };

  planningSectionsForMonth(null, month).forEach((section) => {
    section.rows.forEach((row) => {
      const value = actualAwareValue(row, month);
      if (section.kind === "income") {
        breakdown.income += value;
        return;
      }
      if (section.kind !== "expense") return;

      breakdown.expenseTotal += value;
      if (isCarPlanningRow(row)) {
        breakdown.car += value;
      } else if (isFinancingPlanningRow(section, row)) {
        breakdown.refi += value;
      } else {
        breakdown.coreSpend += value;
      }
    });
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
              label: row.label,
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

function projectedInitialCashForStartIndex(startIndex) {
  const a = baseData.assumptions;
  let checking = a.initialCash - a.newAccountBalance;
  let savings = a.newAccountBalance;

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

  return checking + savings;
}

function updateBalanceModeUi() {
  const initialCash = qs("initialCash");
  if (!initialCash) return;
  const auto = (qs("balanceMode")?.value || state?.balanceMode) === "auto";
  initialCash.readOnly = auto;
  initialCash.classList.toggle("derived-control", auto);
}

function applyBalanceModeChange() {
  const mode = qs("balanceMode").value || "auto";
  state.balanceDate = qs("balanceDate").value || defaultBalanceDate();
  state.balanceMode = mode;
  if (mode === "manual") {
    const manual = balanceSettings.manualInitialCash ?? qs("initialCash").value ?? state.initialCash;
    qs("initialCash").value = Number(manual || 0).toFixed(2);
    state.initialCash = Number(qs("initialCash").value);
  } else {
    state.initialCash = projectedInitialCashForStartIndex(modelStartIndex());
    qs("initialCash").value = state.initialCash.toFixed(2);
  }
  updateBalanceModeUi();
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
    state.initialCash = projectedInitialCashForStartIndex(modelStartIndex());
    qs("initialCash").value = state.initialCash.toFixed(2);
  }
  updateBalanceModeUi();
  saveBalanceSettings();
  saveScenarioSettings();
}

function writeControls(nextState) {
  state = { ...nextState, ...scenarioSettings };
  state.balanceDate = state.balanceDate || balanceSettings.balanceDate || defaultBalanceDate();
  state.balanceMode = state.balanceMode || balanceSettings.balanceMode || "auto";
  if (state.balanceMode === "manual" && balanceSettings.manualInitialCash != null) {
    state.initialCash = Number(balanceSettings.manualInitialCash);
  }
  controls.forEach((key) => {
    qs(key).value = state[key];
  });
  qs("balanceDate").value = state.balanceDate;
  qs("balanceMode").value = state.balanceMode;
  qs("autoCapSavings").checked = state.autoCapSavings ?? true;
  if (state.balanceMode === "auto") {
    state.initialCash = projectedInitialCashForStartIndex(modelStartIndex());
    qs("initialCash").value = state.initialCash.toFixed(2);
  }
  updateBalanceModeUi();
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

function simulate(projectOutflows = []) {
  const rows = [];
  const start = modelStartDate();
  const savingsStart = Math.min(baseData.assumptions.newAccountBalance, Math.max(0, state.initialCash));
  let checking = state.initialCash - savingsStart;
  let savings = savingsStart;

  for (let i = 0; i < modelMonthCount(); i += 1) {
    const date = addMonths(start, i);
    const detail = planningBreakdownForForecastMonth(i, date);
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

  projects.forEach((project) => {
    if (project.mode === "fixed") {
      const indexFromKey = project.monthKey
        ? months.findIndex((month) => month.key === project.monthKey)
        : -1;
      const startIndex =
        indexFromKey >= 0
          ? indexFromKey
          : Math.min(Math.max(Number(project.monthIndex || 0), 0), months.length - 1);
      addProjectOutflow(outflows, project, startIndex);
      placements.push({ ...project, startIndex, status: "fixed", monthLabel: months[startIndex].label });
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

function handleClearProjects() {
  projects = [];
  saveProjects();
  render();
}

function renderProjectSimulator(baseRows, rows) {
  const baseEnding = baseRows[baseRows.length - 1].totalLiquidity;
  const ending = rows[rows.length - 1].totalLiquidity;
  const impact = ending - baseEnding;
  const totalProjects = projects.reduce((sum, project) => sum + Number(project.amount || 0), 0);
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

  if (!projects.length) {
    qs("projectList").innerHTML =
      '<div class="project-item"><div><strong>Sin proyectos cargados</strong><p>Añade un importe y elige mes fijo u optimización automática.</p></div></div>';
    return;
  }

  qs("projectList").innerHTML = projectPlan.placements
    .map((project) => {
      const monthly = Number(project.amount || 0) / Math.max(1, Number(project.duration || 1));
      const statusText =
        project.status === "fixed"
          ? "Mes fijado manualmente"
          : project.status === "warning"
            ? "Sin hueco plenamente cómodo; colocado en el mejor mes disponible"
            : "Mes optimizado automáticamente";
      return `<div class="project-item ${project.status === "warning" ? "warning" : ""}">
        <div>
          <strong>${project.name}</strong>
          <p>${money(project.amount, true)} en ${project.duration} mes(es), desde ${project.monthLabel}. ${statusText}. Impacto mensual: ${money(monthly, true)}.</p>
        </div>
        <button data-remove-project="${project.id}">Quitar</button>
      </div>`;
    })
    .join("");

  document.querySelectorAll("[data-remove-project]").forEach((button) => {
    button.addEventListener("click", () => removeProject(button.dataset.removeProject));
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
          <td>${escapeHtml(row.label)}${row.custom ? " <small>nuevo</small>" : ""}</td>
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
  const previousDetailMonth = qs("detailMonth")?.value;
  const projectOptions = forecastMonths()
    .map((month) => `<option value="${month.index}">${month.label}</option>`)
    .join("");
  qs("projectMonth").innerHTML = projectOptions;
  if ([...qs("projectMonth").options].some((option) => option.value === previousProjectMonth)) {
    qs("projectMonth").value = previousProjectMonth;
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
  writeDerivedControls(lastSimulation);
  updateKpis(lastSimulation, lastBaseSimulation);
  renderBalanceChart(lastSimulation, lastBaseSimulation);
  renderCategoryChart();
  renderAdvice(lastSimulation, lastBaseSimulation);
  renderProjectSimulator(lastBaseSimulation, lastSimulation);
  renderTable(lastSimulation, lastBaseSimulation);
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
  loadLocalState();
  writeControls({ ...baseData.assumptions, autoCapSavings: true });
  populateSelectors();
  const sourceFile = (baseData.metadata.sourceWorkbook || "").split("/").pop() || "Excel financiero";
  qs("sourceNote").textContent =
    `Fuente: ${sourceFile}. Usa Plan_Ahorro_821, Importe devolucion recibos y movimientos de cuenta.`;
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
  qs("syncLogout").addEventListener("click", handleSyncLogout);
  qs("syncNow").addEventListener("click", () => saveRemoteState(true));
  qs("addProject").addEventListener("click", handleAddProject);
  qs("clearProjects").addEventListener("click", handleClearProjects);
  qs("addIncomeConcept").addEventListener("click", () => handleAddCustomConcept("income"));
  qs("addExpenseConcept").addEventListener("click", () => handleAddCustomConcept("expense"));
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
  render();
  await setupSupabaseSync();
}

init().catch((error) => {
  document.body.innerHTML = `<main><h1>No se pudo cargar la app</h1><p>${error.message}</p></main>`;
});
