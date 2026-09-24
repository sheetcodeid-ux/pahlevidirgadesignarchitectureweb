/* Berapa persen pikselnya berbeda?
 *
 *     node scripts/banding/tumpuk.mjs
 *
 * Acuan dan kit DIPOTRET TERPISAH lalu diselisihkan di canvas — bukan
 * ditumpuk dengan mix-blend-mode. Sebabnya: di area transparan "difference"
 * tidak membatalkan apa pun, jadi tombol berlatar terang terbaca 100%
 * berbeda padahal cuma latarnya yang tidak tertimpa.
 */
import { bukaKit } from "./buka.mjs";

const { b, p } = await bukaKit({ skala: 4 });
const kartu = await p.$$(".k-banding");
const hasil = [];
for (const k of kartu) {
  if (await k.evaluate((e) => e.hasAttribute("data-tanpa-kotak"))) continue;
  const ket = ((await k.$eval(".k-banding__ket", (e) => e.textContent)) || "").split(" · ")[0];
  const a = await k.$(".k-banding__figma"), c = await k.$(".k-banding__kit");
  if (!a || !c) continue;
  const pa = (await a.screenshot()).toString("base64");
  const pc = (await c.screenshot()).toString("base64");
  const persen = await p.evaluate(async ([x, y]) => {
    const muat = async (b64) => {
      const i = new Image(); i.src = "data:image/png;base64," + b64; await i.decode();
      const cv = document.createElement("canvas");
      cv.width = i.width; cv.height = i.height;
      const g = cv.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(i, 0, 0);
      return { d: g.getImageData(0, 0, cv.width, cv.height), w: cv.width, h: cv.height };
    };
    const A = await muat(x), B = await muat(y);
    const w = Math.min(A.w, B.w), h = Math.min(A.h, B.h);
    let n = 0;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const ia = (yy * A.w + xx) * 4, ib = (yy * B.w + xx) * 4;
      if (Math.abs(A.d.data[ia] - B.d.data[ib]) > 40 ||
          Math.abs(A.d.data[ia + 1] - B.d.data[ib + 1]) > 40 ||
          Math.abs(A.d.data[ia + 2] - B.d.data[ib + 2]) > 40) n++;
    }
    return (n / (w * h)) * 100;
  }, [pa, pc]);
  hasil.push({ ket, persen });
}
hasil.sort((a, c) => c.persen - a.persen);
for (const r of hasil) {
  console.log(`${r.ket.slice(0, 54).padEnd(56)}${r.persen.toFixed(2)}%${r.persen > 3 ? "  <<<" : ""}`);
}
const med = hasil.length ? hasil[Math.floor(hasil.length / 2)].persen : 0;
console.log(`\npasangan ${hasil.length}, beda >3%: ${hasil.filter((r) => r.persen > 3).length}, median ${med.toFixed(2)}%`);
await b.close();
