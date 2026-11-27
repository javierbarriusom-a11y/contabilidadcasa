// CAT-17 (decimocuarta auditoría): la versión de app.js en index.html se comprueba por su FORMATO, no por un valor fijo.
// Antes, ~30 pruebas exigían «20261125dn40»: cambiar app.js obligaba a tocarlas todas, así que nadie subía la versión y app.js
// cambió en cinco PR seguidos con el mismo ?v= (caché HTTP vieja junto a módulos nuevos). Que la versión CAMBIE cuando cambia el
// fichero lo comprueba tests/cat17-version-app.test.cjs con la huella de docs/gobierno/huella-app.json.
const VERSION_APP_RE = /<script defer src="app\.js\?v=(\d{8}[a-z0-9]+)"><\/script>/;

function versionApp(html) {
  const m = String(html).match(VERSION_APP_RE);
  if (!m) throw new Error("index.html no carga app.js con una versión AAAAMMDD + sufijo (p. ej. app.js?v=20261127cat17).");
  return m[1];
}

module.exports = { VERSION_APP_RE, versionApp };
