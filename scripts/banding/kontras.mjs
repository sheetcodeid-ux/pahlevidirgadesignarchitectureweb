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
      for (const el of document.querySelectorAll("*")) {
        const teks = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!teks) continue;
        const g = getComputedStyle(el);
        const latar = rgb(g.backgroundColor);
        if (latar.length < 3 || (latar[3] !== undefined && latar[3] === 0)) continue;
        const r = rasio(rgb(g.color), latar);
        if (r < 3) {
          out.push({
            kelas: (el.className.toString() || el.tagName).slice(0, 40),
            isi: (el.textContent || "").trim().slice(0, 24),
            kontras: +r.toFixed(2), teks: g.color, latar: g.backgroundColor,
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
