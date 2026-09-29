/* Banding satu WIDGET halaman terhadap PNG ekspor Figma milik pemilik.
 *
 *   node scripts/banding/widget.mjs <jalur-halaman> <keluar-dir> \
 *        nama=selektor=acuan.png [nama=selektor=acuan.png …]
 *
 * Mis.:
 *   node scripts/banding/widget.mjs /admin/keuangan/ /tmp/banding04 \
 *        transaksi=.keu__tabel=/tmp/acuan04/transaksi.png
 *
 * Acuannya ekspor 2x dari Figma, jadi halamannya dipotret pada
 * deviceScaleFactor 2 dan dipotong TEPAT pada kotak elemennya. Hasilnya satu
 * PNG per widget: [acuan | render | tumpuk 50% | selisih] (dan render
 * telanjangnya sebagai <nama>-render.png, untuk pita.mjs), plus angka:
 *
 *   - ukuran kedua gambar (harus sama; kalau tidak, kotaknya yang salah)
 *   - porsi piksel yang berbeda lebih dari 24 per kanal
 *
 * Kenapa ada kolom TUMPUK selain SELISIH: selisih cuma bilang "beda di
 * sini", tumpukan menunjukkan ARAH-nya — teks yang bergeser 3px terbaca
 * sebagai bayangan ganda, teks yang ukurannya salah terbaca sebagai dua
 * lebar yang tidak berimpit. Jebakan #36: sebelum memperbaiki komponen
 * karena angka, lihat dulu apa yang alatnya lihat.
 *
 * Butuh `dist` disajikan di 127.0.0.1:4399 (python3 -m http.server) dan API
 * tiruan di :8787.
 */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { pasangFont, buktiFont } from "./font.mjs";

const [jalur, keluar, ...pasangan] = process.argv.slice(2);
const tema = process.env.TEMA || "light";
/* Ekspor widget dari Figma BERLATAR TRANSPARAN di luar bidang kartunya
   (PNG RGBA) — dan beberapa kartu Coinest memang tanpa isi, cuma bergaris.
   Tanpa ditumpangkan ke latar halaman lebih dulu, seluruh bidang itu
   terbaca "beda" dan angkanya 99% untuk widget yang cuma salah sebagian.
   Latar frame 04 terukur #FBFBFC. */
const FON = process.env.FON || "#FBFBFC";
mkdirSync(keluar, { recursive: true });

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 2 });
await pasangFont(p);
await p.addInitScript((t) => {
  localStorage.setItem("pd-access-token", "uji");
  localStorage.setItem("pd-refresh-token", "uji");
  localStorage.setItem("pd-profil", JSON.stringify({ email: "d@c.id", name: "Dirga Pahlevi", role: "master" }));
  localStorage.setItem("tema", t);
}, tema);
await p.goto("http://127.0.0.1:4399" + jalur, { waitUntil: "networkidle" });
await p.waitForTimeout(900);
/* Mode TUKAR TEKS (env GANTI=berkas.json): sebelum dipotret, isi teks
   elemen tertentu ditukar dengan kalimat ACUAN yang sama persis — "$415,000"
   alih-alih "Rp192.500.000". Isi yang berbeda membuat tumpukan tidak pernah
   bisa berimpit; dengan isi yang sama, selisih yang tersisa murni ukuran,
   bobot, warna, dan letak. Bentuk berkasnya:
     [{ "sel": ".keu__saldonilai", "i": 0, "teks": "$415,000" }, …]
   `i` indeks elemen kalau selektornya cocok lebih dari satu. `html: true`
   untuk isi berelemen (mis. "<b>+$355</b> than last week"); `simpul: true`
   untuk mengganti simpul teks pertamanya saja, supaya ikon di sebelahnya
   tetap ada. */
