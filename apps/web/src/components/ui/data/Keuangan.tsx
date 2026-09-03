import { useId, useState, type ReactNode } from "react";
import { Icon } from "../Icon";

/* =============================================================================
   Primitif papan Keuangan.

   Dipisah dari Dashboard.tsx karena isinya khusus uang. Semuanya dipakai ulang
   di halaman Keuangan dan Analisis Bulanan, dan semuanya terdaftar di
   /admin/ui.

   Aturan yang berlaku di seluruh berkas ini:
   - Setiap primitif dibungkus KartuData. Referensi pemilik tidak pernah
     menaruh grafik telanjang di atas halaman — selalu di dalam kartu berbingkai.
   - Tidak ada nilai warna literal; semuanya menunjuk token.
   - Rasio viewBox yang menentukan tinggi grafik saat lebarnya 100%.
   - Angka nol dan angka negatif harus tetap terbaca, bukan hilang diam-diam.
   ============================================================================= */

/* --- Pembungkus kartu ----------------------------------------------------- */

/**
 * Bingkai baku untuk setiap papan angka: judul, keterangan sebaris di
 * bawahnya, dan satu slot di kanan untuk pil status atau pengalih.
 *
 * Dipakai SEMUA primitif di berkas ini. Kalau sebuah papan tidak punya kartu,
 * ia terbaca menempel ke halaman dan barisnya tidak sejajar dengan papan di
 * sebelahnya — itu yang bikin halaman terlihat berantakan.
 */
export function KartuData({
  judul, keterangan, kanan, bawah, children,
}: {
  judul: string;
  keterangan?: string;
  kanan?: ReactNode;
  bawah?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="kdata">
      <header className="kdata__head">
        <div className="kdata__teks">
          <h3 className="kdata__judul">{judul}</h3>
          {keterangan && <p className="kdata__ket">{keterangan}</p>}
        </div>
        {kanan && <div className="kdata__kanan">{kanan}</div>}
      </header>
      {bawah && <div className="kdata__bawah">{bawah}</div>}
      <div className="kdata__isi">{children}</div>
    </section>
  );
}

/** Pil "LIVE" — titik berdenyut kecil, seperti di referensi. */
export function PilLive({ teks = "LIVE" }: { teks?: string }) {
  return <span className="pil-live"><span className="pil-live__titik" />{teks}</span>;
}

/* --- Kartu metrik --------------------------------------------------------- */

/**
 * Satu angka dalam kartunya sendiri: ubin ikon di kiri atas, slot status di
 * kanan atas, label, angka besar, lalu baris pembanding di kaki.
 *
 * Bentuk ini diambil dari referensi pemilik dan ditiru per bagian. Versi
 * sebelumnya menyatukan enam angka ke dalam SATU bilah bergaris — itu ide
 * saya, bukan permintaannya, dan hasilnya tidak pernah mirip referensi.
 * Kartu terpisah juga yang membuat tiap angka bisa punya ikon dan status
 * sendiri, hal yang mustahil di dalam satu bilah.
 */
export function KartuMetrik({
  label, nilai, ikon, warna, lembut, banding, delta, deltaArah, minus, kanan,
}: {
  label: string;
  nilai: string;
  ikon: Parameters<typeof Icon>[0]["name"];
  warna: string;
  lembut: string;
  /** Teks pembanding di kaki, mis. "vs periode lalu". */
  banding?: string;
  delta?: string;
  deltaArah?: "naik" | "turun";
  minus?: boolean;
  kanan?: ReactNode;
}) {
  return (
    <article className="kmetrik">
      <header className="kmetrik__head">
        <span className="kmetrik__ubin" style={{ background: lembut, color: warna }}>
          <Icon name={ikon} size={17} />
        </span>
        {kanan}
      </header>
      <p className="kmetrik__label">{label}</p>
      <p className={`kmetrik__nilai${minus ? " angka-minus" : ""}`}>{nilai}</p>
      {(banding || delta) && (
        <footer className="kmetrik__kaki">
          <span className="kmetrik__banding">{banding}</span>
          {delta && (
            <span className={`kmetrik__delta kmetrik__delta--${deltaArah === "naik" ? "naik" : "turun"}`}>
              {deltaArah === "naik" ? "↗" : "↘"} {delta}
            </span>
          )}
        </footer>
      )}
    </article>
  );
}

