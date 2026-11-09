// Check that every perfume photo still loads. Remote photos are linked from
// brand and fragrance sites, so they can disappear; this lists the broken ones.
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { perfumes } = JSON.parse(await readFile(path.join(root, "data/catalog.json"), "utf8"));
let bad = 0;
for (const p of perfumes) {
  if (!p.photo) { console.log(`- ${p.ref}: 沒有照片（顯示畫的瓶子）`); continue; }
  try {
    if (/^https?:/.test(p.photo)) {
      const r = await fetch(p.photo, { headers: { "user-agent": "perfume-cards-photo-check" } });
      if (!r.ok || !(r.headers.get("content-type") || "").startsWith("image/")) throw new Error(`${r.status} ${r.headers.get("content-type")}`);
    } else {
      await access(path.join(root, p.photo));
    }
    console.log(`✓ ${p.ref}`);
  } catch (e) {
    bad++;
    console.log(`✗ ${p.ref}: ${p.photo} (${e.message})`);
  }
}
console.log(bad ? `\n${bad} 張照片讀不到，請更新它們的 photo 欄位。` : "\n全部照片都讀得到。");
if (bad) process.exitCode = 1;
