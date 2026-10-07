import { PilihMenu, PilihTombol } from "../kit/Formulir";
import { navigate } from "astro:transitions/client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { RequireAuth } from "./RequireAuth";
import { KolomGrafik, LabelYGrafik } from "../kit/Grafik";
import { useUrutTabel, type Urutan } from "../kit/Tabel";
import { Lencana } from "../kit/Lencana";
import { Ikon } from "../kit/Ikon";
import { CaretDown, CoinIn, CoinOut, Eye, Globe, NotePencil, Plus, UserCircle } from "../kit/ikon";
import { ContextMenu } from "../kit/Overlay";
import {
  daftarProyek,
  ambilBulanan,
  semuaPembayaran,
  semuaBiaya,
  simpanProyek,
  ubahFaseProgress,
  bacaCache,
  tulisCache,
  type Proyek,
  type BarisBulanan,
  type Pembayaran,
  type BiayaProyek,
} from "../../lib/admin";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";

import { kodeProyek } from "../../lib/nomorDokumen";

/* =============================================================================
   Semua Proyek — RAK ORDNER PROYEK.

   Benda dunia nyatanya: di studio, tiap proyek punya satu ORDNER (map
   proyek) di rak — semua proyek berdiri berderet, punggungnya berlabel, dan
   yang sedang dikerjakan ditarik lalu DIBUKA di meja. Sengaja berbeda dari
   tetangganya: kotak kartu (Terima Pembayaran), buku (Gaji), papan jepit
   (Tagihan), lembar gambar (halaman identitas).

   Satu papan `--kas-bidang` berjahit, dua bagian:

   1. RAK — satu ordner per proyek, terbaru di kiri, PEMBATAS TAHUN di antara
      tahun yang berbeda. Punggung ordner: kantong label (kode, tahun, tahap
      pipeline), jendela foto sampul proyek, judul tegak, lubang jari, dan
      meteran tegak di tepi kiri = bagian kontrak yang sudah dibayar. Rona
      punggung mengikuti JENIS proyek (tiga rona hijau, bukan warna makna).
      Ordner yang dibuka TERTARIK keluar dari deret. Slot pertama = ordner
      kosong "Proyek baru". Klik kanan = pintasan halaman proyek (seperti
      versi frame 19).
   2. ORDNER TERBUKA — dua lembar di papan ordner dengan cincin besi di
      lipatannya. Kiri LEMBAR RINGKASAN: judul + kode, jenis · kota · tahun,
      Buka / Ubah / Terima bayar, klien, tahap & fase (bisa diubah di
      tempat), status, nilai kontrak dan pembayaran. Kanan LEMBAR KEUANGAN
      berlubang di tepi kirinya: arus kas per bulan (6/12) dan transaksi
      proyek (rentang, urut kolom, enam terbaru).

   SATU-SATUNYA gerak 3D: ordner yang dipilih DIBUKA — sampulnya (sisi
   belakang lembar kiri) mula-mula tertutup di atas lembar kanan, lalu
   berayun ke kiri di cincin dan menjadi lembar ringkasan. Hanya saat
   pilihan berubah, diam bila gerak dikurangi.
   ============================================================================= */

const KATEGORI: Record<string, string> = {
  residential: "Hunian",
  commercial: "Komersial",
  coffeeshop: "Coffee shop",
  hospitality: "Hospitality",
  interior: "Interior",
  landscape: "Lanskap",
  masterplan: "Masterplan",
  renovation: "Renovasi",
};

const STATUS: Record<string, { teks: string; nada: "selesai" | "menunggu" | "netral" }> = {
  published: { teks: "Terbit", nada: "selesai" },
  draft: { teks: "Draf", nada: "netral" },
  archived: { teks: "Arsip", nada: "menunggu" },
};

