// Rediseño · fase A (docs/rediseno/HANDOFF.md): guarda la bandera del tema visual v2.
//
// El script en línea de <head> (index.html) solo lee la preferencia y la URL para pintar ya con el
// tema correcto (mismo criterio que T7). Este, diferido, es el único que escribe:
//   ?tema=v2       → recuerda el tema v2 en este navegador
//   ?tema=clasico  → lo olvida y vuelve al de siempre
(function () {
  try {
    var pedido = new URLSearchParams(window.location.search).get("tema");
    if (pedido === "v2") window.localStorage.setItem("tema-preferencia", "v2");
    if (pedido === "clasico") {
      window.localStorage.removeItem("tema-preferencia");
      delete document.documentElement.dataset.tema;
    }
  } catch {
    // Sin almacenamiento (navegación privada, bloqueos): la bandera dura solo esta visita.
  }
})();
