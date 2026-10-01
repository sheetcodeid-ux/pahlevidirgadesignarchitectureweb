import { useEffect, useRef, useState } from "react";
import { Sheet, AlertDialog } from "../kit/Overlay";
import { useToast } from "../kit/Toast";
import { Tombol } from "../kit/Tombol";
import { Trash } from "../kit/ikon";
import { formatRupiah } from "../../lib/format";
import { hapusBiaya, type BiayaProyek } from "../../lib/admin";
import { jagaFokusSesudahHapus } from "../../lib/fokus";

/* =============================================================================
   Rincian satu biaya — dan satu-satunya jalan MENGHAPUS biaya yang salah
   ketik.

   Menghapus biaya sempat tidak bisa dari mana pun: tombolnya tinggal di
   editor proyek lama, dan `hapusBiaya` tidak punya satu pun pemanggil sejak
   editor itu dibuang (jebakan #38). Dibuka dari baris Biaya Terbaru di Catat
   Pengeluaran — kesalahan paling sering ketahuan tepat sesudah mencatat —
   dan dari nama biaya di Semua Transaksi. Satu modul untuk keduanya.

   Mengubah biaya sengaja TIDAK ada: API-nya tidak punya PATCH untuk biaya,
   dan yang salah cukup dihapus lalu dicatat ulang — dua langkah yang sama
   dengan yang dilakukan panel lama.
   ============================================================================= */

const tanggal = (iso: string) => {
  /* `incurred_on` kolom date: dipotong dari string, bukan lewat Date, supaya
     tidak mundur sehari di zona barat GMT. */
  const [t, b, h] = iso.slice(0, 10).split("-");
  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return `${Number(h)} ${BULAN[Number(b) - 1]} ${t}`;
};

export function DialogBiaya({
  biaya,
  kategori,
  open,
  onOpenChange,
  onDihapus,
}: {
  biaya: BiayaProyek | null;
  /** Label kategori yang sudah terbaca — pemanggil memegang kamusnya. */
  kategori: string;
  open: boolean;
  onOpenChange: (b: boolean) => void;
  /** Memuat ulang daftarnya. Kalau mengembalikan janji, fokus baru
      dipindahkan sesudah daftarnya selesai digambar ulang. */
  onDihapus: () => Promise<unknown> | void;
}) {
  const toast = useToast();
  const [menghapus, setMenghapus] = useState(false);
  /* Dibuka dari luar tanpa pemicu Radix — fokus dikembalikan sendiri ke
     yang membukanya, sama dengan dialog bukti pembayaran. */
  const asal = useRef<HTMLElement | null>(null);
  /* Salinan yang TIDAK dikosongkan saat dialog menutup — dipakai hapus(),
     yang baru selesai sesudah dialognya tertutup. */
  const pembuka = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      asal.current = document.activeElement as HTMLElement | null;
      pembuka.current = asal.current;
      return;
    }
    const el = asal.current;
    asal.current = null;
    if (el?.isConnected) requestAnimationFrame(() => el.focus());
  }, [open]);
  if (!biaya) return null;

  async function hapus() {
    const b = biaya;
    if (!b) return;
    setMenghapus(true);
    /* Kartu yang membuka dialog ini ikut hilang begitu daftarnya dimuat
       ulang (kartu biaya berkunci id) — lihat lib/fokus. */
    try {
      await jagaFokusSesudahHapus(pembuka.current, async () => {
        await hapusBiaya(b.id);
        onOpenChange(false);
        toast({ judul: "Biaya dihapus", keterangan: `${b.label} — ${formatRupiah(b.amount)}.`, nada: "sukses" });
        await onDihapus();
      });
    } catch (e) {
      toast({ judul: "Gagal menghapus biaya", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenghapus(false);
    }
  }

  /* Laci dari kanan, bukan dialog di tengah: ini RINCIAN satu baris, dan
     daftar asalnya tetap terlihat di sebelahnya. */
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Rincian Biaya"
      description={biaya.projectTitle ?? "Tanpa proyek"}
      footer={
        <div className="kd-form__kaki bk__aksi">
          <AlertDialog
            destructive
            title="Hapus biaya ini?"
            description={`${biaya.label} — ${formatRupiah(biaya.amount)}. Laba bersih proyeknya dan angka Fee/Gaji orangnya ikut berubah. Kalau nominalnya yang salah, hapus lalu catat ulang.`}
            confirmLabel="Ya, hapus"
            onConfirm={hapus}
            trigger={
              <Tombol memuat={menghapus} ukuran="large" jenis="secondary" kiri={Trash} disabled={menghapus}>
                {menghapus ? "Menghapus…" : "Hapus biaya"}
              </Tombol>
            }
          />
        </div>
      }
    >
      <div className="bk">
        <div className="bk__puncak">
          <p className="bk__nominal">{formatRupiah(biaya.amount)}</p>
        </div>
        <dl className="bk__rinci">
          <div><dt>Keterangan</dt><dd>{biaya.label}</dd></div>
          <div><dt>Kategori</dt><dd>{kategori}</dd></div>
          {biaya.teamMemberName && <div><dt>Dibayar ke</dt><dd>{biaya.teamMemberName}</dd></div>}
          <div><dt>Tanggal</dt><dd>{tanggal(biaya.incurredOn)}</dd></div>
        </dl>
      </div>
    </Sheet>
  );
}
