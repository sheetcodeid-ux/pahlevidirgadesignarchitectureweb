import { useId, useState, type ReactNode } from "react";
import { Icon } from "../Icon";

/**
 * Perkakas papan angka — bentuk yang dipakai halaman Keuangan.
 *
 * Susunannya diturunkan dari referensi papan pasar milik pemilik: strip
 * metrik padat di atas, satu grafik besar dengan tab di bawahnya, kartu mini
 * berbadge, dan grafik batang bertumpuk yang berani turun di bawah nol.
 *
 * Yang DIAMBIL dari referensi itu hanya susunan dan kepadatannya. Warnanya
 * tidak: di situs ini warna punya makna tetap (merah = brand dan kurang dari
 * nol, hijau = konfirmasi, amber = separuh, biru = penjelasan), dan referensi
 * itu memakai warna yang artinya berbeda.
 */

/* --- Delta: angka perubahan dengan panah ---------------------------------- */

/** Panah naik/turun. SVG inline seperti ikon lain, bukan karakter Unicode. */
function Panah({ naik }: { naik: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      {naik ? <path d="M6 2 11 10H1Z" fill="currentColor" /> : <path d="M6 10 1 2h10Z" fill="currentColor" />}
    </svg>
  );
}

export interface Perubahan {
  /** null kalau persentase tidak bermakna — lihat bandingkan(). */
  persen: number | null;
  /** Selisih mentahnya, selalu ada. */
  selisih: number;
}

/**
 * Membandingkan dua periode.
 *
 * Persentase HANYA dikeluarkan kalau basisnya positif. Dari basis nol,
 * pertumbuhan tidak punya arti sebagai persentase; dari basis NEGATIF ia
 * malah menipu — laba bersih yang bergerak dari −25 juta ke +22 juta
 * menghasilkan "+188%", angka yang terbaca seperti untung berlipat padahal
 * yang terjadi adalah berbalik dari rugi. Untuk kasus itu yang ditampilkan
 * selisih rupiahnya, yang tidak bisa disalahpahami.
 */
export function bandingkan(kini: number, lalu: number): Perubahan {
  const selisih = kini - lalu;
  if (lalu <= 0) return { persen: null, selisih };
  return { persen: (selisih / lalu) * 100, selisih };
}

/**
 * Perubahan terhadap periode sebelumnya.
 *
 * `undefined` berarti tidak ada pembandingnya sama sekali — bulan pertama
 * tidak punya "bulan sebelumnya", dan menampilkan 0% di situ adalah
 * kebohongan kecil yang terbaca sebagai "tidak berubah".
 */
export function Delta({
  ubah, terbalik = false, format,
}: {
  ubah: Perubahan | null;
  terbalik?: boolean;
  /** Dipakai saat persentasenya tidak bermakna; menampilkan selisih mentah. */
  format?: (v: number) => string;
}) {
  if (!ubah) return <span className="delta delta--kosong">belum ada pembanding</span>;

  const naik = (ubah.persen ?? ubah.selisih) >= 0;
  // Untuk biaya, naik itu KABAR BURUK — jadi warnanya dibalik. Panahnya tidak:
  // panah tetap menunjuk arah angkanya bergerak.
  const baik = terbalik ? !naik : naik;
  const teks = ubah.persen !== null && Number.isFinite(ubah.persen)
    ? `${Math.abs(ubah.persen).toFixed(2).replace(".", ",")}%`
    : format
      ? format(Math.abs(ubah.selisih))
      : null;

  if (teks === null) return <span className="delta delta--kosong">belum ada pembanding</span>;

  return (
    <span className={`delta ${baik ? "delta--baik" : "delta--buruk"}`}>
      <Panah naik={naik} />{teks}
    </span>
  );
}

/* --- Strip metrik --------------------------------------------------------- */

export interface Metrik {
  label: string;
  nilai: string;
  /** Perubahan terhadap periode sebelumnya. */
  delta?: Perubahan | null;
  /** Format selisih mentah, dipakai saat persentasenya tidak bermakna. */
  deltaFormat?: (v: number) => string;
  /** Kenaikan angka ini kabar buruk (biaya, piutang). */
  deltaTerbalik?: boolean;
  /** Widget kecil menggantikan delta — mis. bilah kemajuan. */
  sisipan?: ReactNode;
  /** Angka bernilai kurang dari nol. */
  minus?: boolean;
}

