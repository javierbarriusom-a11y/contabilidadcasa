import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2] || 4191);
let online = true;
let received = [];

const files = new Map([
  ["/", ["tests/fixtures/e1-continuity.html", "text/html; charset=utf-8"]],
  ["/tests/fixtures/e1-continuity.html", ["tests/fixtures/e1-continuity.html", "text/html; charset=utf-8"]],
  ["/durable-outbox.js", ["durable-outbox.js", "text/javascript; charset=utf-8"]],
  ["/remote-save-queue.js", ["remote-save-queue.js", "text/javascript; charset=utf-8"]],
]);

function json(response, status, value) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(value));
}

const server = http.createServer((request, response) => {
  if (request.url === "/api/state" && request.method === "GET") return json(response, 200, { online, received });
  if (request.url === "/api/offline" && request.method === "POST") {
    online = false;
    return json(response, 200, { online });
  }
  if (request.url === "/api/online" && request.method === "POST") {
    online = true;
    return json(response, 200, { online });
  }
  if (request.url === "/api/reset" && request.method === "POST") {
    online = true;
    received = [];
    return json(response, 200, { online, received });
  }
  if (request.url === "/api/sync" && request.method === "POST") {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      if (!online) return json(response, 503, { error: "offline" });
      const parsed = JSON.parse(body || "{}");
      if (!received.some((item) => item.payload?.changeId === parsed.payload?.changeId)) received.push(parsed);
      return json(response, 200, { stored: true, count: received.length });
    });
    return;
  }
  const target = files.get(request.url);
  if (!target) return json(response, 404, { error: "not-found" });
  response.writeHead(200, { "content-type": target[1], "cache-control": "no-store" });
  fs.createReadStream(path.join(root, target[0])).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`E1 E2E server listening on http://127.0.0.1:${port}`);
});
