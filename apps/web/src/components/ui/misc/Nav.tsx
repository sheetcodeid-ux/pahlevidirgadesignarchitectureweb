import * as RTabs from "@radix-ui/react-tabs";
import * as RNav from "@radix-ui/react-navigation-menu";
import type { ReactNode } from "react";
import { Icon } from "../Icon";

/** Tabs dengan panel. Berbeda dari Toggle Group, yang hanya memilih nilai. */
export function Tabs({ items }: { items: { id: string; label: string; content: ReactNode }[] }) {
  return (
    <RTabs.Root className="tabs" defaultValue={items[0].id}>
      {/* --block, bukan lebar-isi: bilah tab yang membentang penuh tapi
          opsinya menggerombol di kiri menyisakan ruang kosong yang tidak
          dimiliki siapa pun. Tiap opsi mengambil bagian yang sama. */}
      <RTabs.List className="segmented segmented--block segmented--tebal" aria-label="Contoh tab">
        {items.map((t) => (
          <RTabs.Trigger key={t.id} value={t.id} className="segmented__opt">
            {t.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {items.map((t) => (
        <RTabs.Content key={t.id} value={t.id} className="tabs__panel">
          {t.content}
        </RTabs.Content>
      ))}
    </RTabs.Root>
  );
}

/**
 * Navigation Menu untuk situs publik.
 *
 * Berbeda dari Dropdown Menu: isinya tautan yang bisa di-crawl dan di-hover,
 * bukan perintah. Karena itu menunya boleh terbuka saat kursor singgah,
 * sementara Dropdown Menu hanya terbuka saat diklik.
 */
export function NavigationMenu() {
  return (
    <RNav.Root className="navmenu">
      <RNav.List className="navmenu__list">
        <RNav.Item>
          <RNav.Trigger className="navmenu__trigger">
            Proyek <Icon name="chevronDown" size={14} />
          </RNav.Trigger>
          <RNav.Content className="navmenu__content">
            <div className="navmenu__grid">
              {[
                { judul: "Hunian", ket: "Rumah tinggal dan vila" },
                { judul: "Komersial", ket: "Kantor, kafe, dan retail" },
                { judul: "Interior", ket: "Penataan ruang dalam" },
                { judul: "Renovasi", ket: "Pembaruan bangunan lama" },
              ].map((k) => (
                <RNav.Link asChild key={k.judul}>
                  <a className="item" href="/proyek">
                    <span className="item__text">
                      <span className="item__title">{k.judul}</span>
                      <span className="item__desc">{k.ket}</span>
                    </span>
                  </a>
                </RNav.Link>
              ))}
            </div>
          </RNav.Content>
        </RNav.Item>

        <RNav.Item>
          <RNav.Link className="navmenu__link" href="/tentang">Tentang</RNav.Link>
        </RNav.Item>
        <RNav.Item>
          <RNav.Link className="navmenu__link" href="/kontak">Kontak</RNav.Link>
        </RNav.Item>
      </RNav.List>

      <div className="navmenu__viewport-wrap">
        <RNav.Viewport className="navmenu__viewport" />
      </div>
    </RNav.Root>
  );
}
