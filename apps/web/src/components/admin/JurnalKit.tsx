import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { RequireAuth } from "./RequireAuth";
import { KepingKategori, BarisTagar, BarisPenulis, KepalaSeksi } from "../kit/Item";
import { TombolIkon } from "../kit/Tombol";
import { DotsThree } from "../kit/ikon";
import { daftarTulisan, bacaCache, tulisCache, type TulisanAdmin, type KategoriJurnal } from "../../lib/admin";

/* =============================================================================
   Jurnal, mengikuti frame Figma "37. Insights".

     Coinest               Halaman ini
     --------------------  ---------------------------------------------------
     keping kategori       Semua + empat kategori jurnal
     Featured Articles     Terbit Terbaru — dua tulisan terakhir yang tayang
     Recent Articles       Baru Diubah — tiga yang terakhir disentuh
     Popular Insights      Belum Ditulis — rencana dan yang terjadwal: yang
                           menunggu pekerjaan, di kartu mint yang memang
                           paling menarik mata di framenya
     Recommended           Semua Tulisan — kisi lengkap, pintu ke tiap tulisan
     Trending Tags         Kategori, dengan jumlah tulisannya
     Top Author            Keadaan: terbit / terjadwal / rencana. Studio ini
                           punya satu penulis, jadi daftar penulis akan
                           selalu satu baris — keadaan tulisan yang berguna
     baris penulis kartu   keadaan + lama baca

   Gambar di tiap kartu adalah SAMPUL tulisan (kolom cover_key, dipilih
   pemilik). Tulisan tanpa sampul memakai bidang warna kategorinya, bukan
   kotak abu kosong.

   Rel kanan diisi lewat PORTAL ke `#kl-relkanan` milik KitLayout, bukan
   island kedua: island kedua berarti daftar yang sama diambil dua kali, dan
   cache-nya ditulis dua pemilik (jebakan #8).
   ============================================================================= */

export const KATEGORI: Record<KategoriJurnal, string> = {
  site: "Tapak & iklim",
  money: "Uang",
  permit: "Perizinan",
  build: "Membangun",
};
/** Tagar kategori — tanpa "#" di depan dipakai KepingTagar, yang menggambar pagarnya sendiri. */
export const TAGAR: Record<KategoriJurnal, string> = {
  site: "#TapakIklim",
  money: "#Uang",
  permit: "#Perizinan",
  build: "#Membangun",
};
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

type Keadaan = "terbit" | "terjadwal" | "rencana";
/* Tiga keadaan — sama dengan halaman lama: "terjadwal" belum terbaca
   pengunjung, jadi menyamakannya dengan "terbit" menyesatkan. */
export function keadaan(t: TulisanAdmin): Keadaan {
  if (!t.publishedAt) return "rencana";
  return Date.parse(t.publishedAt) <= Date.now() ? "terbit" : "terjadwal";
}
const LABEL_KEADAAN: Record<Keadaan, string> = { terbit: "Terbit", terjadwal: "Terjadwal", rencana: "Rencana" };

