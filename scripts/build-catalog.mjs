// Collect every data/perfumes/<brand>/<id>.json into data/catalog.json,
// which the "自己疊疊看" page reads. The GitHub workflow runs this on every push.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "data/perfumes");
const perfumes = [];
for (const brand of (await readdir(dir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
  for (const f of (await readdir(path.join(dir, brand))).filter((f) => f.endsWith(".json")).sort()) {
    try {
      const p = JSON.parse(await readFile(path.join(dir, brand, f), "utf8"));
      perfumes.push({ ref: `${brand}/${f.replace(/\.json$/, "")}`, ...p });
    } catch (e) {
      console.error(`! ${brand}/${f} is not valid JSON: ${e.message}`);
      process.exitCode = 1;
    }
  }
}
await writeFile(path.join(root, "data/catalog.json"), JSON.stringify({ perfumes }, null, 2) + "\n");
console.log(`data/catalog.json: ${perfumes.length} perfumes`);
