import { IsianPanjang, IsianTanggal, IsianTempel, KelompokIsian, PilihMenu } from "../kit/Formulir";
import { Lipat } from "../kit/Tampilan";
import { useEffect, useMemo, useState } from "react";
import { navigate } from "astro:transitions/client";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast, titipToast } from "../kit/Toast";
import { Tombol, TombolIkon } from "../kit/Tombol";
import { Isian } from "../kit/Isian";
import { Ikon } from "../kit/Ikon";
import { ImageSquare, Plus, X } from "../kit/ikon";
import {
  buatProyek, simpanProyek, mintaUrlUnggah, daftarTim, ambilAturanFee, tambahTimProyek, pctBawaan, daftarPaket,
  LABEL_PERAN, URUTAN_PERAN, type Proyek, type AnggotaTim, type AturanFee, type PeranTim, type Paket,
} from "../../lib/admin";
import { PilihPaket } from "./pilihPaket";
import { formatRupiah } from "../../lib/format";
import { useCegahPindah } from "../../lib/cegahPindah";
import { setProyekAktif } from "../../lib/proyekAktif";

/* Sesudah dibuat, yang dibuka SATU PROYEK — bukan Halaman Publik seperti
   dulu. Proyek kini lahir sebagai PEKERJAAN (baris LIST PROJECT di Excel
   pemilik): yang dikerjakan sesudahnya tim, tagihan, dan tahapnya; halaman
   publik datang belakangan, kalau hasilnya layak dipotret. Langsung ke
   alamatnya, bukan lewat /admin/proyek/edit yang mengalihkan sendiri dan
   ikut membuang toast titipan. */
async function bukaSatuProyek(id: string) {
  setProyekAktif(id);
  await navigate(`/admin/proyek/satu?id=${encodeURIComponent(id)}`);
}

/* =============================================================================
   Proyek Baru di kerangka kit — sebagai FORM PEKERJAAN.

   Urutan isiannya mengikuti sheet "LIST PROJECT" di Excel pemilik, bukan
   halaman portofolio: klien, jenis, nama, kota, lingkup kerja, tim desain per
   peran, fee design, tenggat. Halaman publik (sampul, subjudul, ringkasan)
   turun jadi bagian lipat "bisa nanti" — dulu justru itu yang di atas, dan
   proyek yang baru deal dipaksa mulai dari foto yang belum ada.

   Bidang besar di atas tidak lagi kotak sampul melainkan HITUNGANNYA: fee
   design, bagian tim, dan sisa untuk studio, dihitung langsung saat diketik.
   Persen tiap peran diambil dari Aturan Fee Tim; Leader dan Estimator kosong
   sampai pemilik menentukannya.

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
  coffeeshop: "Coffee shop",
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
  client: "",
  title: "",
  category: "coffeeshop",
  city: "",
  location: "",
  scopeOfWork: "",
  tierId: "",
  fee: "",
  deadlinePreview: "",
  deadlineFinal: "",
  subtitle: "",
  summary: "",
  year: "",
  areaSqm: "",
};

interface BarisTim {
  kunci: string;
  role: PeranTim;
  orang: string;
  pct: string;
  /** Baris tambahan (peran dibagi dua orang) bisa dibuang; empat baris dasar tidak. */
  tambahan: boolean;
  /** Persen sudah disentuh staf — jangan ditimpa saat aturan studio tiba. */
  disentuh: boolean;
}

const barisDasar = (): BarisTim[] =>
  URUTAN_PERAN.map((role) => ({ kunci: role, role, orang: "", pct: "", tambahan: false, disentuh: false }));

/** "12.000.000" ↔ 12000000. Titik ribuan ditulis saat mengetik, seperti di Excel pemilik. */
const angkaDari = (v: string) => Number(v.replace(/\D/g, "")) || 0;
const titikRibuan = (v: string) => {
  const n = v.replace(/\D/g, "");
  return n ? Number(n).toLocaleString("id-ID") : "";
};

