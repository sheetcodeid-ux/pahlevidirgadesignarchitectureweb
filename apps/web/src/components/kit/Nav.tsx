import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Ikon, type DataIkon } from "./Ikon";
import { CaretDown } from "./ikon";

/* =============================================================================
   SisiNav — rel samping panel sebagai DAFTAR GAMBAR satu set gambar kerja.

   Permintaan pemilik: sidebar "sesuai dengan architecture … luar dalam".
   Bendanya daftar gambar di lembar sampul set gambar kerja, dan rel ini
   BERPERILAKU seperti benda itu:
   - SAMPUL di kepala (slot `sampul`, diisi pemanggil);
   - kepala tabel NO. · JUDUL LEMBAR · REV yang diam di atas daftar;
   - tiap halaman satu LEMBAR bernomor (U-01, P-22), kategori = DISIPLIN
     berkotak huruf dan berjumlah lembar;
   - kolom REV = SEGITIGA REVISI bernomor, dari pekerjaan yang menunggu;
   - lembar yang dibuka ditunjuk PENANDA POTONGAN yang meluncur di talang
     kiri, dan GARIS POTONG yang tergambar menyeberangi barisnya;
   - ikonnya ikon arsitektur (`ikon/arsitektur.ts`) yang DIGAMBAR seperti
     pena saat lembarnya dibuka dan saat disentuh tetikus;
   - submenu terbuka berurutan seperti lembar dibuka dari map;
   - KOP GAMBAR di kaki (slot `kaki`).

   Satu bentuk saja. Varian pil Coinest, rel sempit 72px, angka pil, dan
   garis tepi per baris DIBUANG — tidak ada pemakainya lagi, dan dua bentuk
   untuk satu komponen pasti menyimpang (jebakan #32).
   ============================================================================= */

export interface ItemNav {
  ikon: DataIkon;
  label: string;
  /** Nomor lembar (U-01, P-22); induk submenu membawa nomor serinya (P-20). */
  kode?: string;
  href?: string;
  aktif?: boolean;
  /** Angka di segitiga revisi — pekerjaan yang menunggu di lembar ini. */
  jumlah?: number;
  jumlahJudul?: string;
  /**
   * Baris submenu. Digambar hanya kalau induknya `terbuka` — keadaan milik
   * pemanggil, bukan komponen ini: rel dirender di server, dan submenu
   * halaman yang sedang dibuka harus sudah terbuka di HTML-nya.
   */
  anak?: ItemNav[];
  terbuka?: boolean;
  /** Membuka-menutup submenu. Barisnya jadi <button>, bukan <a href="#">. */
  onLipat?: () => void;
  /** Kategori. Tiap kali BERGANTI dari baris sebelumnya, kepala kategori digambar. */
  kelompok?: string;
  /** Kode disiplin kategori (U, P, …) di kepala kategori. */
  kelompokKode?: string;
  /** Banyaknya lembar di kategori ini. */
  kelompokJumlah?: number;
  /**
   * Halaman yang dibuka ada di submenu baris ini, dan submenunya TERTUTUP:
   * penanda potongan menunjuk induknya — bukan menghilang.
   */
  indukAktif?: boolean;
}

export interface PropSisiNav {
  /** Sampul set gambar di kepala rel. */
  sampul?: ReactNode;
  item: ItemNav[];
  /** Kop gambar di kaki rel. */
  kaki?: ReactNode;
  /** Kategori yang sedang ditunjuk dari luar (kunci denah di sampul). */
  kelompokSorot?: string | null;
  className?: string;
  /** Untuk `aria-controls` tombol menu geser di ponsel. */
  id?: string;
}

/* Efek tata letak tanpa peringatan saat dirender di server. */
const useEfekTataLetak = typeof window === "undefined" ? useEffect : useLayoutEffect;

/* Segitiga REVISI — delta bernomor gambar kerja. Angkanya di sepertiga
   bawah (titik berat segitiga), jadi dua digit masih muat. */
/** Segitiga revisi bernomor. `batas`: angka di atasnya ditulis "9+" —
    bawaan 9 untuk JUMLAH (lonceng, kolom REV); nomor revisi di Daftar
    Revisi memakai 99 supaya "revisi 12" tetap terbaca 12. */
