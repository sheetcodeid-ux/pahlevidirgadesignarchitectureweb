/* Di SEBELAH MANA bedanya?
 *
 *     PILIH="Chart|Busur" node scripts/banding/petabeda.mjs [keluar.png]
 *     LEBAR=390 PILIH="Mobile" node scripts/banding/petabeda.mjs
 *
 * LEBAR wajib 390 untuk varian Mobile di frame Item: ia bukan komponen
 * tersendiri melainkan media query, jadi di 1400 yang tergambar varian
 * desktopnya dan angkanya tidak berarti.
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
const { b, p } = await bukaKit({ skala: 4, lebar: Number(process.env.LEBAR || 1400) });
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
    /* Sejajarkan pada TINTA, bukan pada pojok kotak.
       Ekspor Figma dipotong tepat pada tinta layernya, sementara kotak DOM
       kita memuat ruang baris di atas dan di bawah huruf. Menumpuk keduanya
       dari pojok kiri-atas karena itu menggeser SELURUH isi baris 1-2px, dan
       setiap huruf jadi terhitung "beda" — baris pesan yang sebenarnya rapi
       sempat terbaca 13,7%. Yang dilaporkan sekarang: selisih setelah
       digeser, dan besar geserannya sendiri. */
    const tinta = (I) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      /* Lewati cincin 6px di tepi: kedua sel banding digambari garis putus
         abu, dan tanpa ini SETIAP pasangan melapor geseran 0 karena yang
         ketemu duluan selalu garis itu, bukan isinya. */
      const M = 6;
      for (let yy = M; yy < I.h - M; yy++) for (let xx = M; xx < I.w - M; xx++) {
        const o = (yy * I.w + xx) * 4;
        const d = I.d.data;
        if (d[o] > 246 && d[o + 1] > 246 && d[o + 2] > 246) continue;
        if (xx < x0) x0 = xx; if (xx > x1) x1 = xx;
        if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
      }
      return x1 < 0 ? { x: 0, y: 0 } : { x: x0, y: y0 };
    };
    const ta = tinta(A), tb = tinta(B);
    /* Geseran tinta dicoba, TIDAK dipaksakan. Pada beberapa pasangan piksel
       bertinta paling atas di kedua gambar bukan benda yang sama — di frame
       Chart yang satu garis kisi dan yang satu batang — dan menyejajarkannya
       justru memindahkan seluruh gambar puluhan piksel. Jadi kedua susunan
       dihitung dan yang selisihnya lebih kecil yang dipakai; kalau yang
       menang susunan tanpa geseran, geserannya dilaporkan 0. */
    const hitung = (dx, dy, gambar) => {
      const w = Math.min(A.w, B.w) - Math.abs(dx), h = Math.min(A.h, B.h) - Math.abs(dy);
      let n = 0;
      const im = gambar ? gambar.createImageData(w, h) : null;
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const ax = xx + Math.max(0, -dx), ay = yy + Math.max(0, -dy);
        const bx = xx + Math.max(0, dx), by = yy + Math.max(0, dy);
        const ia = (ay * A.w + ax) * 4, ib = (by * B.w + bx) * 4, io = (yy * w + xx) * 4;
        const beda = Math.abs(A.d.data[ia] - B.d.data[ib]) > 40 ||
          Math.abs(A.d.data[ia + 1] - B.d.data[ib + 1]) > 40 ||
          Math.abs(A.d.data[ia + 2] - B.d.data[ib + 2]) > 40;
        if (beda) n++;
        if (im) {
          im.data[io] = beda ? 244 : 255;
          im.data[io + 1] = beda ? 53 : 255;
          im.data[io + 2] = beda ? 65 : 255;
          im.data[io + 3] = 255;
        }
      }
      return { persen: (n / (w * h)) * 100, w, h, im };
    };
    const nol = hitung(0, 0, null);
    const geser = hitung(tb.x - ta.x, tb.y - ta.y, null);
    const pakai = geser.persen < nol.persen ? [tb.x - ta.x, tb.y - ta.y] : [0, 0];
    const dx = pakai[0], dy = pakai[1];
    const w = Math.min(A.w, B.w) - Math.abs(dx), h = Math.min(A.h, B.h) - Math.abs(dy);
    const out = document.createElement("canvas");
    out.width = w; out.height = h;
    const g = out.getContext("2d");
    const im = g.createImageData(w, h);
    let n = 0;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const ax = xx + Math.max(0, -dx), ay = yy + Math.max(0, -dy);
      const bx = xx + Math.max(0, dx), by = yy + Math.max(0, dy);
      const ia = (ay * A.w + ax) * 4, ib = (by * B.w + bx) * 4, io = (yy * w + xx) * 4;
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
    return { peta: out.toDataURL().split(",")[1], persen: (n / (w * h)) * 100, w, h, dx, dy };
  }, [pa, pc]);
  baris.push({ ket, pa, pc, ...r });
}
baris.sort((a, c) => c.persen - a.persen);
const html = `<!doctype html><meta charset=utf-8><style>
body{font:12px/1.4 system-ui;margin:0;padding:16px;background:#fff;color:#242E2C}
.r{display:flex;align-items:flex-start;gap:14px;padding:10px 0;border-top:1px solid #E5E6E6}
.r img{image-rendering:pixelated;outline:1px solid #E5E6E6;background:#fff}
.n{width:240px;font-weight:600}.p{color:#F73541;font-weight:700;width:60px}
</style><body>${baris.map((r) => `<div class=r><div class=n>${r.ket}</div><div class=p>${r.persen.toFixed(1)}%<br><span style="color:#6B7271;font-weight:400">geser ${(r.dx / 4).toFixed(2)},${(r.dy / 4).toFixed(2)}</span></div>
<img src="data:image/png;base64,${r.pa}" style="width:${r.w / 4}px"><img src="data:image/png;base64,${r.pc}" style="width:${r.w / 4}px"><img src="data:image/png;base64,${r.peta}" style="width:${r.w / 4}px"></div>`).join("")}</body>`;
writeFileSync("/tmp/peta-banding.html", html);
/* Lebih dari 24 pasangan sekaligus membuat halamannya terlalu tinggi untuk
   `fullPage` dan Chromium menolak dengan "Unable to capture screenshot".
   Angkanya tetap dicetak; gambarnya diambil per kelompok lewat PILIH. */
if (baris.length <= 24) {
  const p2 = await b.newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 3 });
  await p2.goto("file:///tmp/peta-banding.html");
  await p2.screenshot({ path: KELUAR, fullPage: true });
} else {
  console.log(`(${baris.length} pasangan - gambarnya dilewati, pakai PILIH untuk sekelompok)`);
}
console.log(baris.map((r) => `${r.persen.toFixed(1)}%  geser ${(r.dx / 4).toFixed(2)},${(r.dy / 4).toFixed(2)}  ${r.ket}`).join("\n") || "(tidak ada yang cocok)");
console.log("->", KELUAR);
await b.close();
