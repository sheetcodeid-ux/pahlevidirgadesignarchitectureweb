import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Ikon, type DataIkon } from "../kit/Ikon";

/* =============================================================================
   Kerangka "lembar gambar kerja" — dipakai halaman Akun dan Info Studio.

   Selera pemilik (CLAUDE.md → "Selera pemilik"): kepala bersampul kertas
   kalkir, identitas besar yang menumpang di tepi sampul, tombol pintas, lalu
   tab bergaris bawah, satu panel per tab. Bagian yang SAMA di kedua halaman
   hidup di sini — sampul, kursor CAD, kop lembar, dan tab — supaya dua
   halaman itu tidak menyimpang (jebakan #32). Gambar di sampulnya milik
   tiap halaman: Akun denah, Info Studio tampak.

   Gayanya di `styles/lembar-kit.css`.
   ============================================================================= */

// useLayoutEffect di peramban, useEffect di server (lihat RequireAuth).
const useEfekTataLetak = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Lambang D studio — garis yang sama dengan tanda di kartu kas Dashboard. */
export function LambangStudio({ className, tebal = 3 }: { className?: string; tebal?: number }) {
  return (
    <svg className={className} viewBox="14 14 36 36" fill="none" aria-hidden="true">
      <path d="M21 17 V47 M21 17 H28 A15 15 0 0 1 28 47 H21" stroke="currentColor" strokeWidth={tebal} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Bulatan sumbu grid (A, B, 1, 2…) — lingkaran berisi huruf/angka. */
export function BulatSumbu({ x, y, teks }: { x: number; y: number; teks: string }) {
  return (
    <g className="lbr-bulat">
      <circle cx={x} cy={y} r={8.5} />
      <text x={x} y={y + 3.2}>{teks}</text>
    </g>
  );
}

export interface SelKop {
  label: string;
  nilai: ReactNode;
}

/** Koordinat kursor dalam milimeter gambar: 1px sampul = 25 mm, dihitung
 *  dari garis kisi pertama, jadi titik snap jatuh di kelipatan 1.200. */
const mm = (px: number) => Math.max(0, Math.round(px * 25)).toLocaleString("id-ID");
const KISI = 48;

/**
 * Sampul kertas kalkir: kisi 12px dengan garis tebal tiap 48px, bingkai
 * tepi kertas, kop lembar di pojok kanan bawah, dan KURSOR CAD — garis
 * silang yang mengikuti tetikus, dengan pembacaan koordinat X/Y dan snap ke
 * perpotongan kisi besar, seperti di program gambar.
 *
 * Kursornya hanya untuk tetikus (jebakan #9) dan tidak menggambar ulang
 * React: tiap gerakan cuma menulis dua variabel CSS dan satu teks, kotak
 * sampul dibaca SEKALI saat kursor masuk (jebakan #21).
 *
 * Kop lembar WAJIB berisi data sungguhan (selera pemilik #3), bukan teks
 * karangan — ia satu-satunya bagian sampul yang dibaca, bukan dilihat.
 */
export function SampulLembar({ gambar, kop, judul }: { gambar?: ReactNode; kop: SelKop[]; judul: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const baca = useRef<HTMLSpanElement>(null);
  const kotak = useRef<DOMRect | null>(null);

  function gerak(e: React.PointerEvent<HTMLDivElement>) {
    const r = kotak.current;
    const el = ref.current;
    if (e.pointerType !== "mouse" || !r || !el) return;
    let x = e.clientX - r.left;
    let y = e.clientY - r.top;
    const gx = Math.round((x + 1) / KISI) * KISI - 1;
    const gy = Math.round((y + 1) / KISI) * KISI - 1;
    const snap = Math.abs(x - gx) < 7 && Math.abs(y - gy) < 7;
    if (snap) {
      x = gx;
      y = gy;
    }
    el.style.setProperty("--cx", `${x}px`);
    el.style.setProperty("--cy", `${y}px`);
    el.toggleAttribute("data-snap", snap);
    el.toggleAttribute("data-kiri", x > r.width - 170);
    el.toggleAttribute("data-atas", y > r.height - 34);
    if (baca.current) baca.current.textContent = `X ${mm(x + 1)}   Y ${mm(r.height - 1 - y)}`;
  }

  return (
    <div
      ref={ref}
      className="lbr-sampul"
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        kotak.current = e.currentTarget.getBoundingClientRect();
        e.currentTarget.setAttribute("data-cad", "");
        gerak(e);
      }}
      onPointerMove={gerak}
      onPointerLeave={(e) => {
        kotak.current = null;
        e.currentTarget.removeAttribute("data-cad");
      }}
    >
      {gambar}
      <span className="lbr-cad" aria-hidden="true">
        <i className="lbr-cad__h" />
        <i className="lbr-cad__v" />
        <i className="lbr-cad__kotak" />
        <span className="lbr-cad__baca" ref={baca} />
      </span>
      <div className="lbr-kop">
        <p className="lbr-kopjudul">
          <span>Lembar</span>
          <b>{judul}</b>
          <svg className="lbr-utara" viewBox="0 0 32 40" fill="none" aria-label="Utara" role="img">
            <circle cx={16} cy={24} r={13} />
            <path d="M16 9 L22 30 L16 26 L10 30 Z" />
            <text x={16} y={7}>U</text>
          </svg>
        </p>
        <dl className="lbr-kopsel">
          {kop.map((k) => (
            <div key={k.label}>
              <dt>{k.label}</dt>
              <dd>{k.nilai}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export interface ButirTab<T extends string> {
  nilai: T;
  label: string;
  ikon: DataIkon;
  /** Angka kecil di kanan label (jumlah sesi, isian wajib yang kosong). */
  angka?: number | null;
  /** "awas" = amber: ada yang perlu diisi di tab ini (aturan warna #1). */
  nada?: "netral" | "awas";
}

/**
 * Tab bergaris bawah dengan pola tab ARIA lengkap: panah kiri/kanan, Home,
 * End; hanya tab terpilih yang ada di urutan Tab. Panel yang dikendalikan
 * ber-id `${awalan}-panel`, tiap tab ber-id `${awalan}-tab-${nilai}`.
 *
 * Garis bawahnya SATU elemen yang meluncur ke tab terpilih. Sebelum diukur
 * (render server, hidrasi) tiap tab terpilih menggambar garisnya sendiri,
 * jadi tidak pernah ada saat tanpa garis; luncurannya baru hidup sesudah
 * pengukuran pertama, supaya garis tidak terbang dari kiri saat halaman
 * dibuka.
 */
export function TabLembar<T extends string>({ tab, nilai, onPilih, label, awalan }: {
  tab: ButirTab<T>[];
  nilai: T;
  onPilih: (t: T) => void;
  label: string;
  awalan: string;
}) {
  const ref = useRef<(HTMLButtonElement | null)[]>([]);
  const jalur = useRef<HTMLDivElement>(null);
  const [garis, setGaris] = useState<{ x: number; w: number } | null>(null);
  const [hidup, setHidup] = useState(false);
  const indeks = tab.findIndex((t) => t.nilai === nilai);

  useEfekTataLetak(() => {
    const ukur = () => {
      const el = ref.current[indeks];
      if (el) setGaris({ x: el.offsetLeft + 10, w: el.offsetWidth - 20 });
    };
    ukur();
    // Tiap tombol diamati, bukan jalurnya saja: angka yang muncul sesudah
    // data tiba (jumlah sesi) melebarkan tab tanpa mengubah lebar jalur.
    const ro = new ResizeObserver(ukur);
    if (jalur.current) ro.observe(jalur.current);
    ref.current.forEach((b) => b && ro.observe(b));
    return () => ro.disconnect();
  }, [indeks]);
  useEffect(() => {
    if (garis && !hidup) requestAnimationFrame(() => setHidup(true));
  }, [garis, hidup]);

  function tombol(e: React.KeyboardEvent, i: number) {
    const ke = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tab.length - 1 }[e.key];
    if (ke === undefined) return;
    e.preventDefault();
    const j = (ke + tab.length) % tab.length;
    onPilih(tab[j]!.nilai);
    ref.current[j]?.focus();
  }
  return (
    <div
      ref={jalur}
      className="lbr-tabs"
      role="tablist"
      aria-label={label}
      data-garis={garis ? (hidup ? "hidup" : "diam") : undefined}
    >
      {tab.map((t, i) => (
        <button
          key={t.nilai}
          ref={(el) => { ref.current[i] = el; }}
          type="button"
          role="tab"
          id={`${awalan}-tab-${t.nilai}`}
          aria-controls={`${awalan}-panel`}
          aria-selected={nilai === t.nilai}
          tabIndex={nilai === t.nilai ? 0 : -1}
          className="lbr-tabb"
          onClick={() => onPilih(t.nilai)}
          onKeyDown={(e) => tombol(e, i)}
        >
          <Ikon ikon={t.ikon} ukuran={16} />
          <span>{t.label}</span>
          {t.angka !== undefined && t.angka !== null && (
            <span className={`lbr-tabangka${t.nada === "awas" ? " lbr-tabangka--awas" : ""}`}>{t.angka}</span>
          )}
        </button>
      ))}
      {garis && <span className="lbr-tabgaris" aria-hidden="true" style={{ transform: `translateX(${garis.x}px)`, width: garis.w }} />}
    </div>
  );
}

/** Tab yang terbuka disimpan di alamat (#nama), supaya tautan dan tombol
 *  Kembali membawa ke tempat yang sama. Tab pertama = tanpa hash. */
export function tabDariAlamat<T extends string>(semua: readonly T[]): T {
  const h = location.hash.slice(1);
  return (semua as readonly string[]).includes(h) ? (h as T) : semua[0]!;
}

export function tulisTabKeAlamat<T extends string>(t: T, pertama: T) {
  // replaceState, bukan location.hash: tidak menggulir ke elemen ber-id
  // yang kebetulan bernama sama, dan tidak menumpuk riwayat per klik tab.
  history.replaceState(history.state, "", t === pertama ? location.pathname + location.search : `#${t}`);
}