/* --- Kartu kemajuan ------------------------------------------------------- */

/**
 * Kemajuan terhadap target sebagai bilah lurus: judul dan persentase besar di
 * satu baris, nominal berbanding nominal, bilahnya, lalu legenda.
 *
 * Dipakai untuk target yang tidak butuh busur. Di referensi, busur cuma
 * dipakai SEKALI untuk target utama; sisanya bilah lurus — dan itu benar,
 * karena empat busur bertumpuk di satu kolom saling berebut perhatian.
 */
export function KartuKemajuan({
  judul, nilai, target, format, live = false, warna = "var(--chart-1)",
}: {
  judul: string;
  nilai: number;
  target: number;
  format: (n: number) => string;
  live?: boolean;
  warna?: string;
}) {
  const rasio = target > 0 ? Math.min(Math.max(nilai / target, 0), 1) : 0;
  const persen = target > 0 ? (nilai / target) * 100 : 0;

  return (
    <article className="kmaju">
      <header className="kmaju__head">
        <span className="kmaju__judul">{judul}</span>
        {live && <PilLive />}
        <span className="kmaju__persen">{persen.toFixed(persen >= 100 ? 0 : 1).replace(".", ",")}%</span>
      </header>
      <p className="kmaju__nominal">
        <span className="kmaju__kini">{format(nilai)}</span>
        <span className="kmaju__pisah">/</span>
        <span className="kmaju__target">{format(target)}</span>
      </p>
      <span className="kmaju__rel">
        <span className="kmaju__isi" style={{ inlineSize: `${rasio * 100}%`, background: warna }} />
      </span>
      <p className="kmaju__legenda">
        <span className="kmaju__lg"><span className="kmaju__titik" style={{ background: warna }} />Realisasi</span>
        <span className="kmaju__lg"><span className="kmaju__titik kmaju__titik--rel" />Target</span>
      </p>
    </article>
  );
}

/* --- Busur target --------------------------------------------------------- */

const BW = 300;
const BH = 178;
const BCX = BW / 2;
const BCY = 152;
const BR = 118;

/* SETENGAH lingkaran, bukan 240°.
   Diukur dari gambar referensi pemilik: ujung kiri busurnya (x≈205, y≈900),
   puncaknya (x≈358, y≈745), ujung kanannya (x≈513, y≈900). Pusat (358, 899)
   dengan jari-jari 154 — kedua ujungnya sejajar dengan pusat, dan itu
   definisi setengah lingkaran. Versi saya sebelumnya 240° dan itu sebabnya
   bentuknya tidak pernah mirip. */
const B_MULAI = 180;
const B_RENTANG = 180;

function sudutBusur(t: number) {
  return ((B_MULAI - t * B_RENTANG) * Math.PI) / 180;
}

function titikBusur(t: number, r: number): [number, number] {
  const a = sudutBusur(t);
  return [BCX + r * Math.cos(a), BCY - r * Math.sin(a)];
}