function Isi() {
  const toast = useToast();
  const [f, setF] = useState({ ...KOSONG });
  const [tim, setTim] = useState<BarisTim[]>(barisDasar);
  const [orangTim, setOrangTim] = useState<AnggotaTim[]>([]);
  const [aturan, setAturan] = useState<AturanFee | null>(null);
  const [paket, setPaket] = useState<Paket[]>([]);
  const [sampul, setSampul] = useState<{ key: string; url: string } | null>(null);
  const [mengunggah, setMengunggah] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    daftarTim().then((d) => setOrangTim(d.filter((o) => o.active))).catch(() => setOrangTim([]));
    daftarPaket().then(setPaket).catch(() => setPaket([]));
    ambilAturanFee()
      .then((a) => {
        setAturan(a);
        /* Persen bawaan baru diketahui sekarang. Baris yang sudah disentuh
           staf dibiarkan — mengetik lebih cepat dari jaringan bukan salah. */
        setTim((t) =>
          t.map((b) => (b.disentuh ? b : { ...b, pct: pctBawaan(a, b.role)?.toString().replace(".", ",") ?? "" })),
        );
      })
      .catch(() => setAturan(null));
  }, []);

  const adaIsian =
    sampul !== null ||
    tim.some((b) => b.orang) ||
    (Object.keys(KOSONG) as (keyof typeof KOSONG)[]).some((k) => f[k] !== KOSONG[k]);
  useCegahPindah(adaIsian && !menyimpan);

  const set = (k: keyof typeof KOSONG, v: string) => setF((x) => ({ ...x, [k]: v }));
  const setBaris = (kunci: string, patch: Partial<BarisTim>) =>
    setTim((t) => t.map((b) => (b.kunci === kunci ? { ...b, ...patch } : b)));

  const fee = angkaDari(f.fee);
  const persen = (b: BarisTim) => {
    const v = b.pct.replace(",", ".").trim();
    return v === "" ? null : Number(v);
  };
  const rupiahBaris = (b: BarisTim) => {
    const p = persen(b);
    return b.orang && fee > 0 && p !== null && Number.isFinite(p) ? Math.round((fee * p) / 100) : null;
  };
  const terisi = tim.filter((b) => b.orang);
  const bagianTim = terisi.reduce((n, b) => n + (rupiahBaris(b) ?? 0), 0);
  const pctTim = terisi.reduce((n, b) => n + (persen(b) ?? 0), 0);
  const belumDitentukan = terisi.filter((b) => persen(b) === null);

  const judul = (f.title.trim() || f.client.trim()).slice(0, 120);
  const slug = keSlug(judul);
  const pctSalah = tim.some((b) => {
    const p = persen(b);
    return p !== null && (!Number.isFinite(p) || p < 0 || p > 100);
  });
  const urutanSalah = !!(f.deadlinePreview && f.deadlineFinal && f.deadlineFinal < f.deadlinePreview);
  /* Tombol yang mati selalu menyebut sebabnya — sama dengan editor Jurnal. */
  const alasan =
    f.client.trim().length < 2
      ? "Isi nama klien dulu, minimal 2 huruf."
      : slug.length < 2
        ? "Nama proyek butuh minimal 2 huruf atau angka."
        : pctSalah
          ? "Persen peran harus angka 0–100."
          : urutanSalah
            ? "Tenggat final tidak boleh sebelum tenggat preview."
            : mengunggah
              ? "Tunggu sampulnya selesai terunggah."
              : null;
  const bisaSimpan = !alasan && !menyimpan;

  /* Orang yang sudah dipilih di peran yang sama tidak ditawarkan lagi di
     baris tambahan peran itu — database menolak pasangan yang sama dua kali. */
  const pilihanOrang = (b: BarisTim) =>
    orangTim.filter((o) => o.id === b.orang || !tim.some((x) => x !== b && x.role === b.role && x.orang === o.id));

  function kosongkan() {
    setF({ ...KOSONG });
    setTim(barisDasar().map((b) => ({ ...b, pct: aturan ? pctBawaan(aturan, b.role)?.toString().replace(".", ",") ?? "" : "" })));
    setSampul((s) => {
      if (s) URL.revokeObjectURL(s.url);
      return null;
    });
  }

  async function unggah(berkas: File) {
    /* Kunci penyimpanannya dikelompokkan per proyek, jadi sampul butuh slug
       — yang belum ada kalau nama dan kliennya belum diketik. */
    setMengunggah(true);
    try {
      const target = await mintaUrlUnggah(slug || "tanpa-slug", berkas.type);
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
      const { id } = await buatProyek(slug, judul, f.category);
      const patch: Partial<Proyek> & { coverImageKey?: string } = { client: f.client.trim() };
      if (f.city.trim()) patch.city = f.city.trim();
      if (f.location.trim()) patch.location = f.location.trim();
      if (f.scopeOfWork.trim()) patch.scopeOfWork = f.scopeOfWork.trim();
      if (f.tierId) patch.tierId = f.tierId;
      if (fee > 0) patch.contractValue = fee;
      if (f.deadlinePreview) patch.deadlinePreview = f.deadlinePreview;
      if (f.deadlineFinal) patch.deadlineFinal = f.deadlineFinal;
      if (f.subtitle.trim()) patch.subtitle = f.subtitle.trim();
      if (f.summary.trim()) patch.summary = f.summary.trim();
      if (f.year.trim()) patch.year = Number(f.year);
      if (f.areaSqm.trim()) patch.areaSqm = Number(f.areaSqm);
      if (sampul) patch.coverImageKey = sampul.key;

      /* Proyeknya SUDAH terbuat. Yang gagal sesudahnya tidak membatalkan
         apa pun — dikumpulkan, disebut di toast, dan bisa dilengkapi di
         Satu Proyek. */
      const gagal: string[] = [];
      try {
        await simpanProyek(id, patch);
      } catch (err) {
        gagal.push(`detail proyek (${(err as Error).message})`);
      }
      for (const b of terisi) {
        const p = persen(b);
        const bawaan = aturan ? pctBawaan(aturan, b.role) : null;
        try {
          /* Persen yang sama dengan bawaan TIDAK dikirim: API mengambilnya
             sendiri dari aturan studio, dan peran yang belum ditentukan
             tersimpan kosong supaya ikut aturan begitu pemilik mengisinya. */
          await tambahTimProyek(id, {
            teamMemberId: b.orang,
            role: b.role,
            ...(p !== null && p !== bawaan ? { pct: p } : {}),
          });
        } catch (err) {
          const nama = orangTim.find((o) => o.id === b.orang)?.name ?? "anggota";
          gagal.push(`${LABEL_PERAN[b.role]} ${nama} (${(err as Error).message})`);
        }
      }

      /* Dititipkan: toast() di sini lenyap bersama halamannya (jebakan #40). */
      titipToast(
        gagal.length
          ? {
              judul: "Proyek dibuat, sebagian belum tersimpan",
              keterangan: `Gagal: ${gagal.join("; ")}. Lengkapi di halaman ini.`,
              nada: "gagal",
            }
          : {
              judul: "Proyek dibuat",
              keterangan: terisi.length
                ? `${terisi.length} orang ditugaskan. Bayaran tahap awal jatuh tempo begitu DP klien masuk.`
                : "Tugaskan tim desainnya di bagian Tim & Bayaran.",
              nada: "sukses",
            },
      );
      await bukaSatuProyek(id);
    } catch (err) {
      toast({ judul: "Gagal membuat proyek", keterangan: (err as Error).message, nada: "gagal" });
      setMenyimpan(false);
    }
  }

  const paketDipilih = paket.find((p) => p.id === f.tierId) ?? null;
  /* Peringatan, bukan penolakan: harga di luar rentang paket memang terjadi
     (diskon klien lama, lingkup tambahan). */
  const bantuFee = paketDipilih
    ? fee > 0 && (fee < paketDipilih.feeMin * 1e6 || fee > paketDipilih.feeMax * 1e6)
      ? `Di luar rentang ${paketDipilih.name} (Rp${paketDipilih.feeMin}–${paketDipilih.feeMax} jt).`
      : `Rentang ${paketDipilih.name}: Rp${paketDipilih.feeMin}–${paketDipilih.feeMax} jt.`
    : undefined;
  const kategoriLabel = KATEGORI[f.category] ?? f.category;
  const pctTampil = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
  const ringkasTim = useMemo(
    () => terisi.map((b) => `${LABEL_PERAN[b.role]}: ${orangTim.find((o) => o.id === b.orang)?.name ?? "—"}`),
    [terisi, orangTim],
  );

  return (
    <div className="pas pjb">
      {/* Bidang besar frame 34 — di Detail Paket berisi rentang fee; di sini
          fee design proyek ini dan pembagiannya, dihitung saat diketik. */}
      <div className="pak__bidang pak__bidang--besar pjb__bidang" aria-live="polite">
        <span className="pak__kelompok">
          Fee design · {kategoriLabel}
          {f.client.trim() ? ` · ${f.client.trim()}` : ""}
        </span>
        <span className="pak__harga">
          <small>Rp</small>
          <b>{fee > 0 ? fee.toLocaleString("id-ID") : "0"}</b>
        </span>
        <span className="pak__per">
          {fee <= 0
            ? "Isi fee design — bagian tiap orang di tim dihitung dari angka ini."
            : terisi.length === 0
              ? "Pilih tim desainnya untuk melihat bagian tiap orang."
              : `Bagian tim ${formatRupiah(bagianTim)} (${pctTampil(pctTim)}%) · untuk studio ${formatRupiah(fee - bagianTim)}`}
        </span>
      </div>

      <div className="pas__badan">
        <div className="pas__utama">
          <form className="pas__form" id="form-proyek-baru" onSubmit={simpan}>
            <div className="pas__judulbaris">
              <h2 className="pas__judul">Proyek baru</h2>
            </div>

            <section className="pjb__bagian" aria-labelledby="pjb-pekerjaan">
              <h3 id="pjb-pekerjaan" className="pjb__judul">
                Pekerjaan
              </h3>
              <div className="pas__kisi">
                <Isian
                  label="Klien"
                  required
                  maxLength={120}
                  placeholder="mis. Weng Coffee"
                  value={f.client}
                  onChange={(e) => set("client", e.currentTarget.value)}
                />
                <div className="k-isian">
                  <span className="k-isian__label">Jenis proyek</span>
                  <PilihMenu
                    label="Jenis proyek"
                    nilai={f.category}
                    onUbah={(v) => set("category", v)}
                    opsi={Object.entries(KATEGORI).map(([v, l]) => ({ nilai: v, label: l }))}
                  />
                </div>
                <Isian
                  label="Nama proyek"
                  maxLength={120}
                  placeholder={f.client.trim() || "Kosong = memakai nama klien"}
                  value={f.title}
                  onChange={(e) => set("title", e.currentTarget.value)}
                  bantu="Boleh kosong — di Excel kolom ini sering kosong, dan nama klien sudah cukup."
                />
                <Isian
                  label="Kota"
                  placeholder="mis. Pontianak"
                  value={f.city}
                  onChange={(e) => set("city", e.currentTarget.value)}
                />
                <Isian
                  label="Alamat lokasi"
                  className="pas__lebar"
                  maxLength={200}
                  placeholder="Jalan dan nomor — untuk kunjungan lokasi"
                  value={f.location}
                  onChange={(e) => set("location", e.currentTarget.value)}
                />
              </div>
              <label className="k-isian pas__lebar">
                <span className="k-isian__label">Lingkup kerja</span>
                <IsianPanjang
                  className="pas__area"
                  rows={3}
                  maxLength={2000}
                  placeholder="mis. Desain interior berkonsep pop art; studio berisi layanan nail art dan eyelash."
                  value={f.scopeOfWork}
                  onChange={(e) => set("scopeOfWork", e.currentTarget.value)}
                />
              </label>
            </section>

            <section className="pjb__bagian" aria-labelledby="pjb-fee">
              <h3 id="pjb-fee" className="pjb__judul">
                Fee &amp; tenggat
              </h3>
              <div className="pas__kisi">
                {/* Paket dipilih di sini supaya panel bisa menghitung proyek
                    selesai per paket (§3.3 dokumen strategi: tiap 3 selesai,
                    harga naik) dan KPI "Signature ke atas". */}
                <PilihPaket paket={paket} nilai={f.tierId} onUbah={(v) => set("tierId", v)} />
                <IsianTempel
                  label="Fee design"
                  kiri="Rp"
                  inputMode="numeric"
                  placeholder={paketDipilih ? `${paketDipilih.feeMin}.000.000` : "12.000.000"}
                  value={f.fee}
                  onChange={(e) => set("fee", titikRibuan(e.currentTarget.value))}
                  bantu={bantuFee}
                />
                <IsianTanggal
                  label="Tenggat preview"
                  nilai={f.deadlinePreview}
                  onUbah={(v) => set("deadlinePreview", v)}
                  placeholder="Pilih tanggal"
                />
                <IsianTanggal
                  label="Tenggat desain final"
                  nilai={f.deadlineFinal}
                  onUbah={(v) => set("deadlineFinal", v)}
                  min={f.deadlinePreview || undefined}
                  placeholder="Pilih tanggal"
                />
              </div>
            </section>

            <section className="pjb__bagian" aria-labelledby="pjb-tim">
              <div className="pjb__kepala">
                <h3 id="pjb-tim" className="pjb__judul">
                  Tim desain
                </h3>
                <a className="pjb__aturan" href="/admin/pengaturan/fee">
                  Atur persen peran
                </a>
              </div>
              <div className="pjb__tim" role="table" aria-label="Tim desain dan bagiannya">
                <div className="pjb__baris pjb__baris--kepala" role="row">
                  <span role="columnheader">Peran</span>
                  <span role="columnheader">Orang</span>
                  <span role="columnheader">Bagian</span>
                  <span role="columnheader" className="pjb__kanan">
                    Rupiah
                  </span>
                  <span aria-hidden="true" />
                </div>
                {tim.map((b) => {
                  const rp = rupiahBaris(b);
                  const p = persen(b);
                  return (
                    <div className="pjb__baris" role="row" key={b.kunci}>
                      <span role="cell" className="pjb__peran">
                        {b.tambahan ? (
                          <PilihMenu
                            label="Peran"
                            nilai={b.role}
                            onUbah={(v) => {
                              const role = v as PeranTim;
                              setBaris(b.kunci, {
                                role,
                                pct: aturan ? pctBawaan(aturan, role)?.toString().replace(".", ",") ?? "" : "",
                                disentuh: false,
                              });
                            }}
                            opsi={URUTAN_PERAN.map((r) => ({ nilai: r, label: LABEL_PERAN[r] }))}
                          />
                        ) : (
                          LABEL_PERAN[b.role]
                        )}
                      </span>
                      <span role="cell">
                        <PilihMenu
                          label={`Orang untuk peran ${LABEL_PERAN[b.role]}`}
                          nilai={b.orang}
                          onUbah={(v) => setBaris(b.kunci, { orang: v })}
                          placeholder="— Belum ada —"
                          opsi={[{ nilai: "", label: "— Belum ada —" }, ...pilihanOrang(b).map((o) => ({ nilai: o.id, label: o.name }))]}
                        />
                      </span>
                      <span role="cell">
                        <KelompokIsian
                          aria-label={`Persen ${LABEL_PERAN[b.role]}`}
                          inputMode="decimal"
                          placeholder="—"
                          value={b.pct}
                          kanan="%"
                          className="pjb__pct"
                          onChange={(e) => setBaris(b.kunci, { pct: e.currentTarget.value.replace(/[^\d.,]/g, ""), disentuh: true })}
                        />
                      </span>
                      <span role="cell" className="pjb__kanan pjb__rp">
                        {rp !== null ? formatRupiah(rp) : b.orang && p === null ? "belum ditentukan" : "—"}
                      </span>
                      <span role="cell">
                        {b.tambahan && (
                          <TombolIkon
                            ikon={X}
                            judul={`Buang baris ${LABEL_PERAN[b.role]}`}
                            jenis="ghost"
                            ukuran="small"
                            onClick={() => setTim((t) => t.filter((x) => x.kunci !== b.kunci))}
                          />
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="pjb__timkaki">
                <Tombol
                  ukuran="small"
                  jenis="secondary"
                  kiri={Plus}
                  onClick={() =>
                    setTim((t) => [
                      ...t,
                      {
                        kunci: `tambah-${Date.now()}`,
                        role: "render",
                        orang: "",
                        pct: aturan ? pctBawaan(aturan, "render")?.toString().replace(".", ",") ?? "" : "",
                        tambahan: true,
                        disentuh: false,
                      },
                    ])
                  }
                >
                  Bagi peran ke orang kedua
                </Tombol>
                <p className="pjb__ket">
                  {orangTim.length === 0
                    ? "Belum ada anggota tim. Tambahkan dulu di Tim & Freelancer."
                    : `Persen bawaan dari Aturan Fee Tim. Bayaran tiap orang dibayar dua tahap: ${aturan?.firstTranchePct ?? 50}% saat DP klien masuk, sisanya saat desain selesai.`}
                </p>
              </div>
            </section>

            <Lipat judul="Untuk halaman publik" ket="Bisa nanti">
              <div className="pjb__publik">
                <div className={`pf__sampul pjb__sampul${sampul ? "" : " pf__sampul--kosong"}`}>
                  {sampul ? (
                    <img src={sampul.url} alt="Sampul proyek" />
                  ) : (
                    <span className="pf__sampulkosong">
                      <Ikon ikon={ImageSquare} ukuran={28} />
                      <b>Gambar sampul (opsional)</b>
                      <small>JPG, PNG, WebP, atau AVIF. Bisa diganti kapan saja di Halaman Publik.</small>
                    </span>
                  )}
                  <span className="pf__sampulaksi">
                    <label className={`k-tombol k-tombol--small ${sampul ? "k-tombol--secondary" : "k-tombol--primary"} pf__unggah`}>
                      {mengunggah ? "Mengunggah…" : sampul ? "Ganti sampul" : "Pilih gambar"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/avif"
                        aria-label="Pilih gambar sampul proyek"
                        disabled={mengunggah}
                        onChange={(e) => {
                          const berkas = e.currentTarget.files?.[0];
                          if (berkas) unggah(berkas);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </span>
                </div>
                <div className="pas__kisi">
                  <Isian
                    label="Subjudul"
                    className="pas__lebar"
                    maxLength={160}
                    placeholder="Satu baris penjelas di bawah judul"
                    value={f.subtitle}
                    onChange={(e) => set("subtitle", e.currentTarget.value)}
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
                    label="Luas (m²)"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="240"
                    value={f.areaSqm}
                    onChange={(e) => set("areaSqm", e.currentTarget.value)}
                  />
                </div>
                <label className="k-isian">
                  <span className="k-isian__label">Ringkasan singkat</span>
                  <IsianPanjang
                    className="pas__area"
                    rows={3}
                    placeholder="Dua sampai tiga kalimat yang muncul di kartu proyek."
                    value={f.summary}
                    onChange={(e) => set("summary", e.currentTarget.value)}
                  />
                </label>
              </div>
            </Lipat>
          </form>
        </div>

        <aside className="pf__samping" aria-label="Ringkasan proyek baru">
          {/* Tombol simpan DI ATAS: kolom ini setinggi layar di laptop dan
              daftar timnya bisa panjang — aksi utama tidak boleh jatuh di
              bawah lipatan. Fee dan nama proyek sudah ada di bidang besar,
              jadi tidak diulang di sini. */}
          <div className="pf__simpan pjb__simpan">
            <Tombol ukuran="large" jenis="primary" tipeHtml="submit" form="form-proyek-baru" disabled={!bisaSimpan}>
              {menyimpan ? "Membuat…" : "Buat proyek"}
            </Tombol>
            <Tombol ukuran="large" jenis="ghost" disabled={menyimpan} onClick={() => navigate("/admin/proyek")}>
              Batal
            </Tombol>
            <span className="pf__alasan">
              {alasan ?? "Tersimpan sebagai draf — belum tampil di situs sampai diterbitkan."}
            </span>
            {adaIsian && (
              <button type="button" className="pf__kosongkan" onClick={kosongkan} disabled={menyimpan}>
                Kosongkan isian
              </button>
            )}
          </div>
          <div className="pf__info">
            <p className="pas__sampingjudul">Ringkasan</p>
            <dl className="pf__fakta">
              <div>
                <dt>Tim</dt>
                <dd className="pjb__daftar">
                  {ringkasTim.length ? ringkasTim.map((t) => <span key={t}>{t}</span>) : "Belum ada yang ditugaskan"}
                </dd>
              </div>
              <div>
                <dt>Tenggat</dt>
                <dd>
                  {f.deadlinePreview || f.deadlineFinal
                    ? [f.deadlinePreview && `Preview ${tanggalPendek(f.deadlinePreview)}`, f.deadlineFinal && `Final ${tanggalPendek(f.deadlineFinal)}`]
                        .filter(Boolean)
                        .join(" · ")
                    : "Belum diisi"}
                </dd>
              </div>
            </dl>
            {belumDitentukan.length > 0 && (
              <p className="pjb__peringatan">
                Persen {belumDitentukan.map((b) => LABEL_PERAN[b.role]).join(" dan ")} belum ditentukan — bayarannya
                terhitung otomatis begitu persennya diisi di Aturan Fee Tim.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function tanggalPendek(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
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
