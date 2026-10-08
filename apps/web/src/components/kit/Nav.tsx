import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Ikon, type DataIkon } from "./Ikon";
import { CaretDown } from "./ikon";
import { Angka, Titik } from "./Lencana";

/* =============================================================================
   Nav — frame Nav di file Figma Coinest: rel samping dan bilah atas ponsel.

   Keduanya kerangka halaman, bukan komponen kecil. Dibangun di sini supaya
   wireframe 14 halaman nanti tinggal memakainya, dan supaya bentuknya
   dibandingkan dengan framenya SEKARANG — bukan setelah empat belas halaman
   terlanjur dibangun di atas kerangka yang meleset.

   Satu hal yang HARUS diingat saat membaca ulang frame ini: rect latar rel
   sampingnya memakai `transform="translate(52 102)"`, bukan atribut x dan y.
   Alat ukur yang mengabaikan transform melaporkan panelnya di (0,0) padahal
   isinya di x68 — jadi isinya seolah berada DI LUAR panelnya sendiri, dan
   angka yang keluar semuanya salah tanpa satu pun tanda.
   ============================================================================= */

export interface ItemNav {
  ikon: DataIkon;
  label: string;
  /** Angka merah di ujung kanan baris — mis. pesan belum dibaca. */
  jumlah?: number;
  jumlahJudul?: string;
  aktif?: boolean;
  href?: string;
  /** Baris ini membuka submenu: caret di ujung kanannya. */
  lipat?: boolean;
  /**
   * Baris submenu di bawahnya.
   *
   * Digambar hanya kalau induknya `terbuka` — dan `terbuka` disetel pemanggil,
   * bukan oleh keadaan di dalam komponen ini. Sebabnya rel ini dirender di
   * server: kalau yang menentukan keadaan internal, seluruh rel harus
   * dihidrasi cuma untuk menampilkan submenu halaman yang sedang dibuka.
   */
  anak?: ItemNav[];
  terbuka?: boolean;
  /**
   * Membuka-menutup submenu. Kalau ada, barisnya dirender sebagai <button>
   * sungguhan — bukan <a href="#">. Baris induk tidak punya halaman sendiri,
   * dan tautan "#" yang dulu dipakai membuat caret-nya tidak mengerjakan
   * apa pun: submenu cuma terbuka kalau halamannya sudah dibuka lewat jalan
   * lain. Terukur di audit: 4 baris mati di tiap halaman kit.
   */
  onLipat?: () => void;
  /**
   * Kategori baris ini. Setiap kali nilainya BERGANTI dari baris sebelumnya,
   * rel menggambar kepala kategori bergaris batas di atasnya. Di rel sempit
   * yang tergambar cuma garisnya — teksnya tidak muat di 72px.
   */
  kelompok?: string;
  /**
   * Varian `gambar`: nomor lembar baris ini (U-01, P-22) — rel dibaca
   * sebagai DAFTAR GAMBAR sebuah set gambar kerja. Induk submenu membawa
   * nomor serinya (P-20).
   */
  kode?: string;
  /** Varian `gambar`: kode disiplin kategori (U, P, …) di kepala kategori. */
  kelompokKode?: string;
  /** Varian `gambar`: banyaknya lembar di kategori ini. */
  kelompokJumlah?: number;
  /**
   * Halaman yang sedang dibuka ada di submenu baris ini, dan submenunya
   * TERTUTUP. Penanda potongan lalu menunjuk induknya — tanpa ini, menutup
   * submenu halaman yang sedang dibuka membuat rel tidak menunjuk apa pun.
   */
  indukAktif?: boolean;
}

export interface PropSisiNav {
  /** Slot logo studio. Di Figma 110x22 pada jarak 32 dari tepi kiri. */
  logo?: ReactNode;
  item: ItemNav[];
  /** Slot di kaki rel. Di Coinest isinya banner promo 159x220. */
  kaki?: ReactNode;
  /** Rel sempit 72px berisi ikon saja — varian Tablet di Figma. */
  sempit?: boolean;
  className?: string;
  /** Untuk `aria-controls` tombol menu geser di ponsel. */
  id?: string;
  /**
   * `gambar`: rel sebagai DAFTAR GAMBAR — kolom nomor lembar, kepala
   * kategori berkode disiplin dan berjumlah lembar, angka sebagai segitiga
   * REVISI, dan PENANDA POTONGAN yang meluncur ke lembar yang dibuka.
   */
  varian?: "gambar";
}

