import { useState } from "react";
import { navigate } from "astro:transitions/client";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast, titipToast } from "../ui/overlay/Toast";
import { Tombol } from "../kit/Tombol";
import { Isian } from "../kit/Isian";
import { Ikon } from "../kit/Ikon";
import { ImageSquare } from "../kit/ikon";
import { buatProyek, simpanProyek, mintaUrlUnggah, type Proyek } from "../../lib/admin";
import { useCegahPindah } from "../../lib/cegahPindah";
import { setProyekAktif, HALAMAN_PROYEK } from "../../lib/proyekAktif";

/* Langsung ke Halaman Publik proyeknya, BUKAN lewat /admin/proyek/edit.
   Alamat lama itu halaman kit sungguhan yang lalu mengalihkan sendiri — jadi
   ia yang menjemput toast titipan "Proyek dibuat", lalu membuangnya bersama
   dirinya saat mengalihkan. Hasilnya sama: proyek aktif ditetapkan, lalu
   halaman pertama proyek dibuka. */
async function bukaHalamanProyek(id: string) {
  setProyekAktif(id);
  await navigate(HALAMAN_PROYEK[0]!);
}

/* =============================================================================
   Proyek Baru di kerangka kit.

   Tidak punya frame sendiri di Coinest. Bentuknya dipinjam dari frame
   "34. Promo Details" dalam mode ubah — pola yang sudah di-ACC untuk "Paket
   baru": bidang besar di atas, judul, kisi isian dua kolom, lalu baris
   tombol bergaris atas. Kelasnya (.pas__*) memang milik halaman itu dan
   dipakai apa adanya, supaya dua formulir "buat baru" di panel ini tidak
   pernah menyimpang satu sama lain.

   Bidang besarnya di sini KOTAK SAMPUL: diklik untuk memilih gambar, dan
   begitu terunggah ia menampilkan gambarnya — bukan kotak ikon 80px seperti
   di kerangka lama, yang tidak memperlihatkan potongan apa pun.

   Logikanya tidak berubah dari ProjectCreate lama: endpoint pembuatan cuma
   menerima slug, judul, dan kategori; sisanya dikirim sebagai satu patch
   susulan, dan hanya yang benar-benar diisi.
   ============================================================================= */

/* Persis enum `project_category` di database — enam nilai. "Hospitality"
   yang ada di peta label halaman lain TIDAK termasuk: database menolaknya,
   jadi menawarkannya di sini berarti formulir yang gagal saat disimpan. */
const KATEGORI: Record<string, string> = {
  residential: "Hunian",
  commercial: "Komersial",
  interior: "Interior",
  landscape: "Lanskap",
  masterplan: "Masterplan",
  renovation: "Renovasi",
};

