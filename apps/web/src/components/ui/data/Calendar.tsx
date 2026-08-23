import { useMemo, useState } from "react";
import { Icon } from "../Icon";

// Singkatan dua huruf ditulis eksplisit, bukan dipotong dari nama panjang:
// memotong "Senin" dan "Selasa" sama-sama menghasilkan "Se".
const HARI = ["Mg", "Sn", "Sl", "Rb", "Km", "Jm", "Sb"];
const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

interface Props {
  value?: Date;
  onChange?: (d: Date) => void;
  /** Tanggal sebelum ini tidak bisa dipilih. */
  minDate?: Date;
  ariaLabel?: string;
}

const samaHari = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Kalender.
 *
 * Hari yang tidak bisa dipilih ditandai coretan, bukan sekadar diredupkan —
 * redup saja mudah tertukar dengan "di luar bulan ini", sementara coretan
 * menyatakan larangan. Hari di luar bulan tetap digambar supaya posisi hari
 * dalam minggu tidak bergeser.
 */
export function Calendar({ value, onChange, minDate, ariaLabel = "Pilih tanggal" }: Props) {
  const [tampil, setTampil] = useState(() => value ?? new Date());
  const hariIni = useMemo(() => new Date(), []);

  const sel = useMemo(() => {
    const awalBulan = new Date(tampil.getFullYear(), tampil.getMonth(), 1);
    // Mundur ke hari Minggu terdekat supaya kisi selalu utuh tujuh kolom.
    const mulai = new Date(awalBulan);
    mulai.setDate(1 - awalBulan.getDay());

    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(mulai);
      d.setDate(mulai.getDate() + i);
      return d;
    });
  }, [tampil]);

  function geser(arah: -1 | 1) {
    setTampil(new Date(tampil.getFullYear(), tampil.getMonth() + arah, 1));
  }

  return (
    <div className="cal" role="group" aria-label={ariaLabel}>
      <div className="cal__head">
        <button type="button" className="btn btn--ghost btn--icon" onClick={() => geser(-1)} aria-label="Bulan sebelumnya">
          <Icon name="chevronLeft" size={16} />
        </button>
        <span className="cal__title" aria-live="polite">
          {BULAN[tampil.getMonth()]} {tampil.getFullYear()}
        </span>
        <button type="button" className="btn btn--ghost btn--icon" onClick={() => geser(1)} aria-label="Bulan berikutnya">
          <Icon name="chevronRight" size={16} />
        </button>
      </div>

      <div className="cal__grid" role="grid">
        {HARI.map((h) => (
          <span key={h} className="cal__dow" aria-hidden="true">{h}</span>
        ))}

        {sel.map((d) => {
          const luar = d.getMonth() !== tampil.getMonth();
          const mati = minDate ? d < minDate && !samaHari(d, minDate) : false;
          const terpilih = value ? samaHari(d, value) : false;

          return (
            <button
              key={d.toISOString()}
              type="button"
              className="cal__day"
              data-outside={luar || undefined}
              data-today={samaHari(d, hariIni) || undefined}
              aria-selected={terpilih}
              disabled={mati}
              onClick={() => onChange?.(d)}
              aria-label={`${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
