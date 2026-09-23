/* Di SEBELAH MANA bedanya?
 *
 *     PILIH="Chart|Busur" node scripts/banding/petabeda.mjs [keluar.png]
 *
 * Tiga yang lain cuma melaporkan angka. Yang menunjukkan bahwa relnya tidak
 * pernah tergambar, bahwa satu kata hilang, atau bahwa isian gradiennya abu
 * dan bukan mint — cuma gambar selisihnya. Setiap "cacat komponen" terbesar
 * di proyek ini ketemu di sini, bukan di angka.
 */
import { writeFileSync } from "node:fs";
import { bukaKit } from "./buka.mjs";

const RE = new RegExp(process.env.PILIH || ".");
const KELUAR = process.argv[2] || "/tmp/peta-banding.png";
const { b, p } = await bukaKit({ skala: 4 });
const kartu = await p.$$(".k-banding");
const baris = [];
for (const k of kartu) {
  if (await k.evaluate((e) => e.hasAttribute("data-tanpa-kotak"))) continue;
  const ket = ((await k.$eval(".k-banding__ket", (e) => e.textContent)) || "").split(" · ")[0];
  if (!RE.test(ket)) continue;
  const a = await k.$(".k-banding__figma"), c = await k.$(".k-banding__kit");
  if (!a || !c) continue;
  const pa = (await a.screenshot()).toString("base64");
  const pc = (await c.screenshot()).toString("base64");
  const r = await p.evaluate(async ([x, y]) => {
    const muat = async (b64) => {
      const i = new Image(); i.src = "data:image/png;base64," + b64; await i.decode();
      const cv = document.createElement("canvas");
      cv.width = i.width; cv.height = i.height;
      const g = cv.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(i, 0, 0);
      return { d: g.getImageData(0, 0, cv.width, cv.height), w: cv.width, h: cv.height };
    };
    const A = await muat(x), B = await muat(y);
    const w = Math.min(A.w, B.w), h = Math.min(A.h, B.h);
    const out = document.createElement("canvas");
    out.width = w; out.height = h;
    const g = out.getContext("2d");
    const im = g.createImageData(w, h);
    let n = 0;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const ia = (yy * A.w + xx) * 4, ib = (yy * B.w + xx) * 4, io = (yy * w + xx) * 4;
      const beda = Math.abs(A.d.data[ia] - B.d.data[ib]) > 40 ||
        Math.abs(A.d.data[ia + 1] - B.d.data[ib + 1]) > 40 ||
        Math.abs(A.d.data[ia + 2] - B.d.data[ib + 2]) > 40;
      if (beda) n++;
      im.data[io] = beda ? 244 : 255;
      im.data[io + 1] = beda ? 53 : 255;
      im.data[io + 2] = beda ? 65 : 255;
      im.data[io + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return { peta: out.toDataURL().split(",")[1], persen: (n / (w * h)) * 100, w, h };
  }, [pa, pc]);
  baris.push({ ket, pa, pc, ...r });
}
baris.sort((a, c) => c.persen - a.persen);
const html = `<!doctype html><meta charset=utf-8><style>
body{font:12px/1.4 system-ui;margin:0;padding:16px;background:#fff;color:#242E2C}
.r{display:flex;align-items:flex-start;gap:14px;padding:10px 0;border-top:1px solid #E5E6E6}
.r img{image-rendering:pixelated;outline:1px solid #E5E6E6;background:#fff}
.n{width:240px;font-weight:600}.p{color:#F73541;font-weight:700;width:60px}
</style><body>${baris.map((r) => `<div class=r><div class=n>${r.ket}</div><div class=p>${r.persen.toFixed(1)}%</div>
<img src="data:image/png;base64,${r.pa}" style="width:${r.w / 4}px"><img src="data:image/png;base64,${r.pc}" style="width:${r.w / 4}px"><img src="data:image/png;base64,${r.peta}" style="width:${r.w / 4}px"></div>`).join("")}</body>`;
writeFileSync("/tmp/peta-banding.html", html);
const p2 = await b.newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 3 });
await p2.goto("file:///tmp/peta-banding.html");
await p2.screenshot({ path: KELUAR, fullPage: true });
console.log(baris.map((r) => `${r.persen.toFixed(1)}%  ${r.ket}`).join("\n") || "(tidak ada yang cocok)");
console.log("->", KELUAR);
await b.close();
