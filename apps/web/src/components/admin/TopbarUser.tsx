import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { Avatar } from "../ui/misc/Avatar";
import { profilTersimpan, hapusSesi, type Profil } from "../../lib/admin";

/**
 * Identitas dan aksi cepat di topbar — persisten di semua halaman admin,
 * bukan cuma muncul di dashboard.
 *
 * Dibaca dari profilTersimpan() (localStorage yang diisi saat masuk), bukan
 * memanggil API lagi: RequireAuth di tiap halaman sudah memvalidasi sesi
 * sungguhan, jadi ini murni tampilan dan boleh optimistis.
 */
export function TopbarUser() {
  const [profil, setProfil] = useState<Profil | null>(null);

  useEffect(() => {
    setProfil(profilTersimpan());
  }, []);

  if (!profil) return null;

  const nama = profil.email.split("@")[0];

  return (
    <div className="topbar-user">
      <a href="/admin/pesan" className="btn btn--ghost btn--icon" aria-label="Pesan masuk">
        <Icon name="inquiry" size={18} />
      </a>

      <div className="topbar-user__id">
        <Avatar name={nama} brand size="sm" />
        <span className="topbar-user__text">
          <span className="topbar-user__nama">{nama}</span>
          <span className="topbar-user__peran">{profil.isMasterAdmin ? "Master admin" : "Staf"}</span>
        </span>
      </div>

      <button
        type="button"
        className="btn btn--ghost btn--icon"
        aria-label="Keluar"
        onClick={() => {
          hapusSesi();
          window.location.replace("/admin/masuk");
        }}
      >
        <Icon name="logout" size={16} />
      </button>
    </div>
  );
}