export function Revisi({ jumlah, judul, className, batas = 9 }: { jumlah: number; judul: string; className?: string; batas?: number }) {
  return (
    <span className={gabung("k-sisi__revisi", className)} role="img" aria-label={jumlah > 0 ? `${judul}: ${jumlah}` : `${judul}: tidak ada`}>
      <svg viewBox="0 0 24 21" aria-hidden="true">
        <path d="M12 1.8 22.4 19.4H1.6Z" />
      </svg>
      {jumlah > 0 && <b aria-hidden="true">{jumlah > batas ? `${batas}+` : jumlah}</b>}
    </span>
  );
}

/* PENANDA POTONGAN — SATU elemen yang meluncur ke baris baru tiap pindah
   halaman (rel `transition:persist`, jadi elemennya hidup lintas halaman),
   bukan garis per baris yang muncul-hilang: dua garis yang memudar bersamaan
   terbaca sebagai dua halaman aktif (jebakan #45). Letaknya diukur sesudah
   tiap render — tidak pernah di handler gulir (jebakan #21) — relatif
   terhadap daftarnya, jadi ia ikut tergulir. */
function usePenanda(daftar: RefObject<HTMLUListElement | null>) {
  const [letak, setLetak] = useState<{ y: number; h: number } | null>(null);
  const [siap, setSiap] = useState(false);
  useEfekTataLetak(() => {
    const ul = daftar.current;
    if (!ul) return;
    const t = ul.querySelector<HTMLElement>('.k-nav[aria-current="page"], .k-nav.is-indukaktif');
    if (!t) {
      setLetak((l) => (l ? null : l));
      return;
    }
    const a = ul.getBoundingClientRect();
    const r = t.getBoundingClientRect();
    const y = r.top - a.top + ul.scrollTop;
    setLetak((l) => (l && Math.abs(l.y - y) < 0.5 && Math.abs(l.h - r.height) < 0.5 ? l : { y, h: r.height }));
  });
  /* Transisi baru dinyalakan SESUDAH letak pertama tergambar: tanpa itu
     penandanya meluncur dari puncak daftar tiap kali halaman dimuat. */
  useEffect(() => {
    if (!letak || siap) return;
    const f = requestAnimationFrame(() => requestAnimationFrame(() => setSiap(true)));
    return () => cancelAnimationFrame(f);
  }, [letak, siap]);
  return { letak, siap };
}

/**
 * Kunci yang BARU muncul sesudah dipasang — untuk gerak yang hanya boleh
 * menyala karena perbuatan (pindah halaman, membuka submenu), bukan saat
 * dimuat dan bukan saat data datang (jebakan #74): dari kosong ke berisi
 * tidak dihitung. Dilepas lagi sesudah `umur` ms supaya kelas geraknya
 * tidak menempel dan memutar ulang animasi saat aturan lain berganti.
 */
function useBaru(kunci: string, umur: number): Set<string> {
  const lalu = useRef(kunci);
  const waktu = useRef(0);
  const [baru, setBaru] = useState<Set<string>>(() => new Set());
  useEfekTataLetak(() => {
    const l = new Set(lalu.current.split("|").filter(Boolean));
    lalu.current = kunci;
    if (!l.size) return;
    const muncul = kunci.split("|").filter((k) => k && !l.has(k));
    if (!muncul.length) return;
    setBaru(new Set(muncul));
    /* Pengatur waktunya di ref, bukan di pembersih efek: kunci yang berganti
       lagi ke keadaan TANPA butir baru akan membatalkannya, dan kelas gerak
       lalu menempel selamanya. */
    window.clearTimeout(waktu.current);
    waktu.current = window.setTimeout(() => setBaru(new Set()), umur);
  }, [kunci]);
  useEffect(() => () => window.clearTimeout(waktu.current), []);
  return baru;
}

const gabung = (...k: (string | false | null | undefined)[]) => k.filter(Boolean).join(" ");

