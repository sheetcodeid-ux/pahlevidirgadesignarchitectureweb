import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { SkeletonTabel } from "../ui/Skeleton";
import { AlertDialog, Sheet } from "../ui/overlay/Dialog";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { DataTable, kolomSkeleton, type Kolom, type Chip } from "../ui/data/DataTable";
import { RequireAuth } from "./RequireAuth";
import { daftarTestimoni, ubahTestimoni, hapusTestimoni, type TestimoniAdmin, bacaCache, tulisCache, jumlahDiingat} from "../../lib/admin";

const LABEL_STATUS: Record<string, string> = { menunggu: "Menunggu", disetujui: "Disetujui", ditolak: "Ditolak" };
const BADGE_STATUS: Record<string, string> = { menunggu: "badge--warn", disetujui: "badge--success", ditolak: "badge--info" };

function tanggal(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function Bintang({ nilai }: { nilai: number }) {
  return (
    <span className="row" style={{ gap: "2px", flexWrap: "nowrap" }} aria-label={`${nilai} dari 5 bintang`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ color: i < nilai ? "var(--text-strong)" : "var(--text-faint)" }}>
          <Icon name="star" size={13} variant={i < nilai ? "filled" : "stroke"} />
        </span>
      ))}
    </span>
  );
}

