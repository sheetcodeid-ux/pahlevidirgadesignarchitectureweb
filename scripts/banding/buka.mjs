/* Membuka /admin/kit di Chromium dengan font yang sudah dibuktikan terpasang.
 * Dipakai bersama keempat alat ukur di folder ini. */
/* Playwright terpasang GLOBAL di mesin ini, bukan sebagai dependensi repo —
   jadi jalurnya disebut apa adanya. Chromium-nya juga sudah ada
   (PLAYWRIGHT_BROWSERS_PATH), jadi jangan pernah `playwright install`. */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { pasangFont, buktiFont } from "./font.mjs";

export const ALAMAT = process.env.KIT || "http://127.0.0.1:4399/admin/kit/";

export async function bukaKit({ lebar = 1400, skala = 1 } = {}) {
  const b = await chromium.launch();
  const p = await b.newPage({
    viewport: { width: lebar, height: 900 },
    deviceScaleFactor: skala,
  });
  await pasangFont(p);
  await p.goto(ALAMAT, { waitUntil: "networkidle" });
  await p.evaluate(() => {
    const e = document.getElementById("isi-kit");
    if (e) e.hidden = false;
    /* Bilah atas dan rel samping LENGKET, jadi keduanya ikut terpotret di
       atas kartu yang kebetulan ada di bawahnya. Disembunyikan selama
       pengukuran. */
    for (const sel of [".topbar", ".sidebar", ".adminfoot", ".guard"])
      document.querySelectorAll(sel).forEach((x) => (x.style.display = "none"));
  });
  await p.waitForSelector(".k-banding");
  await p.waitForFunction(() => document.fonts.status === "loaded");
  const bukti = await buktiFont(p);
  if (!bukti.terpasang) {
    await b.close();
    throw new Error(`Urbanist TIDAK terpasang (${JSON.stringify(bukti)}) — pengukuran tidak sah`);
  }
  return { b, p };
}
