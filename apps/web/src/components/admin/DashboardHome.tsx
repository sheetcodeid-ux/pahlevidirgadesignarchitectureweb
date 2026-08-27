import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { RequireAuth } from "./RequireAuth";
import { ambilSettings, profilTersimpan, type Profil } from "../../lib/admin";

/**
 * Kolom kiri dashboard: bidang bertitik dengan sapaan dan kartu identitas
 * studio di tengahnya.
 *
 * Titik-titiknya dua lapis. Lapis dasar selalu terlihat samar supaya bidangnya
 * tidak terbaca sebagai hitam kosong; lapis sorot lebih terang dan sedikit
 * lebih besar, tapi ditutup topeng radial yang mengikuti kursor sehingga hanya
 * muncul di sekitar penunjuk. Posisi kursor dikirim lewat custom property,
 * bukan lewat state React: mousemove menyala puluhan kali per detik dan
 * render ulang sesering itu tidak ada gunanya untuk sesuatu yang cuma
 * menggeser gradien.
 */
function Kiri() {
  const [nama, setNama] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null | undefined>();
  const [profil, setProfil] = useState<Profil | null>(null);
  const kolom = useRef<HTMLElement>(null);

  useEffect(() => {
    setProfil(profilTersimpan());
    ambilSettings()
      .then((s) => {
        setNama(s.studioName);
        setLogo(s.logoUrl);
      })
      .catch(() => setNama("Dirga Pahlevi Architecture"));
  }, []);

  function gerak(e: React.MouseEvent<HTMLElement>) {
    const el = kolom.current;
    if (!el) return;
    const k = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - k.left}px`);
    el.style.setProperty("--my", `${e.clientY - k.top}px`);
  }

  return (
    <section className="dashsplit__kiri" ref={kolom} onMouseMove={gerak}>
      <span className="dashdot dashdot--dasar" aria-hidden="true" />
      <span className="dashdot dashdot--sorot" aria-hidden="true" />

      <div className="dashsplit__isi">
        <h1 className="dash-salam">Selamat Datang.</h1>

        <div className="dash-kartu">
          <span className="dash-kartu__logo">
            {logo
              ? <img src={logo} alt="" />
              : <Icon name="building" size={26} />}
          </span>

          <span className="dash-kartu__teks">
            <span className="dash-kartu__nama">
              {nama ?? <span className="skeleton" style={{ height: "1.1rem", width: "9rem" }} />}
            </span>
            <span className="dash-kartu__peran">
              Login sebagai <strong>{profil?.isMasterAdmin ? "Master admin" : "Staf"}</strong>
            </span>
          </span>

          <a className="dash-kartu__aksi" href="/admin/notifikasi" aria-label="Notifikasi">
            <Icon name="bell" size={17} />
          </a>
          <a className="dash-kartu__aksi" href="/admin/pengaturan" aria-label="Info Studio">
            <Icon name="settings" size={17} />
          </a>
        </div>
      </div>
    </section>
  );
}

export function DashboardHome() {
  return (
    <RequireAuth>
      <div className="dashsplit">
        <Kiri />
        {/* Kolom kanan sengaja kosong dulu — isinya menyusul. Elemennya tetap
            ada supaya garis pemisahnya punya sisi kanan dan lebar kolom kiri
            tidak berubah begitu isinya datang. */}
        <section className="dashsplit__kanan" />
      </div>
    </RequireAuth>
  );
}
