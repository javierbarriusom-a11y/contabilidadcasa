// UND-01 (undécima auditoría; 22/11/2026): «arranque en caliente». Todas las pruebas en navegador arrancaban sin nada guardado, y el
// gráfico de Hoy estuvo once días perdido: la previsión diaria guardada no traía sus filas y solo fallaba al volver a abrir la app
// con datos. Este ayudante deja un estado sintético con la forma del dato real, lo guarda y recarga, para que la pantalla se pinte
// desde lo guardado y no desde la memoria del arranque:
//  - dos contratos de deuda dados de alta (los de ejemplo, ocultos), como hace el hogar;
//  - seis meses de movimientos en la cuenta (nómina, súper y luz) y un apunte a mano;
// todo FICTICIO. Devuelve la página ya recargada; quien lo usa navega a su pantalla (el «volver a pintar»).
const { expect } = require("@playwright/test");

const CONTRATOS = "Banco FICTICIO; tarjeta; 2.400; 21,9; 90\nCaja FICTICIA; préstamo; 5.100; 9,5; 160";

async function arrancarEnCaliente(page, { viewport = { width: 1280, height: 900 } } = {}) {
  await page.setViewportSize(viewport);
  await page.goto("/index.html#deuda-contratos");
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* sin almacenamiento */ } });
  await page.reload();
  const varios = page.locator("#deudaContratosDetectados .deuda-varios");
  await varios.locator("summary").click();
  await page.fill("#deudaContratosVarios", CONTRATOS);
  await varios.locator("[data-deuda-varios-alta]").click();
  await expect(page.locator("#deudaVariosAviso")).toContainText("2 contratos dados de alta");
  await page.evaluate(() => {
    debtContractHiddenExampleIds = ["debt-1", "debt-2", "debt-3"];
    saveDebtContractHiddenExampleIds();
    const hoy = new Date();
    const filas = [];
    let saldo = 2400;
    for (let atras = 6; atras >= 1; atras -= 1) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - atras, 1);
      const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      for (const [dia, concepto, importe] of [["03", "NOMINA FICTICIA", 1500], ["10", "SUPER FICTICIO", -320.5], ["20", "LUZ FICTICIA", -80]]) {
        saldo = Math.round((saldo + importe) * 100) / 100;
        filas.push({ date: `${mes}-${dia}`, valueDate: `${mes}-${dia}`, month: mes, movement: concepto, details: "", amount: importe, balance: saldo, account: "CaixaBank", source: "extracto bancario" });
      }
    }
    const ultimo = filas.at(-1);
    filas.push({ date: ultimo.date, valueDate: ultimo.date, month: ultimo.month, movement: "CENA A MANO FICTICIA", details: "", amount: -45, balance: null, account: "CaixaBank", source: "manual" });
    baseData.transactions = mergeTransactions(baseData.transactions || [], filas);
    refreshMovementRollups();
    saveWorkbookOverride();
    saveLocalSnapshot();
  });
  // El arranque en caliente: se vuelve a abrir la app con lo guardado y nada en memoria.
  await page.reload();
  await expect(page.locator("main")).toBeVisible({ timeout: 20000 });
  return page;
}

module.exports = { arrancarEnCaliente, CONTRATOS };
