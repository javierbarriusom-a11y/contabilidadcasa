const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ESCALA, medirCss, medirJs, medirRepositorio, totales } = require("./helpers/ds-medida.cjs");

// DS-1 (D-N56, en F1): guardia de diseño como trinquete, igual que el techo de app.js (ARQ-4). Base medida el 27/11/2026 sobre
// main 81c6da55 (tras R2): 547 tamaños de letra, 1.614 espaciados y 286 radios fuera de la escala del sistema v2, y 138 `.toFixed(`.
// - Ningún fichero puede apartarse MÁS de la escala que en docs/gobierno/ds-base.json. Un fichero nuevo parte de 0: lo nuevo se
//   escribe con los tokens de DS-0 (--fs-*, --sp-*, --r-*, en design-tokens.css).
// - Cuando un PR lo baja (DS-2, DS-3), guarda la base nueva con `node tools/ds-medida.mjs --escribir` en el mismo PR, para que lo
//   ganado no se pierda.
// Qué cuenta y qué no: tests/helpers/ds-medida.cjs. Las comprobaciones e2e de DS-1 (un primario por vista y control segmentado de 4
// como máximo) van aparte, sobre las vistas de la batería.

const raiz = path.join(__dirname, "..");
const base = JSON.parse(fs.readFileSync(path.join(raiz, "docs", "gobierno", "ds-base.json"), "utf8"));
const hoy = medirRepositorio(raiz);

test("DS-1 · el medidor distingue lo que está en la escala de lo que no", () => {
  assert.deepEqual(ESCALA.tipografia, [48, 32, 19, 15, 13.5, 12.5, 11]);
  assert.deepEqual(
    medirCss(".a{font-size:15px;padding:8px 12px}.b{font-size:var(--fs-cuerpo);gap:var(--sp-2);border-radius:999px}"),
    { tipografia: 0, espaciado: 0, radios: 0 },
  );
  assert.deepEqual(
    medirCss(".a{font-size:14px;padding:10px 12px;margin:-1px;border-radius:10px}.b{font-size:0.875rem;gap:6px;border-top-left-radius:3px}"),
    { tipografia: 2, espaciado: 2, radios: 2 },
  );
  // Los tokens y los comentarios no cuentan; em y % tampoco.
  assert.deepEqual(medirCss(":root{--fs-x:14px}/* font-size: 14px */.a{font-size:1.2em;border-radius:50%}"), { tipografia: 0, espaciado: 0, radios: 0 });
  assert.equal(medirJs("a.toFixed(2); b.toFixed(0)").redondeo, 2);
});

test("DS-0 · los tokens de escala existen con los valores del sistema", () => {
  const css = fs.readFileSync(path.join(raiz, "design-tokens.css"), "utf8");
  const esperado = {
    "--fs-titulo": "32px", "--fs-seccion": "19px", "--fs-cuerpo": "15px", "--fs-compacto": "13.5px", "--fs-meta": "12.5px",
    "--fs-etiqueta": "11px", "--sp-1": "4px", "--sp-2": "8px", "--sp-3": "12px", "--sp-4": "16px", "--sp-5": "20px",
    "--sp-6": "24px", "--sp-8": "32px", "--r-control": "12px", "--r-tarjeta": "16px", "--r-hoja": "24px", "--r-pildora": "999px",
  };
  for (const [token, valor] of Object.entries(esperado)) assert.match(css, new RegExp(`${token}:\\s*${valor.replace(".", "\\.")};`), token);
  assert.match(css, /--fs-heroe:\s*clamp\(32px, 9vw, 48px\);/);
});

test("DS-1 · ningún fichero se aparta más de la escala que en la base", () => {
  const suben = [];
  for (const [f, cuenta] of Object.entries(hoy)) {
    for (const [k, n] of Object.entries(cuenta)) {
      const antes = ((base.ficheros[f] || {})[k]) || 0;
      if (n > antes) suben.push(`${f} · ${k}: ${antes} → ${n}`);
    }
  }
  assert.deepEqual(suben, [], "Usad los tokens de design-tokens.css (--fs-*, --sp-*, --r-*) y el formateador de cifras en vez de toFixed.");
});

test("DS-1 · trinquete: si algo ha bajado, la base se guarda en el mismo PR", () => {
  const bajan = [];
  for (const [f, cuenta] of Object.entries(base.ficheros)) {
    for (const [k, n] of Object.entries(cuenta)) {
      const ahora = ((hoy[f] || {})[k]) || 0;
      if (ahora < n) bajan.push(`${f} · ${k}: ${n} → ${ahora}`);
    }
  }
  assert.deepEqual(bajan, [], "Ejecutad `node tools/ds-medida.mjs --escribir` para que lo ganado quede en la base.");
  assert.deepEqual(base.totales, totales(base.ficheros), "Los totales de ds-base.json no cuadran con sus ficheros: regeneradla con la herramienta.");
});
