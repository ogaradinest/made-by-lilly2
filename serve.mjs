// Local preview server: `node serve.mjs` then open http://localhost:4173/made-by-lilly2/
// Serves _site/ under the same sub-path GitHub Pages uses, so links behave identically.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "_site");
const BASE = JSON.parse(fs.readFileSync(new URL("./content/site.json", import.meta.url), "utf8")).basePath;
const PORT = Number(process.env.PORT) || 4173;
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".xml": "application/xml", ".txt": "text/plain" };

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/") { res.writeHead(302, { Location: BASE + "/" }); return res.end(); }
  if (!p.startsWith(BASE)) return notFound(res);
  p = p.slice(BASE.length) || "/";
  let file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) return notFound(res);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!p.endsWith("/")) { res.writeHead(301, { Location: BASE + p + "/" }); return res.end(); }
    file = path.join(file, "index.html");
  }
  if (!fs.existsSync(file)) return notFound(res);
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Preview: http://localhost:${PORT}${BASE}/`));

function notFound(res) {
  res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
  fs.createReadStream(path.join(ROOT, "404.html")).pipe(res);
}
