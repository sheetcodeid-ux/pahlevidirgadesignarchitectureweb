/* =============================================================================
   Membaca brief awal dari pesan form kontak.

   Form kontak tidak punya kolom lokasi; isiannya ditempel di depan pesan
   ("Lokasi tapak: …", dulu "Site location: …" saat situsnya berbahasa
   Inggris). Anggaran disimpan sebagai TEKS bebas, dan produksi memuat
   beberapa bentuk sekaligus karena pilihannya sudah berganti tiga kali:

     "Di bawah Rp 500 juta"            pilihan form sekarang
     "Rp 1,5 – 5 miliar"
     "Rp 500 million – 1,5 billion"    form berbahasa Inggris
     "Rp250 – 500 jt" · "Di atas Rp1 M"  form pertama
     "500000000"                       angka mentah
     "Belum tahu"

   Jadi pembacanya toleran, dan yang tidak terbaca dikembalikan sebagai null
   — penggaris anggaran lalu menulis teks aslinya saja, bukan menebak.
   ============================================================================= */

const POLA_LOKASI = /^\s*(?:lokasi tapak|site location)\s*:\s*(.*?)\s*$/i;

/** Baris lokasi di depan pesan dipisah dari isinya. */
export function pisahLokasi(pesan: string): { lokasi: string | null; isi: string } {
  const baris = pesan.split(/\r?\n/);
  const m = POLA_LOKASI.exec(baris[0] ?? "");
  if (!m) return { lokasi: null, isi: pesan.trim() };
  return { lokasi: m[1] || null, isi: baris.slice(1).join("\n").trim() };
}

/** Rentang anggaran dalam rupiah; ujung yang terbuka = null. */
export interface RentangAnggaran {
  min: number | null;
  max: number | null;
}

const SATUAN: Record<string, number> = {
  miliar: 1e9,
  milyar: 1e9,
  billion: 1e9,
  m: 1e9,
  b: 1e9,
  juta: 1e6,
  million: 1e6,
  jt: 1e6,
  ribu: 1e3,
  rb: 1e3,
};

function angka(s: string): number {
  /* "500.000.000" = pemisah ribuan; "1,5" = koma desimal. */
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ""));
  return Number(s.replace(/\./g, "").replace(",", "."));
}

export function rentangAnggaran(teks: string | null | undefined): RentangAnggaran | null {
  const t = (teks ?? "")
    .toLowerCase()
    .replace(/rp\.?/g, " ")
    .replace(/[–—]/g, "-")
    .trim();
  if (!t || /belum|tidak tahu|unknown|not sure/.test(t)) return null;
  const bawah = /(di ?bawah|under|below|kurang dari|<)/.test(t);
  const atas = /(di ?atas|above|over|lebih dari|>)/.test(t);
  const nilai: { n: number; kali: number | null }[] = [];
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)*)\s*(miliar|milyar|billion|million|juta|ribu|jt|rb|m|b)?(?![a-z])/g)) {
    const n = angka(m[1]!);
    if (Number.isFinite(n)) nilai.push({ n, kali: m[2] ? SATUAN[m[2]]! : null });
  }
  if (nilai.length === 0) return null;
  /* "1,5 – 5 miliar": satuan di ujung berlaku juga untuk angka di depannya. */
  const akhir = nilai[nilai.length - 1]!.kali;
  const rupiah = nilai.map(({ n, kali }) => {
    const k = kali ?? akhir;
    if (k) return n * k;
    /* Angka tanpa satuan sama sekali: yang besar dianggap rupiah penuh,
       yang kecil dianggap juta ("500" di isian bebas). */
    return n >= 1e5 ? n : n * 1e6;
  });
  if (bawah) return { min: null, max: rupiah[0]! };
  if (atas) return { min: rupiah[0]!, max: null };
  if (rupiah.length >= 2) return { min: Math.min(rupiah[0]!, rupiah[1]!), max: Math.max(rupiah[0]!, rupiah[1]!) };
  return { min: rupiah[0]!, max: rupiah[0]! };
}
