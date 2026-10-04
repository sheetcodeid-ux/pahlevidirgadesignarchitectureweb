import { useState } from "react";
import { Tombol, TombolIkon } from "../Tombol";
import { Cari, Isian, Centang, Sakelar } from "../Isian";
import {
  Label,
  Bidang,
  IsianPanjang,
  KelompokIsian,
  KelompokRadio,
  Geser,
  IsianKode,
  PilihMenu,
  PilihTombol,
  Pilih,
  Kombo,
  Lampiran,
  Tuas,
  KelompokTuas,
  KelompokTombol,
  Kalender,
  PilihTanggal,
} from "../Formulir";
import { Dialog, AlertDialog, Sheet, Sembul, KartuMelayang, Petunjuk, DropdownMenu, ContextMenu } from "../Overlay";
import { ToastProvider, useToast } from "../Toast";
import { DaftarPerintah } from "../Palet";
import { Avatar, Tuts } from "../Tampilan";
import { Lencana } from "../Lencana";
import {
  ArrowsLeftRight,
  CalendarBlank,
  CaretDown,
  ChartBar,
  CoinIn,
  CopySimple,
  DotsThree,
  DownloadSimple,
  Eye,
  FilePdf,
  GridFour,
  House,
  Link,
  List,
  MagnifyingGlass,
  NotePencil,
  Plus,
  Ruler,
  SealPercent,
  ShareNetwork,
  SmileySticker,
  Trash,
  Users,
  Wallet,
} from "../ikon";

/* =============================================================================
   Demo galeri — Aksi, Formulir, Overlay.

   Isinya contoh dari pekerjaan studio (proyek, termin, klien) supaya tiap
   komponen terlihat dalam pemakaian yang mungkin, bukan "Label 1, Label 2".
   Nama proyek di sini nama proyek panel ini; angkanya karangan.
   ============================================================================= */

export const PROYEK = [
  { nilai: "kopi", label: "Kedai Kopi Ruas", ket: "Komersial · Pontianak" },
  { nilai: "tropis", label: "Rumah Tropis Sungai Raya", ket: "Hunian · Kubu Raya" },
  { nilai: "bakmi", label: "Renovasi Bakmi Hauw", ket: "Komersial · Pontianak" },
  { nilai: "notaris", label: "Kantor Notaris Ahmad", ket: "Hunian · Kubu Raya" },
  { nilai: "kapuas", label: "Guest House Kapuas", ket: "Komersial · Sintang" },
];

/* --- Aksi ------------------------------------------------------------------- */

export function DemoTombol() {
  const [simpan, setSimpan] = useState(false);
  return (
    <>
      <div className="gal-baris">
        <Tombol jenis="primary">Simpan</Tombol>
        <Tombol jenis="secondary" kiri={Plus}>Tambah termin</Tombol>
        <Tombol jenis="ghost" kanan={CaretDown}>Semua proyek</Tombol>
        <Tombol jenis="transparent">Batal</Tombol>
        <Tombol jenis="bahaya" kiri={Trash}>Hapus</Tombol>
      </div>
      <div className="gal-baris">
        <Tombol ukuran="small">Kecil</Tombol>
        <Tombol ukuran="medium">Sedang</Tombol>
        <Tombol ukuran="large">Besar</Tombol>
        <Tombol
          memuat={simpan}
          kiri={DownloadSimple}
          onClick={() => {
            setSimpan(true);
            setTimeout(() => setSimpan(false), 1600);
          }}
        >
          {simpan ? "Menyimpan…" : "Klik untuk memuat"}
        </Tombol>
        <Tombol disabled>Mati</Tombol>
      </div>
      <div className="gal-baris">
        <TombolIkon ikon={NotePencil} judul="Ubah" ukuran="small" jenis="ghost" />
        <TombolIkon ikon={ShareNetwork} judul="Bagikan" jenis="secondary" />
        <TombolIkon ikon={Plus} judul="Tambah" ukuran="large" />
      </div>
    </>
  );
}

