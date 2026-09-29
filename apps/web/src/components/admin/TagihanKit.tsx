import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { Tabel, SelDua, type KolomTabel } from "../kit/Tabel";
import { Segmen } from "../kit/Segmen";
import { Paginasi } from "../kit/Paginasi";
import { Cari } from "../kit/Isian";
import { Tombol, TombolIkon } from "../kit/Tombol";
import { LencanaTren } from "../kit/Ukuran";
import { Ikon } from "../kit/Ikon";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import {
  CaretDown,
  Funnel,
  Plus,
  NavReceipt,
  CircleWavyCheck,
  WarningOctagon,
  ArrowRight,
} from "../kit/ikon";
import {
  semuaTagihan,
  ubahInvoice,
  daftarProyek,
  bacaCache,
  tulisCache,
  type Invoice,
  type Proyek,
} from "../../lib/admin";
import { setProyekAktif } from "../../lib/proyekAktif";
import { formatRupiah } from "../../lib/format";

/* =============================================================================
   Tagihan & Termin — frame Figma "16. Invoices".

   Bentuknya BEDA dari frame 13 walau sama-sama tabel: di sini tidak ada
   kartu besar yang membungkus tabelnya, kepala tabelnya berlatar mint
   penuh, dan di atasnya ada tiga kartu statistik.

   Pemetaannya:

     Coinest              Halaman ini
     ------------------   ---------------------------------------------------
     Total / Paid /       Total tagihan / Sudah lunas / Belum lunas
     Unpaid Invoices
     All/Paid/Unpaid/     `invoice_status`: Semua / Draf / Terbit / Lunas —
     Overdue (4 tab)      juga empat
     4 lencana status     Draf abu / Terbit mint / Lewat tenggat merah /
                          Lunas gelap
     Invoice Name         label termin + proyeknya di bawahnya
     Invoice ID           nomor termin (urutan dalam proyek), bukan uuid
     Total Amount         nominal
     Date & Time          tenggat + sisa hari
     Filter               proyek
     Add Invoice          buka proyeknya — termin DIBUAT di halaman proyek

   Tiga keputusan yang perlu diketahui:

   1. **"Lewat tenggat" bukan status di database.** Enum-nya cuma tiga
      (draft / terbit / lunas); yang keempat diturunkan: terbit DAN tenggatnya
      sudah lewat. Itu sebabnya ia jadi LENCANA tapi bukan TAB — menyaring
      "lewat tenggat" sama dengan menyaring "terbit", dan dua tab yang
      menghasilkan daftar sama adalah dua tab yang salah satunya bohong.
   2. **Angka besar di kartu statistik itu SELURUH waktu; baris kecil di
      bawahnya bulan ini.** Framenya memakai satu angka bulanan dibandingkan
      dengan bulan lalu, tapi yang pemilik tanyakan sehari-hari adalah "total
      piutang saya berapa", bukan "piutang bulan ini berapa". Jadi keduanya
      ditampilkan dan dilabeli terpisah; lencana trennya membandingkan bulan
      ini dengan bulan lalu, dan dilewatkan sama sekali kalau bulan lalu
      kosong — persentase terhadap nol tidak berarti apa-apa.
   3. **Termin DIBUAT di halaman proyeknya, bukan di sini.** Satu termin
      milik satu kontrak, dan urutannya (`sort_order`) cuma masuk akal di
      dalam proyeknya. Yang bisa dilakukan dari halaman ini mengubah STATUS —
      itu justru pekerjaan lintas proyek: "yang mana saja yang sudah dibayar
      minggu ini".
   ============================================================================= */

const STATUS = [
  { nilai: "semua", label: "Semua" },
  { nilai: "draft", label: "Draf" },
  { nilai: "terbit", label: "Terbit" },
  { nilai: "lunas", label: "Lunas" },
];

const LABEL_STATUS: Record<string, string> = {
  draft: "Draf",
  terbit: "Terbit",
  lunas: "Lunas",
};

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/**
 * Tanggal dirender dari POTONGAN string, bukan dari `new Date()`.
 *
 * `due_date` kolom `date`, dan lewat JSON ia sampai sebagai
 * "2026-09-20T00:00:00.000Z". Diparse lalu dibaca di zona waktu peramban,
 * tanggal itu mundur sehari di setiap zona barat GMT — dan mundur sehari
 * pada tenggat adalah selisih yang berarti.
 */
