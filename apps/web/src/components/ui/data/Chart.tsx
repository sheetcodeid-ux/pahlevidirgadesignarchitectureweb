import { useId, useState } from "react";

/**
 * Grafik.
 *
 * Digambar sebagai SVG inline, bukan lewat pustaka grafik — kendali penuh atas
 * bentuk mark dan warnanya, dan tidak ada kilobyte tambahan untuk fitur yang
 * tidak dipakai.
 *
 * Aturan yang ditegakkan di sini:
 * - Teks selalu memakai token teks, tidak pernah warna deret. Warna identitas
 *   dibawa oleh mark di sebelahnya.
 * - Satu deret tidak memerlukan legenda; judulnya sudah menamainya.
 * - Grid dan sumbu dibuat surut agar datanya yang terbaca lebih dulu.
 * - Setiap grafik menyediakan tampilan tabel, sehingga isinya tetap terbaca
 *   tanpa mengandalkan penglihatan warna.
 */

const P = { atas: 16, kanan: 12, bawah: 28, kiri: 36 };
const W = 520;
const H = 220;

function TombolTabel({ tabel, setTabel }: { tabel: boolean; setTabel: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm"
      aria-pressed={tabel}
      onClick={() => setTabel(!tabel)}
    >
      {tabel ? "Lihat grafik" : "Lihat tabel"}
    </button>
  );
}

interface BarDatum { label: string; value: number; }

