import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { RequireAuth } from "./RequireAuth";
import { TombolIkon } from "../kit/Tombol";
import { DropdownMenu } from "../kit/Overlay";
import { PilihMenu } from "../kit/Formulir";
import { Ikon } from "../kit/Ikon";
import { ArrowRight, CaretDown, DownloadSimple, Hourglass } from "../kit/ikon";
import { Keterangan, pemberiKet, type KabarKartu } from "../kit/kartuGrafik";
import { BULAN, BULAN_PENDEK, PilihTombol, teksPersen } from "./frame25";
import {
  feePerProyek,
  feePerOrang,
  semuaBiaya,
  daftarBiaya,
  daftarTimProyek,
  ambilSettings,
  bacaCache,
  tulisCache,
  LABEL_JENIS_ANGGOTA,
  LABEL_PERAN,
  type FeeProyek,
  type FeeOrang,
  type BiayaProyek,
  type PenugasanTim,
  type JenisAnggota,
  type StudioSettings,
} from "../../lib/admin";
import { formatRupiah } from "../../lib/format";
import { kodeProyek, inisial } from "../../lib/nomorDokumen";
import { CapLunas } from "./capLunas";
import { terbilang } from "../../lib/terbilang";
import { unduhCsv } from "../../lib/csv";

/* =============================================================================
   Fee Proyek — BUKU KUITANSI FEE.

   Benda dunia nyata yang paling dekat dengan "fee proyek" adalah kuitansi:
   setiap fee yang dibayarkan ke orang dibuktikan selembar kuitansi, dan buku
   kuitansi menyimpan BONGGOLNYA — siapa, berapa, kapan, untuk proyek apa.
   Gaji sudah berbentuk buku daftar penerimaan (per bulan), Bayaran Tim
   amplop (per orang), Aturan Fee papan aliran; halaman ini PER PROYEK.

     Papan (kiri)      jumlah fee keluar pada rentang, pita 12 bulan, dan
                       satu BLOK KUITANSI per proyek — tebal tumpukan lembar
                       di bawahnya = jumlah kuitansi proyek itu
     Lembar (kanan)    buku kuitansi proyek terpilih: kolom BONGGOL (tiap
                       pembayaran fee; tahap yang belum dibayar = bonggol
                       kosong), garis sobek berlubang, KUITANSI terpilih
                       (terbilang, untuk pembayaran, tanda tangan, cap LUNAS),
                       dan RINCIAN FEE proyek per penerima (dibayar lawan hak)

   Selaras dengan Gaji: papan hijau berjahit + kertas yang ikut tema; gerak
   3D HANYA satu — kuitansi berayun keluar dari garis sobeknya saat dipilih —
   dan cap yang "tercap" sekali. Hiasan tidak pernah di belakang tulisan.

   Halaman ini TIDAK PERNAH MENULIS. Fee dicatat dari tombol Bayar di Satu
   Proyek atau Catat Pengeluaran; di sini cuma dibaca. Yang dianggap fee sama
   dengan repository/fee.ts: biaya berkategori freelancer atau prinsipal.
   ============================================================================= */

const KATEGORI_FEE = new Set(["freelancer", "prinsipal"]);

const RENTANG = [
  { nilai: "semua", label: "Sepanjang waktu" },
  { nilai: "tahun", label: "Tahun ini" },
  { nilai: "bulan", label: "Bulan ini" },
];
const URUT = [
  { nilai: "fee", label: "Fee terbesar" },
  { nilai: "porsi", label: "Porsi terbesar" },
  { nilai: "nama", label: "Nama proyek" },
];

function batas(r: string): { dari?: string; sampai?: string } {
  const kini = new Date();
  const y = kini.getFullYear();
  if (r === "tahun") return { dari: `${y}-01-01`, sampai: `${y}-12-31` };
  if (r === "bulan") {
    const m = String(kini.getMonth() + 1).padStart(2, "0");
    // Hari terakhir bulan ini: tanggal 0 bulan BERIKUTNYA.
    const akhir = new Date(y, kini.getMonth() + 1, 0).getDate();
    return { dari: `${y}-${m}-01`, sampai: `${y}-${m}-${akhir}` };
  }
  return {};
}

function dalamRentang(tgl: string, r: string): boolean {
  const { dari, sampai } = batas(r);
  return (!dari || tgl >= dari) && (!sampai || tgl <= sampai);
}

function tanggalPendek(iso: string, tahun = false): string {
  const [t, b, h] = iso.slice(0, 10).split("-").map(Number);
  return `${h} ${BULAN_PENDEK[(b ?? 1) - 1]}${tahun ? ` ${t}` : ""}`;
}
function tanggalPanjang(iso: string): string {
  const [t, b, h] = iso.slice(0, 10).split("-").map(Number);
  return `${h} ${BULAN[(b ?? 1) - 1]} ${t}`;
}

