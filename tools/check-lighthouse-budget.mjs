import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// OPT-5: ejecuta el presupuesto de rendimiento real (.lighthouserc.cjs) contra el `dist/` ya
// construido. Separado de `npm run verify` a propósito: el resto de `verify` no necesita un
// navegador (igual que test:visual/test:e2e/test:a11y-axe, que ya viven fuera de `verify` por lo
// mismo), así que quien solo quiera correr los tests no se ve obligado a tener Chromium instalado.
// Se engancha en `.github/workflows/pages.yml`, después de `npm run verify` y en el mismo job, para
// que corra en cada PR y no solo antes de desplegar.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distIndex = path.join(root, "dist", "index.html");
if (!fs.existsSync(distIndex)) {
  throw new Error("No existe dist/index.html — ejecuta `npm run build:site` antes de `npm run test:performance-lh`.");
}

const chromePath = chromium.executablePath();
if (!fs.existsSync(chromePath)) {
  throw new Error(
    `Chromium de Playwright no está instalado (se esperaba en ${chromePath}). ` +
      "Ejecuta `npx playwright install chromium` antes de `npm run test:performance-lh`.",
  );
}

const result = spawnSync("npx", ["lhci", "autorun", "--config=.lighthouserc.cjs"], {
  cwd: root,
  env: { ...process.env, CHROME_PATH: chromePath },
  stdio: "inherit",
});
if (result.status !== 0) {
  throw new Error("El presupuesto de rendimiento real (Lighthouse) no se cumple — ver el detalle arriba.");
}
