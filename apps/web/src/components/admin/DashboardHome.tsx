import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { RequireAuth } from "./RequireAuth";
import { SkeletonKartu, SkeletonStat, SkeletonTeks } from "../ui/Skeleton";
import { KartuAngka } from "../ui/data/KartuAngka";
import { KartuDonat, type IrisDonat } from "../ui/data/KartuDonat";
import { ChartArusKas } from "../ui/data/ChartArusKas";
import { formatRupiah } from "../../lib/format";
import { ambilNotifikasi, TAHAP_PROYEK, type BarisNotifikasi } from "../../lib/notifikasi";
import {
  ambilSettings, ambilRingkasanKeuangan, ambilBulanan, profilTersimpan,
  bacaCache, tulisCache,
  type Profil, type Proyek, type FinanceOverview, type BarisBulanan,
} from "../../lib/admin";

/* =============================================================================
   Dashboard — susunan Coinest "01. Dashboard (v1)".

   Angkanya diambil dari frame Figma-nya, bukan dikira-kira: badan 1192px
   terbagi tiga kolom 283 / 586 / 283 dengan jarak 20px mendatar maupun tegak,
   dan tiap kartu berpadding 16px.

   Isinya yang berbeda, dan memang harus: Coinest aplikasi keuangan pribadi
   dengan kartu debit, rencana tabungan, dan promo. Yang setara maknanya di
   studio arsitektur:

     kartu debit gelap   -> kas studio + sapaan
     tombol cepat        -> empat pekerjaan yang paling sering dimulai
     bar pengeluaran     -> laba bersih terhadap kas masuk
     daftar rencana      -> proyek yang sedang berjalan
     tiga kartu statistik-> kas masuk, piutang, biaya
     grafik kolom        -> arus kas dua belas bulan
     tabel               -> laba per proyek
     donat + segmented   -> rincian beban
     daftar log          -> pekerjaan yang belum ditangani

   Kolom kanan dashboard ini SEBELUMNYA kosong — elemennya ada, isinya tidak
   pernah dibuat. Itu yang paling terlihat dari keseluruhan panel.
   ============================================================================= */

/** Seberapa cepat sorot mengejar kursor tiap frame. Makin kecil makin lembut. */
const KEJAR = 0.11;

const SALAM = "Selamat Datang.";

/* Irama ketikan, dalam milidetik. Menghapus dibuat dua kali lebih cepat
   daripada mengetik: begitulah orang benar-benar menghapus, dan penghapusan
   selambat pengetikan terasa seperti halaman yang macet. */
const KETIK = 85;
const TAHAN_PENUH = 2000;
const HAPUS = 40;
const TAHAN_KOSONG = 600;

/**
 * Mengetik SALAM huruf demi huruf, menahannya sebentar, menghapusnya, lalu
 * mengulang. Dipakai satu setTimeout berantai, bukan setInterval: tiap tahap
 * punya jeda sendiri, dan interval tunggal tidak bisa menahan lebih lama di
 * ujung tanpa menghitung tick — cara yang mudah meleset satu langkah.
 *
 * Yang meminta gerakan dikurangi langsung mendapat kalimat utuh yang diam.
 */
function useKetikan() {
  const [n, setN] = useState(0);
  const [hapus, setHapus] = useState(false);
  const [diam, setDiam] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setDiam(true);
  }, []);

  useEffect(() => {
    if (diam) return;

    const selesaiKetik = n === SALAM.length;
    const jeda = !hapus ? (selesaiKetik ? TAHAN_PENUH : KETIK) : (n > 0 ? HAPUS : TAHAN_KOSONG);

    const t = setTimeout(() => {
      if (!hapus && !selesaiKetik) setN(n + 1);
      else if (!hapus) setHapus(true);
      else if (n > 0) setN(n - 1);
      else setHapus(false);
    }, jeda);

    return () => clearTimeout(t);
  }, [n, hapus, diam]);

  return diam ? SALAM : SALAM.slice(0, n);
}

/* --- Angka pendek untuk ruang sempit -------------------------------------- */