// Dua daftar ini SAMA dengan daftar lama (ProjectList) dan dengan editor
// proyek — nilainya disimpan di database, jadi mengubah satu kata di sini
// berarti tahap lama tidak lagi punya label.
export const TAHAP: { value: string; label: string }[] = [
  { value: "proposal", label: "Proposal" },
  { value: "deal_kontrak", label: "Deal Kontrak" },
  { value: "dp_50", label: "DP 50%" },
  { value: "desain_1", label: "Desain 1" },
  { value: "desain_2", label: "Desain 2" },
  { value: "finish", label: "Finish" },
  { value: "pelunasan", label: "Pelunasan" },
];
const FASE: { value: string; label: string }[] = [
  { value: "konsultasi", label: "Konsultasi" },
  { value: "konsep", label: "Konsep" },
  { value: "ded", label: "DED" },
  { value: "perizinan", label: "Perizinan" },
  { value: "konstruksi", label: "Konstruksi" },
  { value: "selesai", label: "Selesai" },
];

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const LABEL_JENIS: Record<string, string> = { dp: "DP", termin: "Termin", pelunasan: "Pelunasan" };
const LABEL_METODE: Record<string, string> = {
  tunai: "Tunai",
  transfer: "Transfer",
  qris: "QRIS",
  lainnya: "Lainnya",
};
const LABEL_KATEGORI: Record<string, string> = {
  freelancer: "Freelancer",
  operasional: "Operasional",
  prinsipal: "Prinsipal",
  lainnya: "Lainnya",
};

const RENTANG = [
  { nilai: "1", label: "Bulan ini" },
  { nilai: "3", label: "3 bulan" },
  { nilai: "12", label: "12 bulan" },
  { nilai: "0", label: "Semua" },
];

function batasRentang(bulan: number): number | null {
  if (bulan <= 0) return null;
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - (bulan - 1));
  return d.getTime();
}

/** `paid_at` timestamptz ATAU `incurred_on` date -> milidetik. */
function waktuKe(iso: string, akhirHari = true): number {
  return new Date(iso.length === 10 ? iso + (akhirHari ? "T23:59:59" : "T00:00:00") : iso).getTime();
}

/** Batas sumbu arus kas: dibulatkan ke atas ke angka yang enak dibaca,
 *  supaya label tengahnya (separuhnya) juga bulat. */
function batasSumbu(n: number): number {
  const t = Math.max(1, n);
  const pangkat = 10 ** Math.floor(Math.log10(t));
  const langkah = [1, 2, 2.5, 5, 10].find((k) => k * pangkat >= t) ?? 10;
  return langkah * pangkat;
}

/** 12.500.000 -> "12,5 jt" — label sumbu, tanpa "Rp". */
function singkat(n: number): string {
  const a = Math.abs(n);
  const tanda = n < 0 ? "−" : "";
  if (a >= 1e9) return `${tanda}${(a / 1e9).toFixed(1).replace(/\.0$/, "").replace(".", ",")} M`;
  if (a >= 1e6) return `${tanda}${(a / 1e6).toFixed(1).replace(/\.0$/, "").replace(".", ",")} jt`;
  if (a >= 1e3) return `${tanda}${Math.round(a / 1e3)} rb`;
  return `${tanda}${a}`;
}

interface Transaksi {
  kunci: string;
  masuk: boolean;
  nama: string;
  sub: string;
  orang: string;
  waktu: string;
  nominal: number;
  catatan: string;
}

/** Pilihan yang TERLIHAT sebagai teks biasa berpanah; daftarnya dropdown kit. */
export function PilihTeks({
  judul,
  nilai,
  opsi,
  onUbah,
}: {
  judul: string;
  nilai: string;
  opsi: { value: string; label: string }[];
  onUbah: (baru: string) => Promise<void>;
}) {
  const [tampil, setTampil] = useState(nilai);
  const [sibuk, setSibuk] = useState(false);
  useEffect(() => setTampil(nilai), [nilai]);
  const daftar = opsi.map((o) => ({ nilai: o.value, label: o.label }));
  return (
    <PilihMenu
      label={judul}
      nilai={tampil}
      disabled={sibuk}
      opsi={daftar.some((o) => o.nilai === tampil) ? daftar : [{ nilai: tampil, label: "Belum diisi", mati: true }, ...daftar]}
      onUbah={async (baru) => {
        const lama = tampil;
        setTampil(baru);
        setSibuk(true);
        try {
          await onUbah(baru);
        } catch {
          // Gagal menyimpan: kembalikan tampilannya. Galatnya tidak
          // ditelan diam-diam — nilai yang melompat balik adalah tandanya.
          setTampil(lama);
        } finally {
          setSibuk(false);
        }
      }}
      pemicu={
        <button type="button" className="pro__pilih" data-sibuk={sibuk || undefined}>
          <span>{opsi.find((o) => o.value === tampil)?.label ?? "Belum diisi"}</span>
          <Ikon ikon={CaretDown} ukuran={12} />
        </button>
      }
    />
  );
}

