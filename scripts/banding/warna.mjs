/* Ada warna Figma yang tidak tergambar di kit?
 *
 *     node scripts/banding/warna.mjs
 *
 * Perbandingannya dilakukan Banding.tsx di browser — ia membaca warna yang
 * BENAR-BENAR tergambar lewat getComputedStyle, bukan dari CSS-nya. Skrip
 * ini cuma memanen hasilnya.
 */
import { bukaKit } from "./buka.mjs";

const { b, p } = await bukaKit();
await p.waitForSelector(".k-banding__petak");
const out = await p.$$eval(".k-banding", (els) => els.map((el) => ({
  ket: (el.querySelector(".k-banding__ket")?.textContent || "").split(" · ")[0],
  kurang: [...el.querySelectorAll(".is-kurang")].map((s) =>
    s.getAttribute("title")?.replace("Tidak ada di kit: ", "")),
})));
let n = 0;
for (const h of out) if (h.kurang.length) {
  n++;
  console.log(`${h.ket.slice(0, 56).padEnd(58)} kurang: ${h.kurang.join(", ")}`);
}
console.log(`\npasangan ${out.length}, warna Figma yang tidak ada di kit: ${n} komponen`);
await b.close();
