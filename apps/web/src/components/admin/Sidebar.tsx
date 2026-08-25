import { useEffect, useId, useState } from "react";
import { Icon, type IconName } from "../ui/Icon";

interface SubItem {
  label: string;
  href: string;
}

interface NavItem {
  label: string;
  href?: string;
  icon: IconName;
  children?: SubItem[];
  /** Hanya tampil untuk master admin. */
  masterOnly?: boolean;
  /** Label kelompok kecil di atas item — mengelompokkan sidebar seperti bagian di halaman panjang. */
  group: string;
}

// Ikon dipilih agar cocok dengan labelnya, bukan sekadar mengisi ruang:
// denah bangunan untuk proyek, amplop untuk pesan masuk, lapisan untuk
// pustaka komponen.
const NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: "dashboard", group: "Utama" },
  {
    label: "Proyek",
    icon: "project",
    group: "Utama",
    children: [
      { label: "Semua Proyek", href: "/admin/proyek" },
      { label: "Draf", href: "/admin/proyek?status=draft" },
    ],
  },
  { label: "Media", href: "/admin/media", icon: "image", group: "Utama" },
  { label: "Pesan Masuk", href: "/admin/pesan", icon: "inquiry", group: "Utama" },
  {
    label: "Pengaturan",
    icon: "settings",
    group: "Sistem",
    children: [
      { label: "Info Studio", href: "/admin/pengaturan" },
      { label: "Akun", href: "/admin/pengaturan/akun" },
    ],
  },
  { label: "UI Component", href: "/admin/ui", icon: "component", group: "Sistem", masterOnly: true },
];

interface Props {
  /** Path aktif, dipakai untuk menandai item dan membuka grup yang relevan. */
  currentPath: string;
  isMasterAdmin?: boolean;
}

export function Sidebar({ currentPath, isMasterAdmin = false }: Props) {
  const [terbuka, setTerbuka] = useState(false); // drawer di layar kecil
  const [ciut, setCiut] = useState(false); // rail sempit di layar besar
  const drawerId = useId();

  const items = NAV.filter((item) => !item.masterOnly || isMasterAdmin);

  // Object mempertahankan urutan penyisipan kunci string, jadi kelompok
  // tampil sesuai urutan pertama kali muncul di NAV — tidak perlu daftar
  // urutan terpisah.
  const kelompok = items.reduce<Record<string, NavItem[]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  // Grup yang memuat halaman aktif dibuka sejak awal, supaya pengguna tidak
  // perlu mencari di mana dirinya berada.
  const [dibuka, setDibuka] = useState<string[]>(() =>
    items
      .filter((i) => i.children?.some((c) => cocok(c.href, currentPath)))
      .map((i) => i.label),
  );

  // Esc menutup drawer; ini satu-satunya jalan keluar lewat keyboard.
  useEffect(() => {
    if (!terbuka) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setTerbuka(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [terbuka]);

  // Kunci gulir badan halaman selama drawer terbuka.
  useEffect(() => {
    document.body.style.overflow = terbuka ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [terbuka]);

  function toggleGrup(label: string) {
    setDibuka((cur) =>
      cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label],
    );
  }

  return (
    <>
      {/* Tombol drawer hanya muncul di layar sempit. */}
      <button
        type="button"
        className="sidebar-trigger btn btn--secondary btn--icon"
        aria-label="Buka menu navigasi"
        aria-expanded={terbuka}
        aria-controls={drawerId}
        onClick={() => setTerbuka(true)}
      >
        <Icon name="dashboard" size={18} />
      </button>

      {terbuka && (
        <div
          className="sidebar-scrim"
          onClick={() => setTerbuka(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id={drawerId}
        className="sidebar"
        data-open={terbuka || undefined}
        data-collapsed={ciut || undefined}
      >
        <div className="sidebar__head">
          <a href="/admin" className="sidebar__brand" aria-label="Dirga Pahlevi Architecture, ke dashboard">
            <span className="sidebar__mark" aria-hidden="true">DPA</span>
            <span className="sidebar__wordmark">Dirga Pahlevi Architecture</span>
          </a>

          <button
            type="button"
            className="sidebar__collapse btn btn--ghost btn--icon"
            aria-label={ciut ? "Lebarkan sidebar" : "Sempitkan sidebar"}
            onClick={() => setCiut((v) => !v)}
          >
            <Icon name={ciut ? "chevronRight" : "chevronLeft"} size={16} />
          </button>

          <button
            type="button"
            className="sidebar__close btn btn--ghost btn--icon"
            aria-label="Tutup menu navigasi"
            onClick={() => setTerbuka(false)}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Navigasi admin">
          {Object.entries(kelompok).map(([labelGrup, itemGrup]) => (
          <div className="sidebar__group" key={labelGrup}>
          <p className="sidebar__group-label">{labelGrup}</p>
          <ul className="sidebar__list">
            {itemGrup.map((item) => {
              if (!item.children) {
                const aktif = cocok(item.href!, currentPath);
                return (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="sidebar__item"
                      aria-current={aktif ? "page" : undefined}
                      title={ciut ? item.label : undefined}
                    >
                      <Icon name={item.icon} size={18} />
                      <span className="sidebar__label">{item.label}</span>
                    </a>
                  </li>
                );
              }

              const grupTerbuka = dibuka.includes(item.label);
              const adaAnakAktif = item.children.some((c) => cocok(c.href, currentPath));

              return (
                <li key={item.label}>
                  <button
                    type="button"
                    className="sidebar__item"
                    data-active-branch={adaAnakAktif || undefined}
                    aria-expanded={grupTerbuka}
                    onClick={() => toggleGrup(item.label)}
                    title={ciut ? item.label : undefined}
                  >
                    <Icon name={item.icon} size={18} />
                    <span className="sidebar__label">{item.label}</span>
                    <span className="sidebar__chevron" data-open={grupTerbuka || undefined}>
                      <Icon name="chevronDown" size={14} />
                    </span>
                  </button>

                  {grupTerbuka && (
                    <ul className="sidebar__sub">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <a
                            href={child.href}
                            className="sidebar__subitem"
                            aria-current={cocok(child.href, currentPath) ? "page" : undefined}
                          >
                            {child.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          </div>
          ))}
        </nav>

        <div className="sidebar__foot">
          <a href="/" className="sidebar__site">
            <span className="sidebar__site-text">
              <span className="t-label">Situs publik</span>
              <span className="sidebar__site-name">pahlevidirgaarchitecture.com</span>
            </span>
            <Icon name="external" size={16} />
          </a>
        </div>
      </aside>
    </>
  );
}

/** Cocok jika path sama persis, mengabaikan query dan garis miring penutup. */
function cocok(href: string, current: string) {
  const bersih = (s: string) => s.split("?")[0].replace(/\/+$/, "") || "/";
  return bersih(href) === bersih(current);
}
