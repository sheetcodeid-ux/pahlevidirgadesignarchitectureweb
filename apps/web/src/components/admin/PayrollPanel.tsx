import { useEffect, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { Balok } from "../ui/Skeleton";
import { KartuAngka } from "../ui/data/KartuAngka";
import { DataTable, type Kolom } from "../ui/data/DataTable";
import { Dialog, AlertDialog } from "../ui/overlay/Dialog";
import { Select } from "../ui/overlay/Select";
import { InputRupiah } from "../ui/InputRupiah";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import {
  gajiBulan, catatGaji, ubahGaji, hapusGaji, daftarTim,
  LABEL_JENIS_ANGGOTA,
  type BarisGajiBulan, type AnggotaTim,
} from "../../lib/admin";
import { formatRupiah } from "../../lib/format";
import { unduhCsv } from "../../lib/csv";

/**
 * Halaman Gaji — gaji bulanan operasional.
 *
 * Aturannya satu kalimat, dan ia dijaga di lapisan data bukan di sini:
 * FEE MENULIS, GAJI MEMBACA.
 *
 *   Kolom "Gaji" diketik di halaman ini, dan hanya untuk bayaran yang TIDAK
 *   lahir dari sebuah proyek — gaji operasional partner dan staf tetap.
 *   Kolom "Fee bulan ini" TIDAK bisa diketik di mana pun: ia dijumlahkan SQL
 *   dari biaya proyek yang sudah tercatat di Keuangan.
 *
 * Itu yang membuat satu nominal mustahil masuk dua kali. Kalau halaman ini
 * boleh mengetik fee juga, seorang freelancer yang sudah dicatat di biaya
 * proyek bisa diketik lagi di sini — beban studio tercatat ganda dan laba
 * bersihnya salah, dan itu kesalahan yang tidak terlihat sampai tutup buku.
 *
 * §6.1 dokumen strategi: "Dirga dan Adji harus menerima gaji bulanan yang
 * wajar untuk pekerjaan operasional, terpisah dari dividen tahunan." Halaman
 * ini gaji operasionalnya. Dividen 70-20-10 tidak ada di sini.
 */

function bulanIni(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function labelBulan(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

function tanggalPendek(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

const HARI_INI = () => new Date().toISOString().slice(0, 10);

function Isi() {
  const toast = useToast();
  const [period, setPeriod] = useState(bulanIni());
  const [baris, setBaris] = useState<BarisGajiBulan[] | null>(null);
  const [tim, setTim] = useState<AnggotaTim[]>([]);

  function muat() {
    gajiBulan(period).then(setBaris).catch(() => setBaris((l) => l ?? []));
  }

  /* TIDAK di-cache. Isinya selalu milik satu bulan tertentu, dan cache yang
     tidak membawa bulannya di kunci adalah cara paling mudah menampilkan
     angka bulan lalu sebagai angka bulan ini. */
  useEffect(muat, [period]);
  useEffect(() => { daftarTim().then(setTim).catch(() => setTim([])); }, []);

  const ringkas = useMemo(() => {
    const d = baris ?? [];
    return {
      gaji: d.reduce((a, b) => a + (b.salaryAmount ?? 0), 0),
      fee: d.reduce((a, b) => a + b.feeAmount, 0),
      total: d.reduce((a, b) => a + b.total, 0),
      belum: d.filter((b) => b.salaryId && !b.salaryPaidOn).length,
    };
  }, [baris]);

  async function tandaiDibayar(b: BarisGajiBulan, dibayar: boolean) {
    if (!b.salaryId || !baris) return;
    const sebelum = baris;
    const tgl = dibayar ? HARI_INI() : null;
    setBaris(baris.map((x) => (x.salaryId === b.salaryId ? { ...x, salaryPaidOn: tgl } : x)));
    try {
      await ubahGaji(b.salaryId, { paidOn: tgl });
    } catch (e) {
      setBaris(sebelum);
      toast({ judul: "Gagal mengubah status", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function hapus(b: BarisGajiBulan) {
    if (!b.salaryId) return;
    try {
      await hapusGaji(b.salaryId);
      muat();
      toast({ judul: "Baris gaji dihapus", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  const kolom: Kolom<BarisGajiBulan>[] = [
    {
      judul: "Nama",
      render: (b) => (
        <span style={{ minWidth: 0, display: "block" }}>
          <span className="item__title">{b.name}</span>
          <div className="attachment__size">{b.role ?? LABEL_JENIS_ANGGOTA[b.kind]}</div>
        </span>
      ),
    },
    {
      judul: "Jenis", lebar: "7rem",
      render: (b) => <span className="badge">{LABEL_JENIS_ANGGOTA[b.kind]}</span>,
    },
    {
      judul: "Gaji", kelas: "table__num", lebar: "9rem",
      render: (b) => (b.salaryAmount === null || b.salaryAmount === undefined
        ? <span className="t-faint">—</span>
        : formatRupiah(b.salaryAmount)),
    },
    {
      judul: "Fee bulan ini", kelas: "table__num", lebar: "9rem",
      /* Angka ini TIDAK bisa diketik di halaman ini — ia datang dari biaya
         proyek. Judulnya diberi tooltip supaya yang bertanya "kenapa tidak
         bisa saya ubah" menemukan jawabannya di tempat ia bertanya. */
      render: (b) => (b.feeAmount === 0
        ? <span className="t-faint">—</span>
        : (
          <span title={`Dari ${b.feeCount} biaya proyek bulan ini. Diubah di Keuangan, bukan di sini.`}>
            {formatRupiah(b.feeAmount)}
          </span>
        )),
    },
    {
      judul: "Total", kelas: "table__num", lebar: "9rem",
      render: (b) => <strong>{formatRupiah(b.total)}</strong>,
    },
    {
      judul: "Status", lebar: "10rem",
      render: (b) => {
        /* Yang cuma dapat fee TIDAK punya status bayar: fee proyek sudah
           uang yang keluar saat dicatat, bukan janji yang menunggu dibayar.
           Memberinya lencana "belum dibayar" akan menagih sesuatu yang
           sebenarnya sudah lunas. */
        if (!b.salaryId) return <span className="t-faint">fee proyek saja</span>;
        return b.salaryPaidOn
          ? (
            <button type="button" className="badge badge--ok payroll__status"
              title={`Dibayar ${tanggalPendek(b.salaryPaidOn)}. Klik untuk membatalkan tanda.`}
              onClick={() => tandaiDibayar(b, false)}>
              <span className="badge__dot" />Dibayar {tanggalPendek(b.salaryPaidOn)}
            </button>
          )
          : (
            <button type="button" className="badge badge--warn payroll__status"
              title="Klik untuk menandai sudah dibayar hari ini"
              onClick={() => tandaiDibayar(b, true)}>
              <span className="badge__dot" />Tandai dibayar
            </button>
          );
      },
    },
    {
      judul: "Aksi", kelas: "table__actions", lebar: "5rem",
      render: (b) => (
        <span className="table__act">
          <DialogGaji
            tim={tim} period={period} awal={b} onSelesai={muat}
            pemicu={
              <button type="button" className="btn btn--secondary btn--icon btn--boxed"
                aria-label={`${b.salaryId ? "Ubah" : "Catat"} gaji ${b.name}`}>
                <Icon name={b.salaryId ? "edit" : "plus"} size={15} />
              </button>
            }
          />
          {b.salaryId && (
            <AlertDialog
              destructive
              title="Hapus baris gaji ini?"
              description={`${b.name} — ${labelBulan(period)}. Fee proyeknya tidak ikut terhapus; yang hilang cuma gaji bulan ini.`}
              confirmLabel="Ya, hapus"
              onConfirm={() => hapus(b)}
              trigger={
                <button type="button" className="btn btn--ghost btn--icon btn--sm btn--hapus"
                  aria-label={`Hapus gaji ${b.name}`}>
                  <Icon name="trash" size={14} />
                </button>
              }
            />
          )}
        </span>
      ),
    },
  ];

  function ekspor() {
    unduhCsv(`gaji-${period}.csv`, [
      ["Nama", "Jenis", "Peran", "Gaji", "Fee bulan ini", "Total", "Dibayar pada", "Catatan"],
      ...(baris ?? []).map((b) => [
        b.name, LABEL_JENIS_ANGGOTA[b.kind], b.role ?? "",
        b.salaryAmount === null || b.salaryAmount === undefined ? "" : String(b.salaryAmount),
        String(b.feeAmount), String(b.total),
        b.salaryPaidOn ?? "", b.salaryNote ?? "",
      ]),
    ]);
  }

  const alat = (
    <>
      <DialogGaji
        tim={tim} period={period} onSelesai={muat}
        pemicu={
          <button type="button" className="btn btn--primary btn--lift">
            <Icon name="plus" size={15} />Catat gaji
          </button>
        }
      />
      <button type="button" className="btn btn--secondary" onClick={ekspor}>
        <Icon name="download" size={15} />Export
      </button>
    </>
  );

  if (baris === null) {
    return (
      <div className="keu" aria-hidden="true">
        <div className="kangka-deret">
          <div className="skeleton skeleton--tunda keu__rangka" />
          <div className="skeleton skeleton--tunda keu__rangka" />
          <div className="skeleton skeleton--tunda keu__rangka" />
        </div>
        <Balok tinggi="3rem" style={{ borderRadius: "var(--radius-sm)" }} />
        <Balok tinggi="18rem" style={{ borderRadius: "var(--radius-sm)" }} />
      </div>
    );
  }

  return (
    <div className="keu">
      <div className="kangka-deret">
        <KartuAngka label="Gaji bulan ini" nilai={formatRupiah(ringkas.gaji)} ikon="cash"
          delta={labelBulan(period).toLowerCase()} deltaNada="netral" />
        <KartuAngka label="Fee proyek" nilai={formatRupiah(ringkas.fee)} ikon="project"
          delta="dijumlahkan dari Keuangan" deltaNada="netral" />
        <KartuAngka label="Total keluar untuk orang" nilai={formatRupiah(ringkas.total)} ikon="team"
          delta={ringkas.belum > 0 ? `${ringkas.belum} gaji belum dibayar` : "semua gaji sudah dibayar"}
          deltaNada="netral" />
      </div>

      <div className="keu__bar">
        <div className="field payroll__bulan">
          <label className="field__label" htmlFor="gj-bulan">Bulan</label>
          {/* <input type="month"> bawaan, bukan pemilih buatan sendiri:
              perilakunya tidak bisa rusak diam-diam, dan ia sudah tahu
              bahasa serta kalender perangkatnya. */}
          <input id="gj-bulan" className="input input--ringkas" type="month"
            value={period} onChange={(e) => setPeriod(e.target.value || bulanIni())} />
        </div>
      </div>

      <DataTable
        data={baris}
        kunci={(b) => b.teamMemberId}
        kolom={kolom}
        cariPada={(b) => [b.name, b.role, LABEL_JENIS_ANGGOTA[b.kind]]}
        placeholderCari="Cari nama atau peran…"
        labelCari="Cari orang"
        satuan="orang"
        barisSkeleton={4}
        bentuk="kartu"
        aksi={alat}
        kosong={{
          ikon: "cash",
          judul: `Belum ada gaji atau fee di ${labelBulan(period)}`,
          keterangan: "Tekan Catat gaji untuk gaji bulanan. Fee freelancer tidak diketik di sini — ia muncul sendiri dari pengeluaran proyek yang dicatat di Keuangan.",
        }}
      />
    </div>
  );
}

/* ── Dialog catat / ubah gaji ─────────────────────────────────────────────
 *
 * Satu dialog untuk dua hal: baris baru dan baris yang sudah ada. Dua dialog
 * yang isiannya sama persis adalah dua tempat yang harus diingat saat salah
 * satunya diperbaiki.
 */
function DialogGaji({
  tim, period, awal, pemicu, onSelesai,
}: {
  tim: AnggotaTim[];
  period: string;
  awal?: BarisGajiBulan;
  pemicu: React.ReactNode;
  onSelesai: () => void;
}) {
  const toast = useToast();
  const [buka, setBuka] = useState(false);
  const [orang, setOrang] = useState(awal?.teamMemberId ?? "");
  const [nominal, setNominal] = useState<number | null>(awal?.salaryAmount ?? null);
  const [dibayar, setDibayar] = useState(awal?.salaryPaidOn ?? "");
  const [catatan, setCatatan] = useState(awal?.salaryNote ?? "");
  const [kirim, setKirim] = useState(false);

  const ubah = Boolean(awal?.salaryId);
  const siap = Boolean(orang) && (nominal ?? 0) > 0;

  /* Nilai awal disetel ulang tiap dialog dibuka, bukan sekali saat dipasang:
     komponennya tetap hidup di antara pembukaan, jadi tanpa ini isian
     membawa sisa ketikan yang batal dari pembukaan sebelumnya. */
  function saatBuka(b: boolean) {
    setBuka(b);
    if (b) {
      setOrang(awal?.teamMemberId ?? "");
      setNominal(awal?.salaryAmount ?? null);
      setDibayar(awal?.salaryPaidOn ?? "");
      setCatatan(awal?.salaryNote ?? "");
    }
  }

  /* Freelancer dibayar per proyek, bukan bulanan. Mereka tidak disaring dari
     daftar — seorang core freelancer bisa saja diberi retainer bulanan — tapi
     diberi peringatan, karena mengetik bayaran proyek di sini berarti angka
     yang sama tercatat dua kali. */
  const jenisTerpilih = tim.find((t) => t.id === orang)?.kind;
  const perluIngat = jenisTerpilih === "proyek" || jenisTerpilih === "inti";

  async function simpan() {
    if (!siap) return;
    setKirim(true);
    try {
      if (ubah && awal?.salaryId) {
        await ubahGaji(awal.salaryId, {
          amount: nominal as number, paidOn: dibayar || null, note: catatan.trim() || null,
        });
      } else {
        await catatGaji({
          teamMemberId: orang, period, amount: nominal as number,
          paidOn: dibayar || null, note: catatan.trim() || null,
        });
      }
      setBuka(false);
      onSelesai();
      toast({ judul: ubah ? "Gaji diperbarui" : "Gaji tercatat", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setKirim(false);
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={saatBuka}
      title={ubah ? "Ubah gaji" : "Catat gaji"}
      description={`Gaji operasional untuk ${labelBulan(period)}. Bayaran per proyek dicatat di Keuangan.`}
      trigger={pemicu}
      footer={
        <button type="button" className="btn btn--primary" disabled={!siap || kirim} onClick={simpan}>
          {kirim && <span className="spinner spinner--sm spinner--on-action" />}Simpan
        </button>
      }
    >
      <div className="stack">
        <div className="field">
          <label className="field__label" htmlFor="gj-orang">
            Orang<span className="field__req" aria-hidden="true">*</span>
          </label>
          <Select
            id="gj-orang"
            ariaLabel="Orang"
            value={orang}
            onValueChange={setOrang}
            placeholder="Pilih orang…"
            /* Saat mengubah, orangnya dikunci: memindahkan baris gaji ke nama
               lain bukan "mengubah", melainkan menghapus satu dan membuat
               satu lagi — dan satu orang cuma boleh punya satu baris per
               bulan, jadi pemindahan diam-diam bisa menabrak baris yang ada. */
            disabled={ubah}
            options={tim.filter((t) => t.active || t.id === orang).map((t) => ({
              value: t.id, label: t.role ? `${t.name} — ${t.role}` : t.name,
            }))}
          />
          {perluIngat && (
            <p className="field__help">
              Orang ini jenisnya freelancer. Bayaran yang lahir dari sebuah
              proyek dicatat di Keuangan → Catat pengeluaran, dan muncul
              sendiri di kolom Fee. Isi di sini hanya kalau ia memang digaji
              bulanan di luar proyek.
            </p>
          )}
        </div>

        <div className="spec-grid spec-grid--rapat">
          <div className="field">
            <label className="field__label" htmlFor="gj-nominal">
              Nominal<span className="field__req" aria-hidden="true">*</span>
            </label>
            <InputRupiah id="gj-nominal" value={nominal} onChange={setNominal} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="gj-dibayar">Dibayar pada</label>
            <input id="gj-dibayar" className="input input--ringkas" type="date"
              value={dibayar} onChange={(e) => setDibayar(e.target.value)} />
            <p className="field__help">Kosongkan kalau belum dibayar.</p>
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="gj-catatan">Catatan</label>
          <input id="gj-catatan" className="input" value={catatan} maxLength={400}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Opsional — mis. termasuk tunjangan transport" />
        </div>
      </div>
    </Dialog>
  );
}

export function PayrollPanel() {
  return (
    <RequireAuth skeleton={<div className="keu"><Balok tinggi="20rem" /></div>}>
      <ToastProvider><Isi /></ToastProvider>
    </RequireAuth>
  );
}
