// Local test server: serves public/ and runs netlify/functions/* against a
// throwaway local Netlify Blobs store. Never touches live data.
//   node tests/dev-server.mjs [port]
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startBlobsEmulator } from "./blobs-emulator.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2] || process.env.PORT || 8888);
const blobPort = port + 1;
const token = "local-test-token";
await startBlobsEmulator(blobPort, token);
process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({
  siteID: "local-site", token, edgeURL: `http://localhost:${blobPort}`, uncachedEdgeURL: `http://localhost:${blobPort}`
})).toString("base64");
process.env.ADMIN_PASSWORD ||= "local-admin-password";
process.env.SESSION_SECRET ||= "local-session-secret-that-is-at-least-32-chars";

const types = { ".html":"text/html; charset=utf-8", ".css":"text/css", ".js":"text/javascript", ".png":"image/png", ".pdf":"application/pdf", ".svg":"image/svg+xml", ".json":"application/json" };
const redirects = { "/admin":"/admin/", "/eduhub":"/eduhub/", "/ticket":"/ticket/", "/eduhub-preview.html":"/eduhub/?preview=1" };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (redirects[url.pathname]) { res.writeHead(301, { location: redirects[url.pathname] }); return res.end(); }
    if (url.pathname.startsWith("/api/")) {
      const name = url.pathname.slice(5).replace(/[^a-z-]/g, "");
      const mod = await import(pathToFileURL(path.join(root, "netlify/functions", name + ".mjs")).href);
      const chunks = []; for await (const c of req) chunks.push(c);
      const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
      headers.set("x-nf-client-connection-ip", req.socket.remoteAddress || "127.0.0.1");
      const request = new Request(url, { method: req.method, headers, body: ["GET","HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
      const response = await mod.default(request);
      // Local server is http, so drop "Secure" from cookies to let the browser keep them.
      const out = {}; response.headers.forEach((v, k) => out[k] = k === "set-cookie" ? v.replace("; Secure", "") : v);
      res.writeHead(response.status, out); return res.end(Buffer.from(await response.arrayBuffer()));
    }
    let file = path.join(root, "public", decodeURIComponent(url.pathname));
    if (!file.startsWith(path.join(root, "public"))) throw new Error("bad path");
    if ((await fs.stat(file).catch(() => null))?.isDirectory()) file = path.join(file, "index.html");
    const body = await fs.readFile(file).catch(() => null);
    if (!body) { res.writeHead(404, { "content-type": types[".html"] }); return res.end(await fs.readFile(path.join(root, "public/404.html"))); }
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" }); res.end(body);
  } catch (err) { console.error(err); res.writeHead(500); res.end(String(err)); }
}).listen(port, () => console.log(`Learning Hub test server on http://localhost:${port} (test data is held in memory and discarded on exit)`));