/** Tiga rona punggung menurut JENIS proyek — rona, bukan warna makna. */
const RONA: Record<string, number> = { residential: 0, commercial: 1, coffeeshop: 2, hospitality: 2, interior: 1, renovation: 0, landscape: 2, masterplan: 1 };

const tahunProyek = (p: Proyek) => p.year ?? (p.publishedAt ? Number(p.publishedAt.slice(0, 4)) : null);

const geraknya = () =>
  typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Kepala kolom transaksi yang bisa mengurutkan (pola `Tabel` kit). */
function KepalaUrut({
  label,
  i,
  urutan,
  onUrut,
  kanan,
}: {
  label: string;
  i: number;
  urutan: Urutan | null;
  onUrut: (u: Urutan | null) => void;
  kanan?: boolean;
}) {
  const arah = urutan?.kolom === i ? urutan.arah : null;
  return (
    <span role="columnheader" aria-sort={arah === "naik" ? "ascending" : arah === "turun" ? "descending" : "none"} className={kanan ? "is-kanan" : undefined}>
      <button
        type="button"
        className="ord__urut"
        data-arah={arah ?? undefined}
        onClick={() => onUrut(arah === null ? { kolom: i, arah: "naik" } : arah === "naik" ? { kolom: i, arah: "turun" } : null)}
      >
        {label}
        <svg viewBox="0 0 8 12" width="8" height="12" aria-hidden="true">
          <path className="ord__urutnaik" d="M4 1 7 5H1z" />
          <path className="ord__urutturun" d="M4 11 1 7h6z" />
        </svg>
      </button>
    </span>
  );
}

