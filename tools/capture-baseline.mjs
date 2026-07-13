import fs from "node:fs";
import { financeDataSummary, loadPackagedFinanceData } from "./finance-data.mjs";

const output = new URL("../tests/fixtures/finance-data-baseline.json", import.meta.url);
const summary = financeDataSummary(loadPackagedFinanceData());
fs.mkdirSync(new URL("../tests/fixtures/", import.meta.url), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`Baseline actualizado: ${output.pathname}`);
