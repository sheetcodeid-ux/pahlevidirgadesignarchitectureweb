import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast } from "../kit/Toast";
import { KepalaSeksi } from "../kit/Item";
import { Lencana } from "../kit/Lencana";
import { Tombol } from "../kit/Tombol";
import { Cari } from "../kit/Isian";
import { Isian } from "../kit/Isian";
import { Segmen } from "../kit/Segmen";
import { Dialog } from "../kit/Overlay";
import { IsianTanggal, IsianTempel, PilihAsli } from "../kit/Formulir";
import { CoinIn, CoinOut, Plus } from "../kit/ikon";
import { DaftarKit, PilihTombol } from "./daftarKit";
import { DialogTarget, RingkasTarget, labelSemester, semesterBerikut, useKemajuanTarget } from "./targetKit";
import {
  bacaCache,
  catatKas,
  daftarKas,
  daftarProyek,
  hapusKas,
  tulisCache,
  ubahKas,
  KATEGORI_KAS,
  LABEL_KATEGORI_KAS,
  type ArusKas,
  type EntriKas,
  type KategoriKas,
  type Proyek,
} from "../../lib/admin";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";

/* =============================================================================
   Kas Studio — sheet "KELUAR MASUK" untuk uang yang tidak lahir dari satu
   proyek desain: penjualan PVC, cashbon bagi hasil, konsumsi, sewa kantor.

   Bukan pintu kedua untuk hal yang sama ("Keuangan satu pintu" tetap):
   pembayaran klien tetap dicatat di Terima Pembayaran, biaya proyek di Catat
   Pengeluaran, gaji di Gaji. Yang dicatat DI SINI tidak punya tempat lain —
   sebelum fase 1, produksi bahkan tidak bisa mencatat biaya tanpa proyek.

   Di kanan: target pemasukan semester (sumber yang sama dengan Dashboard),
   karena uang masuk di sini ikut dihitung ke target itu.
   ============================================================================= */

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const tanggalPendek = (iso: string) => {
  const [t, b, h] = iso.split("-").map(Number);
  return `${h} ${BULAN[(b ?? 1) - 1]} ${t}`;
};
const hariIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const bulanIni = () => hariIni().slice(0, 7);