/**
 * "Rp1,2 jt", "Rp340 rb". Dipakai di kotak selebar 96px di kaki kartu gelap,
 * tempat angka rupiah penuh pasti terpotong.
 *
 * Rupiah penuh tetap dipakai di mana pun ruangnya cukup — angka yang
 * dibulatkan bagus untuk sekilas, tapi buruk untuk dicocokkan dengan mutasi
 * bank, dan mencocokkan itu yang benar-benar dikerjakan pemilik.
 */
function rupiahPendek(n: number): string {
  const minus = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `${minus}Rp${(a / 1_000_000_000).toFixed(1).replace(".", ",")} M`;
  if (a >= 1_000_000) return `${minus}Rp${(a / 1_000_000).toFixed(1).replace(".", ",")} jt`;
  if (a >= 1_000) return `${minus}Rp${Math.round(a / 1_000)} rb`;
  return formatRupiah(n);
}

/* --- Kartu gelap: kas studio + sapaan -------------------------------------- */

/**
 * Widget Card Coinest — satu-satunya bidang gelap di halaman terang, dan itu
 * memang perannya: menandai mana yang paling penting.
 *
 * Titik-titiknya dua lapis. Lapis dasar selalu terlihat samar supaya bidangnya
 * tidak terbaca sebagai hijau kosong; lapis sorot sedikit lebih besar dan
 * lebih terang, tapi ditutup topeng radial yang mengikuti kursor sehingga
 * hanya muncul di sekitar penunjuk.
 *
 * Dua hal yang tidak sesederhana kelihatannya:
 *
 * 1. Sorotnya MENGEJAR kursor, bukan menempel padanya. Tiap frame posisinya
 *    digeser sebagian jarak ke sasaran, jadi gerakannya menyusul dengan
 *    lembut alih-alih melompat. Transition CSS tidak bisa dipakai di sini:
 *    yang berubah adalah posisi di dalam mask-image, dan properti itu tidak
 *    bisa diinterpolasi browser.
 * 2. Posisinya dikirim lewat custom property, bukan state React. mousemove
 *    menyala puluhan kali per detik dan render ulang sesering itu percuma
 *    untuk sesuatu yang cuma menggeser gradien.
 *
 * Sorot hanya hidup selama kursor ada di dalam kartu ini. Begitu keluar ia
 * dipudarkan lewat CSS (:hover), bukan digeser ke luar layar — menggeser
 * berarti menyeret lingkaran terang melintasi seluruh bidang dulu.
 */
