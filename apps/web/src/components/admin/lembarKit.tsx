import { useRef, type ReactNode } from "react";
import { Ikon, type DataIkon } from "../kit/Ikon";

/* =============================================================================
   Kerangka "lembar gambar kerja" — dipakai halaman Akun dan Info Studio.

   Selera pemilik (CLAUDE.md → "Selera pemilik"): kepala bersampul kertas
   kalkir, identitas besar yang menumpang di tepi sampul, tombol pintas, lalu
   tab bergaris bawah, satu panel per tab. Bagian yang SAMA di kedua halaman
   hidup di sini — sampul, panah utara, kop lembar, dan tab — supaya dua
   halaman itu tidak menyimpang (jebakan #32). Gambar di sampulnya milik
   tiap halaman: Akun denah, Info Studio tampak.

   Gayanya di `styles/lembar-kit.css`.
   ============================================================================= */

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

/**
 * Sampul kertas kalkir: kisi 12px dengan garis tebal tiap 48px, panah utara
 * di pojok kanan atas, dan kop lembar di pojok kanan bawah.
 *
 * Kop lembar WAJIB berisi data sungguhan (selera pemilik #3), bukan teks
 * karangan — ia satu-satunya bagian sampul yang dibaca, bukan dilihat.
 */
export function SampulLembar({ gambar, kop }: { gambar?: ReactNode; kop: SelKop[] }) {
  return (
    <div className="lbr-sampul">
      {gambar}
      <svg className="lbr-utara" viewBox="0 0 32 40" fill="none" aria-hidden="true">
        <circle cx={16} cy={24} r={13} />
        <path d="M16 9 L22 30 L16 26 L10 30 Z" />
        <text x={16} y={7}>U</text>
      </svg>
      <dl className="lbr-kop">
        {kop.map((k) => (
          <div key={k.label}>
            <dt>{k.label}</dt>
            <dd>{k.nilai}</dd>
          </div>
        ))}
      </dl>
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
 */
export function TabLembar<T extends string>({ tab, nilai, onPilih, label, awalan }: {
  tab: ButirTab<T>[];
  nilai: T;
  onPilih: (t: T) => void;
  label: string;
  awalan: string;
}) {
  const ref = useRef<(HTMLButtonElement | null)[]>([]);
  function tombol(e: React.KeyboardEvent, i: number) {
    const ke = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tab.length - 1 }[e.key];
    if (ke === undefined) return;
    e.preventDefault();
    const j = (ke + tab.length) % tab.length;
    onPilih(tab[j]!.nilai);
    ref.current[j]?.focus();
  }
  return (
    <div className="lbr-tabs" role="tablist" aria-label={label}>
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
