/**
 * Pertanyaan yang disorot di beranda.
 *
 * Ini BUKAN seluruh isi /faq — halaman itu memuat daftar lengkapnya. Yang
 * ditaruh di sini hanya lima yang paling sering ditanya, supaya beranda dan
 * /faq tidak menyimpan kalimat yang sama di dua tempat dan tidak bisa
 * berbeda-beda. `id` di bawah harus sama dengan id bagian di /faq, karena
 * itu yang dipakai tautannya untuk mendarat tepat di jawabannya.
 */
export interface SorotanFaq {
  id: string;
  tanya: string;
}

export const SOROTAN_FAQ: SorotanFaq[] = [
  { id: "luar-negeri", tanya: "Can you work with me if I live outside Indonesia?" },
  { id: "biaya", tanya: "How are fees and payment terms structured?" },
  { id: "lama", tanya: "How long does a project like Elsana take?" },
  { id: "hasil", tanya: "What exactly do I receive at the end?" },
  { id: "pengawasan", tanya: "Do you supervise construction as well?" },
];
