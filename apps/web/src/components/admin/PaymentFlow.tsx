/**
 * Alur terima pembayaran: dari kolom di tabel proyek sampai bukti yang
 * dikirim ke klien lewat WhatsApp.
 *
 * Tinggal di berkas sendiri, bukan di ProjectList, karena alurnya punya dua
 * overlay berurutan dan keadaan sendiri — menumpuknya ke ProjectList membuat
 * berkas itu sulit dibaca tanpa memberi keuntungan apa pun.
 */

import { useState } from "react";
import { Icon, type IconName } from "../ui/Icon";
import { Dialog } from "../ui/overlay/Dialog";
import { useToast } from "../ui/overlay/Toast";
import { catatPembayaran, type Pembayaran, type Proyek } from "../../lib/admin";

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

const tanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

/** Empat metode, masing-masing berikon. Ikonnya SVG inline dari Icon.tsx —
 *  tiga di antaranya (cash/bank/qr) dibuat khusus untuk alur ini karena
 *  tidak ada padanannya di UI Component. */
const METODE: { value: string; label: string; ikon: IconName }[] = [
  { value: "tunai", label: "Tunai", ikon: "cash" },
  { value: "transfer", label: "Transfer", ikon: "bank" },
  { value: "qris", label: "QRIS", ikon: "qr" },
  { value: "lainnya", label: "Lainnya", ikon: "dots" },
];

const LABEL_METODE: Record<string, string> = Object.fromEntries(METODE.map((m) => [m.value, m.label]));
const LABEL_JENIS: Record<string, string> = { dp: "DP", termin: "Termin", pelunasan: "Pelunasan" };

/**
 * Kategori pembayaran DITEBAK dari angkanya, bukan diminta lebih dulu.
 *
 * Kalau sisa tagihan lunas oleh pembayaran ini, itu pelunasan. Kalau ini
 * pembayaran pertama, itu DP. Sisanya termin. Staf tetap bisa mengubahnya —
 * tebakan ini cuma menghemat satu keputusan pada kasus yang paling sering.
 */
function tebakJenis(nilai: number, kontrak: number, sudahDibayar: number): string {
  if (kontrak > 0 && sudahDibayar + nilai >= kontrak) return "pelunasan";
  return sudahDibayar === 0 ? "dp" : "termin";
}

/** Tautan bukti yang dibuka klien. Query, bukan path: situs ini statis, dan
 *  /bukti/<token> tidak bisa dibuatkan halamannya saat build sehingga akan
 *  kena 404. Pola yang sama dengan portal klien /progres?t=… */
export function tautanBukti(token: string): string {
  const asal = typeof window !== "undefined" ? window.location.origin : "";
  return `${asal}/bukti?t=${token}`;
}

/* ==========================================================================
   Bukti pembayaran — muncul setelah konfirmasi, dan bisa dibuka lagi kapan pun
   ========================================================================== */