type Rentang = "bulan" | "semester" | "12bulan" | "semua";
function awalRentang(r: Rentang): string | undefined {
  const d = new Date();
  if (r === "bulan") return `${bulanIni()}-01`;
  if (r === "semester") return `${d.getFullYear()}-${d.getMonth() < 6 ? "01" : "07"}-01`;
  if (r === "12bulan") {
    d.setMonth(d.getMonth() - 11, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }
  return undefined;
}

function Isi() {
  const [kas, setKas] = useState<EntriKas[] | null>(() => bacaCache<EntriKas[]>("kas-studio"));
  const [proyek, setProyek] = useState<Proyek[]>(() => bacaCache<Proyek[]>("proyek") ?? []);
  const [cari, setCari] = useState("");
  const [arus, setArus] = useState<"semua" | ArusKas>("semua");
  const [rentang, setRentang] = useState<Rentang>("semester");
  const [ubah, setUbah] = useState<EntriKas | "baru" | null>(null);
  const [target, muatTarget] = useKemajuanTarget();

  function muat() {
    daftarKas()
      .then((d) => {
        tulisCache("kas-studio", d);
        setKas(d);
      })
      .catch(() => setKas((l) => l ?? []));
  }
  useEffect(() => {
    muat();
    daftarProyek().then(setProyek).catch(() => {});
  }, []);
  const segar = () => {
    muat();
    muatTarget();
  };

  const dari = awalRentang(rentang);
  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (kas ?? []).filter(
      (k) =>
        (arus === "semua" || k.direction === arus) &&
        (!dari || k.occurredOn >= dari) &&
        (!q || `${k.label} ${k.counterparty ?? ""} ${k.projectTitle ?? ""} ${LABEL_KATEGORI_KAS[k.category]}`.toLowerCase().includes(q)),
    );
  }, [kas, cari, arus, dari]);

  /* Ringkasan bulan berjalan — sheet itu dibaca per bulan. */
  const bln = bulanIni();
  const bulanan = (kas ?? []).filter((k) => k.occurredOn.startsWith(bln));
  const masukBulan = bulanan.filter((k) => k.direction === "masuk").reduce((n, k) => n + k.amount, 0);
  const keluarBulan = bulanan.filter((k) => k.direction === "keluar").reduce((n, k) => n + k.amount, 0);

  const kolom = [
    { judul: "Tanggal", lebar: 104 },
    { judul: "Keterangan", lebar: 232 },
    { judul: "Dari / untuk", lebar: 150 },
    { judul: "Proyek terkait", lebar: 160 },
    { judul: "Nominal", lebar: 136, kanan: true },
    { judul: "Arus", lebar: 84 },
  ];
  const baris = tersaring.map((k) => [
    <span className="kas__tgl">{tanggalPendek(k.occurredOn)}</span>,
    <button type="button" className="kas__ket" onClick={() => setUbah(k)} title="Ubah catatan ini">
      <b>{k.label}</b>
      <small>{LABEL_KATEGORI_KAS[k.category]}</small>
    </button>,
    k.counterparty ?? <span className="kas__redup">—</span>,
    k.projectTitle ?? <span className="kas__redup">—</span>,
    <b className={k.direction === "keluar" ? "kas__keluar" : "kas__masuk"}>
      {k.direction === "keluar" ? "−" : "+"}
      {formatRupiah(k.amount)}
    </b>,
    <Lencana bentuk="pejalkecil" nada={k.direction === "masuk" ? "selesai" : "netral"}>
      {k.direction === "masuk" ? "Masuk" : "Keluar"}
    </Lencana>,
  ]);

  return (
    <div className="kas">
      <DaftarKit
        className="kas__daftar"
        kunciSaring={`${cari}|${arus}|${rentang}`}
        kiri={
          <>
            <Cari
              ukuran="medium"
              judul="Cari kas"
              placeholder="Cari keterangan atau nama"
              value={cari}
              onChange={(e) => setCari(e.currentTarget.value)}
            />
            <PilihTombol
              judul="Saring arus kas"
              nilai={arus}
              onPilih={(v) => setArus(v as typeof arus)}
              opsi={[
                { nilai: "semua", label: "Masuk & keluar" },
                { nilai: "masuk", label: "Uang masuk" },
                { nilai: "keluar", label: "Uang keluar" },
              ]}
            />
            <PilihTombol
              judul="Rentang tanggal"
              nilai={rentang}
              onPilih={(v) => setRentang(v as Rentang)}
              opsi={[
                { nilai: "bulan", label: "Bulan ini" },
                { nilai: "semester", label: "Semester ini" },
                { nilai: "12bulan", label: "12 bulan terakhir" },
                { nilai: "semua", label: "Semua" },
              ]}
            />
          </>
        }
        kanan={
          <Tombol ukuran="medium" jenis="primary" kiri={Plus} onClick={() => setUbah("baru")}>
            Catat kas
          </Tombol>
        }
        kolom={kolom}
        baris={baris}
        kunci={tersaring.map((k) => k.id)}
        memuat={kas === null}
        teksMemuat="Memuat kas studio…"
        kosong={
          kas && kas.length > 0
            ? "Tidak ada catatan kas pada saringan ini."
            : "Belum ada catatan kas di luar proyek."
        }
        ketKosong={
          kas && kas.length > 0
            ? undefined
            : "Penjualan PVC, bagi hasil, konsumsi, atau sewa kantor dicatat di sini. Pembayaran klien dan biaya proyek punya halamannya sendiri."
        }
        satuan="catatan"
      />

      <aside className="kas__samping" aria-label="Target dan ringkasan kas">
        <article className="kas__kartu">
          <KepalaSeksi
            judul="Target Semester"
            kanan={
              target ? (
                <DialogTarget
                  semester={target.semesterStart}
                  nilai={target.target}
                  onSelesai={muatTarget}
                  pemicu={(buka) => (
                    <button type="button" className="kas__tautan" onClick={buka}>
                      {target.target ? "Ubah" : "Tetapkan"}
                    </button>
                  )}
                />
              ) : undefined
            }
          />
          <p className="kas__semester">
            {target ? labelSemester(target.semesterStart) : "—"}
            {target?.asal === "diteruskan" && <span> · memakai target semester lalu</span>}
          </p>
          <RingkasTarget k={target} />
          {target && (
            <dl className="kas__rinci">
              <div>
                <dt>Pembayaran klien</dt>
                <dd>{formatRupiah(target.pembayaranKlien)}</dd>
              </div>
              <div>
                <dt>Kas studio masuk</dt>
                <dd>{formatRupiah(target.kasLain)}</dd>
              </div>
            </dl>
          )}
          {target && (
            <DialogTarget
              semester={semesterBerikut(target.semesterStart)}
              nilai={target.target}
              onSelesai={muatTarget}
              pemicu={(buka) => (
                <button type="button" className="kas__tautan kas__tautan--bawah" onClick={buka}>
                  Tetapkan target {labelSemester(semesterBerikut(target.semesterStart))}
                </button>
              )}
            />
          )}
        </article>

        <article className="kas__kartu">
          <KepalaSeksi judul="Kas Bulan Ini" kanan={<span className="kas__ketkepala">{BULAN[Number(bln.slice(5, 7)) - 1]}</span>} />
          <dl className="kas__bulan">
            <div>
              <dt>Masuk</dt>
              <dd className="kas__masuk">+{formatRupiahRingkas(masukBulan)}</dd>
            </div>
            <div>
              <dt>Keluar</dt>
              <dd className="kas__keluar">−{formatRupiahRingkas(keluarBulan)}</dd>
            </div>
            <div className="kas__bersih">
              <dt>Bersih</dt>
              <dd>{formatRupiahRingkas(masukBulan - keluarBulan)}</dd>
            </div>
          </dl>
          <p className="kas__catatan">
            Hanya kas di luar proyek. Pembayaran klien dan biaya proyek ada di{" "}
            <a href="/admin/keuangan/transaksi">Semua Transaksi</a>.
          </p>
        </article>
      </aside>

      <DialogKas entri={ubah} proyek={proyek} onTutup={() => setUbah(null)} onSelesai={segar} />
    </div>
  );
}

