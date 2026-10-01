/* =============================================================================
   Remah (breadcrumb) — frame Breadcrumb.

   Dibungkus <nav aria-label> dengan <ol>: urutan di sini membawa makna, jadi
   daftar berurutlah yang benar. Halaman terakhir bukan tautan — ia tempat
   pengunjung sedang berdiri, dan ditandai aria-current.
   ============================================================================= */

export interface SatuRemah {
  label: string;
  href?: string;
}

export function Remah({ jalur, className }: { jalur: SatuRemah[]; className?: string }) {
  return (
    <nav aria-label="Jalur halaman" className={className}>
      <ol className="k-remah">
        {jalur.map((r, i) => (
          <li key={r.label} className="k-remah__item">
            {i > 0 && (
              <span className="k-remah__pisah" aria-hidden="true">
                /
              </span>
            )}
            {/* Hanya yang TERAKHIR "halaman ini"; butir tanpa alamat di tengah
                (kelompok menu seperti "Keuangan") cuma teks. */}
            {r.href && i < jalur.length - 1 ? (
              <a href={r.href}>{r.label}</a>
            ) : (
              <span aria-current={i === jalur.length - 1 ? "page" : undefined}>{r.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
