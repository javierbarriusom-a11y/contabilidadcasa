// Cuánto tarda cada tramo de una prueba, para las que a veces se quedan sin tiempo en el CI y nunca en local.
// Primer caso: WP-18 («Aportado frente a valor») en Safari, en el CI de #586 (4/11/2026). «Test timeout of 60000ms
// exceeded» con la ventana de valoración YA abierta en la captura: la prueba no falló por la app, se quedó sin tiempo,
// y no hay traza (el CI solo la guarda si el paso falla del todo, y con el reintento de Safari pasó). Sin saber qué
// tramo se comió el tiempo, cualquier arreglo sería a ciegas (mismo criterio que pulsar-o-explicar.cjs).
//
// Uso: `const reloj = cronometro();` al empezar, `reloj.marca("nombre")` tras cada tramo y, en un `afterEach`,
// `informarSiFalla(reloj, testInfo)`: si la prueba no acaba como se esperaba (también por tiempo), escribe en el
// registro cada tramo con sus segundos y el que estaba en marcha. No espera, no reintenta y no cambia ningún tiempo.
function cronometro(ahora = () => Date.now()) {
  const inicio = ahora();
  let ultimo = inicio;
  const marcas = [];
  return {
    marca(nombre) {
      const t = ahora();
      marcas.push({ nombre, ms: t - ultimo, total: t - inicio });
      ultimo = t;
    },
    informe() {
      const s = (ms) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
      const lineas = marcas.map((m) => `  ${m.nombre}: ${s(m.ms)} (llevaba ${s(m.total)})`);
      const t = ahora();
      lineas.push(`  en marcha tras «${marcas.at(-1)?.nombre || "el inicio"}»: ${s(t - ultimo)} (total ${s(t - inicio)})`);
      return `Tramos de la prueba:\n${lineas.join("\n")}`;
    },
  };
}

async function informarSiFalla(reloj, testInfo) {
  if (!reloj || testInfo.status === testInfo.expectedStatus) return;
  const texto = reloj.informe();
  console.log(`[cronometro] ${testInfo.title}\n${texto}`);
  await testInfo.attach("tramos", { body: texto, contentType: "text/plain" });
}

module.exports = { cronometro, informarSiFalla };
