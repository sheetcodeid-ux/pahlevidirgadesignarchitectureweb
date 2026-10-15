import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Lencana } from "../kit/Lencana";
import { Tombol } from "../kit/Tombol";
import { Dialog } from "../kit/Overlay";
import { useToast } from "../kit/Toast";
import { IsianPanjang, IsianTanggal, IsianTempel, KelompokIsian, PilihMenu } from "../kit/Formulir";
import {
  daftarTim, tambahTimProyek, ubahTimProyek, hapusTimProyek, bayarTahap, simpanProyek,
  LABEL_PERAN, URUTAN_PERAN,
  type Proyek, type PenugasanTim, type AnggotaTim, type PeranTim, type TahapBayaran, type Paket,
} from "../../lib/admin";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";
import { jagaFokusSesudahHapus } from "../../lib/fokus";
import { PilihPaket } from "./pilihPaket";

/* =============================================================================
   Tim & bayaran proyek — kolom "TEAM DESIGN" dan "TEAM DESIGN FEE" di Excel
   pemilik, dihitung alih-alih diketik. Isinya DIALOG dan sel bersama; yang
   menggambar barisnya Jadwal Pelaksanaan (Satu Proyek, baris PERSONIL) dan
   Bayaran Tim.

   Satu baris per orang per peran. Persennya tersimpan di penugasan; rupiahnya
   dihitung API dari fee design proyek. Bayaran dua tahap — "dibayarkan 5%
   dulu, sisa tunggu design selesai": tahap awal jatuh tempo saat DP klien
   masuk, tahap akhir saat tahap proyek sampai Finish. Membayar satu tahap
   mencatat BIAYA PROYEK (bukan angka kedua di tempat lain), jadi laba proyek,
   halaman Fee, dan halaman Gaji ikut berubah dengan sendirinya.
   ============================================================================= */

const hariIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const tanggalPendek = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
const angkaDari = (v: string) => Number(v.replace(/\D/g, "")) || 0;
const titikRibuan = (v: string) => {
  const n = v.replace(/\D/g, "");
  return n ? Number(n).toLocaleString("id-ID") : "";
};
const pctTeks = (n: number | null) => (n === null ? "" : n.toLocaleString("id-ID", { maximumFractionDigits: 2 }));
const persenDari = (v: string) => {
  const t = v.replace(",", ".").trim();
  return t === "" ? null : Number(t);
};

export const SYARAT: Record<TahapBayaran["tahap"], string> = {
  awal: "Tunggu DP klien",
  akhir: "Tunggu desain selesai",
};

/* --- Lingkup & tenggat ------------------------------------------------------
   Dialognya saja — yang menampilkan lingkup dan tenggat adalah KOP GAMBAR di
   lembar Jadwal Pelaksanaan (Satu Proyek). */

