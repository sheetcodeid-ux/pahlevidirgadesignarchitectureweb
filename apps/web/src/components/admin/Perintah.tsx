import { useEffect, useState } from "react";
import { Command as Cmdk } from "cmdk";
import * as RDialog from "@radix-ui/react-dialog";
import { Icon, type IconName } from "../ui/Icon";
import { halamanRata } from "../../lib/navAdmin";
import { bukaProyek } from "../../lib/proyekAktif";
import { daftarProyek, bacaCache, type Proyek } from "../../lib/admin";

/* Diturunkan dari peta nav yang sama dengan sidebar — lihat lib/navAdmin.ts
   untuk alasannya. Dua halaman yang tidak punya baris di sidebar ditambahkan
   di sini: Proyek Baru (aksi, bukan tujuan) dan Notifikasi (dibuka dari
   lonceng). */
const HALAMAN: { label: string; ikon: IconName; ke: string }[] = [
  /* masterOnly dibuang: palet tidak tahu peran pemakainya, dan menawarkan
     halaman UI Component kepada staf penginput cuma menambah baris yang
     tidak pernah dia butuhkan. Ini kerapian, bukan penjagaan — lihat
     catatan di MasterGuard. */
  ...halamanRata().filter((h) => !h.masterOnly)
    .map((h) => ({ label: h.label, ikon: h.icon, ke: h.href })),
  { label: "Proyek Baru", ikon: "projectPlus", ke: "/admin/proyek/baru" },
  { label: "Notifikasi", ikon: "bell", ke: "/admin/notifikasi" },
];

/**
 * Command palette — perintah cepat, dibuka lewat kotak cari di sidebar atau
 * Ctrl/Cmd+K.
 *
 * Tempatnya di sidebar, bukan topbar: di sana ia sejajar dengan daftar menu
 * yang isinya sama, dan topbar jadi bebas untuk hal yang benar-benar berubah
 * per halaman. Referensi Cloudflare menaruhnya persis di situ juga.
 *
 * Daftar proyek diambil sendiri, bukan diterima sebagai prop: pemanggilnya
 * satu-satunya adalah sidebar, dan permintaannya sudah dilayani cache
 * sessionStorage yang sama dengan halaman Semua Proyek.
 */
export function Perintah() {
  const [buka, setBuka] = useState(false);
  const [proyek, setProyek] = useState<Proyek[] | null>(() => bacaCache<Proyek[]>("proyek"));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setBuka((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Membaca cache, TIDAK menulisnya. Menulis lewat tulisCache juga menyimpan
  // panjang daftarnya di localStorage — dan itu dibaca saat render oleh
  // skeleton halaman Semua Proyek. Karena sidebar hidrasi lebih dulu, tulisan
  // dari sini bisa mendarat SEBELUM halaman itu hidrasi, sehingga jumlah baris
  // yang dirender server (6) beda dari yang dihitung klien (3) dan React
  // membuang seluruh pohonnya. Terukur: 3 dari 8 muat halaman.
  useEffect(() => {
    daftarProyek().then(setProyek).catch(() => {});
  }, []);

  return (
    <RDialog.Root open={buka} onOpenChange={setBuka}>
      <RDialog.Trigger asChild>
        <button type="button" className="sidebar__cari" aria-label="Perintah cepat">
          <Icon name="search" size={16} />
          <span className="sidebar__cari-label geser">
            <span className="geser__isi">Cari apa saja…</span>
          </span>
          <kbd className="ov-menu__shortcut sidebar__kbd">⌘K</kbd>
        </button>
      </RDialog.Trigger>

      <RDialog.Portal>
        <RDialog.Overlay className="ov-scrim" />
        <RDialog.Content className="ov-dialog ov-panel" aria-label="Perintah cepat">
          <RDialog.Title className="sr-only">Perintah cepat</RDialog.Title>
          <Cmdk className="ov-command" loop>
            <div className="ov-command__search">
              <Icon name="search" size={18} />
              <Cmdk.Input className="ov-command__input" placeholder="Cari halaman atau proyek…" autoFocus />
              <kbd className="ov-menu__shortcut">ESC</kbd>
            </div>

            <Cmdk.List className="ov-command__list">
              <Cmdk.Empty className="ov-command__empty">Tidak ada yang cocok.</Cmdk.Empty>

              <Cmdk.Group heading="Halaman" className="ov-command__group">
                {HALAMAN.map((h) => (
                  <Cmdk.Item key={h.ke} className="ov-command__item"
                    onSelect={() => { window.location.href = h.ke; }}>
                    <Icon name={h.ikon} size={16} />{h.label}
                  </Cmdk.Item>
                ))}
              </Cmdk.Group>

              {(proyek ?? []).length > 0 && (
                <Cmdk.Group heading="Proyek" className="ov-command__group">
                  {(proyek ?? []).map((p) => (
                    <Cmdk.Item key={p.id} value={`${p.title} ${p.category}`} className="ov-command__item"
                      onSelect={() => bukaProyek(p.id)}>
                      <Icon name="project" size={16} />{p.title}
                    </Cmdk.Item>
                  ))}
                </Cmdk.Group>
              )}
            </Cmdk.List>
          </Cmdk>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
