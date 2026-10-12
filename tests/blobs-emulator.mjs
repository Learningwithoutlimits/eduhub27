// In-memory stand-in for the Netlify Blobs edge service, used only by the
// local test server. Like the live service, each read returns an ETag and a
// write sent with If-Match or If-None-Match is refused (412) if the entry has
// changed. Writes are atomic, so the double-booking protection can be tested.
import http from "node:http";
import crypto from "node:crypto";

export function startBlobsEmulator(port, token) {
  const entries = new Map();
  const server = http.createServer(async (req, res) => {
    if (req.headers.authorization !== `Bearer ${token}`) { res.writeHead(403); return res.end(); }
    const key = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const chunks = []; for await (const c of req) chunks.push(c);
    const current = entries.get(key);
    if (req.method === "GET" || req.method === "HEAD") {
      if (!current) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { etag: current.etag, ...(current.meta ? { "x-amz-meta-user": current.meta } : {}) });
      return res.end(req.method === "GET" ? current.body : undefined);
    }
    if (req.method === "PUT") {
      const ifMatch = req.headers["if-match"], ifNone = req.headers["if-none-match"];
      if (ifNone === "*" && current) { res.writeHead(412); return res.end(); }
      if (ifMatch && (!current || current.etag !== ifMatch)) { res.writeHead(412); return res.end(); }
      const etag = `"${crypto.randomUUID()}"`;
      entries.set(key, { body: Buffer.concat(chunks), etag, meta: req.headers["x-amz-meta-user"] });
      res.writeHead(200, { etag }); return res.end();
    }
    if (req.method === "DELETE") { entries.delete(key); res.writeHead(204); return res.end(); }
    res.writeHead(405); res.end();
  });
  return new Promise(resolve => server.listen(port, () => resolve(server)));
}
