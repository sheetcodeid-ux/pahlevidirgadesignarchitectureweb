import { PilihMenu } from "../kit/Formulir";
import { Korsel, Rasio } from "../kit/Tampilan";
import { GagalMuat } from "./gagalMuat";
import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { navigate } from "astro:transitions/client";
import { ToastProvider, useToast, titipToast } from "../kit/Toast";
import { AlertDialog } from "../kit/Overlay";
import { Tombol, TombolIkon } from "../kit/Tombol";
import { Isian, Sakelar } from "../kit/Isian";
import { KelompokTab, Segmen } from "../kit/Segmen";
import { Lencana, type NadaLencana } from "../kit/Lencana";
import { Ikon } from "../kit/Ikon";
import {
  ArchiveTray,
  CaretLeft,
  CaretRight,
  Globe,
  ImageSquare,
  NotePencil,
  Trash,
} from "../kit/ikon";
import {
  simpanProyek,
  hapusProyek,
  mintaUrlUnggah,
  daftarGambar,
  tambahGambar,
  ubahGambar,
  hapusGambar,
  bacaCache,
  tulisCache,
  type Proyek,
  type GambarProyek,
  type JenisGambar,
} from "../../lib/admin";
import { usePilihProyek, JudulPilihProyek } from "./pilihProyekKit";
import { TAHAP_PROYEK } from "../../lib/notifikasi";
import { subjudulBerguna } from "../../lib/api";
import { useCegahPindah } from "../../lib/cegahPindah";
import { tanya } from "../../lib/tanya";
import { kecilkanFoto, buatThumb, formatByte } from "../../lib/kecilkanFoto";
import { bukaLightbox } from "../../lib/lightbox";

/* =============================================================================
   Halaman Publik — isi halaman /proyek/<slug> yang dilihat pengunjung situs.

   Tidak punya frame di Coinest. Kerangkanya frame "34. Promo Details" yang
   sama dengan Proyek Baru dan Paket baru: bidang besar di atas, judul, lalu
   badan dua kolom (isi 724 / samping 210). Bidang besarnya SAMPUL proyek —
   gambar pertama yang dilihat pengunjung — jadi ia yang paling atas di sini
   juga.

   Yang berubah dari editor kerangka lama, dan alasannya:

   - Judul halaman sekaligus PEMILIH proyek. Kerangka kit tidak punya
     combobox proyek di bilah atas, dan daftar proyek sudah ada di Semua
     Proyek; yang dibutuhkan di sini cuma berpindah ke proyek sebelah tanpa
     keluar halaman.
   - Status terbit memakai kelompok tab berikon kit (Button Group), bukan
     tiga kartu radio. Ketiganya tetap berdampingan dan saling meniadakan.
   - Galeri KISI, bukan carousel. Carousel adalah penampung yang digulir
     mendatar, dan di trackpad itu mencuri gulir halaman (jebakan #18) —
     kerangka kit tidak memasang penangkalnya seperti situs publik.
   - Tombol Simpan di kolom samping yang lengket, jadi selalu terlihat
     berapa pun panjang tab yang sedang dibuka.

   Logikanya dibawa apa adanya dari editor lama: hanya kolom yang berubah
   yang dikirim, unggahan foto dikecilkan dulu lalu naik tiga sekaligus,
   batas sepuluh foto per jenis, urutan ditukar dua tetangga.
   ============================================================================= */

/* Persis enum `project_category` di database. */
const KATEGORI: Record<string, string> = {
  residential: "Hunian",
  commercial: "Komersial",
  coffeeshop: "Coffee shop",
  interior: "Interior",
  landscape: "Lanskap",
  masterplan: "Masterplan",
  renovation: "Renovasi",
};

const STATUS: Record<string, { label: string; ket: string; nada: NadaLencana }> = {
  draft: { label: "Draf", ket: "Hanya terlihat oleh staf studio.", nada: "menunggu" },
  published: { label: "Terbit", ket: "Tampil di situs setelah situs diterbitkan lagi.", nada: "selesai" },
  archived: { label: "Arsip", ket: "Disembunyikan dari situs tanpa dihapus.", nada: "netral" },
};

/* Batas foto per jenis. Keputusan pemilik, bukan batas teknis: sepuluh foto
   sudah lebih dari cukup untuk satu proyek, dan galeri tak terbatas membuat
   halaman publik lambat tanpa ada yang tahu sebabnya. */