/* Efek tata letak yang tidak memperingatkan saat dirender di server — rel
   ini dirender statis lalu dihidrasi. */
const useEfekTataLetak = typeof window === "undefined" ? useEffect : useLayoutEffect;

/* Segitiga REVISI — tanda delta bernomor di gambar kerja, menggantikan pil
   angka di varian gambar. Angkanya di dalam segitiga, di sepertiga bawah
   (titik berat segitiga), jadi dua digit masih muat. */
function Revisi({ jumlah, judul }: { jumlah: number; judul: string }) {
  return (
    <span className="k-sisi__revisi" role="img" aria-label={`${judul}: ${jumlah}`}>
      <svg viewBox="0 0 24 21" aria-hidden="true">
        <path d="M12 1.8 22.4 19.4H1.6Z" />
      </svg>
      <b aria-hidden="true">{jumlah > 9 ? "9+" : jumlah}</b>
    </span>
  );
}

/* PENANDA POTONGAN — garis potong di tepi rel + segitiga arah pandang,
   menunjuk lembar yang sedang dibuka. Satu elemen yang MELUNCUR ke baris
   baru tiap pindah halaman (rel ini `transition:persist`, jadi elemennya
   hidup lintas halaman), bukan garis per baris yang muncul-hilang: dua garis
   yang memudar bersamaan terbaca sebagai dua halaman aktif (jebakan #45).
   Letaknya diukur sesudah tiap render — tidak pernah di handler gulir
   (jebakan #21) — relatif terhadap daftarnya, jadi ia ikut tergulir. */
