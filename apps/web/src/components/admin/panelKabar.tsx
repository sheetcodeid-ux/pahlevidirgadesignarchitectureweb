import * as RPopover from "@radix-ui/react-popover";
import { useEffect, useState, type ReactNode } from "react";
import { navigate } from "astro:transitions/client";
import { TombolBulat } from "../kit/Item";
import { Ikon } from "../kit/Ikon";
import { ArrowRight, Bell, ChatTeardropDots, CheckCircle, NavEnvelope } from "../kit/ikon";
import { daftarPesan, bacaCache, type Pesan } from "../../lib/admin";
import { AreaGulir, Avatar, Kosong as KosongKit, RangkaBaris } from "../kit/Tampilan";
import type { BarisNotifikasi } from "../../lib/notifikasi";
import { ikonButir, kepalaHari, waktuButir } from "./linimasaNotif";

/* =============================================================================
   Panel pratinjau di kepala halaman — tombol Pesan dan lonceng.

   Dulu keduanya langsung melempar ke halaman lain. Itu memaksa satu muat
   halaman hanya untuk menjawab "ada apa?", dan pertanyaan itu yang paling
   sering diajukan. Sekarang klik membuka panel kecil berisi yang terbaru;
   satu klik lagi membuka butirnya, dan "Buka semua" ada di kakinya.

   Isi lonceng dioper dari KepalaKit (sumber yang sama dengan angkanya, jadi
   angka dan isi tidak bisa menyimpang). Daftar pesan diambil saat panel
   DIBUKA, bukan saat halaman dimuat — kepala ini dipasang di setiap halaman,
   dan pesan lengkap tidak dibutuhkan kecuali panelnya dibuka. Nilai awalnya
   dibaca dari cache halaman Pesan Masuk kalau ada (membaca saja, jebakan #8).
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

const JENIS: Record<string, string> = { residential: "Hunian", commercial: "Komersial", interior: "Interior" };

/* Kerangka panel: kepala (judul + keterangan), isi yang bergulir sendiri,
   kaki berisi satu tautan. Keduanya memakainya supaya bentuknya satu. */