function KartuKas({ nama, profil, keu, proyekAktif }: {
  nama: string | null;
  profil: Profil | null;
  keu: FinanceOverview | null;
  proyekAktif: number | null;
}) {
  const kartu = useRef<HTMLElement>(null);
  const sasaran = useRef({ x: -999, y: -999 });
  const posisi = useRef({ x: -999, y: -999 });
  const ketikan = useKetikan();

  useEffect(() => {
    const el = kartu.current;
    if (!el) return;

    // Yang meminta gerakan dikurangi tidak dapat pengejaran sama sekali:
    // sorotnya menempel langsung di kursor.
    const halus = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let hidup = true;
    let frame = 0;

    function langkah() {
      if (!hidup) return;
      const p = posisi.current;
      const s = sasaran.current;
      if (halus) {
        p.x += (s.x - p.x) * KEJAR;
        p.y += (s.y - p.y) * KEJAR;
      } else {
        p.x = s.x;
        p.y = s.y;
      }
      el!.style.setProperty("--mx", `${p.x}px`);
      el!.style.setProperty("--my", `${p.y}px`);
      frame = requestAnimationFrame(langkah);
    }

    frame = requestAnimationFrame(langkah);
    return () => { hidup = false; cancelAnimationFrame(frame); };
  }, []);

  function titikKursor(e: React.MouseEvent<HTMLElement>) {
    const k = kartu.current!.getBoundingClientRect();
    return { x: e.clientX - k.left, y: e.clientY - k.top };
  }

  return (
    <article
      className="dashkas"
      ref={kartu}
      onMouseMove={(e) => { sasaran.current = titikKursor(e); }}
      /* Saat masuk, posisinya disamakan dulu dengan titik masuk. Tanpa ini
         sorotnya meluncur dari tempat kursor terakhir keluar. Tidak terlihat
         karena lapisannya masih tembus pandang saat itu. */
      onMouseEnter={(e) => { const t = titikKursor(e); sasaran.current = t; posisi.current = { ...t }; }}
    >
      <span className="dashdot dashdot--dasar" aria-hidden="true" />
      <span className="dashdot dashdot--sorot" aria-hidden="true" />

      <header className="dashkas__head">
        {/* Sengaja ikon, bukan logo studio: kartu ini menandai "sedang masuk
            sebagai siapa", dan logo studio sudah berdiri sendiri di sidebar.
            Dua tempat menampilkan logo yang sama membuat keduanya berebut
            perhatian. */}
        <span className="dashkas__ubin"><Icon name="building" size={20} /></span>
        <span className="dashkas__peran">
          <Icon name="crown" size={13} />
          {profil?.isMasterAdmin ? "Master admin" : "Staf"}
        </span>
      </header>

      {/* Dua lapis di kotak grid yang sama. Lapis pengukur berisi kalimat
          UTUH dan tak terlihat — ia yang menetapkan lebar baris, jadi
          lebarnya tidak berubah selama diketik. Tanpa itu kalimatnya
          bergeser setiap satu huruf bertambah.

          Teks ketikannya disembunyikan dari pembaca layar dan digantikan
          aria-label: kalimat yang tumbuh huruf demi huruf akan dibacakan
          ulang dari awal setiap kali satu huruf bertambah. */}
      <p className="dash-salam" aria-label={SALAM}>
        <span className="dash-salam__ukur" aria-hidden="true">
          {SALAM}
          <span className="dash-salam__caret" />
        </span>
        <span className="dash-salam__isi" aria-hidden="true">
          {ketikan}
          <span className="dash-salam__caret" />
        </span>
      </p>

      <p className="dashkas__nama">
        {nama ?? <span className="skeleton" style={{ height: "1rem", width: "9rem" }} />}
      </p>

      <footer className="dashkas__kaki">
        <span className="dashkas__blok">
          <span className="dashkas__blok-label">Kas masuk</span>
          <span className="dashkas__blok-nilai">
            {keu ? rupiahPendek(keu.kasMasuk) : "—"}
          </span>
        </span>
        <span className="dashkas__kanan">
          <span className="dashkas__blok dashkas__blok--kecil">
            <span className="dashkas__blok-label">Proyek</span>
            <span className="dashkas__blok-nilai">{proyekAktif ?? "—"}</span>
          </span>
          <span className="dashkas__blok dashkas__blok--kecil">
            <span className="dashkas__blok-label">Piutang</span>
            <span className="dashkas__blok-nilai">
              {keu ? rupiahPendek(keu.piutang) : "—"}
            </span>
          </span>
        </span>
      </footer>
    </article>
  );
}

/* --- Empat tombol cepat ---------------------------------------------------- */

/* Button Group Coinest: empat tombol setara dipisah garis tegak tipis.
   Isinya empat pekerjaan yang paling sering DIMULAI dari nol — bukan empat
   halaman yang paling sering dibuka, karena untuk itu sudah ada sidebar. */
const AKSI = [
  { ke: "/admin/proyek/baru", ikon: "projectPlus" as const, label: "Proyek" },
  { ke: "/admin/keuangan", ikon: "cash" as const, label: "Kas" },
  { ke: "/admin/jurnal", ikon: "edit" as const, label: "Jurnal" },
  { ke: "/admin/pesan", ikon: "inquiry" as const, label: "Pesan" },
];

function AksiCepat() {
  return (
    <nav className="dashaksi" aria-label="Aksi cepat">
      {AKSI.map((a) => (
        <a key={a.ke} className="dashaksi__btn" href={a.ke}>
          <span className="dashaksi__ubin"><Icon name={a.ikon} size={18} /></span>
          <span className="dashaksi__label">{a.label}</span>
        </a>
      ))}
    </nav>
  );
}