/**
 * Deretan metrik padat, dipisah garis tipis — bukan kartu berbingkai.
 *
 * Bingkai per kartu membuat empat angka terbaca sebagai empat benda terpisah;
 * di referensi mereka satu bilah yang dibaca sekali sapu.
 */
export function StripMetrik({ metrik }: { metrik: Metrik[] }) {
  return (
    <div className="metrik-strip">
      {metrik.map((m) => (
        <div className="metrik" key={m.label}>
          <span className="metrik__label">{m.label}</span>
          <span className={`metrik__nilai${m.minus ? " angka-minus" : ""}`}>{m.nilai}</span>
          {m.sisipan ?? (m.delta !== undefined && <Delta ubah={m.delta} terbalik={m.deltaTerbalik} format={m.deltaFormat} />)}
        </div>
      ))}
    </div>
  );
}

/* --- Bilah kemajuan bersegmen --------------------------------------------- */

/** Bilah kemajuan dengan bulatan penanda, seperti "Indeks Altcoin" di referensi. */
export function BilahKemajuan({ nilai, maks, label }: { nilai: number; maks: number; label: string }) {
  const rasio = maks > 0 ? Math.min(Math.max(nilai / maks, 0), 1) : 0;
  return (
    <span className="kemajuan" role="img" aria-label={`${label}: ${nilai} dari ${maks}`}>
      <span className="kemajuan__isi" style={{ inlineSize: `${rasio * 100}%` }} />
      <span className="kemajuan__titik" style={{ insetInlineStart: `${rasio * 100}%` }} />
    </span>
  );
}

/* --- Gauge (busur berjarum) ----------------------------------------------- */

const GW = 200;
const GH = 128;
const GR = 74;
const GCX = GW / 2;
const GCY = 104;

/** Titik pada busur untuk sudut t (0 = kiri, 1 = kanan). */
function titikBusur(t: number, r = GR) {
  const sudut = Math.PI * (1 - t);
  return [GCX + r * Math.cos(sudut), GCY - r * Math.sin(sudut)];
}

function segmenBusur(dari: number, ke: number, r: number) {
  const [x1, y1] = titikBusur(dari, r);
  const [x2, y2] = titikBusur(ke, r);
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
}

/**
 * Busur berjarum untuk satu angka 0–100.
 *
 * Zonanya memakai warna semantik situs ini: merah rugi, amber tipis, hijau
 * sehat. Jarumnya bulatan di tepi busur, bukan garis dari pusat — persis
 * seperti referensi, dan bulatan lebih mudah dilihat pada busur setipis ini.
 */
export function Gauge({ nilai, judul, keterangan }: { nilai: number; judul: string; keterangan?: string }) {
  const t = Math.min(Math.max(nilai, 0), 100) / 100;
  const [jx, jy] = titikBusur(t);
  const zona: [number, number, string][] = [
    [0, 0.25, "var(--brand)"],
    [0.25, 0.45, "var(--warn)"],
    [0.45, 0.7, "var(--chart-2)"],
    [0.7, 1, "var(--success)"],
  ];

  return (
    <div className="gauge">
      <svg className="gauge__svg" viewBox={`0 0 ${GW} ${GH}`} role="img"
        aria-label={`${judul}: ${nilai.toFixed(0)} dari 100`}>
        {zona.map(([a, b, warna]) => (
          <path key={warna} d={segmenBusur(a, b, GR)} stroke={warna} strokeWidth="12"
            fill="none" strokeLinecap="butt" />
        ))}
        <circle cx={jx} cy={jy} r="9" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2" />
        <text x={GCX} y={GCY - 14} textAnchor="middle" className="gauge__angka">{nilai.toFixed(0)}</text>
        {keterangan && <text x={GCX} y={GCY + 8} textAnchor="middle" className="gauge__teks">{keterangan}</text>}
      </svg>
    </div>
  );
}

/* --- Sparkline ------------------------------------------------------------ */

