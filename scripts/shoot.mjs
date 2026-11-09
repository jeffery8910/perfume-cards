// Export every card of every collection as a 1080×1350 PNG.
// Usage: npm run shots            (all collections)
//        npm run shots -- tea-juniper
// Output: shots/<collection>/01.png …
import { chromium } from "playwright";
import http from "node:http";
import { readFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };

const server = http.createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.join(root, p === "/" ? "index.html" : p);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[path.extname(file).toLowerCase()] || "application/octet-stream" }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const index = JSON.parse(await readFile(path.join(root, "data/index.json"), "utf8"));
const wanted = process.argv.slice(2);
const ids = (index.collections || []).map((c) => c.id).filter((id) => !wanted.length || wanted.includes(id));

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
let failed = false;
for (const id of ids) {
  await page.goto(`${base}/deck.html?c=${encodeURIComponent(id)}&shot=1`);
  await page.waitForSelector("body[data-ready='1']", { timeout: 30000 });
  await page.waitForTimeout(300);
  const out = path.join(root, "shots", id);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const cards = await page.$$(".card");
  for (let i = 0; i < cards.length; i++) {
    const overflow = await cards[i].evaluate((el) => el.querySelector(".in").scrollHeight - el.clientHeight);
    if (overflow > 2) { console.warn(`! ${id} card ${i + 1} overflows by ${overflow}px — shorten its text`); failed = true; }
    await cards[i].screenshot({ path: path.join(out, String(i + 1).padStart(2, "0") + ".png") });
  }
  console.log(`${id}: ${cards.length} cards → shots/${id}/`);
}
await browser.close();
server.close();
if (failed && process.env.STRICT) process.exit(1);
