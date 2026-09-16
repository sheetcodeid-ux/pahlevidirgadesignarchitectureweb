import { useEffect, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { Balok } from "../ui/Skeleton";
import { KartuAngka } from "../ui/data/KartuAngka";
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

  const ringkas = useMemo(() => {
    const totalOrang = (orang ?? []).reduce((a, o) => a + o.total, 0);
    const tanpaNama = (proyek ?? []).reduce((a, p) => a + p.feeTanpaNama, 0);
    return { totalOrang, tanpaNama, jumlahOrang: (orang ?? []).length };
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
