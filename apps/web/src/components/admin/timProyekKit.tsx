import { useEffect, useRef, useState } from "react";
import { KepalaSeksi } from "../kit/Item";
import { Tabel, type KolomTabel } from "../kit/Tabel";
import { Lencana } from "../kit/Lencana";
import { Tombol } from "../kit/Tombol";
import { Dialog } from "../kit/Overlay";
import { useToast } from "../kit/Toast";
import { IsianPanjang, IsianTanggal, IsianTempel, KelompokIsian, PilihMenu } from "../kit/Formulir";
import { NotePencil, Plus } from "../kit/ikon";
import {
  daftarTimProyek, daftarTim, tambahTimProyek, ubahTimProyek, hapusTimProyek, bayarTahap, simpanProyek, daftarPaket,
  bacaCache, tulisCache, LABEL_PERAN, URUTAN_PERAN,
  type Proyek, type PenugasanTim, type AnggotaTim, type PeranTim, type TahapBayaran, type Paket,
} from "../../lib/admin";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";
import { jagaFokusSesudahHapus } from "../../lib/fokus";
import { PilihPaket } from "./pilihPaket";

/* =============================================================================
   Tim & Bayaran di Satu Proyek — kolom "TEAM DESIGN" dan "TEAM DESIGN FEE"
   di Excel pemilik, dihitung alih-alih diketik.

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

/* --- Lingkup & tenggat ------------------------------------------------------ */

