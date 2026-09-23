/* Ukuran dan tebal huruf yang mana yang memberi tinta seperti di Figma?
 *
 *     node scripts/banding/cocokfont.mjs '[["Total Savings",82.14,14.0],["$47,600",87.64,22.18]]'
 *
 * Tinta DIPINDAI dari piksel, bukan dari metrik font: `measureText` di
 * Chromium headless mengembalikan lebar-maju untuk actualBoundingBox, jadi
 * ia tidak bisa membedakan tinta dari kotak. Yang dicari pasangan
 * (ukuran, bobot) yang lebar tintanya paling dekat — LEBARNYA, bukan
 * tingginya: huruf berekor bawah dan tanda "$" yang menjulur membuat tinggi
 * tinta berbohong tentang ukuran font.
 */
import { bukaKit } from "./buka.mjs";

const UJI = JSON.parse(process.argv[2]);
const { b, p } = await bukaKit({ lebar: 1400 });
const out = await p.evaluate(async (uji) => {
  await document.fonts.ready;
  const S = 8, c = document.createElement("canvas");
  c.width = 900 * S; c.height = 60 * S;
  const x = c.getContext("2d");
  const tinta = (teks, fs, fw) => {
    x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = "#000"; x.textBaseline = "alphabetic";
    x.font = `${fw} ${fs * S}px Urbanist`;
    x.fillText(teks, 10 * S, 45 * S);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let py = 0; py < c.height; py++) for (let px = 0; px < c.width; px++)
      if (d[(py * c.width + px) * 4 + 3] > 40) {
        if (px < x0) x0 = px; if (px > x1) x1 = px;
        if (py < y0) y0 = py; if (py > y1) y1 = py;
      }
    return { w: (x1 + 1 - x0) / S, h: (y1 + 1 - y0) / S };
  };
  const hasil = [];
  for (const [teks, tw, th] of uji) {
    const calon = [];
    for (let fs = 8; fs <= 34; fs += 0.5)
      for (const fw of [400, 500, 600, 700, 800]) {
        const t = tinta(teks, fs, fw);
        calon.push({ fs, fw, w: +t.w.toFixed(2), h: +t.h.toFixed(2), sesat: Math.abs(t.w - tw) / tw });
      }
    calon.sort((a, z) => a.sesat - z.sesat);
    hasil.push({ teks: teks.slice(0, 26), target: `${tw}x${th}`, tiga: calon.slice(0, 3).map((v) => `${v.fs}/${v.fw} -> ${v.w}x${v.h} (${(v.sesat * 100).toFixed(1)}%)`) });
  }
  return hasil;
}, UJI);
for (const r of out) {
  console.log(`\n"${r.teks}"  target ${r.target}`);
  for (const t of r.tiga) console.log("   " + t);
}
await b.close();
