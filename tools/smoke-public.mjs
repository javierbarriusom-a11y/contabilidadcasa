import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const types = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript" };
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const target = path.resolve(root, relative);
  if (!target.startsWith(`${root}${path.sep}`) || !fs.existsSync(target)) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.setHeader("Content-Type", types[path.extname(target)] || "application/octet-stream");
  fs.createReadStream(target).pipe(response);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  for (const resource of ["/", "/app.js", "/data.js", "/styles.css", "/version.json"]) {
    const response = await fetch(`${base}${resource}`);
    assert.equal(response.status, 200, `${resource} debe responder 200`);
    assert.ok((await response.arrayBuffer()).byteLength > 0, `${resource} no debe estar vacío`);
  }
  const html = await (await fetch(`${base}/`)).text();
  assert.match(html, /<main id="mainContent"/);
  assert.match(html, /src="data\.js\?/);

  // Comprobar cinco recursos elegidos a mano no detecta el fallo que importa: que el sitio publicado
  // cargue un script que no se copió. Aquí se pide **todo** lo que el `index.html` construido
  // referencia, con su `?v=` incluido, y se exige 200 con contenido. Es lo que habría avisado de que
  // `dist` llevaba desde E20 sin el motor de escenarios.
  const referenced = [...new Set(
    [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((url) => !/^(?:https?:|#|mailto:|data:)/.test(url)),
  )];
  assert.ok(referenced.length > 20, "el index.html publicado debería referenciar sus recursos locales");
  for (const resource of referenced) {
    const response = await fetch(`${base}/${resource}`);
    assert.equal(response.status, 200, `${resource}: el index.html lo carga pero no está en dist`);
    assert.ok((await response.arrayBuffer()).byteLength > 0, `${resource} no debe estar vacío`);
  }
} finally {
  server.close();
}