export function DialogLingkup({
  proyek,
  paket,
  buka,
  onTutup,
  onBerubah,
}: {
  proyek: Proyek;
  paket: Paket[];
  buka: boolean;
  onTutup: () => void;
  onBerubah: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState({ client: "", scope: "", preview: "", final: "", tierId: "" });
  const [menyimpan, setMenyimpan] = useState(false);

  /* Diisi ulang dari proyek tiap kali dibuka — isian yang dibatalkan tidak
     terbawa ke pembukaan berikutnya. */
  useEffect(() => {
    if (!buka) return;
    setF({
      tierId: proyek.tierId ?? "",
      client: proyek.client ?? "",
      scope: proyek.scopeOfWork ?? "",
      preview: proyek.deadlinePreview ?? "",
      final: proyek.deadlineFinal ?? "",
    });
  }, [buka]);
  const urutanSalah = !!(f.preview && f.final && f.final < f.preview);

  async function simpan() {
    setMenyimpan(true);
    try {
      await simpanProyek(proyek.id, {
        ...(f.client.trim() ? { client: f.client.trim() } : {}),
        scopeOfWork: f.scope.trim() || null,
        deadlinePreview: f.preview || null,
        deadlineFinal: f.final || null,
        tierId: f.tierId || null,
      });
      toast({ judul: "Lingkup dan tenggat disimpan", nada: "sukses" });
      onTutup();
      onBerubah();
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={(o) => !o && onTutup()}
      title="Lingkup & tenggat"
      footer={
        <>
          <Tombol ukuran="medium" jenis="ghost" onClick={onTutup} disabled={menyimpan}>
            Batal
          </Tombol>
          <Tombol ukuran="medium" jenis="primary" onClick={simpan} disabled={menyimpan || urutanSalah} memuat={menyimpan}>
            Simpan
          </Tombol>
        </>
      }
    >
      <div className="sat__dialogisi">
        <label className="k-isian">
          <span className="k-isian__label">Klien</span>
          <KelompokIsian value={f.client} maxLength={120} onChange={(e) => setF({ ...f, client: e.currentTarget.value })} />
        </label>
        <PilihPaket paket={paket} nilai={f.tierId} onUbah={(v) => setF({ ...f, tierId: v })} />
        <label className="k-isian">
          <span className="k-isian__label">Lingkup kerja</span>
          <IsianPanjang
            rows={4}
            maxLength={2000}
            value={f.scope}
            placeholder="mis. Desain interior coffee shop dua lantai: alur bar dan dapur, area duduk, fasad."
            onChange={(e) => setF({ ...f, scope: e.currentTarget.value })}
          />
        </label>
        <div className="sat__dialogdua">
          <IsianTanggal label="Tenggat preview" nilai={f.preview} onUbah={(v) => setF({ ...f, preview: v })} />
          <IsianTanggal
            label="Tenggat desain final"
            nilai={f.final}
            min={f.preview || undefined}
            onUbah={(v) => setF({ ...f, final: v })}
            bantu={urutanSalah ? "Tenggat final tidak boleh sebelum preview." : undefined}
          />
        </div>
      </div>
    </Dialog>
  );
}

/* --- Tugaskan / ubah penugasan ------------------------------------------------
   Dibuka dari baris PERSONIL di Jadwal Pelaksanaan. Satu orang per peran;
   persen kosong = ikut Aturan Fee Tim. */

export type UbahTugaskan = { mode: "baru" } | { mode: "ubah"; p: PenugasanTim };

export function DialogTugaskan({
  proyek,
  daftar,
  ubah,
  onTutup,
  onSelesai,
  fokusCadangan,
}: {
  proyek: Proyek;
  /** Penugasan yang sudah ada — orang yang sudah memegang peran yang sama tidak ditawarkan lagi. */
  daftar: PenugasanTim[];
  ubah: UbahTugaskan | null;
  onTutup: () => void;
  onSelesai: () => Promise<void> | void;
  /** Ke mana fokus papan ketik pergi kalau pemicunya ikut lenyap sesudah hapus. */
  fokusCadangan?: () => HTMLElement | null;
}) {
  const toast = useToast();
  const [anggota, setAnggota] = useState<AnggotaTim[]>([]);
  const [form, setForm] = useState({ role: "drafter" as PeranTim, orang: "", pct: "" });
  const [sibuk, setSibuk] = useState(false);
  const pembuka = useRef<HTMLElement | null>(null);

  useEffect(() => {
    daftarTim().then(setAnggota).catch(() => setAnggota([]));
  }, []);
  /* Pemicunya dicatat SEBELUM Radix memindah fokus ke dalam dialog (efek tata
     letak berjalan lebih dulu daripada efek biasa milik FocusScope). */
  useLayoutEffect(() => {
    if (!ubah) return;
    pembuka.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (ubah.mode === "ubah") setForm({ role: ubah.p.role, orang: ubah.p.teamMemberId, pct: pctTeks(ubah.p.pct) });
    else setForm({ role: "drafter", orang: "", pct: "" });
  }, [ubah]);

  const pctForm = persenDari(form.pct);
  const pctSalah = pctForm !== null && (!Number.isFinite(pctForm) || pctForm < 0 || pctForm > 100);
  async function simpan() {
    if (!ubah) return;
    setSibuk(true);
    try {
      if (ubah.mode === "baru") {
        /* Persen kosong = ambil dari Aturan Fee Tim (dibekukan untuk peran
           yang sudah ditentukan, ikut aturan untuk yang belum). */
        await tambahTimProyek(proyek.id, {
          teamMemberId: form.orang,
          role: form.role,
          ...(pctForm !== null ? { pct: pctForm } : {}),
        });
      } else {
        await ubahTimProyek(ubah.p.id, {
          pct: pctForm,
          ...(form.orang !== ubah.p.teamMemberId ? { teamMemberId: form.orang } : {}),
        });
      }
      toast({ judul: ubah.mode === "baru" ? "Anggota ditugaskan" : "Penugasan diubah", nada: "sukses" });
      onTutup();
      await onSelesai();
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setSibuk(false);
    }
  }
  async function hapus() {
    if (!ubah || ubah.mode !== "ubah") return;
    const id = ubah.p.id;
    setSibuk(true);
    try {
      /* Baris personil ikut lenyap bersama tombol nama yang membuka dialog
         ini — fokus papan ketik dijaga lewat lib/fokus (jebakan #39). */
      await jagaFokusSesudahHapus(pembuka.current, async () => {
        await hapusTimProyek(id);
        toast({ judul: "Penugasan dihapus", nada: "sukses" });
        onTutup();
        await onSelesai();
      });
      if (document.activeElement === document.body) fokusCadangan?.()?.focus();
    } catch (e) {
      /* 409: sudah ada bayaran tercatat — kalimat API-nya yang ditampilkan. */
      toast({ judul: "Tidak bisa dihapus", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setSibuk(false);
    }
  }

  const orangDipakai = (o: AnggotaTim) =>
    daftar.some((p) => p.role === form.role && p.teamMemberId === o.id && (ubah?.mode !== "ubah" || p.id !== ubah.p.id));

  return (
    <Dialog
      open={ubah !== null}
      onOpenChange={(o) => !o && onTutup()}
      title={ubah?.mode === "ubah" ? `${LABEL_PERAN[ubah.p.role]} — ${ubah.p.teamMemberName}` : "Tugaskan anggota tim"}
      footer={
        <>
          {ubah?.mode === "ubah" && (
            <Tombol ukuran="medium" jenis="bahaya" onClick={hapus} disabled={sibuk} className="tim__hapus">
              Hapus penugasan
            </Tombol>
          )}
          <Tombol ukuran="medium" jenis="ghost" onClick={onTutup} disabled={sibuk}>
            Batal
          </Tombol>
          <Tombol ukuran="medium" jenis="primary" onClick={simpan} disabled={sibuk || !form.orang || pctSalah} memuat={sibuk}>
            Simpan
          </Tombol>
        </>
      }
    >
      <div className="sat__dialogisi">
        <div className="sat__dialogdua">
          <div className="k-isian">
            <span className="k-isian__label">Peran</span>
            <PilihMenu
              label="Peran"
              nilai={form.role}
              disabled={ubah?.mode === "ubah"}
              onUbah={(v) => setForm({ ...form, role: v as PeranTim })}
              opsi={URUTAN_PERAN.map((r) => ({ nilai: r, label: LABEL_PERAN[r] }))}
            />
          </div>
          <div className="k-isian">
            <span className="k-isian__label">Orang</span>
            <PilihMenu
              label="Orang"
              nilai={form.orang}
              placeholder="— Pilih —"
              onUbah={(v) => setForm({ ...form, orang: v })}
              opsi={anggota
                .filter((o) => (o.active || o.id === form.orang) && !orangDipakai(o))
                .map((o) => ({ nilai: o.id, label: o.name }))}
            />
          </div>
        </div>
        <label className="k-isian">
          <span className="k-isian__label">Bagian dari fee design</span>
          <KelompokIsian
            inputMode="decimal"
            placeholder="ikut Aturan Fee Tim"
            value={form.pct}
            kanan="%"
            onChange={(e) => setForm({ ...form, pct: e.currentTarget.value.replace(/[^\d.,]/g, "") })}
          />
          {pctSalah && <span className="k-isian__bantu">Persen harus angka 0–100.</span>}
          {!pctSalah && pctForm !== null && proyek.contractValue ? (
            <span className="k-isian__bantu">
              = {formatRupiah(Math.round((proyek.contractValue * pctForm) / 100))} dari {formatRupiah(proyek.contractValue)}
            </span>
          ) : null}
        </label>
        {ubah?.mode === "ubah" && ubah.p.dibayar > 0 && (
          <p className="tim__catatan">Sudah dibayar {formatRupiah(ubah.p.dibayar)}.</p>
        )}
      </div>
    </Dialog>
  );
}

/* --- Bagian bersama: sel tahap dan dialog bayar -------------------------------
   Dipakai Tim & Bayaran di Satu Proyek DAN halaman Bayaran Tim. Satu
   komponen, bukan salinan: keadaan tahap dan aturan "boleh bayar lebih awal"
   harus terbaca sama di kedua tempat (jebakan #32). */

export type PilihanBayar = { p: PenugasanTim; t: TahapBayaran };

export function SelTahap({
  p,
  jenis,
  onBayar,
}: {
  p: PenugasanTim;
  jenis: TahapBayaran["tahap"];
  onBayar: (t: TahapBayaran) => void;
}) {
  const t = p.tahap.find((x) => x.tahap === jenis);
  if (!t) return <span className="sat__redup">—</span>;
  if (t.keadaan === "dibayar") {
    return (
      <span className="tim__tahap">
        <Lencana nada="selesai">Dibayar</Lencana>
        <small>
          {formatRupiahRingkas(t.dibayar ?? 0)} · {t.dibayarPada ? tanggalPendek(t.dibayarPada) : ""}
        </small>
      </span>
    );
  }
  if (t.keadaan === "jatuh_tempo") {
    return (
      <Tombol ukuran="small" jenis="primary" onClick={() => onBayar(t)}>
        Bayar {formatRupiahRingkas(t.nominal ?? 0)}
      </Tombol>
    );
  }
  if (t.keadaan === "belum_ditentukan") return <Lencana nada="menunggu">Persen belum ditentukan</Lencana>;
  return (
    <button type="button" className="tim__tunggu" onClick={() => onBayar(t)} title="Bayar lebih awal">
      <Lencana nada="netral">{SYARAT[jenis]}</Lencana>
    </button>
  );
}

export function DialogBayar({
  bayar,
  onTutup,
  onSelesai,
}: {
  bayar: PilihanBayar | null;
  onTutup: () => void;
  onSelesai: () => void;
}) {
  const toast = useToast();
  const [nominal, setNominal] = useState("");
  const [tanggal, setTanggal] = useState(hariIni());
  const [sibuk, setSibuk] = useState(false);

  /* Diisi ulang tiap kali dialog dibuka untuk tahap lain. */
  useEffect(() => {
    if (!bayar) return;
    setNominal(bayar.t.nominal ? bayar.t.nominal.toLocaleString("id-ID") : "");
    setTanggal(hariIni());
  }, [bayar?.p.id, bayar?.t.tahap]);

  async function catat() {
    if (!bayar) return;
    setSibuk(true);
    try {
      const n = angkaDari(nominal);
      await bayarTahap({
        projectTeamId: bayar.p.id,
        tahap: bayar.t.tahap,
        ...(n && n !== bayar.t.nominal ? { amount: n } : {}),
        paidOn: tanggal || null,
      });
      toast({
        judul: `Bayaran ${bayar.p.teamMemberName} dicatat`,
        keterangan: `${formatRupiah(n || bayar.t.nominal || 0)} masuk sebagai biaya proyek ${bayar.p.projectTitle}.`,
        nada: "sukses",
      });
      onTutup();
      onSelesai();
    } catch (e) {
      toast({ judul: "Gagal mencatat bayaran", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setSibuk(false);
    }
  }

  return (
    <Dialog
      open={bayar !== null}
      onOpenChange={(o) => !o && onTutup()}
      title={bayar ? `Bayar tahap ${bayar.t.tahap === "awal" ? "awal" : "akhir"} — ${bayar.p.teamMemberName}` : "Bayar"}
      description={
        bayar
          ? `${LABEL_PERAN[bayar.p.role]} · ${bayar.p.projectTitle}`
          : undefined
      }
      footer={
        <>
          <Tombol ukuran="medium" jenis="ghost" onClick={onTutup} disabled={sibuk}>
            Batal
          </Tombol>
          <Tombol ukuran="medium" jenis="primary" onClick={catat} disabled={sibuk || !angkaDari(nominal)} memuat={sibuk}>
            Catat bayaran
          </Tombol>
        </>
      }
    >
      <div className="sat__dialogisi">
        {bayar?.t.keadaan === "menunggu" && (
          <p className="tim__catatan">
            {bayar.t.tahap === "awal"
              ? "DP klien belum masuk — dibayar lebih awal."
              : "Desain belum Finish — dibayar lebih awal."}
          </p>
        )}
        <div className="sat__dialogdua">
          <IsianTempel
            label="Nominal"
            kiri="Rp"
            inputMode="numeric"
            value={nominal}
            onChange={(e) => setNominal(titikRibuan(e.currentTarget.value))}
            bantu={bayar?.t.nominal ? `Sesuai hitungan: ${formatRupiah(bayar.t.nominal)}` : undefined}
          />
          <IsianTanggal label="Tanggal bayar" nilai={tanggal} onUbah={setTanggal} bisaKosong={false} />
        </div>
      </div>
    </Dialog>
  );
}
