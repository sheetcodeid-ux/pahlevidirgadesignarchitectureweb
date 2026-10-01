import * as RScroll from "@radix-ui/react-scroll-area";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { Ikon, type DataIkon } from "./Ikon";
import { ArrowDown, CaretDown, CaretLeft, CaretRight, CheckCircle, Info, SpecialWarning, SpinnerGap, WarningOctagon } from "./ikon";

/* =============================================================================
   Tampilan kit — komponen yang menampilkan, bukan menerima isian.

   Satu aturan yang berlaku di seluruh berkas: TIDAK ADA animasi tak berujung
   kecuali Putar (spinner), dan Putar hanya ada selama sesuatu memang sedang
   berjalan. Rangka (skeleton) diam — denyut abu yang tidak pernah berhenti
   di sepuluh baris sekaligus adalah kerja GPU tanpa informasi apa pun.
   ============================================================================= */

const kelas = (...k: (string | false | undefined | null)[]) => k.filter(Boolean).join(" ");

/* --- Peringatan (Alert) -------------------------------------------------------
   Warna menurut aturan #1: biru = penjelasan, hijau = berhasil, amber =
   terbatas/perlu perhatian, merah = gagal atau berbahaya. Ikonnya ikut nada,
   jadi maknanya tidak cuma dibawa warna. */

export type NadaPeringatan = "info" | "sukses" | "awas" | "bahaya";
const IKON_NADA: Record<NadaPeringatan, DataIkon> = { info: Info, sukses: CheckCircle, awas: SpecialWarning, bahaya: WarningOctagon };

export function Peringatan({
  nada = "info",
  judul,
  children,
  aksi,
}: {
  nada?: NadaPeringatan;
  judul?: string;
  children?: ReactNode;
  aksi?: ReactNode;
}) {
  return (
    <div className={`k-peringatan k-peringatan--${nada}`} role={nada === "bahaya" ? "alert" : "status"}>
      <Ikon ikon={IKON_NADA[nada]} ukuran={18} className="k-peringatan__ikon" />
      <div className="k-peringatan__teks">
        {judul && <b>{judul}</b>}
        {children && <div>{children}</div>}
      </div>
      {aksi && <div className="k-peringatan__aksi">{aksi}</div>}
    </div>
  );
}

/* --- Kosong (Empty) ---------------------------------------------------------
   Keadaan kosong menjawab dua hal: kenapa kosong, dan apa langkah berikutnya.
   Tombolnya opsional — daftar yang kosong karena saringan tidak perlu tombol
   "tambah", ia perlu "hapus saringan". */

export function Kosong({
  ikon,
  judul,
  children,
  aksi,
  ringkas = false,
}: {
  ikon: DataIkon;
  judul: ReactNode;
  children?: ReactNode;
  aksi?: ReactNode;
  ringkas?: boolean;
}) {
  return (
    <div className={kelas("k-kosong", ringkas && "k-kosong--ringkas")}>
      <span className="k-kosong__ubin" aria-hidden="true">
        <Ikon ikon={ikon} ukuran={ringkas ? 18 : 22} />
      </span>
      <b className="k-kosong__judul">{judul}</b>
      {children && <p className="k-kosong__ket">{children}</p>}
      {aksi && <div className="k-kosong__aksi">{aksi}</div>}
    </div>
  );
}

/* --- Rangka (Skeleton) ------------------------------------------------------- */

export function Rangka({
  lebar = "100%",
  tinggi = 12,
  bulat = false,
  className,
}: {
  lebar?: number | string;
  tinggi?: number | string;
  bulat?: boolean;
  className?: string;
}) {
  return <span className={kelas("k-rangka", bulat && "k-rangka--bulat", className)} style={{ width: lebar, height: tinggi }} aria-hidden="true" />;
}

