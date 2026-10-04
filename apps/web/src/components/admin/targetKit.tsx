import { useEffect, useState } from "react";
import { BarKemajuan } from "../kit/Ukuran";
import { Tombol } from "../kit/Tombol";
import { Dialog } from "../kit/Overlay";
import { useToast } from "../kit/Toast";
import { IsianTempel } from "../kit/Formulir";
import { bacaCache, kemajuanTarget, simpanTarget, tulisCache, type KemajuanTarget } from "../../lib/admin";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";

/* =============================================================================
   Target pemasukan per semester — "TARGET 1 MILIAR DALAM 6 BULAN" di sheet
   KELUAR MASUK.

   Satu sumber untuk Dashboard dan Kas Studio. Yang dihitung pemasukan, bukan
   laba (jawaban pemilik): pembayaran klien yang benar-benar diterima + kas
   studio arah masuk (penjualan PVC ikut). Angkanya dari API — halaman ini
   tidak menjumlahkan apa pun sendiri.
   ============================================================================= */

/** "2026-07-01" → "Jul–Des 2026". */
export function labelSemester(mulai: string): string {
  const [y, m] = mulai.split("-").map(Number);
  return m === 1 ? `Jan–Jun ${y}` : `Jul–Des ${y}`;
}

/** Semester sesudah `mulai`. */
export function semesterBerikut(mulai: string): string {
  const [y, m] = mulai.split("-").map(Number);
  return m === 1 ? `${y}-07-01` : `${y! + 1}-01-01`;
}

/**
 * Kemajuan semester berjalan, stale-while-revalidate seperti data panel lain.
 * Kunci cache-nya cuma ditulis di sini — pemakainya membaca lewat hook ini
 * (jebakan #8: yang menulis cache satu kunci hanya pemilik daftarnya).
 */
export function useKemajuanTarget(): [KemajuanTarget | null, () => void] {
  const [k, setK] = useState<KemajuanTarget | null>(() => bacaCache<KemajuanTarget>("target-semester"));
  function muat() {
    kemajuanTarget()
      .then((d) => {
        tulisCache("target-semester", d);
        setK(d);
      })
      .catch(() => {});
  }
  useEffect(muat, []);
  return [k, muat];
}

/** Persen capaian, dibatasi 0–100 untuk batangnya; teksnya boleh lewat 100. */
export function persenTarget(k: KemajuanTarget): number | null {
  if (!k.target) return null;
  return (k.tercapai / k.target) * 100;
}

/** Kalimat sisa: "kurang Rp461 jt · Rp154 jt/bln · 89 hari" — satu baris di Dashboard. */
export function kalimatSisa(k: KemajuanTarget): string {
  if (k.target === null) return "Belum ada target. Tetapkan di Kas Studio.";
  if (k.kurang === 0) return `Tercapai — lewat ${formatRupiahRingkas(k.tercapai - k.target)} dari target.`;
  if (k.sisaHari === 0) return `Semester selesai, kurang ${formatRupiahRingkas(k.kurang ?? 0)}.`;
  return [
    `kurang ${formatRupiahRingkas(k.kurang ?? 0)}`,
    k.perBulanDibutuhkan ? `${formatRupiahRingkas(k.perBulanDibutuhkan)}/bln` : null,
    `${k.sisaHari} hari`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Isi ringkas: angka, batang, satu kalimat sisa. Dipakai kartu Dashboard. */
export function RingkasTarget({ k }: { k: KemajuanTarget | null }) {
  const p = k ? persenTarget(k) : null;
  return (
    <div className="tgt">
      <p className="tgt__baris">
        <span>
          <b>{k ? formatRupiahRingkas(k.tercapai) : "—"}</b>{" "}
          <small>dari {k?.target ? formatRupiahRingkas(k.target) : "—"}</small>
        </span>
        <b>{p === null ? "—" : `${p.toFixed(1).replace(".", ",")}%`}</b>
      </p>
      <BarKemajuan bentuk="tumpuk" persen={Math.min(100, p ?? 0)} tinggi={8} judul="Pemasukan terhadap target semester" />
      <p className="tgt__sisa" title={k ? kalimatSisa(k) : undefined}>
        {k ? kalimatSisa(k) : "Memuat…"}
      </p>
    </div>
  );
}

/** Tetapkan / ganti target satu semester. */
export function DialogTarget({
  semester,
  nilai,
  onSelesai,
  pemicu,
}: {
  semester: string;
  nilai: number | null;
  onSelesai: () => void;
  pemicu: (buka: () => void) => React.ReactNode;
}) {
  const toast = useToast();
  const [buka, setBuka] = useState(false);
  const [jumlah, setJumlah] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const angka = Number(jumlah.replace(/\D/g, "")) || 0;

  function bukaDialog() {
    setJumlah(nilai ? nilai.toLocaleString("id-ID") : "");
    setBuka(true);
  }
  async function simpan() {
    setSibuk(true);
    try {
      await simpanTarget({ semesterStart: semester, amount: angka });
      toast({ judul: "Target disimpan", keterangan: `${labelSemester(semester)}: ${formatRupiah(angka)}`, nada: "sukses" });
      setBuka(false);
      onSelesai();
    } catch (e) {
      toast({ judul: "Gagal menyimpan target", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setSibuk(false);
    }
  }

  return (
    <>
      {pemicu(bukaDialog)}
      <Dialog
        open={buka}
        onOpenChange={setBuka}
        title={`Target ${labelSemester(semester)}`}
        footer={
          <>
            <Tombol ukuran="medium" jenis="ghost" onClick={() => setBuka(false)} disabled={sibuk}>
              Batal
            </Tombol>
            <Tombol ukuran="medium" jenis="primary" onClick={simpan} disabled={sibuk || angka <= 0} memuat={sibuk}>
              Simpan target
            </Tombol>
          </>
        }
      >
        <div className="tgt__dialog">
          <IsianTempel
            label="Target pemasukan"
            kiri="Rp"
            inputMode="numeric"
            placeholder="1.000.000.000"
            value={jumlah}
            onChange={(e) => {
              const d = e.currentTarget.value.replace(/\D/g, "");
              setJumlah(d ? Number(d).toLocaleString("id-ID") : "");
            }}
            bantu={angka > 0 ? `≈ ${formatRupiahRingkas(Math.ceil(angka / 6))} per bulan` : undefined}
          />
        </div>
      </Dialog>
    </>
  );
}
