import { useId, useState } from "react";
import { Icon } from "../Icon";

/* =============================================================================
   Primitif papan Keuangan.

   Dipisah dari Dashboard.tsx karena isinya khusus uang: busur target, cincin
   distribusi margin, dan grafik perbandingan antar periode. Semuanya dipakai
   ulang di halaman Keuangan dan Analisis Bulanan, dan semuanya terdaftar di
   /admin/ui.

   Aturan yang berlaku di seluruh berkas ini:
   - Tidak ada nilai warna literal; semuanya menunjuk token.
   - Rasio viewBox yang menentukan tinggi grafik saat lebarnya 100%.
   - Angka nol dan angka negatif harus tetap terbaca, bukan hilang diam-diam.
   ============================================================================= */

/* --- Busur target --------------------------------------------------------- */

const BW = 220;
const BH = 132;
const BCX = BW / 2;
const BCY = 116;
const BR = 88;

/** Titik pada busur setengah lingkaran, t = 0 di kiri, 1 di kanan. */
function titikBusur(t: number, r: number): [number, number] {
  const sudut = Math.PI * (1 - t);
  return [BCX + r * Math.cos(sudut), BCY - r * Math.sin(sudut)];
}

function jalurBusur(dari: number, ke: number, r: number) {
  const [x1, y1] = titikBusur(dari, r);
  const [x2, y2] = titikBusur(ke, r);
  // Busur setengah lingkaran tidak pernah melebihi 180°, jadi large-arc selalu 0.
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/**
 * Busur target: satu angka pencapaian terhadap target, ditulis sebagai persen
 * di tengah busur.
 *
 * Beda dari `Gauge` di Dashboard.tsx, yang memakai jarum dan zona warna tetap
 * untuk skor 0–100. Yang ini punya SATU busur terisi di atas rel abu — bentuk
 * yang dipakai referensi pemilik untuk "Target Per Bulan", dan yang lebih
 * jujur untuk rasio: panjang busur yang terisi ADALAH rasionya.
 *
 * Pencapaian di atas 100% tetap digambar penuh (busur tidak bisa lebih dari
 * setengah lingkaran), tapi angkanya tidak dipotong — 140% tetap tertulis
 * 140%, dan warnanya berubah supaya kelebihannya kelihatan.
 */
export function BusurTarget({
  nilai, target, judul, format, keterangan,
}: {
  nilai: number;
  target: number;
  judul: string;
  format: (n: number) => string;
  keterangan?: string;
}) {
  const rasio = target > 0 ? nilai / target : 0;
  const terisi = Math.min(Math.max(rasio, 0), 1);
  const persen = target > 0 ? rasio * 100 : 0;

  // Hijau begitu target tercapai, amber saat sudah lebih dari separuh jalan,
  // merah kalau masih jauh. Ambangnya sama dengan arti warna di seluruh situs.
  const warna = rasio >= 1 ? "var(--success)" : rasio >= 0.5 ? "var(--warn)" : "var(--brand)";

  return (
    <div className="busur">
      <svg className="busur__svg" viewBox={`0 0 ${BW} ${BH}`} role="img"
        aria-label={`${judul}: ${format(nilai)} dari ${format(target)}, ${persen.toFixed(1)} persen`}>
        <path d={jalurBusur(0, 1, BR)} stroke="var(--chart-grid)" strokeWidth="14" fill="none" strokeLinecap="round" />
        {terisi > 0 && (
          <path d={jalurBusur(0, terisi, BR)} stroke={warna} strokeWidth="14" fill="none" strokeLinecap="round" />
        )}
        <text x={BCX} y={BCY - 46} textAnchor="middle" className="busur__cap">{judul}</text>
        <text x={BCX} y={BCY - 14} textAnchor="middle" className="busur__angka" fill={warna}>
          {persen.toFixed(persen >= 100 ? 0 : 2)}%
        </text>
      </svg>
      <p className="busur__baris">
        <span className="busur__kini">{format(nilai)}</span>
        <span className="busur__pisah">/</span>
        <span className="busur__target">{format(target)}</span>
      </p>
      {keterangan && <p className="busur__ket">{keterangan}</p>}
    </div>
  );
}

/* --- Cincin distribusi ---------------------------------------------------- */

export interface PitaCincin {
  label: string;
  keterangan: string;
  jumlah: number;
  warna: string;
  ikon: Parameters<typeof Icon>[0]["name"];
}

const CW = 200;
const CR = 78;
const CTEBAL = 18;
const KELILING = 2 * Math.PI * CR;

/**
 * Cincin sebaran: berapa proyek jatuh di tiap pita margin.
 *
 * Angka di tengah adalah porsi pita PERTAMA terhadap total — bukan jumlah
 * mentah. Pita pertama selalu yang paling sehat, jadi angka tengahnya menjawab
 * satu pertanyaan yang memang ingin dijawab pemilik: "berapa persen proyek
 * saya sehat?"
 *
 * Kalau belum ada proyek sama sekali, cincinnya digambar sebagai rel kosong
 * dengan tanda strip — bukan lingkaran penuh satu warna, yang akan terbaca
 * seperti 100% sesuatu.
 */
export function CincinDistribusi({ pita, judul }: { pita: PitaCincin[]; judul: string }) {
  const total = pita.reduce((s, p) => s + p.jumlah, 0);
  const porsiUtama = total > 0 ? (pita[0]?.jumlah ?? 0) / total : 0;

  let jalan = 0;
  const segmen = pita.map((p) => {
    const porsi = total > 0 ? p.jumlah / total : 0;
    const s = { ...p, porsi, offset: jalan };
    jalan += porsi;
    return s;
  });

  return (
    <div className="cincin">
      <div className="cincin__gambar">
        <svg viewBox={`0 0 ${CW} ${CW}`} role="img"
          aria-label={`${judul}: ${pita.map((p) => `${p.label} ${p.jumlah}`).join(", ")}`}>
          <circle cx={CW / 2} cy={CW / 2} r={CR} fill="none"
            stroke="var(--chart-grid)" strokeWidth={CTEBAL} />
          {total > 0 && segmen.filter((s) => s.porsi > 0).map((s) => (
            <circle key={s.label} cx={CW / 2} cy={CW / 2} r={CR} fill="none"
              stroke={s.warna} strokeWidth={CTEBAL} strokeLinecap="butt"
              strokeDasharray={`${(s.porsi * KELILING).toFixed(2)} ${KELILING.toFixed(2)}`}
              strokeDashoffset={(-s.offset * KELILING).toFixed(2)}
              transform={`rotate(-90 ${CW / 2} ${CW / 2})`} />
          ))}
          <text x={CW / 2} y={CW / 2 - 2} textAnchor="middle" className="cincin__angka">
            {total > 0 ? `${Math.round(porsiUtama * 100)}%` : "—"}
          </text>
          <text x={CW / 2} y={CW / 2 + 20} textAnchor="middle" className="cincin__cap">
            {total > 0 ? pita[0]?.label.toUpperCase() : "BELUM ADA"}
          </text>
        </svg>
      </div>
      <ul className="cincin__legenda">
        {pita.map((p) => (
          <li key={p.label} className="cincin__baris">
            <span className="cincin__ikon" style={{ color: p.warna }}>
              <Icon name={p.ikon} size={16} />
            </span>
            <span className="cincin__teks">
              <span className="cincin__nama">{p.label}</span>
              <span className="cincin__ket">{p.keterangan}</span>
            </span>
            <span className="cincin__jumlah">{p.jumlah}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --- Grafik banding antar periode ----------------------------------------- */

const PW = 760;
const PH = 260;
const PP = { atas: 18, kanan: 16, bawah: 34, kiri: 72 };

/**
 * Periode berjalan sebagai GARIS, periode pembanding sebagai BATANG di
 * belakangnya — bentuk yang diminta pemilik lewat gambar referensi.
 *
 * Dua bentuk berbeda, bukan dua garis: garis dan batang tidak pernah tertukar
 * walau warnanya berdekatan, dan pembacanya tidak perlu melihat legenda untuk
 * tahu mana yang mana.
 *
 * Sumbu Y selalu mulai dari nol. Untuk nominal rupiah, memotong sumbu membuat
 * selisih dua bulan terlihat berkali-kali lipat lebih besar dari yang
 * sebenarnya — itu menyesatkan, bukan mempertegas.
 */
export function ChartBanding({
  label, kini, lalu, namaKini, namaLalu, format,
}: {
  label: string[];
  kini: number[];
  lalu: number[];
  namaKini: string;
  namaLalu: string;
  format: (n: number) => string;
}) {
  const id = useId();
  const [sorot, setSorot] = useState<number | null>(null);

  const plotW = PW - PP.kiri - PP.kanan;
  const plotH = PH - PP.atas - PP.bawah;
  const n = label.length;

  const maks = Math.max(...kini, ...lalu, 1);
  const x = (i: number) => PP.kiri + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PP.atas + plotH - (v / maks) * plotH;

  const lebarBatang = Math.max(6, Math.min(26, (plotW / Math.max(n, 1)) * 0.34));
  const garis = kini.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const sumbu = [maks, maks / 2, 0];

  return (
    <div className="banding">
      <svg className="banding__svg" viewBox={`0 0 ${PW} ${PH}`} role="img"
        aria-label={`${namaKini} dibanding ${namaLalu}`}
        onMouseLeave={() => setSorot(null)}>
        <defs>
          <linearGradient id={`${id}-f`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {sumbu.map((v) => (
          <g key={v}>
            <line x1={PP.kiri} x2={PW - PP.kanan} y1={y(v)} y2={y(v)}
              stroke="var(--chart-grid)" strokeWidth="1" strokeDasharray="3 4" />
            <text x={PP.kiri - 10} y={y(v) + 4} textAnchor="end" className="banding__sumbu">{format(v)}</text>
          </g>
        ))}

        {lalu.map((v, i) => (
          <rect key={`b${i}`} x={x(i) - lebarBatang / 2} y={y(v)}
            width={lebarBatang} height={Math.max(plotH + PP.atas - y(v), 0)}
            fill="var(--tray)" opacity={sorot === null || sorot === i ? 0.9 : 0.4} rx="2" />
        ))}

        <path d={`${garis} L ${x(n - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`} fill={`url(#${id}-f)`} />
        <path d={garis} fill="none" stroke="var(--chart-1)" strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" />

        {kini.map((v, i) => (
          <circle key={`t${i}`} cx={x(i)} cy={y(v)} r={sorot === i ? 5 : 3}
            fill="var(--chart-1)" stroke="var(--surface)" strokeWidth="2" />
        ))}

        {label.map((l, i) => (
          <text key={l} x={x(i)} y={PH - 10} textAnchor="middle" className="banding__sumbu">{l}</text>
        ))}

        {/* Bidang tak terlihat: seluruh tinggi kolom bisa disentuh, bukan cuma
            titiknya, supaya tooltip tidak perlu dikejar dengan kursor. */}
        {label.map((l, i) => (
          <rect key={`h${i}`} x={x(i) - plotW / Math.max(n, 1) / 2} y={PP.atas}
            width={plotW / Math.max(n, 1)} height={plotH} fill="transparent"
            onMouseEnter={() => setSorot(i)} />
        ))}
      </svg>

      {sorot !== null && (
        <div className="banding__tip" style={{ left: `${(x(sorot) / PW) * 100}%` }}>
          <span className="banding__tip-judul">{label[sorot]}</span>
          <span className="banding__tip-baris">
            <span className="banding__tip-nama" style={{ color: "var(--chart-1)" }}>{namaKini}</span>
            <span className="banding__tip-nilai">{format(kini[sorot])}</span>
          </span>
          <span className="banding__tip-baris">
            <span className="banding__tip-nama">{namaLalu}</span>
            <span className="banding__tip-nilai">{format(lalu[sorot])}</span>
          </span>
        </div>
      )}

      <div className="banding__legenda">
        <span className="banding__lg"><span className="banding__lg-garis" />{namaKini}</span>
        <span className="banding__lg"><span className="banding__lg-batang" />{namaLalu}</span>
      </div>
    </div>
  );
}

/* --- Pita metrik rapat ---------------------------------------------------- */

export interface SelPita {
  label: string;
  nilai: string;
  delta?: string;
  arah?: "naik" | "turun";
  minus?: boolean;
}

/**
 * Deretan angka dalam SATU bidang bergaris pemisah — bukan kartu terpisah.
 *
 * Dipakai untuk angka yang dibaca bersama sebagai satu ringkasan (nilai
 * kontrak, kas masuk, biaya, laba). Karena dibaca bersama, garis pemisah lebih
 * tepat daripada jarak: jarak memisahkan, garis menyatukan sambil tetap
 * membedakan.
 *
 * Untuk angka yang berdiri sendiri, pakai kartu metrik biasa.
 */
export function PitaMetrik({ sel }: { sel: SelPita[] }) {
  return (
    <div className="pita">
      {sel.map((s) => (
        <div key={s.label} className="pita__sel">
          <span className="pita__label">{s.label}</span>
          <span className={`pita__nilai${s.minus ? " angka-minus" : ""}`}>{s.nilai}</span>
          {s.delta && (
            <span className={`pita__delta pita__delta--${s.arah === "turun" ? "turun" : "naik"}`}>
              {s.arah === "turun" ? "▼" : "▲"} {s.delta}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* --- Rincian kategori ----------------------------------------------------- */

export interface IrisKategori { nama: string; nilai: number; warna: string; }

/**
 * Satu bilah horizontal yang dibagi menurut kategori, dengan legenda bernilai
 * di bawahnya.
 *
 * Dipilih ketimbang pie: membandingkan panjang jauh lebih akurat daripada
 * membandingkan sudut, dan kategori beban di sini bisa timpang jauh (satu
 * kategori 70%, sisanya recehan) — bentuk yang paling buruk untuk pie.
 */
export function BilahKategori({ iris, format }: { iris: IrisKategori[]; format: (n: number) => string }) {
  const total = iris.reduce((s, i) => s + i.nilai, 0);

  if (total <= 0) {
    return <p className="t-muted" style={{ fontSize: "var(--text-sm)" }}>Belum ada beban tercatat di periode ini.</p>;
  }

  return (
    <div className="iris">
      <div className="iris__bilah" role="img"
        aria-label={iris.map((i) => `${i.nama} ${format(i.nilai)}`).join(", ")}>
        {iris.filter((i) => i.nilai > 0).map((i) => (
          <span key={i.nama} className="iris__potong"
            style={{ inlineSize: `${(i.nilai / total) * 100}%`, background: i.warna }} />
        ))}
      </div>
      <ul className="iris__legenda">
        {iris.map((i) => (
          <li key={i.nama} className="iris__baris">
            <span className="iris__titik" style={{ background: i.warna }} />
            <span className="iris__nama">{i.nama}</span>
            <span className="iris__porsi">{total > 0 ? `${Math.round((i.nilai / total) * 100)}%` : "0%"}</span>
            <span className="iris__nilai">{format(i.nilai)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
