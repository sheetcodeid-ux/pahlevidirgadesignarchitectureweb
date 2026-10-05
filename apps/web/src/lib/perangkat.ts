/* =============================================================================
   Nama perangkat dari User-Agent — untuk daftar sesi di halaman Akun.

   Cukup untuk menjawab "ini saya atau bukan": peramban dan sistem operasinya.
   Bukan deteksi fitur, dan tidak dipakai untuk memutuskan apa pun.

   Agen yang bukan peramban (yang tercatat Supabase saat login masih lewat
   Worker tanpa meneruskan agen aslinya: "quic-go HTTP/3", kosong) → null,
   dan halaman menyebutnya "perangkat tak dikenal" alih-alih menebak.
   ============================================================================= */

type JenisPerangkat = "ponsel" | "tablet" | "komputer";
export type SistemPerangkat = "macOS" | "iPhone" | "iPad" | "Windows" | "Android" | "ChromeOS" | "Linux" | "Lainnya";

export interface Perangkat {
  peramban: string;
  sistem: SistemPerangkat;
  jenis: JenisPerangkat;
}

export function bacaPerangkat(ua: string | null | undefined): Perangkat | null {
  if (!ua || !/Mozilla\//.test(ua)) return null;

  const sistem: SistemPerangkat = /iPhone|iPod/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows NT/.test(ua)
          ? "Windows"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Mac OS X|Macintosh/.test(ua)
              ? "macOS"
              : /Linux/.test(ua)
                ? "Linux"
                : "Lainnya";

  // Urutannya penting: Edge dan Opera juga menyebut "Chrome", dan Chrome
  // juga menyebut "Safari".
  const peramban = /Edg(?:e|A|iOS)?\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Firefox|FxiOS/.test(ua)
          ? "Firefox"
          : /CriOS|Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Peramban lain";

  const jenis: JenisPerangkat =
    sistem === "iPhone" || (sistem === "Android" && /Mobile/.test(ua))
      ? "ponsel"
      : sistem === "iPad" || sistem === "Android"
        ? "tablet"
        : "komputer";

  return { peramban, sistem, jenis };
}
