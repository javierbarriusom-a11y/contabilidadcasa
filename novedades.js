// WP-01 (NXP-02, BACKLOG_DEFINITIVO.md §5.1): «Novedades» — una línea por cada cambio visible
// desplegado, la más reciente arriba. Sin límite de entregas visibles (decisión del hogar del
// 3/10/2026), es la forma de que el único usuario sepa qué ha cambiado sin leer el repositorio.
//
// Regla para cada paquete visible: añade aquí su línea en el mismo PR que lo construye.
// - `id`: único y estable (fecha + paquete); marca hasta dónde se ha leído en este dispositivo.
// - `fecha`: AAAA-MM-DD del despliegue.
// - `texto`: una frase de ≤ 140 caracteres, en lenguaje del hogar, sin cifras reales.
// - `href` (opcional): la pantalla donde se ve el cambio (`#vista`).
// tests/nxp2-sello-version.test.cjs comprueba el formato y el orden.
(function exposeFinanceNovedades(root) {
  const NOVEDADES = [
    {
      id: "2026-10-04-wp24",
      fecha: "2026-10-04",
      texto: "Plan › Partidas: asignación personal para cada uno, sin detalle. Sale del gasto variable, así que el gasto total previsto no cambia.",
      href: "#planificacion-partidas",
    },
    {
      id: "2026-10-04-wp25",
      fecha: "2026-10-04",
      texto: "Enlaces de registro: un Atajo del iPhone abre «Registrar gasto» ya relleno (importe, concepto, fecha). Nada se guarda sin tu toque.",
      href: "#registrar",
    },
    {
      id: "2026-10-04-wp11",
      fecha: "2026-10-04",
      texto: "Registrar: los importes se escriben y pegan como en España (1.234,56 €), con botón ± para el signo y saldos legibles en el móvil.",
      href: "#registrar",
    },
    {
      id: "2026-10-04-wp08",
      fecha: "2026-10-04",
      texto: "Plan › Partidas: indica qué día se cobra cada gasto y la previsión día a día lo pone ahí. Te propone el que ve en tus extractos.",
      href: "#planificacion-partidas",
    },
    {
      id: "2026-10-04-wp10",
      fecha: "2026-10-04",
      texto: "Previsión dice qué parte de los gastos tiene día conocido y cuánto del mes ya es real, con qué hacer para mejorarlo.",
      href: "#prevision",
    },
    {
      id: "2026-10-04-wp09",
      fecha: "2026-10-04",
      texto: "Cierre de mes: guarda el saldo de cada cuenta con su fecha y, del día 1 al 3, propone cerrar el mes que acaba.",
      href: "#cierre",
    },
    {
      id: "2026-10-03-wp04",
      fecha: "2026-10-03",
      texto: "Ajustes dice si el día de cobro de cada gasto se puede aprender de tus extractos o tendrás que indicarlo tú.",
      href: "#ajustes",
    },
    {
      id: "2026-10-03-wp03",
      fecha: "2026-10-03",
      texto: "Panel de uso: días de uso, saldos frescos y minutos por semana, frente a sus objetivos. En Ajustes › Uso de la app.",
      href: "#ajustes",
    },
    {
      id: "2026-10-03-wp02",
      fecha: "2026-10-03",
      texto: "Prueba de 30 segundos: mide cuánto tardas en tener la cifra de Hoy al abrir la app. En Ajustes › Uso de la app.",
      href: "#ajustes",
    },
    {
      id: "2026-10-03-wp01",
      fecha: "2026-10-03",
      texto: "Sello de versión y «Novedades» en el menú: ves qué versión usas, qué ha cambiado y un aviso cuando hay una nueva.",
    },
    {
      id: "2026-10-02-p9",
      fecha: "2026-10-02",
      texto: "Hoy dice la edad de tus saldos junto a la cifra, y un saldo antiguo baja la confianza de la liquidez a «media».",
      href: "#home",
    },
    {
      id: "2026-10-02-s5",
      fecha: "2026-10-02",
      texto: "Hoy tiene un único titular: «Disponible para gastar».",
      href: "#home",
    },
  ];
  if (typeof module === "object" && module.exports) module.exports = NOVEDADES;
  if (root) root.FinanceNovedades = NOVEDADES;
})(typeof globalThis !== "undefined" ? globalThis : this);