export function DemoKelompokTombol() {
  return (
    <div className="gal-baris">
      <KelompokTombol label="Ekspor">
        <Tombol jenis="ghost" kiri={FilePdf}>PDF</Tombol>
        <Tombol jenis="ghost">Excel</Tombol>
        <Tombol jenis="ghost">CSV</Tombol>
      </KelompokTombol>
      <KelompokTombol label="Simpan">
        <Tombol>Simpan &amp; terbitkan</Tombol>
        <Tombol kanan={CaretDown} aria-label="Pilihan simpan lain" />
      </KelompokTombol>
    </div>
  );
}

export function DemoTuas() {
  const [bintang, setBintang] = useState(true);
  const [arsip, setArsip] = useState(false);
  return (
    <div className="gal-baris">
      <Tuas tekan={bintang} onUbah={setBintang} ikon={SealPercent}>
        Tampil di beranda
      </Tuas>
      <Tuas tekan={arsip} onUbah={setArsip}>
        Arsipkan
      </Tuas>
    </div>
  );
}

export function DemoKelompokTuas() {
  const [tampil, setTampil] = useState(["tabel"]);
  const [kolom, setKolom] = useState(["nominal", "tanggal"]);
  return (
    <div className="gal-tumpuk">
      <KelompokTuas
        label="Tampilan"
        nilai={tampil}
        onUbah={(v) => setTampil(v.length ? v : tampil)}
        opsi={[
          { nilai: "tabel", label: "Tabel", ikon: List },
          { nilai: "papan", label: "Papan", ikon: GridFour },
        ]}
      />
      <KelompokTuas
        label="Kolom yang tampil"
        banyak
        nilai={kolom}
        onUbah={setKolom}
        opsi={[
          { nilai: "nominal", label: "Nominal" },
          { nilai: "tanggal", label: "Tanggal" },
          { nilai: "penerima", label: "Penerima" },
          { nilai: "catatan", label: "Catatan" },
        ]}
      />
      <p className="gal-ket">Menyala: {kolom.join(", ") || "tidak ada"}</p>
    </div>
  );
}

export function DemoTuts() {
  return (
    <div className="gal-baris">
      <span className="gal-ket">
        Buka palet: <Tuts>Ctrl</Tuts> <Tuts>K</Tuts>
      </span>
      <span className="gal-ket">
        Mac: <Tuts>⌘</Tuts> <Tuts>K</Tuts>
      </span>
      <span className="gal-ket">
        Tutup: <Tuts>Esc</Tuts>
      </span>
    </div>
  );
}

/* --- Formulir --------------------------------------------------------------- */

export function DemoIsian() {
  return (
    <div className="gal-kisi2">
      <Isian label="Nama proyek" placeholder="mis. Kedai Kopi Ruas" kiri={SmileySticker} bantu="Tampil sebagai judul di halaman publik." />
      <Isian label="Email klien" type="email" placeholder="nama@contoh.com" />
      <Cari judul="Cari proyek" placeholder="Cari proyek, klien, tagihan…" ukuran="large" />
    </div>
  );
}

export function DemoKelompokIsian() {
  const [nilai, setNilai] = useState("185000000");
  return (
    <div className="gal-kisi2">
      <Bidang label="Nilai kontrak">
        {(p) => (
          <KelompokIsian
            id={p.id}
            aria-describedby={p.describedBy}
            kiri="Rp"
            inputMode="numeric"
            value={Number(nilai || 0).toLocaleString("id-ID")}
            onChange={(e) => setNilai(e.target.value.replace(/\D/g, ""))}
          />
        )}
      </Bidang>
      <Bidang label="Luas bangunan">
        {(p) => <KelompokIsian id={p.id} kanan="m²" inputMode="decimal" defaultValue="240" />}
      </Bidang>
      <Bidang label="Situs web klien">
        {(p) => <KelompokIsian id={p.id} kiri="https://" placeholder="kedairuas.id" />}
      </Bidang>
    </div>
  );
}

export function DemoTeksarea() {
  return (
    <Bidang label="Kebutuhan ruang dan fungsi" bantu="Tulis bebas; klien melihat isian ini di portalnya.">
      {(p) => <IsianPanjang id={p.id} aria-describedby={p.describedBy} defaultValue="Bar kopi 6 m, 40 kursi, dapur terbuka, mushola kecil, parkir motor 20." />}
    </Bidang>
  );
}

