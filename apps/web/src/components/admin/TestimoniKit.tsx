import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { Dialog } from "../ui/overlay/Dialog";
import { Icon } from "../ui/Icon";
import { SelDua, type KolomTabel } from "../kit/Tabel";
import { Cari, Sakelar } from "../kit/Isian";
import { Segmen } from "../kit/Segmen";
import { DaftarKit, PilihTombol, PilihStatus, Inisial, HapusBaris, type NadaStatus } from "./daftarKit";
import {
  daftarTestimoni,
  ubahTestimoni,
  hapusTestimoni,
  bacaCache,
  tulisCache,
  type TestimoniAdmin,
} from "../../lib/admin";

/* =============================================================================
   Testimoni — dikirim klien lewat portal proyeknya, dimoderasi di sini.

   Kerangkanya daftar frame 13 (daftarKit.tsx). Yang dibawa dari halaman
   lama: bintang ikut di sel Klien (kolom sendiri membuat tabelnya tidak
   muat), kutipan dipotong satu baris di tabel dan dibaca utuh lewat klik
   (kutipan panjang di sel membuat tinggi baris berbeda-beda dan tabelnya
   sulit dipindai), dan sakelar "tampil di beranda".

   Status sekarang PEMILIH di barisnya, bukan cuma di panel samping: yang
   paling sering dilakukan di halaman ini justru menyetujui, dan itu dulu
   butuh membuka panel lebih dulu.

   Bintangnya ikon situs sendiri (Icon.tsx) — pustaka ikon Coinest tidak
   punya bintang, dan menggambarnya ulang berarti menjiplak.
   ============================================================================= */

const STATUS: Record<string, { label: string; nada: NadaStatus }> = {
  menunggu: { label: "Menunggu", nada: "tunggu" },
  disetujui: { label: "Disetujui", nada: "beres" },
  ditolak: { label: "Ditolak", nada: "netral" },
};

const tanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

function Bintang({ nilai }: { nilai: number }) {
  return (
    <span className="kd__bintang" role="img" aria-label={`${nilai} dari 5 bintang`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} data-isi={i < nilai || undefined}>
          <Icon name="star" size={12} variant={i < nilai ? "filled" : "stroke"} />
        </span>
      ))}
    </span>
  );
}

