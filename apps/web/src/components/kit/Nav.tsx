import type { ReactNode } from "react";
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
}

export function SisiNav({ logo, item, kaki, sempit, className, id }: PropSisiNav) {
  return (
    <nav
      id={id}
      className={["k-sisi", sempit && "k-sisi--sempit", className].filter(Boolean).join(" ")}
      aria-label="Menu utama"
    >
      <div className="k-sisi__kepala">{logo}</div>
      <ul className="k-sisi__daftar">
        {item.map((it) => {
          const idAnak = it.anak ? `${id ?? "k-sisi"}-anak-${it.label.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}` : undefined;
          const Akar = it.onLipat ? "button" : "a";
          return (
          <li key={it.label}>
            <Akar
              className={["k-nav", it.aktif && "is-aktif"].filter(Boolean).join(" ")}
              {...(it.onLipat
                ? { type: "button" as const, onClick: it.onLipat, "aria-controls": it.terbuka ? idAnak : undefined }
                : { href: it.href ?? "#", "aria-current": it.aktif ? ("page" as const) : undefined })}
              aria-expanded={it.anak ? Boolean(it.terbuka) : undefined}
            >
              <Ikon ikon={it.ikon} ukuran={24} />
              {/* Label disembunyikan di rel sempit lewat CSS, bukan dibuang
                  dari DOM: pembaca layar tetap butuh namanya, dan tooltip
                  title-nya diambil dari teks yang sama. */}
              {/* `title`: rel 192 milik Coinest dirancang untuk label Inggris
                  yang pendek, dan beberapa nama menu di sini lebih panjang
                  daripada 91,6px yang tersisa setelah ikon dan padding. Yang
                  terpotong tetap bisa dibaca dengan menunjuknya. */}
              <span className="k-sisi__label" title={typeof it.label === "string" ? it.label : undefined}>{it.label}</span>
              {/* Di rel sempit angkanya tidak muat, dan Figma memang
                  menggantinya dengan TITIK 8px di sudut ikon — bukan
                  menyembunyikannya. Angka yang hilang sama saja dengan
                  pekerjaan yang hilang. */}
              {it.jumlah !== undefined &&
                (sempit ? (
                  <Titik kecil judul={it.jumlahJudul ?? it.label} />
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
                      <span className="k-sisi__label" title={typeof a.label === "string" ? a.label : undefined}>{a.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
          );
        })}
      </ul>
      {kaki && <div className="k-sisi__kaki">{kaki}</div>}
    </nav>
  );
}

/* -----------------------------------------------------------------------------
   Bilah atas ponsel — 390x70, latar mint, lambang di kiri, judul di tengah,
   tombol menu di kanan.
   -------------------------------------------------------------------------- */
export function BilahNav({
  logo,
  judul,
  onMenu,
  menuIkon,
  className,
}: {
  logo?: ReactNode;
  judul: ReactNode;
  onMenu?: () => void;
  menuIkon: DataIkon;
  className?: string;
}) {
  return (
    <header className={["k-bilahnav", className].filter(Boolean).join(" ")}>
      <span className="k-bilahnav__logo">{logo}</span>
      <span className="k-bilahnav__judul">{judul}</span>
      <button type="button" className="k-bilahnav__menu" onClick={onMenu} aria-label="Buka menu">
        <Ikon ikon={menuIkon} ukuran={24} />
      </button>
    </header>
  );
}
