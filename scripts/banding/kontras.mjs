/* Pemindai kontras teks — jebakan #37 di CLAUDE.md.
 *
 *     node scripts/banding/kontras.mjs /admin/keuangan/ /admin/keuangan/tagihan/
 *
 * Butuh `dist` yang sudah disajikan di 127.0.0.1:4399 (python3 -m http.server,
 * bukan npx http-server — jebakan #28).
 *
 * Memindai SETIAP elemen yang menggambar teks di atas latarnya sendiri dan
   melaporkan pasangan yang rasio kontrasnya di bawah 3 — di KEDUA tema.
   Ini alat untuk jebakan #37: dua token yang berbeda di terang bisa
   bernilai sama di gelap, dan mata yang sedang mencari hal lain membaca
   kotak kosong sebagai "ada lencananya". */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { pasangFont } from "/home/user/pahlevidirgadesignarchitectureweb/scripts/banding/font.mjs";

const halaman = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let cacat = 0;
for (const tema of ["light", "dark"]) {
  for (const h of halaman) {
    const p = await b.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
    await pasangFont(p);
    await p.addInitScript((t) => {
      localStorage.setItem("pd-access-token", "uji"); localStorage.setItem("pd-refresh-token", "uji");
      localStorage.setItem("pd-profil", JSON.stringify({ email: "d@c.id", name: "Dirga Pahlevi", role: "master" }));
      localStorage.setItem("tema", t);
    }, tema);
    await p.goto("http://127.0.0.1:4399" + h, { waitUntil: "networkidle" });
    await p.waitForTimeout(700);
    const hasil = await p.evaluate(() => {
      const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
      const lum = (c) => {
        const [r, g, bl] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
      };
      const rasio = (a, z) => { const [x, y] = [lum(a), lum(z)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
      const out = [];
      /* Ikon juga diperiksa, bukan cuma teks. Sempat buta di sini (jebakan
         #36): ikon di bulatan mint linimasa kit tergambar terang di atas mint
         di tema gelap, dan pemindai yang cuma mencari simpul teks tidak
         pernah melihatnya. Ikon kit menggambar dengan `currentColor`, jadi
         warnanya `color` milik <svg>-nya; ambangnya sama, 3 — batas WCAG
         untuk grafik yang membawa makna. */
      for (const el of document.querySelectorAll("*")) {
        const ikon = el.tagName === "svg" && el.hasAttribute("width") && el.hasAttribute("height");
        const teks = ikon || [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!teks) continue;
        if (ikon) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === "hidden") continue;
        }
        /* <option> tidak digambar di halaman: daftarnya menu bawaan sistem
           operasi dengan warnanya sendiri. Warna hitungannya (abu di atas
           abu) alarm palsu. */
        if (el.tagName === "OPTION") continue;
        const g = getComputedStyle(el);
        /* Latar dicari ke LELUHUR terdekat yang buram, bukan cuma elemennya
           sendiri. Sempat buta di sini (jebakan #36): label menu aktif rel
           kit adalah <span> tanpa latar di dalam pil <a> bermint, jadi
           putih-di-atas-mint 1,23 di tema gelap tidak pernah terlaporkan —
           karena elemen yang punya teks tidak punya latar, dan yang punya
           latar tidak punya teks langsung. Latar setengah tembus dilewati
           (tidak bisa dihitung tanpa tahu apa di belakangnya), dan
           pencarian berhenti di <body>, yang latarnya milik halaman. */
        let latar = null;
        for (let x = el; x && x !== document.documentElement; x = x.parentElement) {
          const c = rgb(getComputedStyle(x).backgroundColor);
          if (c.length >= 3 && (c[3] === undefined || c[3] === 1)) { latar = c; break; }
          if (c.length >= 3 && c[3] > 0) { latar = null; break; }
        }
        if (!latar) continue;
        const r = rasio(rgb(g.color), latar);
        if (r < 3) {
          out.push({
            kelas: (ikon ? "ikon " : "") + ((el.className.baseVal ?? el.className).toString() || el.tagName).slice(0, 40),
            isi: ikon ? `di ${(el.parentElement?.className.toString() || "?").slice(0, 30)}` : (el.textContent || "").trim().slice(0, 24),
            kontras: +r.toFixed(2), teks: g.color, latar: `rgb(${latar.slice(0, 3).join(", ")})`,
          });
        }
      }
      return out;
    });
    for (const c of hasil) { cacat++; console.log(`${tema} ${h} → ${JSON.stringify(c)}`); }
    await p.close();
  }
}
console.log(cacat === 0 ? "BERSIH — tidak ada pasangan di bawah kontras 3" : `${cacat} pasangan bermasalah`);
await b.close();
