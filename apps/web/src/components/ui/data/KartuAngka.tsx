import { Icon, type IconName } from "../Icon";

/* =============================================================================
   Kartu angka — ditiru dari kartu "Total Income (This Month)" milik pemilik.

   Yang membedakannya dari kartu papan lain di situs ini, dan semuanya diambil
   langsung dari gambar referensi:

   - Ubin ikon di pojok KANAN ATAS, sejajar label — bukan di kiri sebelum label
   - Label huruf biasa, bukan HURUF BESAR bertrack. Referensi menulis
     "Total Income (This Month)", dan itu kalimat, bukan penanda
   - Angka besar mendominasi kartu; tidak ada grafik, tidak ada tombol
   - Delta memakai panah TREN (garis berbelok naik), bukan panah lurus
   - Baris delta cuma satu potong teks — persentase ATAU keterangan seperti
     "3 tagihan lewat tempo". Referensi memakai keduanya di kartu berbeda
   ============================================================================= */

export interface KartuAngkaProps {
  /** Kalimat pendek, huruf biasa. Contoh: "Kas masuk (bulan ini)". */
  label: string;
  nilai: string;
  ikon: IconName;
  /** Isi baris bawah: "+18,2%" atau "3 tagihan lewat tempo". */
  delta?: string;
  /** Arah panah tren. */
  deltaArah?: "naik" | "turun";
  /**
   * Warna baris delta, dipisah dari arah panahnya.
   *
   * Beban yang TURUN adalah kabar baik dan harus hijau meski panahnya
   * menunjuk ke bawah. Bawaannya naik = baik.
   */
  deltaNada?: "baik" | "buruk" | "netral";
  /** Warnai angkanya sebagai nilai negatif. */
  minus?: boolean;
}

export function KartuAngka({
  label, nilai, ikon, delta, deltaArah = "naik", deltaNada, minus,
}: KartuAngkaProps) {
  const nada = deltaNada ?? (deltaArah === "naik" ? "baik" : "buruk");
  return (
    <article className="kangka">
      <header className="kangka__head">
        <p className="kangka__label">{label}</p>
        <span className="kangka__ubin" aria-hidden="true">
          <Icon name={ikon} size={16} />
        </span>
      </header>
      <p className={`kangka__nilai${minus ? " angka-minus" : ""}`}>{nilai}</p>
      {delta && (
        <p className={`kangka__delta kangka__delta--${nada}`}>
          {/* Nada netral tidak dapat panah: barisnya keterangan, bukan tren.
             "belum ada proyek berkontrak" dengan panah naik membaca seolah
             ketiadaan proyek itu sedang membaik. */}
          {nada !== "netral" && (
            <Icon name={deltaArah === "naik" ? "trendUp" : "trendDown"} size={15} />
          )}
          {delta}
        </p>
      )}
    </article>
  );
}

/** Deret empat kartu angka, sesuai baris teratas di referensi. */
export function DeretAngka({ children }: { children: React.ReactNode }) {
  return <div className="kangka-deret">{children}</div>;
}
