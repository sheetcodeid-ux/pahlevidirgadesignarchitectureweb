/* Di baris piksel MANA isinya tergambar?
 *
 *     PILIH="^Item / Variant=V2$" node scripts/banding/baris.mjs
 *
 * `selisih.mjs` membandingkan KOTAK, dan kotak DOM sebuah teks memuat ruang
 * baris di atas dan di bawah hurufnya sementara ekspor Figma dipotong tepat
 * pada tintanya. Untuk komponen yang tepi atas/bawahnya teks, selisih kotak
 * karena itu selalu melaporkan +1..+4px yang bukan cacat tata letak.
 *
 * Yang dibandingkan di sini pita tinta per baris: dari baris piksel berapa
 * sampai berapa ada sesuatu yang tergambar, di acuan dan di kit. Itu yang
 * menjawab "barisnya turun 2px" atau "jarak antar-barisnya 0,3 lebih lebar".
 */
import { bukaKit } from "./buka.mjs";

const RE = new RegExp(process.env.PILIH || ".");
const SUMBU = (process.env.SUMBU || "y").toLowerCase(); // y = pita mendatar, x = pita tegak
const { b, p } = await bukaKit({ skala: 4 });

for (const k of await p.$$(".k-banding")) {
  const ket = ((await k.$eval(".k-banding__ket", (e) => e.textContent)) || "").split(" · ")[0];
  if (!RE.test(ket)) continue;
  const a = await k.$(".k-banding__figma"), c = await k.$(".k-banding__kit");
  if (!a || !c) continue;
  const z = await k.evaluate((e) => parseFloat(getComputedStyle(e).getPropertyValue("--k-banding-zoom")) || 1);
  const pa = (await a.screenshot()).toString("base64");
  const pc = (await c.screenshot()).toString("base64");
  const r = await p.evaluate(async ([A, C, sumbu]) => {
    const pita = async (b64) => {
      const i = new Image(); i.src = "data:image/png;base64," + b64; await i.decode();
      const cv = document.createElement("canvas"); cv.width = i.width; cv.height = i.height;
      const g = cv.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(i, 0, 0);
      const d = g.getImageData(0, 0, i.width, i.height).data;
      const M = 6; // lewati garis putus tepi sel banding
      const isi = [];
      const N = sumbu === "x" ? i.width : i.height;
      const P = sumbu === "x" ? i.height : i.width;
      for (let u = 0; u < N; u++) {
        let ada = false;
        for (let v = M; v < P - M && !ada; v++) {
          if (u < M || u >= N - M) break;
          const px = sumbu === "x" ? u : v, py = sumbu === "x" ? v : u;
          const o = (py * i.width + px) * 4;
          if (d[o] < 247 || d[o + 1] < 247 || d[o + 2] < 247) ada = true;
        }
        isi.push(ada);
      }
      const pitaList = [];
      let mulai = -1;
      for (let u = 0; u <= isi.length; u++) {
        if (isi[u] && mulai < 0) mulai = u;
        else if (!isi[u] && mulai >= 0) { pitaList.push([mulai, u]); mulai = -1; }
      }
      return pitaList;
    };
    return { a: await pita(A), c: await pita(C) };
  }, [pa, pc, SUMBU]);
  const S = 4 * z;
  const f = (l) => l.map(([m, n]) => `${(m / S).toFixed(2)}..${(n / S).toFixed(2)}`).join("  ");
  console.log(`\n${ket}   (sumbu ${SUMBU}, zoom ${z})`);
  console.log(`  figma  ${f(r.a)}`);
  console.log(`  kit    ${f(r.c)}`);
}
await b.close();