export function DemoLabel() {
  return (
    <div className="gal-tumpuk">
      <Label htmlFor="gal-label-1" wajib>
        Nama studio
      </Label>
      <input id="gal-label-1" className="k-kotak" defaultValue="Dirga Pahlevi Architecture" />
      <p className="gal-ket">Tanda * berarti wajib; label selalu tersambung ke isiannya lewat htmlFor.</p>
    </div>
  );
}

export function DemoBidang() {
  const [nama, setNama] = useState("R");
  return (
    <div className="gal-kisi2">
      <Bidang label="Nama termin" wajib bantu="Tampil di daftar tagihan klien." galat={nama.trim().length < 2 ? "Isi minimal 2 huruf." : undefined}>
        {(p) => <input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} className="k-kotak" value={nama} onChange={(e) => setNama(e.target.value)} />}
      </Bidang>
      <Bidang label="Catatan" bantu="Boleh kosong.">
        {(p) => <input id={p.id} aria-describedby={p.describedBy} className="k-kotak" placeholder="mis. setelah gambar kerja" />}
      </Bidang>
    </div>
  );
}

export function DemoCentang() {
  return (
    <div className="gal-tumpuk">
      {["Kirim salinan ke email klien", "Tampilkan di portal", "Tandai sebagai lunas"].map((t, i) => (
        <label key={t} className="gal-baris gal-baris--rapat">
          <Centang defaultChecked={i < 2} ukuran="medium" />
          <span className="gal-teks">{t}</span>
        </label>
      ))}
    </div>
  );
}

export function DemoRadio() {
  const [cara, setCara] = useState("transfer");
  return (
    <KelompokRadio
      nama="gal-cara"
      label="Cara bayar"
      nilai={cara}
      onUbah={setCara}
      opsi={[
        { nilai: "transfer", label: "Transfer bank", ket: "BCA a.n. Dirga Pahlevi" },
        { nilai: "tunai", label: "Tunai", ket: "Diterima langsung di studio" },
        { nilai: "qris", label: "QRIS", ket: "Belum tersedia", mati: true },
      ]}
    />
  );
}

export function DemoSakelar() {
  return (
    <div className="gal-tumpuk">
      {[
        ["Tampilkan di beranda", true],
        ["Kirim notifikasi ke klien", false],
      ].map(([t, a]) => (
        <label key={t as string} className="gal-baris gal-baris--rapat">
          <Sakelar judul={t as string} defaultChecked={a as boolean} />
          <span className="gal-teks">{t as string}</span>
        </label>
      ))}
    </div>
  );
}

export function DemoGeser() {
  const [dp, setDp] = useState(30);
  const [fee, setFee] = useState(8);
  return (
    <div className="gal-kisi2">
      <Geser label="Uang muka" nilai={dp} onUbah={setDp} langkah={5} format={(n) => `${n}%`} />
      <Geser label="Fee desain" min={4} maks={15} langkah={0.5} nilai={fee} onUbah={setFee} format={(n) => `${n.toLocaleString("id-ID")}% dari RAB`} />
    </div>
  );
}

export function DemoPilih() {
  const [v, setV] = useState("kopi");
  return (
    <div className="gal-kisi2">
      <Bidang label="Proyek">{(p) => <Pilih id={p.id} opsi={PROYEK} nilai={v} onUbah={setV} />}</Bidang>
      <Bidang label="Status">
        {(p) => (
          <Pilih
            id={p.id}
            placeholder="Pilih status"
            opsi={[
              { nilai: "draf", label: "Draf", ket: "Belum dikirim ke klien" },
              { nilai: "terbit", label: "Terbit", ket: "Sudah ditagihkan" },
              { nilai: "lunas", label: "Lunas", ket: "Pembayaran diterima" },
            ]}
          />
        )}
      </Bidang>
    </div>
  );
}

