import { useEffect, useRef, useState, type ReactNode } from "react";
import { ACUAN } from "./banding/figma";

/** rgb(30, 72, 65) -> #1E4841. Warna transparan dibuang. */
function keHeks(v: string): string | null {
  const m = v.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (!m) return null;
  if (m[4] !== undefined && Number(m[4]) === 0) return null;
  return (
    "#" +
    [m[1], m[2], m[3]]
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

/**
 * Dua warna dianggap sama kalau tiap kanalnya beda paling banyak 6.
 *
 * Coinest sendiri memakai beberapa pasangan yang nyaris kembar — #FFFFFF
 * lawan #FBFBFC, #EFF0F0 lawan #EEEEEF, #242E2C lawan #272932 — dan
 * memperlakukan itu sebagai cacat berarti menambah token kembar yang
 * kemudian dipakai serampangan. Beda 6 per kanal tidak bisa dilihat mata,
 * dan seluruh pasangan kembar di atas berada di bawahnya.
 */
function dekat(a: string, b: string): boolean {
  const pecah = (v: string) =>
    [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
  if (a.length !== 7 || b.length !== 7) return a === b;
  const x = pecah(a), y = pecah(b);
  return x.every((n, i) => Math.abs(n - y[i]) <= 6);
}

/**
 * Warna yang BENAR-BENAR tergambar oleh sebuah komponen.
 *
 * Dibaca dari getComputedStyle, bukan dari CSS-nya: token bisa saja menunjuk
 * nilai lain daripada yang dikira, dan itu justru yang perlu ketahuan.
 * Border diabaikan kalau lebarnya nol — border-color tetap punya nilai
 * walaupun tidak ada garis yang tergambar.
 */
function warnaTergambar(akar: HTMLElement): string[] {
  const keluar = new Set<string>();
  const kunjung = (el: Element) => {
    const g = getComputedStyle(el);
    const latar = keHeks(g.backgroundColor);
    if (latar) keluar.add(latar);
    const tinta = keHeks(g.color);
    if (tinta && (el.textContent || "").trim()) keluar.add(tinta);
    // Teks contoh di kotak isian hidup sebagai placeholder, bukan textContent,
    // jadi warnanya tidak akan pernah terbaca dari induknya.
    if (el instanceof HTMLInputElement && el.placeholder) {
      const ph = keHeks(getComputedStyle(el, "::placeholder").color);
      if (ph) keluar.add(ph);
    }
    /* KEEMPAT sisi, bukan cuma atas. Baris daftar di frame Item cuma punya
       garis BAWAH, jadi membaca borderTopColor saja melaporkan setiap satu
       dari mereka kekurangan warna garisnya — padahal garisnya tergambar.
       Alat ukur yang salah membuat komponen yang benar terbaca cacat, dan
       itu sudah tiga kali terjadi di sesi ini. */
    for (const sisi of ["Top", "Right", "Bottom", "Left"] as const) {
      if (parseFloat(g[`border${sisi}Width`]) > 0) {
        const garis = keHeks(g[`border${sisi}Color`]);
        if (garis) keluar.add(garis);
      }
    }
    if (el instanceof SVGElement && el.tagName === "svg" && tinta) keluar.add(tinta);
    /* Bentuk SVG diwarnai lewat `fill`, bukan background atau color. Tanpa
       membacanya, lingkaran dan path berwarna tidak pernah terhitung dan
       dilaporkan sebagai warna yang hilang. */
    if (el instanceof SVGElement) {
      const isi = keHeks(g.fill);
      if (isi) keluar.add(isi);
      /* `stroke` juga. Garis kurva grafik area diwarnai lewat stroke, dan
         tanpa membacanya audit melaporkan warna garisnya "tidak ada di kit"
         pada grafik yang sudah benar — sama persis dengan cacat alat yang
         sebelumnya cuma membaca borderTopColor. */
      if (parseFloat(g.strokeWidth) > 0) {
        const garis = keHeks(g.stroke);
        if (garis) keluar.add(garis);
      }
    }
    /* Centang dan tuas sakelar digambar sebagai pseudo-elemen, jadi warnanya
       tidak akan pernah terbaca dari elemennya sendiri. Tanpa ini, komponen
       yang SUDAH benar tetap dilaporkan kekurangan warna. */
    for (const semu of ["::before", "::after"]) {
      const q = getComputedStyle(el, semu);
      if (q.content === "none") continue;
      const bg = keHeks(q.backgroundColor);
      if (bg) keluar.add(bg);
      for (const sisi of ["borderLeftColor", "borderBottomColor"] as const) {
        const lebar = parseFloat(q[sisi.replace("Color", "Width") as "borderLeftWidth"]);
        if (lebar > 0) {
          const c = keHeks(q[sisi]);
          if (c) keluar.add(c);
        }
      }
    }
    for (const c of el.children) kunjung(c);
  };
  kunjung(akar);
  return [...keluar];
}

/* =============================================================================
   Banding — komponen buatan sendiri ditempel BERSEBELAHAN dengan potongan
   frame Figma-nya, pada perbesaran yang sama.

   Kenapa ada: mencocokkan angka yang saya ekstrak sendiri tidak membuktikan
   apa-apa kalau ekstraksinya yang salah. Itu sudah terjadi sekali — 145 ikon
   terpotong lolos pemeriksaan angka karena bingkainya saya kira 24 padahal
   32. Yang menemukannya gambar sumbernya, ditempel berdampingan.

   Acuan Figma di atas, buatan sendiri di bawah, tepi kiri dan atas dirapatkan.
   Garis putus-putus menandai tepi KANAN dan BAWAH milik Figma, jadi selisih
   ukuran sebesar satu piksel pun kelihatan pada perbesaran 3x.

   Teks di acuan Figma berbahasa Inggris dan sudah jadi outline — itu memang
   isinya, bukan kesalahan. Yang dibandingkan kotaknya, warnanya, radiusnya,
   dan letak ikonnya.
   ============================================================================= */

export interface PropBanding {
  kunci: keyof typeof ACUAN | string;
  children: ReactNode;
  /** Perbesaran. 3 cukup untuk melihat selisih satu piksel. */
  zoom?: number;
  catatan?: string;
  /**
   * Acuan Figma-nya tidak punya kotak — yang terukur cuma tinta ikon dan
   * teksnya. Lebarnya karena itu TIDAK sah dibandingkan: isi teks contoh
   * Coinest sudah jadi outline sehingga tidak terbaca, jadi selisihnya cuma
   * bercerita tentang kata yang berbeda. Yang tetap sah: ukuran huruf,
   * warna, dan jaraknya.
   */
  tanpaKotak?: boolean;
}

export function Banding({ kunci, children, zoom = 3, catatan, tanpaKotak }: PropBanding) {
  const acuan = ACUAN[kunci];
  const kotakKit = useRef<HTMLDivElement>(null);
  const [warnaKit, setWarnaKit] = useState<string[]>([]);

  useEffect(() => {
    if (kotakKit.current) setWarnaKit(warnaTergambar(kotakKit.current));
  }, [kunci]);
  if (!acuan) {
    return (
      <div className="k-banding k-banding--hilang">
        Acuan Figma <code>{kunci}</code> tidak ada — jalankan{" "}
        <code>python3 scripts/buat-banding.py</code>.
      </div>
    );
  }
  const w = acuan.w * zoom;
  const h = acuan.h * zoom;
  return (
    <figure
      className="k-banding"
      data-tanpa-kotak={tanpaKotak ? "" : undefined}
      style={{ "--k-banding-zoom": zoom } as React.CSSProperties}
    >
      <div className="k-banding__baris">
        <span className="k-banding__tanda">Figma</span>
        <div
          className="k-banding__figma"
          style={{ width: w, height: h }}
          dangerouslySetInnerHTML={{
            __html: acuan.svg.replace(
              /^<svg([^>]*?)width="[^"]*" height="[^"]*"/,
              `<svg$1width="${w}" height="${h}"`,
            ),
          }}
        />
      </div>
      <div className="k-banding__baris">
        <span className="k-banding__tanda">Kit</span>
        {/* Kotak pembatas seukuran acuan Figma; isinya diperbesar dari sudut
            kiri-atas supaya tepi kiri dan atasnya berimpit dengan acuan. */}
        <div className="k-banding__kit" style={{ width: w, height: h }}>
          <div className="k-banding__skala" ref={kotakKit}>
            {children}
          </div>
        </div>
      </div>
      <div className="k-banding__warna">
        <Petak judul="Figma" warna={acuan.warna} />
        <Petak
          judul="Kit"
          warna={warnaKit}
          kurang={acuan.warna.filter((c) => !warnaKit.some((k) => dekat(k, c)))}
        />
      </div>
      <figcaption className="k-banding__ket">
        {acuan.layer} · {acuan.w}x{acuan.h}
        {catatan ? ` · ${catatan}` : ""}
      </figcaption>
    </figure>
  );
}

function Petak({ judul, warna, kurang }: { judul: string; warna: readonly string[]; kurang?: readonly string[] }) {
  return (
    <div className="k-banding__baris">
      <span className="k-banding__tanda">{judul}</span>
      <div className="k-banding__petak">
        {warna.map((c) => (
          <span key={c} title={c}>
            <i style={{ background: c }} />
            {c}
          </span>
        ))}
        {kurang?.map((c) => (
          <span key={`kurang-${c}`} className="is-kurang" title={`Tidak ada di kit: ${c}`}>
            <i style={{ background: c }} />
            {c} tidak ada
          </span>
        ))}
      </div>
    </div>
  );
}