function jalurBusur(dari: number, ke: number, r: number) {
  const [x1, y1] = titikBusur(dari, r);
  const [x2, y2] = titikBusur(ke, r);
  const besar = (ke - dari) * B_RENTANG > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${besar} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/**
 * Busur target dengan penanda KAPSUL di atas rel — bukan busur terisi.
 *
 * Bentuknya diambil dari referensi pemilik dan diukur, bukan dikira: setengah
 * lingkaran, rel abu tebal, satu kapsul berwarna di posisi pencapaian, dan
 * SELURUH teks berada di dalam lengkung busur — label, persentase, lalu
 * delta di bawahnya.
 *
 * Nominalnya ditulis LENGKAP, bukan disingkat. "Rp185 jt" menyembunyikan
 * ratusan ribu yang justru dipakai pemilik untuk mencocokkan dengan rekening;
 * angka penuh memang lebih panjang, tapi itu memang gunanya.
 */
export function BusurTarget({
  judul, keterangan, nilai, target, format, delta, deltaArah, live = false, labelTengah = "Total Target",
}: {
  judul: string;
  keterangan?: string;
  nilai: number;
  target: number;
  /** Pemformat nominal. Pakai yang LENGKAP di sini, bukan yang disingkat. */
  format: (n: number) => string;
  delta?: string;
  deltaArah?: "naik" | "turun";
  live?: boolean;
  labelTengah?: string;
}) {
  const rasio = target > 0 ? nilai / target : 0;
  const t = Math.min(Math.max(rasio, 0), 1);
  const persen = rasio * 100;
  const persenTeks = `${persen.toFixed(persen >= 100 ? 1 : 2).replace(".", ",")}%`;

  const lebarKapsul = 0.03;
  const kMulai = Math.min(Math.max(t - lebarKapsul / 2, 0), 1 - lebarKapsul);
  const warna = rasio >= 1 ? "var(--success)" : rasio >= 0.5 ? "var(--warn)" : "var(--chart-1)";

  return (
    <div className="busur">
      <svg className="busur__svg" viewBox={`0 0 ${BW} ${BH}`} role="img"
        aria-label={`${judul}: ${format(nilai)} dari ${format(target)}, ${persenTeks}`}>
        <path d={jalurBusur(0, 1, BR)} stroke="var(--busur-rel)" strokeWidth="22"
          fill="none" strokeLinecap="round" />
        <path d={jalurBusur(kMulai, kMulai + lebarKapsul, BR)} stroke={warna} strokeWidth="27"
          fill="none" strokeLinecap="round" />

        <text x={BCX} y={BCY - 62} textAnchor="middle" className="busur__cap">{labelTengah}</text>
        <text x={BCX} y={BCY - 26} textAnchor="middle" className="busur__angka">{persenTeks}</text>
        {delta && (
          <text x={BCX} y={BCY - 6} textAnchor="middle"
            className={`busur__delta busur__delta--${deltaArah === "naik" ? "naik" : "turun"}`}>
            {delta}
          </text>
        )}
      </svg>

      {/* Realisasi dan target masing-masing satu baris berlabel, bukan
          dipisah garis miring. Nominal LENGKAP di kolom selebar ini tidak muat
          sebaris, dan garis miring yang menggantung di ujung baris pertama
          terbaca seperti render yang rusak. Titik legendanya menyatu ke sini,
          jadi tidak ada baris legenda terpisah yang mengulang hal yang sama. */}
      <dl className="busur__nilai">
        <div className="busur__nb">
          <dt><span className="busur__lg-titik" style={{ background: warna }} />Realisasi</dt>
          <dd className="busur__kini">{format(nilai)}</dd>
        </div>
        <div className="busur__nb">
          <dt><span className="busur__lg-titik busur__lg-titik--rel" />Target</dt>
          <dd className="busur__target">{format(target)}</dd>
        </div>
      </dl>
      {live && keterangan && <span className="sr-only">{keterangan}</span>}
    </div>
  );
}

/* --- Cincin distribusi ---------------------------------------------------- */

export interface PitaCincin {
  label: string;
  keterangan: string;
  jumlah: number;
  warna: string;
  lembut: string;
  ikon: Parameters<typeof Icon>[0]["name"];
}

const CW = 230;
const C_JARI = [86, 66, 46];
const C_TEBAL = 13;

/**
 * Sebaran proyek per pita margin, digambar sebagai CINCIN SEPUSAT — satu
 * cincin per pita, bukan satu donat yang dibagi-bagi.
 *
 * Tiap busur mulai di titik yang sama (puncak), jadi panjangnya bisa
 * dibandingkan langsung. Menyorot satu baris legenda meredupkan cincin yang
 * lain, supaya mata bisa mengunci satu pita tanpa harus menghitung warna.
 */
export function CincinDistribusi({ pita, judul }: { pita: PitaCincin[]; judul: string }) {
  const [sorot, setSorot] = useState<number | null>(null);
  const total = pita.reduce((s, p) => s + p.jumlah, 0);
  const porsiUtama = total > 0 ? (pita[0]?.jumlah ?? 0) / total : 0;

  return (
    <div className="cincin">
      <div className="cincin__gambar">
        <svg viewBox={`0 0 ${CW} ${CW}`} role="img"
          aria-label={`${judul}: ${pita.map((p) => `${p.label} ${p.jumlah}`).join(", ")}`}>
          {pita.map((p, i) => {
            const r = C_JARI[i] ?? C_JARI[C_JARI.length - 1];
            const keliling = 2 * Math.PI * r;
            const porsi = total > 0 ? p.jumlah / total : 0;
            const redup = sorot !== null && sorot !== i;
            return (
              <g key={p.label} opacity={redup ? 0.22 : 1} style={{ transition: "opacity var(--dur) var(--ease)" }}>
                <circle cx={CW / 2} cy={CW / 2} r={r} fill="none"
                  stroke="var(--busur-rel)" strokeWidth={C_TEBAL} />
                {porsi > 0 && (
                  <circle cx={CW / 2} cy={CW / 2} r={r} fill="none"
                    stroke={p.warna} strokeWidth={C_TEBAL} strokeLinecap="round"
                    strokeDasharray={`${(porsi * keliling).toFixed(2)} ${keliling.toFixed(2)}`}
                    transform={`rotate(-90 ${CW / 2} ${CW / 2})`} />
                )}
              </g>
            );
          })}
          <text x={CW / 2} y={CW / 2 - 4} textAnchor="middle" className="cincin__angka">
            {total > 0 ? `${Math.round(porsiUtama * 100)}%` : "—"}
          </text>
          <text x={CW / 2} y={CW / 2 + 15} textAnchor="middle" className="cincin__cap">
            {total > 0 ? pita[0]?.label.toUpperCase() : "BELUM ADA"}
          </text>
        </svg>
        {/* Baris ketiga ditaruh di luar svg: lubang cincin terdalam cuma
            berdiameter 80 satuan, dan tiga baris teks di dalamnya pasti
            menabrak cincinnya. */}
        <p className="cincin__sub">
          {total > 0 ? `dari ${total} proyek terukur` : "belum ada proyek terukur"}
        </p>
      </div>

      <ul className="cincin__legenda">
        {pita.map((p, i) => {
          const porsi = total > 0 ? Math.round((p.jumlah / total) * 100) : 0;
          return (
            <li key={p.label} className="cincin__baris"
              onPointerEnter={(e) => { if (e.pointerType === "mouse") setSorot(i); }}
              onPointerLeave={() => setSorot(null)}>
              <span className="cincin__lencana" style={{ background: p.lembut, color: p.warna }}>
                <Icon name={p.ikon} size={15} />
              </span>
              <span className="cincin__teks">
                <span className="cincin__nama">{p.label}</span>
                <span className="cincin__ket">{p.keterangan}</span>
              </span>
              <span className="cincin__kanan">
                <span className="cincin__jumlah" style={{ color: p.warna }}>{p.jumlah}</span>
                <span className="cincin__porsi">{porsi}%</span>
              </span>
              {/* Rel setipis rambut di bawah baris: mengulang porsi yang sama
                  dalam bentuk panjang, supaya bisa dipindai tanpa membaca. */}
              <span className="cincin__rel">
                <span className="cincin__isi" style={{ inlineSize: `${porsi}%`, background: p.warna }} />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* --- Grafik banding antar periode ----------------------------------------- */

const PW = 780;
const PH = 250;
const PP = { atas: 20, kanan: 18, bawah: 40, kiri: 74 };

/**
 * Periode berjalan sebagai GARIS, periode pembanding sebagai BATANG di
 * belakangnya, dengan garis bidik tegak dan kartu nilai saat disentuh.
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

  const lebarBatang = Math.max(6, Math.min(24, (plotW / Math.max(n, 1)) * 0.36));
  const garis = kini.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const sumbu = [maks, maks * 0.75, maks * 0.5, maks * 0.25, 0];

  return (
    <div className="banding">
      <svg className="banding__svg" viewBox={`0 0 ${PW} ${PH}`} role="img"
        aria-label={`${namaKini} dibanding ${namaLalu}`}
        onMouseLeave={() => setSorot(null)}>
        <defs>
          <linearGradient id={`${id}-f`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.26" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {sumbu.map((v, i) => (
          <g key={i}>
            <line x1={PP.kiri} x2={PW - PP.kanan} y1={y(v)} y2={y(v)}
              stroke="var(--chart-grid)" strokeWidth="1" strokeDasharray={i === sumbu.length - 1 ? undefined : "3 5"} />
            <text x={PP.kiri - 12} y={y(v) + 4} textAnchor="end" className="banding__sumbu">{format(v)}</text>
          </g>
        ))}

        {sorot !== null && (
          <line x1={x(sorot)} x2={x(sorot)} y1={PP.atas} y2={PP.atas + plotH}
            stroke="var(--chart-1)" strokeWidth="1" strokeDasharray="4 4" opacity="0.7" />
        )}

        {lalu.map((v, i) => (
          <rect key={`b${i}`} x={x(i) - lebarBatang / 2} y={y(v)}
            width={lebarBatang} height={Math.max(PP.atas + plotH - y(v), 0)}
            fill="var(--tray)" opacity={sorot === null || sorot === i ? 0.9 : 0.3} rx={lebarBatang / 2} />
        ))}

        <path d={`${garis} L ${x(n - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`} fill={`url(#${id}-f)`} />
        <path d={garis} fill="none" stroke="var(--chart-1)" strokeWidth="3"
          strokeLinejoin="round" strokeLinecap="round" />

        {kini.map((v, i) => (
          <circle key={`t${i}`} cx={x(i)} cy={y(v)} r={sorot === i ? 6.5 : 4}
            fill="var(--surface)" stroke="var(--chart-1)" strokeWidth={sorot === i ? 3.5 : 2.5} />
        ))}

        {label.map((l, i) => (
          <text key={l} x={x(i)} y={PH - 14} textAnchor="middle"
            className={`banding__sumbu${sorot === i ? " banding__sumbu--aktif" : ""}`}>{l}</text>
        ))}

        {/* Bidang tak terlihat: seluruh tinggi kolom bisa disentuh, bukan cuma
            titiknya, supaya kartu nilai tidak perlu dikejar dengan kursor. */}
        {label.map((l, i) => (
          <rect key={`h${i}`} x={x(i) - plotW / Math.max(n, 1) / 2} y={PP.atas}
            width={plotW / Math.max(n, 1)} height={plotH} fill="transparent"
            onMouseEnter={() => setSorot(i)} />
        ))}
      </svg>

      {sorot !== null && (
        <div className="banding__tip"
          style={{
            left: `${(x(sorot) / PW) * 100}%`,
            // Kartu digeser ke kiri kalau titiknya di paruh kanan, supaya tidak
            // pernah keluar dari kartu induknya di ujung mana pun.
            transform: x(sorot) > PW / 2 ? "translateX(calc(-100% - 14px))" : "translateX(14px)",
          }}>
          <span className="banding__tip-judul">{label[sorot]}</span>
          <span className="banding__tip-baris">
            <span className="banding__tip-nama"><span className="banding__lg-garis" />{namaKini}</span>
            <span className="banding__tip-nilai">{format(kini[sorot])}</span>
          </span>
          <span className="banding__tip-baris">
            <span className="banding__tip-nama"><span className="banding__lg-batang" />{namaLalu}</span>
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
  /** Persentase pendamping. WAJIB diisi — lihat catatan di PitaMetrik. */
  persen: string;
  arah?: "naik" | "turun" | "netral";
  minus?: boolean;
}

/**
 * Deretan angka dalam SATU bidang bergaris pemisah.
 *
 * Dua aturan yang lahir dari koreksi pemilik, dan keduanya mengikat:
 *
 * 1. SETIAP sel wajib punya persentase. Kalau sebagian punya dan sebagian
 *    tidak, tinggi selnya beda dan barisnya terbaca miring — itu yang membuat
 *    versi sebelumnya terlihat tumpang tindih.
 * 2. Label ditulis SATU BARIS. Label yang membungkus ikut mendorong angkanya
 *    turun, dan angka antar sel jadi tidak sebaris. Kalau label panjang,
 *    pendekkan katanya — jangan biarkan ia membungkus.
 *
 * Karena keduanya dijamin, seluruh isi sel bisa dipatok ke grid baris yang
 * sama: label, angka, dan persentase masing-masing sejajar antar sel.
 */
export function PitaMetrik({ sel }: { sel: SelPita[] }) {
  return (
    <div className="pita">
      {sel.map((s) => (
        <div key={s.label} className="pita__sel">
          <span className="pita__label">{s.label}</span>
          <span className={`pita__nilai${s.minus ? " angka-minus" : ""}`}>{s.nilai}</span>
          <span className={`pita__chip pita__chip--${s.arah ?? "netral"}`}>
            {s.arah === "naik" ? "▲" : s.arah === "turun" ? "▼" : ""} {s.persen}
          </span>
        </div>
      ))}
    </div>
  );
}

/* --- Rincian kategori ----------------------------------------------------- */

export interface IrisKategori { nama: string; nilai: number; warna: string; }

/**
 * Beban per kategori: satu bilah ringkas di atas, lalu satu baris berperingkat
 * untuk tiap kategori dengan bilahnya sendiri.
 *
 * Dipilih ketimbang pie: membandingkan panjang jauh lebih akurat daripada
 * membandingkan sudut, dan kategori beban di sini timpang jauh — bentuk paling
 * buruk untuk pie. Nomor urut ditulis karena urutannya memang informasi:
 * yang teratas adalah yang paling menghabiskan uang.
 */
export function BilahKategori({ iris, format }: { iris: IrisKategori[]; format: (n: number) => string }) {
  const total = iris.reduce((s, i) => s + i.nilai, 0);

  if (total <= 0) {
    return <p className="t-muted" style={{ fontSize: "var(--text-sm)" }}>Belum ada beban tercatat di periode ini.</p>;
  }

  const urut = [...iris].sort((a, b) => b.nilai - a.nilai);
  const terbesar = urut[0]?.nilai ?? 1;

  return (
    <div className="iris">
      <div className="iris__bilah" role="img"
        aria-label={urut.map((i) => `${i.nama} ${format(i.nilai)}`).join(", ")}>
        {urut.filter((i) => i.nilai > 0).map((i) => (
          <span key={i.nama} className="iris__potong"
            style={{ inlineSize: `${(i.nilai / total) * 100}%`, background: i.warna }} />
        ))}
      </div>

      <ul className="iris__legenda">
        {urut.map((i, n) => (
          <li key={i.nama} className="iris__baris">
            <span className="iris__urut">{n + 1}</span>
            <span className="iris__tengah">
              <span className="iris__atas">
                <span className="iris__nama">{i.nama}</span>
                <span className="iris__nilai">{format(i.nilai)}</span>
              </span>
              {/* Bilah baris diskalakan ke kategori TERBESAR, bukan ke total.
                  Terhadap total, kategori kecil jadi garis 3px yang tidak bisa
                  dibandingkan satu sama lain sama sekali. */}
              <span className="iris__rel">
                <span className="iris__isi"
                  style={{ inlineSize: `${(i.nilai / terbesar) * 100}%`, background: i.warna }} />
              </span>
            </span>
            <span className="iris__porsi">{Math.round((i.nilai / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}


/* --- Lini masa aktivitas -------------------------------------------------- */

export interface ButirAktivitas {
  id: string;
  judul: string;
  keterangan: string;
  waktu: string;
  ikon: Parameters<typeof Icon>[0]["name"];
  warna: string;
  lembut: string;
}

/**
 * Pergerakan terbaru sebagai LINI MASA — ubin ikon berwarna dengan garis
 * penghubung tegak di antaranya.
 *
 * Garis penghubungnya yang membuat daftar ini terbaca sebagai urutan waktu,
 * bukan sekadar tumpukan baris. Garis pada butir TERAKHIR sengaja tidak
 * digambar: kalau digambar, ia menjanjikan butir berikutnya yang tidak ada.
 */
export function LiniMasa({ butir }: { butir: ButirAktivitas[] }) {
  return (
    <ol className="lini">
      {butir.map((b, i) => (
        <li key={b.id} className="lini__baris">
          <span className="lini__rel">
            <span className="lini__ubin" style={{ background: b.lembut, color: b.warna }}>
              <Icon name={b.ikon} size={15} />
            </span>
            {i < butir.length - 1 && <span className="lini__garis" />}
          </span>
          <span className="lini__teks">
            <span className="lini__atas">
              <span className="lini__judul">{b.judul}</span>
              <span className="lini__waktu">{b.waktu}</span>
            </span>
            <span className="lini__ket">{b.keterangan}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
