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
      id: "2026-10-16-wp23b",
      fecha: "2026-10-16",
      texto: "Campaña fiscal: ya puedes teclear tus datos fiscales y la lista deja de ser un ejemplo. Lo que no sepas, déjalo vacío.",
      href: "#herramientas-fiscal",
    },
    {
      id: "2026-10-15-venta-sin-importe",
      fecha: "2026-10-15",
      texto: "Una venta sin importe cobrado ya no cuenta como pérdida: su plusvalía sale «no calculable» hasta que lo anotes.",
      href: "#inversion-cartera",
    },
    {
      id: "2026-10-14-wp47b",
      fecha: "2026-10-14",
      texto: "Repartir la nómina: avisa si lo que repartes choca con tu política firmada o si el plan B está activo.",
      href: "#deuda-comparar",
    },
    {
      id: "2026-10-14-wp46b",
      fecha: "2026-10-14",
      texto: "Patrimonio neto: avisa si algún dato (cartera, activos, saldos) es viejo o no tiene fecha, también en cada cierre.",
      href: "#inversion-cartera",
    },
    {
      id: "2026-10-14-wp44b",
      fecha: "2026-10-14",
      texto: "Cierre: si la cartera cae un 20 % o más desde su máximo, lo avisa con calma y recuerda lo que acordasteis.",
      href: "#cierre",
    },
    {
      id: "2026-10-13-wp43b",
      fecha: "2026-10-13",
      texto: "Cierre: si la previsión de fin de año cambia mucho desde el cierre anterior, ahora lo avisa y lleva al puente.",
      href: "#cierre",
    },
    {
      id: "2026-10-13-wp42b",
      fecha: "2026-10-13",
      texto: "Deuda › Comparar: el reparto del próximo euro avisa si choca con vuestra política firmada o si el plan B está activo.",
      href: "#deuda-comparar",
    },
    {
      id: "2026-10-13-wp41b",
      fecha: "2026-10-13",
      texto: "Cierre: si el extracto muestra compras o móviles financiados que no están en Contratos, ahora os lo cuenta cada mes.",
      href: "#cierre",
    },
    {
      id: "2026-10-13-wp40b",
      fecha: "2026-10-13",
      texto: "Recordatorios: si tecleaste un informe de la CIRBE, el calendario avisa a los 11 meses de que toca pedir otro.",
      href: "#ajustes",
    },
    {
      id: "2026-10-13-wp39b",
      fecha: "2026-10-13",
      texto: "Cartera: al añadir una compra o venta, se compara con vuestra política y, si la contradice, pide el motivo (sin bloquear).",
      href: "#inversion-cartera",
    },
    {
      id: "2026-10-13-wp38b",
      fecha: "2026-10-13",
      texto: "Cierre: si ya acordasteis un plan B, ahora lo vigila y os dice si salta, está en vigilancia o no se puede vigilar.",
      href: "#cierre",
    },
    {
      id: "2026-10-13-wp37b",
      fecha: "2026-10-13",
      texto: "Ajustes: quitar una cuenta remunerada, póliza, tabla fiscal o escala de IRPF ya se puede deshacer 10 segundos.",
      href: "#ajustes",
    },
    {
      id: "2026-10-12-wp36b",
      fecha: "2026-10-12",
      texto: "Cosas raras: ahora puedes ver lo que silenciaste y volver a vigilarlo, y dos comercios con el mismo prefijo del banco ya no se confunden.",
      href: "#movements",
    },
    {
      id: "2026-10-12-wp35",
      fecha: "2026-10-12",
      texto: "Plan › Previsión: el mes en tres capas (comprometido, probable, discrecional) y los ingresos con su certeza; solo lee.",
      href: "#prevision",
    },
    {
      id: "2026-10-12-wp34",
      fecha: "2026-10-12",
      texto: "Plan › Partidas: revisión base cero, una partida por pantalla con sus reales: mantener, ajustar a lo real o quitar.",
      href: "#planificacion-partidas",
    },
    {
      id: "2026-10-12-wp29",
      fecha: "2026-10-12",
      texto: "Cierre escribe la carta del mes: resultado frente a lo previsto, la mayor desviación, un hito, una acción y cuánto es real.",
      href: "#cierre",
    },
    {
      id: "2026-10-11-wp53",
      fecha: "2026-10-11",
      texto: "Importar extracto empareja lo anotado a mano con su fila del banco (importe, ±2 días, comercio) y deja la del banco.",
      href: "#registrar",
    },
    {
      id: "2026-10-11-wp51",
      fecha: "2026-10-11",
      texto: "Registrar › Importar extracto: lee CSV de otros formatos, avisa de lo dudoso, lista las filas ilegibles y guarda perfiles.",
      href: "#registrar",
    },
    {
      id: "2026-10-11-wp50",
      fecha: "2026-10-11",
      texto: "Inversión › Cartera › Vivienda y local por índice: revaloriza lo declarado con un índice que tecleáis y enseña el LTV.",
      href: "#inversion-cartera",
    },
    {
      id: "2026-10-11-wp49",
      fecha: "2026-10-11",
      texto: "Plan › Previsión › Mapa anual de pagos grandes: lo que cae de golpe en los próximos 12 meses y cuánto hay reservado.",
      href: "#plan",
    },
    {
      id: "2026-10-10-wp48",
      fecha: "2026-10-10",
      texto: "Inversión › Cartera › Libro de operaciones: corrige compras y ventas viendo antes qué cambia en las plusvalías.",
      href: "#inversion-cartera",
    },
    {
      id: "2026-10-10-wp47",
      fecha: "2026-10-10",
      texto: "Deuda › Comparar › Repartir la nómina: lo que cabe sobre el suelo, con botones para ajustarlo y una lista de transferencias.",
      href: "#deuda-comparar",
    },
    {
      id: "2026-10-10-wp46",
      fecha: "2026-10-10",
      texto: "Inversión › Cartera › Patrimonio neto: la serie por cierres y la proyección a 10 años en tres escenarios, con vuestros supuestos.",
      href: "#inversion-cartera",
    },
    {
      id: "2026-10-10-wp45",
      fecha: "2026-10-10",
      texto: "Registrar › Saldos › Frescura de tus datos: la edad de cada fuente y qué tarea quita más incertidumbre por minuto.",
      href: "#registrar",
    },
    {
      id: "2026-10-10-wp44",
      fecha: "2026-10-10",
      texto: "Inversión › Cartera › Calma, cobertura y exposición: la caída desde el máximo, qué parte del gasto pagan los activos y depósitos.",
      href: "#inversion-cartera",
    },
    {
      id: "2026-10-10-wp43",
      fecha: "2026-10-10",
      texto: "Plan › Previsión › Puente de previsión: cada cierre congela el fin de año y el siguiente explica por qué cambió.",
      href: "#plan",
    },
    {
      id: "2026-10-10-wp42",
      fecha: "2026-10-10",
      texto: "Deuda › Comparar › ¿Dónde va el próximo euro?: colchón, deuda cara, pensión e inversión, en orden y con su porqué.",
      href: "#deuda-comparar",
    },
    {
      id: "2026-10-10-wp41",
      fecha: "2026-10-10",
      texto: "Deuda › Contratos › Deuda en la sombra: financiaciones en la factura y la TAE real de una oferta «sin intereses».",
      href: "#deuda-contratos",
    },
    {
      id: "2026-10-09-wp40",
      fecha: "2026-10-09",
      texto: "Deuda › Contratos › Conciliación con la CIRBE: compara el informe del Banco de España con vuestros contratos.",
      href: "#deuda-contratos",
    },
    {
      id: "2026-10-09-wp39",
      fecha: "2026-10-09",
      texto: "Inversión › Rebalanceo › Política de inversión: seis preguntas firmadas y la cartera comparada con ellas.",
      href: "#inversion-rebalanceo",
    },
    {
      id: "2026-10-09-wp38",
      fecha: "2026-10-09",
      texto: "Plan › Previsión › Plan B del hogar: acordad en calma cuándo salta y qué hacer, y firmadlo las dos personas.",
      href: "#plan",
    },
    {
      id: "2026-10-09-wp37",
      fecha: "2026-10-09",
      texto: "Quitar un contrato, una hucha, una nómina o un dato de índice ya no pregunta: lo hace y deja «Deshacer» 10 segundos.",
      href: "#deuda-contratos",
    },
    {
      id: "2026-10-09-wp36",
      fecha: "2026-10-09",
      texto: "Movimientos › Cosas raras: señala duplicados, recibos devueltos, comisiones nuevas e importes altos, con su evidencia.",
      href: "#movements",
    },
    {
      id: "2026-10-08-wp31",
      fecha: "2026-10-08",
      texto: "Herramientas › Fiscal › Nóminas y retenciones: apunta cada nómina y suma lo retenido en el año; avisa si cambia el %.",
      href: "#herramientas-fiscal",
    },
    {
      id: "2026-10-08-wp19",
      fecha: "2026-10-08",
      texto: "Deuda › Ruta › Camino a deuda cero: pon un extra al mes y mira cuándo acabáis y cuántos intereses os ahorráis.",
      href: "#deuda-ruta",
    },
    {
      id: "2026-10-07-wp20b",
      fecha: "2026-10-07",
      texto: "Ajustes › Recordatorios: avisos en el calendario del móvil 60 y 30 días antes de revisar el tipo de la hipoteca.",
      href: "#ajustes",
    },
    {
      id: "2026-10-07-wp20",
      fecha: "2026-10-07",
      texto: "Deuda › Contratos › Revisión del tipo variable: cuándo se revisa y entre qué cuotas caerá la nueva, con avisos a 60 y 30 días.",
      href: "#deuda-contratos",
    },
    {
      id: "2026-10-07-wp13",
      fecha: "2026-10-07",
      texto: "Deuda › Contratos › Índices de referencia: Euribor, €STR e IPC con la fecha del dato y su caducidad.",
      href: "#deuda-contratos",
    },
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
