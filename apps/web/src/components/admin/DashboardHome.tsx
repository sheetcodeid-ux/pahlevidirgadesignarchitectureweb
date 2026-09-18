import { useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "../ui/Icon";
import { RequireAuth } from "./RequireAuth";
import { SkeletonKartu, SkeletonStat, SkeletonTeks } from "../ui/Skeleton";
import { formatRupiah } from "../../lib/format";
import { ambilNotifikasi, TAHAP_PROYEK, type BarisNotifikasi } from "../../lib/notifikasi";
import {
  ambilSettings, ambilRingkasanKeuangan, ambilBulanan, profilTersimpan,
  bacaCache, tulisCache,
  type Profil, type Proyek, type FinanceOverview, type BarisBulanan,
} from "../../lib/admin";

/* =============================================================================
   Dashboard — frame Figma "01. Dashboard (v1) - Desktop" (node 3:1069).

   Dibangun dari angka framenya, bukan dari tata letak lama yang diwarnai
   ulang. Badan 1192px terbagi tiga kolom 283 / 586 / 283 dengan jarak 20px
   mendatar maupun tegak; tiap kartu berpadding 16px, bergaris 1px #E5E6E6,
   dan ber-radius 16px.

   Isinya yang disesuaikan, dan memang harus: Coinest aplikasi keuangan
   pribadi dengan kartu debit, rencana tabungan, dan riwayat transfer. Yang
   setara maknanya di studio arsitektur:

     Widget Card (kartu debit)   -> kas studio, nama studio, piutang
     Button Group (4 tombol)     -> empat pekerjaan yang paling sering dimulai
     Daily Limit (bar)           -> laba bersih terhadap kas yang masuk
     Saving Plans (kartu target) -> proyek berjalan, kontrak sebagai target
     Card Statistic x3           -> kas masuk, total biaya, laba bersih
     Cashflow (batang dua arah)  -> kas masuk ke atas, biaya ke bawah
     Table                       -> laba per proyek
     Statistic (donat)           -> rincian kas masuk dan beban
     Recent Activity (log)       -> pekerjaan yang belum ditangani

   Yang DIBUANG dan perlu disebut: sapaan berketik "Selamat Datang." beserta
   bidang bertitiknya. Frame ini tidak punya keduanya — slot yang dulu
   ditempatinya adalah baris "Name" di kartu, dan di sana Figma menaruh satu
   baris nama saja.
   ============================================================================= */

/* --- Angka pendek untuk ruang sempit -------------------------------------- */

/**
 * "Rp1,2 jt", "Rp340 rb". Dipakai di kaki kartu gelap dan kaki kartu proyek,
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

function persen(bagian: number, dari: number): number | null {
  return dari > 0 ? (bagian / dari) * 100 : null;
}

/** "12,5%" — satu angka di belakang koma, ejaan Indonesia. */
function tulisPersen(p: number | null): string {
  return p === null ? "—" : `${p.toFixed(1).replace(".", ",")}%`;
}

/* --- Kartu gelap: kas studio ----------------------------------------------- */

/* Widget Card (3:1128): bidang Green-Dark, radius 16, padding 16, jarak isi
   27px. Satu-satunya bidang gelap di halaman terang, dan itu memang
   perannya — menandai mana yang paling penting. */
function KartuKas({ nama, profil, keu, proyekAktif }: {
  nama: string | null;
  profil: Profil | null;
  keu: FinanceOverview | null;
  proyekAktif: number | null;
}) {
  return (
    <article className="dashkas">
      <header className="dashkas__head">
        {/* Slot "symbol" 23px di kiri dan "Union" di kanan. Di Coinest keduanya
            lambang penerbit kartu; di sini lambang studio dan penanda peran
            akun — dengan dua akun penulis, yang sedang dipakai perlu terbaca
            tanpa menekan apa pun. */}
        <span className="dashkas__ubin"><Icon name="building" size={20} /></span>
        <span className="dashkas__peran">
          <Icon name="crown" size={12} />
          {profil?.isMasterAdmin ? "Master admin" : "Staf"}
        </span>
      </header>

      <p className="dashkas__nama">
        {nama ?? <span className="skeleton" style={{ height: "1.25rem", width: "10rem" }} />}
      </p>

      <footer className="dashkas__kaki">
        <span className="dashkas__blok">
          <span className="dashkas__blok-label">Kas masuk</span>
          <span className="dashkas__blok-nilai">{keu ? rupiahPendek(keu.kasMasuk) : "—"}</span>
        </span>
        <span className="dashkas__kanan">
          <span className="dashkas__blok dashkas__blok--kecil">
            <span className="dashkas__blok-label">PROYEK</span>
            <span className="dashkas__blok-nilai">{proyekAktif ?? "—"}</span>
          </span>
          <span className="dashkas__blok dashkas__blok--kecil">
            <span className="dashkas__blok-label">PIUTANG</span>
            <span className="dashkas__blok-nilai">{keu ? rupiahPendek(keu.piutang) : "—"}</span>
          </span>
        </span>
      </footer>
    </article>
  );
}

/* --- Empat tombol cepat ---------------------------------------------------- */

/* Button Group (3:1156): bidang Green-BG, radius 16, padding 8/12, empat
   tombol setara dipisah garis tegak tipis, ikon 24px, label SemiBold 10px.

   Isinya empat pekerjaan yang paling sering DIMULAI dari nol — bukan empat
   halaman yang paling sering dibuka, karena untuk itu sudah ada sidebar. */
const AKSI: { ke: string; ikon: IconName; label: string }[] = [
  { ke: "/admin/proyek/baru", ikon: "projectPlus", label: "Proyek" },
  { ke: "/admin/keuangan", ikon: "cash", label: "Kas" },
  { ke: "/admin/jurnal", ikon: "edit", label: "Jurnal" },
  { ke: "/admin/pesan", ikon: "inquiry", label: "Pesan" },
];

function AksiCepat() {
  return (
    <nav className="dashaksi" aria-label="Aksi cepat">
      {AKSI.map((a) => (
        <a key={a.ke} className="dashaksi__btn" href={a.ke}>
          <Icon name={a.ikon} size={24} />
          <span className="dashaksi__label">{a.label}</span>
        </a>
      ))}
    </nav>
  );
}

/* --- Kartu bar: laba bersih terhadap kas masuk ----------------------------- */

/* Section Spending (3:1164). Bar-nya dua lapis: bidang mint sebagai alas,
   bidang hijau tua sebagai isian — bukan abu, seperti bar kemajuan biasa. */
function KartuLaba({ keu }: { keu: FinanceOverview | null }) {
  const kas = keu?.kasMasuk ?? 0;
  const laba = keu?.labaBersih ?? 0;
  /* Persentase dihitung terhadap kas yang BENAR-BENAR masuk, bukan terhadap
     nilai kontrak — keputusan yang sudah tercatat: nilai kontrak adalah
     janji, bukan uang. Kas nol berarti tidak ada penyebut, dan bar-nya
     kosong; menampilkan 0% akan terbaca sebagai "rugi total". */
  const p = persen(laba, kas);
  const lebar = p === null ? 0 : Math.max(0, Math.min(100, p));

  return (
    <article className="dashkartu dashbar">
      <header className="dashkartu__head">
        <h2 className="dashkartu__judul">Laba bersih</h2>
        <a className="dashkartu__ikon" href="/admin/keuangan" aria-label="Buka Keuangan">
          <Icon name="chevronRight" size={18} />
        </a>
      </header>

      <div className="dashbar__isi">
        <p className="dashbar__desc">
          <span className="dashbar__angka">
            <span className={`dashbar__nilai${laba < 0 ? " angka-minus" : ""}`}>
              {keu ? formatRupiah(laba) : "—"}
            </span>
            <span className="dashbar__ket">dari {keu ? rupiahPendek(kas) : "—"} kas masuk</span>
          </span>
          <span className="dashbar__persen">{tulisPersen(p)}</span>
        </p>

        <div
          className="dashrel"
          role="progressbar"
          aria-label="Laba bersih terhadap kas masuk"
          aria-valuenow={Math.round(lebar)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="dashrel__isi" style={{ width: `${lebar}%` }} />
        </div>
      </div>
    </article>
  );
}

/* --- Daftar proyek berjalan ------------------------------------------------ */

/* Section Plans (3:1176) + Card Saving Plan (3:1184). Rencana tabungan punya
   target dan capaian; proyek berkontrak punya nilai kontrak dan uang yang
   sudah diterima — bentuk angka yang sama persis. */
function DaftarProyek({ proyek, keu }: { proyek: Proyek[] | null; keu: FinanceOverview | null }) {
  /* "Berjalan" = belum sampai pelunasan. Definisi yang sama dengan penghitung
     di topbar, dan sengaja: dua angka yang mengaku menghitung hal yang sama
     tapi berbeda isinya adalah cara tercepat membuat panel tidak dipercaya. */
  const jalan = (proyek ?? []).filter((p) => p.pipelineStage !== "pelunasan").slice(0, 3);

  return (
    <article className="dashkartu dashplan">
      <header className="dashkartu__head">
        <h2 className="dashkartu__judul">Proyek berjalan</h2>
        <a className="dashkartu__tombol" href="/admin/proyek/baru">
          <Icon name="plus" size={12} />Proyek Baru
        </a>
      </header>

      <div className="dashplan__total">
        <span className="dashplan__total-label">Nilai kontrak</span>
        <span className="dashplan__total-nilai">{keu ? formatRupiah(keu.totalKontrak) : "—"}</span>
      </div>

      <div className="dashplan__list">
        {proyek === null
          ? [0, 1, 2].map((i) => <span key={i} className="skeleton dashplan__rangka" />)
          : jalan.length === 0
            ? <p className="dashkartu__kosong">Belum ada proyek yang sedang berjalan.</p>
            : jalan.map((p) => {
                const baris = keu?.proyek.find((r) => r.projectId === p.id);
                const nilai = p.contractValue ?? baris?.contractValue ?? null;
                const masuk = baris?.received ?? p.paidTotal ?? 0;
                const pct = persen(masuk, nilai ?? 0);
                return (
                  <a key={p.id} className="dashplankartu" href={`/admin/proyek/${p.id}`}>
                    <span className="dashplankartu__head">
                      <span className="dashplankartu__judul">
                        <span className="dashplankartu__ubin"><Icon name="project" size={16} /></span>
                        <span className="dashplankartu__nama">{p.title}</span>
                      </span>
                      <span className="dashplankartu__tahap">
                        {TAHAP_PROYEK[p.pipelineStage ?? ""] ?? "Proposal"}
                      </span>
                    </span>

                    <span className="dashplankartu__chart">
                      <span className="dashrel">
                        <span
                          className="dashrel__isi"
                          style={{ width: `${pct === null ? 0 : Math.min(100, pct)}%` }}
                        />
                      </span>
                      <span className="dashplankartu__desc">
                        <span className="dashplankartu__kiri">
                          <span className="dashplankartu__masuk">{rupiahPendek(masuk)}</span>
                          <span className="dashplankartu__pct">{tulisPersen(pct)}</span>
                        </span>
                        <span className="dashplankartu__kanan">
                          <span className="dashplankartu__target-label">Kontrak:</span>
                          <span className="dashplankartu__target">
                            {nilai ? rupiahPendek(nilai) : "belum ada"}
                          </span>
                        </span>
                      </span>
                    </span>
                  </a>
                );
              })}
      </div>
    </article>
  );
}

/* --- Tiga kartu statistik --------------------------------------------------- */

/**
 * Selisih bulan terakhir terhadap bulan sebelumnya.
 *
 * Lencana di Figma berbunyi "+ 1.78 %", dan itu HARUS angka sungguhan —
 * lencana tren yang isinya keterangan tetap ("3 proyek", "keluar dari kas")
 * memakai bentuk yang menjanjikan perbandingan lalu tidak memberikannya,
 * dan itu lebih buruk daripada tidak ada lencana sama sekali.
 *
 * Mengembalikan null kalau datanya belum cukup untuk dibandingkan — dua
 * bulan, dan bulan pembandingnya bukan nol. Pembagian dengan nol akan
 * melahirkan "+Infinity%" di kartu keuangan.
 */
function selisihBulan(
  bulanan: BarisBulanan[] | null,
  ambil: (b: BarisBulanan) => number,
): number | null {
  const d = bulanan ?? [];
  if (d.length < 2) return null;
  const kini = ambil(d[d.length - 1]);
  const lalu = ambil(d[d.length - 2]);
  if (lalu === 0) return null;
  return ((kini - lalu) / Math.abs(lalu)) * 100;
}

/* Card Statistic (3:1189): jarak isi 28px, ikon berubin 20px di kiri atas,
   lencana selisih, angka besar, label Regular 12px. */
function KartuStat({ ikon, delta, baikNaik, nilai, label }: {
  ikon: IconName;
  /** Persentase selisih bulan; null berarti belum bisa dibandingkan. */
  delta: number | null;
  /**
   * Apakah NAIK berarti kabar baik.
   *
   * Dipisah dari arah panahnya dengan sengaja: biaya yang TURUN adalah kabar
   * baik dan harus mint meski panahnya menunjuk ke bawah. Menyatukan
   * keduanya membuat bulan paling hemat tergambar merah.
   */
  baikNaik: boolean;
  nilai: string;
  label: string;
}) {
  const naik = (delta ?? 0) >= 0;
  const baik = delta === null ? true : (naik === baikNaik);
  return (
    <article className="dashstat__kartu">
      <header className="dashstat__head">
        <span className="dashstat__ubin"><Icon name={ikon} size={20} /></span>
      </header>
      <div className="dashstat__isi">
        <span className={`dashstat__badge${baik ? "" : " dashstat__badge--turun"}`}>
          {delta === null
            ? <>Bulan ini</>
            : <>
                <Icon name={naik ? "trendUp" : "trendDown"} size={10} />
                {`${naik ? "+" : "−"} ${Math.abs(delta).toFixed(1).replace(".", ",")} %`}
              </>}
        </span>
        <p className="dashstat__nilai">{nilai}</p>
        <p className="dashstat__label">{label}</p>
      </div>
    </article>
  );
}

/* --- Grafik batang dua arah -------------------------------------------------- */

/* Chart Colomn (3:1210): lima garis kisi, batang ATAS hijau tua (radius atas
   4px) dan batang BAWAH mint (radius bawah 4px), label bulan Regular 10px.

   Batang dua arah, bukan dua garis bertumpuk: di Coinest sumbu nolnya di
   tengah, pemasukan naik dan pengeluaran turun. Untuk studio ini artinya sama
   persis — kas masuk ke atas, biaya ke bawah — dan bulan yang merugi terbaca
   dari batang bawah yang lebih panjang, tanpa satu angka pun dibaca. */
const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function GrafikArus({ bulanan }: { bulanan: BarisBulanan[] | null }) {
  const data = (bulanan ?? []).slice(-12);
  const puncak = Math.max(1, ...data.flatMap((b) => [b.kasMasuk, b.biaya]));
  const totalMasuk = data.reduce((a, b) => a + b.kasMasuk, 0);
  const totalBiaya = data.reduce((a, b) => a + b.biaya, 0);

  return (
    <article className="dashkartu dasharus">
      <header className="dashkartu__head">
        <h2 className="dashkartu__judul">Arus kas</h2>
        <span className="dashkartu__pil">12 bulan terakhir</span>
      </header>

      <div className="dasharus__info">
        <span className="dasharus__saldo">
          <span className="dasharus__saldo-label">Masuk dikurangi keluar</span>
          <span className={`dasharus__saldo-nilai${totalMasuk - totalBiaya < 0 ? " angka-minus" : ""}`}>
            {formatRupiah(totalMasuk - totalBiaya)}
          </span>
        </span>
        <span className="dasharus__legenda">
          <span className="dasharus__leg"><span className="dasharus__kotak dasharus__kotak--masuk" />Kas masuk</span>
          <span className="dasharus__leg"><span className="dasharus__kotak dasharus__kotak--biaya" />Biaya</span>
        </span>
      </div>

      {data.length === 0 ? (
        <p className="dashkartu__kosong">Belum ada uang yang tercatat dalam dua belas bulan terakhir.</p>
      ) : (
        <div className="dasharus__chart">
          {data.map((b) => {
            const i = Number(b.bulan.split("-")[1]) - 1;
            return (
              <div className="dasharus__kol" key={b.bulan}>
                <div className="dasharus__lines">
                  {[0, 1, 2, 3, 4].map((n) => <span className="dasharus__garis" key={n} />)}
                  <div className="dasharus__bars">
                    <span className="dasharus__pos">
                      <span
                        className="dasharus__bar dasharus__bar--masuk"
                        style={{ height: `${(b.kasMasuk / puncak) * 100}%` }}
                        title={`${BULAN_PENDEK[i]}: masuk ${formatRupiah(b.kasMasuk)}`}
                      />
                    </span>
                    <span className="dasharus__neg">
                      <span
                        className="dasharus__bar dasharus__bar--biaya"
                        style={{ height: `${(b.biaya / puncak) * 100}%` }}
                        title={`${BULAN_PENDEK[i]}: biaya ${formatRupiah(b.biaya)}`}
                      />
                    </span>
                  </div>
                </div>
                <span className="dasharus__label">{BULAN_PENDEK[i] ?? b.bulan}</span>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

/* --- Tabel laba per proyek ------------------------------------------------- */

function TabelLaba({ keu }: { keu: FinanceOverview | null }) {
  const baris = (keu?.proyek ?? []).slice(0, 6);

  return (
    <article className="dashkartu dashtabel">
      <header className="dashkartu__head">
        <h2 className="dashkartu__judul">Laba per proyek</h2>
        <a className="dashkartu__pilih" href="/admin/keuangan">
          Buka Keuangan<Icon name="chevronRight" size={14} />
        </a>
      </header>

      {keu === null
        ? <span className="skeleton dashtabel__rangka" />
        : baris.length === 0
          ? <p className="dashkartu__kosong">Belum ada proyek yang punya angka.</p>
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

/* --- Donat rincian ----------------------------------------------------------- */

/* Section Statistic (3:1246): kepala + segmented dua tab + donat 149px +
   daftar rincian.

   Warna irisannya TANGGA hijau ke abu berurut besaran — #1E4841, #BBF49C,
   #ECF4E9, #E5E6E6, #BCBEBD — bukan lima rona berbeda. Itu yang membuat
   donatnya terbaca sebagai satu besaran yang dipecah, bukan lima hal yang
   tidak berhubungan, dan itu juga yang membuat irisan terbesar menonjol
   tanpa satu angka pun dibaca. */
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

/* Ukuran dalam satuan viewBox, angka Figma apa adanya: donat 149px dengan
   cincin setebal 30px. Bujur sangkar, jadi lingkarannya tidak bisa lonjong. */
const VB = 149;
const TEBAL = 30;
const R = (VB - TEBAL) / 2;
const KELILING = 2 * Math.PI * R;

interface Irisan { label: string; nilai: number; tingkat: number }

function Donat({ keu }: { keu: FinanceOverview | null }) {
  const [tab, setTab] = useState<"biaya" | "masuk">("biaya");

  const irisBiaya: Irisan[] = useMemo(
    () => [...(keu?.bebanKategori ?? [])]
      .filter((k) => k.nilai > 0)
      .sort((a, b) => b.nilai - a.nilai)
      .slice(0, 5)
      .map((k, i) => ({ label: labelBeban(k.kategori), nilai: k.nilai, tingkat: i + 1 })),
    [keu],
  );

  /* Tab "Kas masuk" memakai irisan per PROYEK, bukan per kategori: uang masuk
     tidak punya kategori beban, dan yang ingin diketahui dari sisi itu adalah
     proyek mana yang benar-benar membayar. */
  const irisMasuk: Irisan[] = useMemo(
    () => [...(keu?.proyek ?? [])]
      .filter((r) => r.received > 0)
      .sort((a, b) => b.received - a.received)
      .slice(0, 5)
      .map((r, i) => ({ label: r.projectTitle, nilai: r.received, tingkat: i + 1 })),
    [keu],
  );

  const totalBiaya = irisBiaya.reduce((a, b) => a + b.nilai, 0);
  const totalMasuk = irisMasuk.reduce((a, b) => a + b.nilai, 0);

  const aktif = tab === "biaya" ? irisBiaya : irisMasuk;
  const total = tab === "biaya" ? totalBiaya : totalMasuk;

  let jalan = 0;

  return (
    <article className="dashkartu dashdonat">
      <header className="dashkartu__head">
        <h2 className="dashkartu__judul">Rincian</h2>
        <span className="dashkartu__pil">Seluruh studio</span>
      </header>

      <div className="dashseg" role="tablist" aria-label="Pilih rincian">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "masuk"}
          className="dashseg__tab"
          onClick={() => setTab("masuk")}
        >
          Kas masuk<span className="dashseg__angka">({rupiahPendek(totalMasuk)})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "biaya"}
          className="dashseg__tab"
          onClick={() => setTab("biaya")}
        >
          Biaya<span className="dashseg__angka">({rupiahPendek(totalBiaya)})</span>
        </button>
      </div>

      <div className="dashdonat__chart">
        {total === 0 ? (
          <p className="dashkartu__kosong">Belum ada angka.</p>
        ) : (
          <>
            <svg viewBox={`0 0 ${VB} ${VB}`} className="dashdonat__svg" role="img" aria-label="Donat rincian">
              {aktif.map((s) => {
                const panjang = (s.nilai / total) * KELILING;
                const offset = jalan;
                jalan += panjang;
                return (
                  <circle
                    key={s.label}
                    cx={VB / 2}
                    cy={VB / 2}
                    r={R}
                    fill="none"
                    stroke={`var(--ramp-${s.tingkat})`}
                    strokeWidth={TEBAL}
                    strokeDasharray={`${panjang} ${KELILING - panjang}`}
                    strokeDashoffset={-offset}
                    transform={`rotate(-90 ${VB / 2} ${VB / 2})`}
                  />
                );
              })}
            </svg>
            <span className="dashdonat__pusat">
              <span className="dashdonat__pusat-label">
                {tab === "biaya" ? "Total biaya" : "Total masuk"}
              </span>
              <span className="dashdonat__pusat-nilai">{rupiahPendek(total)}</span>
            </span>
          </>
        )}
      </div>

      <div className="dashdonat__list">
        {aktif.map((s) => (
          <div className="dashdonat__baris" key={s.label}>
            <span className="dashdonat__kiri">
              <span className={`dashdonat__chip dashdonat__chip--${s.tingkat}`}>
                {Math.round((s.nilai / total) * 100)}%
              </span>
              <span className="dashdonat__label">{s.label}</span>
            </span>
            <span className="dashdonat__nilai">{formatRupiah(s.nilai)}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

/* --- Aktivitas: garis waktu yang belum ditangani ---------------------------- */

/* Section Recent Activity (3:1272): kepala + Div Logs, tiap baris berbulatan
   30px dengan garis penyambung ke baris berikutnya.

   Isinya daftar yang SAMA dengan lonceng di topbar — diturunkan dari sumber
   tunggal lib/notifikasi.ts, bukan dihitung ulang di sini. Dua daftar berisi
   hal yang sama pasti menyimpang, dan yang jarang dilihat yang salah
   (jebakan #32 di CLAUDE.md). */
function Aktivitas({ baris }: { baris: BarisNotifikasi[] | null }) {
  return (
    <article className="dashkartu dashlog">
      <header className="dashkartu__head">
        <h2 className="dashkartu__judul">Belum ditangani</h2>
        <a className="dashkartu__pilih" href="/admin/notifikasi">
          Semua<Icon name="chevronRight" size={14} />
        </a>
      </header>

      <div className="dashlog__list">
        {baris === null
          ? [0, 1, 2, 3].map((i) => <span key={i} className="skeleton dashlog__rangka" />)
          : baris.length === 0
            ? (
              <p className="dashlog__beres">
                <Icon name="check" size={16} />
                Tidak ada yang menunggu. Semua sudah ditangani.
              </p>
            )
            : baris.slice(0, 5).map((n, i, arr) => (
              <a key={n.id} className="dashlog__baris" href={n.ke} data-akhir={i === arr.length - 1 || undefined}>
                <span className="dashlog__rel">
                  <span className="dashlog__bulat"><Icon name={n.ikon} size={14} /></span>
                  <span className="dashlog__garis" aria-hidden="true" />
                </span>
                <span className="dashlog__teks">
                  <span className="dashlog__judul-baris">
                    <strong>{n.judul}</strong>
                    {n.detail ? <> — {n.detail}</> : null}
                  </span>
                  {n.waktu && <span className="dashlog__waktu">{n.waktu}</span>}
                </span>
              </a>
            ))}
      </div>
    </article>
  );
}

/* --- Halaman --------------------------------------------------------------- */

function Isi() {
  /* Nilai awal dibaca dari cache, permintaan segar tetap jalan di belakang —
     pola stale-while-revalidate yang sama dengan halaman admin lain. */
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

  return (
    <div className="dashgrid">
      <div className="dashgrid__kol dashgrid__kol--kiri">
        <KartuKas nama={nama} profil={profil} keu={keu} proyekAktif={aktif} />
        <AksiCepat />
        <KartuLaba keu={keu} />
        <DaftarProyek proyek={proyek} keu={keu} />
      </div>

      <div className="dashgrid__kol dashgrid__kol--tengah">
        <div className="dashstat">
          <KartuStat
            ikon="cash"
            delta={selisihBulan(bulanan, (b) => b.kasMasuk)}
            baikNaik
            nilai={keu ? formatRupiah(keu.kasMasuk) : "—"}
            label="Kas masuk"
          />
          <KartuStat
            ikon="bank"
            delta={selisihBulan(bulanan, (b) => b.biaya)}
            /* Biaya yang naik bukan kabar baik. */
            baikNaik={false}
            nilai={keu ? formatRupiah(keu.totalBiaya) : "—"}
            label="Total biaya"
          />
          <KartuStat
            ikon="finance"
            delta={selisihBulan(bulanan, (b) => b.labaBersih)}
            baikNaik
            nilai={keu ? formatRupiah(keu.labaBersih) : "—"}
            label="Laba bersih"
          />
        </div>

        <GrafikArus bulanan={bulanan} />
        <TabelLaba keu={keu} />
      </div>

      <div className="dashgrid__kol dashgrid__kol--kanan">
        <Donat keu={keu} />
        <Aktivitas baris={notif} />
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