/** Garis mungil tanpa sumbu — bentuknya yang bercerita, bukan angkanya. */
export function Sparkline({ titik, label }: { titik: number[]; label: string }) {
  const id = useId();
  if (titik.length < 2) return <div className="spark spark--kosong">Belum cukup data</div>;

  const w = 240;
  const h = 64;
  const maks = Math.max(...titik);
  const min = Math.min(...titik);
  const rentang = Math.max(maks - min, 1);
  const x = (i: number) => (i / (titik.length - 1)) * w;
  const y = (v: number) => h - ((v - min) / rentang) * (h - 6) - 3;

  const garis = titik.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const bidang = `${garis} L ${w} ${h} L 0 ${h} Z`;
  // Turun kalau titik terakhir lebih rendah dari titik pertama.
  const turun = titik[titik.length - 1] < titik[0];
  const warna = turun ? "var(--brand)" : "var(--success)";

  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={warna} stopOpacity="0.28" />
          <stop offset="100%" stopColor={warna} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={bidang} fill={`url(#${id}-g)`} />
      <path d={garis} fill="none" stroke={warna} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* --- Grafik bidang besar (hero) ------------------------------------------- */

const AW = 720;
const AH = 260;
// Kiri 44: label sumbu waktu pertama dirata-tengahkan, jadi separuhnya
// menggantung ke kiri dan terpotong tepi kartu kalau paddingnya nol.
const AP = { atas: 24, kanan: 62, bawah: 26, kiri: 44 };

/**
 * Grafik bidang selebar kartu, dengan garis putus-putus di nilai tertinggi
 * dan pil bernilai di titik itu — seperti garis "46,57q" di referensi.
 *
 * Sumbu nilainya di KANAN, juga seperti referensi: mata membaca kurvanya dari
 * kiri dan berhenti di angka terakhir, jadi angkanya lebih berguna di ujung
 * yang sama.
 */
export function AreaChart({
  titik, label, judulNilai, format, warna = "var(--chart-1)",
}: {
  titik: number[];
  label: string[];
  judulNilai: string;
  format: (v: number) => string;
  warna?: string;
}) {
  const id = useId();
  const [sorot, setSorot] = useState<number | null>(null);

  if (titik.length < 2) {
    return <div className="empty empty--sm"><span className="t-muted">Belum cukup data untuk digambar.</span></div>;
  }

  const maks = Math.max(...titik, 0);
  const min = Math.min(...titik, 0);
  const rentang = Math.max(maks - min, 1);
  const plotW = AW - AP.kiri - AP.kanan;
  const plotH = AH - AP.atas - AP.bawah;

  const x = (i: number) => AP.kiri + (i / (titik.length - 1)) * plotW;
  const y = (v: number) => AP.atas + plotH - ((v - min) / rentang) * plotH;

  const garis = titik.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const bidang = `${garis} L ${x(titik.length - 1).toFixed(1)} ${y(min)} L ${x(0)} ${y(min)} Z`;

  const iMaks = titik.indexOf(maks);
  const sumbu = [maks, min + rentang / 2, min];

  return (
    <div className="area">
      <svg className="area__svg" viewBox={`0 0 ${AW} ${AH}`} role="img" aria-labelledby={`${id}-t`}
        onMouseLeave={() => setSorot(null)}>
        <title id={`${id}-t`}>{judulNilai}</title>
        <defs>
          <linearGradient id={`${id}-f`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={warna} stopOpacity="0.30" />
            <stop offset="100%" stopColor={warna} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {sumbu.map((v, i) => (
          <g key={i}>
            <line className="chart__grid-line" x1={AP.kiri} x2={AW - AP.kanan} y1={y(v)} y2={y(v)} />
            <text className="chart__axis-text" x={AW - AP.kanan + 6} y={y(v) + 4}>{format(v)}</text>
          </g>
        ))}

        {/* Garis putus-putus di puncak, dengan pil bernilai di pangkalnya. */}
        <line className="area__puncak" x1={AP.kiri} x2={AW - AP.kanan} y1={y(maks)} y2={y(maks)} />
        <g transform={`translate(${AP.kiri}, ${y(maks)})`}>
          <rect x="0" y="-11" rx="6" width={Math.max(format(maks).length * 7.4 + 14, 44)} height="22"
            fill="var(--surface-hover)" />
          <text className="area__puncak-teks" x="7" y="4">{format(maks)}</text>
        </g>

        <path d={bidang} fill={`url(#${id}-f)`} />
        <path d={garis} fill="none" stroke={warna} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {titik.map((v, i) => (
          <g key={i} onMouseEnter={() => setSorot(i)}>
            <rect x={x(i) - plotW / (titik.length - 1) / 2} y={AP.atas}
              width={plotW / (titik.length - 1)} height={plotH} fill="transparent" />
            {sorot === i && (
              <>
                <line className="area__lacak" x1={x(i)} x2={x(i)} y1={AP.atas} y2={AP.atas + plotH} />
                <circle cx={x(i)} cy={y(v)} r="4.5" fill={warna} stroke="var(--surface)" strokeWidth="2" />
              </>
            )}
          </g>
        ))}

        {label.map((l, i) => (
          // Label sumbu waktu dijarangkan supaya tidak bertumpuk: yang
          // digambar hanya yang muat, bukan semuanya lalu berharap.
          i % Math.ceil(label.length / 6) === 0 ? (
            <text key={l} className="chart__axis-text" x={x(i)} y={AH - 6} textAnchor="middle">{l}</text>
          ) : null
        ))}
      </svg>

      {sorot !== null && (
        <div className="area__tip" role="status">
          <span className="chart__tip-label">{label[sorot]}</span>
          <span className="chart__tip-value">{format(titik[sorot])}</span>
        </div>
      )}
    </div>
  );
}

/* --- Batang bertumpuk yang berani minus ----------------------------------- */

const SW = 720;
const SH = 250;
const SP = { atas: 18, kanan: 62, bawah: 28, kiri: 20 };

export interface DeretTumpuk { nama: string; warna: string; nilai: number[]; }

/**
 * Batang bertumpuk dengan sumbu nilai di kanan dan nol yang bisa dilewati ke
 * bawah — bentuk pelacak ETF di referensi.
 *
 * Nilai positif ditumpuk NAIK dari nol, nilai negatif ditumpuk TURUN. Itu
 * satu-satunya cara batang bertumpuk tetap jujur saat ada yang minus:
 * menjumlahkannya jadi satu batang akan menyembunyikan bahwa dua deret
 * berlawanan arah.
 */
export function StackedBarChart({
  deret, label, format,
}: { deret: DeretTumpuk[]; label: string[]; format: (v: number) => string }) {
  const id = useId();
  const [sorot, setSorot] = useState<number | null>(null);

  const atasPer = label.map((_, i) => deret.reduce((s, d) => s + Math.max(d.nilai[i] ?? 0, 0), 0));
  const bawahPer = label.map((_, i) => deret.reduce((s, d) => s + Math.min(d.nilai[i] ?? 0, 0), 0));
  const maks = Math.max(...atasPer, 0);
  const min = Math.min(...bawahPer, 0);
  const rentang = Math.max(maks - min, 1);

  const plotW = SW - SP.kiri - SP.kanan;
  const plotH = SH - SP.atas - SP.bawah;
  const slot = plotW / Math.max(label.length, 1);
  const lebar = Math.min(slot - 10, 34);

  const y = (v: number) => SP.atas + plotH - ((v - min) / rentang) * plotH;
  const yNol = y(0);
  const sumbu = min < 0 ? [maks, 0, min] : [maks, maks / 2, 0];

  return (
    <div className="area">
      <svg className="area__svg" viewBox={`0 0 ${SW} ${SH}`} role="img" aria-labelledby={`${id}-t`}
        onMouseLeave={() => setSorot(null)}>
        <title id={`${id}-t`}>{deret.map((d) => d.nama).join(" dan ")}</title>

        {sumbu.map((v, i) => (
          <g key={i}>
            <line className="chart__grid-line" x1={SP.kiri} x2={SW - SP.kanan} y1={y(v)} y2={y(v)}
              data-nol={v === 0 && min < 0 ? "" : undefined} />
            <text className="chart__axis-text" x={SW - SP.kanan + 6} y={y(v) + 4}>{format(v)}</text>
          </g>
        ))}

        {label.map((l, i) => {
          const x = SP.kiri + i * slot + (slot - lebar) / 2;
          let atas = 0;
          let bawah = 0;
          return (
            <g key={l} onMouseEnter={() => setSorot(i)}
              opacity={sorot === null || sorot === i ? 1 : 0.45}>
              <rect x={SP.kiri + i * slot} y={SP.atas} width={slot} height={plotH} fill="transparent" />
              {deret.map((d) => {
                const v = d.nilai[i] ?? 0;
                if (v === 0) return null;
                const tinggi = Math.abs(y(v) - yNol);
                let yBatang: number;
                if (v > 0) { atas += tinggi; yBatang = yNol - atas; }
                else { yBatang = yNol + bawah; bawah += tinggi; }
                return (
                  <rect key={d.nama} x={x} y={yBatang} width={lebar} height={Math.max(tinggi, 1)}
                    rx="2" fill={d.warna} />
                );
              })}
              {i % Math.ceil(label.length / 6) === 0 && (
                <text className="chart__axis-text" x={x + lebar / 2} y={SH - 6} textAnchor="middle">{l}</text>
              )}
            </g>
          );
        })}
      </svg>

      {sorot !== null && (
        <div className="area__tip" role="status">
          <span className="chart__tip-label">{label[sorot]}</span>
          {deret.map((d) => (
            <span className="chart__tip-row" key={d.nama}>
              <span className="chart__swatch" style={{ background: d.warna }} />
              {d.nama}
              <span className="chart__tip-value">{format(d.nilai[sorot] ?? 0)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* --- Kartu papan ---------------------------------------------------------- */

/**
 * Kartu papan: judul yang bisa ditekan, angka besar + delta, isi, lalu tab.
 *
 * Judulnya memakai chevron seperti referensi — dan chevron itu hanya muncul
 * kalau memang ada tujuannya. Panah yang tidak ke mana-mana adalah janji
 * yang tidak ditepati.
 */
export function KartuPapan({
  judul, ke, nilai, delta, deltaTerbalik, deltaFormat, kanan, anak, tab,
}: {
  judul: string;
  ke?: string;
  nilai?: string;
  delta?: Perubahan | null;
  deltaTerbalik?: boolean;
  deltaFormat?: (v: number) => string;
  kanan?: ReactNode;
  anak: ReactNode;
  tab?: ReactNode;
}) {
  return (
    <section className="papan">
      <header className="papan__head">
        {ke ? (
          <a className="papan__judul" href={ke}>
            {judul}<Icon name="chevronRight" size={14} />
          </a>
        ) : (
          <span className="papan__judul">{judul}</span>
        )}
        {kanan}
      </header>

      {nilai && (
        <div className="papan__nilai">
          <span className="t-numeral">{nilai}</span>
          {delta !== undefined && <Delta ubah={delta} terbalik={deltaTerbalik} format={deltaFormat} />}
        </div>
      )}

      <div className="papan__isi">{anak}</div>
      {tab && <div className="papan__tab">{tab}</div>}
    </section>
  );
}

/**
 * Kartu mini: label + chevron, keterangan kecil, angka, lalu badge status —
 * bentuk RSI/MACD di referensi.
 */
export function KartuMini({
  judul, ke, keterangan, nilai, minus, badge, badgeKelas, sisipan,
}: {
  judul: string;
  ke?: string;
  keterangan?: string;
  nilai: string;
  minus?: boolean;
  badge?: string;
  badgeKelas?: string;
  sisipan?: ReactNode;
}) {
  return (
    <div className="mini">
      {ke ? (
        <a className="mini__judul" href={ke}>{judul}<Icon name="chevronRight" size={13} /></a>
      ) : (
        <span className="mini__judul">{judul}</span>
      )}
      {keterangan && <span className="mini__ket">{keterangan}</span>}
      <span className={`mini__nilai${minus ? " angka-minus" : ""}`}>{nilai}</span>
      {sisipan}
      {badge && <span className={`badge ${badgeKelas ?? ""}`}>{badge}</span>}
    </div>
  );
}
