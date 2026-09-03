import { useId, useMemo, useState } from "react";
import { Icon, type IconName } from "../Icon";

/* =============================================================================
   Kartu donat — ditiru dari kartu "Distribusi Tugas per Jabatan" milik pemilik.

   Anatominya, dari atas ke bawah, persis seperti gambar referensi:
   1. judul tebal, lalu subjudul redup di bawahnya
   2. bilah tab berkotak: wadah berlatar redup, segmen aktif jadi kartu terang
      berbingkai, tiap segmen berisi ikon + label
   3. donat dengan angka persentase BESAR di tengah, berwarna sama dengan
      irisan terbesarnya
   4. legenda tegak di sebelah donat: titik warna + nama, boleh dua baris
   5. garis pemisah
   6. kaki: label kiri, lalu lingkaran-lingkaran bertindih dan angka total
      di kanan

   Bedanya dengan referensi cuma satu, dan itu karena lebar: kartu ini duduk
   di kolom selebar 364px, sementara referensinya 686px. Donat dan legenda
   otomatis bertumpuk saat berdampingan tidak lagi muat — pakai flex-wrap,
   bukan container query, karena container query diam saja kalau tidak ada
   leluhur ber-container-type dan yang tampil justru aturan dasarnya.
   ============================================================================= */

export interface IrisDonat {
  label: string;
  nilai: number;
  /** Token warna kategori, mis. "var(--chart-cat-1)". */
  warna: string;
}

export interface TabDonat {
  nilai: string;
  label: string;
  ikon: IconName;
}

/* Ukuran dalam satuan viewBox. Donatnya bujur sangkar, jadi tidak ada
   peregangan dan lingkarannya tidak mungkin jadi lonjong. */
const VB = 200;
const R = 78;
const TEBAL = 30;
const KELILING = 2 * Math.PI * R;

export function KartuDonat({
  judul, subjudul, tab, tabAktif, onTab, iris, kakiLabel, kakiNilai, format,
}: {
  judul: string;
  subjudul?: string;
  tab?: TabDonat[];
  /** Kosongkan untuk membiarkan komponen mengurus tabnya sendiri. */
  tabAktif?: string;
  onTab?: (nilai: string) => void;
  iris: IrisDonat[];
  kakiLabel: string;
  /** Sudah diformat oleh pemanggil — komponen ini tidak tahu satuannya. */
  kakiNilai: string;
  /** Untuk angka di tiap baris legenda. Opsional; tanpa ini legenda hanya nama. */
  format?: (n: number) => string;
}) {
  const gid = useId().replace(/:/g, "");
  const [sorot, setSorot] = useState<number | null>(null);
  /* Tab boleh dikendalikan pemanggil, boleh juga diurus sendiri.
     Yang kedua bukan kemewahan: fungsi TIDAK BISA dioper sebagai prop dari
     berkas .astro ke island React — Astro menserialisasinya ke JSON dulu —
     jadi tanpa keadaan internal, tab di halaman .astro mana pun akan mati
     total tanpa satu pun galat. Sudah kejadian di grafik arus kas. */
  const [tabSendiri, setTabSendiri] = useState(tab?.[0]?.nilai);
  const tabKini = tabAktif ?? tabSendiri;

  const { total, potong, terbesar } = useMemo(() => {
    const t = iris.reduce((a, i) => a + Math.max(0, i.nilai), 0);
    let jalan = 0;
    const p = iris.map((i) => {
      const porsi = t === 0 ? 0 : Math.max(0, i.nilai) / t;
      const mulai = jalan;
      jalan += porsi;
      return { ...i, porsi, mulai };
    });
    let besar = 0;
    p.forEach((i, n) => { if (i.porsi > p[besar].porsi) besar = n; });
    return { total: t, potong: p, terbesar: p.length ? besar : -1 };
  }, [iris]);

  const kosong = total === 0;
  const disorot = sorot ?? terbesar;
  const pusat = kosong || disorot < 0 ? null : potong[disorot];

  return (
    <section className="donat" aria-labelledby={`${gid}-judul`}>
      <header className="donat__head">
        <h3 className="donat__judul" id={`${gid}-judul`}>{judul}</h3>
        {subjudul && <p className="donat__sub">{subjudul}</p>}
      </header>

      {tab && tab.length > 0 && (
        <div className="segmented segmented--block segmented--kotak" role="group" aria-label={`Kelompokkan ${judul}`}>
          {tab.map((t) => (
            <button
              key={t.nilai}
              type="button"
              className="segmented__opt"
              aria-pressed={t.nilai === tabKini}
              onClick={() => { setTabSendiri(t.nilai); onTab?.(t.nilai); }}
            >
              <Icon name={t.ikon} size={16} />
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="donat__isi">
        <div className="donat__gambar">
          <svg viewBox={`0 0 ${VB} ${VB}`} aria-hidden="true" focusable="false">
            <circle
              className="donat__rel"
              cx={VB / 2} cy={VB / 2} r={R}
              fill="none" strokeWidth={TEBAL}
            />
            {!kosong && potong.map((i, n) => (
              <circle
                key={i.label}
                cx={VB / 2} cy={VB / 2} r={R}
                fill="none"
                stroke={i.warna}
                strokeWidth={TEBAL}
                strokeLinecap="round"
                strokeDasharray={`${i.porsi * KELILING} ${KELILING}`}
                strokeDashoffset={-i.mulai * KELILING}
                transform={`rotate(-90 ${VB / 2} ${VB / 2})`}
                opacity={sorot === null || sorot === n ? 1 : 0.28}
                style={{ transition: "opacity var(--dur) var(--ease)" }}
              />
            ))}
          </svg>

          {/* Angka tengah ditulis sebagai HTML, bukan <text> di dalam SVG,
              supaya ukurannya diatur CSS dan tidak ikut mengecil bersama
              gambarnya di kartu yang menyempit. */}
          <p className="donat__persen" style={pusat ? { color: pusat.warna } : undefined}>
            {kosong ? "0%" : `${Math.round(pusat!.porsi * 100)}%`}
          </p>
        </div>

        <ul className="donat__legenda">
          {iris.map((i, n) => (
            <li key={i.label}>
              <button
                type="button"
                className="donat__baris"
                aria-pressed={sorot === n}
                onPointerEnter={(e) => { if (e.pointerType === "mouse") setSorot(n); }}
                onPointerLeave={(e) => { if (e.pointerType === "mouse") setSorot(null); }}
                onFocus={() => setSorot(n)}
                onBlur={() => setSorot(null)}
                onClick={() => setSorot(sorot === n ? null : n)}
              >
                <span className="donat__titik" style={{ background: i.warna }} aria-hidden="true" />
                <span className="donat__nama">{i.label}</span>
                {format && <span className="donat__angka">{format(i.nilai)}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <footer className="donat__kaki">
        <span className="donat__kaki-label">{kakiLabel}</span>
        <span className="donat__tumpuk" aria-hidden="true">
          {iris.map((i) => (
            <span key={i.label} className="donat__keping" style={{ background: i.warna }} />
          ))}
        </span>
        <span className="donat__kaki-nilai">{kakiNilai}</span>
      </footer>
    </section>
  );
}