if (process.env.GANTI) {
  const ganti = JSON.parse(readFileSync(process.env.GANTI, "utf8"));
  const gagal = await p.evaluate((ganti) => {
    const g = [];
    for (const { sel, i = 0, teks, html, simpul } of ganti) {
      const el = document.querySelectorAll(sel)[i];
      if (!el) { g.push(`${sel}[${i}]`); continue; }
      if (simpul) {
        // Hanya simpul teks PERTAMA yang diganti — ikon di sebelahnya
        // (Sort di kepala tabel, caret di tombol) tetap di tempatnya.
        const t = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
        if (t) t.textContent = teks; else g.push(`${sel}[${i}] (tanpa simpul teks)`);
      } else if (html) el.innerHTML = teks;
      else el.textContent = teks;
    }
    return g;
  }, ganti);
  if (gagal.length) console.log("GANTI tidak menemukan:", gagal.join(", "));
  await p.waitForTimeout(150);
}
const font = await buktiFont(p);
if (!font.terpasang) console.log("PERINGATAN: Urbanist tidak terpasang — angkanya tidak berarti", font);

const kanvas = await b.newPage();
await kanvas.setContent("<canvas id=c></canvas>");

const hasil = [];
for (const satu of pasangan) {
  const [nama, sel, acuan] = satu.split("=");
  const el = await p.$(sel);
  if (!el) { hasil.push({ nama, galat: `selektor ${sel} tidak ada` }); continue; }
  const kotak = await el.boundingBox();
  const render = await el.screenshot();
  const ref = readFileSync(acuan);
  const r = await kanvas.evaluate(async ([a64, b64, fon]) => {
    const muat = async (s) => { const i = new Image(); i.src = "data:image/png;base64," + s; await i.decode(); return i; };
    const [A0, B] = await Promise.all([muat(a64), muat(b64)]);
    // Acuan ditumpangkan ke latar halaman — lihat catatan FON di atas.
    const A = document.createElement("canvas"); A.width = A0.width; A.height = A0.height;
    const ag = A.getContext("2d"); ag.fillStyle = fon; ag.fillRect(0, 0, A.width, A.height); ag.drawImage(A0, 0, 0);
    const w = Math.max(A.width, B.width), h = Math.max(A.height, B.height);
    const c = document.getElementById("c");
    const jarak = 16;
    c.width = w * 4 + jarak * 3; c.height = h;
    const g = c.getContext("2d");
    g.fillStyle = "#ff00ff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(A, 0, 0);
    g.drawImage(B, w + jarak, 0);
    // tumpuk 50%
    g.fillStyle = "#ffffff"; g.fillRect((w + jarak) * 2, 0, w, h);
    g.globalAlpha = 0.5; g.drawImage(A, (w + jarak) * 2, 0); g.drawImage(B, (w + jarak) * 2, 0); g.globalAlpha = 1;
    // selisih
    const t = document.createElement("canvas"); t.width = w; t.height = h;
    const tg = t.getContext("2d");
    tg.drawImage(A, 0, 0); const da = tg.getImageData(0, 0, w, h).data;
    tg.clearRect(0, 0, w, h); tg.drawImage(B, 0, 0); const db = tg.getImageData(0, 0, w, h).data;
    const out = tg.createImageData(w, h);
    let beda = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
      const on = d > 24;
      if (on) beda++;
      // abu pucat untuk yang sama, merah untuk yang beda
      out.data[i] = on ? 230 : 245; out.data[i + 1] = on ? 40 : 245; out.data[i + 2] = on ? 60 : 245; out.data[i + 3] = 255;
    }
    tg.putImageData(out, 0, 0);
    g.drawImage(t, (w + jarak) * 3, 0);
    return { ukAcuan: [A.width, A.height], ukRender: [B.width, B.height], beda: +(beda / (w * h) * 100).toFixed(2), png: c.toDataURL("image/png").split(",")[1] };
  }, [ref.toString("base64"), render.toString("base64"), FON]);
  writeFileSync(`${keluar}/${nama}.png`, Buffer.from(r.png, "base64"));
  // Render telanjangnya ikut disimpan — pasangan untuk pita.mjs.
  writeFileSync(`${keluar}/${nama}-render.png`, render);
  hasil.push({ nama, kotak: [kotak.x, kotak.y, kotak.width, kotak.height].map((v) => +v.toFixed(1)), ukAcuan: r.ukAcuan, ukRender: r.ukRender, bedaPersen: r.beda });
}
console.log(JSON.stringify(hasil, null, 1));
await b.close();
