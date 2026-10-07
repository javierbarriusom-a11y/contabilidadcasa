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
      id: "2026-10-07-wp14b",
      fecha: "2026-10-07",
      texto: "«Aún no» y «Llegará tarde» ya cuentan en la previsión diaria. Los días de cargo que indicas también la actualizan.",
      href: "#home",
    },
    {
      id: "2026-10-07-wp14",
      fecha: "2026-10-07",
      texto: "Hoy › Bandeja: «¿Ha llegado la nómina?» y «este recibo no ha llegado», con respuesta en un toque y deshacer.",
      href: "#home",
    },
    {
      id: "2026-10-07-wp32",
      fecha: "2026-10-07",
      texto: "Ajustes › Recordatorios: un fichero .ics para el calendario del móvil con avisos antes de cobrar, tras un cargo grande y al cerrar el mes.",
      href: "#ajustes",
    },
    {
      id: "2026-10-07-audit",
      fecha: "2026-10-07",
      texto: "Arreglos: «Valor por posición» (Inversión) ya no solapa sus barras y las tablas se leen bien en modo oscuro.",
      href: "#inversion-cartera",
    },
    {
      id: "2026-10-07-wp16",
      fecha: "2026-10-07",
      texto: "Plan › Previsión: «Banda de caja a 30 días», con la probabilidad de bajar del suelo en vez de una línea que finge saber el día.",
      href: "#prevision",
    },
    {
      id: "2026-10-06-wp28",
      fecha: "2026-10-06",
      texto: "Escenarios › Bandas de confianza: el cono se lee con el dedo, el ratón o las flechas, con la lectura fija y «Ver como tabla».",
      href: "#new-life-simulation",
    },
    {
      id: "2026-10-06-wp23",
      fecha: "2026-10-06",
      texto: "Herramientas › Fiscal: campaña fiscal de fin de año, con cifras de ejemplo marcadas hasta que haya datos tuyos.",
      href: "#herramientas-fiscal",
    },
    {
      id: "2026-10-06-wp15",
      fecha: "2026-10-06",
      texto: "Inversión › Cartera: «Actualizar valoración». Pon al día el valor de cada posición, con la fecha, y deshaz en 8 s. El cierre avisa si falta.",
      href: "#inversion-cartera",
    },
    {
      id: "2026-10-05-wp30-hoja",
      fecha: "2026-10-05",
      texto: "Hoy › «+ Registrar gasto»: con tarjetas dadas de alta, una hoja para anotar cada compra con su concepto y deshacer en 8 s.",
      href: "#home",
    },
    {
      id: "2026-10-05-real-parcial",
      fecha: "2026-10-05",
      texto: "El gasto variable del mes en curso ya no baja a lo gastado hasta ahora: vale lo mayor entre previsto y real. Registrar lo marca «en curso».",
      href: "#registrar",
    },
    {
      id: "2026-10-05-wp30-tarjetas",
      fecha: "2026-10-05",
      texto: "Plan › Partidas: «Tarjetas de crédito». Indica el corte y el cargo de cada tarjeta; la hoja para anotar compras llega después.",
      href: "#planificacion-partidas",
    },
    {
      id: "2026-10-05-wp12",
      fecha: "2026-10-05",
      texto: "Plan › Previsión: «Acierto de la caja a fin de mes». Los días 1 y 15 congela lo que espera tener y lo compara al cerrar el mes.",
      href: "#prevision",
    },
    {
      id: "2026-10-04-wp26-extracto",
      fecha: "2026-10-04",
      texto: "Importar extracto: su saldo final puede pasar a ser el de la cuenta, y te avisa si al fichero le faltan movimientos.",
      href: "#registrar",
    },
    {
      id: "2026-10-04-wp26-pulso",
      fecha: "2026-10-04",
      texto: "Registrar › Saldos: «Pulso de saldos». Ves lo último que se sabe de cada cuenta y basta con «Coincide» o «Corregir».",
      href: "#registrar",
    },
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
