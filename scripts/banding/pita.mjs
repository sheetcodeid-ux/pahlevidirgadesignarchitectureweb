/* Pita tinta per baris: di mana teks dan bentuk BERADA, tanpa perlu tahu
 * isinya.
 *
 *   node scripts/banding/pita.mjs <acuan.png> <render.png> [x0 x1] [ambang]
 *
 * Keduanya dipindai baris demi baris; baris yang punya piksel berbeda dari
 * warna latar (piksel pojok kiri-atas bagian dalam, atau FON) lebih dari
 * ambang dianggap bertinta, lalu baris-baris bertinta yang bersambung
 * digabung jadi satu pita. Keluarannya dua daftar pita berdampingan —
 * y-atas, tinggi, x-kiri, x-kanan — dalam piksel GAMBAR (2x), dan
 * dipasangkan menurut urutan.
 *
 * Isi teksnya beda (Indonesia lawan Inggris), jadi yang dibandingkan bukan
 * lebar kalimat melainkan TINGGI pita (= ukuran huruf) dan LETAKNYA. Tinggi
 * pita teks satu baris kira-kira tinggi huruf kapital ditambah descender;
 * dua teks berukuran sama memberi pita setinggi sama berapa pun isinya.
 */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";

const [acuan, render, x0 = "0", x1 = "99999", ambang = "40"] = process.argv.slice(2);
const FON = process.env.FON || "#FBFBFC";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage();
await p.setContent("<canvas id=c></canvas>");
const hasil = await p.evaluate(async ([a64, r64, x0, x1, ambang, fon]) => {
  const muat = async (s) => { const i = new Image(); i.src = "data:image/png;base64," + s; await i.decode(); return i; };
  const pita = (img) => {
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.fillStyle = fon; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const W = c.width, H = c.height;
    const xa = Math.max(0, x0), xb = Math.min(W - 1, x1);
    // latar = modus warna di kolom tengah rentang, supaya kartu mint maupun putih sama-sama benar
    const hitung = new Map();
    for (let y = 0; y < H; y += 2) for (let x = xa; x <= xb; x += 7) {
      const i = (y * W + x) * 4; const k = (d[i] >> 3) + "," + (d[i + 1] >> 3) + "," + (d[i + 2] >> 3);
      hitung.set(k, (hitung.get(k) || 0) + 1);
    }
    const [lk] = [...hitung.entries()].sort((a, z) => z[1] - a[1])[0];
    const [lr, lg, lb] = lk.split(",").map((v) => (Number(v) << 3) + 4);
    const out = []; let mulai = -1, xl = 1e9, xr = -1;
    for (let y = 0; y < H; y++) {
      let ada = false;
      for (let x = xa; x <= xb; x++) {
        const i = (y * W + x) * 4;
        const beda = Math.max(Math.abs(d[i] - lr), Math.abs(d[i + 1] - lg), Math.abs(d[i + 2] - lb));
        if (beda > ambang) { ada = true; if (x < xl) xl = x; if (x > xr) xr = x; }
      }
      if (ada && mulai < 0) { mulai = y; }
      if (!ada && mulai >= 0) { out.push([mulai, y - mulai, xl, xr]); mulai = -1; xl = 1e9; xr = -1; }
    }
    if (mulai >= 0) out.push([mulai, H - mulai, xl, xr]);
    return { latar: `rgb(${lr},${lg},${lb})`, pita: out };
  };
  const [A, R] = await Promise.all([muat(a64), muat(r64)]);
  return { acuan: pita(A), render: pita(R) };
}, [readFileSync(acuan).toString("base64"), readFileSync(render).toString("base64"), +x0, +x1, +ambang, FON]);
console.log(`latar acuan ${hasil.acuan.latar}   render ${hasil.render.latar}`);
console.log("   #   ACUAN  y   h   x0   x1      |  RENDER  y   h   x0   x1      |  dy  dh");
const n = Math.max(hasil.acuan.pita.length, hasil.render.pita.length);
for (let i = 0; i < n; i++) {
  const a = hasil.acuan.pita[i], r = hasil.render.pita[i];
  const f = (v) => (v ? v.map((x) => String(x).padStart(4)).join(" ") : "   -    -    -    -");
  const dy = a && r ? String(r[0] - a[0]).padStart(4) : "    ";
  const dh = a && r ? String(r[1] - a[1]).padStart(4) : "    ";
  console.log(`  ${String(i).padStart(2)}  ${f(a)}      |  ${f(r)}      | ${dy} ${dh}`);
}
await b.close();