function tanggalTenggat(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [t, b, h] = iso.slice(0, 10).split("-");
  if (!t || !b || !h) return "—";
  return `${Number(h)} ${BULAN[Number(b) - 1]} ${t}`;
}

/** Hari tersisa sampai tenggat; negatif berarti sudah lewat. */
function sisaHari(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const hari = iso.slice(0, 10);
  const kini = new Date();
  const hariIni = Date.UTC(kini.getFullYear(), kini.getMonth(), kini.getDate());
  const [t, b, h] = hari.split("-").map(Number);
  if (!t || !b || !h) return null;
  return Math.round((Date.UTC(t, b - 1, h) - hariIni) / 86_400_000);
}

/** `true` kalau tagihan ini sudah terbit dan tenggatnya lewat. */
function telat(i: Invoice): boolean {
  if (i.status !== "terbit") return false;
  const s = sisaHari(i.dueDate);
  return s !== null && s < 0;
}

/** "2026-09" dari tanggal apa pun bentuknya. */
function kunciBulan(iso: string | null | undefined): string | null {
  return iso ? iso.slice(0, 7) : null;
}

function bulanLalu(offset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function Isi() {
  const toast = useToast();

  const [tagihan, setTagihan] = useState<Invoice[] | null>(() =>
    bacaCache<Invoice[]>("tagihan-semua"),
  );
  const [proyek, setProyek] = useState<Proyek[] | null>(() => bacaCache<Proyek[]>("proyek"));
  const [status, setStatus] = useState("semua");
  const [cari, setCari] = useState("");
  const [filterProyek, setFilterProyek] = useState("semua");
  const [halaman, setHalaman] = useState(1);
  const [perHalaman, setPerHalaman] = useState(11);
  const [terpilih, setTerpilih] = useState<string[]>([]);
  const [sibuk, setSibuk] = useState<string | null>(null);

  useEffect(() => {
    semuaTagihan()
      .then((d) => {
        tulisCache("tagihan-semua", d);
        setTagihan(d);
      })
      .catch(() => setTagihan((l) => l ?? []));
    daftarProyek()
      .then((d) => {
        tulisCache("proyek", d);
        setProyek(d);
      })
      .catch(() => setProyek((l) => l ?? []));
  }, []);

  const semua = tagihan ?? [];

  /* Nomor termin = urutannya DI DALAM proyeknya, bukan id barisnya. Uuid 36
     huruf tidak pernah dibacakan siapa pun; "Termin 2 dari 4" dibacakan
     setiap kali menagih. */
  const nomor = useMemo(() => {
    const per = new Map<string, Invoice[]>();
    for (const i of semua) {
      const d = per.get(i.projectId) ?? [];
      d.push(i);
      per.set(i.projectId, d);
    }
    const out = new Map<string, { ke: number; dari: number }>();
    for (const d of per.values()) {
      const urut = [...d].sort((a, b) => a.sortOrder - b.sortOrder);
      urut.forEach((i, k) => out.set(i.id, { ke: k + 1, dari: urut.length }));
    }
    return out;
  }, [semua]);

  const ringkas = useMemo(() => {
    const ini = bulanLalu(0);
    const lalu = bulanLalu(1);
    const jumlah = (f: (i: Invoice) => boolean, bln?: string) =>
      semua
        .filter((i) => f(i) && (bln === undefined || kunciBulan(i.dueDate) === bln))
        .reduce((a, i) => a + i.amount, 0);
    const buat = (f: (i: Invoice) => boolean) => ({
      total: jumlah(f),
      ini: jumlah(f, ini),
      lalu: jumlah(f, lalu),
    });
    return {
      semua: buat(() => true),
      lunas: buat((i) => i.status === "lunas"),
      belum: buat((i) => i.status !== "lunas"),
    };
  }, [semua]);

  const judulProyek = useMemo(() => {
    const dari = new Set((proyek ?? []).map((p) => p.title));
    for (const i of semua) if (i.projectTitle) dari.add(i.projectTitle);
    return [...dari].sort((a, b) => a.localeCompare(b, "id"));
  }, [proyek, semua]);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return semua.filter((i) => {
      if (status !== "semua" && i.status !== status) return false;
      if (filterProyek !== "semua" && i.projectTitle !== filterProyek) return false;
      if (!q) return true;
      return (
        i.label.toLowerCase().includes(q) || (i.projectTitle ?? "").toLowerCase().includes(q)
      );
    });
  }, [semua, status, filterProyek, cari]);

  const totalHalaman = Math.max(1, Math.ceil(tersaring.length / perHalaman));
  const halamanKini = Math.min(halaman, totalHalaman);
  const mulai = (halamanKini - 1) * perHalaman;
  const tampil = tersaring.slice(mulai, mulai + perHalaman);

  async function ubahStatus(i: Invoice, baru: string) {
    if (baru === i.status) return;
    setSibuk(i.id);
    /* Diubah di layar LEBIH DULU, lalu dikembalikan kalau permintaannya
       gagal. Tanpa itu lencananya baru berubah setelah dua permintaan
       selesai, dan staf yang menandai sepuluh termin lunas berturut-turut
       menekan yang sama dua kali karena mengira kliknya tidak masuk. */
    const sebelum = semua;
    setTagihan(semua.map((x) => (x.id === i.id ? { ...x, status: baru } : x)));
    try {
      await ubahInvoice(i.id, { status: baru });
      const segar = await semuaTagihan();
      tulisCache("tagihan-semua", segar);
      setTagihan(segar);
      toast({
        judul: "Status diperbarui",
        keterangan: `${i.label} → ${LABEL_STATUS[baru] ?? baru}.`,
        nada: "sukses",
      });
    } catch (e) {
      setTagihan(sebelum);
      toast({
        judul: "Gagal mengubah status",
        keterangan: e instanceof Error ? e.message : "Coba lagi.",
        nada: "gagal",
      });
    } finally {
      setSibuk(null);
    }
  }

  function bukaProyeknya(i: Invoice) {
    const p = (proyek ?? []).find((x) => x.title === i.projectTitle);
    if (p) setProyekAktif(p.id);
    window.location.href = "/admin/proyek";
  }

  const kolom: KolomTabel[] = [
    { judul: "Termin", lebar: 299, urut: true },
    { judul: "Nomor", lebar: 186, urut: true },
    { judul: "Nominal", lebar: 168, urut: true },
    { judul: "Tenggat", lebar: 276.2, urut: true },
    { judul: "Status", lebar: 173.8, urut: true },
    { judul: "", lebar: 47.5 },
  ];

  const baris = tampil.map((i) => {
    const n = nomor.get(i.id);
    const sisa = sisaHari(i.dueDate);
    const lewat = telat(i);
    const kelas = lewat
      ? "tag__status--telat"
      : i.status === "lunas"
        ? "tag__status--lunas"
        : i.status === "terbit"
          ? "tag__status--terbit"
          : "tag__status--draf";
    return [
      <div className="tag__sel">
        <span className="tag__ikonbaris">
          <Ikon ikon={NavReceipt} ukuran={16} />
        </span>
        <SelDua atas={i.label} bawah={i.projectTitle ?? "—"} />
      </div>,
      n ? `Termin ${n.ke} dari ${n.dari}` : "—",
      formatRupiah(i.amount),
      <SelDua
        atas={tanggalTenggat(i.dueDate)}
        bawah={
          i.status === "lunas"
            ? "sudah dibayar"
            : sisa === null
              ? "belum dijadwalkan"
              : sisa < 0
                ? `lewat ${Math.abs(sisa)} hari`
                : sisa === 0
                  ? "jatuh tempo hari ini"
                  : `${sisa} hari lagi`
        }
      />,
      <label className="tag__pilihstatus">
        <span className={`tag__status ${kelas}`}>
          {lewat ? "Lewat tenggat" : (LABEL_STATUS[i.status] ?? i.status)}
        </span>
        <select
          aria-label={`Status ${i.label}`}
          value={i.status}
          disabled={sibuk === i.id}
          onChange={(e) => ubahStatus(i, e.currentTarget.value)}
        >
          {Object.entries(LABEL_STATUS).map(([n2, l]) => (
            <option key={n2} value={n2}>
              {l}
            </option>
          ))}
        </select>
      </label>,
      <TombolIkon
        ikon={ArrowRight}
        jenis="transparent"
        ukuran="small"
        judul={`Buka proyek ${i.projectTitle ?? ""}`}
        onClick={() => bukaProyeknya(i)}
      />,
    ];
  });

  const memuat = tagihan === null;

  function Kartu({
    ikon,
    label,
    angka,
  }: {
    ikon: Parameters<typeof Ikon>[0]["ikon"];
    label: string;
    angka: { total: number; ini: number; lalu: number };
  }) {
    const bisaBanding = angka.lalu > 0;
    const beda = bisaBanding ? ((angka.ini - angka.lalu) / angka.lalu) * 100 : 0;
    return (
      <article className="tag__kartu">
        <span className="tag__ubin">
          <Ikon ikon={ikon} ukuran={26} />
        </span>
        <div className="tag__isi">
          <p className="tag__label">{label}</p>
          <p className="tag__nilai">{formatRupiah(angka.total)}</p>
        </div>
        <div className="tag__kanan">
          {bisaBanding && (
            <LencanaTren naik={beda >= 0}>
              {Math.abs(beda).toFixed(1).replace(".", ",")} %
            </LencanaTren>
          )}
          <p className="tag__banding">
            bulan ini
            <br />
            <b>{formatRupiah(angka.ini)}</b>
          </p>
        </div>
      </article>
    );
  }

  return (
    <div className="tag">
      <section className="tag__stat">
        <Kartu ikon={NavReceipt} label="Total tagihan" angka={ringkas.semua} />
        <Kartu ikon={CircleWavyCheck} label="Sudah lunas" angka={ringkas.lunas} />
        <Kartu ikon={WarningOctagon} label="Belum lunas" angka={ringkas.belum} />
      </section>

      <div className="tag__bar">
        <Segmen
          judul="Saring status"
          segmen={STATUS.map((s) => ({ nilai: s.nilai, label: s.label }))}
          nilai={status}
          onPilih={(v) => {
            setStatus(v);
            setHalaman(1);
          }}
        />

        <span className="tag__dorong" />

        <Cari
          ukuran="medium"
          judul="Cari tagihan"
          placeholder="Cari tagihan"
          value={cari}
          onChange={(e) => {
            setCari(e.currentTarget.value);
            setHalaman(1);
          }}
        />

        <label className="k-pilihtombol">
          <Tombol ukuran="medium" jenis="secondary" kiri={Funnel} kanan={CaretDown} tabIndex={-1}>
            {filterProyek === "semua" ? "Semua proyek" : filterProyek}
          </Tombol>
          <select
            aria-label="Saring proyek"
            value={filterProyek}
            onChange={(e) => {
              setFilterProyek(e.currentTarget.value);
              setHalaman(1);
            }}
          >
            <option value="semua">Semua proyek</option>
            {judulProyek.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </label>

        {/* Termin dibuat DI HALAMAN PROYEKNYA — lihat catatan di kepala
            berkas ini. Tombolnya tetap ada di tempat yang sama dengan
            framenya, dan yang berubah cuma ke mana ia membawa. */}
        <Tombol
          ukuran="medium"
          kiri={Plus}
          title="Termin dibuat dari halaman proyeknya"
          onClick={() => (window.location.href = "/admin/proyek")}
        >
          Tagihan Baru
        </Tombol>
      </div>

      <div className="tag__tabel">
        {tampil.length === 0 ? (
          <p className="tag__kosong">
            {memuat ? "Memuat tagihan…" : "Tidak ada tagihan pada saringan ini."}
          </p>
        ) : (
          <Tabel
            kolom={kolom}
            baris={baris}
            pilih
            lebarPilih={41.5}
            kunci={tampil.map((i) => i.id)}
            terpilih={terpilih}
            onPilih={setTerpilih}
            kepala="mint"
            pad={10.5}
            tinggiKepala={45}
            tinggiBaris={66}
            fontBaris={12}
          />
        )}
      </div>

      <div className="tag__kaki">
        <p className="tag__hitung">
          Menampilkan
          <select
            aria-label="Baris per halaman"
            value={perHalaman}
            onChange={(e) => {
              setPerHalaman(Number(e.currentTarget.value));
              setHalaman(1);
            }}
          >
            {[11, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          dari {tersaring.length}
          {terpilih.length > 0 && ` · ${terpilih.length} dipilih`}
        </p>
        <Paginasi kini={halamanKini} total={totalHalaman} onPindah={setHalaman} />
      </div>
    </div>
  );
}

export function TagihanKit() {
  return (
    <ToastProvider>
      <RequireAuth skeleton={<div className="tag tag--rangka" />}>
        <Isi />
      </RequireAuth>
    </ToastProvider>
  );
}