export function DialogBukti({
  bayar, proyek, open, onOpenChange,
}: {
  bayar: Pembayaran;
  proyek: Proyek;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const toast = useToast();
  const tautan = tautanBukti(bayar.receiptToken);

  async function salin() {
    try {
      await navigator.clipboard.writeText(tautan);
      toast({ judul: "Tautan disalin", keterangan: "Tempel di mana saja.", nada: "sukses" });
    } catch {
      // clipboard butuh konteks aman; di http:// biasa ia menolak diam-diam.
      toast({ judul: "Tidak bisa menyalin otomatis", keterangan: tautan, nada: "netral" });
    }
  }

  function keWa() {
    const nomor = (proyek.clientWhatsapp ?? "").replace(/\D/g, "");
    const pesan = encodeURIComponent(`Berikut bukti pembayaran Anda: ${tautan}`);
    if (!nomor) {
      // Tanpa nomor, wa.me/ tanpa angka membuka daftar kontak kosong — lebih
      // jujur mengatakan apa yang kurang dan di mana mengisinya.
      toast({
        judul: "Nomor WhatsApp klien belum diisi",
        keterangan: "Isi di tab Identitas proyek ini, lalu coba lagi.",
        nada: "gagal",
      });
      return;
    }
    window.open(`https://wa.me/${nomor}?text=${pesan}`, "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Bukti Pembayaran"
      description={proyek.title}
      footer={
        <div className="bukti__aksi">
          <button type="button" className="btn btn--secondary" onClick={() => onOpenChange(false)}>
            Tutup
          </button>
          <button type="button" className="btn btn--secondary" onClick={salin}>
            <Icon name="copy" size={16} /> Salin
          </button>
          <button type="button" className="btn btn--wa" onClick={keWa}>
            <Icon name="whatsapp" size={16} /> WA
          </button>
        </div>
      }
    >
      <div className="bukti">
        <div className="bukti__puncak">
          {/* Nama proyek TIDAK diulang di sini — sudah jadi keterangan dialog
              tepat di atasnya, dan mengulangnya membuat nominalnya terdorong
              turun tanpa menambah satu pun informasi. */}
          <p className="bukti__nominal">{rupiah(bayar.amount)}</p>
          <span className="badge badge--success"><span className="badge__dot" />Lunas</span>
          <p className="bukti__waktu">{tanggal(bayar.paidAt)}</p>
        </div>

        <dl className="bukti__rinci">
          <div><dt>ID Pembayaran</dt><dd className="t-mono">{bayar.receiptToken.slice(0, 8).toUpperCase()}</dd></div>
          <div><dt>Proyek</dt><dd>{proyek.title}</dd></div>
          <div><dt>Kategori</dt><dd>{LABEL_JENIS[bayar.kind] ?? bayar.kind}</dd></div>
          <div><dt>Metode</dt><dd>{LABEL_METODE[bayar.method] ?? bayar.method}</dd></div>
          {bayar.receiver && <div><dt>Penerima</dt><dd>{bayar.receiver}</dd></div>}
          <div><dt>Tgl Bayar</dt><dd>{tanggal(bayar.paidAt)}</dd></div>
        </dl>

        <p className="bukti__tautan t-mono">{tautan}</p>
      </div>
    </Dialog>
  );
}

/* ==========================================================================
   Terima pembayaran
   ========================================================================== */

function FormTerima({
  proyek, onSelesai, onBatal,
}: {
  proyek: Proyek;
  onSelesai: (bayar: Pembayaran) => void;
  onBatal: () => void;
}) {
  const toast = useToast();
  const kontrak = proyek.contractValue ?? 0;
  const sudah = proyek.paidTotal ?? 0;
  const sisa = Math.max(0, kontrak - sudah);

  // Bayar Pertama = DP 50% dari nilai kontrak. Kalau nilai kontraknya belum
  // diisi, tidak ada angka yang bisa ditebak — biarkan staf mengetiknya.
  const usulan = sudah === 0 ? Math.round(kontrak / 2) : sisa;

  const [nilai, setNilai] = useState<number>(usulan);
  const [jenis, setJenis] = useState<string>(tebakJenis(usulan, kontrak, sudah));
  const [metode, setMetode] = useState("tunai");
  const [penerima, setPenerima] = useState("");
  const [sibuk, setSibuk] = useState(false);

  function ubahNilai(teks: string) {
    const angka = Number(teks.replace(/\D/g, ""));
    setNilai(angka);
    setJenis(tebakJenis(angka, kontrak, sudah));
  }

  async function konfirmasi() {
    if (nilai <= 0) {
      toast({ judul: "Jumlah belum diisi", keterangan: "Isi nominal yang diterima.", nada: "gagal" });
      return;
    }
    setSibuk(true);
    try {
      const bayar = await catatPembayaran(proyek.id, {
        amount: nilai, kind: jenis, method: metode, receiver: penerima.trim() || null,
      });
      onSelesai(bayar);
    } catch (e) {
      toast({ judul: "Gagal mencatat pembayaran", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      <div className="terima">
        <div className="terima__nominal">
          <label className="field__label" htmlFor="tp-nilai">Jumlah Pembayaran</label>
          <div className="terima__isian">
            <span className="terima__rp">Rp</span>
            <input
              id="tp-nilai"
              className="input terima__input"
              inputMode="numeric"
              value={nilai ? nilai.toLocaleString("id-ID") : ""}
              onChange={(e) => ubahNilai(e.target.value)}
            />
          </div>
          {kontrak > 0 && (
            <p className="field__help">
              Nilai kontrak {rupiah(kontrak)} · sudah diterima {rupiah(sudah)} · sisa {rupiah(sisa)}
            </p>
          )}
        </div>

        <fieldset className="terima__grup">
          <legend className="field__label">Kategori</legend>
          <div className="terima__pilihan terima__pilihan--dua">
            {(["dp", "termin", "pelunasan"] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={`terima__opsi${jenis === k ? " terima__opsi--aktif" : ""}`}
                aria-pressed={jenis === k}
                onClick={() => setJenis(k)}
              >
                {LABEL_JENIS[k]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="terima__grup">
          <legend className="field__label">Metode Pembayaran</legend>
          <div className="terima__pilihan">
            {METODE.map((m) => (
              <button
                key={m.value}
                type="button"
                className={`terima__opsi${metode === m.value ? " terima__opsi--aktif" : ""}`}
                aria-pressed={metode === m.value}
                onClick={() => setMetode(m.value)}
              >
                <Icon name={m.ikon} size={16} />
                {m.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label className="field__label" htmlFor="tp-penerima">Penerima</label>
          <input
            id="tp-penerima"
            className="input"
            placeholder="Nama yang menerima uangnya"
            value={penerima}
            onChange={(e) => setPenerima(e.target.value)}
          />
        </div>
      </div>

      <div className="ov-dialog__foot">
        <button type="button" className="btn btn--secondary" onClick={onBatal} disabled={sibuk}>
          Batal
        </button>
        <button type="button" className="btn btn--primary" onClick={konfirmasi} disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Konfirmasi Pembayaran"}
        </button>
      </div>
    </>
  );
}

/* ==========================================================================
   Kolom Pembayaran di tabel proyek
   ========================================================================== */

export function KolomPembayaran({
  proyek, onTercatat,
}: {
  proyek: Proyek;
  /** Dipanggil setelah uang tercatat, supaya barisnya diperbarui di tempat. */
  onTercatat: (nilai: number) => void;
}) {
  const [bukaTerima, setBukaTerima] = useState(false);
  // Pembayaran terakhir DISIMPAN terpisah dari "apakah dialognya terbuka".
  // Kalau keduanya satu keadaan, menutup bukti ikut menghapus datanya dan
  // ikon struk untuk membukanya lagi hilang bersamaan.
  const [terakhir, setTerakhir] = useState<Pembayaran | null>(null);
  const [bukaBukti, setBukaBukti] = useState(false);

  const kontrak = proyek.contractValue ?? 0;
  const sudah = proyek.paidTotal ?? 0;
  const lunas = kontrak > 0 && sudah >= kontrak;

  return (
    <span className="bayar-sel">
      {lunas ? (
        <span className="bayar-status bayar-status--lunas">
          <Icon name="check" size={15} /> Lunas
        </span>
      ) : sudah > 0 ? (
        <span className="bayar-status bayar-status--sebagian">
          <Icon name="clock" size={15} /> {rupiah(sudah)}
        </span>
      ) : (
        <span className="bayar-status bayar-status--belum">
          <Icon name="clock" size={15} /> Belum Bayar
        </span>
      )}

      {terakhir && (
        <button
          type="button"
          className="btn btn--secondary btn--icon btn--boxed"
          aria-label="Lihat bukti pembayaran terakhir"
          onClick={() => setBukaBukti(true)}
        >
          <Icon name="receipt" size={15} />
        </button>
      )}

      {!lunas && (
        <button type="button" className="btn btn--upgrade btn--sm" onClick={() => setBukaTerima(true)}>
          {sudah === 0 ? "Bayar Pertama" : "Terima Bayar"}
        </button>
      )}

      <Dialog
        open={bukaTerima}
        onOpenChange={setBukaTerima}
        title={sudah === 0 ? "Konfirmasi Pembayaran Pertama" : "Terima Pembayaran"}
        description={proyek.title}
      >
        {/* Form dipasang ulang tiap kali dialog dibuka (key), supaya nominal
            usulannya ikut angka terbaru — tanpa itu ia tetap memakai nilai
            saat komponen pertama kali dirender. */}
        {bukaTerima && (
          <FormTerima
            key={`${proyek.id}-${sudah}`}
            proyek={proyek}
            onBatal={() => setBukaTerima(false)}
            onSelesai={(b) => {
              setBukaTerima(false);
              setTerakhir(b);
              setBukaBukti(true);
              onTercatat(b.amount);
            }}
          />
        )}
      </Dialog>

      {terakhir && (
        <DialogBukti
          bayar={terakhir}
          proyek={proyek}
          open={bukaBukti}
          onOpenChange={setBukaBukti}
        />
      )}
    </span>
  );
}
