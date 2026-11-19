// Privacidad, fase 5 (docs/PRIVACIDAD_NOMBRES.md): el candado. Ningún fichero del repositorio (código, pruebas, documentación,
// maquetas, configuración) escribe los nombres de pila de las dos personas del hogar, en ninguna de sus formas (corta y larga),
// con o sin mayúscula ni acento. Palabra a palabra: el usuario de GitHub del dueño del repositorio es otra palabra y no cuenta.
// La prueba no escribe los nombres: los reconstruye de base64. Lo que sigue en el historial de git no lo arregla ningún cambio:
// por eso la decisión D-N24 (poner el repositorio en privado), que hace el hogar.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const [N1, N2] = ["SmF2aQ==", "VGVyZQ=="].map((b) => Buffer.from(b, "base64").toString("utf8").toLowerCase());
const PROHIBIDAS = new Set([N1, `${N1}er`, N2, `${N2}sa`]);
const BINARIOS = /\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|otf|zip|gz|xlsx?|docx?|pptx?)$/i;

const normal = (texto) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

test("privacidad, fase 5 · ningún fichero del repositorio escribe los nombres de pila del hogar", () => {
  const ficheros = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter((f) => f && !BINARIOS.test(f) && !f.startsWith("vendor/"));
  assert.ok(ficheros.length > 500, "recorre el repositorio entero");
  const restos = [];
  ficheros.forEach((fichero) => {
    let texto;
    try {
      texto = fs.readFileSync(path.join(root, fichero), "utf8");
    } catch {
      return; // borrado en el árbol de trabajo
    }
    texto.split("\n").forEach((linea, i) => {
      if (normal(linea).split(/[^a-z0-9]+/).some((palabra) => PROHIBIDAS.has(palabra))) restos.push(`${fichero}:${i + 1}`);
    });
  });
  // Solo las posiciones: el mensaje del fallo (que se ve en el CI, público) no repite el nombre.
  assert.deepEqual(restos, []);
});