function Isi() {
  const toast = useToast();
  const [testimoni, setTestimoni] = useState<TestimoniAdmin[] | null>(() =>
    bacaCache<TestimoniAdmin[]>("testimoni"),
  );
  const [cari, setCari] = useState("");
  const [status, setStatus] = useState("semua");
  const [beranda, setBeranda] = useState("semua");

  function muat() {
    daftarTestimoni()
      .then((d) => {
        tulisCache("testimoni", d);
        setTestimoni(d);
      })
      .catch(() => setTestimoni((l) => l ?? []));
  }
  useEffect(muat, []);

  async function ubah(t: TestimoniAdmin, patch: Partial<TestimoniAdmin>, gagal: string) {
    setTestimoni((l) => l?.map((x) => (x.id === t.id ? { ...x, ...patch } : x)) ?? l);
    try {
      await ubahTestimoni(t.id, patch);
    } catch (e) {
      setTestimoni((l) => l?.map((x) => (x.id === t.id ? t : x)) ?? l);
      toast({ judul: gagal, keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function hapus(t: TestimoniAdmin) {
    try {
      await hapusTestimoni(t.id);
      setTestimoni((l) => l?.filter((x) => x.id !== t.id) ?? l);
      toast({ judul: "Testimoni dihapus", keterangan: t.clientName, nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (testimoni ?? [])
      .filter((t) => status === "semua" || t.status === status)
      .filter((t) => beranda === "semua" || t.isFeatured)
      .filter((t) => !q || [t.clientName, t.projectTitle, t.quote].some((v) => (v ?? "").toLowerCase().includes(q)))
      /* Yang menunggu di atas: itu satu-satunya yang menuntut sesuatu. */
      .sort(
        (a, b) =>
          Number(b.status === "menunggu") - Number(a.status === "menunggu") ||
          b.createdAt.localeCompare(a.createdAt),
      );
  }, [testimoni, cari, status, beranda]);

  const menunggu = (testimoni ?? []).filter((t) => t.status === "menunggu").length;

  const kolom: KolomTabel[] = [
    { judul: "Klien", lebar: 250 },
    { judul: "Kutipan", lebar: 430 },
    { judul: "Tanggal", lebar: 110 },
    { judul: "Beranda", lebar: 130 },
    { judul: "Status", lebar: 170 },
    { judul: "", lebar: 70 },
  ];

  const baris = tersaring.map((t) => [
    <div className="kd__sel">
      <Inisial nama={t.clientName} />
      <span className="kd__klien">
        <SelDua atas={t.clientName} bawah={t.projectTitle ?? "Tanpa proyek"} />
        {t.rating ? <Bintang nilai={t.rating} /> : null}
      </span>
    </div>,
    <BacaKutipan t={t} onStatus={(v) => ubah(t, { status: v }, "Gagal mengubah status")} />,
    <span className="kd__redup">{tanggal(t.createdAt)}</span>,
    <label className="kd__sakelar">
      <Sakelar
        judul={`Tampilkan testimoni ${t.clientName} di beranda`}
        checked={t.isFeatured}
        onChange={(e) => ubah(t, { isFeatured: e.currentTarget.checked }, "Gagal mengubah tampilan beranda")}
      />
      <span className={t.isFeatured ? undefined : "kd__redup"}>{t.isFeatured ? "Tampil" : "Tidak"}</span>
    </label>,
    <PilihStatus
      judul={`Status testimoni ${t.clientName}`}
      nilai={t.status}
      nada={STATUS[t.status]?.nada ?? "netral"}
      onPilih={(v) => ubah(t, { status: v }, "Gagal mengubah status")}
      opsi={Object.entries(STATUS).map(([nilai, s]) => ({ nilai, label: s.label }))}
    />,
    <HapusBaris
      judul={`Hapus testimoni dari ${t.clientName}?`}
      keterangan="Testimoni ini dihapus permanen dan tidak lagi tampil di beranda."
      label={`Hapus testimoni ${t.clientName}`}
      onHapus={() => hapus(t)}
    />,
  ]);

  return (
    <DaftarKit
      kunciSaring={`${cari}|${status}|${beranda}`}
      kiri={
        <>
          <Cari
            ukuran="medium"
            judul="Cari testimoni"
            placeholder="Cari testimoni"
            value={cari}
            onChange={(e) => setCari(e.currentTarget.value)}
          />
          <PilihTombol
            judul="Saring status"
            nilai={status}
            onPilih={setStatus}
            opsi={[
              { nilai: "semua", label: "Semua status" },
              { nilai: "menunggu", label: menunggu ? `Menunggu (${menunggu})` : "Menunggu" },
              { nilai: "disetujui", label: "Disetujui" },
              { nilai: "ditolak", label: "Ditolak" },
            ]}
          />
          <PilihTombol
            judul="Saring tampilan beranda"
            nilai={beranda}
            onPilih={setBeranda}
            opsi={[
              { nilai: "semua", label: "Semua" },
              { nilai: "tampil", label: "Tampil di beranda" },
            ]}
          />
        </>
      }
      kolom={kolom}
      baris={baris}
      kunci={tersaring.map((t) => t.id)}
      memuat={testimoni === null}
      teksMemuat="Memuat testimoni…"
      kosong={
        testimoni && testimoni.length > 0
          ? "Tidak ada testimoni pada saringan ini."
          : "Belum ada testimoni. Klien mengirimnya lewat portal proyeknya, lalu disetujui di sini."
      }
      satuan="testimoni"
    />
  );
}

/** Kutipan terpotong satu baris; diklik membuka isi utuhnya. */
function BacaKutipan({ t, onStatus }: { t: TestimoniAdmin; onStatus: (v: string) => void }) {
  return (
    <Dialog
      title={t.clientName}
      description={`${t.projectTitle ?? "Tanpa proyek"} · ${tanggal(t.createdAt)}`}
      trigger={
        <button type="button" className="kd__kutipan" title="Baca utuh">
          {t.quote}
        </button>
      }
    >
      <div className="kd-form">
        {t.rating ? <Bintang nilai={t.rating} /> : null}
        <blockquote className="kd__kutipanutuh">{t.quote}</blockquote>
        <Segmen
          judul="Ubah status testimoni"
          nilai={t.status}
          onPilih={onStatus}
          segmen={Object.entries(STATUS).map(([nilai, s]) => ({ nilai, label: s.label }))}
        />
      </div>
    </Dialog>
  );
}

export function TestimoniKit() {
  return (
    <RequireAuth skeleton={<div className="kd" aria-busy="true" />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
