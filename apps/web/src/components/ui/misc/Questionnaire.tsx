import { useState } from "react";
import { Icon } from "../Icon";

const LANGKAH = [
  {
    tanya: "Jenis proyek apa yang Anda rencanakan?",
    pilihan: ["Hunian baru", "Renovasi", "Interior", "Komersial"],
  },
  {
    tanya: "Berapa perkiraan luas bangunannya?",
    pilihan: ["Di bawah 100 m²", "100–250 m²", "250–500 m²", "Di atas 500 m²"],
  },
  {
    tanya: "Kapan Anda ingin mulai membangun?",
    pilihan: ["Dalam 3 bulan", "3–6 bulan", "6–12 bulan", "Belum ditentukan"],
  },
];

/**
 * Kuesioner bertahap.
 *
 * Satu pertanyaan per layar. Untuk form penyaringan calon klien, itu jauh
 * lebih sering diselesaikan ketimbang satu halaman panjang berisi semua
 * pertanyaan sekaligus.
 */
export function Questionnaire() {
  const [langkah, setLangkah] = useState(0);
  const [jawab, setJawab] = useState<(string | null)[]>(() => LANGKAH.map(() => null));

  const selesai = langkah >= LANGKAH.length;
  const kini = LANGKAH[langkah];

  function pilih(nilai: string) {
    setJawab((cur) => cur.map((v, i) => (i === langkah ? nilai : v)));
  }

  if (selesai) {
    return (
      <div className="empty empty--sm">
        <span className="icon-tile" style={{ color: "var(--success)" }}><Icon name="check" size={20} /></span>
        <span className="t-subheading">Terima kasih</span>
        <p className="t-muted">
          {jawab.filter(Boolean).length} jawaban terekam. Studio akan menghubungi Anda dalam 1–2 hari kerja.
        </p>
        <button type="button" className="btn btn--secondary" onClick={() => { setLangkah(0); setJawab(LANGKAH.map(() => null)); }}>
          Ulangi
        </button>
      </div>
    );
  }

  return (
    <div className="quiz">
      <div className="quiz__head">
        <div className="quiz__steps" role="progressbar" aria-valuemin={1} aria-valuemax={LANGKAH.length} aria-valuenow={langkah + 1}>
          {LANGKAH.map((_, i) => (
            <span
              key={i}
              className="quiz__step"
              data-done={i < langkah || undefined}
              data-current={i === langkah || undefined}
            />
          ))}
        </div>
        <span className="t-label">Langkah {langkah + 1} dari {LANGKAH.length}</span>
        <span className="t-subheading">{kini.tanya}</span>
      </div>

      <div className="stack" style={{ gap: "var(--space-2)" }} role="radiogroup" aria-label={kini.tanya}>
        {kini.pilihan.map((p) => (
          <label className="radio-card" key={p}>
            <input
              type="radio"
              name={`q-${langkah}`}
              checked={jawab[langkah] === p}
              onChange={() => pilih(p)}
            />
            <span className="radio-card__mark"><Icon name="check" size={14} /></span>
            <span className="radio-card__body">
              <span className="radio-card__title">{p}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="quiz__nav">
        <button type="button" className="btn btn--secondary" onClick={() => setLangkah((l) => l - 1)} disabled={langkah === 0}>
          <Icon name="chevronLeft" size={15} />Kembali
        </button>
        <button type="button" className="btn btn--primary" onClick={() => setLangkah((l) => l + 1)} disabled={!jawab[langkah]}>
          {langkah === LANGKAH.length - 1 ? "Selesai" : "Lanjut"}
          <Icon name="chevronRight" size={15} />
        </button>
      </div>
    </div>
  );
}
