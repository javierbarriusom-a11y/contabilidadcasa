(function attachE17Experience(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceE17Experience = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function e17ExperienceFactory() {
  "use strict";

  const TASKS = Object.freeze([
    { target: "home", label: "Hoy", group: "main", keywords: "inicio caja alertas decisiones hoy riesgo" },
    { target: "update-hub", label: "Actualizar datos", group: "main", keywords: "saldos reales importar excel csv movimientos previsiones" },
    // T-1/V6-3 · Ajustes solo se alcanza desde la navegación principal, igual que Hoy o Actualizar
    // datos: no tiene entrada duplicada en el menú avanzado. Plan, Deuda y Cierre no repiten
    // entrada aquí: ya la tenían como `cuadro-mandos`, `deuda-ruta` y `conciliar` más abajo, y
    // duplicarla solo daría dos resultados iguales en el buscador.
    { target: "ajustes", label: "Ajustes", group: "main", keywords: "ajustes reserva operativa cuentas partidas umbrales exportar csv v6" },
    { target: "datos-importar", label: "Importar extracto en 4 pasos (nuevo)", group: "data", keywords: "importar extracto csv excel duplicados reglas clasificar incorporar deshacer nuevo e20 v4-4" },
    { target: "registrar-mes", label: "Registrar el mes (nuevo)", group: "data", keywords: "registrar mes real previsto usado desviacion partida guardado automatico nuevo e20 copiar reales" },
    { target: "cuadro-mandos", label: "Cuadro de mandos · detalle por partida (nuevo)", group: "analysis", keywords: "cuadro mandos detalle partida impacto editar celda previsto matriz nuevo e20" },
    { target: "cambios-pendientes", label: "Cambios pendientes (nuevo)", group: "analysis", keywords: "cambios pendientes bandeja revertir guardar descartar impacto conjunto nuevo e20" },
    { target: "mapa-calor", label: "Mapa de calor mensual (nuevo)", group: "analysis", keywords: "mapa calor colchon salud mensual peor mes riesgo nuevo e20" },
    { target: "forecast", label: "Prever", group: "analysis", keywords: "forecast proyeccion liquidez futuro" },
    // T-1 releva la decimoctava heredada: hasta ahora quedaba fuera de «legacy» solo porque era
    // pestaña principal («Decidir»). Al dejar de serlo, se releva como las diecisiete anteriores.
    { target: "new-life-definitive", label: "Simulación nueva vida definitiva", group: "legacy", keywords: "decisiones deuda coche proyectos traspasos decidir" },
    { target: "new-life-simulation", label: "Escenarios de vida y deuda", group: "legacy", keywords: "escenario simulacion imprevisto favorable tension" },
    { target: "escenario-simular", label: "Escenario · simular (nuevo)", group: "analysis", keywords: "escenario motor decision amortizar deuda nuevo e20 simular refinanciar reunificar quita retomar pagos compra proyecto imprevisto cambio ingreso gasto" },
    { target: "escenario-guardados", label: "Escenario · guardados (nuevo)", group: "analysis", keywords: "escenario motor guardados aplicado nuevo e20" },
    { target: "deuda-comparar", label: "Comparar estrategias de deuda (nuevo)", group: "analysis", keywords: "deuda estrategia comparar avalancha bola nieve nuevo e20" },
    { target: "deuda-ruta", label: "Plan de deuda · ruta (nuevo)", group: "analysis", keywords: "deuda ruta plan libre nuevo e20" },
    { target: "deuda-contratos", label: "Contratos de deuda (nuevo)", group: "analysis", keywords: "deuda contratos capital tae cuota editar corregir nuevo e20 d-2" },
    { target: "conciliar", label: "Conciliación (nuevo)", group: "data", keywords: "conciliacion cerrar mes tareas extracto nuevo e20" },
    { target: "asesor-decision", label: "Asesor ejecutivo (nuevo)", group: "assistants", keywords: "asesor ejecutivo decision oferta deuda vencimiento nuevo e20" },
    { target: "debt-roadmap", label: "Plan de deuda", group: "legacy", keywords: "deuda negociar ofertas cuota refinanciacion" },
    { target: "savings-agent", label: "Objetivos y ahorro", group: "legacy", keywords: "objetivos huchas aportaciones ahorro" },
    { target: "movements", label: "Movimientos", group: "legacy", keywords: "movimientos banco categorias buscar" },
    { target: "reconciliation", label: "Conciliar", group: "legacy", keywords: "conciliacion extracto saldo diferencias" },
    { target: "data-entry", label: "Carga de datos", group: "data", keywords: "importar csv excel datos lote" },
    { target: "data-audit", label: "Datos y auditoría", group: "legacy", keywords: "calidad procedencia auditoria confianza" },
    // V2-8 relega cuatro pantallas que solo se alcanzaban desde el menú avanzado. Sin entrada en el
    // lanzador, apagar «Versiones anteriores» las dejaría sin ninguna vía: relegar no es desconectar.
    { target: "visual-detail", label: "Cuadro de mandos", group: "legacy", keywords: "cuadro mandos detalle liquidez proyectada resumen plan" },
    { target: "simulator", label: "Simulador de decisiones", group: "legacy", keywords: "simulador proyectos supuestos impacto caja" },
    { target: "savings-plan", label: "Plan ahorro", group: "legacy", keywords: "plan ahorro extras deuda viva aportaciones" },
    { target: "cashflow", label: "Flujo mensual", group: "legacy", keywords: "flujo caja anual mensual detalle operativo" },
    // V3-5 hace lo mismo con las dos heredadas de Deuda que tampoco tenían entrada propia. Ojo:
    // `#debt-control` sí se alcanza desde una tarjeta de ruta (`data-home-nav="debt-control"`) y
    // `#debt-liquidation-plan` enlaza a ella, pero ninguna de las dos vías sirve si lo que el
    // usuario recuerda es el nombre de la pantalla, que es justo para lo que existe el lanzador.
    { target: "debt-liquidation-plan", label: "Plan deuda óptimo", group: "legacy", keywords: "deuda liquidacion optimo orden amortizar plan entidades" },
    { target: "debt-control", label: "Control de deuda", group: "legacy", keywords: "control deuda estrategia reserva aplicar revision" },
    { target: "alerts-center", label: "Centro de alertas", group: "legacy", keywords: "alertas riesgo caja deuda capacidad" },
    // V1-4 relega las dos últimas heredadas de Hoy que quedaban en «Decidir». `#executive-advisor` y
    // `#virtual-advisor` no tenían entrada propia en el lanzador —solo la tenía su reemplazo, «Asesor
    // ejecutivo (nuevo)»—, así que sin esta línea el grupo apagado las habría dejado sin ninguna vía.
    { target: "executive-advisor", label: "Asesor ejecutivo", group: "legacy", keywords: "asesor ejecutivo consejos prioridades decisiones" },
    { target: "virtual-advisor", label: "Asesor virtual", group: "legacy", keywords: "asesor virtual chat preguntas ahorro" },
  ]);

  const GUIDANCE = Object.freeze({
    home: ["Para qué sirve", "Revisar primero caja, riesgos y las tres decisiones de hoy.", "Solo lectura", "Abrir Actualizar si falta un saldo o movimiento."],
    "update-hub": ["Para qué sirve", "Poner al día saldos, movimientos, reales, previsiones e importaciones.", "Puede guardar cambios", "Elige una ruta y confirma el recibo antes de continuar."],
    ajustes: ["Para qué sirve", "Fijar la reserva operativa y encontrar dónde se editan cuentas, partidas, umbrales y exportación.", "Guarda solo la reserva", "El resto de tarjetas te llevan a la pantalla donde ese dato se edita de verdad."],
    "datos-importar": ["Para qué sirve", "Importar un extracto tomando una decisión por movimiento dudoso y por posible duplicado, antes de que nada toque el plan.", "Requiere confirmación", "Nada se incorpora hasta el paso 4; se puede deshacer después desde «Carga de datos»."],
    "registrar-mes": ["Para qué sirve", "Ver qué partidas del mes siguen sin real y anotarlas una a una.", "Guarda al salir de la casilla", "Vaciar un real recupera el previsto; escribir 0 significa «ocurrió por cero»."],
    "cuadro-mandos": ["Para qué sirve", "Cambiar el previsto de una partida y ver qué le hace al plan antes de guardar.", "Requiere confirmación", "Nada se guarda hasta que pulses «Guardar cambios» en el pie de impacto."],
    "cambios-pendientes": ["Para qué sirve", "Ver el efecto conjunto de todo lo que has tocado en la sesión y revertir línea a línea.", "Requiere confirmación", "Guarda todo de una vez o descarta; cada cambio se puede revertir por separado."],
    "mapa-calor": ["Para qué sirve", "Localizar de un vistazo los meses en los que el colchón se queda corto.", "Solo lectura", "Abre el cuadro de mandos o un escenario para actuar sobre el mes que peor pinta."],
    forecast: ["Para qué sirve", "Entender la evolución futura de liquidez y gasto.", "Solo lectura", "Abre Escenarios si quieres probar un cambio sin tocar el plan."],
    "new-life-definitive": ["Para qué sirve", "Preparar una decisión de proyecto, deuda o traspaso con su impacto completo.", "Requiere confirmación", "Revisa la comparación antes de preparar cualquier cambio."],
    "new-life-simulation": ["Para qué sirve", "Comparar escenarios de coche, deuda y estabilidad sin modificar el plan.", "Solo lectura", "Guarda o vuelve a calcular el escenario que quieras estudiar."],
    "debt-roadmap": ["Para qué sirve", "Consultar las ofertas y la estrategia de deuda con datos canónicos.", "Requiere confirmación", "Compara las alternativas antes de aplicar una estrategia."],
  });

  const GUIDE_TOPICS = Object.freeze({
    "update-hub": ["Actualizar datos", "Registra un saldo, un real o una previsión según el dato disponible. Las importaciones pasan siempre por una vista previa y confirmación."],
    "data-entry": ["Importar con seguridad", "Carga CSV o Excel en la bandeja previa, revisa duplicados y diferencias, y confirma antes de que el libro cambie."],
    forecast: ["Proyectar", "La proyección es de solo lectura. Revisa fuente, fecha y confianza antes de usarla para decidir."],
    "new-life-simulation": ["Simular", "Los escenarios son una prueba aislada: compara alternativas y guarda solo lo que quieras recuperar más tarde."],
    "debt-control": ["Aplicar deuda", "Compara la estrategia, protege la reserva y confirma con motivo. La aplicación crea una revisión recuperable."],
    reconciliation: ["Recuperar y conciliar", "Compara antes de restaurar, conserva una copia descargable y elige explícitamente entre tu versión local y la nube si hay conflicto."],
  });

  function findTasks(query, normalize = (value) => String(value || "").toLowerCase()) {
    const term = normalize(query);
    return TASKS.filter((item) => !term || normalize(`${item.label} ${item.keywords}`).includes(term));
  }

  function guidanceFor(viewId, fallback) {
    return GUIDANCE[viewId] || fallback;
  }

  function guideTopicFor(viewId) {
    return GUIDE_TOPICS[viewId] || ["Guía operativa", "Esta pantalla usa solo la copia local hasta que confirmes una operación. Puedes volver atrás sin perder el estado actual."];
  }

  return { TASKS, GUIDANCE, GUIDE_TOPICS, findTasks, guidanceFor, guideTopicFor };
});
