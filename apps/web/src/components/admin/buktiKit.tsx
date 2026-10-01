import { useEffect, useRef } from "react";
import { Dialog } from "../kit/Overlay";
import { useToast } from "../kit/Toast";
import { Tombol } from "../kit/Tombol";
import { Lencana } from "../kit/Lencana";
import { CopySimple, PaperPlaneRight, Link } from "../kit/ikon";
import { formatRupiah } from "../../lib/format";
import type { Pembayaran } from "../../lib/admin";

/* =============================================================================
   Bukti pembayaran — tautan yang dikirim studio ke klien sesudah uang masuk.

   Fitur ini SEMPAT HILANG dari panel sejak Semua Proyek dan Terima
   Pembayaran pindah ke kit (P4): dialognya tinggal di PaymentFlow.tsx (kini
   dibuang), yang tidak lagi dipasang halaman mana pun. Halaman /bukti-nya sendiri tetap
   hidup, jadi yang hilang cuma jalan staf untuk MENDAPATKAN tautannya.

   Isinya dibawa apa adanya dari dialog lama (nominal, lunas, rincian,
   tautan, Salin, WA); kulitnya kit. Satu modul, dipakai Terima Pembayaran
   dan Semua Transaksi — bukan disalin (jebakan #32).
   ============================================================================= */

/** Query, bukan path: situs statis tidak bisa membuatkan /bukti/<token>
    saat build. Pola yang sama dengan portal klien /progres?t=… */
function tautanBukti(token: string): string {
  const asal = typeof window !== "undefined" ? window.location.origin : "";
  return `${asal}/bukti?t=${token}`;
}

const tanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

export function DialogBukti({
  bayar,
  judulProyek,
  whatsapp,
  jenis,
  metode,
  open,
  onOpenChange,
}: {
  bayar: Pembayaran | null;
  judulProyek: string;
  /** Nomor WhatsApp klien dari data proyek; boleh kosong. */
  whatsapp?: string | null;
  /** Label yang sudah terbaca ("DP", "Transfer bank") — pemanggilnya sudah
      memegang kamus labelnya sendiri. */
  jenis: string;
  metode: string;
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const toast = useToast();
  /* Dialog ini dibuka dari luar, tanpa pemicu Radix — jadi saat ditutup
     Radix tidak tahu ke mana fokus dikembalikan dan menjatuhkannya ke
     <body>. Yang membukanya dicatat, lalu difokuskan lagi. */
  const asal = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      asal.current = document.activeElement as HTMLElement | null;
      return;
    }
    const el = asal.current;
    asal.current = null;
    if (el?.isConnected) requestAnimationFrame(() => el.focus());
  }, [open]);
  if (!bayar) return null;
  const tautan = tautanBukti(bayar.receiptToken);

  async function salin() {
    try {
      await navigator.clipboard.writeText(tautan);
      toast({ judul: "Tautan disalin", keterangan: "Tempel di percakapan dengan klien.", nada: "sukses" });
    } catch {
      /* clipboard butuh konteks aman; di http:// biasa ia menolak diam-diam. */
      toast({ judul: "Tidak bisa menyalin otomatis", keterangan: tautan, nada: "netral" });
    }
  }

  function keWa() {
    const nomor = (whatsapp ?? "").replace(/\D/g, "");
    if (!nomor) {
      /* wa.me/ tanpa nomor membuka daftar kontak kosong — lebih jujur
         mengatakan apa yang kurang dan di mana mengisinya. */
      toast({
        judul: "Nomor WhatsApp klien belum diisi",
        keterangan: "Isi di Ubah Proyek, lalu coba lagi. Tautannya tetap bisa disalin.",
        nada: "gagal",
      });
      return;
    }
    const pesan = encodeURIComponent(`Berikut bukti pembayaran Anda: ${tautan}`);
    window.open(`https://wa.me/${nomor}?text=${pesan}`, "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Bukti Pembayaran"
      description={judulProyek}
      footer={
        <div className="kd-form__kaki bk__aksi">
          <Tombol ukuran="large" jenis="secondary" kiri={Link} onClick={() => window.open(tautan, "_blank", "noopener")}>
            Buka
          </Tombol>
          <Tombol ukuran="large" jenis="secondary" kiri={CopySimple} onClick={salin}>
            Salin tautan
          </Tombol>
          <Tombol ukuran="large" jenis="primary" kiri={PaperPlaneRight} onClick={keWa}>
            Kirim lewat WhatsApp
          </Tombol>
        </div>
      }
    >
      <div className="bk">
        <div className="bk__puncak">
          <p className="bk__nominal">{formatRupiah(bayar.amount)}</p>
          <Lencana bentuk="pil" nada="selesai">Lunas</Lencana>
        </div>
        <dl className="bk__rinci">
          <div><dt>ID Pembayaran</dt><dd>{bayar.receiptToken.slice(0, 8).toUpperCase()}</dd></div>
          <div><dt>Kategori</dt><dd>{jenis}</dd></div>
          <div><dt>Metode</dt><dd>{metode}</dd></div>
          {bayar.receiver && <div><dt>Penerima</dt><dd>{bayar.receiver}</dd></div>}
          <div><dt>Tanggal bayar</dt><dd>{tanggal(bayar.paidAt)}</dd></div>
        </dl>
        <p className="bk__tautan">{tautan}</p>
        <p className="bk__ket">Klien membuka tautan ini tanpa masuk; isinya persis rincian di atas.</p>
      </div>
    </Dialog>
  );
}