function Panel({
  pemicu,
  judul,
  keterangan,
  buka,
  onBuka,
  kaki,
  children,
}: {
  pemicu: ReactNode;
  judul: string;
  keterangan: string;
  buka: boolean;
  onBuka: (b: boolean) => void;
  kaki: { label: string; ke: string };
  children: ReactNode;
}) {
  return (
    <RPopover.Root open={buka} onOpenChange={onBuka}>
      <RPopover.Trigger asChild>{pemicu}</RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content className="kp" align="end" sideOffset={10} collisionPadding={12}>
          <div className="kp__kepala">
            <p className="kp__judul">{judul}</p>
            <p className="kp__ket">{keterangan}</p>
          </div>
          {/* Area Gulir kit: batang tipis yang sama di Windows kantor dan Mac —
              batang klasik 17px di Windows memotong cuplikan pesan. */}
          <AreaGulir className="kp__isi">{children}</AreaGulir>
          <button
            type="button"
            className="kp__kaki"
            onClick={() => {
              onBuka(false);
              navigate(kaki.ke);
            }}
          >
            {kaki.label}
            <Ikon ikon={ArrowRight} ukuran={14} />
          </button>
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}

function Kosong({ ikon, judul, ket }: { ikon: typeof Bell; judul: string; ket: string }) {
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

/* --- Pesan ---------------------------------------------------------------- */

export function PanelPesan({ belumDibaca }: { belumDibaca: number }) {
  const [buka, setBuka] = useState(false);
  /* Dimulai null, BUKAN dari cache saat render: server tidak punya
     sessionStorage, dan nilai awal yang berbeda antara server dan klien
     membuang pohon React saat hidrasi (jebakan #8). Cache dibaca saat
     panel dibuka. */
  const [pesan, setPesan] = useState<Pesan[] | null>(null);
  const [galat, setGalat] = useState(false);

  useEffect(() => {
    if (!buka) return;
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

  /* Yang belum dibaca lebih dulu, lalu yang terbaru. Lima saja — panel ini
     menjawab "ada yang baru?", daftar lengkapnya di halamannya. */
  const tampil = (pesan ?? [])
    .slice()
    .sort((a, b) => Number(b.status === "new") - Number(a.status === "new") || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <Panel
      buka={buka}
      onBuka={setBuka}
      judul="Pesan Masuk"
      keterangan={belumDibaca > 0 ? `${belumDibaca} belum dibaca` : "Semua sudah dibaca"}
      kaki={{ label: "Buka Pesan Masuk", ke: "/admin/pesan" }}
      pemicu={
        <TombolBulat
          ikon={ChatTeardropDots}
          judul={belumDibaca > 0 ? `Pesan Masuk, ${belumDibaca} belum dibaca` : "Pesan Masuk"}
          tanda={belumDibaca > 0}
          aria-haspopup="dialog"
          aria-expanded={buka}
        />
      }
    >
      {galat && !pesan ? (
        <Kosong ikon={NavEnvelope} judul="Pesan tidak bisa dimuat" ket="Periksa koneksi, lalu buka lagi." />
      ) : !pesan ? (
        <Rangka />
      ) : tampil.length === 0 ? (
        <Kosong ikon={NavEnvelope} judul="Belum ada pesan" ket="Pesan dari form kontak situs muncul di sini." />
      ) : (
        <ul className="kp__daftar">
          {tampil.map((p) => {
            const baru = p.status === "new";
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={baru ? "kp__butir is-baru" : "kp__butir"}
                  onClick={() => {
                    setBuka(false);
                    navigate(`/admin/pesan?id=${encodeURIComponent(p.id)}`);
                  }}
                >
                  <Avatar nama={p.name} hiasan className={baru ? undefined : "kp__avatar--lama"} />
                  <span className="kp__teks">
                    <span className="kp__baris1">
                      <b>{p.name}</b>
                      <time dateTime={p.createdAt}>{waktuRelatif(p.createdAt)}</time>
                    </span>
                    <span className="kp__baris2">
                      {[p.projectType && JENIS[p.projectType], p.budgetRange].filter(Boolean).join(" · ") || "Tanpa jenis proyek"}
                    </span>
                    <span className="kp__cuplik">{p.message}</span>
                  </span>
                  {baru && <span className="kp__titik" aria-label="Belum dibaca" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* --- Notifikasi ----------------------------------------------------------- */

export function PanelNotifikasi({ baris }: { baris: BarisNotifikasi[] | null }) {
  const [buka, setBuka] = useState(false);
  const jumlah = baris?.length ?? 0;

  /* Dikelompokkan per hari seperti linimasa Dashboard, terbaru di atas.
     Butir tanpa tanggal (tidak ada di sumber saat ini) masuk "Lainnya". */
  const urut = (baris ?? []).slice().sort((a, b) => (b.tanggal ?? "").localeCompare(a.tanggal ?? "")).slice(0, 8);
  const kelompok: [string, BarisNotifikasi[]][] = [];
  for (const n of urut) {
    const k = n.tanggal ? kepalaHari(n.tanggal) : "Lainnya";
    const ada = kelompok.find(([h]) => h === k);
    if (ada) ada[1].push(n);
    else kelompok.push([k, [n]]);
  }

  return (
    <Panel
      buka={buka}
      onBuka={setBuka}
      judul="Notifikasi"
      keterangan={jumlah > 0 ? `${jumlah} perlu ditangani` : "Tidak ada yang menunggu"}
      kaki={{ label: "Lihat semua notifikasi", ke: "/admin/notifikasi" }}
      pemicu={
        <TombolBulat
          ikon={Bell}
          judul={jumlah > 0 ? `Notifikasi, ${jumlah} perlu ditangani` : "Notifikasi"}
          tanda={jumlah > 0}
          aria-haspopup="dialog"
          aria-expanded={buka}
        />
      }
    >
      {baris === null ? (
        <Rangka />
      ) : jumlah === 0 ? (
        <Kosong ikon={CheckCircle} judul="Semua sudah ditangani" ket="Pesan baru, tenggat lewat, dan testimoni yang menunggu akan muncul di sini." />
      ) : (
        kelompok.map(([hari, isi]) => (
          <section key={hari} className="kp__kelompok">
            <h3 className="kp__hari">{hari}</h3>
            <ul className="kp__daftar">
              {isi.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className="kp__butir"
                    onClick={() => {
                      setBuka(false);
                      navigate(n.ke);
                    }}
                  >
                    <span className="kp__ubin" aria-hidden="true"><Ikon ikon={ikonButir(n)} ukuran={16} /></span>
                    <span className="kp__teks">
                      <span className="kp__baris1">
                        <b>{n.judul}</b>
                        <time>{waktuButir(n)}</time>
                      </span>
                      <span className="kp__baris2">{n.detail}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </Panel>
  );
}