/* Satu warna per JENIS penerima (`--kwt-<jenis>` di kuitansi-kit.css). */
const WARNA_JENIS = (j: JenisAnggota | "tanpa") => `var(--kwt-${j})`;

const pakaiGerak = () =>
  typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Isi satu buku: penugasan tim + biaya proyek itu. */
interface IsiBuku {
  tim: PenugasanTim[];
  biaya: BiayaProyek[];
}

/** Satu bonggol: kuitansi yang sudah ditulis (dibayar), atau yang belum. */
interface Bonggol {
  id: string;
  /** Nomor urut kuitansi di proyek ini (kronologis); null = belum ditulis. */
  no: number | null;
  tanggal: string | null;
  nama: string | null;
  teamMemberId: string | null;
  jenis: JenisAnggota | "tanpa";
  nominal: number;
  /** "fee Render 5% · tahap awal", atau label biaya kalau tidak tertaut penugasan. */
  untuk: string;
  keadaan: "dibayar" | "jatuh_tempo" | "menunggu";
}

function Isi() {
  const kabar: KabarKartu = useRef(null);
  const ket = pemberiKet(kabar);

  const [biaya, setBiaya] = useState<BiayaProyek[] | null>(() => bacaCache<BiayaProyek[]>("biaya-semua"));
  const [orangSemua, setOrangSemua] = useState<FeeOrang[] | null>(() => bacaCache<FeeOrang[]>("feeorang"));
  const [proyekSemua, setProyekSemua] = useState<FeeProyek[] | null>(() => bacaCache<FeeProyek[]>("feeproyek"));
  const [galat, setGalat] = useState(false);
  /* Nama dan kota studio dari Info Studio — kunci cache `settings` milik Info
     Studio, di sini dibaca saja (jebakan #8). */
  const [studio, setStudio] = useState<{ nama: string; kota: string | null }>(() => {
    const s = bacaCache<StudioSettings>("settings");
    return { nama: s?.studioName || "Studio", kota: s?.city ?? null };
  });

  const [rentang, setRentang] = useState("semua");
  const [urut, setUrut] = useState("fee");
  /* Hasil rentang selain "semua" TIDAK pernah di-cache: angka sebulan yang
     tersimpan di bawah kunci sepanjang-waktu akan tampil sebagai angka
     sepanjang waktu pada kunjungan berikutnya. */
  const [proyekRentang, setProyekRentang] = useState<FeeProyek[] | null>(null);
  const [orangRentang, setOrangRentang] = useState<FeeOrang[] | null>(null);

  const [pilih, setPilih] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(location.search).get("proyek"),
  );
  const [isi, setIsi] = useState<Record<string, IsiBuku | "galat">>({});
  const meminta = useRef(new Set<string>());
  /* Kuitansi yang dibuka; null = yang terbaru. */
  const [kuitansiPilih, setKuitansiPilih] = useState<string | null>(null);
  /* Ayunan kuitansi hanya sebagai jawaban atas pilihan — bukan animasi masuk. */
  const [ayun, setAyun] = useState(0);
  const [sorotOrang, setSorotOrang] = useState<string | null>(null);

  const daftarRef = useRef<HTMLDivElement>(null);
  const bonggolRef = useRef<HTMLOListElement>(null);

  function muat() {
    setGalat(false);
    semuaBiaya()
      .then((d) => {
        tulisCache("biaya-semua", d);
        setBiaya(d);
      })
      .catch(() => setBiaya((l) => l ?? []));
    feePerOrang()
      .then((d) => {
        tulisCache("feeorang", d);
        setOrangSemua(d);
      })
      .catch(() => {
        setOrangSemua((l) => l ?? []);
        setGalat(true);
      });
    feePerProyek()
      .then((d) => {
        tulisCache("feeproyek", d);
        setProyekSemua(d);
      })
      .catch(() => {
        setProyekSemua((l) => l ?? []);
        setGalat(true);
      });
  }
  useEffect(() => {
    muat();
    ambilSettings()
      .then((d) => setStudio({ nama: d.studioName || "Studio", kota: d.city ?? null }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (rentang === "semua") return;
    let batal = false;
    setProyekRentang(null);
    setOrangRentang(null);
    feePerProyek(batas(rentang))
      .then((d) => !batal && setProyekRentang(d))
      .catch(() => !batal && setProyekRentang([]));
    feePerOrang(batas(rentang))
      .then((d) => !batal && setOrangRentang(d))
      .catch(() => !batal && setOrangRentang([]));
    return () => {
      batal = true;
    };
  }, [rentang]);

  const proyek = rentang === "semua" ? proyekSemua : proyekRentang;
  const orang = rentang === "semua" ? orangSemua : orangRentang;

  /* Jenis tiap orang dari daftar SEPANJANG WAKTU, supaya orang yang belum
     dibayar di rentang ini tetap berwarna benar. */
  const jenisOrang = useMemo(() => {
    const m = new Map<string, JenisAnggota>();
    for (const o of orangSemua ?? []) m.set(o.teamMemberId, o.kind);
    for (const p of proyekSemua ?? []) for (const o of p.orang) m.set(o.teamMemberId, o.kind);
    return m;
  }, [orangSemua, proyekSemua]);

  /* ---- Blok kuitansi per proyek ----------------------------------------- */
  const blok = useMemo(() => {
    const d = [...(proyek ?? [])];
    const keluar = (p: FeeProyek) => p.feeTotal + p.feeTanpaNama;
    const porsi = (p: FeeProyek) => (p.contractValue ? keluar(p) / p.contractValue : -1);
    if (urut === "porsi") d.sort((a, z) => porsi(z) - porsi(a));
    else if (urut === "nama") d.sort((a, z) => a.projectTitle.localeCompare(z.projectTitle, "id"));
    else d.sort((a, z) => keluar(z) - keluar(a));
    return d;
  }, [proyek, urut]);

  /* Jumlah kuitansi per proyek pada rentang — dari daftar biaya lintas proyek. */
  const jumlahKuitansi = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of biaya ?? []) {
      if (!KATEGORI_FEE.has(b.category) || !dalamRentang(b.incurredOn, rentang)) continue;
      m.set(b.projectId, (m.get(b.projectId) ?? 0) + 1);
    }
    return m;
  }, [biaya, rentang]);

  /* Proyek terpilih: dari alamat; kalau tidak ada (atau tidak ada di rentang
     ini) yang pertama — buku tidak pernah dibuka dalam keadaan kosong. */
  const terpilih = blok.find((p) => p.projectId === pilih) ?? blok[0] ?? null;
  const idTerpilih = terpilih?.projectId ?? null;

  function ambilIsi(id: string, paksa = false) {
    if (!paksa && meminta.current.has(id)) return;
    meminta.current.add(id);
    Promise.all([daftarTimProyek(id), daftarBiaya(id)])
      .then(([tim, b]) => setIsi((l) => ({ ...l, [id]: { tim, biaya: b.filter((x) => x.projectId === id) } })))
      .catch(() => {
        meminta.current.delete(id);
        setIsi((l) => ({ ...l, [id]: "galat" }));
      });
  }
  useEffect(() => {
    if (idTerpilih) ambilIsi(idTerpilih);
  }, [idTerpilih]);

  function pilihProyek(id: string) {
    if (id === idTerpilih) return;
    setPilih(id);
    setKuitansiPilih(null);
    setAyun((n) => n + 1);
    setSorotOrang(null);
    kabar.current?.(null);
    const u = new URL(location.href);
    u.searchParams.set("proyek", id);
    history.replaceState(history.state, "", u);
  }

  /* Panah atas/bawah, Home/End antarblok — memilih sambil berpindah. */
  function tombolBlok(e: React.KeyboardEvent, i: number) {
    const tujuan =
      e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? blok.length - 1 : null;
    if (tujuan === null) return;
    e.preventDefault();
    const n = Math.max(0, Math.min(blok.length - 1, tujuan));
    daftarRef.current?.querySelectorAll<HTMLButtonElement>(".kwt__blok")[n]?.focus();
    if (blok[n]) pilihProyek(blok[n].projectId);
  }

  /* ---- Pita 12 bulan ---------------------------------------------------- */
  const bulanan = useMemo(() => {
    const kunci: string[] = [];
    const d = new Date();
    for (let i = 11; i >= 0; i--) {
      const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      kunci.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
    }
    const jumlah = new Map(kunci.map((k) => [k, 0]));
    for (const b of biaya ?? []) {
      if (!KATEGORI_FEE.has(b.category)) continue;
      const k = b.incurredOn.slice(0, 7);
      if (jumlah.has(k)) jumlah.set(k, jumlah.get(k)! + b.amount);
    }
    const bln = kunci.map((k) => ({ bulan: k, nilai: jumlah.get(k)! }));
    const maks = Math.max(1, ...bln.map((b) => b.nilai));
    return { bln, maks, rata: bln.reduce((a, b) => a + b.nilai, 0) / 12 };
  }, [biaya]);

  /* ---- Buku proyek terpilih -------------------------------------------- */
  const isiTerpilih = idTerpilih ? isi[idTerpilih] : undefined;
  const data = isiTerpilih && isiTerpilih !== "galat" ? isiTerpilih : null;

  const bonggol = useMemo<Bonggol[]>(() => {
    if (!terpilih || !data) return [];
    /* costId → penugasan + tahap, supaya kuitansi bisa menulis "untuk
       pembayaran fee Render 5% tahap awal", bukan label biaya mentah. */
    const tahapBiaya = new Map<string, { t: PenugasanTim; tahap: string }>();
    for (const t of data.tim) for (const x of t.tahap) if (x.costId) tahapBiaya.set(x.costId, { t, tahap: x.tahap });
    const dibayar = data.biaya
      .filter((b) => KATEGORI_FEE.has(b.category) && dalamRentang(b.incurredOn, rentang))
      .sort((a, z) => a.incurredOn.localeCompare(z.incurredOn) || a.id.localeCompare(z.id))
      .map((b, i): Bonggol => {
        const tt = tahapBiaya.get(b.id);
        const pct = tt?.t.pctBerlaku;
        return {
          id: b.id,
          no: i + 1,
          tanggal: b.incurredOn,
          nama: b.teamMemberName ?? null,
          teamMemberId: b.teamMemberId ?? null,
          jenis: b.teamMemberId ? (jenisOrang.get(b.teamMemberId) ?? "proyek") : "tanpa",
          nominal: b.amount,
          untuk: tt
            ? `fee ${LABEL_PERAN[tt.t.role]}${pct != null ? ` ${teksPersen(pct)}` : ""} · tahap ${tt.tahap === "awal" ? "awal" : "akhir"}`
            : b.label,
          keadaan: "dibayar",
        };
      });
    /* Tahap yang belum dibayar = bonggol KOSONG: kuitansinya belum ditulis. */
    const kosong: Bonggol[] = [];
    for (const t of data.tim) {
      for (const x of t.tahap) {
        if ((x.keadaan !== "jatuh_tempo" && x.keadaan !== "menunggu") || x.nominal == null) continue;
        kosong.push({
          id: `kosong-${t.id}-${x.tahap}`,
          no: null,
          tanggal: null,
          nama: t.teamMemberName,
          teamMemberId: t.teamMemberId,
          jenis: jenisOrang.get(t.teamMemberId) ?? (t.teamMemberKind as JenisAnggota),
          nominal: x.nominal,
          untuk: `fee ${LABEL_PERAN[t.role]}${t.pctBerlaku != null ? ` ${teksPersen(t.pctBerlaku)}` : ""} · tahap ${x.tahap === "awal" ? "awal" : "akhir"}`,
          keadaan: x.keadaan,
        });
      }
    }
    kosong.sort((a, z) => (a.keadaan === z.keadaan ? 0 : a.keadaan === "jatuh_tempo" ? -1 : 1));
    // Yang belum ditulis paling atas, lalu bonggol terbaru.
    return [...kosong, ...dibayar.reverse()];
  }, [terpilih, data, rentang, jenisOrang]);

  const kuitansi =
    bonggol.find((b) => b.id === kuitansiPilih) ?? bonggol.find((b) => b.keadaan === "dibayar") ?? bonggol[0] ?? null;

  function pilihKuitansi(id: string) {
    if (id === kuitansi?.id) return;
    setKuitansiPilih(id);
    setAyun((n) => n + 1);
  }
  function tombolBonggol(e: React.KeyboardEvent, i: number) {
    const tujuan =
      e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? bonggol.length - 1 : null;
    if (tujuan === null) return;
    e.preventDefault();
    const n = Math.max(0, Math.min(bonggol.length - 1, tujuan));
    bonggolRef.current?.querySelectorAll<HTMLButtonElement>(".kwt__bonggol")[n]?.focus();
    if (bonggol[n]) pilihKuitansi(bonggol[n].id);
  }

  /* Rincian fee proyek: per penerima, dibayar (rentang) lawan hak (penugasan). */
  const rincian = useMemo(() => {
    if (!terpilih) return [];
    type R = { id: string; nama: string; jenis: JenisAnggota | "tanpa"; dibayar: number; hak: number; peran: string[] };
    const per = new Map<string, R>();
    for (const o of terpilih.orang) per.set(o.teamMemberId, { id: o.teamMemberId, nama: o.name, jenis: o.kind, dibayar: o.amount, hak: 0, peran: [] });
    for (const t of data?.tim ?? []) {
      const r: R = per.get(t.teamMemberId) ?? {
        id: t.teamMemberId,
        nama: t.teamMemberName,
        jenis: jenisOrang.get(t.teamMemberId) ?? (t.teamMemberKind as JenisAnggota),
        dibayar: 0,
        hak: 0,
        peran: [],
      };
      r.hak += t.hak ?? 0;
      r.peran.push(`${LABEL_PERAN[t.role]}${t.pctBerlaku != null ? ` ${teksPersen(t.pctBerlaku)}` : " · persen belum ditentukan"}`);
      per.set(t.teamMemberId, r);
    }
    const d = [...per.values()].sort((a, z) => z.dibayar - a.dibayar || z.hak - a.hak);
    if (terpilih.feeTanpaNama > 0) d.push({ id: "tanpa", nama: "Tanpa nama", jenis: "tanpa", dibayar: terpilih.feeTanpaNama, hak: 0, peran: [] });
    return d;
  }, [terpilih, data, jenisOrang]);

  function ekspor(mode: "proyek" | "orang") {
    const tanda = new Date().toISOString().slice(0, 10);
    if (mode === "orang") {
      unduhCsv(`fee-per-orang-${tanda}.csv`, [
        ["Nama", "Jenis", "Peran", "Jumlah proyek", "Terakhir", "Total diterima"],
        ...(orang ?? []).map((o) => [o.name, LABEL_JENIS_ANGGOTA[o.kind], o.role ?? "", String(o.projectCount), o.lastOn ?? "", String(o.total)]),
      ]);
    } else {
      unduhCsv(`fee-per-proyek-${tanda}.csv`, [
        ["Proyek", "Nilai kontrak", "Fee bernama", "Fee tanpa nama", "Porsi fee %", "Penerima"],
        ...blok.map((p) => [
          p.projectTitle,
          p.contractValue === null ? "" : String(p.contractValue),
          String(p.feeTotal),
          String(p.feeTanpaNama),
          p.feeShare === null ? "" : (p.feeShare * 100).toFixed(2),
          p.orang.map((o) => `${o.name}:${o.amount}`).join("; "),
        ]),
      ]);
    }
  }

  if (biaya === null || orangSemua === null || proyekSemua === null) return <Kerangka />;

  const memuat = proyek === null || orang === null;
  const keluarTotal = (proyek ?? []).reduce((a, p) => a + p.feeTotal + p.feeTanpaNama, 0);
  const kontrakTotal = (proyek ?? []).reduce((a, p) => a + (p.contractValue ?? 0), 0);
  const kontrakBerfee = (proyek ?? []).filter((p) => p.contractValue).reduce((a, p) => a + p.feeTotal + p.feeTanpaNama, 0);
  const porsiRata = kontrakTotal > 0 ? (kontrakBerfee / kontrakTotal) * 100 : null;
  const labelRentang = RENTANG.find((r) => r.nilai === rentang)!.label;
  const maksBlok = Math.max(1, ...jumlahKuitansi.values());

  return (
    <div className="kwt">
      <Keterangan kabar={kabar} />
      <div className="kwt__papan">
        {/* ---- Papan: ringkasan, 12 bulan, blok kuitansi per proyek -------- */}
        <aside className="kwt__sisi" aria-label="Ringkasan fee proyek">
          <div className="kwt__kop">
            <p className="kwt__alis">Fee proyek · {labelRentang.toLowerCase()}</p>
            <p className="kwt__total">{memuat ? <span className="rk rk--gelap" style={{ width: 200, height: 26 }} /> : <RupiahBesar n={keluarTotal} />}</p>
            <p className="kwt__sub">
              {blok.length} proyek · {(orang ?? []).length} penerima
              {porsiRata !== null && <> · {teksPersen(porsiRata)} dari kontrak</>}
            </p>
          </div>

          <div className="kwt__bulan" role="list" aria-label="Fee per bulan, 12 bulan terakhir">
            {bulanan.bln.map((b, i) => {
              const m = Number(b.bulan.slice(5, 7));
              return (
                <span
                  key={b.bulan}
                  role="listitem"
                  className={`kwt__bln${i === 11 ? " is-kini" : ""}`}
                  style={{ "--kwt-t": b.nilai / bulanan.maks } as React.CSSProperties}
                  aria-label={`${BULAN[m - 1]} ${b.bulan.slice(0, 4)}: ${formatRupiah(b.nilai)}`}
                  {...ket(() => ({
                    judul: `${BULAN[m - 1]} ${b.bulan.slice(0, 4)}`,
                    baris: [
                      { label: "Fee keluar", nilai: formatRupiah(b.nilai) },
                      { label: "Rata-rata 12 bulan", nilai: formatRupiah(Math.round(bulanan.rata)) },
                    ],
                  }))}
                >
                  <i />
                  <small>{BULAN_PENDEK[m - 1]!.slice(0, 1)}</small>
                </span>
              );
            })}
          </div>

          <div className="kwt__blok-blok" ref={daftarRef} role="listbox" aria-label="Buku kuitansi per proyek">
            {galat && blok.length === 0 ? (
              <div className="kwt__kosong">
                <p>Buku kuitansi gagal dimuat.</p>
                <button type="button" className="kwt__coba" onClick={muat}>
                  Coba lagi
                </button>
              </div>
            ) : memuat ? (
              Array.from({ length: 5 }, (_, i) => <div key={i} className="kwt__blok kwt__blok--rangka" />)
            ) : blok.length === 0 ? (
              <p className="kwt__kosong">Belum ada fee pada rentang ini.</p>
            ) : (
              blok.map((p, i) => {
                const keluar = p.feeTotal + p.feeTanpaNama;
                const kontrak = p.contractValue && p.contractValue > 0 ? p.contractValue : null;
                const n = jumlahKuitansi.get(p.projectId) ?? 0;
                const aktif = p.projectId === idTerpilih;
                return (
                  <button
                    key={p.projectId}
                    type="button"
                    role="option"
                    aria-selected={aktif}
                    tabIndex={aktif ? 0 : -1}
                    className={`kwt__blok kwt__blok--lapis${Math.max(1, Math.round((n / maksBlok) * 3))}${aktif ? " is-aktif" : ""}`}
                    onClick={() => pilihProyek(p.projectId)}
                    onKeyDown={(e) => tombolBlok(e, i)}
                    onPointerEnter={(e) => e.pointerType === "mouse" && ambilIsi(p.projectId)}
                  >
                    <span className="kwt__blokatas">
                      <span className="kwt__kode">{kodeProyek(p.projectTitle)}</span>
                      <span className="kwt__blokjudul">{p.projectTitle}</span>
                      <b className="kwt__bloknilai">{formatRupiah(keluar)}</b>
                    </span>
                    <Mistar p={p} kecil />
                    <span className="kwt__blokket">
                      <span>{kontrak ? `${teksPersen((keluar / kontrak) * 100)} dari kontrak` : "kontrak belum diisi"}</span>
                      <span>
                        {n} kuitansi · {p.orang.length} penerima
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ---- Lembar: buku kuitansi proyek terpilih ------------------------- */}
        <section className="kwt__lembar" aria-label={terpilih ? `Buku kuitansi fee — ${terpilih.projectTitle}` : "Buku kuitansi fee"}>
          <header className="kwt__lembarkop">
            <div className="kwt__lembarjudul">
              <p className="kwt__alis kwt__alis--kertas">Buku kuitansi fee</p>
              <h2>
                {terpilih ? (
                  <>
                    {terpilih.projectTitle} <span className="kwt__kodebesar">{kodeProyek(terpilih.projectTitle)}</span>
                  </>
                ) : (
                  "—"
                )}
              </h2>
            </div>
            <div className="kwt__kontrol">
              <PilihTombol judul="Rentang fee" nilai={rentang} opsi={RENTANG} onUbah={setRentang} />
              <PilihMenu
                label="Urutan buku"
                nilai={urut}
                opsi={URUT}
                onUbah={setUrut}
                align="end"
                pemicu={
                  <button type="button" className="fee__pilihteks kwt__urut">
                    <span>{URUT.find((u) => u.nilai === urut)!.label}</span>
                    <Ikon ikon={CaretDown} ukuran={12} />
                  </button>
                }
              />
              <DropdownMenu
                trigger={<TombolIkon ikon={DownloadSimple} jenis="ghost" judul="Unduh CSV" />}
                sections={[
                  {
                    label: `Unduh CSV · ${labelRentang.toLowerCase()}`,
                    items: [
                      { label: "Fee per proyek", onSelect: () => ekspor("proyek") },
                      { label: "Fee per orang", onSelect: () => ekspor("orang") },
                    ],
                  },
                ]}
              />
            </div>
          </header>

          {!terpilih ? (
            <p className="kwt__kosongkertas">{memuat ? "Membuka buku…" : "Belum ada fee pada rentang ini."}</p>
          ) : isiTerpilih === "galat" ? (
            <div className="kwt__kosongkertas">
              <p>Isi buku gagal dimuat.</p>
              <button type="button" className="kwt__coba kwt__coba--kertas" onClick={() => ambilIsi(terpilih.projectId, true)}>
                Coba lagi
              </button>
            </div>
          ) : (
            <div className="kwt__isi">
              {/* Kolom bonggol */}
              <div className="kwt__bonggolwrap">
                <p className="kwt__kepalakolom">
                  Bonggol <span>{bonggol.filter((b) => b.no !== null).length} kuitansi</span>
                </p>
                <ol className="kwt__bonggol-bonggol" ref={bonggolRef} aria-label="Bonggol kuitansi">
                  {!data
                    ? Array.from({ length: 4 }, (_, i) => <li key={i} className="kwt__bonggolrangka" />)
                    : bonggol.map((b, i) => {
                        const aktif = b.id === kuitansi?.id;
                        const redup = sorotOrang !== null && (b.teamMemberId ?? "tanpa") !== sorotOrang;
                        return (
                          <li key={b.id}>
                            <button
                              type="button"
                              className={`kwt__bonggol is-${b.keadaan}${aktif ? " is-aktif" : ""}${redup ? " is-redup" : ""}`}
                              style={{ "--kwt-w": WARNA_JENIS(b.jenis) } as React.CSSProperties}
                              aria-current={aktif || undefined}
                              tabIndex={aktif ? 0 : -1}
                              onClick={() => pilihKuitansi(b.id)}
                              onKeyDown={(e) => tombolBonggol(e, i)}
                            >
                              <span className="kwt__bonggolno">{b.no === null ? "—" : String(b.no).padStart(2, "0")}</span>
                              <span className="kwt__bonggolisi">
                                <b>{b.nama ?? "Tanpa nama"}</b>
                                <span>
                                  {b.keadaan === "dibayar"
                                    ? tanggalPendek(b.tanggal!, true)
                                    : b.keadaan === "jatuh_tempo"
                                      ? "belum ditulis · jatuh tempo"
                                      : "belum ditulis · menunggu"}
                                </span>
                              </span>
                              <span className="kwt__bonggolnominal">{formatRupiah(b.nominal)}</span>
                            </button>
                          </li>
                        );
                      })}
                  {data && bonggol.length === 0 && <li className="kwt__bonggolkosong">Belum ada kuitansi fee di rentang ini.</li>}
                </ol>
              </div>

              {/* Garis sobek: deret lubang perforasi */}
              <div className="kwt__sobek" aria-hidden="true" />

              <div className="kwt__kanan">
                <div className="kwt__meja">
                  {kuitansi ? (
                    <Kuitansi key={`${kuitansi.id}-${ayun}`} k={kuitansi} proyek={terpilih} studio={studio} ayun={ayun > 0 && pakaiGerak()} />
                  ) : (
                    <div className="kwt__kuitansi kwt__kuitansi--kosong">{data ? "Belum ada kuitansi di rentang ini." : "Membuka buku…"}</div>
                  )}
                </div>

                {/* Rincian fee proyek */}
                <div className="kwt__rincian" onPointerLeave={(e) => e.pointerType === "mouse" && setSorotOrang(null)}>
                  <p className="kwt__kepalakolom">
                    Rincian fee proyek
                    <span>
                      {terpilih.contractValue
                        ? `${teksPersen(((terpilih.feeTotal + terpilih.feeTanpaNama) / terpilih.contractValue) * 100)} dari kontrak ${formatRupiah(terpilih.contractValue)}`
                        : "kontrak belum diisi"}
                    </span>
                  </p>
                  <Mistar p={terpilih} ket={ket} />
                  <ul className="kwt__orang-orang">
                    {rincian.map((r) => {
                      const skala = Math.max(r.hak, r.dibayar, 1);
                      return (
                        <li
                          key={r.id}
                          className={`kwt__orang${r.id === "tanpa" ? " is-tanpa" : ""}${sorotOrang && sorotOrang !== r.id ? " is-redup" : ""}`}
                          style={{ "--kwt-w": WARNA_JENIS(r.jenis), "--kwt-bayar": r.dibayar / skala } as React.CSSProperties}
                          onPointerEnter={(e) => e.pointerType === "mouse" && setSorotOrang(r.id)}
                        >
                          <span className="kwt__inisial" aria-hidden="true">
                            {r.id === "tanpa" ? "?" : inisial(r.nama)}
                          </span>
                          <span className="kwt__orangnama">
                            <b>{r.nama}</b>
                            <span>
                              {r.id === "tanpa"
                                ? "biaya fee belum ditautkan ke nama"
                                : r.peran.join(" · ") || `${LABEL_JENIS_ANGGOTA[r.jenis as JenisAnggota]} · fee lepas`}
                            </span>
                          </span>
                          <span className="kwt__orangbatang" aria-hidden="true">
                            <i />
                          </span>
                          <span className="kwt__orangnilai">
                            <b>{formatRupiah(r.dibayar)}</b>
                            <span>{r.hak > 0 ? `dari hak ${formatRupiah(r.hak)}` : "dibayar"}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** Rupiah besar: ribuan terakhir dikecilkan seperti nominal kit. */
function RupiahBesar({ n }: { n: number }) {
  const s = formatRupiah(n);
  const i = s.lastIndexOf(".");
  return (
    <>
      <b>{i < 0 ? s : s.slice(0, i)}</b>
      {i >= 0 && <span>{s.slice(i)}</span>}
    </>
  );
}

/* Mistar porsi fee terhadap kontrak, dipotong per penerima menurut warna
   jenisnya; arsir amber = fee tanpa nama. Strip skala di BAWAHNYA, bukan di
   belakang tulisan. */
function Mistar({ p, kecil, ket }: { p: FeeProyek; kecil?: boolean; ket?: ReturnType<typeof pemberiKet> }) {
  const kontrak = p.contractValue && p.contractValue > 0 ? p.contractValue : null;
  if (!kontrak) return <span className={`kwt__mistar is-kosong${kecil ? " kwt__mistar--kecil" : ""}`} aria-hidden="true" />;
  const ruas = [
    ...p.orang.map((o) => ({ id: o.teamMemberId, nama: o.name, nilai: o.amount, warna: WARNA_JENIS(o.kind), tanpa: false })),
    ...(p.feeTanpaNama > 0 ? [{ id: "tanpa", nama: "Tanpa nama", nilai: p.feeTanpaNama, warna: "", tanpa: true }] : []),
  ];
  let kiri = 0;
  return (
    <span className={`kwt__mistar${kecil ? " kwt__mistar--kecil" : ""}`} aria-hidden="true">
      {ruas.map((r) => {
        const lebar = Math.max(0, Math.min(100 - kiri, (r.nilai / kontrak) * 100));
        const el = (
          <span
            key={r.id}
            className={`kwt__ruas${r.tanpa ? " is-tanpa" : ""}`}
            style={{ left: `${kiri}%`, width: `${lebar}%`, background: r.tanpa ? undefined : r.warna }}
            {...(ket
              ? ket(() => ({
                  judul: r.nama,
                  baris: [
                    { warna: r.tanpa ? "var(--warn)" : r.warna, label: "Fee", nilai: formatRupiah(r.nilai) },
                    { label: "Dari kontrak", nilai: teksPersen((r.nilai / kontrak) * 100) },
                  ],
                }))
              : {})}
          />
        );
        kiri += lebar;
        return el;
      })}
    </span>
  );
}

/* =============================================================================
   Kuitansi — selembar, seperti yang ditandatangani penerima fee.
   ============================================================================= */

function Kuitansi({
  k,
  proyek,
  studio,
  ayun,
}: {
  k: Bonggol;
  proyek: FeeProyek;
  studio: { nama: string; kota: string | null };
  ayun: boolean;
}) {
  const nomor = k.no === null ? "belum ditulis" : `FP-${kodeProyek(proyek.projectTitle)}-${String(k.no).padStart(2, "0")}`;
  const dibayar = k.keadaan === "dibayar";
  return (
    <article className={`kwt__kuitansi${dibayar ? "" : " is-belum"}${ayun ? " is-ayun" : ""}`} aria-label={`Kuitansi ${nomor}`}>
      <header className="kwt__kkop">
        <p className="kwt__kjudul">Kuitansi</p>
        <p className="kwt__kno">
          No. <b>{nomor}</b>
        </p>
      </header>
      <dl className="kwt__kbaris">
        <div>
          <dt>Telah terima dari</dt>
          <dd>{studio.nama}</dd>
        </div>
        <div>
          <dt>Uang sejumlah</dt>
          <dd>
            <span className="kwt__kuang">{formatRupiah(k.nominal)}</span>
          </dd>
        </div>
        <div>
          <dt>Terbilang</dt>
          <dd className="kwt__kterbilang"># {terbilang(k.nominal)} #</dd>
        </div>
        <div>
          <dt>Untuk pembayaran</dt>
          <dd>
            {k.untuk.charAt(0).toUpperCase() + k.untuk.slice(1)} — proyek {proyek.projectTitle}
          </dd>
        </div>
      </dl>
      <footer className="kwt__kkaki">
        <div className="kwt__ktempat">
          {dibayar ? (
            <>
              {studio.kota ? `${studio.kota}, ` : ""}
              {tanggalPanjang(k.tanggal!)}
            </>
          ) : (
            <span className="kwt__kstatus">
              <Ikon ikon={Hourglass} ukuran={12} />
              {k.keadaan === "jatuh_tempo" ? "Jatuh tempo — belum dibayar" : "Menunggu tahapnya tiba"}
            </span>
          )}
        </div>
        <div className="kwt__kttd">
          <span className="kwt__kttdlabel">Yang menerima,</span>
          <span className="kwt__kttdruang">
            {dibayar ? (
              <CapLunas tanggal={k.tanggal!} studio={inisial(studio.nama) || "ST"} id={k.id} kelas="kwt" />
            ) : (
              <a className="kwt__kbayar" href={`/admin/proyek/satu?id=${encodeURIComponent(proyek.projectId)}#tim-bayaran`}>
                Bayar di Satu Proyek
                <Ikon ikon={ArrowRight} ukuran={13} />
              </a>
            )}
          </span>
          <span className={`kwt__kttdnama${k.nama ? "" : " is-tanpa"}`}>{k.nama ?? "belum ditautkan ke nama"}</span>
        </div>
      </footer>
    </article>
  );
}

function Kerangka(): ReactNode {
  return (
    <div className="kwt kwt--rangka" aria-busy="true">
      <div className="kwt__papan">
        <aside className="kwt__sisi">
          <div className="kwt__kop">
            <span className="rk rk--gelap" style={{ width: 140, height: 10 }} />
            <span className="rk rk--gelap" style={{ width: 210, height: 26 }} />
            <span className="rk rk--gelap" style={{ width: 180, height: 10 }} />
          </div>
          <div className="kwt__blok-blok">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="kwt__blok kwt__blok--rangka" />
            ))}
          </div>
        </aside>
        <section className="kwt__lembar" />
      </div>
    </div>
  );
}

export function FeeKit() {
  return (
    <RequireAuth skeleton={<Kerangka />}>
      <Isi />
    </RequireAuth>
  );
}