/* --- Kartu bar: laba bersih terhadap kas masuk ----------------------------- */

function KartuLaba({ keu }: { keu: FinanceOverview | null }) {
  const kas = keu?.kasMasuk ?? 0;
  const laba = keu?.labaBersih ?? 0;
  /* Persentase dihitung terhadap kas yang BENAR-BENAR masuk, bukan terhadap
     nilai kontrak — keputusan yang sudah tercatat: nilai kontrak adalah
     janji, bukan uang. Kas nol berarti tidak ada penyebut, dan bar-nya
     kosong; menampilkan 0% akan terbaca sebagai "rugi total". */
  const persen = kas > 0 ? Math.round((laba / kas) * 100) : null;
  const lebar = kas > 0 ? Math.max(0, Math.min(100, (laba / kas) * 100)) : 0;

  return (
    <article className="dashbar">
      <header className="dashbar__head">
        <h2 className="dashbar__judul">Laba bersih</h2>
        <a className="dashbar__tautan" href="/admin/keuangan" aria-label="Buka Keuangan">
          <Icon name="chevronRight" size={16} />
        </a>
      </header>

      <p className="dashbar__baris">
        <span className={`dashbar__nilai${laba < 0 ? " angka-minus" : ""}`}>
          {keu ? formatRupiah(laba) : "—"}
        </span>
        <span className="dashbar__ket">dari {keu ? rupiahPendek(kas) : "—"} kas masuk</span>
        <span className="dashbar__persen">{persen === null ? "—" : `${persen}%`}</span>
      </p>

      <div
        className="dashbar__rel"
        role="progressbar"
        aria-label="Laba bersih terhadap kas masuk"
        aria-valuenow={persen ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="dashbar__isi" style={{ width: `${lebar}%` }} />
      </div>
    </article>
  );
}

/* --- Daftar proyek berjalan ------------------------------------------------ */

function DaftarProyek({ proyek, keu }: { proyek: Proyek[] | null; keu: FinanceOverview | null }) {
  /* "Berjalan" = belum sampai pelunasan. Definisi yang sama dengan penghitung
     di topbar, dan sengaja: dua angka yang mengaku menghitung hal yang sama
     tapi berbeda isinya adalah cara tercepat membuat panel tidak dipercaya. */
  const jalan = (proyek ?? []).filter((p) => p.pipelineStage !== "pelunasan").slice(0, 3);

  return (
    <article className="dashplan">
      <header className="dashplan__head">
        <h2 className="dashplan__judul">Proyek berjalan</h2>
        <a className="dashplan__semua" href="/admin/proyek">Semua</a>
      </header>

      <div className="dashplan__total">
        <span className="dashplan__total-label">Nilai kontrak</span>
        <span className="dashplan__total-nilai">
          {keu ? formatRupiah(keu.totalKontrak) : "—"}
        </span>
      </div>

      <div className="dashplan__list">
        {proyek === null
          ? [0, 1, 2].map((i) => <span key={i} className="skeleton dashplan__rangka" />)
          : jalan.length === 0
            ? <p className="dashplan__kosong">Belum ada proyek yang sedang berjalan.</p>
            : jalan.map((p) => {
                const baris = keu?.proyek.find((r) => r.projectId === p.id);
                const nilai = p.contractValue ?? baris?.contractValue ?? null;
                const masuk = baris?.received ?? p.paidTotal ?? 0;
                const pct = nilai && nilai > 0 ? Math.min(100, (masuk / nilai) * 100) : 0;
                return (
                  <a key={p.id} className="dashplan__kartu" href={`/admin/proyek/${p.id}`}>
                    <span className="dashplan__kartu-atas">
                      <span className="dashplan__kartu-judul">{p.title}</span>
                      <span className="dashplan__kartu-tahap">
                        {TAHAP_PROYEK[p.pipelineStage ?? ""] ?? "Proposal"}
                      </span>
                    </span>
                    <span className="dashplan__kartu-rel">
                      <span className="dashplan__kartu-isi" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="dashplan__kartu-bawah">
                      <span>{rupiahPendek(masuk)} masuk</span>
                      <span>{nilai ? rupiahPendek(nilai) : "belum berkontrak"}</span>
                    </span>
                  </a>
                );
              })}
      </div>
    </article>
  );
}

/* --- Tabel laba per proyek ------------------------------------------------- */

function TabelLaba({ keu }: { keu: FinanceOverview | null }) {
  const baris = (keu?.proyek ?? []).slice(0, 6);

  return (
    <article className="dashtabel">
      <header className="dashtabel__head">
        <h2 className="dashtabel__judul">Laba per proyek</h2>
        <a className="dashtabel__semua" href="/admin/keuangan">Buka Keuangan</a>
      </header>

      {keu === null
        ? <span className="skeleton dashtabel__rangka" />
        : baris.length === 0
          ? <p className="dashtabel__kosong">Belum ada proyek yang punya angka.</p>
          : (
            <div className="dashtabel__gulir">
              <table className="dashtabel__tabel">
                <thead>
                  <tr>
                    <th scope="col">Proyek</th>
                    <th scope="col">Diterima</th>
                    <th scope="col">Biaya</th>
                    <th scope="col">Laba bersih</th>
                  </tr>
                </thead>
                <tbody>
                  {baris.map((r) => (
                    <tr key={r.projectId}>
                      <th scope="row">{r.projectTitle}</th>
                      <td>{formatRupiah(r.received)}</td>
                      <td>{formatRupiah(r.costsTotal)}</td>
                      <td className={r.labaBersih < 0 ? "angka-minus" : undefined}>
                        {formatRupiah(r.labaBersih)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
    </article>
  );
}

/* --- Daftar pekerjaan yang belum ditangani --------------------------------- */

/* Div Logs Coinest, dinaikkan jadi isi utama halaman. Isinya daftar yang SAMA
   dengan lonceng di topbar — diturunkan dari sumber tunggal lib/notifikasi.ts,
   bukan dihitung ulang di sini. Dua daftar berisi hal yang sama pasti
   menyimpang, dan yang jarang dilihat yang salah (jebakan #32 di CLAUDE.md). */
function Antrean({ baris }: { baris: BarisNotifikasi[] | null }) {
  const n = baris?.length ?? 0;
  return (
    <article className="dashlog dashlog--utama">
      <header className="dashlog__head">
        <h2 className="dashlog__judul">
          Yang menunggu Anda
          {n > 0 && <span className="dashlog__hitung">{n}</span>}
        </h2>
        <a className="dashlog__semua" href="/admin/notifikasi">Semua</a>
      </header>

      <div className="dashlog__list">
        {baris === null
          ? [0, 1, 2, 3].map((i) => <span key={i} className="skeleton dashlog__rangka" />)
          : baris.length === 0
            ? (
              <p className="dashlog__kosong">
                <Icon name="check" size={16} />
                Tidak ada yang menunggu. Semua sudah ditangani.
              </p>
            )
            : baris.slice(0, 6).map((n) => (
              <a key={n.id} className="dashlog__baris" href={n.ke}>
                <span className="dashlog__ubin"><Icon name={n.ikon} size={16} /></span>
                <span className="dashlog__teks">
                  <span className="dashlog__judul-baris">{n.judul}</span>
                  <span className="dashlog__detail">{n.detail}</span>
                </span>
                {n.waktu && <span className="dashlog__waktu">{n.waktu}</span>}
              </a>
            ))}
      </div>
    </article>
  );
}

/* --- Sebaran tahap proyek --------------------------------------------------- */

/* Tujuh tahap pipeline studio, dengan jumlah proyek di masing-masing.
   Bukan hiasan: dengan ~7 klien sebulan, tumpukan di satu tahap adalah satu-
   satunya tanda dini bahwa ada yang macet — lima proyek menggantung di
   "Proposal" berarti penawaran tidak pernah ditutup, lima di "Desain 2"
   berarti revisi tidak pernah selesai.

   Tahap yang KOSONG tetap ditulis. Justru kekosongannya yang memberi tahu:
   pipeline tanpa satu pun proposal berarti bulan depan tidak ada pekerjaan. */
function Pipeline({ proyek }: { proyek: Proyek[] | null }) {
  const urut = Object.keys(TAHAP_PROYEK);
  const hitung = urut.map((k) => ({
    kunci: k,
    label: TAHAP_PROYEK[k],
    n: (proyek ?? []).filter((p) => (p.pipelineStage ?? "proposal") === k).length,
  }));
  const puncak = Math.max(1, ...hitung.map((h) => h.n));

  return (
    <article className="dashpipe">
      <header className="dashpipe__head">
        <h2 className="dashpipe__judul">Tahap proyek</h2>
        <a className="dashpipe__semua" href="/admin/proyek">Semua</a>
      </header>

      <div className="dashpipe__list">
        {proyek === null
          ? [0, 1, 2, 3, 4, 5, 6].map((i) => <span key={i} className="skeleton dashpipe__rangka" />)
          : hitung.map((h) => (
            <div className="dashpipe__baris" key={h.kunci} data-kosong={h.n === 0 || undefined}>
              <span className="dashpipe__label">{h.label}</span>
              <span className="dashpipe__rel">
                <span className="dashpipe__isi" style={{ width: `${(h.n / puncak) * 100}%` }} />
              </span>
              <span className="dashpipe__n">{h.n}</span>
            </div>
          ))}
      </div>
    </article>
  );
}

/* --- Halaman --------------------------------------------------------------- */

const LABEL_BEBAN: Record<string, string> = {
  freelancer: "Freelancer",
  operasional: "Operasional",
  prinsipal: "Prinsipal",
  lainnya: "Lainnya",
};

/**
 * Nama kategori yang tidak ada di peta di atas TETAP harus terbaca.
 *
 * Kolomnya enum Postgres, dan enum bertambah lebih sering daripada peta ini
 * diperbarui — begitu ada nilai baru, legenda donat menuliskan nilai
 * mentahnya: "tenaga_kerja", "management_fee". Itu nama kolom database yang
 * bocor ke layar orang yang tidak pernah melihat databasenya.
 */
function labelBeban(kategori: string): string {
  const tahu = LABEL_BEBAN[kategori];
  if (tahu) return tahu;
  const rapi = kategori.replace(/[_-]+/g, " ").trim();
  return rapi.charAt(0).toUpperCase() + rapi.slice(1);
}

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN_PANJANG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function Isi() {
  /* Nilai awal dibaca dari cache, permintaan segar tetap jalan di belakang —
     pola stale-while-revalidate yang sama dengan halaman admin lain. Yang
     MENULIS cache di sini cuma dashboard sendiri untuk kunci miliknya; kunci
     "settings" ikut ditulis karena halaman ini pemakai pertamanya setiap
     kali panel dibuka. */
  const [nama, setNama] = useState<string | null>(
    () => bacaCache<{ studioName?: string }>("settings")?.studioName ?? null,
  );
  const [profil, setProfil] = useState<Profil | null>(null);
  const [keu, setKeu] = useState<FinanceOverview | null>(() => bacaCache<FinanceOverview>("dash-keu"));
  const [bulanan, setBulanan] = useState<BarisBulanan[] | null>(() => bacaCache<BarisBulanan[]>("dash-bulanan"));
  const [notif, setNotif] = useState<BarisNotifikasi[] | null>(null);
  const [proyek, setProyek] = useState<Proyek[] | null>(null);
  const [aktif, setAktif] = useState<number | null>(null);

  useEffect(() => {
    setProfil(profilTersimpan());

    ambilSettings()
      .then((s) => { tulisCache("settings", s); setNama(s.studioName); })
      .catch(() => setNama((l) => l ?? "Dirga Pahlevi Architecture"));

    /* Empat permintaan berjalan bersamaan dan masing-masing menyalakan
       bagiannya sendiri. Satu yang gagal tidak boleh mengosongkan seluruh
       halaman — dashboard yang separuh terisi masih berguna. */
    ambilRingkasanKeuangan()
      .then((d) => { tulisCache("dash-keu", d); setKeu(d); })
      .catch(() => { /* kartu keuangan tetap menampilkan garis pendek */ });

    ambilBulanan(null, 12)
      .then((d) => { tulisCache("dash-bulanan", d); setBulanan(d); })
      .catch(() => setBulanan((l) => l ?? []));

    ambilNotifikasi()
      .then((d) => { setNotif(d.notifikasi); setProyek(d.proyek); setAktif(d.proyekAktif); })
      .catch(() => { setNotif([]); setProyek([]); setAktif(0); });
  }, []);

  const titikArus = useMemo(
    () => (bulanan ?? []).map((b) => {
      const [th, bl] = b.bulan.split("-");
      const i = Number(bl) - 1;
      return {
        label: BULAN_PENDEK[i] ?? b.bulan,
        labelPanjang: `${BULAN_PANJANG[i] ?? b.bulan} ${th}`,
        nilai: { masuk: b.kasMasuk, biaya: b.biaya },
      };
    }),
    [bulanan],
  );

  const iris: IrisDonat[] = useMemo(
    () => (keu?.bebanKategori ?? []).map((b, i) => ({
      label: labelBeban(b.kategori),
      nilai: b.nilai,
      warna: `var(--chart-cat-${(i % 5) + 1})`,
    })),
    [keu],
  );

  return (
    <div className="dashgrid">
      <div className="dashgrid__kol dashgrid__kol--kiri">
        <KartuKas nama={nama} profil={profil} keu={keu} proyekAktif={aktif} />
        <AksiCepat />
        <KartuLaba keu={keu} />
        <DaftarProyek proyek={proyek} keu={keu} />
      </div>

      <div className="dashgrid__kol dashgrid__kol--tengah">
        {/* Antrean duduk PALING ATAS di kolom terlebar, bukan terselip di
            kolom sempit sebelah kanan. Halaman ini bernama Hari Ini, dan
            yang menjawab pertanyaan "hari ini saya harus apa" cuma daftar
            ini — angka kas dan grafik menjawab pertanyaan lain. */}
        <Antrean baris={notif} />

        <div className="dashstat">
          <KartuAngka
            label="Kas masuk"
            nilai={keu ? formatRupiah(keu.kasMasuk) : "—"}
            ikon="cash"
            delta={keu ? `${keu.proyek.length} proyek tercatat` : undefined}
            deltaNada="netral"
          />
          <KartuAngka
            label="Piutang"
            nilai={keu ? formatRupiah(keu.piutang) : "—"}
            ikon="receipt"
            delta={keu ? "belum diterima" : undefined}
            deltaNada="netral"
          />
          <KartuAngka
            label="Total biaya"
            nilai={keu ? formatRupiah(keu.totalBiaya) : "—"}
            ikon="bank"
            delta={keu ? "keluar dari kas" : undefined}
            deltaNada="netral"
          />
        </div>

        <ChartArusKas
          judul="Arus kas dua belas bulan"
          seri={[
            { kunci: "masuk", label: "Kas masuk", warna: "var(--chart-1)", isi: true },
            { kunci: "biaya", label: "Biaya", warna: "var(--chart-3)", gaya: "putus" },
          ]}
          data={titikArus}
        />

        <TabelLaba keu={keu} />
      </div>

      <div className="dashgrid__kol dashgrid__kol--kanan">
        <Pipeline proyek={proyek} />
        <KartuDonat
          judul="Rincian beban"
          subjudul="Ke mana uang studio keluar"
          iris={iris}
          kakiLabel="Total biaya"
          kakiNilai={keu ? formatRupiah(keu.totalBiaya) : "—"}
          format={formatRupiah}
        />
      </div>
    </div>
  );
}

export function DashboardHome() {
  return (
    <RequireAuth skeleton={
      <div className="stack" style={{ gap: "var(--space-5)" }}>
        <SkeletonKartu ikon="dashboard" anak={<SkeletonTeks baris={2} />} />
        <SkeletonStat jumlah={3} />
      </div>
    }>
      <Isi />
    </RequireAuth>
  );
}