export function SisiNav({ sampul, item, kaki, kelompokSorot, className, id }: PropSisiNav) {
  const daftar = useRef<HTMLUListElement>(null);
  const { letak, siap } = usePenanda(daftar);
  /* Lembar yang baru dibuka: ikonnya digambar seperti pena. */
  const aktif = item.flatMap((it) => (it.aktif ? [it.kode ?? it.label] : (it.anak ?? []).filter((a) => a.aktif).map((a) => a.kode ?? a.label)));
  const ditarik = useBaru(aktif.join("|"), 1100);
  /* Submenu yang baru dibuka: barisnya terurai satu per satu. */
  const terbuka = item.filter((it) => it.anak && it.terbuka).map((it) => it.label);
  const membuka = useBaru(terbuka.join("|") || "-", 900);
  return (
    <nav id={id} className={gabung("k-sisi", className)} aria-label="Menu utama">
      <div className="k-sisi__kepala">{sampul}</div>
      {/* Kepala tabel daftar gambar — di luar daftar yang menggulir, jadi
          ia tetap di tempatnya seperti baris judul tabel. */}
      <div className="k-sisi__kepalatabel" aria-hidden="true">
        <span>No.</span>
        <span>Judul lembar</span>
        <span>Rev</span>
      </div>
      <ul className="k-sisi__daftar" ref={daftar}>
        <li
          className={gabung("k-sisi__penanda", letak && "is-tampak", siap && "is-siap")}
          aria-hidden="true"
          style={letak ? { transform: `translateY(${letak.y}px)`, height: `${letak.h}px` } : undefined}
        />
        {item.map((it, i) => {
          const kepala = it.kelompok && it.kelompok !== item[i - 1]?.kelompok ? it.kelompok : null;
          const idAnak = it.anak ? `${id ?? "k-sisi"}-anak-${it.label.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}` : undefined;
          const Akar = it.onLipat ? "button" : "a";
          const kunci = it.kode ?? it.label;
          return (
            <Fragment key={it.label}>
              {kepala && (
                <li
                  className={gabung("k-sisi__kelompok", i === 0 && "k-sisi__kelompok--awal", kelompokSorot === kepala && "is-sorot")}
                  data-kelompok={kepala}
                >
                  {it.kelompokKode && (
                    <span className="k-sisi__disiplin" aria-hidden="true">
                      {it.kelompokKode}
                    </span>
                  )}
                  <span className="k-sisi__kelompokteks">{kepala}</span>
                  {it.kelompokJumlah !== undefined && <span className="k-sisi__kelompokjml">{it.kelompokJumlah} lbr</span>}
                </li>
              )}
              <li>
                <Akar
                  className={gabung("k-nav", it.aktif && "is-aktif", it.indukAktif && "is-indukaktif", ditarik.has(kunci) && "is-ditarik")}
                  {...(it.onLipat
                    ? { type: "button" as const, onClick: it.onLipat, "aria-controls": it.terbuka ? idAnak : undefined }
                    : { href: it.href ?? "#", "aria-current": it.aktif ? ("page" as const) : undefined })}
                  aria-expanded={it.anak ? Boolean(it.terbuka) : undefined}
                >
                  <span className="k-sisi__kode">{it.kode}</span>
                  <Ikon ikon={it.ikon} ukuran={18} />
                  <span className="k-sisi__label">
                    {it.label}
                  </span>
                  {/* Garis potong — tergambar menyeberangi baris lembar yang dibuka. */}
                  <span className="k-sisi__potong" aria-hidden="true" />
                  {it.jumlah ? <Revisi jumlah={it.jumlah} judul={it.jumlahJudul ?? it.label} /> : null}
                  {it.anak && <Ikon ikon={CaretDown} ukuran={14} className={gabung("k-sisi__lipat", it.terbuka && "is-terbuka")} />}
                </Akar>
                {/* Submenu HANYA dirender kalau terbuka — baris yang ada di
                    DOM tapi tidak tergambar tetap dibacakan pembaca layar. */}
                {it.anak && it.terbuka && (
                  <ul className={gabung("k-sisi__anak", membuka.has(it.label) && "is-membuka")} id={idAnak}>
                    {it.anak.map((a) => (
                      <li key={a.label}>
                        <a
                          className={gabung("k-nav", "k-nav--sub", a.aktif && "is-aktif", ditarik.has(a.kode ?? a.label) && "is-ditarik")}
                          href={a.href ?? "#"}
                          aria-current={a.aktif ? "page" : undefined}
                        >
                          <span className="k-sisi__kode">{a.kode}</span>
                          <span className="k-sisi__label">
                            {a.label}
                          </span>
                          <span className="k-sisi__potong" aria-hidden="true" />
                          {a.jumlah ? <Revisi jumlah={a.jumlah} judul={a.jumlahJudul ?? a.label} /> : null}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            </Fragment>
          );
        })}
      </ul>
      {kaki && <div className="k-sisi__kaki">{kaki}</div>}
    </nav>
  );
}
