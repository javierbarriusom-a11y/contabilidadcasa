// Rediseño (docs/rediseno/ESTADO.md): guarda la elección de tema. Desde el 19/10/2026 el v2 es el de por
// defecto; el clásico sigue disponible mientras la v2 no se gradúe del todo.
//
// El script en línea de <head> (index.html) solo lee la preferencia y la URL para pintar ya con el
// tema correcto (mismo criterio que T7). Este, diferido, es el único que escribe:
//   ?tema=clasico  → recuerda el clásico en este navegador
//   ?tema=v2       → olvida esa elección y vuelve al de por defecto (v2)
(function () {
  try {
    var pedido = new URLSearchParams(window.location.search).get("tema");
    if (pedido === "clasico") window.localStorage.setItem("tema-preferencia", "clasico");
    if (pedido === "v2") {
      window.localStorage.removeItem("tema-preferencia");
      document.documentElement.dataset.tema = "v2";
    }
  } catch {
    // Sin almacenamiento (navegación privada, bloqueos): la elección dura solo esta visita.
  }
})();