export function BarChart({ data, title, unit = "" }: { data: BarDatum[]; title: string; unit?: string }) {
  const [sorot, setSorot] = useState<number | null>(null);
  const [tabel, setTabel] = useState(false);
  const id = useId();

  const maks = Math.max(...data.map((d) => d.value), 1);
  const plotW = W - P.kiri - P.kanan;
  const plotH = H - P.atas - P.bawah;
  const slot = plotW / data.length;
  // Sela 2px antar-batang: batang bersebelahan tidak boleh menyatu jadi satu
  // blok warna.
  const lebar = Math.min(slot - 8, 44);

  const garis = [0, 0.5, 1].map((t) => Math.round(maks * t));

  return (
    <div className="chart">
      <div className="row row--between">
        <span className="t-subheading">{title}</span>
        <TombolTabel tabel={tabel} setTabel={setTabel} />
      </div>

      {tabel ? (
        <div className="table-wrap">
          <table className="table" style={{ minWidth: 0 }}>
            <thead><tr><th>Periode</th><th className="table__num">Jumlah</th></tr></thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.label}><td>{d.label}</td><td className="table__num">{d.value}{unit}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart__figure">
          <svg className="chart__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t`}>
            <title id={`${id}-t`}>{title}</title>

            {garis.map((g) => {
              const y = P.atas + plotH - (g / maks) * plotH;
              return (
                <g key={g}>
                  <line className="chart__grid-line" x1={P.kiri} x2={W - P.kanan} y1={y} y2={y} />
                  <text className="chart__axis-text" x={P.kiri - 8} y={y + 4} textAnchor="end">{g}</text>
                </g>
              );
            })}

            {data.map((d, i) => {
              const tinggi = (d.value / maks) * plotH;
              const x = P.kiri + i * slot + (slot - lebar) / 2;
              const y = P.atas + plotH - tinggi;
              return (
                <g key={d.label} onMouseEnter={() => setSorot(i)} onMouseLeave={() => setSorot(null)}>
                  {/* Area tangkap setinggi plot — kursor tidak perlu tepat di batangnya. */}
                  <rect x={P.kiri + i * slot} y={P.atas} width={slot} height={plotH} fill="transparent" />
                  <rect
                    x={x}
                    y={y}
                    width={lebar}
                    height={Math.max(tinggi, 2)}
                    rx="4"
                    fill="var(--chart-1)"
                    opacity={sorot === null || sorot === i ? 1 : 0.45}
                  />
                  <text className="chart__value-text" x={x + lebar / 2} y={y - 6} textAnchor="middle">{d.value}</text>
                  <text className="chart__axis-text" x={x + lebar / 2} y={H - 8} textAnchor="middle">{d.label}</text>
                </g>
              );
            })}
          </svg>

          {sorot !== null && (
            <div
              className="chart__tip"
              style={{ left: `${((P.kiri + sorot * slot + slot / 2) / W) * 100}%`, top: "35%" }}
            >
              <span className="chart__tip-label">{data[sorot].label}</span>
              <div className="chart__tip-row">
                <span className="chart__swatch" style={{ background: "var(--chart-1)" }} />
                <span>{title}</span>
                <span className="chart__tip-value">{data[sorot].value}{unit}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Series { name: string; color: string; points: number[]; }

export function LineChart({ series, labels, title }: { series: Series[]; labels: string[]; title: string }) {
  const [sorot, setSorot] = useState<number | null>(null);
  const [tabel, setTabel] = useState(false);
  const id = useId();

  const maks = Math.max(...series.flatMap((s) => s.points), 1);
  const plotW = W - P.kiri - P.kanan;
  const plotH = H - P.atas - P.bawah;
  const stepX = plotW / Math.max(labels.length - 1, 1);
  const xDi = (i: number) => P.kiri + i * stepX;
  const yDi = (v: number) => P.atas + plotH - (v / maks) * plotH;

  const garis = [0, 0.5, 1].map((t) => Math.round(maks * t));

  return (
    <div className="chart">
      <div className="row row--between">
        <span className="t-subheading">{title}</span>
        <TombolTabel tabel={tabel} setTabel={setTabel} />
      </div>

      {/* Legenda selalu ada untuk dua deret atau lebih — identitas tidak boleh
          bergantung pada warna saja. */}
      {series.length > 1 && !tabel && (
        <div className="chart__legend">
          {series.map((s) => (
            <span key={s.name} className="chart__legend-item">
              <span className="chart__swatch" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}

      {tabel ? (
        <div className="table-wrap">
          <table className="table" style={{ minWidth: 0 }}>
            <thead>
              <tr><th>Periode</th>{series.map((s) => <th key={s.name} className="table__num">{s.name}</th>)}</tr>
            </thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={l}>
                  <td>{l}</td>
                  {series.map((s) => <td key={s.name} className="table__num">{s.points[i]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart__figure">
          <svg
            className="chart__svg"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-labelledby={`${id}-t`}
            onMouseLeave={() => setSorot(null)}
          >
            <title id={`${id}-t`}>{title}</title>

            {garis.map((g) => (
              <g key={g}>
                <line className="chart__grid-line" x1={P.kiri} x2={W - P.kanan} y1={yDi(g)} y2={yDi(g)} />
                <text className="chart__axis-text" x={P.kiri - 8} y={yDi(g) + 4} textAnchor="end">{g}</text>
              </g>
            ))}

            {labels.map((l, i) => (
              <text key={l} className="chart__axis-text" x={xDi(i)} y={H - 8} textAnchor="middle">{l}</text>
            ))}

            {sorot !== null && (
              <line className="chart__grid-line" x1={xDi(sorot)} x2={xDi(sorot)} y1={P.atas} y2={P.atas + plotH} stroke="var(--chart-axis)" />
            )}

            {series.map((s) => (
              <polyline
                key={s.name}
                points={s.points.map((v, i) => `${xDi(i)},${yDi(v)}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {/* Penanda titik hanya digambar saat disorot — cincin permukaan 2px
                menjaganya tetap terbaca saat dua deret berpotongan. */}
            {sorot !== null &&
              series.map((s) => (
                <circle key={s.name} cx={xDi(sorot)} cy={yDi(s.points[sorot])} r="5"
                  fill={s.color} stroke="var(--surface)" strokeWidth="2" />
              ))}

            {labels.map((_, i) => (
              <rect key={i} x={xDi(i) - stepX / 2} y={P.atas} width={stepX} height={plotH}
                fill="transparent" onMouseEnter={() => setSorot(i)} />
            ))}
          </svg>

          {sorot !== null && (
            <div className="chart__tip" style={{ left: `${(xDi(sorot) / W) * 100}%`, top: "20%" }}>
              <span className="chart__tip-label">{labels[sorot]}</span>
              {series.map((s) => (
                <div key={s.name} className="chart__tip-row">
                  <span className="chart__swatch" style={{ background: s.color }} />
                  <span>{s.name}</span>
                  <span className="chart__tip-value">{s.points[sorot]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
