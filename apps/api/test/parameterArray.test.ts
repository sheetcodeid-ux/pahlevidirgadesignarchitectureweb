import { describe, expect, it } from "vitest";

/**
 * Menjaga satu kelas bug yang sudah memerahkan dua deploy berturut-turut.
 *
 * Worker menyambung ke Postgres dengan `fetch_types: false` (lihat
 * src/db.ts) — wajib untuk Hyperdrive. Konsekuensinya postgres.js tidak
 * punya katalog tipe, jadi ia TIDAK BISA menyerialkan sebuah array
 * JavaScript menjadi array literal Postgres: yang terkirim adalah string
 * biasa, dan Postgres menolaknya dengan "malformed array literal".
 *
 * Query berbentuk `= any(${daftar})` karena itu SELALU 500 di produksi
 * sementara lulus sempurna di mesin mana pun yang memakai setelan
 * postgres.js bawaan. Persis itu yang terjadi: dua deploy merah dengan
 * seluruh tes lokal hijau.
 *
 * Bentuk yang benar adalah `in ${sql(daftar)}` — merender satu parameter
 * per elemen, jadi tidak ada tipe array yang perlu diketahui.
 *
 * Diperiksa sebagai TEKS, bukan dengan menjalankan query: yang dijaga di
 * sini adalah BENTUK query-nya, dan itu bisa dilihat tanpa database.
 *
 * import.meta.glob dipakai alih-alih node:fs karena tsconfig paket ini
 * bertipe Workers — tidak ada tipe Node di dalamnya.
 */

const berkas = import.meta.glob("../src/repository/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/* `any(${...})` dengan interpolasi apa pun di dalamnya. Yang memakai nilai
   tunggal juga ikut terjaring, dan itu memang diinginkan: `any` atas nilai
   tunggal tidak masuk akal, jadi kalau muncul ia hampir pasti sebuah array. */
const POLA_ANY = /=\s*any\(\$\{/;

/** Baris komentar dilewati — catatan yang MENJELASKAN larangan ini ikut
 *  memuat polanya, dan menjaringnya berarti tes gagal karena dokumentasinya
 *  sendiri. */
function barisKomentar(baris: string): boolean {
  const t = baris.trimStart();
  return t.startsWith("//") || t.startsWith("/*") || t.startsWith("*");
}

describe("parameter array tidak boleh dipakai (fetch_types: false)", () => {
  it("ada berkas repository untuk diperiksa", () => {
    expect(Object.keys(berkas).length).toBeGreaterThan(0);
  });

  for (const [jalur, isi] of Object.entries(berkas)) {
    const nama = jalur.split("/").pop() ?? jalur;

    it(`${nama} tidak memakai = any(\${...})`, () => {
      const kena: string[] = [];
      isi.split("\n").forEach((baris, i) => {
        if (barisKomentar(baris)) return;
        if (POLA_ANY.test(baris)) kena.push(`${nama}:${i + 1} ${baris.trim()}`);
      });

      expect(
        kena,
        "Pakai `in ${sql(daftar)}` — array JavaScript tidak bisa jadi parameter " +
          "saat fetch_types:false, dan gagalnya hanya muncul di produksi.",
      ).toEqual([]);
    });
  }
});
