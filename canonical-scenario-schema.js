(function attachCanonicalScenarioSchema(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalScenarioSchema = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalScenarioSchemaFactory() {
  "use strict";

  const SCHEMA_ID = "finance-e19-scenario-schema/v1";
  const SCHEMA_VERSION = "1.0";

  const ESCENARIO_ESTADOS = Object.freeze(["borrador", "guardado", "aplicado", "archivado"]);
  const MODOS_TRASPASO = Object.freeze(["prudente", "reserva_minima"]);
  const ESTACIONALIDADES = Object.freeze(["aprendida", "plana", "manual"]);
  const SEVERIDADES_GUARDARRAIL = Object.freeze(["dura", "blanda"]);
  const PLANIFICACION_MODOS = Object.freeze(["optimo", "manual"]);
  const CUENTAS = Object.freeze(["caixabank", "mediolanum", "externo"]);
  const TITULARES = Object.freeze(["hogar", "javi", "tere"]);
  const PROYECTO_MODALIDADES = Object.freeze(["hucha", "pago_unico", "financiado"]);

  const DECISION_TYPES = Object.freeze([
    "amortizacion",
    "amortizacion_fraccionada",
    "refinanciacion",
    "reunificacion",
    "retomar_pagos",
    "acuerdo_quita",
    "compra",
    "proyecto",
    "imprevisto",
    "cambio_ingreso",
    "cambio_gasto",
    "traspaso",
    "cambio_presupuesto",
    // E-1 (Escenarios.pdf, 17 de agosto): los dos tipos de deuda que el catálogo no cubría.
    "deuda_nueva",
    "prestamo_familiar",
    // E-1b: un tipo propio no declara su propia forma en el esquema — todos comparten esta, con
    // `definicionId` señalando su definición (nombre, familia, campos elegidos) en `app.js`.
    "propio",
  ]);

  const ID_PATTERN = (prefix) => new RegExp(`^${prefix}_[0-9A-HJKMNP-TV-Z]{26}$`);
  const MONTH_PATTERN = /^\d{4}-\d{2}$/;
  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function isInteger(value) {
    return typeof value === "number" && Number.isInteger(value);
  }

  function isNonEmptyString(value, maxLength) {
    return typeof value === "string" && value.length >= 1 && (maxLength === undefined || value.length <= maxLength);
  }

  function inRange(value, min, max) {
    return isFiniteNumber(value) && value >= min && value <= max;
  }

  function pushIssue(issues, severity, code, path, message) {
    issues.push({ severity, code, path, message });
  }

  function error(issues, path, code, message) {
    pushIssue(issues, "error", code, path, message);
  }

  function requireFields(value, keys, path, issues) {
    keys.forEach((key) => {
      if (value[key] === undefined) {
        error(issues, `${path}.${key}`, "missing-required-field", `Falta el campo obligatorio «${key}».`);
      }
    });
  }

  function rejectExtraProperties(value, allowedKeys, path, issues) {
    Object.keys(value).forEach((key) => {
      if (!allowedKeys.includes(key)) {
        error(issues, `${path}.${key}`, "unexpected-property", `El campo «${key}» no está permitido en ${path}.`);
      }
    });
  }

  function validateId(value, prefix, path, issues, required) {
    if (value === undefined || value === null) {
      if (required) error(issues, path, "invalid-id", `${path} debe ser un identificador ${prefix}_… válido.`);
      return;
    }
    if (!ID_PATTERN(prefix).test(String(value))) {
      error(issues, path, "invalid-id", `${path} debe cumplir el patrón ${prefix}_ + 26 caracteres Crockford base32.`);
    }
  }

  // ---------------------------------------------------------------------
  // Escenario · base / supuestos / guardarrailes / aplicacion / meta
  // ---------------------------------------------------------------------

  function validateBase(base, path, issues) {
    if (!isPlainObject(base)) {
      error(issues, path, "invalid-type", `${path} debe ser un objeto.`);
      return;
    }
    const allowed = ["datasetVersion", "fechaCorte", "hashIntegridad", "horizonteMeses"];
    requireFields(base, allowed, path, issues);
    rejectExtraProperties(base, allowed, path, issues);
    if (base.datasetVersion !== undefined && !isNonEmptyString(base.datasetVersion)) {
      error(issues, `${path}.datasetVersion`, "invalid-value", "datasetVersion debe ser una cadena no vacía.");
    }
    if (base.fechaCorte !== undefined && !DATE_PATTERN.test(String(base.fechaCorte))) {
      error(issues, `${path}.fechaCorte`, "invalid-value", "fechaCorte debe tener formato AAAA-MM-DD.");
    }
    if (base.hashIntegridad !== undefined && !HASH_PATTERN.test(String(base.hashIntegridad))) {
      error(issues, `${path}.hashIntegridad`, "invalid-value", "hashIntegridad debe tener formato sha256:<64 hex>.");
    }
    if (base.horizonteMeses !== undefined && !(isInteger(base.horizonteMeses) && base.horizonteMeses >= 12 && base.horizonteMeses <= 240)) {
      error(issues, `${path}.horizonteMeses`, "invalid-value", "horizonteMeses debe ser un entero entre 12 y 240.");
    }
  }

  function validateSupuestos(supuestos, path, issues) {
    if (!isPlainObject(supuestos)) {
      error(issues, path, "invalid-type", `${path} debe ser un objeto.`);
      return;
    }
    const required = [
      "inflacionAnual", "derivaIngresosAnual", "derivaGastosAnual",
      "rentabilidadAhorroAnual", "deltaTipoVariable", "modoTraspaso",
    ];
    const allowed = [...required, "estacionalidad"];
    requireFields(supuestos, required, path, issues);
    rejectExtraProperties(supuestos, allowed, path, issues);

    const ranged = [
      ["inflacionAnual", -0.10, 0.30],
      ["derivaIngresosAnual", -0.50, 0.50],
      ["derivaGastosAnual", -0.30, 0.50],
      ["rentabilidadAhorroAnual", 0, 0.20],
      ["deltaTipoVariable", -0.05, 0.10],
    ];
    ranged.forEach(([field, min, max]) => {
      if (supuestos[field] !== undefined && !inRange(supuestos[field], min, max)) {
        error(issues, `${path}.${field}`, "invalid-value", `${field} debe estar entre ${min} y ${max}.`);
      }
    });
    if (supuestos.modoTraspaso !== undefined && !MODOS_TRASPASO.includes(supuestos.modoTraspaso)) {
      error(issues, `${path}.modoTraspaso`, "invalid-enum", `modoTraspaso debe ser uno de: ${MODOS_TRASPASO.join(", ")}.`);
    }
    if (supuestos.estacionalidad !== undefined && !ESTACIONALIDADES.includes(supuestos.estacionalidad)) {
      error(issues, `${path}.estacionalidad`, "invalid-enum", `estacionalidad debe ser una de: ${ESTACIONALIDADES.join(", ")}.`);
    }
  }

  function validateGuardarrailes(guardarrailes, path, issues) {
    if (!isPlainObject(guardarrailes)) {
      error(issues, path, "invalid-type", `${path} debe ser un objeto.`);
      return;
    }
    const required = ["reservaOperativaCaixaBank", "colchonMinimoMeses", "ratioCuotaIngresoMax", "saldoMinimoAbsoluto"];
    const allowed = [...required, "severidades"];
    requireFields(guardarrailes, required, path, issues);
    rejectExtraProperties(guardarrailes, allowed, path, issues);

    if (guardarrailes.reservaOperativaCaixaBank !== undefined && !(isFiniteNumber(guardarrailes.reservaOperativaCaixaBank) && guardarrailes.reservaOperativaCaixaBank >= 0)) {
      error(issues, `${path}.reservaOperativaCaixaBank`, "invalid-value", "reservaOperativaCaixaBank debe ser un número ≥ 0.");
    }
    if (guardarrailes.colchonMinimoMeses !== undefined && !inRange(guardarrailes.colchonMinimoMeses, 0, 24)) {
      error(issues, `${path}.colchonMinimoMeses`, "invalid-value", "colchonMinimoMeses debe estar entre 0 y 24.");
    }
    if (guardarrailes.ratioCuotaIngresoMax !== undefined && !inRange(guardarrailes.ratioCuotaIngresoMax, 0, 1)) {
      error(issues, `${path}.ratioCuotaIngresoMax`, "invalid-value", "ratioCuotaIngresoMax debe estar entre 0 y 1.");
    }
    if (guardarrailes.saldoMinimoAbsoluto !== undefined && !(isFiniteNumber(guardarrailes.saldoMinimoAbsoluto) && guardarrailes.saldoMinimoAbsoluto >= 0)) {
      error(issues, `${path}.saldoMinimoAbsoluto`, "invalid-value", "saldoMinimoAbsoluto debe ser un número ≥ 0.");
    }
    if (guardarrailes.severidades !== undefined) {
      if (!isPlainObject(guardarrailes.severidades)) {
        error(issues, `${path}.severidades`, "invalid-type", "severidades debe ser un objeto.");
      } else {
        Object.entries(guardarrailes.severidades).forEach(([key, value]) => {
          if (!SEVERIDADES_GUARDARRAIL.includes(value)) {
            error(issues, `${path}.severidades.${key}`, "invalid-enum", `severidades.${key} debe ser «dura» o «blanda».`);
          }
        });
      }
    }
  }

  function validateAplicacion(aplicacion, path, issues) {
    if (!isPlainObject(aplicacion)) {
      error(issues, path, "invalid-type", `${path} debe ser un objeto.`);
      return;
    }
    const allowed = ["aplicadoEl", "motivo", "snapshotPrevioId", "revertidoEl"];
    requireFields(aplicacion, ["aplicadoEl", "motivo", "snapshotPrevioId"], path, issues);
    rejectExtraProperties(aplicacion, allowed, path, issues);
    if (aplicacion.aplicadoEl !== undefined && !isNonEmptyString(aplicacion.aplicadoEl)) {
      error(issues, `${path}.aplicadoEl`, "invalid-value", "aplicadoEl debe ser una marca de tiempo.");
    }
    if (aplicacion.motivo !== undefined && !isNonEmptyString(aplicacion.motivo)) {
      error(issues, `${path}.motivo`, "invalid-value", "motivo es obligatorio y no puede estar vacío.");
    }
    if (aplicacion.snapshotPrevioId !== undefined && !isNonEmptyString(aplicacion.snapshotPrevioId)) {
      error(issues, `${path}.snapshotPrevioId`, "invalid-value", "snapshotPrevioId es obligatorio para poder revertir.");
    }
  }

  function validateMeta(meta, path, issues) {
    if (!isPlainObject(meta)) {
      error(issues, path, "invalid-type", `${path} debe ser un objeto.`);
      return;
    }
    rejectExtraProperties(meta, ["etiquetas", "favorito"], path, issues);
    if (meta.etiquetas !== undefined) {
      if (!Array.isArray(meta.etiquetas) || meta.etiquetas.length > 10 || meta.etiquetas.some((tag) => typeof tag !== "string")) {
        error(issues, `${path}.etiquetas`, "invalid-value", "etiquetas debe ser un array de hasta 10 cadenas.");
      }
    }
    if (meta.favorito !== undefined && typeof meta.favorito !== "boolean") {
      error(issues, `${path}.favorito`, "invalid-value", "favorito debe ser booleano.");
    }
  }

  // ---------------------------------------------------------------------
  // Decisión · planificación / cuenta / params por tipo
  // ---------------------------------------------------------------------

  function validatePlanificacion(planificacion, path, issues) {
    if (!isPlainObject(planificacion)) {
      error(issues, path, "invalid-type", `${path} debe ser un objeto.`);
      return;
    }
    const allowed = ["modo", "mesManual", "mesResuelto"];
    requireFields(planificacion, ["modo"], path, issues);
    rejectExtraProperties(planificacion, allowed, path, issues);
    if (planificacion.modo !== undefined && !PLANIFICACION_MODOS.includes(planificacion.modo)) {
      error(issues, `${path}.modo`, "invalid-enum", `modo debe ser uno de: ${PLANIFICACION_MODOS.join(", ")}.`);
    }
    if (planificacion.modo === "manual") {
      if (typeof planificacion.mesManual !== "string" || !MONTH_PATTERN.test(planificacion.mesManual)) {
        error(issues, `${path}.mesManual`, "missing-required-field", "mesManual es obligatorio (AAAA-MM) cuando modo es «manual».");
      }
    }
    if (planificacion.mesManual !== undefined && planificacion.mesManual !== null && !MONTH_PATTERN.test(String(planificacion.mesManual))) {
      error(issues, `${path}.mesManual`, "invalid-value", "mesManual debe tener formato AAAA-MM o ser null.");
    }
    if (planificacion.mesResuelto !== undefined && planificacion.mesResuelto !== null && !MONTH_PATTERN.test(String(planificacion.mesResuelto))) {
      error(issues, `${path}.mesResuelto`, "invalid-value", "mesResuelto debe tener formato AAAA-MM o ser null.");
    }
  }

  function validateCuenta(cuenta, path, issues) {
    if (!isPlainObject(cuenta)) {
      error(issues, path, "invalid-type", `${path} debe ser un objeto.`);
      return;
    }
    rejectExtraProperties(cuenta, ["origen", "destino"], path, issues);
    ["origen", "destino"].forEach((field) => {
      const value = cuenta[field];
      if (value !== undefined && value !== null && !CUENTAS.includes(value)) {
        error(issues, `${path}.${field}`, "invalid-enum", `${field} debe ser uno de: ${CUENTAS.join(", ")} o null.`);
      }
    });
  }

  function requirePositiveNumber(params, field, path, issues, { min = 0, exclusive = true } = {}) {
    const value = params[field];
    const ok = isFiniteNumber(value) && (exclusive ? value > min : value >= min);
    if (!ok) error(issues, `${path}.${field}`, "invalid-value", `${field} debe ser un número ${exclusive ? "mayor que" : "≥"} ${min}.`);
  }

  function requireMonth(params, field, path, issues, required = true) {
    const value = params[field];
    if (value === undefined) {
      if (required) error(issues, `${path}.${field}`, "missing-required-field", `Falta el campo obligatorio «${field}».`);
      return;
    }
    if (!MONTH_PATTERN.test(String(value))) {
      error(issues, `${path}.${field}`, "invalid-value", `${field} debe tener formato AAAA-MM.`);
    }
  }

  const PARAMS_VALIDATORS = Object.freeze({
    amortizacion(params, path, issues) {
      const allowed = ["deudaId", "importe", "parcial"];
      requireFields(params, ["deudaId", "importe"], path, issues);
      rejectExtraProperties(params, allowed, path, issues);
      if (params.deudaId !== undefined && !isNonEmptyString(params.deudaId)) error(issues, `${path}.deudaId`, "invalid-value", "deudaId debe ser una cadena no vacía.");
      if (params.importe !== undefined) requirePositiveNumber(params, "importe", path, issues);
      if (params.parcial !== undefined && typeof params.parcial !== "boolean") error(issues, `${path}.parcial`, "invalid-value", "parcial debe ser booleano.");
    },

    amortizacion_fraccionada(params, path, issues) {
      const allowed = ["deudaId", "importeMensual", "meses"];
      requireFields(params, allowed, path, issues);
      rejectExtraProperties(params, allowed, path, issues);
      if (params.deudaId !== undefined && !isNonEmptyString(params.deudaId)) error(issues, `${path}.deudaId`, "invalid-value", "deudaId debe ser una cadena no vacía.");
      if (params.importeMensual !== undefined) requirePositiveNumber(params, "importeMensual", path, issues);
      if (params.meses !== undefined && !(isInteger(params.meses) && params.meses >= 1)) error(issues, `${path}.meses`, "invalid-value", "meses debe ser un entero ≥ 1.");
    },

    refinanciacion(params, path, issues) {
      const required = ["deudaId", "nuevoPrincipal", "nuevoTIN", "nuevaCuota", "nuevoPlazo"];
      const allowed = [...required, "comisiones"];
      requireFields(params, required, path, issues);
      rejectExtraProperties(params, allowed, path, issues);
      if (params.deudaId !== undefined && !isNonEmptyString(params.deudaId)) error(issues, `${path}.deudaId`, "invalid-value", "deudaId debe ser una cadena no vacía.");
      if (params.nuevoPrincipal !== undefined) requirePositiveNumber(params, "nuevoPrincipal", path, issues);
      if (params.nuevoTIN !== undefined && !inRange(params.nuevoTIN, 0, 0.60)) error(issues, `${path}.nuevoTIN`, "invalid-value", "nuevoTIN debe estar entre 0 y 0,60.");
      if (params.nuevaCuota !== undefined) requirePositiveNumber(params, "nuevaCuota", path, issues);
      if (params.nuevoPlazo !== undefined && !(isInteger(params.nuevoPlazo) && params.nuevoPlazo >= 1 && params.nuevoPlazo <= 480)) error(issues, `${path}.nuevoPlazo`, "invalid-value", "nuevoPlazo debe ser un entero entre 1 y 480.");
      if (params.comisiones !== undefined && !(isFiniteNumber(params.comisiones) && params.comisiones >= 0)) error(issues, `${path}.comisiones`, "invalid-value", "comisiones debe ser un número ≥ 0.");
    },

    reunificacion(params, path, issues) {
      const required = ["deudaIds", "nuevoPrincipal", "nuevoTIN", "nuevaCuota", "nuevoPlazo"];
      const allowed = [...required, "comisiones"];
      requireFields(params, required, path, issues);
      rejectExtraProperties(params, allowed, path, issues);
      if (params.deudaIds !== undefined && !(Array.isArray(params.deudaIds) && params.deudaIds.length >= 2 && params.deudaIds.every((id) => isNonEmptyString(id)))) {
        error(issues, `${path}.deudaIds`, "invalid-value", "deudaIds debe ser un array de al menos 2 identificadores.");
      }
      if (params.nuevoPrincipal !== undefined) requirePositiveNumber(params, "nuevoPrincipal", path, issues);
      if (params.nuevoTIN !== undefined && !inRange(params.nuevoTIN, 0, 0.60)) error(issues, `${path}.nuevoTIN`, "invalid-value", "nuevoTIN debe estar entre 0 y 0,60.");
      if (params.nuevaCuota !== undefined) requirePositiveNumber(params, "nuevaCuota", path, issues);
      if (params.nuevoPlazo !== undefined && !(isInteger(params.nuevoPlazo) && params.nuevoPlazo >= 1 && params.nuevoPlazo <= 480)) error(issues, `${path}.nuevoPlazo`, "invalid-value", "nuevoPlazo debe ser un entero entre 1 y 480.");
      if (params.comisiones !== undefined && !(isFiniteNumber(params.comisiones) && params.comisiones >= 0)) error(issues, `${path}.comisiones`, "invalid-value", "comisiones debe ser un número ≥ 0.");
    },

    retomar_pagos(params, path, issues) {
      const allowed = ["deudaId", "cuota", "mesInicio"];
      requireFields(params, allowed, path, issues);
      rejectExtraProperties(params, allowed, path, issues);
      if (params.deudaId !== undefined && !isNonEmptyString(params.deudaId)) error(issues, `${path}.deudaId`, "invalid-value", "deudaId debe ser una cadena no vacía.");
      if (params.cuota !== undefined) requirePositiveNumber(params, "cuota", path, issues);
      requireMonth(params, "mesInicio", path, issues, params.mesInicio !== undefined);
    },

    acuerdo_quita(params, path, issues) {
      const allowed = ["deudaId", "importePactado", "modalidad", "vigenciaHasta"];
      requireFields(params, allowed, path, issues);
      rejectExtraProperties(params, allowed, path, issues);
      if (params.deudaId !== undefined && !isNonEmptyString(params.deudaId)) error(issues, `${path}.deudaId`, "invalid-value", "deudaId debe ser una cadena no vacía.");
      if (params.importePactado !== undefined) requirePositiveNumber(params, "importePactado", path, issues);
      if (params.modalidad !== undefined && !isNonEmptyString(params.modalidad)) error(issues, `${path}.modalidad`, "invalid-value", "modalidad debe ser una cadena no vacía.");
      if (params.vigenciaHasta !== undefined && !DATE_PATTERN.test(String(params.vigenciaHasta))) error(issues, `${path}.vigenciaHasta`, "invalid-value", "vigenciaHasta debe tener formato AAAA-MM-DD.");
    },

    compra(params, path, issues) {
      const allowed = ["nombre", "importe", "financiacion"];
      requireFields(params, ["nombre", "importe"], path, issues);
      rejectExtraProperties(params, allowed, path, issues);
      if (params.nombre !== undefined && !isNonEmptyString(params.nombre)) error(issues, `${path}.nombre`, "invalid-value", "nombre debe ser una cadena no vacía.");
      if (params.importe !== undefined) requirePositiveNumber(params, "importe", path, issues);
      if (params.financiacion !== undefined && params.financiacion !== null) {
        const financiacion = params.financiacion;
        const finPath = `${path}.financiacion`;
        if (!isPlainObject(financiacion)) {
          error(issues, finPath, "invalid-type", "financiacion debe ser un objeto o null.");
        } else {
          const finAllowed = ["principal", "TIN", "cuota", "plazo", "comisiones"];
          requireFields(financiacion, ["principal", "TIN", "cuota", "plazo"], finPath, issues);
          rejectExtraProperties(financiacion, finAllowed, finPath, issues);
          if (financiacion.principal !== undefined) requirePositiveNumber(financiacion, "principal", finPath, issues);
          if (financiacion.TIN !== undefined && !inRange(financiacion.TIN, 0, 0.60)) error(issues, `${finPath}.TIN`, "invalid-value", "TIN debe estar entre 0 y 0,60.");
          if (financiacion.cuota !== undefined) requirePositiveNumber(financiacion, "cuota", finPath, issues);
          if (financiacion.plazo !== undefined && !(isInteger(financiacion.plazo) && financiacion.plazo >= 1 && financiacion.plazo <= 480)) error(issues, `${finPath}.plazo`, "invalid-value", "plazo debe ser un entero entre 1 y 480.");
          if (financiacion.comisiones !== undefined && !(isFiniteNumber(financiacion.comisiones) && financiacion.comisiones >= 0)) error(issues, `${finPath}.comisiones`, "invalid-value", "comisiones debe ser un número ≥ 0.");
        }
      }
    },

    proyecto(params, path, issues) {
      const allowed = ["nombre", "importeObjetivo", "modalidad", "mesObjetivo"];
      requireFields(params, allowed, path, issues);
      rejectExtraProperties(params, allowed, path, issues);
      if (params.nombre !== undefined && !isNonEmptyString(params.nombre)) error(issues, `${path}.nombre`, "invalid-value", "nombre debe ser una cadena no vacía.");
      if (params.importeObjetivo !== undefined) requirePositiveNumber(params, "importeObjetivo", path, issues);
      if (params.modalidad !== undefined && !PROYECTO_MODALIDADES.includes(params.modalidad)) error(issues, `${path}.modalidad`, "invalid-enum", `modalidad debe ser una de: ${PROYECTO_MODALIDADES.join(", ")}.`);
      requireMonth(params, "mesObjetivo", path, issues, params.mesObjetivo !== undefined);
    },

    imprevisto(params, path, issues) {
      const allowed = ["importe", "mes", "recurrenciaMeses"];
      requireFields(params, ["importe", "mes"], path, issues);
      rejectExtraProperties(params, allowed, path, issues);
      if (params.importe !== undefined) requirePositiveNumber(params, "importe", path, issues);
      requireMonth(params, "mes", path, issues, params.mes !== undefined);
      if (params.recurrenciaMeses !== undefined && params.recurrenciaMeses !== null && !(isInteger(params.recurrenciaMeses) && params.recurrenciaMeses >= 1)) {
        error(issues, `${path}.recurrenciaMeses`, "invalid-value", "recurrenciaMeses debe ser un entero ≥ 1 o null.");
      }
    },

    cambio_ingreso(params, path, issues) {
      const allowed = ["titular", "deltaMensual", "mesInicio", "mesFin"];
      requireFields(params, ["titular", "deltaMensual", "mesInicio"], path, issues);
      rejectExtraProperties(params, allowed, path, issues);
      if (params.titular !== undefined && !TITULARES.includes(params.titular)) error(issues, `${path}.titular`, "invalid-enum", `titular debe ser uno de: ${TITULARES.join(", ")}.`);
      if (params.deltaMensual !== undefined && !isFiniteNumber(params.deltaMensual)) error(issues, `${path}.deltaMensual`, "invalid-value", "deltaMensual debe ser un número.");
      requireMonth(params, "mesInicio", path, issues, params.mesInicio !== undefined);
      if (params.mesFin !== undefined && params.mesFin !== null) requireMonth(params, "mesFin", path, issues, false);
    },

    cambio_gasto(params, path, issues) {
      const allowed = ["bloque", "deltaMensual", "deltaPct", "mesInicio", "mesFin"];
      requireFields(params, ["bloque", "mesInicio"], path, issues);
      rejectExtraProperties(params, allowed, path, issues);
      if (params.bloque !== undefined && !isNonEmptyString(params.bloque)) error(issues, `${path}.bloque`, "invalid-value", "bloque debe ser una cadena no vacía.");
      if (params.deltaMensual === undefined && params.deltaPct === undefined) {
        error(issues, path, "missing-required-field", "cambio_gasto exige deltaMensual o deltaPct.");
      }
      if (params.deltaMensual !== undefined && !isFiniteNumber(params.deltaMensual)) error(issues, `${path}.deltaMensual`, "invalid-value", "deltaMensual debe ser un número.");
      if (params.deltaPct !== undefined && !isFiniteNumber(params.deltaPct)) error(issues, `${path}.deltaPct`, "invalid-value", "deltaPct debe ser un número.");
      requireMonth(params, "mesInicio", path, issues, params.mesInicio !== undefined);
      if (params.mesFin !== undefined && params.mesFin !== null) requireMonth(params, "mesFin", path, issues, false);
    },

    traspaso(params, path, issues) {
      const allowed = ["origen", "destino", "importe", "mes", "recurrente"];
      requireFields(params, ["origen", "destino", "importe", "mes"], path, issues);
      rejectExtraProperties(params, allowed, path, issues);
      ["origen", "destino"].forEach((field) => {
        if (params[field] !== undefined && !CUENTAS.slice(0, 2).includes(params[field])) {
          error(issues, `${path}.${field}`, "invalid-enum", `${field} debe ser «caixabank» o «mediolanum».`);
        }
      });
      if (params.importe !== undefined) requirePositiveNumber(params, "importe", path, issues);
      requireMonth(params, "mes", path, issues, params.mes !== undefined);
      if (params.recurrente !== undefined && typeof params.recurrente !== "boolean") error(issues, `${path}.recurrente`, "invalid-value", "recurrente debe ser booleano.");
    },

    cambio_presupuesto(params, path, issues) {
      const allowed = ["bloque", "nuevoTecho", "desde"];
      requireFields(params, allowed, path, issues);
      rejectExtraProperties(params, allowed, path, issues);
      if (params.bloque !== undefined && !isNonEmptyString(params.bloque)) error(issues, `${path}.bloque`, "invalid-value", "bloque debe ser una cadena no vacía.");
      if (params.nuevoTecho !== undefined && !(isFiniteNumber(params.nuevoTecho) && params.nuevoTecho >= 0)) error(issues, `${path}.nuevoTecho`, "invalid-value", "nuevoTecho debe ser un número ≥ 0.");
      requireMonth(params, "desde", path, issues, params.desde !== undefined);
    },

    // E-1: un préstamo nuevo que entra el mes indicado (suma a la liquidez) y sale como cuota fija
    // durante `plazo` meses desde el mes siguiente. No crea un contrato de deuda real (no muta
    // `DEBT_PORTFOLIO`): es un efecto de caja de la simulación, igual que `compra` financiada, así
    // que no cuenta para «Fecha libre de deuda» (esa cifra sigue leyendo solo la cartera real).
    deuda_nueva(params, path, issues) {
      const required = ["principal", "cuota", "plazo", "mes"];
      const allowed = [...required, "nombre"];
      requireFields(params, required, path, issues);
      rejectExtraProperties(params, allowed, path, issues);
      if (params.nombre !== undefined && !isNonEmptyString(params.nombre)) error(issues, `${path}.nombre`, "invalid-value", "nombre debe ser una cadena no vacía.");
      if (params.principal !== undefined) requirePositiveNumber(params, "principal", path, issues);
      if (params.cuota !== undefined) requirePositiveNumber(params, "cuota", path, issues);
      if (params.plazo !== undefined && !(isInteger(params.plazo) && params.plazo >= 1 && params.plazo <= 480)) error(issues, `${path}.plazo`, "invalid-value", "plazo debe ser un entero entre 1 y 480.");
      requireMonth(params, "mes", path, issues, params.mes !== undefined);
    },

    // E-1: dinero que entra o sale de la familia sin banco de por medio. `direccion` decide el
    // signo del importe inicial; la devolución (si se declara) va en sentido contrario, desde el
    // mes siguiente. Igual que `deuda_nueva`, no toca `DEBT_PORTFOLIO`.
    prestamo_familiar(params, path, issues) {
      const allowed = ["direccion", "importe", "mes", "devolucionMensual", "meses"];
      requireFields(params, ["direccion", "importe", "mes"], path, issues);
      rejectExtraProperties(params, allowed, path, issues);
      if (params.direccion !== undefined && !["prestamos", "nos_prestan"].includes(params.direccion)) {
        error(issues, `${path}.direccion`, "invalid-enum", "direccion debe ser «prestamos» o «nos_prestan».");
      }
      if (params.importe !== undefined) requirePositiveNumber(params, "importe", path, issues);
      requireMonth(params, "mes", path, issues, params.mes !== undefined);
      const hasDevolucion = params.devolucionMensual !== undefined || params.meses !== undefined;
      if (hasDevolucion) {
        if (params.devolucionMensual !== undefined) requirePositiveNumber(params, "devolucionMensual", path, issues);
        else error(issues, `${path}.devolucionMensual`, "missing-required-field", "devolucionMensual es obligatorio cuando se declara meses.");
        if (params.meses !== undefined && !(isInteger(params.meses) && params.meses >= 1)) error(issues, `${path}.meses`, "invalid-value", "meses debe ser un entero ≥ 1.");
        else if (params.meses === undefined) error(issues, `${path}.meses`, "missing-required-field", "meses es obligatorio cuando se declara devolucionMensual.");
      }
    },

    // E-1b: un tipo propio siempre valida contra esta forma genérica — los campos que su
    // definición no eligió simplemente no aparecen en `params`. `mes` ancla siempre la decisión
    // (igual que en los once tipos de fábrica); el resto son las mismas cuatro piezas que ofrece el
    // constructor: importe (de golpe), mensualidad + plazo (recurrente).
    propio(params, path, issues) {
      const allowed = ["definicionId", "nombre", "importe", "mensualidad", "plazo", "mes"];
      requireFields(params, ["definicionId", "nombre", "mes"], path, issues);
      rejectExtraProperties(params, allowed, path, issues);
      if (params.definicionId !== undefined && !isNonEmptyString(params.definicionId)) error(issues, `${path}.definicionId`, "invalid-value", "definicionId debe ser una cadena no vacía.");
      if (params.nombre !== undefined && !isNonEmptyString(params.nombre)) error(issues, `${path}.nombre`, "invalid-value", "nombre debe ser una cadena no vacía.");
      if (params.importe !== undefined) requirePositiveNumber(params, "importe", path, issues);
      if (params.mensualidad !== undefined) requirePositiveNumber(params, "mensualidad", path, issues);
      if (params.plazo !== undefined && !(isInteger(params.plazo) && params.plazo >= 1 && params.plazo <= 480)) error(issues, `${path}.plazo`, "invalid-value", "plazo debe ser un entero entre 1 y 480.");
      requireMonth(params, "mes", path, issues, params.mes !== undefined);
    },
  });

  function validateDecisionParams(tipo, params, path, issues) {
    if (!isPlainObject(params)) {
      error(issues, path, "invalid-type", `${path} debe ser un objeto.`);
      return;
    }
    const validator = PARAMS_VALIDATORS[tipo];
    if (!validator) {
      error(issues, path, "unknown-decision-type", `No existe validador de params para el tipo «${tipo}».`);
      return;
    }
    validator(params, path, issues);
  }

  function validateDecision(decision, path, issues) {
    if (!isPlainObject(decision)) {
      error(issues, path, "invalid-type", `${path} debe ser un objeto.`);
      return;
    }
    const allowed = ["id", "tipo", "titulo", "activa", "orden", "planificacion", "cuenta", "dependeDe", "notas", "params"];
    const required = ["id", "tipo", "titulo", "activa", "orden", "planificacion", "params"];
    requireFields(decision, required, path, issues);
    rejectExtraProperties(decision, allowed, path, issues);

    validateId(decision.id, "dec", `${path}.id`, issues, decision.id !== undefined);
    if (decision.tipo !== undefined && !DECISION_TYPES.includes(decision.tipo)) {
      error(issues, `${path}.tipo`, "invalid-enum", `tipo debe ser uno de: ${DECISION_TYPES.join(", ")}.`);
    }
    if (decision.titulo !== undefined && !isNonEmptyString(decision.titulo, 60)) {
      error(issues, `${path}.titulo`, "invalid-value", "titulo debe tener entre 1 y 60 caracteres.");
    }
    if (decision.activa !== undefined && typeof decision.activa !== "boolean") {
      error(issues, `${path}.activa`, "invalid-value", "activa debe ser booleano.");
    }
    if (decision.orden !== undefined && !(isInteger(decision.orden) && decision.orden >= 0)) {
      error(issues, `${path}.orden`, "invalid-value", "orden debe ser un entero ≥ 0.");
    }
    if (decision.planificacion !== undefined) validatePlanificacion(decision.planificacion, `${path}.planificacion`, issues);
    if (decision.cuenta !== undefined) validateCuenta(decision.cuenta, `${path}.cuenta`, issues);
    if (decision.dependeDe !== undefined) {
      if (!Array.isArray(decision.dependeDe) || decision.dependeDe.length > 5 || decision.dependeDe.some((id) => typeof id !== "string")) {
        error(issues, `${path}.dependeDe`, "invalid-value", "dependeDe debe ser un array de hasta 5 identificadores.");
      }
    }
    if (decision.notas !== undefined && !isNonEmptyString(decision.notas, 300) && decision.notas !== "") {
      error(issues, `${path}.notas`, "invalid-value", "notas admite hasta 300 caracteres.");
    }
    if (decision.tipo !== undefined && DECISION_TYPES.includes(decision.tipo) && decision.params !== undefined) {
      validateDecisionParams(decision.tipo, decision.params, `${path}.params`, issues);
    }
  }

  // ---------------------------------------------------------------------
  // Grafo de dependencias · orden topológico y detección de ciclos (§2.3.1)
  // ---------------------------------------------------------------------

  function detectDependencyCycle(decisiones, path, issues) {
    if (!Array.isArray(decisiones)) return;
    const byId = new Map();
    decisiones.forEach((decision) => {
      if (isPlainObject(decision) && typeof decision.id === "string") byId.set(decision.id, decision);
    });

    const WHITE = 0; const GRAY = 1; const BLACK = 2;
    const state = new Map();
    byId.forEach((_, id) => state.set(id, WHITE));
    let cycleFound = false;

    function visit(id) {
      if (cycleFound || state.get(id) === BLACK) return;
      if (state.get(id) === GRAY) { cycleFound = true; return; }
      state.set(id, GRAY);
      const decision = byId.get(id);
      const deps = Array.isArray(decision?.dependeDe) ? decision.dependeDe : [];
      deps.forEach((depId) => { if (byId.has(depId)) visit(depId); });
      state.set(id, BLACK);
    }

    byId.forEach((_, id) => visit(id));
    if (cycleFound) {
      error(issues, path, "dependency-cycle", "El grafo de dependencias entre decisiones (dependeDe) contiene un ciclo.");
    }

    decisiones.forEach((decision, index) => {
      if (!isPlainObject(decision) || !Array.isArray(decision.dependeDe)) return;
      decision.dependeDe.forEach((depId) => {
        if (!byId.has(depId)) {
          error(issues, `${path}[${index}].dependeDe`, "unknown-dependency", `dependeDe referencia un identificador inexistente: «${depId}».`);
        }
      });
    });
  }

  // Orden de resolución real de las decisiones (§2.3 regla 1 del modelo de Escenario: "se
  // resuelven por orden ascendente, respetando dependeDe"). No simula nada financiero — es pura
  // teoría de grafos (orden topológico de Kahn, desempatado por el campo `orden` declarado) — así
  // que es verificable hoy sin esperar al motor de Escenario de E20. Sirve para el caso dorado
  // C044: cuando `orden` y `dependeDe` se contradicen, el orden topológico gana, nunca `orden`.
  function orderOf(decision) {
    const value = Number(decision?.orden);
    return Number.isFinite(value) ? value : 0;
  }

  function resolveExecutionOrder(decisiones) {
    const byId = new Map();
    (Array.isArray(decisiones) ? decisiones : []).forEach((decision) => {
      if (isPlainObject(decision) && typeof decision.id === "string") byId.set(decision.id, decision);
    });

    const inDegree = new Map();
    const dependents = new Map();
    byId.forEach((decision, id) => {
      const deps = (Array.isArray(decision.dependeDe) ? decision.dependeDe : []).filter((depId) => byId.has(depId));
      inDegree.set(id, deps.length);
      deps.forEach((depId) => {
        if (!dependents.has(depId)) dependents.set(depId, []);
        dependents.get(depId).push(id);
      });
    });

    const declaredOrder = Array.from(byId.keys()).sort((a, b) => orderOf(byId.get(a)) - orderOf(byId.get(b)) || a.localeCompare(b));

    const available = [];
    inDegree.forEach((degree, id) => { if (degree === 0) available.push(id); });
    const resolvedOrder = [];
    const remaining = new Set(byId.keys());
    while (available.length) {
      available.sort((a, b) => orderOf(byId.get(a)) - orderOf(byId.get(b)) || a.localeCompare(b));
      const next = available.shift();
      resolvedOrder.push(next);
      remaining.delete(next);
      (dependents.get(next) || []).forEach((depId) => {
        inDegree.set(depId, inDegree.get(depId) - 1);
        if (inDegree.get(depId) === 0) available.push(depId);
      });
    }

    const hasCycle = remaining.size > 0;
    const declaredOrderMatches = !hasCycle && declaredOrder.every((id, index) => id === resolvedOrder[index]);

    return {
      hasCycle,
      unresolved: hasCycle ? Array.from(remaining) : [],
      declaredOrder,
      resolvedOrder: hasCycle ? null : resolvedOrder,
      declaredOrderMatches,
    };
  }

  function validateDecisiones(decisiones, path, issues) {
    if (!Array.isArray(decisiones)) {
      error(issues, path, "invalid-type", `${path} debe ser un array.`);
      return;
    }
    if (decisiones.length > 30) {
      error(issues, path, "invalid-value", "Un escenario admite como máximo 30 decisiones.");
    }
    const seenIds = new Set();
    decisiones.forEach((decision, index) => {
      validateDecision(decision, `${path}[${index}]`, issues);
      if (isPlainObject(decision) && typeof decision.id === "string") {
        if (seenIds.has(decision.id)) {
          error(issues, `${path}[${index}].id`, "duplicate-id", `El identificador «${decision.id}» está repetido dentro del escenario.`);
        }
        seenIds.add(decision.id);
      }
    });
    detectDependencyCycle(decisiones, path, issues);
  }

  // ---------------------------------------------------------------------
  // Escenario · entrada principal
  // ---------------------------------------------------------------------

  const ESCENARIO_REQUIRED = ["schemaVersion", "id", "nombre", "estado", "base", "supuestos", "guardarrailes", "decisiones"];
  const ESCENARIO_ALLOWED = [
    ...ESCENARIO_REQUIRED,
    "descripcion", "padreId", "creadoEl", "modificadoEl", "obsoleto",
    "resultado", "aplicacion", "meta",
  ];

  function validateEscenario(escenario) {
    const issues = [];
    if (!isPlainObject(escenario)) {
      error(issues, "$", "invalid-type", "El escenario debe ser un objeto.");
      return { valid: false, issues };
    }

    requireFields(escenario, ESCENARIO_REQUIRED, "$", issues);
    rejectExtraProperties(escenario, ESCENARIO_ALLOWED, "$", issues);

    if (escenario.schemaVersion !== undefined && escenario.schemaVersion !== SCHEMA_VERSION) {
      error(issues, "$.schemaVersion", "invalid-value", `schemaVersion debe ser exactamente «${SCHEMA_VERSION}».`);
    }
    validateId(escenario.id, "scn", "$.id", issues, escenario.id !== undefined);
    if (escenario.nombre !== undefined && !isNonEmptyString(escenario.nombre, 80)) {
      error(issues, "$.nombre", "invalid-value", "nombre debe tener entre 1 y 80 caracteres.");
    }
    if (escenario.descripcion !== undefined && !(typeof escenario.descripcion === "string" && escenario.descripcion.length <= 500)) {
      error(issues, "$.descripcion", "invalid-value", "descripcion admite hasta 500 caracteres.");
    }
    if (escenario.padreId !== undefined && escenario.padreId !== null) {
      validateId(escenario.padreId, "scn", "$.padreId", issues, true);
    }
    if (escenario.estado !== undefined && !ESCENARIO_ESTADOS.includes(escenario.estado)) {
      error(issues, "$.estado", "invalid-enum", `estado debe ser uno de: ${ESCENARIO_ESTADOS.join(", ")}.`);
    }
    if (escenario.obsoleto !== undefined && typeof escenario.obsoleto !== "boolean") {
      error(issues, "$.obsoleto", "invalid-value", "obsoleto debe ser booleano.");
    }
    if (escenario.base !== undefined) validateBase(escenario.base, "$.base", issues);
    if (escenario.supuestos !== undefined) validateSupuestos(escenario.supuestos, "$.supuestos", issues);
    if (escenario.guardarrailes !== undefined) validateGuardarrailes(escenario.guardarrailes, "$.guardarrailes", issues);
    if (escenario.decisiones !== undefined) validateDecisiones(escenario.decisiones, "$.decisiones", issues);
    if (escenario.aplicacion !== undefined) validateAplicacion(escenario.aplicacion, "$.aplicacion", issues);
    if (escenario.meta !== undefined) validateMeta(escenario.meta, "$.meta", issues);

    if (escenario.estado === "aplicado" && escenario.aplicacion === undefined) {
      error(issues, "$.aplicacion", "missing-required-field", "Un escenario en estado «aplicado» debe declarar «aplicacion».");
    }

    return { valid: !issues.some((issue) => issue.severity === "error"), issues };
  }

  return {
    SCHEMA_ID,
    SCHEMA_VERSION,
    DECISION_TYPES,
    ESCENARIO_ESTADOS,
    MODOS_TRASPASO,
    ESTACIONALIDADES,
    SEVERIDADES_GUARDARRAIL,
    PLANIFICACION_MODOS,
    CUENTAS,
    TITULARES,
    PROYECTO_MODALIDADES,
    PARAMS_VALIDATORS,
    validateEscenario,
    validateDecision,
    validateDecisionParams,
    resolveExecutionOrder,
  };
});
