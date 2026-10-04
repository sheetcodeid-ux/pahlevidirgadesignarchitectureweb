/**
 * Dua PDF berkop studio untuk SATU proyek: rincian biaya (internal) dan
 * daftar tagihan (untuk klien).
 *
 * Keduanya SEMPAT HILANG dari panel sejak Keuangan pindah ke kit (P4):
 * tombolnya tinggal di `PanelKeuangan` milik editor proyek lama, yang cuma
 * dipasang `FinancePanel` — dan FinancePanel tidak lagi diimpor halaman mana
 * pun. `lib/pdf.ts` tetap utuh sepanjang waktu itu, tanpa satu pun pemanggil.
 *
 * Isi dokumennya dibawa apa adanya dari editor lama (judul, kolom,
 * ringkasan, catatan kaki); yang baru cuma: datanya diambil SEGAR saat
 * tombolnya ditekan, bukan dari keadaan halaman — PDF yang dikirim ke klien
 * tidak boleh memuat angka basi dari cache.
 */
import { unduhPdf } from "./pdf";
import { ambilSettings, daftarBiaya, daftarInvoice, type Proyek, type SlipGaji } from "./admin";
import { formatRupiah } from "./format";

/* Label enum database. Sama dengan kamus di halaman kit Keluar dan Tagihan;
   ditulis di sini karena dokumen ini berdiri sendiri dan tidak memuat
   komponen halaman mana pun. */
const KATEGORI_BIAYA: Record<string, string> = {
  freelancer: "Freelancer",
  operasional: "Operasional",
  prinsipal: "Prinsipal",
  lainnya: "Lainnya",
};
const STATUS_TAGIHAN: Record<string, string> = { draft: "Draf", terbit: "Terbit", lunas: "Lunas" };

/** Rincian biaya (HPP) proyek, dengan margin. Dokumen INTERNAL. */
export async function unduhRincianBiaya(proyek: Proyek): Promise<string> {
  const [studio, biaya] = await Promise.all([ambilSettings(), daftarBiaya(proyek.id)]);
  const totalBiaya = biaya.reduce((s, b) => s + b.amount, 0);
  const kontrak = proyek.contractValue ?? 0;
  const marginPct = kontrak > 0 ? ((kontrak - totalBiaya) / kontrak) * 100 : null;
  return unduhPdf(
    {
      judul: "Rincian Biaya Proyek",
      namaProyek: proyek.title,
      kolomTengah: "Kategori",
      baris: biaya.map((b) => ({
        label: b.label,
        keterangan: KATEGORI_BIAYA[b.category] ?? b.category,
        nominal: b.amount,
      })),
      ringkasan: [
        ...(kontrak > 0 ? [{ label: "Nilai kontrak", nilai: formatRupiah(kontrak) }] : []),
        { label: "Total biaya", nilai: formatRupiah(totalBiaya), tebal: true },
        ...(marginPct !== null
          ? [{ label: "Margin", nilai: `${formatRupiah(kontrak - totalBiaya)} (${marginPct.toFixed(0)}%)` }]
          : []),
      ],
      catatan: "Dokumen internal studio. Berisi biaya dan margin — tidak untuk dibagikan ke klien.",
    },
    studio,
  );
}

/** Daftar tagihan (termin) proyek. Boleh dikirim ke klien. */
export async function unduhDaftarTagihan(proyek: Proyek): Promise<string> {
  const [studio, tagihan] = await Promise.all([ambilSettings(), daftarInvoice(proyek.id)]);
  const total = tagihan.reduce((s, i) => s + i.amount, 0);
  const lunas = tagihan.filter((i) => i.status === "lunas").reduce((s, i) => s + i.amount, 0);
  return unduhPdf(
    {
      judul: "Daftar Tagihan",
      namaProyek: proyek.title,
      kolomTengah: "Status",
      baris: tagihan.map((i) => ({
        label: i.label,
        keterangan: STATUS_TAGIHAN[i.status] ?? i.status,
        nominal: i.amount,
      })),
      ringkasan: [
        { label: "Total tagihan", nilai: formatRupiah(total), tebal: true },
        { label: "Sudah dibayar", nilai: formatRupiah(lunas) },
        { label: "Sisa", nilai: formatRupiah(total - lunas) },
      ],
      catatan: studio.phone ? `Pembayaran dan pertanyaan tagihan: ${studio.phone}` : undefined,
    },
    studio,
  );
}

/* --- Slip gaji ---------------------------------------------------------------
   Pengganti sheet "GAJI <nama>" di Excel. Dibuat dari data yang sama dengan
   halaman Gaji, jadi labelnya tidak bisa lagi tertinggal nama orang lain
   ("TOTAL BONUS DANY" di sheet Raffi). */

const PERAN_PDF: Record<string, string> = { leader: "Leader", drafter: "Drafter", render: "Render", estimator: "Estimator" };
const TAHAP_PDF: Record<string, string> = { awal: "tahap awal", akhir: "tahap akhir" };

/** Keterangan satu baris fee: "Drafter 10% · tahap awal" atau label aslinya. */
export function keteranganFee(f: SlipGaji["fees"][number]): string {
  if (!f.role) return f.label;
  const pct = f.pct === null ? "" : ` ${f.pct.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;
  return `${PERAN_PDF[f.role]}${pct}${f.payoutStage ? ` · ${TAHAP_PDF[f.payoutStage]}` : ""}`;
}

export async function unduhSlipGaji(slip: SlipGaji, namaBulan: string): Promise<string> {
  const studio = await ambilSettings();
  const tgl = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  return unduhPdf(
    {
      judul: "Slip Gaji",
      namaProyek: `${slip.name} · ${namaBulan}`,
      kolomTengah: "Keterangan",
      baris: [
        ...(slip.salary
          ? [{
              label: "Gaji pokok",
              keterangan: slip.salary.paidOn ? `Dibayar ${tgl(slip.salary.paidOn)}` : "Belum dibayar",
              nominal: slip.salary.amount,
            }]
          : []),
        ...slip.fees.map((f) => ({
          label: `Fee ${f.projectTitle}`,
          keterangan: `${keteranganFee(f)} · ${tgl(f.incurredOn)}`,
          nominal: f.amount,
        })),
      ],
      ringkasan: [
        { label: "Gaji pokok", nilai: formatRupiah(slip.salaryAmount) },
        { label: "Fee proyek", nilai: formatRupiah(slip.feeAmount) },
        { label: "Total", nilai: formatRupiah(slip.total), tebal: true },
      ],
      catatan: "Fee proyek dihitung dari fee design proyek dikali persen peran, dibayar per tahap.",
    },
    studio,
  );
}