function Isi() {
  const [proyek, setProyek] = useState<Proyek[] | null>(() => bacaCache<Proyek[]>("proyek"));
  const [bayar, setBayar] = useState<Pembayaran[] | null>(() => bacaCache<Pembayaran[]>("bayar-semua"));
  const [biaya, setBiaya] = useState<BiayaProyek[] | null>(() => bacaCache<BiayaProyek[]>("biaya-semua"));
  const [pilih, setPilih] = useState<string | null>(() => {
    try {
      return new URLSearchParams(location.search).get("id");
    } catch {
      return null;
    }
  });
  const [bulanan, setBulanan] = useState<BarisBulanan[] | null>(null);
  const [rentangArus, setRentangArus] = useState(6);
  const [rentangTrx, setRentangTrx] = useState("0");
  const [sorot, setSorot] = useState<number | null>(null);
  /* Ordner yang sedang dibuka — kuncinya berganti tiap pilihan supaya
     gerak sampulnya diputar ulang. */
  const [buka, setBuka] = useState<{ id: string; n: number } | null>(null);
  const rakRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    daftarProyek()
      .then((d) => {
        tulisCache("proyek", d);
        setProyek(d);
      })
      .catch(() => setProyek((l) => l ?? []));
    semuaPembayaran()
      .then((d) => {
        tulisCache("bayar-semua", d);
        setBayar(d);
      })
      .catch(() => setBayar((l) => l ?? []));
    semuaBiaya()
      .then((d) => {
        tulisCache("biaya-semua", d);
        setBiaya(d);
      })
      .catch(() => setBiaya((l) => l ?? []));
  }, []);

  /* Terbaru di kiri: TAHUN dulu (rak arsip dikelompokkan per tahun),
     lalu urutan bawaan daftar lama di dalamnya. */
  const urut = useMemo(
    () =>
      [...(proyek ?? [])].sort(
        (a, b) =>
          (tahunProyek(b) ?? 0) - (tahunProyek(a) ?? 0) || (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
      ),
    [proyek],
  );
  /* Papan rak di ujung deret: jumlah seluruh kontrak dan yang sudah masuk. */
  const rekapRak = useMemo(() => {
    const kontrakSemua = urut.reduce((n, p) => n + (p.contractValue ?? 0), 0);
    const masukSemua = urut.reduce((n, p) => n + (p.paidTotal ?? 0), 0);
    const berjalan = urut.filter((p) => p.pipelineStage !== "pelunasan").length;
    return { kontrakSemua, masukSemua, berjalan };
  }, [urut]);
  const kini = urut.find((p) => p.id === pilih) ?? urut[0] ?? null;

  /* Isi rak: pembatas tahun sebelum ordner pertama tiap tahun. */
  const rak = useMemo(() => {
    const out: ({ jenis: "tahun"; tahun: number | null } | { jenis: "ordner"; p: Proyek })[] = [];
    let akhir: number | null | undefined;
    for (const p of urut) {
      const t = tahunProyek(p);
      if (t !== akhir) {
        out.push({ jenis: "tahun", tahun: t });
        akhir = t;
      }
      out.push({ jenis: "ordner", p });
    }
    return out;
  }, [urut]);

  /* Ordner yang dibuka dijaga kelihatan di rak yang menggulir mendatar —
     sekali per perubahan pilihan, bukan di handler gulir (jebakan #21). */
  useLayoutEffect(() => {
    const r = rakRef.current;
    const o = r?.querySelector<HTMLElement>(".ord__ordner.is-buka");
    if (!r || !o) return;
    const kiri = o.offsetLeft - 24;
    const kanan = o.offsetLeft + o.offsetWidth + 24 - r.clientWidth;
    if (r.scrollLeft > kiri) r.scrollLeft = kiri;
    else if (r.scrollLeft < kanan) r.scrollLeft = kanan;
  }, [kini?.id, rak.length]);

  /* Pilihan ikut ke alamat (`?id=`), supaya tombol Kembali dari editor
     proyek mendarat di proyek yang sama, dan tautannya bisa dibagikan. */
  function pilihProyek(id: string) {
    if (id === kini?.id) return;
    setPilih(id);
    setSorot(null);
    if (geraknya()) setBuka((b) => ({ id, n: (b?.n ?? 0) + 1 }));
    try {
      const u = new URL(location.href);
      u.searchParams.set("id", id);
      history.replaceState(history.state, "", u);
    } catch {
      /* alamat tidak bisa diubah — pilihannya tetap jalan */
    }
  }
  useEffect(() => {
    if (!buka) return;
    const t = setTimeout(() => setBuka(null), 900);
    return () => clearTimeout(t);
  }, [buka]);

  const kunciBulan = kini ? `proyek-bulan:${kini.id}:${rentangArus}` : null;
  useEffect(() => {
    if (!kini || !kunciBulan) return;
    let batal = false;
    setBulanan(bacaCache<BarisBulanan[]>(kunciBulan));
    ambilBulanan(kini.id, rentangArus)
      .then((d) => {
        if (batal) return;
        tulisCache(kunciBulan, d);
        setBulanan(d);
      })
      .catch(() => !batal && setBulanan((l) => l ?? []));
    return () => {
      batal = true;
    };
  }, [kini?.id, rentangArus, kunciBulan]);

  function gantiSatu(id: string, ubahan: Partial<Proyek>) {
    setProyek((l) => {
      const baru = (l ?? []).map((p) => (p.id === id ? { ...p, ...ubahan } : p));
      tulisCache("proyek", baru);
      return baru;
    });
  }

  /* --- Pembayaran ---------------------------------------------------------- */
  const kontrak = kini?.contractValue ?? 0;
  const diterima = kini?.paidTotal ?? 0;
  const persen = kontrak > 0 ? Math.max(0, Math.min(100, (diterima / kontrak) * 100)) : 0;

  /* --- Arus kas ------------------------------------------------------------ */
  const deret = (bulanan ?? []).slice(-rentangArus);
  const maks = batasSumbu(Math.max(0, ...deret.flatMap((b) => [b.kasMasuk, b.biaya])));
  const iSorot = sorot ?? (deret.length ? deret.length - 1 : null);
  const bSorot = iSorot !== null ? deret[iSorot] : undefined;
  const TINGGI = 112;

  /* --- Transaksi proyek ---------------------------------------------------- */
  const transaksi = useMemo<Transaksi[]>(() => {
    if (!kini) return [];
    const batas = batasRentang(Number(rentangTrx));
    const cocok = (projectId: string, waktu: string) =>
      projectId === kini.id && (batas === null || waktuKe(waktu, false) >= batas);
    const masuk = (bayar ?? [])
      .filter((b) => cocok(b.projectId, b.paidAt))
      .map<Transaksi>((b) => ({
        kunci: `p:${b.id}`,
        masuk: true,
        nama: `Pembayaran ${LABEL_JENIS[b.kind] ?? b.kind}`,
        sub: LABEL_METODE[b.method] ?? b.method,
        orang: b.receiver || "—",
        waktu: b.paidAt,
        nominal: b.amount,
        catatan: b.note || "—",
      }));
    const keluar = (biaya ?? [])
      .filter((k) => cocok(k.projectId, k.incurredOn))
      .map<Transaksi>((k) => ({
        kunci: `b:${k.id}`,
        masuk: false,
        nama: k.label,
        sub: LABEL_KATEGORI[k.category] ?? k.category,
        orang: k.teamMemberName || "—",
        waktu: k.incurredOn,
        nominal: k.amount,
        catatan: "—",
      }));
    /* Enam terbaru. Sisanya ada di Semua Transaksi. */
    return [...masuk, ...keluar].sort((a, b) => waktuKe(b.waktu) - waktuKe(a.waktu)).slice(0, 6);
  }, [kini, bayar, biaya, rentangTrx]);

  const tglTrx = (w: string) => new Date(w.length === 10 ? w + "T00:00:00" : w).getTime();
  /* Nominal diurutkan BERTANDA: uang keluar di bawah nol. */
  const urutTrx = useUrutTabel(transaksi, [
    (t) => tglTrx(t.waktu),
    (t) => t.nama,
    (t) => (t.masuk ? t.nominal : -t.nominal),
    (t) => (t.masuk ? "Masuk" : "Keluar"),
  ]);

  const st = kini ? STATUS[kini.status] ?? { teks: kini.status, nada: "netral" as const } : null;
  const idK = kini ? encodeURIComponent(kini.id) : "";
  const tahapKe = kini ? TAHAP.findIndex((t) => t.value === kini.pipelineStage) : -1;

  return (
    <div className="ord">
      <div className="ord__papan">
        {/* ---- Rak ordner ------------------------------------------------- */}
        <section className="ord__rakwadah" aria-label="Rak ordner proyek">
          <p className="ord__alis">
            Rak ordner proyek <span>· {urut.length} ordner · terbaru di kiri</span>
          </p>
          <div className="ord__rak" ref={rakRef}>
            <ol className="ord__deret">
              <li className="ord__slot">
                <a className="ord__ordner ord__ordner--baru" href="/admin/proyek/baru">
                  <span className="ord__barutanda">
                    <Ikon ikon={Plus} ukuran={16} />
                  </span>
                  <span className="ord__judultegak">Proyek baru</span>
                  <i className="ord__lubang" aria-hidden="true" />
                </a>
              </li>
              {rak.map((r) => {
                if (r.jenis === "tahun") {
                  return (
                    <li key={`t-${r.tahun}`} className="ord__slot ord__pembatas" aria-hidden="true">
                      <span>{r.tahun ?? "—"}</span>
                    </li>
                  );
                }
                const p = r.p;
                const aktif = p.id === kini?.id;
                const id = encodeURIComponent(p.id);
                const k = p.contractValue ?? 0;
                const isi = k > 0 ? Math.min(100, ((p.paidTotal ?? 0) / k) * 100) : 0;
                const tahap = TAHAP.find((t) => t.value === p.pipelineStage)?.label ?? "—";
                return (
                  <li key={p.id} className="ord__slot">
                    <ContextMenu
                      sections={[
                        {
                          label: p.title,
                          items: [
                            { label: "Buka proyek", ikon: Eye, onSelect: () => navigate(`/admin/proyek/satu?id=${id}`) },
                            { label: "Ubah data", ikon: NotePencil, onSelect: () => navigate(`/admin/proyek/edit?id=${id}`) },
                            { label: "Terima pembayaran", ikon: CoinIn, onSelect: () => navigate(`/admin/keuangan/terima?proyek=${id}`) },
                          ],
                        },
                        {
                          items: [
                            { label: "Portal klien", ikon: UserCircle, onSelect: () => navigate(`/admin/proyek/klien?id=${id}`) },
                            { label: "Halaman publik", ikon: Globe, onSelect: () => navigate(`/admin/proyek/publik?id=${id}`) },
                          ],
                        },
                      ]}
                    >
                      <button
                        type="button"
                        className={`ord__ordner${aktif ? " is-buka" : ""}`}
                        style={{ "--ord-rona": RONA[p.category] ?? 0, "--ord-isi": (isi / 100).toFixed(3) } as CSSProperties}
                                                aria-pressed={aktif}
                        aria-label={`${p.title}, ${p.client || "tanpa klien"}, tahap ${tahap}${k ? `, ${Math.round(isi)}% dibayar` : ""}`}
                        onClick={() => pilihProyek(p.id)}
                      >
                        <span className={`ord__jendela${p.coverImageUrl ? "" : " is-kosong"}`}>
                          {p.coverImageUrl ? (
                            <img src={p.coverImageUrl} alt="" loading="lazy" decoding="async" />
                          ) : (
                            <span>{(KATEGORI[p.category] ?? p.category).slice(0, 1)}</span>
                          )}
                        </span>
                        <span className="ord__kantong">
                          <b>{kodeProyek(p.title)}</b>
                          <span className="ord__judultegak">{p.title}</span>
                          <small>{tahap}</small>
                        </span>
                        <i className="ord__lubang" aria-hidden="true" />
                        <i className="ord__meter" aria-hidden="true" />
                      </button>
                    </ContextMenu>
                  </li>
                );
              })}
              {proyek !== null && urut.length === 0 && <li className="ord__kosong">Rak masih kosong. Mulai dari ordner "Proyek baru".</li>}
              {urut.length > 0 && (
                <li className="ord__slot ord__plang">
                  <span className="ord__plangisi">
                    <small>Nilai kontrak di rak</small>
                    <b>{formatRupiah(rekapRak.kontrakSemua)}</b>
                    <small>
                      sudah masuk {formatRupiah(rekapRak.masukSemua)}
                      {rekapRak.kontrakSemua > 0 && ` · ${Math.round((rekapRak.masukSemua / rekapRak.kontrakSemua) * 100)}%`}
                    </small>
                    <small>{rekapRak.berjalan} berjalan · {urut.length - rekapRak.berjalan} lunas</small>
                  </span>
                </li>
              )}
            </ol>
          </div>
          <i className="ord__papanrak" aria-hidden="true" />
        </section>

        {/* ---- Ordner terbuka ---------------------------------------------- */}
        <section className="ord__terbuka" aria-label="Ordner proyek terbuka">
          {/* Lembar ringkasan — juga SAMPUL ordner saat masih tertutup. */}
          <article key={kini?.id ?? "kosong"} className={`ord__lembar ord__lembar--kiri${buka && buka.id === kini?.id ? " is-buka" : ""}`}>
            <div className="ord__lembarisi">
              <header className="ord__kop">
                <div className="ord__kopjudul">
                  <p className="ord__eyebrow">Map proyek · {kini ? kodeProyek(kini.title) : "—"}</p>
                  <h2>{kini?.title ?? "Belum ada proyek"}</h2>
                  <p className="ord__kopket">
                    {kini ? [KATEGORI[kini.category] ?? kini.category, kini.city, tahunProyek(kini)].filter(Boolean).join(" · ") : "Buat proyek pertama dari rak."}
                  </p>
                </div>
                {st && (
                  <Lencana bentuk="pejal" nada={st.nada}>
                    {st.teks}
                  </Lencana>
                )}
              </header>

              {kini && (
                <nav className="ord__aksi" aria-label="Aksi proyek">
                  <a href={`/admin/proyek/satu?id=${idK}`}>
                    <Ikon ikon={Eye} ukuran={14} />
                    Buka
                  </a>
                  <a href={`/admin/proyek/edit?id=${idK}`}>
                    <Ikon ikon={NotePencil} ukuran={14} />
                    Ubah
                  </a>
                  <a href={`/admin/keuangan/terima?proyek=${idK}`}>
                    <Ikon ikon={CoinIn} ukuran={14} />
                    Terima bayar
                  </a>
                </nav>
              )}

              <dl className="ord__rinci">
                <div className="ord__rinci--lebar">
                  <dt>Klien</dt>
                  <dd className="ord__klien">{kini?.client || "—"}</dd>
                </div>
                <div>
                  <dt>Tahap</dt>
                  <dd>
                    {kini && (
                      <PilihTeks
                        judul={`Tahap pipeline ${kini.title}`}
                        nilai={kini.pipelineStage ?? ""}
                        opsi={TAHAP}
                        onUbah={async (v) => {
                          await simpanProyek(kini.id, { pipelineStage: v });
                          gantiSatu(kini.id, { pipelineStage: v });
                        }}
                      />
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Fase klien</dt>
                  <dd>
                    {kini && (
                      <PilihTeks
                        judul={`Fase klien ${kini.title}`}
                        nilai={kini.phase ?? ""}
                        opsi={FASE}
                        onUbah={async (v) => {
                          await ubahFaseProgress(kini.id, v);
                          gantiSatu(kini.id, { phase: v });
                        }}
                      />
                    )}
                  </dd>
                </div>
              </dl>

              {/* Tangga tahap pipeline: tujuh anak tangga, yang sudah dilewati terisi. */}
              <ol className="ord__tangga" aria-label={`Tahap ${tahapKe + 1} dari ${TAHAP.length}`}>
                {TAHAP.map((t, i) => (
                  <li key={t.value} className={i < tahapKe ? "is-lewat" : i === tahapKe ? "is-kini" : undefined}>
                    <span>{t.label}</span>
                  </li>
                ))}
              </ol>

              <div className="ord__bayar">
                <div className="ord__bayarangka">
                  <span>Pembayaran diterima</span>
                  <b title={formatRupiah(diterima)}>{formatRupiah(diterima)}</b>
                  <small>{kontrak > 0 ? `dari ${formatRupiah(kontrak)} · ${Math.round(persen)}%` : "belum berkontrak"}</small>
                </div>
                <div className="ord__bayarbar" role="img" aria-label={`Pembayaran diterima ${Math.round(persen)}%`}>
                  <span style={{ width: `${persen}%` }} />
                </div>
              </div>
            </div>
            {/* Sisi belakang lembar = sampul ordner yang tertutup. */}
            <div className="ord__sampul" aria-hidden="true" style={{ "--ord-rona": kini ? RONA[kini.category] ?? 0 : 0 } as CSSProperties}>
              <span className="ord__sampullabel">
                <b>{kini ? kodeProyek(kini.title) : ""}</b>
                {kini?.title}
              </span>
            </div>
          </article>

          {/* Cincin besi di lipatan. */}
          <div className="ord__cincin" aria-hidden="true">
            <i />
            <i />
          </div>

          {/* Lembar keuangan, berlubang di tepi kirinya. */}
          <article className="ord__lembar ord__lembar--kanan">
            <i className="ord__lubangkertas" aria-hidden="true" />
            <i className="ord__lubangkertas ord__lubangkertas--bawah" aria-hidden="true" />
            <section className="ord__arus" aria-label="Arus kas proyek">
              <div className="ord__seksikepala">
                <h3>Arus kas</h3>
                <ul className="ord__legenda">
                  <li>
                    <span className="ord__kotak ord__kotak--mint" />
                    Kas masuk
                  </li>
                  <li>
                    <span className="ord__kotak ord__kotak--tua" />
                    Biaya
                  </li>
                </ul>
                <button type="button" className="ord__teksbutton" onClick={() => setRentangArus((r) => (r === 6 ? 12 : 6))}>
                  {rentangArus} bulan
                  <Ikon ikon={CaretDown} ukuran={12} />
                </button>
              </div>
              <div className="ord__grafik">
                <LabelYGrafik tinggi={TINGGI} nilai={[singkat(maks), "0", singkat(-maks)]} />
                <div className="ord__kolom" onPointerLeave={() => setSorot(null)}>
                  {deret.map((b, i) => {
                    const nyala = i === iSorot;
                    const atas = 50 - (b.kasMasuk / maks) * 50;
                    const bawah = 50 + (b.biaya / maks) * 50;
                    return (
                      <div
                        key={b.bulan}
                        className="ord__kolomb"
                        tabIndex={0}
                        aria-label={`${BULAN[Number(b.bulan.slice(5, 7)) - 1]} ${b.bulan.slice(0, 4)}: kas masuk ${formatRupiah(b.kasMasuk)}, biaya ${formatRupiah(b.biaya)}`}
                        onPointerEnter={() => setSorot(i)}
                        onFocus={() => setSorot(i)}
                      >
                        <KolomGrafik
                          tinggi={TINGGI}
                          garis={3}
                          lebarBatang={rentangArus > 6 ? 14 : 30}
                          tumpuk
                          label={BULAN[Number(b.bulan.slice(5, 7)) - 1]}
                          batang={[
                            ...(b.kasMasuk > 0
                              ? [{ atas, bawah: 50, nada: nyala ? ("mint" as const) : ("mintpudar" as const), radiusAtas: 4 }]
                              : []),
                            ...(b.biaya > 0
                              ? [{ atas: 50, bawah, nada: nyala ? ("tua" as const) : ("tuapudar" as const), radiusBawah: 4 }]
                              : []),
                          ]}
                        />
                      </div>
                    );
                  })}
                  {bSorot && iSorot !== null && (
                    <div
                      className="ord__tip"
                      style={{
                        left:
                          iSorot >= deret.length - 1
                            ? `calc(${(iSorot / deret.length) * 100}% - 122px)`
                            : `${((iSorot + 1) / deret.length) * 100}%`,
                      }}
                      aria-hidden="true"
                    >
                      <p className="ord__tipjudul">
                        {BULAN[Number(bSorot.bulan.slice(5, 7)) - 1]} {bSorot.bulan.slice(0, 4)}
                      </p>
                      <p className="ord__tipbaris">
                        <span>
                          <i className="ord__tiptitik ord__kotak--mint" />
                          Masuk
                        </span>
                        <b>{formatRupiahRingkas(bSorot.kasMasuk)}</b>
                      </p>
                      <p className="ord__tipbaris">
                        <span>
                          <i className="ord__tiptitik ord__kotak--tua" />
                          Biaya
                        </span>
                        <b>{formatRupiahRingkas(bSorot.biaya)}</b>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="ord__trx" aria-label="Transaksi proyek">
              <div className="ord__seksikepala">
                <h3>Transaksi</h3>
                <a className="ord__semua" href="/admin/keuangan/transaksi">
                  Semua transaksi
                </a>
                <PilihTombol judul="Rentang transaksi" jenis="ghost" ukuran="small" nilai={rentangTrx} opsi={RENTANG} onPilih={setRentangTrx} />
              </div>
              <div className="ord__trxtabel" role="table" aria-label="Transaksi proyek terbaru">
                <div className="ord__trxkepala" role="row">
                  <KepalaUrut label="Tanggal" i={0} urutan={urutTrx.urutan} onUrut={urutTrx.onUrut} />
                  <KepalaUrut label="Transaksi" i={1} urutan={urutTrx.urutan} onUrut={urutTrx.onUrut} />
                  <KepalaUrut label="Nominal" i={2} urutan={urutTrx.urutan} onUrut={urutTrx.onUrut} kanan />
                  <KepalaUrut label="Arah" i={3} urutan={urutTrx.urutan} onUrut={urutTrx.onUrut} />
                </div>
                {urutTrx.terurut.map((t) => {
                  const d = new Date(t.waktu.length === 10 ? t.waktu + "T00:00:00" : t.waktu);
                  return (
                    <div key={t.kunci} className="ord__trxbaris" role="row">
                      <span role="cell" className="ord__trxtgl">
                        {d.getDate()} {BULAN[d.getMonth()]}
                        <small>{d.getFullYear()}</small>
                      </span>
                      <span role="cell" className="ord__trxnama">
                        <span className={`ord__trxubin${t.masuk ? "" : " is-keluar"}`}>
                          <Ikon ikon={t.masuk ? CoinIn : CoinOut} ukuran={14} />
                        </span>
                        <span>
                          <b>{t.nama}</b>
                          <small>{[t.sub, t.orang !== "—" ? t.orang : null, t.catatan !== "—" ? t.catatan : null].filter(Boolean).join(" · ")}</small>
                        </span>
                      </span>
                      <span role="cell" className={`ord__trxrp${t.masuk ? " is-masuk" : ""}`} title={formatRupiah(t.nominal)}>
                        {t.masuk ? "+" : "−"}
                        {formatRupiah(t.nominal)}
                      </span>
                      <span role="cell">
                        <Lencana bentuk="pejal" nada={t.masuk ? "selesai" : "menunggu"}>
                          {t.masuk ? "Masuk" : "Keluar"}
                        </Lencana>
                      </span>
                    </div>
                  );
                })}
                {transaksi.length === 0 && (
                  <p className="ord__kosong">
                    {bayar === null || biaya === null
                      ? "Memuat transaksi…"
                      : kini
                        ? "Belum ada transaksi proyek ini pada rentang ini."
                        : "Pilih ordner di rak."}
                  </p>
                )}
              </div>
            </section>
          </article>
        </section>
      </div>
    </div>
  );
}

export function ProyekKit() {
  return (
    <RequireAuth
      skeleton={
        <div className="ord ord--rangka">
          <div className="ord__papan" />
        </div>
      }
    >
      <Isi />
    </RequireAuth>
  );
}
