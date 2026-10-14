import * as RPopover from "@radix-ui/react-popover";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { navigate } from "astro:transitions/client";
import { TombolBulat } from "../kit/Item";
import { Ikon } from "../kit/Ikon";
import { ArrowRight, ArsRevisi, ArsSuratPengantar } from "../kit/ikon";
import { Revisi } from "../kit/Nav";
import { KopBersel, type KopPalet } from "../kit/Palet";
import type { DataIkon } from "../kit/Ikon";
import { daftarPesan, bacaCache, STATUS_PESAN, type Pesan } from "../../lib/admin";
import { CATEGORY_LABELS } from "../../lib/api";
import { daftarLembar, lembarUntuk } from "../../lib/navAdmin";
import { AreaGulir, Kosong as KosongKit, RangkaBaris } from "../kit/Tampilan";
import type { BarisNotifikasi } from "../../lib/notifikasi";
import { kepalaHari, waktuButir } from "./linimasaNotif";
import { nomorAgenda } from "../../lib/nomorDokumen";

/* =============================================================================
   Panel di kepala halaman — tombol Pesan (surat pengantar) dan notifikasi
   (segitiga revisi). Keduanya bahasa set gambar kerja yang sama dengan rel
   dan palet: kop bersel, lalu benda yang memang dipakai kantor arsitek
   untuk urusan itu. Rancangan dipilih pemilik dari sketsa:

   - NOTIFIKASI = DAFTAR REVISI seperti tabel revisi di kop gambar: segitiga
     bernomor · waktu · uraian · LEMBAR tujuan, per hari, terbaru di atas.
   - PESAN = SURAT PENGANTAR di atas tumpukan: surat terpilih tampil utuh
     bernomor agenda, surat lain bertumpuk di bawahnya; mengambil satu dari
     tumpukan menariknya ke atas, dan "Buka surat" membukanya.

   Isi notifikasi dioper dari KepalaKit (sumber yang sama dengan angkanya).
   Daftar pesan diambil saat panel DIBUKA, bukan saat halaman dimuat;
   nilai awalnya dibaca dari cache halaman Pesan Masuk kalau ada (membaca
   saja, jebakan #8).
   ============================================================================= */

/** "Baru saja" / "12 menit lalu" / "3 jam lalu" / "Kemarin" / "3 Okt". */
export function waktuRelatif(iso: string): string {
  const d = new Date(iso);
  const detik = Math.round((Date.now() - d.getTime()) / 1000);
  if (detik < 60) return "Baru saja";
  if (detik < 3600) return `${Math.floor(detik / 60)} menit lalu`;
  if (detik < 86_400 && d.getDate() === new Date().getDate()) return `${Math.floor(detik / 3600)} jam lalu`;
  const hari = kepalaHari(iso);
  return hari === "Hari ini" ? `${Math.floor(detik / 3600)} jam lalu` : hari;
}

const LEMBAR = daftarLembar().halaman;

/* Kerangka panel: kop bersel, isi milik tiap panel, kaki berisi ringkasan
   dan satu tautan. Keduanya memakainya supaya bentuknya satu. */
