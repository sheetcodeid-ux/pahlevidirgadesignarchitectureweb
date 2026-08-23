import { useId, useRef, useState } from "react";

interface Props {
  /** Jumlah digit. Kode Supabase memakai 6. */
  length?: number;
  onComplete?: (kode: string) => void;
}

/**
 * Masukan kode sekali-pakai.
 *
 * Perilaku yang membuatnya terasa benar dan mudah terlewat kalau ditulis
 * seadanya: tempel satu kode penuh mengisi semua kotak sekaligus, backspace
 * di kotak kosong melompat mundur, dan panah kiri/kanan berpindah tanpa
 * mengubah isi.
 */
export function InputOTP({ length = 6, onComplete }: Props) {
  const [digit, setDigit] = useState<string[]>(() => Array(length).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const id = useId();

  function fokus(i: number) {
    refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();
  }

  function terapkan(baru: string[]) {
    setDigit(baru);
    const kode = baru.join("");
    if (kode.length === length && !baru.includes("")) onComplete?.(kode);
  }

  function onChange(i: number, nilai: string) {
    const angka = nilai.replace(/\D/g, "");
    if (!angka) return;

    const baru = [...digit];
    // Mengetik cepat bisa menaruh beberapa karakter sekaligus di satu kotak;
    // sebarkan ke kotak-kotak berikutnya alih-alih membuangnya.
    for (let k = 0; k < angka.length && i + k < length; k++) {
      baru[i + k] = angka[k];
    }
    terapkan(baru);
    fokus(i + angka.length);
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const baru = [...digit];
      if (baru[i]) {
        baru[i] = "";
        terapkan(baru);
      } else if (i > 0) {
        baru[i - 1] = "";
        terapkan(baru);
        fokus(i - 1);
      }
      return;
    }
    if (e.key === "ArrowLeft") { e.preventDefault(); fokus(i - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); fokus(i + 1); }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const angka = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!angka) return;

    const baru = Array(length).fill("");
    angka.split("").forEach((d, k) => (baru[k] = d));
    terapkan(baru);
    fokus(angka.length);
  }

  return (
    <div className="otp" role="group" aria-label={`Kode ${length} digit`}>
      {digit.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          id={`${id}-${i}`}
          className="otp__slot"
          data-filled={d ? "" : undefined}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={d}
          aria-label={`Digit ke-${i + 1}`}
          onChange={(e) => onChange(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