function DialogKas({
  entri,
  proyek,
  onTutup,
  onSelesai,
}: {
  entri: EntriKas | "baru" | null;
  proyek: Proyek[];
  onTutup: () => void;
  onSelesai: () => void;
}) {
  const toast = useToast();
  const lama = entri && entri !== "baru" ? entri : null;
  const [f, setF] = useState({
    direction: "masuk" as ArusKas,
    category: "penjualan_material" as KategoriKas,
    label: "",
    counterparty: "",
    amount: "",
    occurredOn: hariIni(),
    projectId: "",
  });
  const [sibuk, setSibuk] = useState(false);
  const [yakinHapus, setYakinHapus] = useState(false);

  useEffect(() => {
    if (!entri) return;
    setYakinHapus(false);
    setF(
      lama
        ? {
            direction: lama.direction,
            category: lama.category,
            label: lama.label,
            counterparty: lama.counterparty ?? "",
            amount: lama.amount.toLocaleString("id-ID"),
            occurredOn: lama.occurredOn,
            projectId: lama.projectId ?? "",
          }
        : {
            direction: "masuk",
            category: "penjualan_material",
            label: "",
            counterparty: "",
            amount: "",
            occurredOn: hariIni(),
            projectId: "",
          },
    );
  }, [entri]);

  const nominal = Number(f.amount.replace(/\D/g, "")) || 0;
  const alasan =
    f.label.trim().length < 2 ? "Isi keterangannya dulu." : nominal <= 0 ? "Isi nominalnya." : !f.occurredOn ? "Pilih tanggal." : null;

  function gantiArus(a: string) {
    const arah = a as ArusKas;
    /* Kategori harus searah arusnya (constraint database) — yang tidak
       cocok diganti kategori pertama arus baru, bukan dibiarkan ditolak. */
    setF((x) => ({ ...x, direction: arah, category: KATEGORI_KAS[arah].includes(x.category) ? x.category : KATEGORI_KAS[arah][0]! }));
  }

  async function simpan() {
    if (alasan) return;
    setSibuk(true);
    const isi = {
      direction: f.direction,
      category: f.category,
      label: f.label.trim(),
      counterparty: f.counterparty.trim() || null,
      amount: nominal,
      occurredOn: f.occurredOn,
      projectId: f.projectId || null,
    };
    try {
      if (lama) await ubahKas(lama.id, isi);
      else await catatKas(isi);
      toast({
        judul: lama ? "Catatan kas diubah" : f.direction === "masuk" ? "Uang masuk dicatat" : "Uang keluar dicatat",
        keterangan: `${isi.label} — ${formatRupiah(nominal)}`,
        nada: "sukses",
      });
      onTutup();
      onSelesai();
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setSibuk(false);
    }
  }
  async function hapus() {
    if (!lama) return;
    if (!yakinHapus) {
      setYakinHapus(true);
      return;
    }
    setSibuk(true);
    try {
      await hapusKas(lama.id);
      toast({ judul: "Catatan kas dihapus", keterangan: lama.label, nada: "sukses" });
      onTutup();
      onSelesai();
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setSibuk(false);
    }
  }

  return (
    <Dialog
      open={entri !== null}
      onOpenChange={(o) => !o && onTutup()}
      title={lama ? "Ubah catatan kas" : "Catat kas studio"}
      description="Uang di luar proyek desain. Pembayaran klien dicatat di Terima Pembayaran, biaya proyek di Catat Pengeluaran."
      footer={
        <>
          {lama && (
            <Tombol ukuran="medium" jenis="bahaya" onClick={hapus} disabled={sibuk} className="kas__hapus">
              {yakinHapus ? "Ya, hapus" : "Hapus"}
            </Tombol>
          )}
          <Tombol ukuran="medium" jenis="ghost" onClick={onTutup} disabled={sibuk}>
            Batal
          </Tombol>
          <Tombol ukuran="medium" jenis="primary" onClick={simpan} disabled={sibuk || !!alasan} memuat={sibuk} title={alasan ?? undefined}>
            Simpan
          </Tombol>
        </>
      }
    >
      <div className="kas__form">
        <Segmen
          judul="Arus kas"
          nilai={f.direction}
          onPilih={gantiArus}
          segmen={[
            { nilai: "masuk", label: "Uang masuk", ikon: CoinIn },
            { nilai: "keluar", label: "Uang keluar", ikon: CoinOut },
          ]}
        />
        <div className="kas__dua">
          <label className="k-isian">
            <span className="k-isian__label">Kategori</span>
            <PilihAsli value={f.category} onChange={(e) => setF({ ...f, category: e.currentTarget.value as KategoriKas })}>
              {KATEGORI_KAS[f.direction].map((k) => (
                <option key={k} value={k}>
                  {LABEL_KATEGORI_KAS[k]}
                </option>
              ))}
            </PilihAsli>
          </label>
          <IsianTanggal label="Tanggal" nilai={f.occurredOn} onUbah={(v) => setF({ ...f, occurredOn: v })} bisaKosong={false} />
        </div>
        <Isian
          label="Keterangan"
          maxLength={160}
          placeholder={f.direction === "masuk" ? "mis. Penjualan PVC" : "mis. Konsumsi rapat klien"}
          value={f.label}
          onChange={(e) => setF({ ...f, label: e.currentTarget.value })}
        />
        <div className="kas__dua">
          <Isian
            label={f.direction === "masuk" ? "Dari" : "Untuk"}
            maxLength={120}
            placeholder={f.direction === "masuk" ? "mis. Ko Fendy" : "mis. Toko Sinar"}
            value={f.counterparty}
            onChange={(e) => setF({ ...f, counterparty: e.currentTarget.value })}
          />
          <IsianTempel
            label="Nominal"
            kiri="Rp"
            inputMode="numeric"
            value={f.amount}
            onChange={(e) => {
              const d = e.currentTarget.value.replace(/\D/g, "");
              setF({ ...f, amount: d ? Number(d).toLocaleString("id-ID") : "" });
            }}
          />
        </div>
        <label className="k-isian">
          <span className="k-isian__label">Proyek terkait (boleh kosong)</span>
          <PilihAsli value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.currentTarget.value })}>
            <option value="">Tidak terkait proyek</option>
            {proyek.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </PilihAsli>
        </label>
        {f.direction === "masuk" && (
          <p className="kas__info">Uang masuk di sini ikut dihitung ke target pemasukan semester.</p>
        )}
        {yakinHapus && <p className="kas__info kas__info--bahaya">Tekan "Ya, hapus" sekali lagi untuk menghapus catatan ini.</p>}
      </div>
    </Dialog>
  );
}

export function KasKit() {
  return (
    <RequireAuth skeleton={<div className="kas kas--rangka" />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
