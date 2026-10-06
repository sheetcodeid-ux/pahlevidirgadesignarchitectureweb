/* =============================================================================
   Terbilang — angka rupiah dalam kata, seperti di kuitansi dan slip gaji.

   "7150000" → "tujuh juta seratus lima puluh ribu rupiah". Kaidahnya bahasa
   Indonesia baku: "se-" untuk satu di depan puluh/ratus/ribu ("sepuluh",
   "seratus", "seribu"), tapi "satu juta" (bukan "sejuta"). Pecahan rupiah
   dibuang — gaji dan fee di panel ini selalu bulat.
   ============================================================================= */

const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"];
const SKALA = ["", "ribu", "juta", "miliar", "triliun"];

/** 0–999 dalam kata; "" untuk nol. */
function ratusan(n: number): string {
  const r = Math.floor(n / 100);
  const sisa = n % 100;
  const kata: string[] = [];
  if (r === 1) kata.push("seratus");
  else if (r > 1) kata.push(`${SATUAN[r]} ratus`);
  if (sisa >= 20) {
    kata.push(`${SATUAN[Math.floor(sisa / 10)]} puluh`);
    if (sisa % 10) kata.push(SATUAN[sisa % 10]!);
  } else if (sisa >= 12) {
    kata.push(`${SATUAN[sisa - 10]} belas`);
  } else if (sisa === 11) {
    kata.push("sebelas");
  } else if (sisa === 10) {
    kata.push("sepuluh");
  } else if (sisa > 0) {
    kata.push(SATUAN[sisa]!);
  }
  return kata.join(" ");
}

export function terbilang(nilai: number): string {
  const n = Math.floor(Math.abs(nilai));
  if (n === 0) return "nol rupiah";
  const kelompok: number[] = [];
  for (let x = n; x > 0; x = Math.floor(x / 1000)) kelompok.push(x % 1000);
  const kata: string[] = [];
  for (let i = kelompok.length - 1; i >= 0; i--) {
    const k = kelompok[i]!;
    if (k === 0) continue;
    // "seribu", bukan "satu ribu" — tapi "satu juta", "satu miliar".
    if (k === 1 && i === 1) kata.push("seribu");
    else kata.push(`${ratusan(k)}${SKALA[i] ? ` ${SKALA[i]}` : ""}`);
  }
  return `${nilai < 0 ? "minus " : ""}${kata.join(" ")} rupiah`;
}
