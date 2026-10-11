(function attachCanonicalStatementProfiles(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalStatementProfiles = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalStatementProfilesFactory() {
  "use strict";

  // WP-51 (ND-04, docs/WP51_DISENO.md): lectura de un extracto bancario en CSV sin exigir un formato fijo. Dado el fichero (bytes o texto) deduce la
  // codificación, el separador, el formato decimal, el orden de las fechas, la fila de cabecera (saltando filas de título) y el papel de cada columna
  // (fecha, concepto, importe o debe/haber, saldo…), y devuelve los movimientos leídos MÁS la lista de lo que no se pudo leer, con fila y motivo.
  // Motor puro: ni DOM, ni red, ni almacenamiento, ni reloj. No decide nada por el hogar: lo que no se puede deducir con seguridad (día/mes de una fecha
  // como 03/04/2026, «1.234» como mil doscientos o como uno con 234 milésimas) se devuelve como AVISO y el hogar puede fijarlo (override) y guardarlo
  // como perfil con nombre. NO trae perfiles «de banco» preinstalados: no se conoce el formato real de ningún banco y no se inventa.
  //
  // Reglas de honestidad:
  //   · una fila que no se puede leer NO se descarta en silencio: sale en `errors` con su número de línea y su motivo;
  //   · un importe que no es un número claro es un error de esa fila, nunca un 0 ni «lo que quede tras quitar letras»;
  //   · el signo de los importes se comprueba con la columna de saldo (si la hay): si encajan «al revés», se avisa, no se corrige solo;
  //   · el diagnóstico para copiar lleva la estructura (papeles de columna, formatos, números de fila y motivos), nunca el contenido de las celdas.

  const SCHEMA_ID = "finance-statement-profiles/v1";
  const MAX_PROFILES = 12;
  const MAX_ERRORS = 200;
  const HEADER_SCAN_ROWS = 40;
  const DELIMITER_SCAN_ROWS = 40;
  const DELIMITERS = [";", ",", "\t", "|"];
  const ROLES = Object.freeze(["date", "valueDate", "movement", "details", "amount", "debit", "credit", "balance", "sign", "ignore"]);
  const DATE_ORDERS = Object.freeze(["DMY", "MDY"]);

  const text = (value) => String(value ?? "").trim();
  const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const norm = (value) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

  // ---------------------------------------------------------------- codificación
  const CP1252 = { 0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡", 0x88: "ˆ", 0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—", 0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ" };

  function isValidUtf8(bytes, from) {
    let i = from;
    while (i < bytes.length) {
      const b = bytes[i];
      let extra = 0;
      if (b < 0x80) extra = 0;
      else if (b >= 0xc2 && b <= 0xdf) extra = 1;
      else if (b >= 0xe0 && b <= 0xef) extra = 2;
      else if (b >= 0xf0 && b <= 0xf4) extra = 3;
      else return false;
      if (extra > 0 && i + extra >= bytes.length) return false;
      for (let k = 1; k <= extra; k += 1) if ((bytes[i + k] & 0xc0) !== 0x80) return false;
      i += extra + 1;
    }
    return true;
  }

  function decodeUtf8(bytes, from) {
    let out = "";
    let i = from;
    while (i < bytes.length) {
      const b = bytes[i];
      if (b < 0x80) { out += String.fromCharCode(b); i += 1; } else if (b < 0xe0) { out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2; } else if (b < 0xf0) { out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3; } else {
        const cp = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
        out += String.fromCodePoint(cp); i += 4;
      }
    }
    return out;
  }

  /**
   * Bytes → texto. UTF-8 (con o sin marca BOM) si es válido; UTF-16 si trae su BOM; en otro caso Windows-1252, que es lo que exportan muchas
   * hojas de cálculo y bancos de España. Un texto que ya es cadena se devuelve tal cual.
   * @returns {{ text: string, encoding: string }}
   */
  function decode(input) {
    if (typeof input === "string") return { text: input.replace(/^\uFEFF/, ""), encoding: "texto" };
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || []);
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      let out = "";
      for (let i = 2; i + 1 < bytes.length; i += 2) out += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
      return { text: out, encoding: "utf-16le" };
    }
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      let out = "";
      for (let i = 2; i + 1 < bytes.length; i += 2) out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
      return { text: out, encoding: "utf-16be" };
    }
    const from = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
    if (isValidUtf8(bytes, from)) return { text: decodeUtf8(bytes, from), encoding: "utf-8" };
    let out = "";
    for (let i = 0; i < bytes.length; i += 1) {
      const b = bytes[i];
      out += b >= 0x80 && b <= 0x9f ? CP1252[b] || "�" : String.fromCharCode(b);
    }
    return { text: out, encoding: "windows-1252" };
  }

  // ---------------------------------------------------------------- CSV con comillas
  /**
   * Parte el texto en registros respetando comillas (un separador o un salto de línea dentro de «"..."» no parte; «""» es una comilla).
   * `line` es la línea física (1-based) donde empieza el registro. `open` marca un registro con comillas sin cerrar.
   * @returns {Array<{ line: number, cells: string[], open: boolean }>}
   */
  function parseRecords(source, delimiter) {
    const records = [];
    let cells = [];
    let cell = "";
    let inQuotes = false;
    let line = 1;
    let startLine = 1;
    const push = () => { cells.push(cell.trim()); cell = ""; };
    const end = (open) => { push(); records.push({ line: startLine, cells, open }); cells = []; };
    const s = String(source ?? "");
    for (let i = 0; i < s.length; i += 1) {
      const ch = s[i];
      if (inQuotes) {
        if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i += 1; } else inQuotes = false; } else { if (ch === "\n") line += 1; cell += ch; }
      } else if (ch === '"' && cell.trim() === "") { inQuotes = true; cell = ""; } else if (ch === delimiter) push();
      else if (ch === "\r" || ch === "\n") {
        if (ch === "\r" && s[i + 1] === "\n") i += 1;
        end(false);
        line += 1;
        startLine = line;
      } else cell += ch;
    }
    if (cell !== "" || cells.length || inQuotes) end(inQuotes);
    return records;
  }

  /** Separador con más consistencia entre filas (no fila a fila): el que parte el mayor número de filas en el mismo número de campos. */
  function detectDelimiter(source) {
    let best = null;
    DELIMITERS.forEach((delimiter, order) => {
      const rows = parseRecords(source, delimiter).filter((r) => r.cells.some(Boolean)).slice(0, DELIMITER_SCAN_ROWS);
      if (rows.length < 2) return;
      const counts = new Map();
      rows.forEach((r) => counts.set(r.cells.length, (counts.get(r.cells.length) || 0) + 1));
      let mode = 0;
      let modeRows = 0;
      counts.forEach((rowsWith, size) => { if (size > 1 && (rowsWith > modeRows || (rowsWith === modeRows && size > mode))) { mode = size; modeRows = rowsWith; } });
      if (mode < 2) return;
      const share = modeRows / rows.length;
      if (share < 0.5) return;
      const score = share * 100 + Math.min(mode, 12);
      if (!best || score > best.score + 1e-9) best = { delimiter, score, columns: mode, share, order };
    });
    return best ? best.delimiter : null;
  }

  // ---------------------------------------------------------------- cabeceras
  const ALIASES = {
    valueDate: ["fechavalor", "fechadevalor", "fvalor", "valuedate", "fechavalora"],
    date: ["fechaoperacion", "fechadeoperacion", "fechacontable", "fechamovimiento", "fechaoper", "foperacion", "fcontable", "fechaoperativa", "fecha", "date", "fechaasiento"],
    movement: ["conceptodelmovimiento", "descripciondelmovimiento", "concepto", "movimiento", "descripcion", "concept", "description", "texto"],
    details: ["masdatos", "masinformacion", "informacionadicional", "detalle", "observaciones", "comentario"],
    amount: ["importemovimiento", "importeeuros", "importeeur", "importe", "cantidad", "amount"],
    debit: ["debe", "cargos", "cargo", "adeudos", "adeudo", "debito", "salidas", "debit"],
    credit: ["haber", "abonos", "abono", "credito", "ingresos", "ingreso", "entradas", "credit"],
    balance: ["saldodisponible", "saldocontable", "saldoposterior", "saldoeur", "saldo", "balance"],
    sign: ["debehaber", "cargoabono", "tipomovimiento", "signo", "dh"],
  };
  const ALIAS_LIST = Object.entries(ALIASES).flatMap(([role, list]) => list.map((alias) => ({ role, alias }))).sort((a, b) => b.alias.length - a.alias.length);

  /** Papel que sugiere el texto de una cabecera, o cadena vacía. Exacto primero; después, por prefijo solo con alias largos («importe (EUR)»). */
  function headerRole(value) {
    const key = norm(value);
    if (!key) return "";
    const exact = ALIAS_LIST.find((entry) => entry.alias === key);
    if (exact) return exact.role;
    const prefix = ALIAS_LIST.find((entry) => entry.alias.length >= 6 && key.startsWith(entry.alias) && key.length <= entry.alias.length + 12);
    return prefix ? prefix.role : "";
  }

  function rolesOf(cells) {
    const taken = new Set();
    return cells.map((cell) => {
      const role = headerRole(cell);
      if (!role || taken.has(role)) return "";
      taken.add(role);
      return role;
    });
  }

  const usable = (roles) => roles.includes("date") && (roles.includes("amount") || roles.includes("debit") || roles.includes("credit"));

  // ---------------------------------------------------------------- números
  const MONEY_NOISE = /[\s\u00a0\u202f€]|eur(os)?\b/gi;

  /**
   * Número de un importe con el decimal indicado («comma» o «dot»). Acepta signo delante o detrás, paréntesis (negativo), menos tipográfico,
   * símbolo de euro y separador de miles correcto. Devuelve null si no es un número claro.
   */
  function parseNumber(value, decimal = "comma") {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    let s = text(value).replace(MONEY_NOISE, "").replace(/[−–—]/g, "-");
    if (!s) return null;
    let negative = false;
    if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
    if (s.endsWith("-")) { negative = !negative; s = s.slice(0, -1); }
    if (s.startsWith("-")) { negative = !negative; s = s.slice(1); } else if (s.startsWith("+")) s = s.slice(1);
    const dec = decimal === "dot" ? "." : ",";
    const thousands = decimal === "dot" ? "," : ".";
    const escapedDec = dec === "." ? "\\." : ",";
    const escapedThousands = thousands === "." ? "\\." : ",";
    const grouped = new RegExp(`^\\d{1,3}(?:[${escapedThousands}']\\d{3})+(?:${escapedDec}\\d+)?$`);
    const plain = new RegExp(`^\\d*(?:${escapedDec}\\d+)?$`);
    let canonical;
    if (grouped.test(s)) canonical = s.replace(new RegExp(`[${escapedThousands}']`, "g"), "").replace(dec, ".");
    else if (/^\d+$/.test(s) || (plain.test(s) && s !== dec)) canonical = s.replace(dec, ".");
    else return null;
    if (canonical === "" || canonical === ".") return null;
    const n = Number(canonical);
    if (!Number.isFinite(n)) return null;
    return negative ? -n : n;
  }

  /** Formato decimal de una columna de cifras por evidencia: «,dd» al final → coma; «.dd» al final → punto; «1.234,5» / «1,234.5» deciden solos. */
  function detectDecimal(tokens) {
    let comma = 0;
    let dot = 0;
    let ambiguous = 0;
    tokens.forEach((raw) => {
      const s = text(raw).replace(MONEY_NOISE, "").replace(/^[-+(−]+|[-)]+$/g, "");
      if (!/[.,]/.test(s)) return;
      const lastComma = s.lastIndexOf(",");
      const lastDot = s.lastIndexOf(".");
      if (lastComma >= 0 && lastDot >= 0) { if (lastComma > lastDot) comma += 1; else dot += 1; return; }
      const sep = lastComma >= 0 ? "," : ".";
      const after = s.length - s.lastIndexOf(sep) - 1;
      const several = s.split(sep).length > 2;
      if (several) { if (sep === ",") dot += 1; else comma += 1; return; } // «1.234.567»: el punto agrupa → el decimal es la coma
      if (after >= 1 && after <= 2) { if (sep === ",") comma += 1; else dot += 1; } else if (after === 3) ambiguous += 1;
      else if (sep === ",") comma += 1; else dot += 1;
    });
    if (comma && dot) return { decimal: comma >= dot ? "comma" : "dot", certainty: "mixto", evidence: { comma, dot, ambiguous } };
    if (comma) return { decimal: "comma", certainty: "claro", evidence: { comma, dot, ambiguous } };
    if (dot) return { decimal: "dot", certainty: "claro", evidence: { comma, dot, ambiguous } };
    if (ambiguous) return { decimal: "comma", certainty: "ambiguo", evidence: { comma, dot, ambiguous } };
    return { decimal: "comma", certainty: "sin-separadores", evidence: { comma, dot, ambiguous } };
  }

  // ---------------------------------------------------------------- fechas
  const MONTHS = { ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12 };

  function validDate(y, m, d) {
    if (!(y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return "";
    const probe = new Date(Date.UTC(y, m - 1, d));
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return "";
    return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const fullYear = (y) => (y < 100 ? 2000 + y : y);
  const stripTime = (value) => text(value).replace(/[T\s]+\d{1,2}:\d{2}(?::\d{2}(?:[.,]\d+)?)?\s*(?:Z|[+-]\d{2}:?\d{2})?$/i, "").trim();

  /** Forma numérica de una fecha: { parts:[a,b,c], kind:'ymd'|'xxy' } o { iso } si ya no depende del orden (mes en letra, ISO, AAAAMMDD). */
  function dateShape(value) {
    const s = stripTime(value);
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (m) return { iso: validDate(+m[1], +m[2], +m[3]) };
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})$/);
    if (m) return { parts: [+m[1], +m[2], fullYear(+m[3])] };
    m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m && validDate(+m[1], +m[2], +m[3])) return { iso: validDate(+m[1], +m[2], +m[3]) };
    m = s.match(/^(\d{1,2})\s*(?:de\s+)?([a-zA-Záéíóú]{3,})\.?\s*(?:de\s+)?(\d{4}|\d{2})$/i);
    if (m) {
      const month = MONTHS[norm(m[2]).slice(0, 3)];
      return { iso: month ? validDate(fullYear(+m[3]), month, +m[1]) : "" };
    }
    return { iso: "" };
  }

  /** Fecha ISO de un texto con el orden dado; cadena vacía si no es una fecha real (31/02, mes 13…). */
  function parseDate(value, order = "DMY") {
    const shape = dateShape(value);
    if (!shape.parts) return shape.iso || "";
    const [a, b, y] = shape.parts;
    return order === "MDY" ? validDate(y, a, b) : validDate(y, b, a);
  }

  /** Orden día/mes de una columna: lo decide un valor imposible en la otra lectura (día 25); si nada decide, «DMY» y se dice que no se sabe. */
  function detectDateOrder(values) {
    let dmy = 0;
    let mdy = 0;
    values.forEach((v) => {
      const shape = dateShape(v);
      if (!shape.parts) return;
      if (shape.parts[0] > 12) dmy += 1;
      if (shape.parts[1] > 12) mdy += 1;
    });
    const withParts = values.filter((v) => dateShape(v).parts).length;
    if (dmy && mdy) return { order: "DMY", certainty: "conflicto", evidence: { dmy, mdy } };
    if (dmy) return { order: "DMY", certainty: "claro", evidence: { dmy, mdy } };
    if (mdy) return { order: "MDY", certainty: "claro", evidence: { dmy, mdy } };
    if (!withParts) return { order: "DMY", certainty: "sin-orden", evidence: { dmy, mdy } };
    return { order: "DMY", certainty: "ambiguo", evidence: { dmy, mdy } };
  }

  // ---------------------------------------------------------------- análisis
  // «C» suelto NO cuenta: unos bancos lo usan para cargo y otros para crédito; una letra ambigua es un error de fila, no una suposición.
  const SIGN_NEGATIVE = /^(d|db|debe|debito|cargo|adeudo)$/;
  const SIGN_POSITIVE = /^(h|cr|haber|credito|abono|ingreso)$/;

  const headerSignature = (cells) => cells.map(norm).join("|");

  /** Mejor fila de cabecera entre las primeras: la primera con fecha e importe (o debe/haber) reconocibles. Devuelve el índice de registro, o -1. */
  function findHeader(records) {
    for (let i = 0; i < Math.min(records.length, HEADER_SCAN_ROWS); i += 1) {
      if (records[i].cells.some(Boolean) && usable(rolesOf(records[i].cells))) return i;
    }
    return -1;
  }

  function checkBalances(rows) {
    // Con la columna de saldo, cada fila debería cumplir saldo = saldo anterior + importe (extracto ascendente) o, al revés, en orden descendente.
    const withBalance = rows.filter((r) => r.transaction && Number.isFinite(r.transaction.balance));
    if (withBalance.length < 3) return { status: "sin-datos", pairs: 0 };
    let asc = 0;
    let desc = 0;
    let ascInv = 0;
    let descInv = 0;
    const close = (a, b) => Math.abs(a - b) < 0.015;
    for (let i = 1; i < withBalance.length; i += 1) {
      const prev = withBalance[i - 1].transaction;
      const cur = withBalance[i].transaction;
      if (close(cur.balance, prev.balance + cur.amount)) asc += 1;
      if (close(prev.balance, cur.balance + prev.amount)) desc += 1;
      if (close(cur.balance, prev.balance - cur.amount)) ascInv += 1;
      if (close(prev.balance, cur.balance - prev.amount)) descInv += 1;
    }
    const pairs = withBalance.length - 1;
    const best = Math.max(asc, desc);
    const bestInv = Math.max(ascInv, descInv);
    const direction = asc >= desc ? "ascendente" : "descendente";
    if (best / pairs >= 0.8) return { status: "cuadra", pairs, matches: best, direction };
    if (bestInv / pairs >= 0.8 && best / pairs < 0.2) return { status: "signo-invertido", pairs, matches: bestInv, direction: ascInv >= descInv ? "ascendente" : "descendente" };
    return { status: "no-cuadra", pairs, matches: best, direction };
  }

  /**
   * @param {Uint8Array|ArrayBuffer|string} input fichero (bytes) o texto
   * @param {{ overrides?: Record<string, any>, profiles?: any[] }} [options]
   *   overrides: { delimiter, decimal: 'comma'|'dot', dateOrder: 'DMY'|'MDY'|'YMD', headerLine: n (0 = sin cabecera), columns: papeles por columna, invertSign }
   * @returns {Record<string, any>}
   */
  function analyze(input, options = {}) {
    const overrides = options.overrides || {};
    const profiles = normalizeProfiles(options.profiles);
    const { text: source, encoding } = decode(input);
    const warnings = [];
    const base = { schema: SCHEMA_ID, encoding, ok: false, transactions: [], rows: [], errors: [], skipped: 0, warnings, columns: [], preview: [], balanceCheck: { status: "sin-datos", pairs: 0 } };
    if (!text(source)) return { ...base, failure: { code: "vacio", reason: "El fichero está vacío." } };
    if (encoding === "windows-1252") warnings.push({ code: "codificacion", text: "El fichero no es UTF-8: se ha leído como Windows-1252 (lo habitual en exportaciones de hojas de cálculo y bancos de España)." });

    // Perfil guardado: se prueba con su separador y su firma de cabecera; lo fijado explícitamente por el hogar pesa más que el perfil.
    let delimiter = overrides.delimiter || null;
    let matched = null;
    if (!delimiter) {
      for (const profile of profiles) {
        const records = parseRecords(source, profile.delimiter);
        const at = findHeader(records);
        if (at >= 0 && headerSignature(records[at].cells) === profile.signature) { matched = profile; delimiter = profile.delimiter; break; }
      }
    }
    delimiter = delimiter || detectDelimiter(source);
    if (!delimiter) return { ...base, failure: { code: "separador", reason: "No he encontrado un separador de columnas (;  ,  tabulador o |) que parta las filas en el mismo número de campos." } };

    const records = parseRecords(source, delimiter);
    let headerAt;
    let headerLine = 0;
    if (Number.isInteger(overrides.headerLine)) {
      headerLine = overrides.headerLine;
      headerAt = headerLine === 0 ? -1 : records.findIndex((r) => r.line === headerLine);
      if (headerLine > 0 && headerAt < 0) return { ...base, delimiter, failure: { code: "cabecera", reason: `La fila de cabecera indicada (${headerLine}) no existe en el fichero.` } };
    } else {
      headerAt = findHeader(records);
      if (headerAt < 0 && !overrides.columns && !matched) {
        const sampleWidth = Math.max(0, ...records.slice(0, 50).map((r) => r.cells.length));
        return { ...base, delimiter, columns: Array.from({ length: sampleWidth }, (_, index) => ({ index, header: "", role: "" })), failure: { code: "cabecera", reason: `No he encontrado una fila de cabecera con una columna de fecha y otra de importe (o debe/haber) en las primeras ${HEADER_SCAN_ROWS} filas. Indica a mano qué es cada columna.` }, sample: records.slice(0, 6).map((r) => r.cells) };
      }
    }
    const headerCells = headerAt >= 0 ? records[headerAt].cells : [];
    const firstData = headerAt >= 0 ? headerAt + 1 : 0;
    const dataRecords = records.slice(firstData).filter((r) => r.cells.some(Boolean));
    const width = Math.max(headerCells.length, ...dataRecords.slice(0, 50).map((r) => r.cells.length), 0);

    let roles = Array.isArray(overrides.columns) ? Array.from({ length: width }, (_, i) => (ROLES.includes(overrides.columns[i]) ? overrides.columns[i] : "")) : (matched ? Array.from({ length: width }, (_, i) => matched.columns[i] || "") : rolesOf(headerCells));
    while (roles.length < width) roles.push("");
    const at = (role) => roles.indexOf(role);
    if (!(at("date") >= 0 && (at("amount") >= 0 || at("debit") >= 0 || at("credit") >= 0))) {
      return { ...base, delimiter, headerLine: headerAt >= 0 ? records[headerAt].line : 0, columns: roles.map((role, index) => ({ index, header: headerCells[index] || "", role })), failure: { code: "columnas", reason: "Falta la columna de fecha o la de importe (o debe/haber): indica a mano qué es cada columna." }, sample: dataRecords.slice(0, 5).map((r) => r.cells) };
    }
    const debitCredit = at("amount") < 0;
    const cell = (record, role) => (at(role) >= 0 ? text(record.cells[at(role)]) : "");

    // Formato decimal y orden de fechas por evidencia de todas las filas de datos.
    const numberRoles = ["amount", "debit", "credit", "balance"].filter((r) => at(r) >= 0);
    const decimalInfo = detectDecimal(dataRecords.flatMap((r) => numberRoles.map((role) => cell(r, role))).filter(Boolean));
    const decimal = overrides.decimal || (matched && matched.decimal) || decimalInfo.decimal;
    const dateValues = dataRecords.flatMap((r) => [cell(r, "date"), cell(r, "valueDate")]).filter(Boolean);
    const orderInfo = detectDateOrder(dateValues);
    const dateOrder = overrides.dateOrder || (matched && matched.dateOrder) || orderInfo.order;
    const invertSign = overrides.invertSign !== undefined ? Boolean(overrides.invertSign) : Boolean(matched && matched.invertSign);

    if (!overrides.decimal && !matched) {
      if (decimalInfo.certainty === "ambiguo") warnings.push({ code: "decimal-ambiguo", text: "Los importes con separador (por ejemplo «1.234») no dicen si el punto agrupa miles o marca decimales: he supuesto coma decimal (1.234 = mil doscientos treinta y cuatro). Compruébalo en la vista previa; si no es así, cámbialo." });
      if (decimalInfo.certainty === "mixto") warnings.push({ code: "decimal-mixto", text: `Las cifras mezclan formatos (coma decimal en ${decimalInfo.evidence.comma}, punto decimal en ${decimalInfo.evidence.dot}): he usado ${decimalInfo.decimal === "comma" ? "la coma" : "el punto"} y las demás saldrán como error de fila.` });
    }
    if (!overrides.dateOrder && !matched) {
      if (orderInfo.certainty === "ambiguo") warnings.push({ code: "fecha-ambigua", text: "Ninguna fecha decide entre día/mes y mes/día (todas tienen el día ≤ 12): he supuesto día/mes/año. Compruébalo en la vista previa." });
      if (orderInfo.certainty === "conflicto") warnings.push({ code: "fecha-conflicto", text: "Hay fechas que solo cuadran como día/mes y otras como mes/día: el fichero mezcla formatos. He usado día/mes/año y las demás saldrán como error de fila." });
    }
    if (matched) warnings.push({ code: "perfil", text: `Se ha aplicado tu perfil «${matched.name}» (separador, decimal, fechas y columnas guardados).` });

    const rows = [];
    const errors = [];
    let skipped = 0;
    let withoutConcept = 0;
    let badBalances = 0;
    let badValueDates = 0;
    const fail = (record, code, reason, detail = "") => {
      const entry = { line: record.line, code, reason, detail };
      if (errors.length < MAX_ERRORS) errors.push(entry);
      rows.push({ line: record.line, transaction: null, error: entry });
    };
    dataRecords.forEach((record) => {
      if (record.open) { fail(record, "comillas", "comillas sin cerrar"); return; }
      const dateText = cell(record, "date");
      const moneyCells = ["amount", "debit", "credit"].map((role) => cell(record, role)).filter(Boolean);
      if (!dateText && !moneyCells.length) { skipped += 1; return; } // fila de totales, de pie o vacía de datos
      const date = parseDate(dateText, dateOrder);
      if (!date) { fail(record, "fecha", dateText ? "fecha no reconocida" : "fecha vacía", dateText); return; }
      let amount;
      if (!debitCredit) {
        amount = parseNumber(cell(record, "amount"), decimal);
        if (amount === null) { fail(record, "importe", cell(record, "amount") ? "importe no reconocido" : "importe vacío", cell(record, "amount")); return; }
        if (at("sign") >= 0) {
          const mark = norm(cell(record, "sign"));
          if (SIGN_NEGATIVE.test(mark)) amount = -Math.abs(amount);
          else if (SIGN_POSITIVE.test(mark)) amount = Math.abs(amount);
          else { fail(record, "signo", "signo no reconocido (se esperaba debe/haber, D/H o cargo/abono)", cell(record, "sign")); return; }
        }
      } else {
        const debit = cell(record, "debit") ? parseNumber(cell(record, "debit"), decimal) : 0;
        const credit = cell(record, "credit") ? parseNumber(cell(record, "credit"), decimal) : 0;
        if (debit === null || credit === null) { fail(record, "importe", "importe no reconocido", `${cell(record, "debit")} ${cell(record, "credit")}`.trim()); return; }
        if (debit && credit) { fail(record, "debe-haber", "debe y haber a la vez en la misma fila"); return; }
        if (!debit && !credit && !(cell(record, "debit") || cell(record, "credit"))) { fail(record, "importe", "importe vacío"); return; }
        amount = Math.abs(credit) - Math.abs(debit);
      }
      if (invertSign) amount = -amount;
      let balance = null;
      if (cell(record, "balance")) { balance = parseNumber(cell(record, "balance"), decimal); if (balance === null) badBalances += 1; }
      let valueDate = date;
      if (cell(record, "valueDate")) { const parsed = parseDate(cell(record, "valueDate"), dateOrder); if (parsed) valueDate = parsed; else badValueDates += 1; }
      let movement = cell(record, "movement");
      const details = cell(record, "details");
      if (!movement) { movement = details || "(sin concepto)"; withoutConcept += 1; }
      rows.push({ line: record.line, transaction: { date, valueDate, movement, details, amount: round2(amount), balance: balance === null ? null : round2(balance) }, error: null });
    });

    const transactions = rows.filter((r) => r.transaction).map((r) => r.transaction);
    if (withoutConcept) warnings.push({ code: "sin-concepto", text: `${withoutConcept} fila(s) sin concepto: se importan como «(sin concepto)» o con sus «más datos»; el importe es real.` });
    if (badBalances) warnings.push({ code: "saldo", text: `${badBalances} saldo(s) no reconocido(s): esas filas entran sin saldo (no se inventa uno).` });
    if (badValueDates) warnings.push({ code: "fecha-valor", text: `${badValueDates} fecha(s) valor no reconocida(s): esas filas usan la fecha del movimiento.` });
    const balanceCheck = checkBalances(rows);
    if (balanceCheck.status === "signo-invertido") warnings.push({ code: "signo-invertido", text: `Los saldos encajan con los importes al revés (${balanceCheck.matches} de ${balanceCheck.pairs} filas): puede que los cargos y los abonos estén cambiados. No lo he corregido; si es así, usa «Invertir el signo».` });
    else if (balanceCheck.status === "no-cuadra") warnings.push({ code: "saldo-no-cuadra", text: `Los saldos no encajan con los importes (${balanceCheck.matches} de ${balanceCheck.pairs} filas): revisa el signo, el decimal o si faltan filas del fichero.` });
    if (errors.length) warnings.push({ code: "filas-con-error", text: `${errors.length} fila(s) no se han podido leer y NO se importarán; están listadas con su número de fila.` });

    const columns = roles.map((role, index) => ({ index, header: headerCells[index] || "", role }));
    return {
      schema: SCHEMA_ID, encoding, ok: transactions.length > 0, delimiter, decimal, dateOrder, invertSign,
      decimalCertainty: overrides.decimal || matched ? "fijado" : decimalInfo.certainty, dateCertainty: overrides.dateOrder || matched ? "fijado" : orderInfo.certainty,
      headerLine: headerAt >= 0 ? records[headerAt].line : 0, signature: headerAt >= 0 ? headerSignature(headerCells) : `sin-cabecera:${width}`,
      signMode: debitCredit ? "debe-haber" : at("sign") >= 0 ? "columna-signo" : "importe-con-signo",
      columns, transactions, rows, errors, skipped, errorsTruncated: errors.length >= MAX_ERRORS,
      preview: transactions.slice(0, 5), balanceCheck, warnings, profile: matched ? matched.name : null,
      failure: transactions.length ? null : { code: "sin-movimientos", reason: errors.length ? "Ninguna fila se ha podido leer: mira los motivos por fila." : "No hay filas de movimientos bajo la cabecera." },
    };
  }

  // ---------------------------------------------------------------- perfiles
  function normalizeProfile(raw) {
    if (!raw || typeof raw !== "object") return null;
    const name = text(raw.name).slice(0, 60);
    const delimiter = DELIMITERS.includes(raw.delimiter) ? raw.delimiter : null;
    const signature = text(raw.signature);
    if (!name || !delimiter || !signature || signature.startsWith("sin-cabecera")) return null;
    return {
      name, delimiter, signature,
      decimal: raw.decimal === "dot" ? "dot" : "comma",
      dateOrder: DATE_ORDERS.includes(raw.dateOrder) ? raw.dateOrder : "DMY",
      columns: Array.isArray(raw.columns) ? raw.columns.slice(0, 40).map((role) => (ROLES.includes(role) ? role : "")) : [],
      invertSign: Boolean(raw.invertSign),
    };
  }

  const normalizeProfiles = (list) => (Array.isArray(list) ? list.map(normalizeProfile).filter(Boolean).slice(0, MAX_PROFILES) : []);

  /** Perfil con nombre a partir de una lectura. Solo con cabecera (la firma identifica el formato); null si no la hay o si no se leyó nada. */
  function profileFromAnalysis(name, analysis) {
    if (!analysis || !analysis.ok) return null;
    return normalizeProfile({ name, delimiter: analysis.delimiter, signature: analysis.signature, decimal: analysis.decimal, dateOrder: analysis.dateOrder, columns: analysis.columns.map((c) => c.role), invertSign: analysis.invertSign });
  }

  /** Guarda (o sustituye por nombre) un perfil; máximo MAX_PROFILES, el más antiguo sale primero. Devuelve lista nueva. */
  function upsertProfile(list, profile) {
    const clean = normalizeProfile(profile);
    if (!clean) return normalizeProfiles(list);
    const rest = normalizeProfiles(list).filter((p) => p.name.toLowerCase() !== clean.name.toLowerCase() && p.signature !== clean.signature);
    return [...rest, clean].slice(-MAX_PROFILES);
  }

  const removeProfile = (list, name) => normalizeProfiles(list).filter((p) => p.name.toLowerCase() !== text(name).toLowerCase());

  // ---------------------------------------------------------------- diagnóstico
  const ROLE_LABEL = { date: "fecha", valueDate: "fecha valor", movement: "concepto", details: "más datos", amount: "importe", debit: "debe", credit: "haber", balance: "saldo", sign: "signo", ignore: "ignorar", "": "sin papel" };
  const DELIM_LABEL = { ";": "punto y coma", ",": "coma", "\t": "tabulador", "|": "barra vertical" };

  /**
   * Texto para copiar y pedir ayuda: estructura y motivos, NUNCA el contenido de las celdas (ni conceptos, ni importes, ni fechas).
   */
  function diagnosticText(analysis) {
    const a = analysis || {};
    const lines = ["Diagnóstico de lectura de extracto (WP-51)", `codificación: ${a.encoding || "?"}`];
    if (a.delimiter) lines.push(`separador: ${DELIM_LABEL[a.delimiter] || a.delimiter}`);
    if (a.decimal) lines.push(`decimal: ${a.decimal === "comma" ? "coma" : "punto"} (${a.decimalCertainty})`);
    if (a.dateOrder) lines.push(`fechas: ${a.dateOrder} (${a.dateCertainty})`);
    if (a.headerLine !== undefined && a.columns) lines.push(`cabecera: fila ${a.headerLine || "ninguna"}; columnas: ${a.columns.map((c) => ROLE_LABEL[c.role] || c.role).join(", ")}`);
    if (a.signMode) lines.push(`signo: ${a.signMode}${a.invertSign ? " (invertido por el hogar)" : ""}`);
    lines.push(`movimientos leídos: ${(a.transactions || []).length}; filas omitidas sin datos: ${a.skipped || 0}; filas con error: ${(a.errors || []).length}`);
    if (a.balanceCheck) lines.push(`comprobación de saldos: ${a.balanceCheck.status}${a.balanceCheck.pairs ? ` (${a.balanceCheck.matches || 0}/${a.balanceCheck.pairs})` : ""}`);
    (a.errors || []).slice(0, 30).forEach((e) => lines.push(`fila ${e.line}: ${e.reason}`));
    if (a.failure) lines.push(`fallo: ${a.failure.reason}`);
    (a.warnings || []).forEach((w) => lines.push(`aviso ${w.code}`));
    return lines.join("\n");
  }

  return Object.freeze({
    SCHEMA_ID, MAX_PROFILES, ROLES, DATE_ORDERS, DELIMITERS, ROLE_LABEL, DELIM_LABEL,
    decode, parseRecords, detectDelimiter, headerRole, parseNumber, detectDecimal, parseDate, detectDateOrder,
    analyze, normalizeProfiles, profileFromAnalysis, upsertProfile, removeProfile, diagnosticText,
  });
});