/** Mengubah judul jadi slug: huruf kecil, tanpa aksen, dipisah tanda hubung. */
function keSlug(judul: string) {
  return judul
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

const KOSONG = {
  title: "",
  slug: "",
  category: "residential",
  subtitle: "",
  summary: "",
  city: "",
  year: "",
  client: "",
  areaSqm: "",
};

function Isi() {
  const toast = useToast();
  const [f, setF] = useState({ ...KOSONG });
  const [sampul, setSampul] = useState<{ key: string; url: string } | null>(null);
  const [mengunggah, setMengunggah] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

  /* Apa pun yang sudah diketik — termasuk sampul yang sudah terunggah —
     berarti ada yang bisa hilang kalau halaman ditinggalkan. */
  const adaIsian =
    sampul !== null ||
    (Object.keys(KOSONG) as (keyof typeof KOSONG)[]).some((k) => f[k] !== KOSONG[k]);
  useCegahPindah(adaIsian && !menyimpan);

  const set = (k: keyof typeof KOSONG, v: string) => setF((x) => ({ ...x, [k]: v }));
  const judulSah = f.title.trim().length >= 2;
  const bisaSimpan = judulSah && f.slug.length >= 2 && !menyimpan && !mengunggah;
  /* Tombol yang mati selalu menyebut sebabnya — sama dengan editor Jurnal. */
  const alasan = !judulSah
    ? "Isi judul dulu, minimal 2 huruf."
    : mengunggah
      ? "Tunggu sampulnya selesai terunggah."
      : null;

  function kosongkan() {
    setF({ ...KOSONG });
    setSampul((s) => {
      if (s) URL.revokeObjectURL(s.url);
      return null;
    });
  }

  async function unggah(berkas: File) {
    /* Kunci penyimpanannya dikelompokkan per proyek, jadi sampul butuh slug
       — yang belum ada kalau judulnya belum diketik. */
    const slug = f.slug || keSlug(f.title) || "tanpa-slug";
    setMengunggah(true);
    try {
      const target = await mintaUrlUnggah(slug, berkas.type);
      const res = await fetch(target.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": berkas.type },
        body: berkas,
      });
      if (!res.ok) throw new Error(`Penyimpanan menolak berkas (${res.status})`);
      setSampul((s) => {
        if (s) URL.revokeObjectURL(s.url);
        return { key: target.key, url: URL.createObjectURL(berkas) };
      });
    } catch (e) {
      toast({ judul: "Gagal mengunggah sampul", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMengunggah(false);
    }
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    if (!bisaSimpan) return;
    setMenyimpan(true);
    try {
      const { id } = await buatProyek(f.slug, f.title.trim(), f.category);
      const patch: Partial<Proyek> & { coverImageKey?: string } = {};
      if (f.subtitle.trim()) patch.subtitle = f.subtitle.trim();
      if (f.summary.trim()) patch.summary = f.summary.trim();
      if (f.city.trim()) patch.city = f.city.trim();
      if (f.client.trim()) patch.client = f.client.trim();
      if (f.year.trim()) patch.year = Number(f.year);
      if (f.areaSqm.trim()) patch.areaSqm = Number(f.areaSqm);
      if (sampul) patch.coverImageKey = sampul.key;
      if (Object.keys(patch).length > 0) {
        /* Proyeknya SUDAH terbuat. Kalau patch gagal, jangan buang yang sudah
           jadi — cukup beri tahu dan tetap lanjut ke editornya. */
        try {
          await simpanProyek(id, patch);
        } catch (err) {
          /* Dititipkan: toast() di sini lenyap bersama halamannya, dan
             pemilik tidak pernah tahu ada detail yang tidak tersimpan. */
          titipToast({
            judul: "Proyek dibuat, sebagian detail gagal disimpan",
            keterangan: `${(err as Error).message} Isi ulang di halaman ini.`,
            nada: "gagal",
          });
          await bukaHalamanProyek(id);
          return;
        }
      }
      titipToast({ judul: "Proyek dibuat", keterangan: "Lengkapi foto dan ceritanya di sini, lalu tekan Terbitkan.", nada: "sukses" });
      await bukaHalamanProyek(id);
    } catch (err) {
      toast({ judul: "Gagal membuat proyek", keterangan: (err as Error).message, nada: "gagal" });
      setMenyimpan(false);
    }
  }

  return (
    <div className="pas">
      <div className={`pf__sampul${sampul ? "" : " pf__sampul--kosong"}`}>
        {sampul ? (
          <img src={sampul.url} alt="Sampul proyek" />
        ) : (
          <span className="pf__sampulkosong">
            <Ikon ikon={ImageSquare} ukuran={32} />
            <b>Gambar sampul (opsional)</b>
            <small>
              JPG, PNG, WebP, atau AVIF. Tampil sebagai gambar pertama di halaman proyek dan kartunya. Bisa diganti
              kapan saja setelah proyek dibuat.
            </small>
          </span>
        )}
        <span className="pf__sampulaksi">
          {/* Utama selagi kosong — secondary sewarna dengan bidang kosongnya. */}
          <label className={`k-tombol k-tombol--medium ${sampul ? "k-tombol--secondary" : "k-tombol--primary"} pf__unggah`}>
            {mengunggah ? "Mengunggah…" : sampul ? "Ganti sampul" : "Pilih gambar"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              aria-label="Pilih gambar sampul proyek"
              disabled={mengunggah}
              onChange={(e) => {
                const b = e.currentTarget.files?.[0];
                if (b) unggah(b);
                e.currentTarget.value = "";
              }}
            />
          </label>
          {sampul && (
            <Tombol
              ukuran="medium"
              jenis="secondary"
              onClick={() =>
                setSampul((s) => {
                  if (s) URL.revokeObjectURL(s.url);
                  return null;
                })
              }
            >
              Buang sampul
            </Tombol>
          )}
        </span>
      </div>

      <div className="pas__badan">
        <div className="pas__utama">
          <form className="pas__form" onSubmit={simpan}>
            <div className="pas__judulbaris">
              <h2 className="pas__judul">Proyek baru</h2>
            </div>
            <div className="pas__kisi">
              <Isian
                label="Judul proyek"
                required
                maxLength={120}
                placeholder="mis. Rumah Kaca"
                value={f.title}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  /* Slug selalu ikut judul dan tidak bisa disunting sendiri:
                     begitu proyeknya terbit ia sudah jadi URL publik, dan
                     slug yang boleh menyimpang cuma menambah satu hal yang
                     bisa keliru. */
                  setF((x) => ({ ...x, title: v, slug: keSlug(v) }));
                }}
              />
              <label className="k-isian">
                <span className="k-isian__label">Kategori</span>
                <span className="k-isian__kotak pas__pilih">
                  <select value={f.category} onChange={(e) => set("category", e.currentTarget.value)}>
                    {Object.entries(KATEGORI).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <Isian
                label="Alamat halaman"
                className="pas__lebar"
                readOnly
                value={f.slug}
                placeholder="terisi otomatis dari judul"
                bantu={`Dibuat otomatis dari judul. Muncul di URL: /proyek/${f.slug || "…"}`}
              />
              <Isian
                label="Kota"
                placeholder="mis. Pontianak"
                value={f.city}
                onChange={(e) => set("city", e.currentTarget.value)}
              />
              <Isian
                label="Tahun"
                type="number"
                inputMode="numeric"
                min={1900}
                max={2200}
                placeholder="2026"
                value={f.year}
                onChange={(e) => set("year", e.currentTarget.value)}
              />
              <Isian
                label="Klien"
                placeholder="mis. Keluarga Wijaya"
                value={f.client}
                onChange={(e) => set("client", e.currentTarget.value)}
              />
              <Isian
                label="Luas (m²)"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="240"
                value={f.areaSqm}
                onChange={(e) => set("areaSqm", e.currentTarget.value)}
              />
              <Isian
                label="Subjudul"
                className="pas__lebar"
                maxLength={160}
                placeholder="Satu baris penjelas di bawah judul"
                value={f.subtitle}
                onChange={(e) => set("subtitle", e.currentTarget.value)}
              />
            </div>

            <label className="k-isian pas__lebar">
              <span className="k-isian__label">Ringkasan singkat</span>
              <textarea
                className="pas__area"
                rows={4}
                placeholder="Dua sampai tiga kalimat yang muncul di kartu proyek."
                value={f.summary}
                onChange={(e) => set("summary", e.currentTarget.value)}
              />
            </label>

            <p className="pf__catatan">
              Selain judul, semuanya boleh dikosongkan dan diisi belakangan. Proyek baru tersimpan sebagai draf —
              belum tampil di situs sampai diterbitkan dari Halaman Publik.
            </p>

            <div className="pas__aksi">
              <Tombol ukuran="large" jenis="primary" tipeHtml="submit" disabled={!bisaSimpan}>
                {menyimpan ? "Membuat…" : "Buat proyek"}
              </Tombol>
              <Tombol ukuran="large" jenis="ghost" disabled={menyimpan} onClick={() => navigate("/admin/proyek")}>
                Batal
              </Tombol>
              {alasan && <span className="pf__alasan">{alasan}</span>}
              {adaIsian && (
                <button type="button" className="pf__kosongkan" onClick={kosongkan} disabled={menyimpan}>
                  Kosongkan isian
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export function ProyekBaruKit() {
  return (
    <RequireAuth skeleton={<div className="pas pas--rangka" />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