function Isi() {
  const toast = useToast();
  const [testimoni, setTestimoni] = useState<TestimoniAdmin[] | null>(() => bacaCache<TestimoniAdmin[]>("testimoni"));
  const [hanyaUnggulan, setHanyaUnggulan] = useState(false);

  function muat() {
    daftarTestimoni().then((d) => { tulisCache("testimoni", d); setTestimoni(d); }).catch(() => setTestimoni((l) => l ?? []));
  }

  useEffect(muat, []);

  async function ubahStatus(id: string, status: string) {
    if (!testimoni) return;
    const sebelum = testimoni;
    setTestimoni(testimoni.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      await ubahTestimoni(id, { status });
    } catch (e) {
      setTestimoni(sebelum);
      toast({ judul: "Gagal mengubah status", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function toggleFeatured(id: string, isFeatured: boolean) {
    if (!testimoni) return;
    const sebelum = testimoni;
    setTestimoni(testimoni.map((t) => (t.id === id ? { ...t, isFeatured } : t)));
    try {
      await ubahTestimoni(id, { isFeatured });
    } catch (e) {
      setTestimoni(sebelum);
      toast({ judul: "Gagal mengubah status unggulan", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function hapus(id: string) {
    try {
      await hapusTestimoni(id);
      setTestimoni((t) => t?.filter((x) => x.id !== id) ?? null);
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  const kolom: Kolom<TestimoniAdmin>[] = [
    {
      // Bintang ikut di sel Klien, bukan kolom sendiri: dengan kolom terpisah
      // tabelnya jadi delapan kolom dan tidak muat di 1440px — terukur, kolom
      // Aksi terpotong di tepi kanan.
      judul: "Klien",
      gambar: true,
      render: (t) => (
        <span style={{ minWidth: 0, display: "block" }}>
          <span className="item__title">{t.clientName}</span>
          <div className="attachment__size">{t.projectTitle ?? "Tanpa proyek"}</div>
          {t.rating && <Bintang nilai={t.rating} />}
        </span>
      ),
    },
    {
      // Kutipannya dipotong satu baris di tabel dan dibaca utuh lewat tombol
      // Buka. Testimoni panjang di dalam sel membuat tinggi baris berbeda-beda
      // dan tabelnya jadi sulit dipindai.
      judul: "Kutipan",
      render: (t) => <span className="sel-potong">{t.quote}</span>,
    },
    { judul: "Tanggal", kelas: "table__num", lebar: "5rem", render: (t) => tanggal(t.createdAt) },
    {
      judul: "Beranda",
      lebar: "4rem",
      render: (t) => (
        <label className="choice">
          <input type="checkbox" checked={t.isFeatured} onChange={(e) => toggleFeatured(t.id, e.target.checked)}
            aria-label={`Tampilkan testimoni ${t.clientName} di beranda`} />
          <span className="choice__text"><span>{t.isFeatured ? "Tampil" : "Tidak"}</span></span>
        </label>
      ),
    },
    {
      judul: "Status",
      lebar: "4.5rem",
      render: (t) => (
        <span className={`badge ${BADGE_STATUS[t.status] ?? "badge--info"}`}>
          <span className="badge__dot" />{LABEL_STATUS[t.status] ?? t.status}
        </span>
      ),
    },
    {
      judul: "Aksi",
      kelas: "table__actions",
      lebar: "3.5rem",
      render: (t) => (
        <span className="table__act">
          <Sheet
            title={t.clientName}
            description={`${t.projectTitle ?? "Tanpa proyek"} · ${tanggal(t.createdAt)}`}
            trigger={
              <button type="button" className="btn btn--secondary btn--icon btn--boxed"
                aria-label={`Buka testimoni ${t.clientName}`}>
                <Icon name="quote" size={15} />
              </button>
            }
          >
            <div className="stack">
              {t.rating && <Bintang nilai={t.rating} />}
              <div className="bubble">{t.quote}</div>

              <span className="t-label">Ubah status</span>
              <div className="segmented segmented--block" role="group" aria-label="Ubah status testimoni">
                {Object.entries(LABEL_STATUS).map(([v, l]) => (
                  <button key={v} type="button" className="segmented__opt"
                    aria-pressed={t.status === v} onClick={() => ubahStatus(t.id, v)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </Sheet>
          <AlertDialog
            destructive
            title={`Hapus testimoni dari ${t.clientName}?`}
            description="Testimoni ini akan dihapus permanen dan tidak lagi tampil di beranda."
            confirmLabel="Ya, hapus"
            onConfirm={() => hapus(t.id)}
            trigger={
              <button type="button" className="btn btn--secondary btn--icon btn--boxed btn--hapus"
                aria-label={`Hapus testimoni ${t.clientName}`}>
                <Icon name="trash" size={15} />
              </button>
            }
          />
        </span>
      ),
    },
  ];

  const chips: Chip<TestimoniAdmin>[] = [
    { id: "semua", label: "Semua" },
    ...Object.entries(LABEL_STATUS).map(([v, l]) => ({
      id: v, label: l, cocok: (t: TestimoniAdmin) => t.status === v,
    })),
  ];

  const terpilih = hanyaUnggulan ? testimoni?.filter((t) => t.isFeatured) ?? null : testimoni;

  return (
    <DataTable
      data={terpilih}
      kunci={(t) => t.id}
      kolom={kolom}
      chips={chips}
      cariPada={(t) => [t.clientName, t.projectTitle, t.quote]}
      placeholderCari="Cari nama klien, proyek, atau isi testimoni…"
      labelCari="Cari testimoni"
      satuan="testimoni"
      barisSkeleton={jumlahDiingat("testimoni", 5)}
      saringan={
        <label className="choice">
          <input type="checkbox" checked={hanyaUnggulan} onChange={(e) => setHanyaUnggulan(e.target.checked)} />
          <span className="choice__text"><span>Hanya yang tampil di beranda</span></span>
        </label>
      }
      bersihkanAktif={hanyaUnggulan}
      onBersihkan={() => setHanyaUnggulan(false)}
      kosong={{
        ikon: "quote",
        judul: "Belum ada testimoni",
        keterangan: "Testimoni dikirim klien lewat portal progres proyeknya, lalu disetujui di sini.",
      }}
    />
  );
}

const KOLOM_TIRUAN = kolomSkeleton<TestimoniAdmin>([
  { judul: "Klien", gambar: true, render: () => null },
  { judul: "Kutipan", render: () => null },
  { judul: "Tanggal", kelas: "table__num", lebar: "5rem", render: () => null },
  { judul: "Beranda", lebar: "4rem", render: () => null },
  { judul: "Status", lebar: "4.5rem", render: () => null },
  { judul: "Aksi", kelas: "table__actions", lebar: "3.5rem", render: () => null },
]);

export function TestimonialsPanel() {
  return (
    <RequireAuth
      skeleton={
        <div className="listpage"><div className="listpage__pad">
          <SkeletonTabel baris={jumlahDiingat("testimoni", 5)} kolom={KOLOM_TIRUAN} />
        </div></div>
      }
    >
      <ToastProvider><Isi /></ToastProvider>
    </RequireAuth>
  );
}
