import { useMemo, useState } from "react";
import { formatRupiah } from "../../../lib/format";

/* =============================================================================
   Batang perbandingan tahun — ditiru dari kartu "Revenue Comparison".

   Anatominya dari gambar referensi:
   - kepala satu baris: judul kiri, legenda dua butir rata kanan
   - sumbu nilai di kiri, garis kisi mendatar PUTUS-PUTUS
   - dua belas batang bersudut membulat, satu per bulan
   - batang yang ditunjuk menyala; sisanya diredupkan, dan itu yang membuat
     gambar referensinya tampak kelabu semua kecuali satu batang
   - kartu keterangan mengambang di sebelah batang yang ditunjuk

   Batangnya elemen HTML, bukan <rect> di dalam SVG. Alasannya sudah pernah
   menggigit di grafik arus kas: SVG di sini diregangkan mengikuti lebar kartu
   tanpa mempertahankan rasio, dan sudut membulat di dalamnya akan tergambar
   lonjong. Di HTML, border-radius tetap bundar berapa pun lebar kartunya.
   ============================================================================= */

export interface TitikBanding {
  /** Nama bulan pendek untuk sumbu mendatar. */
  label: string;
  /** Nama bulan lengkap untuk kartu keterangan. */
  labelPanjang?: string;
  kini: number;
  lalu: number;
}

/** Sama seperti sumbu grafik arus kas: kolomnya sempit, jadi harus disingkat. */
function rupiahRingkas(n: number): string {
  const a = Math.abs(n);
  const tanda = n < 0 ? "−" : "";
  if (a >= 1_000_000_000) {
    const m = a / 1_000_000_000;
    return `${tanda}Rp${(m >= 10 ? Math.round(m) : +m.toFixed(1)).toLocaleString("id-ID")} M`;
  }
  if (a >= 1_000_000) return `${tanda}Rp${Math.round(a / 1_000_000).toLocaleString("id-ID")} jt`;
  if (a >= 1_000) return `${tanda}Rp${Math.round(a / 1_000).toLocaleString("id-ID")} rb`;
  return `${tanda}Rp${Math.round(a)}`;
}

/** Puncak sumbu yang dibulatkan ke angka enak dibaca. Lihat ChartArusKas. */
function skala(maks: number, bagian = 4) {
  if (!Number.isFinite(maks) || maks <= 0) return { atas: bagian, langkah: 1 };
  const kasar = maks / bagian;
  const pangkat = 10 ** Math.floor(Math.log10(kasar));
  /* Daftar langkah yang lebih rapat daripada [1, 2, 2.5, 5, 10].
     Dengan daftar kasar itu, data tertinggi Rp420 juta menghasilkan puncak
     sumbu Rp800 juta — hampir separuh bidang gambar kosong. Yang rapat
     memberi Rp500 juta: masih angka bulat, tapi headroom-nya 19% bukan 90%. */
  const langkah = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 10]
    .map((k) => k * pangkat).find((k) => k >= kasar) ?? 10 * pangkat;
  return { atas: langkah * bagian, langkah };
}

