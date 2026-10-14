import { VALID_CATEGORIES } from "../types";

/* Form kontak situs publik mengirim jenis proyek sebagai LABEL yang dilihat
   pengunjung ("Rumah", "Kafe atau restoran"), bukan kode kategori. Dulu API
   hanya menerima kode, jadi setiap jenis dari form terbuang diam-diam dan
   pesannya tersimpan tanpa jenis — terukur di produksi pada pesan 10 Sep
   2026. Label diterjemahkan di sini, di satu tempat, supaya form lama yang
   masih tersimpan di peramban pengunjung tetap benar. Kode kategori yang
   sah tetap diterima apa adanya. "Lainnya" memang tidak punya kategori. */
const LABEL_FORM: Record<string, string> = {
  rumah: "residential",
  "kafe atau restoran": "coffeeshop",
  "ruang kerja atau kantor": "commercial",
  ritel: "commercial",
  renovasi: "renovation",
};

export function jenisDariForm(nilai: string | undefined | null): string | null {
  const t = (nilai ?? "").trim();
  if (!t) return null;
  if (VALID_CATEGORIES.has(t)) return t;
  return LABEL_FORM[t.toLowerCase()] ?? null;
}