function Panel({
  pemicu,
  kop,
  buka,
  onBuka,
  kaki,
  className,
  children,
}: {
  pemicu: ReactNode;
  kop: KopPalet;
  buka: boolean;
  onBuka: (b: boolean) => void;
  kaki: { label: string; ke: string; ringkas?: ReactNode };
  className: string;
  children: ReactNode;
}) {
  return (
    <RPopover.Root open={buka} onOpenChange={onBuka}>
      <RPopover.Trigger asChild>{pemicu}</RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content className={`kp ${className}`} align="end" sideOffset={10} collisionPadding={12} aria-label={kop.judul}>
          <KopBersel kop={kop} />
          {children}
          <div className="kp__kaki">
            {kaki.ringkas && <span className="kp__ringkas">{kaki.ringkas}</span>}
            <button
              type="button"
              className="kp__kakibuka"
              onClick={() => {
                onBuka(false);
                navigate(kaki.ke);
              }}
            >
              {kaki.label}
              <Ikon ikon={ArrowRight} ukuran={14} />
            </button>
          </div>
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}

function Kosong({ ikon, judul, ket }: { ikon: DataIkon; judul: string; ket: string }) {
  return (
    <KosongKit ikon={ikon} judul={judul} ringkas>
      {ket}
    </KosongKit>
  );
}

function Rangka() {
  return (
    <div className="kp__memuat">
      <RangkaBaris jumlah={3} />
    </div>
  );
}

/* --- Pesan: SURAT PENGANTAR DI ATAS TUMPUKAN ------------------------------ */

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const jenisPesan = (p: Pesan) => (p.projectType ? (CATEGORY_LABELS as Record<string, string>)[p.projectType] ?? p.projectType : null);

function diterima(iso: string) {
  const d = new Date(iso);
  const jam = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return `${d.getDate()} ${BULAN[d.getMonth()]!.slice(0, 3)} ${d.getFullYear()} · ${jam}`;
}

function Cap({ p }: { p: Pesan }) {
  const baru = p.status === "new";
  return <span className={baru ? "kp__cap is-baru" : "kp__cap"}>{STATUS_PESAN[p.status] ?? p.status}</span>;
}

export function PanelPesan({ belumDibaca }: { belumDibaca: number }) {
  const [buka, setBuka] = useState(false);
  /* Dimulai null, BUKAN dari cache saat render: server tidak punya
     sessionStorage, dan nilai awal yang berbeda antara server dan klien
     membuang pohon React saat hidrasi (jebakan #8). Cache dibaca saat
     panel dibuka. */
  const [pesan, setPesan] = useState<Pesan[] | null>(null);
  const [galat, setGalat] = useState(false);
  /* Surat yang sedang di atas tumpukan — null = bawaan (terbaru yang belum
     dibaca, atau terbaru). `ditarik` hanya menyala sesudah staf mengambil
     surat dari tumpukan: gerak karena perbuatan, bukan saat panel dibuka. */
  const [atas, setAtas] = useState<string | null>(null);
  const [ditarik, setDitarik] = useState(false);
  const tombolBuka = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!buka) {
      setAtas(null);
      setDitarik(false);
      return;
    }
    let hidup = true;
    setGalat(false);
    setPesan((kini) => kini ?? bacaCache<Pesan[]>("pesan:"));
    daftarPesan()
      .then((d) => hidup && setPesan(d))
      .catch(() => hidup && setGalat(true));
    return () => {
      hidup = false;
    };
  }, [buka]);

  const semua = pesan ?? [];
  const nomor = nomorAgenda(semua);
  /* Yang belum dibaca lebih dulu, lalu yang terbaru. Lima saja — panel ini
     menjawab "ada yang baru?", daftar lengkapnya di halamannya. */
  const tampil = semua
    .slice()
    .sort((a, b) => Number(b.status === "new") - Number(a.status === "new") || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const surat = tampil.find((p) => p.id === atas) ?? tampil[0];
  const tumpukan = tampil.filter((p) => p !== surat);
  const bulanIni = (() => {
    const k = new Date();
    return semua.filter((p) => {
      const d = new Date(p.createdAt);
      return d.getFullYear() === k.getFullYear() && d.getMonth() === k.getMonth();
    }).length;
  })();

  const bukaSurat = (p: Pesan) => {
    setBuka(false);
    navigate(`/admin/pesan?id=${encodeURIComponent(p.id)}`);
  };
  /* Tepi surat yang diambil HILANG dari tumpukan (ia naik ke atas), jadi
     fokus papan ketik dipindah ke "Buka surat" — kalau tidak, fokusnya jatuh
     ke <body> (jebakan #39). */
  const tarik = (p: Pesan) => {
    setAtas(p.id);
    setDitarik(true);
    requestAnimationFrame(() => tombolBuka.current?.focus());
  };

  return (
    <Panel
      buka={buka}
      onBuka={setBuka}
      className="kp--surat"
      kop={{
        ikon: ArsSuratPengantar,
        judul: "Surat masuk",
        sel: [
          { label: "Belum dibaca", nilai: belumDibaca },
          { label: BULAN[new Date().getMonth()]!, nilai: pesan ? `${bulanIni} surat` : "—" },
        ],
      }}
      kaki={{ label: "Buka Pesan Masuk", ke: "/admin/pesan", ringkas: pesan ? `${semua.length} surat di agenda` : undefined }}
      pemicu={
        /* Surat pengantar — ikon baris Pesan Masuk di rel — dengan angka
           pesan yang belum dibaca di sudutnya. */
        <TombolBulat
          className="kl__kabar"
          isi={
            <>
              <Ikon ikon={ArsSuratPengantar} ukuran={18} />
              {belumDibaca > 0 && <b className="kl__angka" aria-hidden="true">{belumDibaca > 9 ? "9+" : belumDibaca}</b>}
            </>
          }
          judul={belumDibaca > 0 ? `Pesan Masuk, ${belumDibaca} belum dibaca` : "Pesan Masuk"}
          aria-haspopup="dialog"
          aria-expanded={buka}
        />
      }
    >
      <div className="kps__wadah">
        {galat && !pesan ? (
          <Kosong ikon={ArsSuratPengantar} judul="Surat tidak bisa dimuat" ket="Periksa koneksi, lalu buka lagi." />
        ) : !pesan ? (
          <Rangka />
        ) : !surat ? (
          <Kosong ikon={ArsSuratPengantar} judul="Belum ada surat" ket="Pesan dari form kontak situs masuk ke sini." />
        ) : (
          <>
            <article key={surat.id} className={ditarik ? "kps is-ditarik" : "kps"} aria-label={`Surat dari ${surat.name}`}>
              <header className="kps__kepala">
                <span className="kps__jenis">Surat pengantar</span>
                <span className="kps__no">No. {nomor.get(surat.id)}</span>
                <Cap p={surat} />
              </header>
              <dl className="kps__isian">
                <div>
                  <dt>Dari</dt>
                  <dd>{surat.name}</dd>
                </div>
                <div>
                  <dt>Perihal</dt>
                  <dd>{[jenisPesan(surat), surat.budgetRange].filter(Boolean).join(" · ") || "Tanpa jenis proyek"}</dd>
                </div>
                <div>
                  <dt>Diterima</dt>
                  <dd>
                    <time dateTime={surat.createdAt}>{diterima(surat.createdAt)}</time>
                    <span className="kps__relatif">{waktuRelatif(surat.createdAt)}</span>
                  </dd>
                </div>
              </dl>
              <blockquote className="kps__cuplik">{surat.message}</blockquote>
              <button ref={tombolBuka} type="button" className="kps__buka" onClick={() => bukaSurat(surat)}>
                Buka surat
                <Ikon ikon={ArrowRight} ukuran={14} />
              </button>
            </article>
            {tumpukan.length > 0 && (
              <ul className="kps__tumpukan" aria-label="Surat lain di tumpukan">
                {tumpukan.map((p, i) => (
                  <li key={p.id} style={{ ["--kps-ke" as string]: i }}>
                    <button
                      type="button"
                      className={p.status === "new" ? "kps__tepi is-baru" : "kps__tepi"}
                      aria-label={`Ambil surat dari ${p.name} ke atas tumpukan`}
                      onClick={() => tarik(p)}
                    >
                      <b>{p.name}</b>
                      <span className="kps__tepiket">
                        {[jenisPesan(p), waktuRelatif(p.createdAt)].filter(Boolean).join(" · ")}
                      </span>
                      <Cap p={p} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

/* --- Notifikasi: DAFTAR REVISI -------------------------------------------- */

const SUMBER: [string, string][] = [
  ["pesan-", "Pesan"],
  ["testimoni-", "Testimoni"],
  ["tugas-", "Tenggat"],
];

export function PanelNotifikasi({ baris }: { baris: BarisNotifikasi[] | null }) {
  const [buka, setBuka] = useState(false);
  const semua = baris ?? [];
  const jumlah = semua.length;

  /* Nomor revisi menurut urutan waktu: yang tertua revisi 1, seperti tabel
     revisi di kop gambar — tampil terbaru di atas, jadi nomornya menurun. */
  const naik = semua.slice().sort((a, b) => (a.tanggal ?? "").localeCompare(b.tanggal ?? ""));
  const nomor = new Map(naik.map((n, i) => [n.id, i + 1]));
  const urut = naik.slice().reverse();
  const kelompok: [string, BarisNotifikasi[]][] = [];
  for (const n of urut) {
    const k = n.tanggal ? kepalaHari(n.tanggal) : "Lainnya";
    const ada = kelompok.find(([h]) => h === k);
    if (ada) ada[1].push(n);
    else kelompok.push([k, [n]]);
  }
  const lembarTujuan = (n: BarisNotifikasi) => lembarUntuk(n.ke.split(/[?#]/)[0]!, LEMBAR)?.lembar ?? null;
  const banyakLembar = new Set(semua.map((n) => lembarTujuan(n)?.kode ?? n.ke)).size;

  return (
    <Panel
      buka={buka}
      onBuka={setBuka}
      className="kp--revisi"
      kop={{
        ikon: ArsRevisi,
        judul: "Daftar revisi",
        sel: [
          { label: "Terbuka", nilai: baris ? jumlah : "—" },
          { label: "Lembar", nilai: baris ? banyakLembar : "—" },
        ],
      }}
      kaki={{
        label: "Semua revisi",
        ke: "/admin/notifikasi",
        ringkas: baris
          ? SUMBER.map(([awal, nama]) => `${nama} ${semua.filter((n) => n.id.startsWith(awal)).length}`).join(" · ")
          : undefined,
      }}
      pemicu={
        /* Segitiga REVISI berangka — butir yang sama dengan kolom REV rel
           samping, dijumlahkan. Kosong = segitiga tanpa angka. */
        <TombolBulat
          className="kl__kabar"
          isi={<Revisi jumlah={jumlah} judul="Notifikasi" className="kl__revisi" />}
          judul={jumlah > 0 ? `Notifikasi, ${jumlah} perlu ditangani` : "Notifikasi"}
          aria-haspopup="dialog"
          aria-expanded={buka}
        />
      }
    >
      {baris === null ? (
        <Rangka />
      ) : jumlah === 0 ? (
        <Kosong ikon={ArsRevisi} judul="Tidak ada revisi terbuka" ket="Pesan baru, tenggat lewat, dan testimoni yang menunggu muncul di sini." />
      ) : (
        <>
          <div className="kpr__kepalatabel" aria-hidden="true">
            <span>Rev</span>
            <span>Waktu</span>
            <span>Uraian</span>
            <span>Lembar</span>
          </div>
          <AreaGulir className="kp__isi">
            {kelompok.map(([hari, isi]) => (
              <section key={hari} className="kpr__hari" aria-label={hari}>
                <h3 className="kpr__harijudul">
                  {hari}
                  <span>{isi.length} revisi</span>
                </h3>
                <ul className="kpr__daftar">
                  {isi.map((n) => {
                    const l = lembarTujuan(n);
                    const berjam = Boolean(n.tanggal && n.tanggal.length > 10);
                    const no = nomor.get(n.id) ?? 0;
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          className="kpr__baris"
                          aria-label={`Revisi ${no}: ${n.judul}, ${n.detail}${l ? ` — buka lembar ${l.kode} ${l.label}` : ""}`}
                          onClick={() => {
                            setBuka(false);
                            navigate(n.ke);
                          }}
                        >
                          <Revisi jumlah={no} judul={`Revisi ${no}`} batas={99} className="kpr__no" />
                          <span className={berjam ? "kpr__waktu" : "kpr__waktu is-tenggat"}>{berjam ? waktuButir(n) : "Tenggat"}</span>
                          <span className="kpr__uraian">
                            <b>{n.judul}</b>
                            <span>{berjam ? n.detail : `${n.detail} · ${waktuButir(n)}`}</span>
                          </span>
                          <span className="kpr__lembar">
                            <b>{l?.kode ?? "—"}</b>
                            <Ikon ikon={ArrowRight} ukuran={12} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </AreaGulir>
        </>
      )}
    </Panel>
  );
}
