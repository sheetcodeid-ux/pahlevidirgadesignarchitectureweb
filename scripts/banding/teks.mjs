/* Ukuran huruf dan warna, diukur dari PIKSEL — bukan dari atribut.
 *
 *     node scripts/banding/teks.mjs            # seluruh pasangan
 *     PILIH="Chart" node scripts/banding/teks.mjs
 *     LEBAR=390 PILIH="Mobile" node scripts/banding/teks.mjs
 *
 * Dua hal yang tidak bisa dijawab `selisih.mjs` maupun `warna.mjs`:
 *
 * 1. UKURAN DAN TEBAL HURUF. Keduanya mengubah lebar tinta satu baris dan
 *    tidak mengubah apa pun yang lain. Jadi tiap pita tinta mendatar di
 *    acuan dipasangkan dengan pita di kit, lalu lebar dan tingginya
 *    dibandingkan. Teks yang 28% kebesaran terbaca langsung; selisih kotak
 *    komponennya tidak pernah menunjukkannya, karena kotaknya ditentukan
 *    wadahnya.
 *
 * 2. WARNA YANG SALAH PADA ELEMEN YANG BENAR. `warna.mjs` membandingkan
 *    HIMPUNAN warna, jadi nominal yang seharusnya hijau tua tapi digambar
 *    hitam TIDAK ketahuan selama hijau tuanya masih dipakai di tempat lain
 *    dalam komponen yang sama. Yang dibandingkan di sini PORSI tiap warna:
 *    hijau tua berkurang dan hitam bertambah, dan itu kelihatan.
 */
import { bukaKit } from "./buka.mjs";

const RE = new RegExp(process.env.PILIH || ".");
const AMBANG_TEKS = Number(process.env.AMBANG || 3); // persen
const { b, p } = await bukaKit({ skala: 4, lebar: Number(process.env.LEBAR || 1400) });
/* Garis putus penanda sel DIMATIKAN sebelum dipotret. Selama ia ada, setiap
   pengukuran harus melewati cincin beberapa piksel di tepi — dan cincin itu
   ikut menelan apa pun yang memang duduk di tepi, misalnya garis atas tabel
   yang tergambar di y=0. Akibatnya tabel yang garisnya BENAR terbaca
   kehilangan 54% warnanya. */
await p.addStyleTag({ content: ".k-banding__figma,.k-banding__kit{outline:none !important}" });

const semua = [];
for (const k of await p.$$(".k-banding")) {
  const ket = ((await k.$eval(".k-banding__ket", (e) => e.textContent)) || "").split(" · ")[0];
  if (!RE.test(ket)) continue;
  const a = await k.$(".k-banding__figma"), c = await k.$(".k-banding__kit");
  if (!a || !c) continue;
  /* Pasangan bertanda `data-tanpa-kotak` DILEWATI. Acuannya di situ bukan
     bingkai melainkan kotak TINTA layernya (varian tanpa latar), jadi sel
     bandingnya lebih kecil daripada elemen kit dan isinya meluber keluar.
     Pita maupun porsi warnanya lalu melaporkan cacat yang sebenarnya cuma
     potongan — "Wed" terbaca setinggi setengahnya, nav tidak aktif terbaca
     33% lebih sempit. Sudah dua kali membuat saya mengejar hantu. */
  if (await k.evaluate((e) => e.hasAttribute("data-tanpa-kotak"))) continue;
  const z = await k.evaluate((e) => parseFloat(getComputedStyle(e).getPropertyValue("--k-banding-zoom")) || 1);
  const pa = (await a.screenshot()).toString("base64");
  const pc = (await c.screenshot()).toString("base64");
  const r = await p.evaluate(async ([A, C]) => {
    const baca = async (b64) => {
      const i = new Image(); i.src = "data:image/png;base64," + b64; await i.decode();
      const cv = document.createElement("canvas"); cv.width = i.width; cv.height = i.height;
      const g = cv.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, i.width, i.height); g.drawImage(i, 0, 0);
      return { d: g.getImageData(0, 0, i.width, i.height).data, w: i.width, h: i.height };
    };
    const M = 0;
    const pita = (I) => {
      const ada = [];
      for (let y = 0; y < I.h; y++) {
        let x0 = -1, x1 = -1;
        if (y >= M && y < I.h - M) {
          for (let x = M; x < I.w - M; x++) {
            const o = (y * I.w + x) * 4;
            if (I.d[o] < 247 || I.d[o + 1] < 247 || I.d[o + 2] < 247) { if (x0 < 0) x0 = x; x1 = x; }
          }
        }
        ada.push(x0 < 0 ? null : [x0, x1]);
      }
      const out = []; let mulai = -1, lo = 1e9, hi = -1;
      for (let y = 0; y <= ada.length; y++) {
        if (ada[y]) { if (mulai < 0) mulai = y; lo = Math.min(lo, ada[y][0]); hi = Math.max(hi, ada[y][1]); }
        else if (mulai >= 0) { out.push({ y0: mulai, y1: y, x0: lo, x1: hi + 1 }); mulai = -1; lo = 1e9; hi = -1; }
      }
      return out;
    };
    const histogram = (I) => {
      const h = new Map();
      let n = 0;
      for (let y = M; y < I.h - M; y++) for (let x = M; x < I.w - M; x++) {
        const o = (y * I.w + x) * 4;
        // bulatkan ke kelipatan 8 supaya antialias tidak jadi warna sendiri
        const key = ((I.d[o] >> 3) << 19) | ((I.d[o + 1] >> 3) << 10) | ((I.d[o + 2] >> 3) << 1);
        h.set(key, (h.get(key) || 0) + 1); n++;
      }
      const heks = (k) => {
        const r = ((k >> 19) & 31) << 3, g = ((k >> 10) & 31) << 3, b = ((k >> 1) & 31) << 3;
        return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
      };
      /* Latar putih (dan abu yang di atas #EEEEEE, yang di atas putih tidak bisa
         dibedakan mata) DIBUANG lalu sisanya dinormalkan ulang ke 100%.
         Sel acuan dan sel kit tidak selalu sama besar — yang satu dipotong
         pada tinta, yang satu pada kotak — jadi porsi terhadap SELURUH sel
         berubah hanya karena marginnya beda. Terukur pada sparkline tren:
         gradiennya terbaca 25,4% lawan 40,9% padahal nilai pikselnya sama
         persis baris demi baris (255 255 255 255 31 207 218 229 240 250 di
         kedua sisi). Yang dibandingkan sekarang komposisi ISINYA. */
      const putih = (k) => {
        const r = ((k >> 19) & 31) << 3, g = ((k >> 10) & 31) << 3, b = ((k >> 1) & 31) << 3;
        return r >= 238 && g >= 238 && b >= 238;
      };
      let isi = 0;
      for (const [k, v] of h) if (!putih(k)) isi += v;
      if (isi === 0) return [];
      return [...h.entries()].filter(([k]) => !putih(k))
        .map(([k, v]) => ({ warna: heks(k), persen: (v / isi) * 100 }))
        .filter((e) => e.persen >= 0.8).sort((x, y) => y.persen - x.persen);
    };
    const A2 = await baca(A), C2 = await baca(C);
    return { pa: pita(A2), pc: pita(C2), ha: histogram(A2), hc: histogram(C2) };
  }, [pa, pc]);
  semua.push({ ket, z, ...r });
}

