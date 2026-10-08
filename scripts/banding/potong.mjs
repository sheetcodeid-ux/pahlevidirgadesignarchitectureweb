/* Pemindai teks TERPOTONG dan MELUBER — pasangan jebakan #36 di CLAUDE.md.
 *
 *     node scripts/banding/potong.mjs /admin/ /admin/keuangan/
 *     KARTU=".rks__sel, .rks__jadwal" node scripts/banding/potong.mjs /admin/
 *     RUSAK=".x{white-space:nowrap}" node scripts/banding/potong.mjs /admin/
 *
 * Butuh `dist` yang sudah disajikan di 127.0.0.1:4399 dan API tiruan di
 * 127.0.0.1:8787 (scripts/banding/sajikan.sh, api-tiruan.mjs).
 *
 * Kenapa alat ini ada: pemeriksaan lama ("elemen tanpa anak yang
 * scrollWidth > clientWidth, kecuali yang menyatakan text-overflow:
 * ellipsis") buta pada dua bentuk yang sudah lolos ke produksi di Dashboard:
 *   - label kop "LABA BERSIH · OKTOBER" terpotong diam-diam di 1300/1366 —
 *     elemennya punya anak (keping nomor) jadi dilewati, dan ia menyatakan
 *     ellipsis padahal elipsis TIDAK menyala pada simpul teks lepas di dalam
 *     flex;
 *   - kalimat kepala jadwal yang meluber KELUAR kartunya di ponsel tanpa
 *     dipotong siapa pun.
 * Jadi yang diperiksa di sini SIMPUL TEKS, bukan elemen: kotak Range-nya
 * dibandingkan dengan setiap leluhur yang memotong, lalu dengan kartu
 * terdekatnya.
 *
 * Yang dilewati dengan sengaja: penampung gulir (isinya memang bisa
 * digeser), `.sr-only` (dipotong untuk pembaca layar), `display: contents`
 * (tidak punya kotak), teks `visibility: hidden`, dan elipsis yang SAH —
 * induk langsung teksnya blok/inline-block ber-text-overflow: ellipsis.
 *
 * Buktikan alatnya bisa merah sebelum mempercayai angka 0-nya: RUSAK
 * menyuntikkan CSS ke halaman (mis. membuang flex-wrap dari kalimat yang
 * seharusnya terlipat). */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { pasangFont } from "./font.mjs";

const halaman = process.argv.slice(2);
if (!halaman.length) {
  console.error("pakai: node scripts/banding/potong.mjs /admin/ [/admin/…]");
  process.exit(2);
}
const KARTU = process.env.KARTU || ".k-kartu, .k-sisi, [class*='__papan'], [class*='__kartu']";
const UKURAN = [[1440, 790], [1366, 768], [1300, 760], [1024, 768], [390, 844]];

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let total = 0;
for (const h of halaman) {
  for (const [w, t] of UKURAN) {
    const p = await b.newPage({ viewport: { width: w, height: t } });
    await pasangFont(p);
    await p.addInitScript(() => {
      localStorage.setItem("pd-access-token", "uji"); localStorage.setItem("pd-refresh-token", "uji");
      localStorage.setItem("pd-profil", JSON.stringify({ email: "dirga@contoh.id", role: "master", isMasterAdmin: true }));
    });
    await p.goto("http://127.0.0.1:4399" + h, { waitUntil: "networkidle" });
    if (process.env.RUSAK) await p.addStyleTag({ content: process.env.RUSAK });
    await p.waitForTimeout(700);
    const temuan = await p.evaluate((kartuSel) => {
      const out = new Set();
      const nama = (e) => (e.className || e.tagName).toString().split(" ")[0] || e.tagName;
      const akar = document.querySelector(".kl") || document.body;
      const w = document.createTreeWalker(akar, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!n.textContent.trim()) continue;
        const el = n.parentElement;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || el.closest(".sr-only, [hidden]")) continue;
        const r = document.createRange(); r.selectNodeContents(n);
        const rr = [...r.getClientRects()].filter((x) => x.width > 0.5);
        if (!rr.length) continue;
        const kiri = Math.min(...rr.map((x) => x.left)), kanan = Math.max(...rr.map((x) => x.right));
        const atas = Math.min(...rr.map((x) => x.top)), bawah = Math.max(...rr.map((x) => x.bottom));
        const teks = n.textContent.trim().slice(0, 30);
        /* Meluber: keluar dari kartu/benda terdekat walau tidak dipotong. */
        const kartu = el.closest(kartuSel);
        if (kartu) {
          const k = kartu.getBoundingClientRect();
          let gulir = false;
          for (let a = el; a && a !== kartu; a = a.parentElement) if (/(auto|scroll)/.test(getComputedStyle(a).overflowX)) gulir = true;
          if (!gulir && (kiri < k.left - 1 || kanan > k.right + 1)) { out.add(`meluber ${nama(el)}: ${teks} ⊄ ${nama(kartu)}`); continue; }
        }
        /* Terpotong: dibandingkan dengan setiap leluhur pemotong. */
        const elipsisSah = cs.textOverflow === "ellipsis" && /^(block|inline-block|list-item|table-cell)$/.test(cs.display);
        for (let a = el; a && a !== document.body; a = a.parentElement) {
          const ac = getComputedStyle(a);
          if (ac.display === "contents") continue;
          const ox = ac.overflowX, oy = ac.overflowY;
          if (/(auto|scroll)/.test(ox + oy)) break;
          if (!/(hidden|clip)/.test(ox + oy)) continue;
          if (elipsisSah && a === el) continue;
          const k = a.getBoundingClientRect();
          const mendatar = /(hidden|clip)/.test(ox) && (kiri < k.left - 1 || kanan > k.right + 1);
          const tegak = /(hidden|clip)/.test(oy) && (atas < k.top - 1 || bawah > k.bottom + 1);
          if (mendatar || tegak) { out.add(`terpotong ${nama(el)}: ${teks} ⊄ ${nama(a)}`); break; }
        }
      }
      return [...out];
    }, KARTU);
    total += temuan.length;
    console.log(`${h} ${w}x${t}`, temuan.length ? temuan : "bersih");
    await p.close();
  }
}
console.log(total ? `\n${total} temuan` : "\nBERSIH — tidak ada teks terpotong atau meluber");
await b.close();
process.exit(total ? 1 : 0);
