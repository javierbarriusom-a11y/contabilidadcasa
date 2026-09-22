"use strict";

// ARQ-2 (BACKLOG_CONTABILIDADCASA_3_0.md §2.2): ESLint mínimo como gate de CI. Solo tres reglas
// deliberadas — variables no usadas, igualdad estricta, complejidad ciclomática — nada de estilo
// (comillas, punto y coma, orden de imports): eso es ruido, esto es corrección. El umbral de
// `complexity` no es el ideal, es el techo actual del propio código (ver comentario junto a la
// regla) — el gate evita que crezca más, no exige refactorizar hoy toda la deuda ya existente.
const globals = require("globals");

const browserGlobals = { ...globals.browser, ...globals.node };

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "vendor/**",
      "test-results/**",
      "playwright-report/**",
      ".lighthouseci/**",
      "coverage/**",
    ],
  },
  {
    // Motores canónicos, app.js, views/*.js y service-worker.js: scripts clásicos (sin
    // import/export — ARQ-4 ya fijó por qué, conflicto con vm.Script en los tests), pero
    // preparados para ejecutarse también bajo Node (`require`/`module.exports` condicionales),
    // de ahí la unión de globals de navegador y de Node en vez de uno solo.
    files: ["*.js", "views/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: browserGlobals,
    },
    rules: {
      // vars: "local" — con sourceType "script" el ámbito de fichero ES el ámbito global: sin
      // ESM ni bundler, cada función declarada arriba del todo (app.js, cada views/*.js, cada
      // canonical-*.js) es un global consumido desde OTRO fichero (el propio patrón del proyecto,
      // ver ARQ-4) que ESLint no puede ver fichero a fichero. Comprobar solo variables locales
      // (dentro de funciones/bloques) evita cientos de falsos positivos "nunca usada" sobre
      // funciones que sí se usan, y sigue cazando lo que de verdad importa: una variable local
      // declarada y nunca leída dentro de una función.
      // ignoreRestSiblings — patrón habitual en la app para descartar campos de un objeto antes
      // de guardarlo (`const { preview, title, ...cleanProject } = project`): preview/title
      // quedan sin usar a propósito, el objetivo es el resto vía spread, no un olvido.
      "no-unused-vars": ["error", { vars: "local", args: "none", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
      eqeqeq: ["error", "always", { null: "ignore" }],
      // Techo real medido en app.js con --rule complexity al construir este gate (ver
      // PROJECT_STATE.md, cierre de la sesión que añadió ARQ-2) — no es un objetivo de diseño,
      // es el punto de partida real para que ninguna función nueva lo supere sin que el propio
      // linter avise. `init()` (app.js) queda excluida aparte, ver su propio comentario junto a
      // la declaración: con 313 no cabe en ningún techo razonable para el resto del código.
      complexity: ["error", 90],
    },
  },
  {
    files: ["tools/**/*.mjs", "backend/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      "no-unused-vars": ["error", { args: "none", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
      eqeqeq: ["error", "always", { null: "ignore" }],
      complexity: ["error", 40],
    },
  },
  {
    files: ["tests/**/*.test.cjs", "tests/**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules: {
      "no-unused-vars": ["error", { args: "none", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
      eqeqeq: ["error", "always", { null: "ignore" }],
      complexity: ["error", 40],
    },
  },
];
