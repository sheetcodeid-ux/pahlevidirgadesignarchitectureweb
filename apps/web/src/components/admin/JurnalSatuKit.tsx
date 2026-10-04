import { Rasio } from "../kit/Tampilan";
import { GagalMuat } from "./gagalMuat";
import { useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "astro:transitions/client";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast, titipToast } from "../kit/Toast";
import { AlertDialog } from "../kit/Overlay";
import { KepalaSeksi, KepingTagar } from "../kit/Item";
import { Tombol, TombolIkon } from "../kit/Tombol";
import { DotsThree, Eye, FacebookLogo, Link as IkonTautan, XLogo } from "../kit/ikon";
import {
  daftarTulisan,
  ambilTulisan,
  buatTulisan,
  ubahTulisan,
  hapusTulisan,
  mintaUrlUnggahSampul,
  slugDariJudul,
  bacaCache,
  type TulisanAdmin,
  type KategoriJurnal,
} from "../../lib/admin";
import { kecilkanFoto } from "../../lib/kecilkanFoto";
import { keadaan, Sampul, KATEGORI, TAGAR } from "./JurnalKit";

/* =============================================================================
   Satu tulisan, mengikuti frame Figma "40. Insight Details".

   Framenya halaman BACA: judul di tengah, pembuka, baris penulis, sampul
   besar, badan tulisan di kolom kiri, lalu daftar isi, tombol bagikan, dan
   tagar di kolom kanan, dengan "konten terkait" di kaki.

   Di sini halaman yang sama adalah EDITOR — setiap bagian bisa disunting di
   tempatnya: judul dan pembuka di tengah, sampul diunggah di bidang sampul,
   badan di kolom kiri, kategori dipilih dari keping di kolom kanan (tempat
   tagar framenya).

   Badan tulisan TIDAK dirender jadi HTML di panel. Keputusan lama yang tetap
   berlaku (lihat Riwayat keputusan di CLAUDE.md): dua perender markdown pasti
   menyimpang suatu saat. Yang ditampilkan kolom kanan cuma DAFTAR judul
   bagian (baris berawalan "## "), supaya pemilik melihat kerangka tulisannya
   tanpa perender kedua.
   ============================================================================= */

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September",
  "Oktober", "November", "Desember"];
const tglPanjang = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};
const SITUS = "https://pahlevidirgaarchitecture.com";

/** Sama dengan CHECK di database: yang terbit harus punya isi. */
const ISI_MINIMAL = 200;
const JENIS_GAMBAR = ["image/jpeg", "image/png", "image/webp"];
const UKURAN_MAKS = 8 * 1024 * 1024;

