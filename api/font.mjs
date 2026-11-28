const FONT_FILES = Object.freeze({
  "400": "https://raw.githubusercontent.com/google/fonts/main/ofl/lateef/Lateef-Regular.ttf",
  "700": "https://raw.githubusercontent.com/google/fonts/main/ofl/lateef/Lateef-Bold.ttf"
});
const cache = new Map();

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  const weight = String(req.query?.weight || "400");
  const url = FONT_FILES[weight];
  if (!url) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Unsupported font weight. Use 400 or 700.");
    return;
  }

  try {
    let pending = cache.get(weight);
    if (!pending) {
      pending = fetch(url, { headers: { "User-Agent": "BookFlow-Studio/1.0" } })
        .then(async response => {
          if (!response.ok) throw new Error("Font source returned HTTP " + response.status);
          const bytes = Buffer.from(await response.arrayBuffer());
          if (bytes.length < 10000) throw new Error("Font file was unexpectedly small.");
          return bytes;
        });
      cache.set(weight, pending);
    }

    const bytes = await pending;
    res.setHeader("Content-Type", "font/ttf");
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader("Content-Disposition", "inline; filename=\"Lateef-" + weight + ".ttf\"");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.method === "HEAD") {
      res.statusCode = 200;
      res.end();
      return;
    }
    res.statusCode = 200;
    res.end(bytes);
  } catch (error) {
    cache.delete(weight);
    res.statusCode = 502;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end("Urdu font could not be retrieved. " + (error?.message || "Upstream error"));
  }
}
