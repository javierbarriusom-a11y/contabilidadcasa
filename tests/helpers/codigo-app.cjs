const fs = require("node:fs");
const path = require("node:path");

// XGO-01 · PR-0 (desalojo de app.js, sesión 328, 20/10/2026): el «código de la app» que leen las pruebas.
//
// Unas 220 pruebas sacan funciones y constantes por su nombre del texto de app.js (cada una con su propio
// `extractFunction`). Al desalojar app.js, una función que pasa a un script clásico cargado antes que él (mismo
// ámbito global, misma función) dejaría de encontrarse y la prueba fallaría sin que la app hubiera cambiado. Por
// eso esas pruebas leen aquí app.js junto con los scripts que reciben lo desalojado: mover una función no obliga a
// tocar ninguna prueba.
//
// Para desalojar a un fichero nuevo, añádelo a FICHEROS_APP en el mismo PR. app.js va primero: las pruebas que
// comparan posiciones (`indexOf`) dentro de app.js siguen igual. Las que tratan de app.js como fichero (su techo de
// líneas, su versión minificada) siguen leyéndolo directamente.
const raiz = path.resolve(__dirname, "..", "..");

const FICHEROS_APP = ["app.js", "registrar-ui.js", "datos-ui.js", "partidas-ui.js", "escenarios-ui.js", "importar-extracto-ui.js"];

function leer(fichero) {
  return fs.readFileSync(path.join(raiz, fichero), "utf8");
}

// `extra`: ficheros que una prueba concreta necesita además (p. ej. "views/escenarios.js"), en ese orden.
function codigoApp(...extra) {
  return [...FICHEROS_APP, ...extra].map(leer).join("\n");
}

module.exports = { codigoApp, FICHEROS_APP };
