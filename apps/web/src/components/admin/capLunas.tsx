import { BULAN_PENDEK } from "./frame25";

/* Cap LUNAS: cincin rangkap, "LUNAS" di busur atas, inisial studio di busur
   bawah, tanggal di tengah. Dipakai kuitansi fee dan surat tagihan — gayanya
   milik halaman masing-masing lewat awalan kelas (`kelas="kwt"` →
   `kwt__cap`, `kwt__capluar`, …), supaya warnanya mengikuti kertasnya. */
export function CapLunas({
  tanggal,
  studio,
  id,
  kelas,
  ukuran = 46,
}: {
  /** ISO; yang dipakai cuma bulan dan harinya. */
  tanggal: string;
  /** Inisial studio, ditulis di busur bawah. */
  studio: string;
  /** Pembeda id path busur — satu halaman bisa memuat beberapa cap. */
  id: string;
  kelas: string;
  ukuran?: number;
}) {
  const [, m, h] = tanggal.slice(0, 10).split("-");
  const aman = `${kelas}-${id.replace(/[^A-Za-z0-9_-]/g, "")}`;
  return (
    <svg
      className={`${kelas}__cap`}
      viewBox="0 0 48 48"
      width={ukuran}
      height={ukuran}
      role="img"
      aria-label={`Lunas ${Number(h)} ${BULAN_PENDEK[Number(m) - 1] ?? ""}`}
    >
      <defs>
        <path id={`${aman}-atas`} d="M 9 24 A 15 15 0 0 1 39 24" />
        <path id={`${aman}-bawah`} d="M 6.5 24 A 17.5 17.5 0 0 0 41.5 24" />
      </defs>
      <circle cx="24" cy="24" r="22.6" className={`${kelas}__capluar`} />
      <circle cx="24" cy="24" r="21" className={`${kelas}__capdalam`} />
      <text className={`${kelas}__capbusur`}>
        <textPath href={`#${aman}-atas`} startOffset="50%" textAnchor="middle">
          LUNAS
        </textPath>
      </text>
      <text className={`${kelas}__capbusur ${kelas}__capbusur--bawah`}>
        <textPath href={`#${aman}-bawah`} startOffset="50%" textAnchor="middle">
          {studio}
        </textPath>
      </text>
      <text x="24" y="31" textAnchor="middle" className={`${kelas}__captgl`}>
        {`${Number(h)}/${Number(m)}`}
      </text>
    </svg>
  );
}
