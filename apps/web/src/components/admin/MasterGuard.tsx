import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { ambilSesi } from "../../lib/session";

type Status = "memeriksa" | "diizinkan" | "ditolak";

interface Props {
  /** id elemen yang disembunyikan sampai pemeriksaan lolos. */
  target: string;
}

/**
 * Menyembunyikan isi halaman dari siapa pun yang bukan master admin.
 *
 * PENTING — ini penjagaan tampilan, bukan keamanan. Situs ini statis, jadi
 * markup-nya sudah terkirim ke browser sebelum pemeriksaan berjalan; siapa pun
 * yang membuka DevTools bisa melihatnya. Itu diterima di sini karena halaman
 * ini hanya berisi contoh komponen, bukan data studio.
 *
 * Data sungguhan dijaga di tempat lain: setiap endpoint admin di API Go wajib
 * lolos RequireSupabaseAuth dan RequireStaff. Kalau nanti halaman ini memuat
 * sesuatu yang benar-benar rahasia, pindahkan penjagaannya ke edge — misalnya
 * Cloudflare Access di depan /admin/*.
 */
export function MasterGuard({ target }: Props) {
  const [status, setStatus] = useState<Status>("memeriksa");

  useEffect(() => {
    let batal = false;

    ambilSesi().then((sesi) => {
      if (batal) return;
      const boleh = Boolean(sesi?.isMasterAdmin);
      setStatus(boleh ? "diizinkan" : "ditolak");

      const el = document.getElementById(target);
      if (el) el.hidden = !boleh;
    });

    return () => {
      batal = true;
    };
  }, [target]);

  if (status === "diizinkan") return null;

  if (status === "memeriksa") {
    return (
      <div className="guard" role="status" aria-live="polite">
        <span className="guard__spinner" aria-hidden="true" />
        <p className="t-muted">Memeriksa akses…</p>
      </div>
    );
  }

  return (
    <div className="guard guard--locked">
      <span className="icon-tile" aria-hidden="true">
        <Icon name="lock" size={22} />
      </span>
      <h2 className="t-heading">Halaman khusus master admin</h2>
      <p className="t-muted">
        Pustaka komponen hanya bisa dibuka oleh akun dengan peran master admin.
        Masuk dengan akun tersebut untuk melanjutkan.
      </p>
      <a className="btn btn--primary" href="/admin/masuk">
        Masuk sebagai master admin
      </a>
    </div>
  );
}