function Isi({ dibangunPada }: { dibangunPada?: string }) {
  const toast = useToast();
  const kueri = typeof location === "undefined" ? new URLSearchParams() : new URLSearchParams(location.search);
  const id = kueri.get("id");
  const baru = !id;

  const [semua, setSemua] = useState<TulisanAdmin[] | null>(() => bacaCache<TulisanAdmin[]>("jurnal"));
  const [awal, setAwal] = useState<TulisanAdmin | null>(() =>
    id ? (bacaCache<TulisanAdmin[]>("jurnal") ?? []).find((t) => t.id === id) ?? null : null,
  );
  const [galat, setGalat] = useState<string | null>(null);

  const [judul, setJudul] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [pembuka, setPembuka] = useState("");
  const [kategori, setKategori] = useState<KategoriJurnal>("site");
  const [menit, setMenit] = useState(5);
  const [isi, setIsi] = useState("");
  const [terbit, setTerbit] = useState(false);
  const [sampul, setSampul] = useState<{ key: string | null; url: string | null }>({ key: null, url: null });
  const [menyimpan, setMenyimpan] = useState(false);
  const [mengunggah, setMengunggah] = useState(false);
  const [terisi, setTerisi] = useState(false);
  const berkasRef = useRef<HTMLInputElement>(null);

  function isiDari(t: TulisanAdmin) {
    setJudul(t.title);
    setSlug(t.slug);
    setSlugManual(true);
    setPembuka(t.excerpt);
    setKategori(t.category);
    setMenit(t.readMinutes);
    setIsi(t.body ?? "");
    setTerbit(Boolean(t.publishedAt));
    setSampul({ key: t.coverKey ?? null, url: t.coverUrl ?? null });
    setTerisi(true);
  }

  useEffect(() => {
    daftarTulisan().then(setSemua).catch(() => setSemua((l) => l ?? []));
    if (id) {
      ambilTulisan(id)
        .then((t) => {
          setAwal(t);
          isiDari(t);
        })
        .catch((e) => setGalat((e as Error).message));
    } else {
      setTerisi(true);
    }
  }, [id]);

  /* Isi dari cache dipakai lebih dulu supaya formulir tidak kosong sesaat. */
  useEffect(() => {
    if (awal && !terisi) isiDari(awal);
  }, [awal, terisi]);

  const slugKini = slugManual ? slug : slugDariJudul(judul);
  const isiCukup = isi.trim().length >= ISI_MINIMAL;
  /* Syarat yang sama dengan checkJournalInput di API. Tombol yang mati harus
     bilang kenapa — kalau tidak, yang terbaca cuma "tidak bisa disimpan". */
  const alasanTidakBisa =
    judul.trim().length < 3
      ? "Judul minimal 3 huruf."
      : pembuka.trim().length < 10
        ? "Kalimat pembuka minimal 10 huruf."
        : slugKini.length < 3
          ? "Alamat minimal 3 huruf."
          : terbit && !isiCukup
            ? `Isi kurang ${ISI_MINIMAL - isi.trim().length} huruf lagi untuk terbit.`
            : null;
  const bisaSimpan = alasanTidakBisa === null;

  /* Kerangka dari baris "## " — bukan perender markdown. */
  const kerangka = useMemo(
    () =>
      isi
        .split("\n")
        .map((b) => /^#{2,3}\s+(.+?)\s*#*\s*$/.exec(b)?.[1])
        .filter((b): b is string => Boolean(b)),
    [isi],
  );

  const terkait = useMemo(
    () =>
      (semua ?? [])
        .filter((t) => t.id !== id && t.category === kategori)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 4),
    [semua, id, kategori],
  );

  async function simpan() {
    const kirim: Partial<TulisanAdmin> = {
      title: judul.trim(),
      slug: slugKini,
      excerpt: pembuka.trim(),
      category: kategori,
      readMinutes: menit,
      body: isi.trim() ? isi : null,
      /* Tanggal terbit yang SUDAH ada dipertahankan — menimpanya tiap kali
         disunting membuat tulisan lama melompat ke puncak indeks. */
      publishedAt: terbit ? awal?.publishedAt ?? new Date().toISOString() : null,
      coverKey: sampul.key,
    };
    setMenyimpan(true);
    try {
      if (baru) {
        const { id: idBaru } = await buatTulisan(kirim);
        /* Dititipkan, bukan toast() — halamannya berganti sebelum toast
           sempat tergambar. Lihat titipToast. */
        titipToast({ judul: "Tulisan tersimpan", keterangan: "Tekan Terbitkan di bilah atas supaya situs ikut berubah.", nada: "sukses" });
        await navigate(`/admin/jurnal/satu?id=${encodeURIComponent(idBaru)}`);
        return;
      }
      await ubahTulisan(id!, kirim);
      const segar = await ambilTulisan(id!);
      setAwal(segar);
      isiDari(segar);
      toast({ judul: "Tulisan tersimpan", keterangan: "Tekan Terbitkan di bilah atas supaya situs ikut berubah.", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenyimpan(false);
    }
  }

  async function unggah(f: File) {
    if (!JENIS_GAMBAR.includes(f.type)) {
      toast({ judul: "Format tidak didukung", keterangan: "Pakai JPG, PNG, atau WebP.", nada: "gagal" });
      return;
    }
    if (f.size > UKURAN_MAKS) {
      toast({ judul: "Berkas terlalu besar", keterangan: "Maksimal 8 MB.", nada: "gagal" });
      return;
    }
    setMengunggah(true);
    try {
      const { berkas } = await kecilkanFoto(f);
      const target = await mintaUrlUnggahSampul(berkas.type);
      const res = await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": berkas.type }, body: berkas });
      if (!res.ok) throw new Error(`Penyimpanan menolak berkas (${res.status})`);
      /* Pratinjau dari berkas lokal: URL publiknya baru ada setelah disimpan.
         Kuncinya baru tercatat di database saat Simpan ditekan — sama seperti
         isian lain di halaman ini. */
      setSampul({ key: target.key, url: URL.createObjectURL(berkas) });
      toast({ judul: "Sampul terunggah", keterangan: "Tekan Simpan untuk memasangnya.", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal mengunggah", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMengunggah(false);
      if (berkasRef.current) berkasRef.current.value = "";
    }
  }

  async function hapus() {
    try {
      await hapusTulisan(id!);
      titipToast({
        judul: judul.trim() ? `"${judul.trim()}" dihapus` : "Tulisan dihapus",
        keterangan: "Kalau sudah pernah terbit, tekan Terbitkan supaya halamannya ikut hilang dari situs.",
        nada: "sukses",
      });
      await navigate("/admin/jurnal");
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  if (galat) return <GagalMuat apa="Tulisan" galat={galat} />;
  if (!terisi) return <div className="pjs pjs--rangka" aria-busy="true" />;

  const k = awal ? keadaan(awal) : "rencana";
  const tautanPublik = `${SITUS}/jurnal/${slugKini}`;
  /* Terbit di database BELUM berarti ada di situs: situsnya statis, dan
     halaman /jurnal/<slug> baru dibuat saat build berikutnya. Tanpa ini
     "Buka di situs" dan tautan yang disalin berujung 404 sampai tombol
     Terbitkan ditekan — persis kebingungan "datanya ada, situsnya belum"
     yang membuat tombol Terbitkan dibuat. Stempel build diterima dari
     halaman .astro; CAP_BUILD yang diimpor di island ini akan dievaluasi di
     peramban dan selalu bernilai "sekarang". */
  const sudahDibangun = !dibangunPada || Boolean(awal?.publishedAt && awal.publishedAt <= dibangunPada);
  const menungguTerbitkan = Boolean(awal && k === "terbit" && !sudahDibangun);
  const bisaDibuka = Boolean(awal && k === "terbit" && sudahDibangun);

  return (
    <div className="pjs">
      {/* ---- Kepala tulisan --------------------------------------------- */}
      <header className="pjs__kepala">
        {/* textarea satu baris, bukan <input>: judul yang panjang harus bisa
            terlipat di ponsel, dan <input> tidak pernah terlipat — judulnya
            terpotong jadi "Sembilan pertanyaan s". Enter dan baris baru dari
            tempelan dibuang: judul tetap satu kalimat. */}
        <textarea
          className="pjs__judul"
          aria-label="Judul tulisan"
          placeholder="Judul tulisan"
          rows={1}
          maxLength={200}
          value={judul}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          onChange={(e) => setJudul(e.currentTarget.value.replace(/\s*\n\s*/g, " "))}
        />
        <textarea
          className="pjs__pembuka"
          aria-label="Kalimat pembuka"
          placeholder="Satu atau dua kalimat yang membuat orang ingin membaca sampai habis."
          rows={2}
          maxLength={600}
          value={pembuka}
          onChange={(e) => setPembuka(e.currentTarget.value)}
        />
        <p className="pjs__meta">
          <span className={`pj__titik pj__titik--${k}`} aria-hidden="true" />
          <span>
            {k === "terbit" && awal?.publishedAt
              ? `Terbit ${tglPanjang(awal.publishedAt)}`
              : k === "terjadwal" && awal?.publishedAt
                ? `Terjadwal ${tglPanjang(awal.publishedAt)}`
                : "Rencana"}
            {menungguTerbitkan && " · belum ada di situs — tekan Terbitkan"}
          </span>
          <span className="k-titikpisah" aria-hidden="true" />
          <b>{KATEGORI[kategori]}</b>
          <span className="k-titikpisah" aria-hidden="true" />
          <label className="pjs__menit">
            <input
              type="number"
              min={1}
              max={90}
              value={menit}
              aria-label="Lama baca dalam menit"
              onChange={(e) => setMenit(Math.max(1, Math.min(90, Number(e.currentTarget.value) || 1)))}
            />
            menit baca
          </label>
        </p>
      </header>

      {/* ---- Sampul ------------------------------------------------------ */}
      {/* Rasio kit 1200:630 — kartu bagikan dan sampul di /jurnal/<slug>. */}
      <Rasio rasio={1200 / 630} className={`pjs__sampul${sampul.url ? "" : " pjs__sampul--kosong"}`}>
        {sampul.url ? (
          <img src={sampul.url} alt="Sampul tulisan" />
        ) : (
          <span className="pjs__sampulkosong">
            <b>Belum ada sampul</b>
            <small>JPG, PNG, atau WebP, rasio 1200×630 paling pas. Tanpa sampul, kartunya memakai warna kategori.</small>
          </span>
        )}
        <span className="pjs__sampulaksi">
          {/* Utama selagi sampulnya kosong: bidang kosong berlatar mint pucat
              yang SAMA dengan tombol secondary, jadi tombolnya dulu tergambar
              sebagai teks lepas tanpa kotak. Di atas gambar, secondary
              terbaca jelas. */}
          <label
            className={`k-tombol k-tombol--medium ${sampul.url ? "k-tombol--secondary" : "k-tombol--primary"} pjs__unggah`}
          >
            {mengunggah ? "Mengunggah…" : sampul.url ? "Ganti sampul" : "Unggah sampul"}
            <input
              ref={berkasRef}
              type="file"
              accept={JENIS_GAMBAR.join(",")}
              disabled={mengunggah}
              onChange={(e) => e.currentTarget.files?.[0] && unggah(e.currentTarget.files[0])}
            />
          </label>
          {sampul.url && (
            <Tombol ukuran="medium" jenis="secondary" onClick={() => setSampul({ key: null, url: null })}>
              Buang sampul
            </Tombol>
          )}
        </span>
      </Rasio>

      {/* ---- Badan + kolom kanan ----------------------------------------- */}
      <div className="pjs__badan">
        <div className="pjs__utama">
          {/* Tanpa label yang kelihatan: di framenya badan tulisan mulai
              sejajar daftar isi di kanannya. Kotaknya baru bergaris saat
              disentuh — sama seperti judul dan pembuka di atas. */}
          <textarea
            className="pjs__isi"
            aria-label="Isi tulisan"
            placeholder={"Tulis di sini. Pakai \"## Judul bagian\" untuk bagian baru — ia masuk daftar isi."}
            value={isi}
            onChange={(e) => setIsi(e.currentTarget.value)}
          />
          <p className="pjs__bantu">
            {isi.trim().length} karakter
            {terbit && !isiCukup && ` — kurang ${ISI_MINIMAL - isi.trim().length} lagi untuk bisa terbit`}.
          </p>

          <section className="pjs__status">
            <div className="pjs__statuskiri">
              <label className="pjs__centang">
                <input type="checkbox" className="k-sakelar" role="switch" checked={terbit} onChange={(e) => setTerbit(e.currentTarget.checked)} />
                <span>
                  <b>{terbit ? "Terbit" : "Rencana"}</b>
                  <small>
                    {terbit
                      ? "Tampil di /jurnal setelah Anda menekan Terbitkan di bilah atas."
                      : "Tampil di indeks sebagai “belum ditulis”, tanpa tautan."}
                  </small>
                </span>
              </label>
            </div>
            <div className="pjs__aksi">
              {alasanTidakBisa && <small className="pjs__alasan">{alasanTidakBisa}</small>}
              <Tombol memuat={menyimpan} ukuran="large" jenis="primary" disabled={!bisaSimpan || menyimpan} onClick={simpan}>
                {menyimpan ? "Menyimpan…" : "Simpan"}
              </Tombol>
              {!baru && (
                <AlertDialog
                  destructive
                  title="Hapus tulisan ini?"
                  description="Tidak bisa dikembalikan. Tautan lamanya akan mati."
                  confirmLabel="Ya, hapus"
                  onConfirm={hapus}
                  trigger={
                    <button type="button" className="pas__hapus">
                      Hapus tulisan
                    </button>
                  }
                />
              )}
            </div>
          </section>
        </div>

        <aside className="pjs__samping">
          <section>
            {/* Frame-nya tidak berjudul di sini; judulnya tetap ada untuk
                pembaca layar. */}
            <h3 className="sr-only">Daftar isi</h3>
            {kerangka.length > 0 ? (
              <ol className="pjs__kerangka">
                {kerangka.map((b, i) => (
                  <li key={`${i}-${b}`}>{b}</li>
                ))}
              </ol>
            ) : (
              <p className="pjs__sampingket">Belum ada bagian. Baris berawalan “## ” jadi judul bagian.</p>
            )}
          </section>
          <hr className="pjs__garis" />
          <section>
            <h3 className="pjs__sampingjudul">Bagikan</h3>
            <div className="pjs__ikon">
              <TombolIkon
                ikon={IkonTautan}
                jenis="secondary"
                ukuran="medium"
                judul={
                  bisaDibuka
                    ? "Salin tautan tulisan"
                    : menungguTerbitkan
                      ? "Tautan hidup setelah Terbitkan ditekan (bola dunia di kanan atas)"
                      : "Tautan hidup setelah terbit"
                }
                disabled={!bisaDibuka}
                onClick={() =>
                  navigator.clipboard
                    .writeText(tautanPublik)
                    .then(() => toast({ judul: "Tautan disalin", nada: "sukses" }))
                    .catch(() => toast({ judul: "Tidak bisa menyalin", nada: "gagal" }))
                }
              />
              {bisaDibuka ? (
                <>
                  <TombolIkon ikon={Eye} jenis="secondary" ukuran="medium" judul="Buka di situs" href={`/jurnal/${slugKini}`} />
                  <TombolIkon
                    ikon={FacebookLogo}
                    jenis="secondary"
                    ukuran="medium"
                    judul="Bagikan ke Facebook"
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(tautanPublik)}`}
                  />
                  <TombolIkon
                    ikon={XLogo}
                    jenis="secondary"
                    ukuran="medium"
                    judul="Bagikan ke X"
                    href={`https://x.com/intent/post?url=${encodeURIComponent(tautanPublik)}&text=${encodeURIComponent(judul)}`}
                  />
                </>
              ) : null}
            </div>
          </section>
          <section>
            <h3 className="pjs__sampingjudul">Kategori</h3>
            {/* Tempat "Tags" di framenya. Kepingnya KepingTagar dari kit,
                dibungkus tombol karena di sini ia pilihan, bukan hiasan. */}
            <div className="pjs__keping" role="radiogroup" aria-label="Kategori tulisan">
              {(Object.keys(KATEGORI) as KategoriJurnal[]).map((kk) => (
                <button
                  key={kk}
                  type="button"
                  role="radio"
                  aria-checked={kategori === kk}
                  title={KATEGORI[kk]}
                  className="pjs__tagar"
                  onClick={() => setKategori(kk)}
                >
                  <KepingTagar>{TAGAR[kk].slice(1)}</KepingTagar>
                </button>
              ))}
            </div>
          </section>
          <section>
            <h3 className="pjs__sampingjudul">Alamat</h3>
            <label className="pjs__alamat">
              <span>/jurnal/</span>
              <input
                value={slugKini}
                aria-label="Alamat tulisan"
                maxLength={120}
                onChange={(e) => {
                  setSlugManual(true);
                  setSlug(e.currentTarget.value);
                }}
              />
            </label>
            {awal?.publishedAt && (
              <p className="pjs__sampingket">Sudah terbit — mengubah alamatnya mematikan tautan yang sudah dibagikan.</p>
            )}
          </section>
        </aside>
      </div>

      {/* ---- Terkait ----------------------------------------------------- */}
      <section className="pjs__terkait">
        <KepalaSeksi
          judul="Tulisan Lain di Kategori Ini"
          kanan={<TombolIkon ikon={DotsThree} jenis="transparent" ukuran="xsmall" ikonPx={18} judul="Semua tulisan" href="/admin/jurnal" />}
        />
        <div className="pj__kisi">
          {terkait.map((t) => (
            <a key={t.id} className="pj__kartugrid" href={`/admin/jurnal/satu?id=${encodeURIComponent(t.id)}`}>
              <Sampul t={t} className="pj__sampul--grid" />
              <span className="pj__info">
                <span className="pj__meta">
                  <b>{KATEGORI[t.category]}</b>
                </span>
                <span className="pj__judulsedang">{t.title}</span>
              </span>
            </a>
          ))}
          {terkait.length === 0 && <p className="pj__kosong">Belum ada tulisan lain di kategori ini.</p>}
        </div>
      </section>
    </div>
  );
}

export function JurnalSatuKit({ dibangunPada }: { dibangunPada?: string }) {
  return (
    <RequireAuth skeleton={<div className="pjs pjs--rangka" />}>
      <ToastProvider>
        <Isi dibangunPada={dibangunPada} />
      </ToastProvider>
    </RequireAuth>
  );
}
