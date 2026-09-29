import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { KepalaSeksi, BarisTransfer, TombolBulat } from "../kit/Item";
import { Segmen, KelompokTab } from "../kit/Segmen";
import { Cari } from "../kit/Isian";
import { Tombol, TombolIkon } from "../kit/Tombol";
import { Ikon } from "../kit/Ikon";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import {
  CoinVertical,
  NavCreditCard,
  VirtualAccount,
  DotsThree,
  Sliders,
  NavReceipt,
  Hourglass,
  Plus,
  CheckCircle,
} from "../kit/ikon";
import {
  daftarProyek,
  daftarPembayaran,
  catatPembayaran,
  bacaCache,
  tulisCache,
  type Proyek,
  type Pembayaran,
} from "../../lib/admin";
import { proyekAktif, setProyekAktif, onProyekAktif } from "../../lib/proyekAktif";
import { formatRupiah } from "../../lib/format";

/* =============================================================================
   Terima Pembayaran — frame Figma "07. Transfer".

   TATA LETAKNYA milik frame; ISINYA milik studio ini. Pemetaannya kebetulan
   jatuh rapi, dan itu bukan kebetulan yang dipaksakan — kolom enum di
   database memang sejumlah slot di framenya:

     Coinest                        Halaman ini
     ----------------------------   ------------------------------------------
     4 tab mode kiri                `payment_method`: tunai / transfer / qris /
     (Transfer/Payment/VA/Top Up)   lainnya — PERSIS empat
     Cari + saring                  cari proyek
     Daftar penerima (302x67)       daftar proyek, sisa tagihan di bawah nama
     "Add New Recipient"            "Proyek Baru"
     Recent Transfer (3 kartu)      pembayaran terbaru proyek terpilih
     Segmented Local/International  `payment_kind`: dp / termin / pelunasan
     Payment Account (2 kartu)      nilai kontrak / sudah diterima
     Select Recipient               proyek
     Amount + Transfer Method       nominal + diterima oleh (`receiver`)
     Note                           catatan (`note`)
     Cancel / Send Money            Batal / Catat Pembayaran

   Tiga selisih yang DISENGAJA, semuanya karena datanya memang lain:

   1. Segmented di framenya DUA tombol; `payment_kind` punya tiga nilai, jadi
      di sini tiga. Lebarnya tetap 757, dibagi rata.
   2. Kartu "Payment Account" di framenya bisa DIPILIH (satu berlatar mint =
      rekening yang dipakai). Di sini keduanya cuma angka: nilai kontrak dan
      yang sudah diterima. Tidak ada yang bisa dipilih, karena uangnya masuk
      ke studio, bukan ke salah satu dari dua rekening.
   3. Gambar kartu kredit yang terpotong di tepi kiri tiap kartu diganti ubin
      56 berikon. Kita tidak punya gambar kartu, dan menggambarnya sendiri
      berarti mengarang benda yang tidak ada.

   Yang TIDAK ada di form ini, dan sengaja: tanggal. `paid_at` diisi database
   (`default now()`), dan memberi staf kotak tanggal berarti menjanjikan
   sesuatu yang endpoint-nya tidak terima — lihat `repository/payments.ts`.
   ============================================================================= */

const METODE = [
  { nilai: "tunai", label: "Tunai", ikon: CoinVertical },
  { nilai: "transfer", label: "Transfer", ikon: NavCreditCard },
  { nilai: "qris", label: "QRIS", ikon: VirtualAccount },
  { nilai: "lainnya", label: "Lainnya", ikon: DotsThree },
];

const JENIS = [
  { nilai: "dp", label: "DP" },
  { nilai: "termin", label: "Termin" },
  { nilai: "pelunasan", label: "Pelunasan" },
];

const LABEL_METODE: Record<string, string> = Object.fromEntries(
  METODE.map((m) => [m.nilai, m.label]),
);
const LABEL_JENIS: Record<string, string> = Object.fromEntries(
  JENIS.map((j) => [j.nilai, j.label]),
);

/** "Kedai Kopi Ruas" -> "KR". Dipakai sebagai ganti foto di avatar 40. */
function inisial(judul: string): string {
  const kata = judul.trim().split(/\s+/).filter(Boolean);
  if (kata.length === 0) return "?";
  if (kata.length === 1) return kata[0].slice(0, 2).toUpperCase();
  return (kata[0][0] + kata[kata.length - 1][0]).toUpperCase();
}

