import { useEffect, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { Balok } from "../ui/Skeleton";
import { KartuAngka } from "../ui/data/KartuAngka";
import { KartuDonat, type IrisDonat } from "../ui/data/KartuDonat";
import { DataTable, type Kolom } from "../ui/data/DataTable";
import { RequireAuth } from "./RequireAuth";
import { Select } from "../ui/overlay/Select";
import {
  feePerProyek, feePerOrang, bacaCache, tulisCache, LABEL_JENIS_ANGGOTA,
  type FeeProyek, type FeeOrang,
} from "../../lib/admin";
import { formatRupiah } from "../../lib/format";
import { unduhCsv } from "../../lib/csv";

/**
 * Halaman Fee Proyek — "pembagian fee untuk arsitek" yang diminta pemilik.
 *
 * Yang dijawabnya cuma dua pertanyaan, dan keduanya tidak pernah bisa dijawab
 * sebelum ada kolom penaut di `project_costs`:
 *
 *   PER ORANG  — orang ini sudah terima berapa, dari berapa proyek.
 *   PER PROYEK — proyek ini menghabiskan berapa untuk orang, dan berapa
 *                porsinya terhadap nilai kontrak.
 *
 * Halaman ini TIDAK PERNAH MENULIS apa pun. Fee diketik satu kali saja, di
 * Keuangan → Catat pengeluaran, dan di sini cuma dibaca. Itu aturan yang sama
 * yang menjaga beban studio tidak tercatat dua kali — kalau halaman ini punya
 * tombol simpan sendiri, nominal yang sama bisa masuk dari dua pintu.
 */

type Tab = "orang" | "proyek";

/* Rentang siap pakai. Bukan pemilih tanggal bebas: pertanyaan yang benar-benar
   muncul selalu "tahun ini" atau "bulan ini", dan dua kotak tanggal untuk itu
   berarti empat ketukan sebelum satu angka terbaca. */
const RENTANG: { value: string; label: string }[] = [
  { value: "semua", label: "Sepanjang waktu" },
  { value: "tahun", label: "Tahun ini" },
  { value: "bulan", label: "Bulan ini" },
];

function batas(r: string): { dari?: string; sampai?: string } {
  const kini = new Date();
  const y = kini.getFullYear();
  if (r === "tahun") return { dari: `${y}-01-01`, sampai: `${y}-12-31` };
  if (r === "bulan") {
    const m = String(kini.getMonth() + 1).padStart(2, "0");
    // Hari terakhir bulan ini: tanggal 0 bulan BERIKUTNYA. Menghitungnya
    // sendiri dari tabel jumlah hari adalah cara paling mudah salah di Februari.
    const akhir = new Date(y, kini.getMonth() + 1, 0).getDate();
    return { dari: `${y}-${m}-01`, sampai: `${y}-${m}-${akhir}` };
  }
  return {};
}

function tanggalPendek(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function persen(v: number | null): string {
  if (v === null) return "—";
  return `${(v * 100).toFixed(1).replace(".", ",")}%`;
}

/* Empat terbesar, sisanya dijumlahkan jadi satu irisan "lainnya".
   Empat karena donat dengan sepuluh irisan tipis tidak menjawab apa pun —
   yang ditanyakan "siapa yang paling besar", bukan "berapa bagian tiap
   orang sampai desimal". Dan empat, bukan lima, karena token warna
   kategori cuma ada sampai --chart-cat-5 dan irisan "lainnya" butuh satu
   untuk dirinya sendiri; menulis --chart-cat-6 tidak memberi galat apa pun
   — warnanya sekadar tidak ada, dan irisannya hilang tanpa satu pun tanda.

   Sisanya TIDAK dibuang: donat yang jumlah irisannya tidak sama dengan
   totalnya adalah gambar yang berbohong. */
function irisTeratas(
  daftar: { label: string; nilai: number }[],
  satuanSisa: string,
): IrisDonat[] {
  const urut = [...daftar].filter((d) => d.nilai > 0).sort((a, b) => b.nilai - a.nilai);
  const atas = urut.slice(0, 4);
  const sisa = urut.slice(4).reduce((a, o) => a + o.nilai, 0);
  const d: IrisDonat[] = atas.map((o, i) => ({
    label: o.label, nilai: o.nilai, warna: `var(--chart-cat-${i + 1})`,
  }));
  if (sisa > 0) {
    d.push({
      label: `${urut.length - 4} ${satuanSisa} lainnya`,
      nilai: sisa,
      warna: "var(--chart-cat-5)",
    });
  }
  return d;
}

function Isi() {
  const [tab, setTab] = useState<Tab>("orang");
  const [rentang, setRentang] = useState("semua");
  const [orang, setOrang] = useState<FeeOrang[] | null>(() => bacaCache<FeeOrang[]>("feeorang"));
  const [proyek, setProyek] = useState<FeeProyek[] | null>(() => bacaCache<FeeProyek[]>("feeproyek"));

  useEffect(() => {
    const r = batas(rentang);
    /* Cache hanya dipakai untuk rentang bawaan. Menyimpan hasil "bulan ini"
       di bawah kunci yang sama membuat kunjungan berikutnya menampilkan angka
       sebulan sebagai angka sepanjang waktu — dan angka uang yang salah tanpa
       tanda adalah yang paling mahal. */
    const simpan = rentang === "semua";
    feePerOrang(r).then((d) => { if (simpan) tulisCache("feeorang", d); setOrang(d); })
      .catch(() => setOrang((l) => l ?? []));
    feePerProyek(r).then((d) => { if (simpan) tulisCache("feeproyek", d); setProyek(d); })
      .catch(() => setProyek((l) => l ?? []));
  }, [rentang]);

  const irisOrang = useMemo<IrisDonat[]>(
    () => irisTeratas((orang ?? []).map((o) => ({ label: o.name, nilai: o.total })), "orang"),
    [orang],
  );

  /* Yang dipakai feeTotal, bukan jumlah orangnya: fee yang belum bernama
     tetap uang yang keluar untuk proyek itu, dan donat yang membuangnya
     akan berbeda dari kartu angka di atasnya tanpa alasan yang kelihatan. */
  const irisProyek = useMemo<IrisDonat[]>(
    () => irisTeratas((proyek ?? []).map((p) => ({ label: p.projectTitle, nilai: p.feeTotal })), "proyek"),
    [proyek],
  );

  const ringkas = useMemo(() => {
    const totalOrang = (orang ?? []).reduce((a, o) => a + o.total, 0);
    const tanpaNama = (proyek ?? []).reduce((a, p) => a + p.feeTanpaNama, 0);
    /* Dijumlahkan dari feeTotal, BUKAN totalOrang + tanpaNama. Keduanya
       seharusnya sama, tapi biaya bernama yang orangnya sudah dihapus
       (on delete set null) hilang dari daftar per orang sementara tetap
       tercatat di proyeknya — dan kaki donat proyek harus sama dengan
       jumlah irisannya sendiri, bukan dengan angka dari daftar lain. */
    const totalProyek = (proyek ?? []).reduce((a, p) => a + p.feeTotal, 0);
    return { totalOrang, tanpaNama, totalProyek, jumlahOrang: (orang ?? []).length };
  }, [orang, proyek]);

  const kolomOrang: Kolom<FeeOrang>[] = [
    {
      judul: "Nama",
      render: (o) => (
        <span style={{ minWidth: 0, display: "block" }}>
          <span className="item__title">{o.name}</span>
          <div className="attachment__size">{o.role ?? LABEL_JENIS_ANGGOTA[o.kind]}</div>
        </span>
      ),
    },
    {
      judul: "Jenis", lebar: "7rem",
      render: (o) => <span className="badge">{LABEL_JENIS_ANGGOTA[o.kind]}</span>,
    },
    {
      judul: "Proyek", kelas: "table__num", lebar: "5rem",
      render: (o) => <span className="t-mono">{o.projectCount}</span>,
    },
    { judul: "Terakhir", lebar: "8rem", render: (o) => tanggalPendek(o.lastOn) },
    {
      judul: "Total diterima", kelas: "table__num", lebar: "9rem",
      render: (o) => formatRupiah(o.total),
    },
  ];

  const kolomProyek: Kolom<FeeProyek>[] = [
    {
      judul: "Proyek",
      render: (p) => (
        <span style={{ minWidth: 0, display: "block" }}>
          <span className="item__title">{p.projectTitle}</span>
          {/* Nama-namanya ikut tercetak di bawah judul proyek. Tanpa ini,
              satu-satunya cara tahu siapa yang dibayar di sebuah proyek
              adalah membuka tab sebelah dan mencocokkan sendiri. */}
          <div className="attachment__size">
            {p.orang.length === 0
              ? "belum ada fee bernama"
              : p.orang.map((o) => `${o.name} (${formatRupiah(o.amount)})`).join(" · ")}
          </div>
        </span>
      ),
    },
    {
      judul: "Nilai kontrak", kelas: "table__num", lebar: "9rem",
      render: (p) => (p.contractValue === null
        ? <span className="t-faint">belum diisi</span>
        : formatRupiah(p.contractValue)),
    },
    {
      judul: "Fee bernama", kelas: "table__num", lebar: "9rem",
      render: (p) => formatRupiah(p.feeTotal),
    },
    {
      judul: "Tanpa nama", kelas: "table__num", lebar: "9rem",
      /* Amber, bukan merah: ini bukan kesalahan melainkan data lama yang
         memang belum punya kolom penautnya. Yang dinyatakan cuma "angka ini
         tidak masuk hitungan per orang". */
      render: (p) => (p.feeTanpaNama > 0
        ? <span className="badge badge--warn" title="Biaya fee yang belum ditautkan ke nama siapa pun — tidak ikut terhitung di tab Per Orang">
            {formatRupiah(p.feeTanpaNama)}
          </span>
        : <span className="t-faint">—</span>),
    },
    {
      judul: "Porsi fee", kelas: "table__num", lebar: "6rem",
      render: (p) => (p.feeShare === null
        ? <span className="t-faint" title="Nilai kontrak belum diisi, jadi porsinya belum bisa dihitung">—</span>
        : persen(p.feeShare)),
    },
  ];

  function ekspor() {
    const tanda = new Date().toISOString().slice(0, 10);
    if (tab === "orang") {
      unduhCsv(`fee-per-orang-${tanda}.csv`, [
        ["Nama", "Jenis", "Peran", "Jumlah proyek", "Terakhir", "Total diterima"],
        ...(orang ?? []).map((o) => [
          o.name, LABEL_JENIS_ANGGOTA[o.kind], o.role ?? "",
          String(o.projectCount), o.lastOn ?? "", String(o.total),
        ]),
      ]);
    } else {
      unduhCsv(`fee-per-proyek-${tanda}.csv`, [
        ["Proyek", "Nilai kontrak", "Fee bernama", "Fee tanpa nama", "Porsi fee %", "Penerima"],
        ...(proyek ?? []).map((p) => [
          p.projectTitle,
          p.contractValue === null ? "" : String(p.contractValue),
          String(p.feeTotal), String(p.feeTanpaNama),
          p.feeShare === null ? "" : (p.feeShare * 100).toFixed(2),
          p.orang.map((o) => `${o.name}:${o.amount}`).join("; "),
        ]),
      ]);
    }
  }

  const tombolEkspor = (
    <button type="button" className="btn btn--secondary" onClick={ekspor}>
      <Icon name="download" size={15} />Export
    </button>
  );

  const pilihRentang = (
    <div className="field">
      <label className="field__label">Rentang waktu</label>
      <Select ariaLabel="Rentang waktu" options={RENTANG} value={rentang} onValueChange={setRentang} />
    </div>
  );

  if (orang === null || proyek === null) {
    return (
      <div className="keu" aria-hidden="true">
        <div className="kangka-deret">
          <div className="skeleton skeleton--tunda keu__rangka-kartu" />
          <div className="skeleton skeleton--tunda keu__rangka-kartu" />
          <div className="skeleton skeleton--tunda keu__rangka-kartu" />
        </div>
        <Balok tinggi="3rem" style={{ borderRadius: "var(--radius-sm)" }} />
        <Balok tinggi="18rem" style={{ borderRadius: "var(--radius-sm)" }} />
      </div>
    );
  }

  return (
    <div className="keu">
      <div className="kangka-deret">
        <KartuAngka
          label="Fee terbayar" nilai={formatRupiah(ringkas.totalOrang)} ikon="cash"
          delta={RENTANG.find((r) => r.value === rentang)?.label.toLowerCase()} deltaNada="netral"
        />
        <KartuAngka
          label="Orang yang dibayar" nilai={String(ringkas.jumlahOrang)} ikon="team"
          delta="punya biaya bernama" deltaNada="netral"
        />
        <KartuAngka
          label="Belum bernama" nilai={formatRupiah(ringkas.tanpaNama)} ikon="receipt"
          delta={ringkas.tanpaNama > 0 ? "tidak ikut terhitung per orang" : "semua fee sudah bernama"}
          deltaNada="netral"
        />
      </div>

      {/* Dua donat yang mencerminkan dua tab di bawahnya: siapa yang
          menerima, dan proyek mana yang mengeluarkannya. Hanya muncul kalau
          ADA yang digambar — donat kosong berbentuk cincin abu yang
          menanyakan sendiri kenapa ia ada di situ. */}
      {(irisOrang.length > 0 || irisProyek.length > 0) && (
        <div className="keu__baris2 keu__baris2--rata">
          <KartuDonat
            judul="Penerima terbesar"
            subjudul={RENTANG.find((r) => r.value === rentang)?.label}
            iris={irisOrang}
            format={(n) => formatRupiah(n)}
            kakiLabel="Total fee bernama"
            kakiNilai={formatRupiah(ringkas.totalOrang)}
          />
          <KartuDonat
            judul="Dari proyek mana"
            subjudul={RENTANG.find((r) => r.value === rentang)?.label}
            iris={irisProyek}
            format={(n) => formatRupiah(n)}
            kakiLabel="Total fee keluar"
            kakiNilai={formatRupiah(ringkas.totalProyek)}
          />
        </div>
      )}

      <div className="keu__bar">
        <div className="segmented segmented--kotak" role="group" aria-label="Tampilan Fee">
          <button type="button" className="segmented__opt" aria-pressed={tab === "orang"}
            onClick={() => setTab("orang")}>
            <Icon name="team" size={16} />Per Orang
          </button>
          <button type="button" className="segmented__opt" aria-pressed={tab === "proyek"}
            onClick={() => setTab("proyek")}>
            <Icon name="project" size={16} />Per Proyek
          </button>
        </div>
      </div>

      {tab === "orang" ? (
        <DataTable
          data={orang}
          kunci={(o) => o.teamMemberId}
          kolom={kolomOrang}
          cariPada={(o) => [o.name, o.role, LABEL_JENIS_ANGGOTA[o.kind]]}
          placeholderCari="Cari nama atau peran…"
          labelCari="Cari orang"
          satuan="orang"
          barisSkeleton={5}
          bentuk="kartu"
          aksi={tombolEkspor}
          saringan={pilihRentang}
          bersihkanAktif={rentang !== "semua"}
          onBersihkan={() => setRentang("semua")}
          kosong={{
            ikon: "team",
            judul: "Belum ada fee yang bernama",
            keterangan: "Fee muncul di sini setelah pengeluaran berkategori Freelancer atau Prinsipal dicatat dengan nama penerimanya, di Keuangan → Catat pengeluaran.",
          }}
        />
      ) : (
        <DataTable
          data={proyek}
          kunci={(p) => p.projectId}
          kolom={kolomProyek}
          cariPada={(p) => [p.projectTitle, ...p.orang.map((o) => o.name)]}
          placeholderCari="Cari proyek atau nama penerima…"
          labelCari="Cari proyek"
          satuan="proyek"
          barisSkeleton={4}
          bentuk="kartu"
          aksi={tombolEkspor}
          saringan={pilihRentang}
          bersihkanAktif={rentang !== "semua"}
          onBersihkan={() => setRentang("semua")}
          kosong={{
            ikon: "finance",
            judul: "Belum ada fee tercatat",
            keterangan: "Catat pengeluaran berkategori Freelancer atau Prinsipal di Keuangan, lalu proyeknya muncul di sini.",
          }}
        />
      )}
    </div>
  );
}

export function FeePanel() {
  return (
    <RequireAuth skeleton={<div className="keu"><Balok tinggi="20rem" /></div>}>
      <Isi />
    </RequireAuth>
  );
}