const tgl = (iso?: string | null) => {
  if (!iso) return "Belum ada tanggal";
  const d = new Date(iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};

/** Sampul, atau bidang warna kategori kalau belum bersampul. */
export function Sampul({ t, className }: { t: TulisanAdmin; className?: string }) {
  return t.coverUrl ? (
    <img className={["pj__sampul", className].filter(Boolean).join(" ")} src={t.coverUrl} alt="" loading="lazy" decoding="async" />
  ) : (
    <span className={["pj__sampul", `pj__sampul--${t.category}`, className].filter(Boolean).join(" ")} aria-hidden="true">
      <span>{TAGAR[t.category]}</span>
    </span>
  );
}

function Meta({ t }: { t: TulisanAdmin }) {
  return (
    <span className="pj__meta">
      <b>{KATEGORI[t.category]}</b>
      <span className="k-titikpisah" aria-hidden="true" />
      <span>{keadaan(t) === "rencana" ? "Rencana" : tgl(t.publishedAt)}</span>
    </span>
  );
}

function Keadaan({ t }: { t: TulisanAdmin }) {
  const k = keadaan(t);
  return (
    <span className="pj__keadaan">
      <span className={`pj__titik pj__titik--${k}`} aria-hidden="true" />
      <span className="pj__keadaanteks">
        {LABEL_KEADAAN[k]} · {t.readMinutes} menit baca
      </span>
    </span>
  );
}

const tautan = (t: TulisanAdmin) => `/admin/jurnal/satu?id=${encodeURIComponent(t.id)}`;

function Isi() {
  const [tulisan, setTulisan] = useState<TulisanAdmin[] | null>(() => bacaCache<TulisanAdmin[]>("jurnal"));
  const [galat, setGalat] = useState<string | null>(null);
  const [kat, setKat] = useState<"semua" | KategoriJurnal>("semua");
  const [rel, setRel] = useState<HTMLElement | null>(null);

  useEffect(() => {
    daftarTulisan()
      .then((d) => {
        tulisCache("jurnal", d);
        setTulisan(d);
      })
      .catch((e) => setGalat((e as Error).message));
    setRel(document.getElementById("kl-relkanan"));
  }, []);

  const semua = tulisan ?? [];
  const tampak = useMemo(() => semua.filter((t) => kat === "semua" || t.category === kat), [semua, kat]);
  const terbit = useMemo(
    () =>
      tampak
        .filter((t) => keadaan(t) === "terbit")
        .sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!)),
    [tampak],
  );
  const unggulan = terbit.slice(0, 2);
  const baru = useMemo(
    () =>
      tampak
        .filter((t) => !unggulan.includes(t))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 3),
    [tampak, unggulan],
  );
  const menunggu = useMemo(
    () =>
      tampak
        .filter((t) => keadaan(t) !== "terbit")
        /* Yang terjadwal dulu — tanggalnya sudah dekat — lalu rencana
           yang paling lama menunggu. */
        .sort((a, b) => {
          const ka = keadaan(a) === "terjadwal" ? 0 : 1;
          const kb = keadaan(b) === "terjadwal" ? 0 : 1;
          return ka - kb || a.createdAt.localeCompare(b.createdAt);
        })
        .slice(0, 2),
    [tampak],
  );
  const urutSemua = useMemo(
    () =>
      [...tampak].sort((a, b) => {
        const ka = { terbit: 0, terjadwal: 1, rencana: 2 }[keadaan(a)];
        const kb = { terbit: 0, terjadwal: 1, rencana: 2 }[keadaan(b)];
        return ka - kb || (b.publishedAt ?? b.updatedAt).localeCompare(a.publishedAt ?? a.updatedAt);
      }),
    [tampak],
  );

  if (galat && tulisan === null) return <p className="pj__kosong">Gagal memuat jurnal: {galat}</p>;
  if (tulisan === null) return <div className="pj pj--rangka" aria-busy="true" />;

  const hitungKeadaan = (k: Keadaan) => semua.filter((t) => keadaan(t) === k).length;
  const titikTiga = (judul: string, href?: string, onClick?: () => void) => (
    <TombolIkon ikon={DotsThree} jenis="transparent" ukuran="xsmall" ikonPx={18} judul={judul} href={href} onClick={onClick} />
  );

  const relIsi = (
    <div className="pj-rel">
      <section className="pj-rel__seksi">
        <KepalaSeksi judul="Kategori" kanan={titikTiga("Buka jurnal di situs", "/jurnal")} />
        <div className="pj-rel__daftar">
          {(Object.keys(KATEGORI) as KategoriJurnal[]).map((k) => (
            <button key={k} type="button" className="pj-rel__tagar" onClick={() => setKat(k)} aria-pressed={kat === k}>
              <BarisTagar
                judul={TAGAR[k]}
                kategori={KATEGORI[k]}
                keterangan={`${semua.filter((t) => t.category === k).length} tulisan`}
              />
            </button>
          ))}
        </div>
        <a className="k-tombol k-tombol--medium k-tombol--ghost pj-rel__tombol" href="/jurnal" target="_blank" rel="noopener">
          Lihat di situs
        </a>
      </section>
      <section className="pj-rel__seksi pj-rel__seksi--keadaan">
        <KepalaSeksi judul="Keadaan" kanan={titikTiga("Semua tulisan", undefined, () => setKat("semua"))} />
        <div className="pj-rel__daftar pj-rel__daftar--penulis">
          {(["terbit", "terjadwal", "rencana"] as Keadaan[]).map((k) => (
            <BarisPenulis
              key={k}
              avatar={<span className={`pj__titik pj__titik--${k} pj__titik--besar`} />}
              nama={LABEL_KEADAAN[k]}
              peran={`${hitungKeadaan(k)} tulisan`}
            />
          ))}
        </div>
        <a className="k-tombol k-tombol--medium k-tombol--ghost pj-rel__tombol" href="/admin/jurnal/satu?baru=1">
          Tulisan Baru
        </a>
      </section>
    </div>
  );

  return (
    <div className="pj">
      {rel && createPortal(relIsi, rel)}

      <div className="pj__keping" role="group" aria-label="Saring kategori">
        <KepingKategori aktif={kat === "semua"} onClick={() => setKat("semua")}>
          Semua
        </KepingKategori>
        {(Object.keys(KATEGORI) as KategoriJurnal[]).map((k) => (
          <KepingKategori key={k} aktif={kat === k} onClick={() => setKat(k)}>
            {KATEGORI[k]}
          </KepingKategori>
        ))}
      </div>

      <div className="pj__baris1">
        <section className="pj__unggulan">
          <KepalaSeksi judul="Terbit Terbaru" kanan={titikTiga("Buka jurnal di situs", "/jurnal")} />
          <div className="pj__unggulandaftar">
            {unggulan.map((t) => (
              <a key={t.id} className="pj__kartubesar" href={tautan(t)}>
                <Sampul t={t} />
                <span className="pj__info">
                  <Meta t={t} />
                  <span className="pj__judulbesar">{t.title}</span>
                  <span className="pj__ringkas">{t.excerpt}</span>
                  <Keadaan t={t} />
                </span>
              </a>
            ))}
            {unggulan.length === 0 && <p className="pj__kosong">Belum ada tulisan yang terbit di kategori ini.</p>}
          </div>
        </section>
        <section className="pj__baru">
          <KepalaSeksi judul="Baru Diubah" />
          <div className="pj__barudaftar">
            {baru.map((t) => (
              <a key={t.id} className="pj__kartukecil" href={tautan(t)}>
                <Sampul t={t} className="pj__sampul--kecil" />
                <span className="pj__info">
                  <Keadaan t={t} />
                  <span className="pj__judulkecil">{t.title}</span>
                  <Meta t={t} />
                </span>
              </a>
            ))}
          </div>
        </section>
      </div>

      <section className="pj__menunggu">
        <KepalaSeksi judul="Belum Ditulis" />
        <div className="pj__menunggudaftar">
          {menunggu.map((t) => (
            <a key={t.id} className="pj__kartumint" href={tautan(t)}>
              <Sampul t={t} className="pj__sampul--mint" />
              <span className="pj__info">
                <Meta t={t} />
                <span className="pj__judulsedang">{t.title}</span>
                <span className="pj__ringkas">{t.excerpt}</span>
                <Keadaan t={t} />
              </span>
            </a>
          ))}
          {menunggu.length === 0 && <p className="pj__kosong">Semua tulisan di kategori ini sudah terbit.</p>}
        </div>
      </section>

      <section className="pj__semua">
        <KepalaSeksi
          judul="Semua Tulisan"
          kanan={
            <a className="pj__tambah" href="/admin/jurnal/satu?baru=1">
              + Tulisan baru
            </a>
          }
        />
        <div className="pj__kisi">
          {urutSemua.map((t) => (
            <a key={t.id} className="pj__kartugrid" href={tautan(t)}>
              <Sampul t={t} className="pj__sampul--grid" />
              <span className="pj__info">
                <Meta t={t} />
                <span className="pj__judulsedang">{t.title}</span>
              </span>
            </a>
          ))}
          {urutSemua.length === 0 && <p className="pj__kosong">Belum ada tulisan di kategori ini.</p>}
        </div>
      </section>
    </div>
  );
}

export function JurnalKit() {
  return (
    <RequireAuth skeleton={<div className="pj pj--rangka" />}>
      <Isi />
    </RequireAuth>
  );
}