export function LingkupTenggat({ proyek, onBerubah }: { proyek: Proyek; onBerubah: () => void }) {
  const toast = useToast();
  const [buka, setBuka] = useState(false);
  const [f, setF] = useState({ client: "", scope: "", preview: "", final: "", tierId: "" });
  const [menyimpan, setMenyimpan] = useState(false);
  const [paket, setPaket] = useState<Paket[]>([]);
  useEffect(() => {
    daftarPaket().then(setPaket).catch(() => setPaket([]));
  }, []);
  const paketIni = paket.find((p) => p.id === proyek.tierId) ?? null;

  function bukaDialog() {
    setF({
      tierId: proyek.tierId ?? "",
      client: proyek.client ?? "",
      scope: proyek.scopeOfWork ?? "",
      preview: proyek.deadlinePreview ?? "",
      final: proyek.deadlineFinal ?? "",
    });
    setBuka(true);
  }
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
      setBuka(false);
      onBerubah();
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenyimpan(false);
    }
  }

  const sisa = (iso?: string | null) => {
    if (!iso) return null;
    const hari = Math.round((Date.parse(`${iso}T00:00:00`) - Date.parse(`${hariIni()}T00:00:00`)) / 86_400_000);
    return hari < 0 ? `lewat ${-hari} hari` : hari === 0 ? "hari ini" : `${hari} hari lagi`;
  };

  return (
    <article className="sat__w sat__lingkup">
      <KepalaSeksi
        judul="Lingkup & Tenggat"
        kanan={
          <Tombol ukuran="medium" jenis="ghost" kiri={NotePencil} onClick={bukaDialog}>
            Ubah
          </Tombol>
        }
      />
      <dl className="sat__lingkupfakta">
        <div>
          <dt>Klien</dt>
          <dd>{proyek.client || <span className="sat__redup">Belum diisi</span>}</dd>
        </div>
        <div>
          <dt>Paket</dt>
          <dd>
            {paketIni ? (
              <>
                {paketIni.name} <span className="sat__redup">· Rp{paketIni.feeMin}–{paketIni.feeMax} jt</span>
              </>
            ) : (
              <span className="sat__redup">Tanpa paket</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Preview</dt>
          <dd>
            {proyek.deadlinePreview ? (
              <>
                {tanggalPendek(proyek.deadlinePreview)} <span className="sat__redup">· {sisa(proyek.deadlinePreview)}</span>
              </>
            ) : (
              <span className="sat__redup">—</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Final</dt>
          <dd>
            {proyek.deadlineFinal ? (
              <>
                {tanggalPendek(proyek.deadlineFinal)} <span className="sat__redup">· {sisa(proyek.deadlineFinal)}</span>
              </>
            ) : (
              <span className="sat__redup">—</span>
            )}
          </dd>
        </div>
        <div className="sat__lingkuplebar">
          <dt>Lingkup kerja</dt>
          <dd>{proyek.scopeOfWork || <span className="sat__redup">Belum diisi — tekan Ubah.</span>}</dd>
        </div>
      </dl>

      <Dialog
        open={buka}
        onOpenChange={setBuka}
        title="Lingkup & tenggat"
        footer={
          <>
            <Tombol ukuran="medium" jenis="ghost" onClick={() => setBuka(false)} disabled={menyimpan}>
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
    </article>
  );
}

/* --- Tim & bayaran ----------------------------------------------------------- */

type Ubah = { mode: "baru" } | { mode: "ubah"; p: PenugasanTim };

export function TimDanBayaran({
  proyek,
  onBerubah,
  onJatuhTempo,
}: {
  proyek: Proyek;
  onBerubah: () => void;
  /** Jumlah tahap yang sudah jatuh tempo — dipakai penanda di bilah atas,
   *  karena seksi ini duduk di bawah lipatan kartu rincian. */
  onJatuhTempo?: (n: number) => void;
}) {
  const toast = useToast();
  const kunci = `tim-proyek:${proyek.id}`;
  const [daftar, setDaftar] = useState<PenugasanTim[] | null>(() => bacaCache<PenugasanTim[]>(kunci));
  const [anggota, setAnggota] = useState<AnggotaTim[]>([]);
  const [bayar, setBayar] = useState<PilihanBayar | null>(null);
  const [ubah, setUbah] = useState<Ubah | null>(null);
  const [form, setForm] = useState({ role: "drafter" as PeranTim, orang: "", pct: "" });
  const [sibuk, setSibuk] = useState(false);
  const pembuka = useRef<HTMLElement | null>(null);

  function muat() {
    daftarTimProyek(proyek.id)
      .then((d) => {
        tulisCache(kunci, d);
        setDaftar(d);
      })
      .catch(() => setDaftar((l) => l ?? []));
  }
  useEffect(() => {
    setDaftar(bacaCache<PenugasanTim[]>(kunci));
    muat();
  }, [proyek.id]);
  useEffect(() => {
    daftarTim().then(setAnggota).catch(() => setAnggota([]));
  }, []);

  const segar = () => {
    muat();
    onBerubah();
  };

  const isi = daftar ?? [];
  const hak = isi.reduce((n, p) => n + (p.hak ?? 0), 0);
  const dibayar = isi.reduce((n, p) => n + p.dibayar, 0);
  const jatuhTempo = isi.flatMap((p) => p.tahap).filter((t) => t.keadaan === "jatuh_tempo");
  useEffect(() => {
    onJatuhTempo?.(jatuhTempo.length);
  }, [jatuhTempo.length]);

  function bukaUbah(u: Ubah) {
    pembuka.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (u.mode === "ubah") setForm((f) => ({ ...f, role: u.p.role, orang: u.p.teamMemberId, pct: pctTeks(u.p.pct) }));
    else setForm((f) => ({ ...f, role: "drafter", orang: "", pct: "" }));
    setUbah(u);
  }
  const pctForm = persenDari(form.pct);
  const pctSalah = pctForm !== null && (!Number.isFinite(pctForm) || pctForm < 0 || pctForm > 100);
  async function simpanUbah() {
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
      setUbah(null);
      segar();
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
      /* Baris terakhir tabel ikut lenyap bersama tombol nama yang membuka
         dialog ini — fokus papan ketik dijaga lewat lib/fokus (jebakan #39). */
      await jagaFokusSesudahHapus(pembuka.current, async () => {
        await hapusTimProyek(id);
        toast({ judul: "Penugasan dihapus", nada: "sukses" });
        setUbah(null);
        const d = await daftarTimProyek(proyek.id);
        tulisCache(kunci, d);
        setDaftar(d);
        onBerubah();
      });
      /* Cadangan lib/fokus adalah kontrol SESUDAH pemicunya — di baris
         terakhir itu sel tahap baris yang sama, yang ikut lenyap. Jadi kalau
         fokus tetap jatuh ke <body>, pindahkan ke nama terakhir yang tersisa,
         atau ke tombol Tugaskan kalau timnya kini kosong. */
      if (document.activeElement === document.body) {
        const seksi = document.getElementById("tim-bayaran");
        const nama = seksi?.querySelectorAll<HTMLElement>(".tim__nama");
        (nama?.length ? nama[nama.length - 1] : seksi?.querySelector<HTMLElement>(".tim__tugaskan"))?.focus();
      }
    } catch (e) {
      /* 409: sudah ada bayaran tercatat — kalimat API-nya yang ditampilkan. */
      toast({ judul: "Tidak bisa dihapus", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setSibuk(false);
    }
  }

  const kolom: KolomTabel[] = [
    { judul: "Peran", lebar: 84 },
    { judul: "Orang", lebar: 150 },
    { judul: "Bagian", lebar: 64, kanan: true },
    { judul: "Hak", lebar: 104, kanan: true },
    { judul: "Tahap awal (DP)", lebar: 152 },
    { judul: "Tahap akhir", lebar: 152 },
  ];
  const baris = isi.map((p) => [
    LABEL_PERAN[p.role],
    <button type="button" className="tim__nama" onClick={() => bukaUbah({ mode: "ubah", p })}>
      {p.teamMemberName}
    </button>,
    p.pctBerlaku === null ? <span className="sat__redup">—</span> : `${pctTeks(p.pctBerlaku)}%`,
    p.hak === null ? <span className="sat__redup" title="Persen peran ini belum ditentukan">—</span> : <b>{formatRupiah(p.hak)}</b>,
    <SelTahap p={p} jenis="awal" onBayar={(t) => setBayar({ p, t })} />,
    <SelTahap p={p} jenis="akhir" onBayar={(t) => setBayar({ p, t })} />,
  ]);

  const orangDipakai = (o: AnggotaTim) =>
    isi.some((p) => p.role === form.role && p.teamMemberId === o.id && (ubah?.mode !== "ubah" || p.id !== ubah.p.id));

  return (
    <article className="sat__w sat__timbayar" id="tim-bayaran">
      <KepalaSeksi
        judul="Tim & Bayaran"
        kanan={
          <Tombol ukuran="medium" jenis="ghost" kiri={Plus} className="tim__tugaskan" onClick={() => bukaUbah({ mode: "baru" })}>
            Tugaskan
          </Tombol>
        }
      />
      {isi.length > 0 && (
        <p className="tim__ringkas">
          Hak tim <b>{formatRupiah(hak)}</b> · dibayar {formatRupiah(dibayar)} · terutang <b>{formatRupiah(hak - dibayar)}</b>
          {jatuhTempo.length > 0 && (
            <Lencana nada="menunggu" className="tim__jatuh">
              {jatuhTempo.length} tahap jatuh tempo
            </Lencana>
          )}
        </p>
      )}
      {daftar === null ? (
        <p className="sat__kosong">Memuat tim…</p>
      ) : isi.length === 0 ? (
        <p className="sat__kosong">
          Belum ada yang ditugaskan. Tugaskan Leader, Drafter, Render, atau Estimator — bagiannya dihitung dari fee
          design {proyek.contractValue ? formatRupiah(proyek.contractValue) : "proyek ini"}.
        </p>
      ) : (
        <div className="sat__tabel tim__tabel">
          <Tabel kolom={kolom} baris={baris} kepala="mint" pad={12} tinggiKepala={37} tinggiBaris={56} fontBaris={12} />
        </div>
      )}

      <DialogBayar bayar={bayar} onTutup={() => setBayar(null)} onSelesai={segar} />

      <Dialog
        open={ubah !== null}
        onOpenChange={(o) => !o && setUbah(null)}
        title={ubah?.mode === "ubah" ? `${LABEL_PERAN[ubah.p.role]} — ${ubah.p.teamMemberName}` : "Tugaskan anggota tim"}
        footer={
          <>
            {ubah?.mode === "ubah" && (
              <Tombol ukuran="medium" jenis="bahaya" onClick={hapus} disabled={sibuk} className="tim__hapus">
                Hapus penugasan
              </Tombol>
            )}
            <Tombol ukuran="medium" jenis="ghost" onClick={() => setUbah(null)} disabled={sibuk}>
              Batal
            </Tombol>
            <Tombol ukuran="medium" jenis="primary" onClick={simpanUbah} disabled={sibuk || !form.orang || pctSalah} memuat={sibuk}>
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
            <p className="tim__catatan">
              Sudah dibayar {formatRupiah(ubah.p.dibayar)}.
            </p>
          )}
        </div>
      </Dialog>
    </article>
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
