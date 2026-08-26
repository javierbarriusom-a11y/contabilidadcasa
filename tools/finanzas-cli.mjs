#!/usr/bin/env node
// COMP-1 (FASE 4 del backlog de presupuestos): companion de terminal para registrar un gasto
// rápido y ver al instante si la categoría va en ritmo.
//
// Decisión tomada con el usuario (26 de agosto de 2026), tras descubrir que el guardado real de
// la app usa un protocolo transaccional versionado (finance_sync_runs / finance_state_snapshots /
// finance_source_heads, con concurrencia optimista) — no un simple upsert de una fila. Reimplementar
// ese protocolo en un CLI aislado, sin poder probarlo antes contra Supabase real, se consideró
// demasiado arriesgado para los datos reales del hogar. Por eso este CLI:
//
//   - Es SOLO LECTURA contra Supabase: lee tu último estado sincronizado (con las mismas
//     credenciales que usarías en la web) para calcular el ritmo, y nunca escribe nada allí.
//   - Guarda el gasto en un fichero LOCAL (~/.finanzas-casa/pendientes.jsonl).
//   - Para que cuente de verdad, el gasto se pega luego a mano en "Registrar el mes" en la web —
//     ahí es donde ya vive la lógica real de partidas/categoría (fuera de alcance de este CLI).
//
// El cálculo de "gastado" que muestra es una aproximación **solo con movimientos bancarios ya
// importados** de tu último estado sincronizado (reutiliza canonical-budget-alerts.js tal cual, el
// mismo motor que usa la web) — no incluye partidas registradas a mano, cuya fusión vive en
// app.js y no se reimplementa aquí. La web sigue siendo la fuente de verdad.
//
// Uso:
//   node tools/finanzas-cli.mjs registra <importe> <categoria...>
//   node tools/finanzas-cli.mjs pendientes
//
// Credenciales: las mismas de tu login de Supabase en la web. Puedes pasarlas por variables de
// entorno para no escribirlas cada vez:
//   FINANZAS_EMAIL=tu@email FINANZAS_PASSWORD=... node tools/finanzas-cli.mjs registra 25 Alimentacion
// Si no las defines, el CLI las pide por teclado (la contraseña no se muestra en pantalla).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Debe coincidir con REMOTE_SOURCE_KEY en app.js — es el mismo hogar/fuente que usa la web.
const REMOTE_SOURCE_KEY = "finance-dashboard-main";
const PENDING_FILE = path.join(os.homedir(), ".finanzas-casa", "pendientes.jsonl");

const { CanonicalBudgetSchema } = require(path.join(repoRoot, "canonical-budget-schema.js"));
const { CanonicalBudgetAlerts } = require(path.join(repoRoot, "canonical-budget-alerts.js"));
const CanonicalSupabaseStore = require(path.join(repoRoot, "canonical-supabase-store.js"));

function loadSupabaseConfig() {
  const configPath = path.join(repoRoot, "supabase-config.js");
  if (!fs.existsSync(configPath)) return null;
  const source = fs.readFileSync(configPath, "utf8");
  const url = source.match(/url:\s*"([^"]+)"/)?.[1];
  const anonKey = source.match(/anonKey:\s*"([^"]+)"/)?.[1];
  return url && anonKey ? { url, anonKey } : null;
}

function prompt(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Enmascara lo tecleado sin depender de un paquete externo — truco habitual con readline,
      // no hay API pública para ocultar entrada en el núcleo de Node.
      rl._writeToOutput = (text) => rl.output.write(text.includes("\n") ? text : "*");
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

async function supabaseLogin(config) {
  const email = process.env.FINANZAS_EMAIL || (await prompt("Email de Supabase: "));
  const password = process.env.FINANZAS_PASSWORD || (await prompt("Contraseña: ", { hidden: true }));
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: config.anonKey },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error_description || body?.msg || "No se pudo iniciar sesión en Supabase.");
  return { accessToken: body.access_token, userId: body.user?.id };
}

async function supabaseSelect(config, session, query) {
  const response = await fetch(`${config.url}/rest/v1/${query}`, {
    headers: { apikey: config.anonKey, authorization: `Bearer ${session.accessToken}` },
  });
  if (response.status === 404) return { data: [] };
  if (!response.ok) throw new Error(`Error leyendo ${query.split("?")[0]}: HTTP ${response.status}`);
  return { data: await response.json() };
}

