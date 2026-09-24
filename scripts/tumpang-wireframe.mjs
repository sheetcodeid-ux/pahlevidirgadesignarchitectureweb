/* Tumpuk kotak wireframe DI ATAS gambar framenya sendiri.
 *
 *     node scripts/tumpang-wireframe.mjs [keluar/]
 *
 * Kenapa ini ada di samping periksa-wireframe.py, bukan menggantikannya:
 * keduanya menangkap kelas kesalahan yang berbeda. Yang itu membuktikan
 * ANGKANYA sama dengan framenya. Yang ini membuktikan kotaknya jatuh di
 * tempat yang benar DAN menunjukkan apa isi panel itu sebenarnya — dan
 * yang kedua itulah yang menangkap lima salah tebak isi yang angkanya tidak
 * bisa tangkap sama sekali: kartu statistik yang ternyata empat bukan dua,
 * grafik yang ternyata area bukan batang, dan seterusnya.
 *
 * Butuh Chromium yang sudah ada di mesin (PLAYWRIGHT_BROWSERS_PATH).
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INTERFACE = path.join(AKAR, "apps/web/src/assets/figma/interface");
const KELUAR = process.argv[2] || path.join(AKAR, "docs/wireframe/tumpang");

/* Spek wireframe-nya SATU, dan ia hidup di buat-wireframe.py. Dibaca lewat
   Python supaya tidak ada salinan kedua yang menyimpang. */
const spek = JSON.parse(execSync(
  `cd ${JSON.stringify(AKAR)} && python3 -c "import sys,json;sys.path.insert(0,'scripts');` +
  `from importlib import import_module;w=import_module('buat-wireframe');` +
  `print(json.dumps(w.HALAMAN))"`, { shell: "/bin/bash" }).toString());

const BERKAS = {
  "04": "04. Dashboard (v2) - Desktop", "07": "07. Transfer - Desktop",
  "10": "10. Payment - Desktop", "13": "13. Transactions - Desktop",
  "16": "16. Invoices - Desktop", "19": "19. Cards - Desktop",
  "22": "22. Saving Plans - Desktop", "25": "25. Investments - Desktop",
  "28": "28. Inbox - Desktop", "31": "31. Promos - Desktop",
  "34": "34. Promo Details - Desktop", "37": "37. Insights - Desktop",
  "40": "40. Insight Details - Desktop",
};

mkdirSync(KELUAR, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1480, height: 1200 } });
const sementara = path.join(KELUAR, "_tumpang.html");
for (const [kunci, berkas] of Object.entries(BERKAS)) {
  const h = spek.find((x) => x.kunci === kunci);
  if (!h) continue;
  const svg = readFileSync(path.join(INTERFACE, berkas + ".svg"), "utf8");
  const kotak = h.wilayah.map(([n, x, y, w, hh]) =>
    `<i style="left:${x}px;top:${y}px;width:${w}px;height:${hh}px"><b>${n}</b></i>`).join("");
  writeFileSync(sementara, `<!doctype html><meta charset=utf-8><style>
    body{margin:0;background:#fff}
    .bk{position:relative;width:1440px}
    .bk svg{display:block;width:1440px;height:auto}
    i{position:absolute;border:2px solid rgba(247,53,65,.85);border-radius:6px}
    i b{position:absolute;left:0;top:-15px;font:10px ui-monospace,Menlo,monospace;
       color:#fff;background:#F73541;padding:1px 4px;border-radius:3px;white-space:nowrap}
  </style><div class=bk>${svg}${kotak}</div>`);
  await p.goto("file://" + sementara);
  await p.locator(".bk").screenshot({ path: path.join(KELUAR, `tumpang-${kunci}.png`) });
  console.log("tumpang", kunci);
}
await b.close();
