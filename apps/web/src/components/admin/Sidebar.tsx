import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { NAV, type NavItem } from "../../lib/navAdmin";
import { profilTersimpan, ambilSettings } from "../../lib/admin";
import { Perintah } from "./Perintah";

/** Kelompok mana yang sedang ditutup staf — preferensi, bukan keadaan sesaat. */
const KUNCI_GRUP = "pd-sidebar-grup";

interface Props {
  /** Path aktif, dipakai untuk menandai item dan membuka grup yang relevan. */
  currentPath: string;
}

export function Sidebar({ currentPath: currentPathAwal }: Props) {
  const [terbuka, setTerbuka] = useState(false); // drawer di layar kecil
  const [ciut, setCiut] = useState(false); // rail sempit di layar besar
  // Rel yang sedang disembulkan kursor. Beda dari `ciut` yang dipilih staf:
  // ini keadaan sesaat yang hilang begitu kursornya pergi, dan ia MENIMPA
  // konten — melebarkan slotnya akan menggeser seluruh halaman tiap kali
  // kursor lewat, dan itu jauh lebih mengganggu daripada menutupi sedikit.
  const [intip, setIntip] = useState(false);
  const drawerId = useId();

  // Situs ini statis, jadi Astro.url.pathname saat build tidak pernah
  // menyertakan query string — item nav yang dibedakan lewat query baru bisa
  // dicocokkan dengan benar setelah dibaca ulang dari window di klien.
  // Saat ini tidak ada item seperti itu lagi, tapi pembacaan ulangnya
  // dipertahankan: ia juga yang membuat penanda halaman aktif benar ketika
  // pengguna berpindah tanpa memuat ulang.
  //
  // Sengaja lewat useState+useEffect, bukan dihitung langsung tiap render:
  // dihitung langsung membuat pass render pertama di klien (saat hydration)
  // memakai nilai yang beda dari HTML yang dikirim server, dan React tidak
  // selalu menimpa atribut yang sudah ter-attach itu saat hydration — jadi
  // aria-current bisa nyangkut di item yang salah. Lewat setState di effect,
  // pembaruan itu jadi render sungguhan yang dijamin diterapkan.
  const [currentPath, setCurrentPath] = useState(currentPathAwal);
  useEffect(() => {
    const perbarui = () => setCurrentPath(window.location.pathname + window.location.search);
    perbarui();
    // Sidebar memakai transition:persist, jadi ia TIDAK dipasang ulang saat
    // pindah halaman — tanpa pendengar ini, penanda menu aktif akan nyangkut
    // selamanya di halaman tempat panel pertama kali dibuka.
    document.addEventListener("astro:page-load", perbarui);

    // Menu geser di layar kecil harus menutup sendiri begitu satu menu
    // dipilih. Dulu itu terjadi cuma-cuma karena halamannya dimuat ulang;
    // sekarang tidak, jadi harus diminta. Ditutup di before-preparation,
    // bukan page-load, supaya menutupnya terasa seketika saat diklik —
    // bukan setelah halaman barunya siap.
    //
    // Rail sempit (ciut) sengaja TIDAK ikut ditutup: itu preferensi yang
    // dipilih staf, bukan keadaan sesaat.
    const tutup = () => setTerbuka(false);
    document.addEventListener("astro:before-preparation", tutup);

    return () => {
      document.removeEventListener("astro:page-load", perbarui);
      document.removeEventListener("astro:before-preparation", tutup);
    };
  }, []);

  // Situs ini statis, jadi peran pengguna tidak bisa diketahui saat build —
  // dibaca dari profil yang disimpan localStorage saat masuk, sama seperti
  // TopbarUser. Cuma menentukan tampilan menu, bukan penjagaan (lihat
  // catatan di MasterGuard).
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  useEffect(() => {
    setIsMasterAdmin(Boolean(profilTersimpan()?.isMasterAdmin));
  }, []);

  // Gagal diam-diam kalau sesi belum sah — sidebar tetap tampil dengan
  // badge inisial, RequireAuth di konten utama yang menangani pengalihan.
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  useEffect(() => {
    ambilSettings().then((s) => setLogoUrl(s.logoUrl ?? null)).catch(() => {});
  }, []);

  const items = NAV.filter((item) => !item.masterOnly || isMasterAdmin);

  // Object mempertahankan urutan penyisipan kunci string, jadi kelompok
  // tampil sesuai urutan pertama kali muncul di NAV — tidak perlu daftar
  // urutan terpisah.
  const kelompok = items.reduce<Record<string, NavItem[]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  // Menu yang memuat halaman aktif dibuka sejak awal, supaya pengguna tidak
  // perlu mencari di mana dirinya berada.
  const [dibuka, setDibuka] = useState<string[]>(() =>
    items
      .filter((i) => i.children?.some((c) => cocok(c.href, currentPath)))
      .map((i) => i.label),
  );

  /* Kelompok yang sedang DITUTUP staf. Ditulis terbalik — yang disimpan yang
     tertutup, bukan yang terbuka — supaya kelompok baru yang ditambahkan
     nanti muncul terbuka tanpa perlu menyentuh nilai yang sudah tersimpan.
     Disimpan di localStorage karena ini preferensi, bukan keadaan sesaat:
     muat ulang penuh tidak boleh membuka lagi kelompok yang sengaja
     disempitkan. Dibungkus try/catch — di jendela penyamaran pembacaannya
     bisa melempar, dan sidebar yang gagal digambar jauh lebih buruk daripada
     kelompok yang lupa keadaannya. */
  const [grupTutup, setGrupTutup] = useState<string[]>([]);
  useEffect(() => {
    try {
      const t = localStorage.getItem(KUNCI_GRUP);
      if (t) setGrupTutup(JSON.parse(t));
    } catch { /* biarkan terbuka semua */ }
  }, []);

  function toggleKelompok(label: string) {
    setGrupTutup((cur) => {
      const baru = cur.includes(label) ? cur.filter((g) => g !== label) : [...cur, label];
      try { localStorage.setItem(KUNCI_GRUP, JSON.stringify(baru)); } catch { /* tak apa */ }
      return baru;
    });
  }

  /* Membuka sendiri menu yang memuat halaman aktif SETIAP KALI path berubah,
     bukan cuma saat sidebar dipasang.
     Sidebar memakai transition:persist, jadi ia tidak pernah dipasang ulang:
     berpindah ke /admin/pengaturan/akun lewat router — dari palet perintah,
     dari tautan mana pun — meninggalkan menu induknya tertutup, dan karena
     item aktifnya ada DI DALAM menu yang tertutup, tidak ada satu pun baris
     yang tersorot. Terukur: aria-current tidak menempel di mana-mana
     sementara halamannya memang halaman Akun. Muat-ulang penuh ke alamat
     yang sama benar, jadi cacatnya cuma muncul lewat navigasi sisi klien. */
  useEffect(() => {
    const induk = items.find((i) => i.children?.some((c) => cocok(c.href, currentPath)));
    if (!induk) return;
    setDibuka((cur) => (cur.includes(induk.label) ? cur : [...cur, induk.label]));
    setGrupTutup((cur) => cur.filter((g) => g !== induk.group));
  }, [currentPath, isMasterAdmin]);


  /* Menandai nav yang isinya melebihi tingginya, supaya CSS bisa memudarkan
     tepi bawahnya. Diukur dengan ResizeObserver dan bukan di dalam handler
     gulir: membaca properti geometri saat gulir memaksa layout tiap frame
     (jebakan #21). Observer hanya menyala saat ukurannya benar-benar
     berubah — buka/tutup kelompok, buka/tutup submenu, ganti ukuran
     jendela — jadi ongkosnya nol selama halaman diam. */
  const nav = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const ukur = () => {
      if (el.scrollHeight > el.clientHeight + 1) el.setAttribute("data-luber", "");
      else el.removeAttribute("data-luber");
    };
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(el);
    /* Anak pertama ikut diamati: tinggi nav sendiri tidak berubah saat satu
       kelompok ditutup — yang berubah tinggi ISInya. */
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    for (const g of el.querySelectorAll(".sidebar__group")) ro.observe(g);
    return () => ro.disconnect();
  }, [dibuka, grupTutup, isMasterAdmin]);

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

      <div
        className="sidebar-slot"
        data-collapsed={ciut || undefined}
        data-peek={ciut && intip ? "" : undefined}
        /* pointerType, bukan onMouseEnter: di layar sentuh satu ketukan ikut
           mengirim peristiwa tetikus tiruan, lalu TIDAK PERNAH mengirim
           pasangan "menjauh"-nya — jadi sidebar-nya nyangkut terbuka menutupi
           halaman, dan tidak ada cara menutupnya selain memuat ulang. Sudah
           terjadi di ponsel pemilik. */
        onPointerEnter={(e) => { if (e.pointerType === "mouse") setIntip(true); }}
        onPointerLeave={() => setIntip(false)}
      >
      <aside
        id={drawerId}
        className="sidebar"
        data-open={terbuka || undefined}
      >
        <div className="sidebar__head">
          <a href="/admin" className="sidebar__brand" aria-label="Dirga Pahlevi Architecture, ke dashboard">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="sidebar__mark sidebar__mark--img" aria-hidden="true" />
            ) : (
              <span className="sidebar__mark" aria-hidden="true">DPA</span>
            )}
            <span className="sidebar__wordmark geser">
              <span className="geser__isi">Dirga Pahlevi Architecture</span>
            </span>
          </a>

          <button
            type="button"
            className="sidebar__close btn btn--ghost btn--icon"
            aria-label="Tutup menu navigasi"
            onClick={() => setTerbuka(false)}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Kotak cari perintah, sejajar daftar menu yang isinya sama. */}
        <Perintah />

        <nav className="sidebar__nav" aria-label="Navigasi admin" ref={nav}>
          {Object.entries(kelompok).map(([labelGrup, itemGrup]) => {
          const grupTampil = !grupTutup.includes(labelGrup);
          return (
          <div className="sidebar__group" key={labelGrup} data-tutup={!grupTampil || undefined}>
          {/* Kepalanya tombol, bukan label mati. "Situs Publik" sendirian
              tujuh baris, dan seluruh navnya 1.155px di dalam slot 744px —
              411px menu berada di bawah lipatan pada layar 1000px, lebih
              lagi di laptop. Kelompoknya tetap TERBUKA sebagai bawaan supaya
              daftar itu tetap jadi pengingat apa yang belum diisi, seperti
              alasan aslinya; yang ditambahkan cuma kemampuan menutupnya. */}
          <button
            type="button"
            className="sidebar__group-label"
            aria-expanded={grupTampil}
            onClick={() => toggleKelompok(labelGrup)}
            title={grupTampil ? `Tutup ${labelGrup}` : `Buka ${labelGrup}`}
          >
            <span className="sidebar__group-teks">{labelGrup}</span>
            <span className="sidebar__group-chevron" data-open={grupTampil || undefined}>
              <Icon name="chevronDown" size={13} />
            </span>
          </button>
          <ul className="sidebar__list" hidden={!grupTampil}>
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
                      <Icon name={item.icon} size={18} variant={aktif ? "filled" : "stroke"} />
                      <span className="sidebar__label geser">
                        <span className="geser__isi">{item.label}</span>
                      </span>
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
                    <Icon name={item.icon} size={18} variant={adaAnakAktif ? "filled" : "stroke"} />
                    <span className="sidebar__label geser">
                      <span className="geser__isi">{item.label}</span>
                    </span>
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
                            <Icon name={child.icon} size={15} />
                            <span>{child.label}</span>
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
          );
          })}
        </nav>

        <div className="sidebar__foot">
          <a href="/" className="sidebar__site">
            <span className="sidebar__site-text">
              <span className="t-label">Situs publik</span>
              <span className="sidebar__site-name geser">
                <span className="geser__isi">pahlevidirgaarchitecture.com</span>
              </span>
            </span>
            <Icon name="external" size={16} />
          </a>

          {/* Tombolnya di kaki, bukan di kepala: di kepala ia bersaing dengan
              logo dan nama studio, dan yang paling sering dilihat justru
              bukan dia. Referensi Cloudflare menaruhnya di kaki juga. */}
          <button
            type="button"
            className="sidebar__collapse"
            aria-label={ciut ? "Lebarkan sidebar" : "Sempitkan sidebar"}
            aria-pressed={ciut}
            onClick={() => { setCiut((v) => !v); setIntip(false); }}
          >
            <Icon name="panel" size={16} />
            <span className="sidebar__label geser">
              <span className="geser__isi">{ciut ? "Lebarkan" : "Sempitkan"}</span>
            </span>
          </button>
        </div>
      </aside>
      </div>
    </>
  );
}

/**
 * Cocok jika path DAN query sama persis (mengabaikan garis miring penutup di
 * path). Query ikut dibandingkan — bukan dibuang — supaya dua item yang
 * hanya dibedakan oleh query tidak pernah cocok berdua sekaligus.
 */
function cocok(href: string, current: string) {
  const pisah = (s: string): [string, string] => {
    const [path, query = ""] = s.split("?");
    return [path.replace(/\/+$/, "") || "/", query];
  };
  const [hPath, hQuery] = pisah(href);
  const [cPath, cQuery] = pisah(current);
  return hPath === cPath && hQuery === cQuery;
}