export function DemoPilihAsli() {
  const [kat, setKat] = useState("klien");
  const [urut, setUrut] = useState("baru");
  return (
    <div className="gal-kisi2">
      <Bidang label="Kategori kontak">
        {(p) => (
          <PilihMenu
            id={p.id}
            nilai={kat}
            onUbah={setKat}
            opsi={[
              { nilai: "klien", label: "Klien" },
              { nilai: "kontraktor", label: "Kontraktor" },
              { nilai: "supplier", label: "Supplier" },
              { nilai: "konsultan", label: "Konsultan" },
            ]}
          />
        )}
      </Bidang>
      <div>
        <PilihTombol
          judul="Urutkan"
          nilai={urut}
          onPilih={setUrut}
          opsi={[
            { nilai: "baru", label: "Terbaru" },
            { nilai: "lama", label: "Terlama" },
            { nilai: "nama", label: "Nama A–Z" },
          ]}
        />
      </div>
    </div>
  );
}

export function DemoKombo() {
  const [v, setV] = useState<string>();
  return (
    <Bidang label="Proyek" bantu="Ketik sebagian nama: “tropis”, “sintang”, “komersial”.">
      {(p) => <Kombo id={p.id} opsi={PROYEK} nilai={v} onUbah={setV} placeholder="Pilih proyek…" cariPlaceholder="Cari proyek…" />}
    </Bidang>
  );
}

export function DemoKode() {
  const [kode, setKode] = useState("");
  return (
    <div className="gal-tumpuk">
      <IsianKode onSelesai={setKode} label="Kode masuk" />
      <p className="gal-ket">{kode ? `Kode lengkap: ${kode}` : "Coba tempel 482915 sekaligus."}</p>
    </div>
  );
}

export function DemoKalender() {
  const [d, setD] = useState<Date | null>(new Date());
  return (
    <div className="gal-baris gal-baris--atas">
      <div className="gal-kartu">
        <Kalender nilai={d} onUbah={setD} />
      </div>
      <div className="gal-kartu">
        <Kalender nilai={null} min={new Date()} label="Tanggal setelah hari ini" />
        <p className="gal-ket">Hari sebelum hari ini dicoret, bukan sekadar redup.</p>
      </div>
    </div>
  );
}

export function DemoPilihTanggal() {
  const [t, setT] = useState("2026-11-15");
  return (
    <div className="gal-kisi2">
      <Bidang label="Tenggat termin">{(p) => <PilihTanggal id={p.id} nilai={t} onUbah={setT} />}</Bidang>
      <Bidang label="Tanggal selesai (boleh kosong)">{(p) => <PilihTanggal id={p.id} nilai="" onUbah={() => {}} />}</Bidang>
    </div>
  );
}

export function DemoLampiran() {
  const [f, setF] = useState<File[]>([]);
  return <Lampiran banyak berkas={f} onUbah={setF} terima="image/*,application/pdf" ket="PNG, JPG, atau PDF · maksimal 10 MB" />;
}

/* --- Overlay ---------------------------------------------------------------- */

export function DemoDialog() {
  const [buka, setBuka] = useState(false);
  return (
    <Dialog
      open={buka}
      onOpenChange={setBuka}
      trigger={<Tombol kiri={Plus}>Buka dialog — Tambah kontak</Tombol>}
      title="Tambah kontak"
      description="Klien, kontraktor, atau supplier yang dipakai berulang."
      footer={
        <>
          <Tombol jenis="transparent" onClick={() => setBuka(false)}>
            Batal
          </Tombol>
          <Tombol onClick={() => setBuka(false)}>Simpan</Tombol>
        </>
      }
    >
      <Isian label="Nama" placeholder="mis. Bu Ratna" autoFocus />
      <Bidang label="Kategori">
        {(p) => <PilihMenu id={p.id} nilai={undefined} onUbah={() => {}} opsi={[{ nilai: "klien", label: "Klien" }, { nilai: "kontraktor", label: "Kontraktor" }]} />}
      </Bidang>
    </Dialog>
  );
}

export function DemoLaci() {
  return (
    <div className="gal-baris">
      {(["right", "bottom", "left"] as const).map((s) => (
        <Sheet
          key={s}
          side={s}
          trigger={<Tombol jenis="ghost">Laci {s === "right" ? "kanan" : s === "left" ? "kiri" : "bawah"}</Tombol>}
          title="Rincian termin"
          description="Termin 2 — gambar kerja · Kedai Kopi Ruas"
          footer={<Tombol>Tandai lunas</Tombol>}
        >
          <dl className="gal-dl">
            <dt>Nominal</dt>
            <dd>Rp61.666.667</dd>
            <dt>Tenggat</dt>
            <dd>10 Okt 2026</dd>
            <dt>Status</dt>
            <dd>
              <Lencana bentuk="pil" nada="menunggu">Terbit</Lencana>
            </dd>
          </dl>
        </Sheet>
      ))}
    </div>
  );
}