/** Baris-baris rangka seukuran daftar yang sedang dimuat. */
export function RangkaBaris({ jumlah = 3, label = "Memuat…" }: { jumlah?: number; label?: string }) {
  return (
    <div className="k-rangkabaris" role="status" aria-label={label}>
      {Array.from({ length: jumlah }, (_, i) => (
        <div key={i} className="k-rangkabaris__baris">
          <Rangka lebar={36} tinggi={36} bulat />
          <div className="k-rangkabaris__teks">
            <Rangka lebar={`${62 - (i % 3) * 12}%`} tinggi={11} />
            <Rangka lebar={`${38 + (i % 2) * 14}%`} tinggi={9} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* --- Putar (Spinner) --------------------------------------------------------- */

export function Putar({ ukuran = 16, label = "Memuat" }: { ukuran?: number; label?: string }) {
  return (
    <span className="k-putar" role="status" aria-label={label}>
      <Ikon ikon={SpinnerGap} ukuran={ukuran} />
    </span>
  );
}

/* --- Rasio (Aspect Ratio) -----------------------------------------------------
   `aspect-ratio`, bukan trik padding — dan bukan `flex: 1` (jebakan #3). */

export function Rasio({ rasio = 16 / 9, children, className }: { rasio?: number; children: ReactNode; className?: string }) {
  return (
    <div className={kelas("k-rasio", className)} style={{ aspectRatio: String(rasio) }}>
      {children}
    </div>
  );
}

/* --- Avatar ---------------------------------------------------------------------
   Gambar kalau ada; kalau tidak (atau gagal dimuat), inisial di atas warna
   yang DITURUNKAN dari namanya — orang yang sama selalu berwarna sama di
   seluruh panel, tanpa disimpan di mana pun. */

const WARNA_AVATAR = 5;
function indeksWarna(nama: string) {
  let h = 0;
  for (const c of nama) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % WARNA_AVATAR;
}
export function inisialNama(nama: string) {
  return (
    nama
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((k) => k[0]!.toUpperCase())
      .join("") || "?"
  );
}

export function Avatar({
  nama,
  src,
  ukuran = "md",
  status,
  inisial,
  hiasan = false,
  className,
}: {
  nama: string;
  src?: string | null;
  ukuran?: "sm" | "md" | "lg";
  /** Titik keadaan di sudut: hijau = aktif (aturan warna #1). */
  status?: "aktif" | "diam";
  /** Inisial yang sudah dihitung pemanggil (mis. tanpa "Bu"/"Pak"). */
  inisial?: string;
  /** Nama sudah tertulis di sebelahnya — avatar tidak perlu dibacakan lagi. */
  hiasan?: boolean;
  className?: string;
}) {
  const [gagal, setGagal] = useState(false);
  return (
    <span
      className={kelas(`k-avatar k-avatar--${ukuran} k-avatar--w${indeksWarna(nama)}`, className)}
      aria-hidden={hiasan || undefined}
    >
      {src && !gagal ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setGagal(true)} />
      ) : (
        <span aria-hidden="true">{inisial || inisialNama(nama)}</span>
      )}
      {!hiasan && <span className="sr-only">{nama}</span>}
      {status && <span className={`k-avatar__status k-avatar__status--${status}`} aria-label={status === "aktif" ? "Aktif" : "Tidak aktif"} />}
    </span>
  );
}

export function TumpukAvatar({ nama, maks = 4 }: { nama: string[]; maks?: number }) {
  const tampil = nama.slice(0, maks);
  const sisa = nama.length - tampil.length;
  return (
    <span className="k-tumpuk" aria-label={nama.join(", ")}>
      {tampil.map((n) => (
        <Avatar key={n} nama={n} ukuran="sm" />
      ))}
      {sisa > 0 && <span className="k-avatar k-avatar--sm k-tumpuk__sisa">+{sisa}</span>}
    </span>
  );
}

/* --- Tuts (Kbd) -------------------------------------------------------------- */

export function Tuts({ children }: { children: ReactNode }) {
  return <kbd className="k-tuts">{children}</kbd>;
}

/* --- Penanda (Marker) ---------------------------------------------------------
   Stabilo pada teks — untuk kata yang cocok dengan pencarian, atau angka yang
   berubah. <mark> asli, jadi pembaca layar ikut mengumumkannya. */

export function Penanda({ children, nada = "mint" }: { children: ReactNode; nada?: "mint" | "amber" }) {
  return <mark className={`k-penanda k-penanda--${nada}`}>{children}</mark>;
}

/** Menandai setiap kemunculan `cari` di dalam `teks` (tanpa peka huruf besar). */
export function SorotTeks({ teks, cari }: { teks: string; cari: string }) {
  const q = cari.trim();
  if (!q) return <>{teks}</>;
  const pola = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  return (
    <>
      {teks.split(pola).map((p, i) => (i % 2 ? <Penanda key={i}>{p}</Penanda> : p))}
    </>
  );
}

/* --- Pemisah (Separator) ---------------------------------------------------- */

export function Pemisah({ arah = "datar", label, className }: { arah?: "datar" | "tegak"; label?: string; className?: string }) {
  if (label)
    return (
      <div className={kelas("k-pemisah k-pemisah--label", className)} role="separator">
        <span>{label}</span>
      </div>
    );
  return <div className={kelas(`k-pemisah k-pemisah--${arah}`, className)} role="separator" aria-orientation={arah === "tegak" ? "vertical" : "horizontal"} />;
}

/* --- Tipografi -----------------------------------------------------------------
   Tangga huruf kit dalam satu tempat. Halaman memakai kelasnya langsung;
   komponen ini untuk tempat yang tidak punya kelas sendiri. */

type Tingkat = "judul1" | "judul2" | "judul3" | "badan" | "kecil" | "label" | "angka";
const TAG: Record<Tingkat, keyof HTMLElementTagNameMap> = {
  judul1: "h1",
  judul2: "h2",
  judul3: "h3",
  badan: "p",
  kecil: "p",
  label: "span",
  angka: "span",
};

export function Teks({
  tingkat = "badan",
  as,
  muted,
  children,
  className,
  ...p
}: HTMLAttributes<HTMLElement> & { tingkat?: Tingkat; as?: keyof HTMLElementTagNameMap; muted?: boolean }) {
  const Tag = (as ?? TAG[tingkat]) as "p";
  return (
    <Tag className={kelas(`k-teks k-teks--${tingkat}`, muted && "k-teks--muted", className)} {...p}>
      {children}
    </Tag>
  );
}

/* --- Butir (Item) ---------------------------------------------------------------
   Satu baris "media — judul & keterangan — aksi". Bentuk umum dari
   BarisTransfer/BarisInbox dkk.; dipakai untuk daftar yang tidak punya frame
   sendiri. Kalau `href` diisi, seluruh butir jadi tautan. */

export function Butir({
  media,
  judul,
  ket,
  kanan,
  href,
  onClick,
  aktif,
}: {
  media?: ReactNode;
  judul: ReactNode;
  ket?: ReactNode;
  kanan?: ReactNode;
  href?: string;
  onClick?: () => void;
  aktif?: boolean;
}) {
  const isi = (
    <>
      {media && <span className="k-butir__media">{media}</span>}
      <span className="k-butir__teks">
        <span className="k-butir__judul">{judul}</span>
        {ket && <span className="k-butir__ket">{ket}</span>}
      </span>
      {kanan && <span className="k-butir__kanan">{kanan}</span>}
    </>
  );
  const k = kelas("k-butir", (href || onClick) && "k-butir--aksi", aktif && "is-aktif");
  if (href)
    return (
      <a className={k} href={href} aria-current={aktif ? "page" : undefined}>
        {isi}
      </a>
    );
  if (onClick)
    return (
      <button type="button" className={k} onClick={onClick} aria-pressed={aktif}>
        {isi}
      </button>
    );
  return <div className={k}>{isi}</div>;
}

/* --- Lipat (Collapsible) — <details> asli ------------------------------------- */

export function Lipat({
  judul,
  children,
  buka,
  ket,
}: {
  judul: ReactNode;
  children: ReactNode;
  buka?: boolean;
  ket?: ReactNode;
}) {
  return (
    <details className="k-lipat" open={buka}>
      <summary className="k-lipat__kepala">
        <span className="k-lipat__judul">{judul}</span>
        {ket && <span className="k-lipat__ket">{ket}</span>}
        <Ikon ikon={CaretDown} ukuran={14} className="k-lipat__caret" />
      </summary>
      <div className="k-lipat__isi">{children}</div>
    </details>
  );
}

/* --- Area Gulir (Scroll Area) ------------------------------------------------
   Batang gulir tipis yang sama di semua sistem operasi. Di Windows batang
   klasik 17px memakan lebar isi; di sini ia melayang di atas isi. */

export function AreaGulir({
  tinggi,
  tinggiMaks,
  children,
  className,
}: {
  /** Tinggi tetap. */
  tinggi?: number | string;
  /** Atau tinggi MAKSIMUM: wadah mengikuti isinya sampai batas ini, baru bergulir. */
  tinggiMaks?: number | string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RScroll.Root
      className={kelas("k-gulir", tinggiMaks !== undefined && "k-gulir--maks", className)}
      type="hover"
      style={{ height: tinggi, maxHeight: tinggiMaks }}
    >
      <RScroll.Viewport className="k-gulir__viewport">{children}</RScroll.Viewport>
      <RScroll.Scrollbar className="k-gulir__batang" orientation="vertical">
        <RScroll.Thumb className="k-gulir__jempol" />
      </RScroll.Scrollbar>
    </RScroll.Root>
  );
}

/* --- Gulir Pesan (Message Scroller) ---------------------------------------------
   Daftar percakapan yang menempel di BAWAH: pesan baru menggeser ke bawah
   hanya kalau pembaca memang sedang di bawah. Kalau ia sedang membaca yang
   lama, muncul tombol "Pesan baru" alih-alih merenggut posisinya.

   Posisi dibaca dari peristiwa gulir (scrollTop — sudah dipegang peramban),
   bukan dari geometri di tiap frame (jebakan #21). */

export function GulirPesan({ children, tinggi = 360, jumlah }: { children: ReactNode; tinggi?: number | string; jumlah: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const diBawah = useRef(true);
  const [ada, setAda] = useState(false);
  const jumlahLalu = useRef(jumlah);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (jumlah > jumlahLalu.current && !diBawah.current) setAda(true);
    else el.scrollTop = el.scrollHeight;
    jumlahLalu.current = jumlah;
  }, [jumlah]);

  return (
    <div className="k-gulirpesan" style={{ height: tinggi }}>
      <div
        ref={ref}
        className="k-gulirpesan__isi"
        role="log"
        aria-live="polite"
        onScroll={(e) => {
          const el = e.currentTarget;
          diBawah.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          if (diBawah.current) setAda(false);
        }}
      >
        {children}
      </div>
      {ada && (
        <button
          type="button"
          className="k-tombol k-tombol--small k-tombol--primary k-gulirpesan__baru"
          onClick={() => {
            const el = ref.current;
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            setAda(false);
          }}
        >
          <Ikon ikon={ArrowDown} ukuran={12} />
          Pesan baru
        </button>
      )}
    </div>
  );
}

/* --- Korsel (Carousel) ----------------------------------------------------------
   scroll-snap asli: digeser jari, digulir trackpad, dan dua tombol untuk
   tetikus. Indeks aktif dihitung dari scrollLeft dibagi lebar yang diukur
   SEKALI per perubahan ukuran — bukan offsetLeft tiap kartu di tiap
   peristiwa gulir (jebakan #21, versi mendatar). Penampung mendatar ini
   ikut dilindungi pemegang roda di BaseLayout hanya di situs publik; di
   panel ia tidak bersaing dengan gulir halaman karena tingginya kecil. */

export function Korsel({ children, label, lebarButir = 280 }: { children: ReactNode[]; label: string; lebarButir?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [kini, setKini] = useState(0);
  const lebar = useRef(lebarButir);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const anak = el.firstElementChild as HTMLElement | null;
      if (anak) lebar.current = anak.getBoundingClientRect().width + 12;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const ke = (i: number) => ref.current?.scrollTo({ left: i * lebar.current, behavior: "smooth" });
  const n = children.length;
  return (
    <div className="k-korsel" role="region" aria-roledescription="korsel" aria-label={label}>
      <div
        ref={ref}
        className="k-korsel__jalur"
        style={{ ["--lebar" as string]: `${lebarButir}px` } as CSSProperties}
        onScroll={(e) => setKini(Math.round(e.currentTarget.scrollLeft / lebar.current))}
      >
        {children.map((c, i) => (
          <div key={i} className="k-korsel__butir" role="group" aria-roledescription="slide" aria-label={`${i + 1} dari ${n}`}>
            {c}
          </div>
        ))}
      </div>
      <div className="k-korsel__kaki">
        <span className="k-korsel__hitung">
          {Math.min(kini + 1, n)} / {n}
        </span>
        <button type="button" className="k-ov__tutup" onClick={() => ke(kini - 1)} disabled={kini <= 0} aria-label="Sebelumnya">
          <Ikon ikon={CaretLeft} ukuran={14} />
        </button>
        <button type="button" className="k-ov__tutup" onClick={() => ke(kini + 1)} disabled={kini >= n - 1} aria-label="Berikutnya">
          <Ikon ikon={CaretRight} ukuran={14} />
        </button>
      </div>
    </div>
  );
}

/* --- Kuesioner (Questionnaire) ---------------------------------------------------
   Satu pertanyaan per langkah, dengan bar langkah di atas. Untuk penyaringan
   calon klien: satu layar per pertanyaan jauh lebih sering diselesaikan
   ketimbang satu halaman panjang. */

export interface LangkahKuesioner {
  tanya: string;
  pilihan: string[];
}

export function Kuesioner({
  langkah,
  onSelesai,
}: {
  langkah: LangkahKuesioner[];
  onSelesai?: (jawab: string[]) => void;
}) {
  const [i, setI] = useState(0);
  const [jawab, setJawab] = useState<(string | null)[]>(() => langkah.map(() => null));
  const selesai = i >= langkah.length;
  if (selesai) {
    return (
      <Kosong
        ikon={CheckCircle}
        judul="Terima kasih"
        aksi={
          <button
            type="button"
            className="k-tombol k-tombol--small k-tombol--ghost"
            onClick={() => {
              setI(0);
              setJawab(langkah.map(() => null));
            }}
          >
            Ulangi
          </button>
        }
      >
        {jawab.filter(Boolean).length} jawaban terekam.
      </Kosong>
    );
  }
  const kini = langkah[i]!;
  return (
    <div className="k-kuesioner">
      <div className="k-kuesioner__langkah" role="progressbar" aria-valuemin={1} aria-valuemax={langkah.length} aria-valuenow={i + 1} aria-label="Langkah">
        {langkah.map((_, k) => (
          <span key={k} className={kelas("k-kuesioner__ruas", k < i && "is-lewat", k === i && "is-kini")} />
        ))}
      </div>
      <span className="k-kuesioner__ke">
        Langkah {i + 1} dari {langkah.length}
      </span>
      <b className="k-kuesioner__tanya">{kini.tanya}</b>
      <div className="k-kuesioner__pilihan" role="radiogroup" aria-label={kini.tanya}>
        {kini.pilihan.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={jawab[i] === p}
            className="k-kuesioner__opsi"
            onClick={() => setJawab((j) => j.map((v, k) => (k === i ? p : v)))}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="k-kuesioner__kaki">
        <button type="button" className="k-tombol k-tombol--medium k-tombol--transparent" disabled={i === 0} onClick={() => setI(i - 1)}>
          Kembali
        </button>
        <button
          type="button"
          className="k-tombol k-tombol--medium k-tombol--primary"
          disabled={!jawab[i]}
          onClick={() => {
            if (i === langkah.length - 1) onSelesai?.(jawab as string[]);
            setI(i + 1);
          }}
        >
          {i === langkah.length - 1 ? "Kirim" : "Lanjut"}
        </button>
      </div>
    </div>
  );
}