const MAKS_FOTO = 10;

type Draf = Partial<Proyek> & { coverImageKey?: string };
type Tab = "detail" | "galeri" | "seo";

/* Halaman /proyek/<slug> baru ada sesudah build berikutnya: proyek yang
   diterbitkan sesudah build terakhir belum punya halaman, dan tautannya
   berujung 404 sampai Terbitkan ditekan. Stempel build dioper dari .astro
   (lihat JurnalSatuKit). */
/* Tanggal terbit yang KOSONG dianggap sudah dibangun: proyek lama bisa
   saja terbit tanpa published_at, dan menyembunyikan tautannya selamanya
   lebih buruk daripada sesekali 404. Yang disembunyikan cuma yang PASTI
   terbit sesudah build. */
const sudahDibangun = (terbitPada: string | null | undefined, dibangunPada?: string) =>
  !dibangunPada || !terbitPada || terbitPada <= dibangunPada;

function Isi({ dibangunPada }: { dibangunPada?: string }) {
  const toast = useToast();
  const { semua, setSemua, id, asli, galat, pilih } = usePilihProyek();
  const [draf, setDraf] = useState<Draf>({});
  const [tab, setTab] = useState<Tab>("detail");
  const [menyimpan, setMenyimpan] = useState(false);
  const [mengunggah, setMengunggah] = useState(false);
  const [pratinjauSampul, setPratinjauSampul] = useState<string | null>(null);

  const berubah = asli
    ? (Object.keys(draf) as (keyof Draf)[]).filter((k) => draf[k] !== (asli as Draf)[k])
    : [];
  const adaPerubahan = berubah.length > 0;
  useCegahPindah(adaPerubahan);

  const set = <K extends keyof Draf>(k: K, v: Draf[K]) => setDraf((d) => ({ ...d, [k]: v }));
  const nilai = <K extends keyof Draf>(k: K): Draf[K] | undefined =>
    (k in draf ? draf[k] : (asli as Draf | null)?.[k]) as Draf[K] | undefined;
  const teks = (k: keyof Draf) => String(nilai(k) ?? "");

  const adaSampul = Boolean(pratinjauSampul || nilai("coverImageUrl") || nilai("coverImageKey"));
  const status = String(nilai("status") ?? "draft");

  async function gantiProyek(baru: string) {
    if (baru === asli?.id) return;
    if (
      adaPerubahan &&
      !(await tanya({ judul: "Pindah proyek?", isi: `Ada ${berubah.length} perubahan yang belum disimpan.`, ya: "Tinggalkan", bahaya: true }))
    )
      return;
    pilih(baru);
    setDraf({});
    setPratinjauSampul((l) => {
      if (l) URL.revokeObjectURL(l);
      return null;
    });
  }

  async function simpan() {
    if (!asli || !adaPerubahan) return;
    setMenyimpan(true);
    try {
      /* Hanya kolom yang berubah: selain hemat, dua orang yang menyunting
         bersamaan tidak saling menimpa kolom yang tidak mereka sentuh. */
      const patch: Record<string, unknown> = {};
      berubah.forEach((k) => {
        patch[k] = draf[k];
      });
      await simpanProyek(asli.id, patch as Partial<Proyek>);
      const baru = { ...asli, ...draf } as Proyek;
      if (pratinjauSampul) baru.coverImageUrl = pratinjauSampul;
      setSemua((s) => s?.map((p) => (p.id === asli.id ? baru : p)) ?? s);
      setDraf({});
      toast({
        judul: "Perubahan disimpan",
        keterangan: "Situs publik baru berubah setelah tombol Terbitkan ditekan.",
        nada: "sukses",
      });
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenyimpan(false);
    }
  }

  async function unggahSampul(f: File) {
    if (!asli) return;
    setMengunggah(true);
    try {
      const kecil = await kecilkanFoto(f);
      const target = await mintaUrlUnggah(asli.slug, kecil.berkas.type);
      const res = await fetch(target.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": kecil.berkas.type },
        body: kecil.berkas,
      });
      if (!res.ok) throw new Error(`Penyimpanan menolak berkas (${res.status})`);
      set("coverImageKey", target.key);
      setPratinjauSampul((l) => {
        if (l) URL.revokeObjectURL(l);
        return URL.createObjectURL(f);
      });
      toast({ judul: "Sampul terunggah", keterangan: "Tekan Simpan untuk memasangnya.", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal mengunggah sampul", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMengunggah(false);
    }
  }

  if (galat) return <GagalMuat apa="Proyek" galat={galat} />;
  if (!semua) return <div className="pas pas--rangka" aria-busy="true" />;
  if (!asli) {
    return (
      <div className="pas">
        <p className="pf__kosong">
          {id ? "Proyek ini tidak ditemukan — mungkin sudah dihapus." : "Belum ada proyek."}{" "}
          <a href="/admin/proyek">Buka Semua Proyek</a>
        </p>
      </div>
    );
  }

  const gambarSampul = pratinjauSampul ?? (nilai("coverImageUrl") as string | undefined) ?? null;
  const subjudulSama =
    teks("subtitle").trim() !== "" && !subjudulBerguna({ title: teks("title"), subtitle: teks("subtitle") });

  return (
    <div className="pas">
      {/* ---- Sampul -------------------------------------------------------- */}
      <div className={`pf__sampul${gambarSampul ? "" : " pf__sampul--kosong"}`}>
        {gambarSampul ? (
          <img src={gambarSampul} alt={`Sampul ${asli.title}`} />
        ) : (
          <span className="pf__sampulkosong">
            <Ikon ikon={ImageSquare} ukuran={32} />
            <b>Belum ada sampul</b>
            <small>Proyek tidak bisa diterbitkan tanpa sampul. Bisa juga memakai salah satu foto galeri.</small>
          </span>
        )}
        <span className="pf__sampulaksi">
          <label
            className={`k-tombol k-tombol--medium ${gambarSampul ? "k-tombol--secondary" : "k-tombol--primary"} pf__unggah`}
          >
            {mengunggah ? "Mengunggah…" : gambarSampul ? "Ganti sampul" : "Unggah sampul"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              aria-label="Pilih gambar sampul proyek"
              disabled={mengunggah}
              onChange={(e) => {
                const b = e.currentTarget.files?.[0];
                if (b) unggahSampul(b);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </span>
      </div>

      <div className="pas__badan">
        <div className="pas__utama pf__utama">
          {/* ---- Judul yang sekaligus pemilih proyek ------------------------ */}
          <div className="pas__judulbaris">
            <JudulPilihProyek semua={semua} asli={asli} onPilih={gantiProyek} />
          </div>

          {/* ---- Status terbit ---------------------------------------------- */}
          <section className="pf__bagian" aria-label="Status terbit">
            <KelompokTab
              judul="Status terbit"
              className="pf__status"
              nilai={status}
              onPilih={(v) => {
                if (v === "published" && !adaSampul) {
                  toast({ judul: "Belum bisa terbit", keterangan: "Unggah sampul dulu.", nada: "gagal" });
                  return;
                }
                set("status", v);
              }}
              tab={[
                { nilai: "draft", label: "Draf", ikon: NotePencil },
                { nilai: "published", label: "Terbit", ikon: Globe },
                { nilai: "archived", label: "Arsip", ikon: ArchiveTray },
              ]}
            />
            {!adaSampul && status !== "published" && <p className="pf__statusket">Unggah sampul dulu sebelum menerbitkan.</p>}
            <div className="pas__sakelar">
              <label>
                <Sakelar
                  judul="Tampilkan di beranda"
                  checked={Boolean(nilai("isFeatured"))}
                  onChange={(e) => set("isFeatured", e.currentTarget.checked)}
                />
                <span>
                  <b>Tampilkan di beranda</b>
                  <small>Proyek unggulan muncul di halaman depan situs.</small>
                </span>
              </label>
            </div>
          </section>

          <Segmen
            judul="Bagian halaman proyek"
            className="pf__tab"
            nilai={tab}
            onPilih={(v) => setTab(v as Tab)}
            segmen={[
              { nilai: "detail", label: "Detail" },
              { nilai: "galeri", label: "Galeri" },
              { nilai: "seo", label: "SEO" },
            ]}
          />

          {/* ---- Detail ------------------------------------------------------ */}
          <div className="pas__form" hidden={tab !== "detail"}>
            <div className="pas__kisi">
              <Isian
                label="Judul"
                className="pas__lebar"
                value={teks("title")}
                onChange={(e) => set("title", e.currentTarget.value)}
              />
              <Isian
                label="Alamat halaman"
                className="pas__lebar"
                value={teks("slug")}
                onChange={(e) => set("slug", e.currentTarget.value)}
                bantu={`/proyek/${teks("slug") || "…"}`}
              />
              <Isian
                label="Subjudul"
                className={`pas__lebar${subjudulSama ? " pf__peringatan" : ""}`}
                placeholder="mis. Rumah yang menjaga kebunnya"
                value={teks("subtitle")}
                onChange={(e) => set("subtitle", e.currentTarget.value)}
                /* Peringatan, bukan larangan: situs sengaja melewatkan
                   subjudul yang sama dengan judulnya, dan melewatkannya
                   diam-diam membuat pemilik menyangka ada yang rusak. */
                bantu={subjudulSama ? "Sama dengan judul — tidak akan ditampilkan." : undefined}
              />
            </div>
            <label className="k-isian pas__lebar">
              <span className="k-isian__label">Ringkasan</span>
              <textarea
                className="pas__area"
                rows={3}
                placeholder="mis. Rumah dua lantai di lahan 8×15 m yang mempertahankan pohon mangga di tengah tapak."
                value={teks("summary")}
                onChange={(e) => set("summary", e.currentTarget.value)}
              />
            </label>
            <label className="k-isian pas__lebar">
              <span className="k-isian__label">Deskripsi</span>
              <textarea
                className="pas__area"
                rows={8}
                value={teks("description")}
                onChange={(e) => set("description", e.currentTarget.value)}
              />
            </label>
            <div className="pas__kisi">
              <Isian label="Kota" placeholder="Pontianak" value={teks("city")} onChange={(e) => set("city", e.currentTarget.value)} />
              <Isian
                label="Lokasi"
                placeholder="Jl. KH Wahid Hasyim"
                value={teks("location")}
                onChange={(e) => set("location", e.currentTarget.value)}
              />
              <Isian
                label="Tahun"
                type="number"
                inputMode="numeric"
                placeholder="2026"
                value={teks("year")}
                onChange={(e) => set("year", e.currentTarget.value ? Number(e.currentTarget.value) : undefined)}
              />
              <Isian
                label="Luas (m²)"
                type="number"
                inputMode="numeric"
                placeholder="100"
                value={teks("areaSqm")}
                onChange={(e) => set("areaSqm", e.currentTarget.value ? Number(e.currentTarget.value) : undefined)}
              />
              {/* Boleh ditempel apa adanya dari kontak ponsel — API yang
                  membuang spasi, plus, dan tanda hubung. Nomor inilah yang
                  dipakai tombol WA di bukti pembayaran. */}
              <Isian
                label="No WhatsApp klien"
                type="tel"
                inputMode="tel"
                placeholder="628123456789"
                value={teks("clientWhatsapp")}
                onChange={(e) => set("clientWhatsapp", e.currentTarget.value)}
              />
            </div>

            <h3 className="pf__subjudul">Kredit</h3>
            <div className="pas__kisi">
              <div className="k-isian">
                <span className="k-isian__label">Kategori</span>
                <PilihMenu
                  label="Kategori"
                  nilai={teks("category") || "residential"}
                  onUbah={(v) => set("category", v)}
                  opsi={[
                    ...Object.entries(KATEGORI).map(([v, l]) => ({ nilai: v, label: l })),
                    ...(!KATEGORI[teks("category")] && teks("category") ? [{ nilai: teks("category"), label: teks("category") }] : []),
                  ]}
                />
              </div>
              <Isian
                label="Arsitek"
                placeholder="Pahlevi Dirga"
                value={teks("leadArchitect")}
                onChange={(e) => set("leadArchitect", e.currentTarget.value)}
              />
              <Isian label="Klien" value={teks("client")} onChange={(e) => set("client", e.currentTarget.value)} />
              <Isian
                label="Kontraktor"
                placeholder="CV Karya Bangun"
                value={teks("contractor")}
                onChange={(e) => set("contractor", e.currentTarget.value)}
              />
              <Isian
                label="Pencahayaan"
                placeholder="Studio Cahaya"
                value={teks("lightingDesigner")}
                onChange={(e) => set("lightingDesigner", e.currentTarget.value)}
              />
              <Isian
                label="Fotografer"
                value={teks("photographer")}
                onChange={(e) => set("photographer", e.currentTarget.value)}
              />
            </div>
          </div>

          {/* ---- Galeri ------------------------------------------------------ */}
          <div className="pas__form" hidden={tab !== "galeri"}>
            <PanelFoto
              proyek={asli}
              jenis="galeri"
              kunciSampul={(nilai("coverImageKey") as string | undefined) ?? null}
              urlSampul={(asli.coverImageUrl as string | undefined) ?? null}
              onJadikanSampul={(g) => {
                set("coverImageKey", g.storageKey);
                setPratinjauSampul((l) => {
                  if (l && l.startsWith("blob:")) URL.revokeObjectURL(l);
                  return g.url;
                });
                toast({ judul: "Dipakai sebagai sampul", keterangan: "Tekan Simpan untuk memasangnya.", nada: "sukses" });
              }}
            />
            <PanelFoto proyek={asli} jenis="material" />
          </div>

          {/* ---- SEO --------------------------------------------------------- */}
          <div className="pas__form" hidden={tab !== "seo"}>
            <Isian
              label="Judul di hasil pencarian"
              placeholder={`${asli.title} — ${KATEGORI[String(asli.category)] ?? "proyek"} di ${asli.city ?? "Pontianak"}`}
              value={teks("seoTitle")}
              onChange={(e) => set("seoTitle", e.currentTarget.value)}
            />
            <label className="k-isian pas__lebar">
              <span className="k-isian__label">Deskripsi di hasil pencarian</span>
              <textarea
                className="pas__area"
                rows={3}
                maxLength={200}
                placeholder="Satu kalimat yang tampil di bawah judul pada hasil pencarian Google."
                value={teks("seoDescription")}
                onChange={(e) => set("seoDescription", e.currentTarget.value)}
              />
            </label>
          </div>
        </div>

        {/* ---- Kolom samping ------------------------------------------------- */}
        <aside className="pf__samping" aria-label="Keadaan proyek">
          <div className="pf__info">
          <p className="pas__sampingjudul">Keadaan</p>
          <dl className="pf__fakta">
            <div>
              <dt>Status</dt>
              <dd>
                <Lencana nada={STATUS[status]?.nada ?? "netral"}>{STATUS[status]?.label ?? status}</Lencana>
              </dd>
            </div>
            <div>
              <dt>Tahap</dt>
              <dd>{TAHAP_PROYEK[asli.pipelineStage ?? ""] ?? "Belum ditentukan"}</dd>
            </div>
            <div>
              <dt>Alamat</dt>
              <dd className="pf__alamat">/proyek/{teks("slug")}</dd>
            </div>
          </dl>
          {asli.status === "published" && !sudahDibangun(asli.publishedAt, dibangunPada) && (
            <p className="pf__statusket">Belum tayang — tekan Terbitkan.</p>
          )}
          {asli.status === "published" && sudahDibangun(asli.publishedAt, dibangunPada) && (
            <a className="pf__tautan" href={`/proyek/${asli.slug}`} target="_blank" rel="noreferrer">
              <Ikon ikon={Globe} ukuran={14} />
              Lihat di situs
            </a>
          )}
          </div>

          <div className="pf__simpan">
            <Tombol memuat={menyimpan} ukuran="large" jenis="primary" disabled={!adaPerubahan || menyimpan} onClick={simpan}>
              {menyimpan ? "Menyimpan…" : "Simpan perubahan"}
            </Tombol>
            <p className={`pf__penanda${adaPerubahan ? " pf__penanda--belum" : ""}`}>
              <span aria-hidden="true" />
              {adaPerubahan ? `${berubah.length} perubahan belum disimpan` : "Semua perubahan tersimpan"}
            </p>
          </div>

          <AlertDialog
            destructive
            title={`Hapus ${asli.title}?`}
            description="Gambar, tagihan, pembayaran, dan biayanya ikut terhapus."
            confirmLabel="Ya, hapus"
            onConfirm={async () => {
              try {
                await hapusProyek(asli.id);
                /* Dititipkan ke halaman tujuan, dan pindahnya lewat router —
                   dulu `location.href` memuat ulang panel penuh dan toastnya
                   lenyap bersama halaman ini sebelum sempat terbaca. */
                titipToast({
                  judul: "Proyek dihapus",
                  keterangan: `${asli.title} beserta gambarnya. Tekan Terbitkan supaya halamannya ikut hilang dari situs.`,
                  nada: "sukses",
                });
                await navigate("/admin/proyek");
              } catch (e) {
                toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
              }
            }}
            trigger={
              <button type="button" className="pas__hapus pf__hapus">
                Hapus proyek
              </button>
            }
          />
        </aside>
      </div>
    </div>
  );
}

/* --- Kisi foto: galeri dan material ------------------------------------------

   Satu panel untuk dua jenis foto; yang berbeda cuma kalimat dan tombol
   "Jadikan sampul" (foto material bukan potret proyeknya, jadi tombolnya
   tidak ada di sana sama sekali — bukan ada tapi tidak berfungsi). */
const KATA = {
  galeri: {
    judul: "Foto galeri",
    ket: "Tampil di halaman proyek, urut seperti di bawah.",
    kosong: "Belum ada foto galeri. Seksi galeri di situs baru muncul kalau ada isinya.",
    seret: "Tarik foto ke sini, atau klik untuk memilih",
    label: "Keterangan (opsional)",
  },
  material: {
    judul: "Material yang dipakai",
    ket: "Bahan yang membentuk proyek ini — beri nama tiap fotonya.",
    kosong: "Belum ada foto material. Contoh: batu alam, kayu jati, beton ekspos.",
    seret: "Tarik foto material ke sini, atau klik untuk memilih",
    label: "Nama material",
  },
} as const;

function PanelFoto({
  proyek,
  jenis,
  kunciSampul,
  urlSampul,
  onJadikanSampul,
}: {
  proyek: Proyek;
  jenis: JenisGambar;
  kunciSampul?: string | null;
  urlSampul?: string | null;
  onJadikanSampul?: (g: GambarProyek) => void;
}) {
  const kata = KATA[jenis as keyof typeof KATA];
  const toast = useToast();
  const kunciCache = `gambar:${jenis}:${proyek.id}`;
  const [gambar, setGambar] = useState<GambarProyek[] | null>(() => bacaCache<GambarProyek[]>(kunciCache));
  const [mengunggah, setMengunggah] = useState(0);
  const [diseret, setDiseret] = useState(false);
  const berkas = useRef<HTMLInputElement>(null);

  function muat() {
    daftarGambar(proyek.id, jenis)
      .then((d) => {
        tulisCache(kunciCache, d);
        setGambar(d);
      })
      .catch(() => setGambar((l) => l ?? []));
  }
  /* `jenis` ikut jadi dependensi: panel ini dipakai dua kali di halaman yang
     sama, dan tanpanya panel material menampilkan foto galeri. */
  useEffect(() => {
    setGambar(bacaCache<GambarProyek[]>(kunciCache));
    muat();
  }, [proyek.id, jenis]);

  async function unggahSatu(f: File, urutan: number) {
    /* Dikecilkan LEBIH DULU: yang menghabiskan waktu bukan permintaan
       presign-nya, melainkan megabyte yang naik lewat koneksi rumah. */
    const kecil = await kecilkanFoto(f);
    const target = await mintaUrlUnggah(proyek.slug, kecil.berkas.type);
    const res = await fetch(target.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": kecil.berkas.type },
      body: kecil.berkas,
    });
    if (!res.ok) throw new Error(`Penyimpanan menolak ${f.name} (${res.status})`);
    /* Versi kecil SESUDAH yang besar selamat, dan kegagalannya tidak
       menggagalkan unggahan: thumbnail percepatan, bukan syarat. */
    let thumbKey: string | null = null;
    try {
      const t = await buatThumb(kecil.berkas);
      if (t) {
        const s = await mintaUrlUnggah(proyek.slug, t.type);
        const r = await fetch(s.uploadUrl, { method: "PUT", headers: { "Content-Type": t.type }, body: t });
        if (r.ok) thumbKey = s.key;
      }
    } catch {
      /* foto besarnya sudah aman — itu yang penting */
    }
    await tambahGambar(proyek.id, target.key, urutan, jenis, thumbKey);
    return { asli: kecil.byteAsli, kirim: kecil.byteBaru };
  }

  async function unggahBanyak(files: FileList | File[]) {
    const semua = [...files].filter((f) => f.type.startsWith("image/"));
    if (semua.length === 0) return;
    /* Dipotong, bukan ditolak seluruhnya: menolak sepuluh berkas karena yang
       kesebelas kelebihan membuang sembilan unggahan yang sah. */
    const sisa = MAKS_FOTO - (gambar?.length ?? 0);
    if (sisa <= 0) {
      toast({ judul: `${kata.judul} penuh`, keterangan: `Maksimum ${MAKS_FOTO} foto.`, nada: "gagal" });
      return;
    }
    const daftar = semua.slice(0, sisa);
    if (semua.length > sisa) {
      toast({ judul: `${daftar.length} foto diunggah`, keterangan: `Sisanya dilewati — maksimum ${MAKS_FOTO} foto.`, nada: "gagal" });
    }
    setMengunggah(daftar.length);
    /* Urutan ditetapkan SEKARANG, jadi unggahannya boleh selesai dalam urutan
       apa pun tanpa mengacak galeri. Tiga sekaligus: satu-satu membuang waktu
       tunggu jaringan, sepuluh sekaligus berebut satu jalur unggah rumahan. */
    const antre = daftar.map((f, i) => ({ f, urutan: (gambar?.length ?? 0) + i }));
    let gagal = 0;
    let byteAsli = 0;
    let byteKirim = 0;
    const pekerja = async () => {
      for (;;) {
        const t = antre.shift();
        if (!t) return;
        try {
          const u = await unggahSatu(t.f, t.urutan);
          byteAsli += u.asli;
          byteKirim += u.kirim;
        } catch (e) {
          gagal += 1;
          toast({ judul: "Gagal mengunggah", keterangan: (e as Error).message, nada: "gagal" });
        } finally {
          setMengunggah((n) => n - 1);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, daftar.length) }, pekerja));
    muat();
    const berhasil = daftar.length - gagal;
    if (berhasil > 0) {
      toast({
        judul: `${berhasil} foto terunggah`,
        keterangan: byteKirim < byteAsli ? `${formatByte(byteAsli)} dikecilkan jadi ${formatByte(byteKirim)} sebelum dikirim.` : undefined,
        nada: "sukses",
      });
    }
  }

  async function simpanKeterangan(g: GambarProyek, caption: string) {
    if ((g.caption ?? "") === caption) return;
    try {
      await ubahGambar(g.id, { caption: caption || null });
      setGambar((a) => a?.map((x) => (x.id === g.id ? { ...x, caption } : x)) ?? a);
    } catch (e) {
      toast({ judul: "Gagal menyimpan keterangan", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  /** Menukar posisi satu foto dengan tetangganya — dua tulisan, bukan sepuluh. */
  async function geser(i: number, arah: -1 | 1) {
    if (!gambar) return;
    const j = i + arah;
    if (j < 0 || j >= gambar.length) return;
    const baru = gambar.slice();
    [baru[i], baru[j]] = [baru[j]!, baru[i]!];
    const urut = baru.map((g, k) => ({ ...g, sortOrder: k }));
    setGambar(urut);
    try {
      await Promise.all([ubahGambar(urut[i]!.id, { sortOrder: i }), ubahGambar(urut[j]!.id, { sortOrder: j })]);
    } catch (e) {
      setGambar(gambar);
      toast({ judul: "Gagal mengubah urutan", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function hapus(g: GambarProyek) {
    if (!gambar) return;
    const sebelum = gambar;
    setGambar(gambar.filter((x) => x.id !== g.id));
    try {
      await hapusGambar(g.id);
    } catch (e) {
      setGambar(sebelum);
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  const jadiSampul = (g: GambarProyek) =>
    kunciSampul ? g.storageKey === kunciSampul : Boolean(urlSampul && g.url === urlSampul);

  return (
    <section className="pf__foto" aria-label={kata.judul}>
      <div className="pf__fotokepala">
        <h3 className="pf__subjudul">{kata.judul}</h3>
        <span className="pf__fotojumlah">
          {gambar?.length ?? 0}/{MAKS_FOTO}
        </span>
      </div>
      <p className="pf__fotoket">{kata.ket}</p>

      <div
        className="pf__seret"
        data-diseret={diseret || undefined}
        role="button"
        tabIndex={0}
        aria-label={kata.seret}
        onClick={() => berkas.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            berkas.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDiseret(true);
        }}
        onDragLeave={() => setDiseret(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDiseret(false);
          unggahBanyak(e.dataTransfer.files);
        }}
      >
        <Ikon ikon={ImageSquare} ukuran={22} />
        <b>{mengunggah > 0 ? `Mengunggah ${mengunggah} foto…` : kata.seret}</b>
        <small>JPG, PNG, WebP, atau AVIF. Foto besar dikecilkan otomatis sebelum dikirim.</small>
      </div>
      <input
        ref={berkas}
        type="file"
        multiple
        className="sr-only"
        aria-label={`Pilih ${kata.judul.toLowerCase()} untuk diunggah`}
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(e) => {
          if (e.currentTarget.files) unggahBanyak(e.currentTarget.files);
          e.currentTarget.value = "";
        }}
      />

      {gambar === null ? (
        <p className="pf__fotoket">Memuat foto…</p>
      ) : gambar.length === 0 ? (
        <p className="pf__fotoket">{kata.kosong}</p>
      ) : (
        <>
          {/* Korsel kit: foto dalam URUTAN yang dilihat pengunjung di galeri
              mendatar halaman proyek — kisi di bawah untuk mengaturnya. */}
          {gambar.length > 1 && (
            <div className="pf__urutan">
              <p className="pf__fotoket">Urutan di halaman publik — geser seperti pengunjung menggeser galerinya.</p>
              <Korsel label="Pratinjau urutan foto" lebarButir={200}>
                {gambar.map((g, i) => (
                  <figure key={g.id} className="pf__urutanfoto">
                    <Rasio rasio={4 / 3}>
                      <img src={g.thumbUrl ?? g.url} alt={g.altText ?? ""} loading="lazy" decoding="async" />
                    </Rasio>
                    <figcaption>
                      {i + 1}. {g.caption || "Tanpa keterangan"}
                    </figcaption>
                  </figure>
                ))}
              </Korsel>
            </div>
          )}
          <ul className="pf__kisi">
          {gambar.map((g, i) => (
            <li key={g.id} className="pf__ubin">
              {/* Dibuka besar di penampil yang sama dengan halaman publik —
                  satu penampil untuk seluruh situs. */}
              <button
                type="button"
                className="pf__ubingambar"
                aria-label={`Lihat foto ${i + 1} besar`}
                onClick={() => bukaLightbox(gambar.map((x) => ({ url: x.url, caption: x.caption, altText: x.altText })), i)}
              >
                <img src={g.thumbUrl ?? g.url} alt={g.altText ?? ""} loading="lazy" decoding="async" />
                {jadiSampul(g) && <span className="pf__ubinsampul">Sampul</span>}
              </button>
              <input
                className="pf__keterangan"
                aria-label={`${kata.label} foto ${i + 1}`}
                placeholder={kata.label}
                defaultValue={g.caption ?? ""}
                onBlur={(e) => simpanKeterangan(g, e.currentTarget.value.trim())}
              />
              <div className="pf__ubinaksi">
                <TombolIkon
                  ikon={CaretLeft}
                  ukuran="xsmall"
                  jenis="ghost"
                  judul={`Majukan foto ${i + 1}`}
                  disabled={i === 0}
                  onClick={() => geser(i, -1)}
                />
                <TombolIkon
                  ikon={CaretRight}
                  ukuran="xsmall"
                  jenis="ghost"
                  judul={`Mundurkan foto ${i + 1}`}
                  disabled={i === gambar.length - 1}
                  onClick={() => geser(i, 1)}
                />
                {onJadikanSampul && !jadiSampul(g) && (
                  <button type="button" className="pf__jadisampul" onClick={() => onJadikanSampul(g)}>
                    Jadikan sampul
                  </button>
                )}
                <AlertDialog
                  destructive
                  title="Hapus foto ini?"
                  description="Tidak bisa dikembalikan."
                  confirmLabel="Ya, hapus"
                  onConfirm={() => hapus(g)}
                  /* Tombol asli, bukan TombolIkon: pemicu Radix butuh ref
                     untuk mengembalikan fokus saat dialognya ditutup, dan
                     TombolIkon tidak meneruskan ref. */
                  trigger={
                    <button
                      type="button"
                      className="k-tombolikon k-tombolikon--xsmall k-tombol--ghost pf__hapusfoto"
                      aria-label={`Hapus foto ${i + 1}`}
                      title={`Hapus foto ${i + 1}`}
                    >
                      <Ikon ikon={Trash} ukuran={12} />
                    </button>
                  }
                />
              </div>
            </li>
          ))}
        </ul>
        </>
      )}
    </section>
  );
}

export function HalamanPublikKit({ dibangunPada }: { dibangunPada?: string }) {
  return (
    <RequireAuth skeleton={<div className="pas pas--rangka" />}>
      <ToastProvider>
        <Isi dibangunPada={dibangunPada} />
      </ToastProvider>
    </RequireAuth>
  );
}