export function DemoKonfirmasi() {
  const [hasil, setHasil] = useState("");
  return (
    <div className="gal-baris">
      <AlertDialog
        destructive
        trigger={<Tombol jenis="bahaya" kiri={Trash}>Hapus kontak</Tombol>}
        title="Hapus Andi Saputra?"
        description="Kontak ini beserta catatannya dihapus dari direktori. Tidak bisa dibatalkan."
        confirmLabel="Ya, hapus"
        onConfirm={() => setHasil("Dihapus (contoh).")}
      />
      <AlertDialog
        trigger={<Tombol jenis="ghost">Terbitkan situs</Tombol>}
        title="Terbitkan sekarang?"
        description="Situs dibangun ulang dan tayang dalam ±1 menit."
        confirmLabel="Terbitkan"
        onConfirm={() => setHasil("Diterbitkan (contoh).")}
      />
      {hasil && <span className="gal-ket">{hasil}</span>}
    </div>
  );
}

export function DemoSembul() {
  return (
    <Sembul pemicu={<Tombol jenis="ghost" kanan={CaretDown}>Bagikan portal</Tombol>} judul="Tautan portal klien">
      <div className="gal-tumpuk" style={{ width: 280 }}>
        <KelompokIsian readOnly value="pahlevidirgaarchitecture.com/progres?t=017f…" aria-label="Tautan portal" />
        <Tombol jenis="secondary" kiri={CopySimple}>Salin tautan</Tombol>
      </div>
    </Sembul>
  );
}

export function DemoMelayang() {
  return (
    <p className="gal-teks">
      Arahkan kursor ke{" "}
      <KartuMelayang
        pemicu={
          <a href="#data/item" className="gal-tautan">
            Kedai Kopi Ruas
          </a>
        }
      >
        <div className="gal-baris gal-baris--rapat">
          <Avatar nama="Kedai Kopi Ruas" />
          <div className="gal-tumpuk gal-tumpuk--rapat">
            <b className="gal-teks">Kedai Kopi Ruas</b>
            <span className="gal-ket">Komersial · Pontianak · Konsep</span>
          </div>
        </div>
        <p className="gal-ket" style={{ marginTop: 10 }}>
          Kontrak Rp185 jt · diterima Rp120 jt (65%)
        </p>
      </KartuMelayang>{" "}
      untuk pratinjau proyeknya.
    </p>
  );
}

export function DemoPetunjuk() {
  return (
    <div className="gal-tumpuk">
      <div className="gal-baris">
        {/* Tombol ikon kit membawa Petunjuk-nya sendiri: namanya (`judul`)
            tampil saat disentuh kursor ATAU difokus papan ketik. */}
        <TombolIkon ikon={NotePencil} judul="Ubah" jenis="ghost" />
        <TombolIkon ikon={CopySimple} judul="Salin tautan" jenis="ghost" />
        <TombolIkon ikon={Eye} judul="Lihat di situs" jenis="ghost" />
        <TombolIkon ikon={Trash} judul="Hapus" jenis="ghost" />
      </div>
      <p className="gal-teks">
        Atau pada apa pun:{" "}
        <Petunjuk isi="Dihitung dari kas yang benar-benar masuk, bukan nilai kontrak.">
          <span className="gal-tautan" tabIndex={0}>
            laba bersih
          </span>
        </Petunjuk>
        .
      </p>
    </div>
  );
}