async function fetchAuthoritativeState(config, session) {
  const sourceKey = encodeURIComponent(REMOTE_SOURCE_KEY);
  const [legacyResult, headResult, snapshotsResult] = await Promise.all([
    supabaseSelect(config, session, `finance_dashboard_states?source_key=eq.${sourceKey}&select=state,updated_at&limit=1`),
    supabaseSelect(config, session, `finance_source_heads?source_key=eq.${sourceKey}&select=snapshot_id,fingerprint&limit=1`),
    supabaseSelect(config, session, `finance_state_snapshots?source_key=eq.${sourceKey}&select=id,state,created_at,fingerprint&order=created_at.desc&limit=20`),
  ]);
  return CanonicalSupabaseStore.selectAuthoritativeState({
    head: headResult.data[0],
    snapshots: snapshotsResult.data,
    legacy: legacyResult.data[0],
    allowLegacyMigration: true,
  });
}

function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Mismo cálculo que budgetExpenseTransactions()/budgetAlertForRow() en app.js, pero solo con
// movimientos bancarios ya importados — sin la fusión de partidas a mano (ver cabecera del fichero).
function bankOnlySpent(state, category, monthKey) {
  const transactions = state?.workbookData?.transactions || [];
  const movements = transactions.filter(
    (row) => row.category === category && row.month === monthKey && Number(row.amount || 0) < 0,
  );
  return CanonicalBudgetAlerts.calculateAlert({ budgetAmount: 1, movements, dateContext: { today: new Date() } }).metrics.spent;
}

function appendPending(entry) {
  fs.mkdirSync(path.dirname(PENDING_FILE), { recursive: true });
  fs.appendFileSync(PENDING_FILE, `${JSON.stringify(entry)}\n`);
}

function readPending() {
  if (!fs.existsSync(PENDING_FILE)) return [];
  return fs
    .readFileSync(PENDING_FILE, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function commandRegistra(args) {
  const amount = Number(args[0]);
  const category = args.slice(1).join(" ").trim();
  if (!Number.isFinite(amount) || amount <= 0 || !category) {
    console.error("Uso: node tools/finanzas-cli.mjs registra <importe> <categoria>");
    process.exitCode = 1;
    return;
  }
  const entry = { date: new Date().toISOString(), monthKey: currentMonthKey(), category, amount };
  appendPending(entry);
  console.log(`Guardado en ${PENDING_FILE} — pégalo en "Registrar el mes" para que cuente de verdad.`);

  const config = loadSupabaseConfig();
  if (!config) {
    console.log('No se encontró supabase-config.js: no puedo leer tu ritmo real, solo queda guardado localmente.');
    return;
  }
  let authoritative;
  try {
    const session = await supabaseLogin(config);
    authoritative = await fetchAuthoritativeState(config, session);
  } catch (error) {
    console.log(`No se pudo leer tu estado remoto (${error.message}); el gasto queda guardado localmente igualmente.`);
    return;
  }
  if (!authoritative.state) {
    console.log(`Tu estado remoto está en modo "${authoritative.mode}"; no hay datos suficientes para calcular el ritmo todavía.`);
    return;
  }
  const budgets = authoritative.state.budgets || [];
  const budget = CanonicalBudgetSchema.findForCategoryMonth(budgets, category, entry.monthKey);
  const spentAfter = bankOnlySpent(authoritative.state, category, entry.monthKey) + amount;
  if (!budget) {
    console.log(`${category}: sin presupuesto para ${entry.monthKey}. Gastado hasta ahora (solo banco) + este gasto: ${spentAfter.toFixed(2)}€.`);
    return;
  }
  const pct = budget.amountCap > 0 ? Math.round((spentAfter / budget.amountCap) * 100) : 0;
  const ritmo = pct <= 100 ? "en ritmo ✓" : "por encima del ritmo ⚠️";
  console.log(`${category} hoy: ${amount.toFixed(2)}€ (gastado ${spentAfter.toFixed(2)}€/${budget.amountCap.toFixed(2)}€ solo banco, ${ritmo}).`);
}

function commandPendientes() {
  const entries = readPending();
  if (!entries.length) {
    console.log("No hay gastos pendientes de confirmar en la web.");
    return;
  }
  console.log(`${entries.length} gasto(s) pendiente(s) de confirmar en "Registrar el mes":`);
  entries.forEach((entry) => console.log(`  ${entry.date.slice(0, 10)} · ${entry.category}: ${Number(entry.amount).toFixed(2)}€`));
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "registra") await commandRegistra(args);
  else if (command === "pendientes") commandPendientes();
  else {
    console.log("Uso:");
    console.log("  node tools/finanzas-cli.mjs registra <importe> <categoria>");
    console.log("  node tools/finanzas-cli.mjs pendientes");
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