export function ChartBandingTahun({
  judul, labelKini, labelLalu, data,
}: {
  judul: string;
  /** Mis. "2026". */
  labelKini: string;
  /** Mis. "2025". */
  labelLalu: string;
  data: TitikBanding[];
}) {
  const [aktif, setAktif] = useState<number | null>(null);

  const { atas, tanda, kosong } = useMemo(() => {
    const semua = data.flatMap((d) => [d.kini, d.lalu]);
    const belumAda = !semua.some((v) => v > 0);
    const { atas: a, langkah } = skala(Math.max(0, ...semua));
    const t: number[] = [];
    for (let v = a; v >= 0; v -= langkah) t.push(v);
    return { atas: a, tanda: t, kosong: belumAda };
  }, [data]);

  function tunjuk(e: React.PointerEvent<HTMLDivElement>) {
    const kotak = e.currentTarget.getBoundingClientRect();
    if (kotak.width === 0 || data.length === 0) return;
    const i = Math.floor(((e.clientX - kotak.left) / kotak.width) * data.length);
    setAktif(Math.min(data.length - 1, Math.max(0, i)));
  }

  function tombol(e: React.KeyboardEvent<HTMLDivElement>) {
    if (data.length === 0) return;
    const kini = aktif ?? 0;
    if (e.key === "ArrowRight") { e.preventDefault(); setAktif(Math.min(data.length - 1, kini + 1)); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setAktif(Math.max(0, kini - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setAktif(0); }
    else if (e.key === "End") { e.preventDefault(); setAktif(data.length - 1); }
    else if (e.key === "Escape") { setAktif(null); }
  }

  /* Kartu keterangan pindah ke kiri batang begitu mendekati tepi kanan. */
  const xPersen = aktif === null || data.length === 0 ? 0 : ((aktif + 0.5) / data.length) * 100;
  const keKiri = xPersen > 66;

  return (
    <section className="banding">
      <header className="banding__head">
        <h3 className="banding__judul">{judul}</h3>
        <ul className="banding__legenda">
          <li><span className="banding__titik banding__titik--kini" aria-hidden="true" />{labelKini}</li>
          <li><span className="banding__titik banding__titik--lalu" aria-hidden="true" />{labelLalu}</li>
        </ul>
      </header>

      <div className="banding__plot">
        <ul className="banding__sumbu" aria-hidden="true">
          {tanda.map((v) => <li key={v}>{kosong && v !== 0 ? "" : rupiahRingkas(v)}</li>)}
        </ul>

        <div
          className="banding__gambar"
          role="img"
          tabIndex={0}
          aria-label={`${judul}. Gunakan panah kiri dan kanan untuk menelusuri per bulan.`}
          onPointerMove={tunjuk}
          onPointerDown={tunjuk}
          onPointerLeave={() => setAktif(null)}
          onPointerCancel={() => setAktif(null)}
          onKeyDown={tombol}
          onBlur={() => setAktif(null)}
        >
          <div className="banding__kisi" aria-hidden="true">
            {tanda.map((v) => <span key={v} />)}
          </div>

          <ol className="banding__deret" aria-hidden="true">
            {data.map((d, i) => {
              const tKini = atas === 0 ? 0 : (d.kini / atas) * 100;
              const tLalu = atas === 0 ? 0 : (d.lalu / atas) * 100;
              /* Bayangan tahun lalu digambar di belakang. Ia hanya terlihat
                 kalau tahun lalu LEBIH TINGGI — dan justru itu yang perlu
                 terlihat, karena artinya tahun ini sedang turun. */
              return (
                <li
                  key={d.label}
                  className={`banding__kolom${aktif !== null && aktif !== i ? " is-redup" : ""}${aktif === i ? " is-aktif" : ""}`}
                >
                  <span className="banding__bayang" style={{ height: `${tLalu}%` }} />
                  <span className="banding__bar" style={{ height: `${tKini}%` }}>
                    {/* Tinggi tahun lalu ditandai di DALAM batang, jadi
                        selisihnya terbaca sebagai potongan yang lebih pekat
                        di atasnya — sama seperti batang tersorot di referensi. */}
                    <span
                      className="banding__tanda"
                      style={{ height: `${tKini === 0 ? 0 : Math.min(100, (tLalu / tKini) * 100)}%` }}
                    />
                  </span>
                </li>
              );
            })}
          </ol>

          {kosong && <p className="banding__belum">Belum ada nilai proyek di periode ini</p>}

          {aktif !== null && !kosong && (
            <div
              className={`banding__tip${keKiri ? " banding__tip--kiri" : ""}`}
              style={{ left: `${xPersen}%` }}
              role="status"
            >
              <p className="banding__tip-judul">{data[aktif].labelPanjang ?? data[aktif].label}</p>
              <p className="banding__tip-baris">
                <span><i className="banding__titik banding__titik--kini" aria-hidden="true" />{labelKini}</span>
                <b>{formatRupiah(data[aktif].kini)}</b>
              </p>
              <p className="banding__tip-baris">
                <span><i className="banding__titik banding__titik--lalu" aria-hidden="true" />{labelLalu}</span>
                <b>{formatRupiah(data[aktif].lalu)}</b>
              </p>
            </div>
          )}
        </div>
      </div>

      <ul className="banding__bulan" aria-hidden="true">
        {data.map((d, i) => (
          <li key={d.label} className={i === aktif ? "is-aktif" : undefined}>{d.label}</li>
        ))}
      </ul>
    </section>
  );
}
