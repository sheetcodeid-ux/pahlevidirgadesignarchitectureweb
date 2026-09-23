/* Kotaknya seukuran belum?
 *
 *     node scripts/banding/selisih.mjs [lebar-viewport]
 *
 * Tiap .k-banding memuat acuan Figma DAN komponen kit, jadi tidak ada cara
 * salah pasang. Lebar viewport jadi argumen karena varian Mobile di frame
 * Item bukan komponen tersendiri melainkan MEDIA QUERY — mengukurnya di 1400
 * selalu melaporkan varian desktopnya.
 */
import { bukaKit } from "./buka.mjs";

const LEBAR = Number(process.argv[2] || 1400);
const { b, p } = await bukaKit({ lebar: LEBAR });

const out = await p.evaluate(() => {
  const hasil = [];
  for (const fig of document.querySelectorAll(".k-banding")) {
    if (fig.hasAttribute("data-tanpa-kotak")) continue;
    const ket = fig.querySelector(".k-banding__ket")?.textContent || "";
    const z = parseFloat(getComputedStyle(fig).getPropertyValue("--k-banding-zoom")) || 1;
    const acuan = fig.querySelector(".k-banding__figma");
    const isi = fig.querySelector(".k-banding__skala")?.firstElementChild;
    if (!acuan || !isi) continue;
    const a = acuan.getBoundingClientRect();
    const k = isi.getBoundingClientRect();
    hasil.push({
      ket: ket.split(" · ")[0],
      fw: +(a.width / z).toFixed(2), fh: +(a.height / z).toFixed(2),
      kw: +(k.width / z).toFixed(2), kh: +(k.height / z).toFixed(2),
    });
  }
  return hasil;
});

let meleset = 0;
for (const r of out) {
  const dw = r.kw - r.fw, dh = r.kh - r.fh;
  const buruk = Math.abs(dw) > 1 || Math.abs(dh) > 1;
  if (buruk) meleset++;
  console.log(
    `${r.ket.slice(0, 52).padEnd(54)}${`${r.fw}x${r.fh}`.padEnd(13)}${`${r.kw}x${r.kh}`.padEnd(13)}` +
    `${dw >= 0 ? "+" : ""}${dw.toFixed(1)}  ${dh >= 0 ? "+" : ""}${dh.toFixed(1)}${buruk ? "  <<<" : ""}`);
}
console.log(`\nviewport ${LEBAR}  pasangan ${out.length}, meleset ${meleset}`);
await b.close();