/** "2026-09-29T..." -> "29 Sep". */
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function tanggalPendek(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${BULAN[d.getMonth()]}`;
}

/**
 * Jenis DITEBAK dari angkanya, sama seperti di dialog lama
 * (`PaymentFlow.tebakJenis`) — dan memang disalin dari sana dengan sengaja:
 * dua tempat yang menebak dengan aturan berbeda akan memberi jawaban berbeda
 * untuk pembayaran yang sama.
 *
 * Kalau sisa tagihan lunas oleh pembayaran ini, itu pelunasan. Kalau ini
 * yang pertama, itu DP. Sisanya termin. Staf tetap bisa mengubahnya.
 */
function tebakJenis(nilai: number, kontrak: number, sudah: number): string {
  if (kontrak > 0 && sudah + nilai >= kontrak) return "pelunasan";
  return sudah === 0 ? "dp" : "termin";
}

/** "12.500.000" / "Rp12.500.000" / "12500000" -> 12500000. */
function keAngka(teks: string): number {
  const bersih = teks.replace(/[^\d]/g, "");
  return bersih ? Number(bersih) : 0;
}

function Isi() {
  const toast = useToast();

  const [proyek, setProyek] = useState<Proyek[] | null>(() => bacaCache<Proyek[]>("proyek"));
  const [pilih, setPilih] = useState<string | null>(() => proyekAktif());
  const [cari, setCari] = useState("");
  const [metode, setMetode] = useState("transfer");
  const [jenis, setJenis] = useState<string | null>(null);
  const [nominal, setNominal] = useState("");
  const [penerima, setPenerima] = useState("");
  const [catatan, setCatatan] = useState("");
  const [kirim, setKirim] = useState(false);
  const [bayar, setBayar] = useState<Pembayaran[] | null>(null);

  useEffect(() => onProyekAktif(setPilih), []);

  useEffect(() => {
    daftarProyek()
      .then((d) => {
        tulisCache("proyek", d);
        setProyek(d);
      })
      .catch(() => setProyek((l) => l ?? []));
  }, []);

  /* Proyek terpilih: yang dipilih staf, kalau tidak ada yang pertama di
     daftar. Dipilih di sini dan bukan di useState supaya ia ikut berubah
     begitu daftarnya datang — nilai awal useState dibaca sekali saja. */
  const aktif = useMemo(() => {
    const d = proyek ?? [];
    return d.find((p) => p.id === pilih) ?? d[0] ?? null;
  }, [proyek, pilih]);


  useEffect(() => {
    if (!aktif) return;
    let batal = false;
    setBayar(bacaCache<Pembayaran[]>(`bayar:${aktif.id}`));
    daftarPembayaran(aktif.id)
      .then((d) => {
        if (batal) return;
        tulisCache(`bayar:${aktif.id}`, d);
        setBayar(d);
      })
      .catch(() => {});
    return () => {
      batal = true;
    };
  }, [aktif?.id]);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const d = proyek ?? [];
    if (!q) return d;
    return d.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.client ?? "").toLowerCase().includes(q) ||
        (p.city ?? "").toLowerCase().includes(q),
    );
  }, [proyek, cari]);

  const kontrak = aktif?.contractValue ?? 0;
  const sudah = aktif?.paidTotal ?? 0;
  const sisa = Math.max(0, kontrak - sudah);
  const angka = keAngka(nominal);

  /* Jenis yang BERLAKU: yang dipilih staf kalau ia sudah menyentuhnya,
     kalau belum hasil tebakan. Disimpan sebagai null-dan-tebakan, bukan
     ditulis ke state tiap kali nominalnya berubah — menulis ke state dari
     dalam render adalah cara tercepat membuat tebakan menimpa pilihan staf
     satu ketukan setelah ia memilih. */
  const jenisBerlaku = jenis ?? tebakJenis(angka, kontrak, sudah);

  const bisaKirim = Boolean(aktif) && angka > 0 && !kirim;

  async function simpan() {
    if (!aktif || angka <= 0) return;
    setKirim(true);
    try {
      await catatPembayaran(aktif.id, {
        amount: angka,
        kind: jenisBerlaku,
        method: metode,
        receiver: penerima.trim() || null,
        note: catatan.trim() || null,
      });
      toast({
        judul: "Pembayaran tercatat",
        keterangan: `${formatRupiah(angka)} — ${LABEL_JENIS[jenisBerlaku]} lewat ${LABEL_METODE[metode]}.`,
        nada: "sukses",
      });
      setNominal("");
      setCatatan("");
      setJenis(null);
      /* Daftar proyek ikut disegarkan: `paidTotal` yang tampil di kartu
         kiri DAN di kartu ringkasan kontrak baru saja berubah, dan
         membiarkannya basi berarti angka di layar tidak sama dengan yang
         di database — persis keluhan yang membuat tombol Terbitkan ada. */
      const [b, d] = await Promise.all([daftarPembayaran(aktif.id), daftarProyek()]);
      tulisCache(`bayar:${aktif.id}`, b);
      tulisCache("proyek", d);
      setBayar(b);
      setProyek(d);
    } catch (e) {
      toast({
        judul: "Gagal mencatat",
        keterangan: e instanceof Error ? e.message : "Coba lagi.",
        nada: "gagal",
      });
    } finally {
      setKirim(false);
    }
  }

  function pilihProyek(p: Proyek) {
    setProyekAktif(p.id);
    setPilih(p.id);
    setJenis(null);
  }

  return (
    <div className="tr">
      {/* ---- Kolom kiri --------------------------------------------------- */}
      <section className="tr__kiri">
        <KelompokTab
          className="tr__metode"
          judul="Metode pembayaran"
          tab={METODE}
          nilai={metode}
          onPilih={setMetode}
        />

        <div className="tr__cari">
          <Cari
            ukuran="large"
            judul="Cari proyek"
            placeholder="Cari proyek"
            value={cari}
            onChange={(e) => setCari(e.currentTarget.value)}
          />
          {/* Ikon Sliders, sama seperti di framenya. Tanpa aksi: penyaringan
              yang sebenarnya ada di /admin/proyek, dan tombol yang membuka
              panel saringan kedua di sini cuma menambah tempat untuk
              menyaring hal yang sama dengan aturan yang bisa menyimpang. */}
          <TombolBulat ikon={Sliders} judul="Saring di Semua Proyek" />
        </div>

        <div className="tr__daftar">
          <div className="tr__gulir">
            {tersaring.map((p) => {
              const sisaP = Math.max(0, (p.contractValue ?? 0) - (p.paidTotal ?? 0));
              return (
                <button
                  key={p.id}
                  type="button"
                  className="k-transfer tr__proyek"
                  aria-pressed={aktif?.id === p.id}
                  onClick={() => pilihProyek(p)}
                >
                  <span className="k-transfer__gambar">{inisial(p.title)}</span>
                  <span className="k-transfer__info">
                    <span className="k-transfer__nama">{p.title}</span>
                    <span className="k-transfer__rek">
                      {p.contractValue ? `sisa ${formatRupiah(sisaP)}` : "belum berkontrak"}
                    </span>
                  </span>
                </button>
              );
            })}
            {tersaring.length === 0 && (
              <p className="tr__kosong">
                {proyek === null ? "Memuat proyek…" : "Tidak ada proyek yang cocok."}
              </p>
            )}
          </div>
          <span className="tr__tirai" />
        </div>

        <Tombol ukuran="large" kiri={Plus} onClick={() => (window.location.href = "/admin/proyek")}>
          Proyek Baru
        </Tombol>
      </section>

      {/* ---- Kolom kanan -------------------------------------------------- */}
      <section className="tr__kanan">
        <article className="tr__kartu tr__baru">
          <KepalaSeksi
            judul="Pembayaran Terbaru"
            kanan={
              <Tombol ukuran="small" jenis="transparent" onClick={() => (window.location.href = "/admin/keuangan")}>
                Lihat semua
              </Tombol>
            }
          />
          <div className="tr__strip">
            {(bayar ?? []).slice(0, 6).map((b) => (
              <BarisTransfer
                key={b.id}
                gambar={<Ikon ikon={CheckCircle} ukuran={18} />}
                nama={formatRupiah(b.amount)}
                rekening={`${LABEL_JENIS[b.kind] ?? b.kind} · ${LABEL_METODE[b.method] ?? b.method}`}
                kananAtas={tanggalPendek(b.paidAt)}
                kananBawah={b.receiver || "—"}
              />
            ))}
            {(bayar ?? []).length === 0 && (
              <p className="tr__kosong">
                {aktif ? "Proyek ini belum punya pembayaran." : "Pilih proyek dulu."}
              </p>
            )}
          </div>
        </article>

        <article className="tr__kartu tr__form">
          <KepalaSeksi
            judul="Catat Pembayaran"
            /* Tombol ⋯ di framenya TIDAK punya lingkaran mint — `Button More`
               di SVG-nya cuma grup ikon tanpa satu pun <rect>, beda dari
               `Button Icon` di kanan atas halaman yang memang berlingkaran
               38. Memakai `TombolBulat` di sini menaikkan kepala seksi dari
               32 jadi 38, dan seluruh isi panel di bawahnya ikut turun 6px. */
            kanan={<TombolIkon ikon={DotsThree} jenis="transparent" judul="Aksi lain" ikonPx={22} />}
          />

          <div className="tr__panel">
            <Segmen
              judul="Jenis pembayaran"
              segmen={JENIS.map((j) => ({ nilai: j.nilai, label: j.label }))}
              nilai={jenisBerlaku}
              onPilih={setJenis}
            />

            <div className="tr__grup">
              <p className="tr__label">Ringkasan kontrak</p>
              <div className="tr__akun">
                <div className="tr__akunkartu tr__akunkartu--utama">
                  <span className="tr__akunubin">
                    <Ikon ikon={NavReceipt} ukuran={24} />
                  </span>
                  <div className="tr__akunisi">
                    <p className="tr__akunlabel">Nilai kontrak</p>
                    <p className="tr__akunnilai">{formatRupiah(kontrak)}</p>
                    <p className="tr__akunket">{aktif?.title ?? "belum ada proyek"}</p>
                  </div>
                </div>
                <div className="tr__akunkartu tr__akunkartu--sisa">
                  <span className="tr__akunubin">
                    <Ikon ikon={Hourglass} ukuran={24} />
                  </span>
                  <div className="tr__akunisi">
                    <p className="tr__akunlabel">Sudah diterima</p>
                    <p className="tr__akunnilai">{formatRupiah(sudah)}</p>
                    <p className="tr__akunket">sisa {formatRupiah(sisa)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="tr__grup">
              <label className="tr__label" htmlFor="tr-proyek">
                Proyek
              </label>
              {/* <select> ASLI, bukan div ber-role. Membuka daftar dengan
                  papan ketik, menggulir ke huruf yang diketik, dan tampil
                  sebagai pemilih bawaan di ponsel — tiga perilaku yang tidak
                  bisa rusak diam-diam. Alasan yang sama dengan <details>
                  untuk akordeon di situs publik. */}
              <div className="k-isian__kotak">
                <select
                  id="tr-proyek"
                  className="k-isian__input"
                  value={aktif?.id ?? ""}
                  onChange={(e) => {
                    const p = (proyek ?? []).find((x) => x.id === e.currentTarget.value);
                    if (p) pilihProyek(p);
                  }}
                >
                  {(proyek ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="tr__baris">
              <div className="tr__grup">
                <label className="tr__label" htmlFor="tr-nominal">
                  Nominal
                </label>
                <div className="k-isian__kotak">
                  <input
                    id="tr-nominal"
                    className="k-isian__input"
                    /* `inputMode`, bukan `type=number`: type=number menolak
                       titik pemisah ribuan dan memunculkan panah naik-turun
                       yang tidak ada gunanya untuk rupiah. */
                    inputMode="numeric"
                    placeholder="0"
                    value={nominal}
                    onChange={(e) => setNominal(e.currentTarget.value)}
                  />
                </div>
              </div>
              <div className="tr__grup">
                <label className="tr__label" htmlFor="tr-penerima">
                  Diterima oleh
                </label>
                <div className="k-isian__kotak">
                  <input
                    id="tr-penerima"
                    className="k-isian__input"
                    placeholder="nama staf yang menerima"
                    value={penerima}
                    onChange={(e) => setPenerima(e.currentTarget.value)}
                  />
                </div>
              </div>
            </div>

            <div className="tr__grup">
              <label className="tr__label" htmlFor="tr-catatan">
                Catatan
              </label>
              <div className="k-isian__kotak">
                <input
                  id="tr-catatan"
                  className="k-isian__input"
                  placeholder="mis. termin kedua, setelah gambar kerja"
                  value={catatan}
                  onChange={(e) => setCatatan(e.currentTarget.value)}
                />
              </div>
            </div>

            <div className="tr__aksi">
              <Tombol
                ukuran="large"
                jenis="secondary"
                onClick={() => {
                  setNominal("");
                  setPenerima("");
                  setCatatan("");
                  setJenis(null);
                }}
              >
                Batal
              </Tombol>
              <Tombol ukuran="large" disabled={!bisaKirim} onClick={simpan}>
                {kirim ? "Menyimpan…" : "Catat Pembayaran"}
              </Tombol>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

export function TerimaKit() {
  /* ToastProvider dipasang DI SINI, bukan di KitLayout: bawaan konteksnya
     `() => {}`, jadi tanpa penyedia setiap toast hilang tanpa jejak — staf
     menekan "Catat Pembayaran" dan tidak ada apa pun yang terjadi di layar
     meski datanya tersimpan. Pola yang sama dipakai delapan island admin
     lain. Gayanya hidup di `overlay.css`, yang karena itu ikut dimuat
     KitLayout — jebakan #5. */
  return (
    <ToastProvider>
      <RequireAuth skeleton={<div className="tr tr--rangka" />}>
        <Isi />
      </RequireAuth>
    </ToastProvider>
  );
}