export function DemoMenuTarik() {
  const [pilih, setPilih] = useState("");
  return (
    <div className="gal-baris">
      <DropdownMenu
        align="start"
        trigger={<Tombol jenis="ghost" kanan={CaretDown}>Unduh PDF</Tombol>}
        sections={[
          {
            label: "Dokumen",
            items: [
              { label: "Daftar tagihan — untuk klien", ikon: FilePdf, onSelect: () => setPilih("Daftar tagihan") },
              { label: "Rincian biaya — internal", ikon: FilePdf, onSelect: () => setPilih("Rincian biaya") },
            ],
          },
          { items: [{ label: "Hapus proyek", ikon: Trash, danger: true, onSelect: () => setPilih("Hapus") }] },
        ]}
      />
      <DropdownMenu
        trigger={<TombolIkon ikon={DotsThree} judul="Pilihan lain" jenis="ghost" />}
        sections={[
          {
            items: [
              { label: "Ubah", ikon: NotePencil, shortcut: "E" },
              { label: "Salin tautan", ikon: Link },
              { label: "Arsipkan", disabled: true },
            ],
          },
        ]}
      />
      {pilih && <span className="gal-ket">Dipilih: {pilih}</span>}
    </div>
  );
}

export function DemoMenuKonteks() {
  const [pilih, setPilih] = useState("");
  return (
    <ContextMenu
      sections={[
        {
          items: [
            { label: "Buka proyek", ikon: Eye, onSelect: () => setPilih("Buka") },
            { label: "Terima pembayaran", ikon: CoinIn, onSelect: () => setPilih("Terima") },
            { label: "Salin tautan portal", ikon: CopySimple, onSelect: () => setPilih("Salin") },
          ],
        },
        { items: [{ label: "Hapus", ikon: Trash, danger: true, onSelect: () => setPilih("Hapus") }] },
      ]}
    >
      <div className="gal-zona">
        <b>Klik kanan di sini</b>
        <span className="gal-ket">(atau tekan lama di layar sentuh){pilih && ` — dipilih: ${pilih}`}</span>
      </div>
    </ContextMenu>
  );
}

export function DemoPerintah() {
  const [pilih, setPilih] = useState("");
  const ke = (s: string) => () => setPilih(s);
  return (
    <div className="gal-tumpuk">
      <DaftarPerintah
        kelompok={[
          {
            judul: "Halaman",
            butir: [
              { label: "Dashboard", ikon: House, onPilih: ke("Dashboard") },
              { label: "Terima Pembayaran", ikon: CoinIn, kata: "bayar uang masuk", onPilih: ke("Terima Pembayaran") },
              { label: "Semua Transaksi", ikon: ArrowsLeftRight, onPilih: ke("Semua Transaksi") },
              { label: "Ringkasan Keuangan", ikon: ChartBar, onPilih: ke("Ringkasan") },
              { label: "Gaji", ikon: Wallet, onPilih: ke("Gaji") },
              { label: "Tim & Freelancer", ikon: Users, onPilih: ke("Tim") },
            ],
          },
          {
            judul: "Proyek",
            butir: PROYEK.map((p) => ({ label: p.label, ikon: Ruler, ket: p.ket, onPilih: ke(p.label) })),
          },
          {
            judul: "Aksi",
            butir: [
              { label: "Proyek baru", ikon: Plus, tuts: "N", onPilih: ke("Proyek baru") },
              { label: "Cari di panel", ikon: MagnifyingGlass, tuts: "Ctrl K", onPilih: ke("Cari") },
              { label: "Pilih tanggal laporan", ikon: CalendarBlank, onPilih: ke("Tanggal") },
            ],
          },
        ]}
      />
      {pilih && <p className="gal-ket">Dipilih: {pilih}</p>}
    </div>
  );
}

function TombolToast() {
  const toast = useToast();
  return (
    <div className="gal-baris">
      <Tombol jenis="secondary" onClick={() => toast({ judul: "Termin ditambahkan", keterangan: "Termin 4 — Rp25.000.000 disimpan sebagai Draf.", nada: "sukses" })}>
        Toast berhasil
      </Tombol>
      <Tombol jenis="ghost" onClick={() => toast({ judul: "Gagal menyimpan", keterangan: "Koneksi terputus. Isian Anda masih ada — coba simpan lagi.", nada: "gagal" })}>
        Toast gagal
      </Tombol>
      <Tombol jenis="transparent" onClick={() => toast({ judul: "Situs sedang dibangun", keterangan: "Tayang dalam ±1 menit.", nada: "netral" })}>
        Toast keterangan
      </Tombol>
    </div>
  );
}

export function DemoToast() {
  return (
    <ToastProvider>
      <TombolToast />
    </ToastProvider>
  );
}
