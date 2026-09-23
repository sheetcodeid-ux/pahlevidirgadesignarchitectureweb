/* Menyajikan Urbanist dari salinan lokal.
 *
 * Jaringan sesi ini memutus fonts.googleapis.com di tengah jalan (jebakan
 * #10 di CLAUDE.md), dan `document.fonts.check()` BERBOHONG — ia menjawab
 * true untuk keluarga yang tidak ada sama sekali, karena spesifikasinya
 * menganggap nama tak dikenal sebagai font sistem. Satu putaran tangkapan
 * layar pernah dikirim sebagai bukti "Arvo termuat" padahal yang terpasang
 * Georgia.
 *
 * Yang membuktikan: MEMBANDINGKAN LEBAR TEKS — `buktiFont()` di bawah.
 *
 * Kit VARIABEL (wght 400..800), bukan yang discrete: yang discrete cuma
 * menggambar dua instance, jadi 400 dan 500 keluar sama persis dan 600, 700,
 * 800 juga.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "urbanist");
const urls = readFileSync(path.join(DIR, "urls.txt"), "utf8").trim().split("\n");

export async function pasangFont(p) {
  await p.route("https://fonts.googleapis.com/**", (r) =>
    r.fulfill({ contentType: "text/css", body: readFileSync(path.join(DIR, "asli.css"), "utf8") }));
  await p.route("https://fonts.gstatic.com/**", (r) => {
    const i = urls.indexOf(r.request().url());
    return r.fulfill({
      contentType: "font/woff2",
      body: readFileSync(path.join(DIR, `w${(i < 0 ? 0 : i) + 1}.woff2`)),
    });
  });
}

/** Bukti Urbanist BENAR-BENAR terpasang: lebar teksnya beda dari font sistem. */
export async function buktiFont(p) {
  return p.evaluate(() => {
    const ukur = (f) => {
      const s = document.createElement("span");
      s.textContent = "Handgloves 12345";
      s.style.cssText = `position:absolute;visibility:hidden;font:600 24px ${f}`;
      document.body.appendChild(s);
      const w = s.getBoundingClientRect().width;
      s.remove();
      return w;
    };
    const u = ukur("Urbanist"), s = ukur("system-ui");
    return { urbanist: u, sistem: s, terpasang: Math.abs(u - s) > 1 };
  });
}