const S = (z) => 4 * z;
let cacatTeks = 0, cacatWarna = 0;
for (const r of semua) {
  const s = S(r.z);
  const baris = [];
  const n = Math.min(r.pa.length, r.pc.length);
  if (r.pa.length !== r.pc.length) {
    baris.push(`   JUMLAH PITA BEDA: figma ${r.pa.length}, kit ${r.pc.length}`);
    cacatTeks++;
  }
  for (let i = 0; i < n; i++) {
    const A = r.pa[i], C = r.pc[i];
    const aw = (A.x1 - A.x0) / s, cw = (C.x1 - C.x0) / s;
    const ah = (A.y1 - A.y0) / s, ch = (C.y1 - C.y0) / s;
    const dw = aw === 0 ? 0 : ((cw - aw) / aw) * 100;
    const dh = ah === 0 ? 0 : ((ch - ah) / ah) * 100;
    if (Math.abs(dw) > AMBANG_TEKS || Math.abs(dh) > AMBANG_TEKS) {
      cacatTeks++;
      baris.push(`   pita ${i}: lebar ${aw.toFixed(1)} -> ${cw.toFixed(1)} (${dw >= 0 ? "+" : ""}${dw.toFixed(1)}%)  tinggi ${ah.toFixed(1)} -> ${ch.toFixed(1)} (${dh >= 0 ? "+" : ""}${dh.toFixed(1)}%)`);
    }
  }
  /* Warna dicocokkan dengan TOLERANSI, bukan sama-persis. Histogramnya
     membulatkan tiap kanal ke kelipatan 8, jadi dua warna yang bedanya satu
     unit bisa jatuh ke ember yang berbeda dan terbaca "hilang" — #EEEEEF
     lawan #EFF0F0 tidak bisa dibedakan mata siapa pun, dan mengejarnya
     berarti menambah token baru untuk selisih 1/255. Yang dicari warna kit
     terdekat dalam jarak kanal 12; di atas itu ia memang warna lain. */
  const urai = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const dekat = (a, b) => {
    const [x, y, z] = urai(a), [p, q, t] = urai(b);
    return Math.max(Math.abs(x - p), Math.abs(y - q), Math.abs(z - t)) <= 12;
  };
  /* Warna acuan yang berdekatan DIGABUNG dulu jadi satu kelompok sebelum
     dibandingkan. Kalau tidak, dua warna acuan yang sama-sama cocok dengan
     satu warna kit masing-masing melapor jumlah gabungannya, dan keduanya
     terbaca dua kali lipat — bilah kepala seksi sempat melapor 32,8% lawan
     32,8% sebagai dua cacat padahal itu angka yang SAMA. */
  const kelompok = [];
  for (const e of r.ha) {
    const g = kelompok.find((q) => q.warna.some((w) => dekat(w, e.warna)));
    if (g) { g.warna.push(e.warna); g.a += e.persen; }
    else kelompok.push({ warna: [e.warna], a: e.persen });
  }
  for (const g of kelompok) {
    let punya = 0;
    for (const k of r.hc) if (g.warna.some((w) => dekat(w, k.warna))) punya += k.persen;
    if (Math.abs(punya - g.a) > Math.max(2, g.a * 0.35)) {
      cacatWarna++;
      baris.push(`   warna ${g.warna.join("/")}: figma ${g.a.toFixed(1)}% -> kit ${punya.toFixed(1)}%`);
    }
  }
  if (baris.length) console.log(`\n${r.ket}`), console.log(baris.join("\n"));
}
console.log(`\npasangan ${semua.length} · pita teks meleset >${AMBANG_TEKS}%: ${cacatTeks} · porsi warna meleset: ${cacatWarna}`);
await b.close();