function usePenanda(daftar: RefObject<HTMLUListElement | null>, hidup: boolean) {
  const [letak, setLetak] = useState<{ y: number; h: number } | null>(null);
  const [siap, setSiap] = useState(false);
  useEfekTataLetak(() => {
    if (!hidup) return;
    const ul = daftar.current;
    if (!ul) return;
    const t = ul.querySelector<HTMLElement>('.k-nav[aria-current="page"], .k-nav.is-aktif, .k-nav.is-indukaktif');
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

/* Kategori pertama tanpa garis di atasnya — garis batas memisahkan dua
   kategori, bukan memisahkan logo dari kategori pertama. */
const kelasKepala = (pertama: boolean) => (pertama ? "k-sisi__kelompok k-sisi__kelompok--awal" : "k-sisi__kelompok");

export function SisiNav({ logo, item, kaki, sempit, className, id, varian }: PropSisiNav) {
  const gambar = varian === "gambar" && !sempit;
  const daftar = useRef<HTMLUListElement>(null);
  const { letak, siap } = usePenanda(daftar, gambar);
  return (
    <nav
      id={id}
      className={["k-sisi", sempit && "k-sisi--sempit", gambar && "k-sisi--gambar", className].filter(Boolean).join(" ")}
      aria-label="Menu utama"
    >
      <div className="k-sisi__kepala">{logo}</div>
      <ul className="k-sisi__daftar" ref={daftar}>
        {gambar && (
          <li
            className={["k-sisi__penanda", letak && "is-tampak", siap && "is-siap"].filter(Boolean).join(" ")}
            aria-hidden="true"
            style={letak ? { transform: `translateY(${letak.y}px)`, height: `${letak.h}px` } : undefined}
          />
        )}
        {item.map((it, i) => {
          const kepala = it.kelompok && it.kelompok !== item[i - 1]?.kelompok ? it.kelompok : null;
          const idAnak = it.anak ? `${id ?? "k-sisi"}-anak-${it.label.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}` : undefined;
          const Akar = it.onLipat ? "button" : "a";
          return (
          <Fragment key={it.label}>
          {kepala && (
            <li className={kelasKepala(i === 0)} aria-hidden={sempit || undefined}>
              {gambar && it.kelompokKode && (
                <span className="k-sisi__disiplin" aria-hidden="true">
                  {it.kelompokKode}
                </span>
              )}
              <span className="k-sisi__kelompokteks">{kepala}</span>
              {gambar && it.kelompokJumlah !== undefined && (
                <span className="k-sisi__kelompokjml">{it.kelompokJumlah} lbr</span>
              )}
            </li>
          )}
          <li>
            <Akar
              className={["k-nav", it.aktif && "is-aktif", gambar && it.indukAktif && "is-indukaktif"].filter(Boolean).join(" ")}
              {...(it.onLipat
                ? { type: "button" as const, onClick: it.onLipat, "aria-controls": it.terbuka ? idAnak : undefined }
                : { href: it.href ?? "#", "aria-current": it.aktif ? ("page" as const) : undefined })}
              aria-expanded={it.anak ? Boolean(it.terbuka) : undefined}
            >
              <Ikon ikon={it.ikon} ukuran={gambar ? 20 : 24} />
              {/* Label disembunyikan di rel sempit lewat CSS, bukan dibuang
                  dari DOM: pembaca layar tetap butuh namanya, dan tooltip
                  title-nya diambil dari teks yang sama. */}
              {/* `title`: rel 192 milik Coinest dirancang untuk label Inggris
                  yang pendek, dan beberapa nama menu di sini lebih panjang
                  daripada 91,6px yang tersisa setelah ikon dan padding. Yang
                  terpotong tetap bisa dibaca dengan menunjuknya. */}
              <span className="k-sisi__label" title={typeof it.label === "string" ? it.label : undefined}>{it.label}</span>
              {/* Garis penghubung label → nomor lembar, seperti daftar isi.
                  Di lembar yang dibuka ia jadi GARIS POTONG pejal yang
                  tergambar dari kiri saat halaman berpindah. */}
              {gambar && it.kode && <span className="k-sisi__titik" aria-hidden="true" />}
              {/* Di rel sempit angkanya tidak muat, dan Figma memang
                  menggantinya dengan TITIK 8px di sudut ikon — bukan
                  menyembunyikannya. Angka yang hilang sama saja dengan
                  pekerjaan yang hilang. */}
              {it.jumlah !== undefined &&
                (sempit ? (
                  <Titik kecil judul={it.jumlahJudul ?? it.label} />
                ) : gambar ? (
                  <Revisi jumlah={it.jumlah} judul={it.jumlahJudul ?? it.label} />
                ) : (
                  <Angka jumlah={it.jumlah} judul={it.jumlahJudul ?? it.label} />
                ))}
              {(it.lipat || it.anak) && (
                <Ikon
                  ikon={CaretDown}
                  ukuran={16}
                  className={["k-sisi__lipat", it.terbuka && "is-terbuka"]
                    .filter(Boolean)
                    .join(" ")}
                />
              )}
              {gambar && it.kode && <span className="k-sisi__kode">{it.kode}</span>}
            </Akar>
            {/* Submenu HANYA dirender kalau terbuka — bukan disembunyikan
                dengan CSS. Baris menu yang ada di DOM tapi tidak tergambar
                tetap dibacakan pembaca layar sebagai tujuan yang bisa
                dikunjungi, dan di rel sempit ia tidak punya tempat sama
                sekali. */}
            {it.anak && it.terbuka && !sempit && (
              <ul className="k-sisi__anak" id={idAnak}>
                {it.anak.map((a) => (
                  <li key={a.label}>
                    <a
                      className={["k-nav", "k-nav--sub", a.aktif && "is-aktif"]
                        .filter(Boolean)
                        .join(" ")}
                      href={a.href ?? "#"}
                      aria-current={a.aktif ? "page" : undefined}
                    >
                      {gambar && a.kode && <span className="k-sisi__kode">{a.kode}</span>}
                      <span className="k-sisi__label" title={typeof a.label === "string" ? a.label : undefined}>{a.label}</span>
                      {/* Anak tidak punya nomor di kanan, jadi garisnya tidak
                          bertitik — yang tergambar cuma garis potong saat
                          lembar ini yang dibuka. */}
                      {gambar && a.kode && <span className="k-sisi__titik k-sisi__titik--anak" aria-hidden="true" />}
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
