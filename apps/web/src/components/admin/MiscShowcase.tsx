import { useState } from "react";
import { DirectionProvider } from "@radix-ui/react-direction";
import { Icon } from "../ui/Icon";
import { Avatar } from "../ui/misc/Avatar";
import { Pagination } from "../ui/misc/Pagination";
import { Attachment } from "../ui/misc/Attachment";
import { MessageScroller } from "../ui/misc/Chat";
import { Questionnaire } from "../ui/misc/Questionnaire";
import { Tabs, NavigationMenu } from "../ui/misc/Nav";

export function MiscShowcase() {
  const [halaman, setHalaman] = useState(4);
  const [rtl, setRtl] = useState(false);

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div className="spec-grid">
        <div className="spec-demo">
          <div className="spec-demo__name">
            <span className="t-subheading">Avatar</span>
            <code className="swatch__name">Avatar</code>
          </div>
          <div className="spec-demo__stage">
            <Avatar name="Muhammad Fikri" brand />
            <Avatar name="Pahlevi Dirga" size="lg" />
            <Avatar name="Gambar Rusak" src="/tidak-ada.jpg" />
            <div className="avatar-group">
              <Avatar name="Ana Wijaya" size="sm" />
              <Avatar name="Budi Santoso" size="sm" />
              <Avatar name="Citra Dewi" size="sm" brand />
            </div>
          </div>
          <p className="field__help">
            Avatar ketiga menunjuk gambar yang tidak ada — jatuh ke inisial, bukan kotak kosong.
          </p>
        </div>

        <div className="spec-demo">
          <div className="spec-demo__name">
            <span className="t-subheading">Tabs</span>
            <code className="swatch__name">Tabs</code>
          </div>
          <Tabs
            items={[
              { id: "detail", label: "Detail", content: <p className="t-muted" style={{ margin: 0 }}>Judul, lokasi, tahun, dan luas bangunan.</p> },
              { id: "galeri", label: "Galeri", content: <p className="t-muted" style={{ margin: 0 }}>Foto proyek beserta teks alternatifnya.</p> },
              { id: "seo", label: "SEO", content: <p className="t-muted" style={{ margin: 0 }}>Judul dan deskripsi untuk mesin pencari.</p> },
            ]}
          />
        </div>

        <div className="spec-demo">
          <div className="spec-demo__name">
            <span className="t-subheading">Pagination</span>
            <code className="swatch__name">Pagination</code>
          </div>
          <div className="spec-demo__stage spec-demo__stage--stack">
            <Pagination halaman={halaman} total={12} onChange={setHalaman} />
            <p className="field__help">Halaman pertama dan terakhir selalu terlihat, sisanya diringkas elipsis.</p>
          </div>
        </div>

        <div className="spec-demo">
          <div className="spec-demo__name">
            <span className="t-subheading">Navigation Menu</span>
            <code className="swatch__name">NavigationMenu</code>
          </div>
          <div className="spec-demo__stage" style={{ minHeight: "11rem", alignItems: "flex-start" }}>
            <NavigationMenu />
          </div>
          <p className="field__help">
            Untuk situs publik: isinya tautan yang bisa di-crawl, jadi boleh terbuka saat kursor singgah. Dropdown Menu berisi perintah, jadi hanya saat diklik.
          </p>
        </div>

        <div className="spec-demo">
          <div className="spec-demo__name">
            <span className="t-subheading">Direction</span>
            <code className="swatch__name">DirectionProvider</code>
          </div>
          <div className="spec-demo__stage spec-demo__stage--stack">
            <label className="switch">
              <input type="checkbox" checked={rtl} onChange={(e) => setRtl(e.target.checked)} />
              <span className="switch__label">Arah kanan-ke-kiri</span>
            </label>
            <DirectionProvider dir={rtl ? "rtl" : "ltr"}>
              <div dir={rtl ? "rtl" : "ltr"} className="item item--bordered">
                <span className="icon-tile icon-tile--sm"><Icon name="project" size={16} /></span>
                <span className="item__text">
                  <span className="item__title">Rumah Tepi Sawah</span>
                  <span className="item__desc">Canggu, Badung</span>
                </span>
                <span className="item__trail"><Icon name="chevronRight" size={18} /></span>
              </div>
            </DirectionProvider>
            <p className="field__help">
              Belum dipakai — disiapkan kalau nanti ada versi bahasa yang ditulis kanan-ke-kiri.
            </p>
          </div>
        </div>

        <div className="spec-demo">
          <div className="spec-demo__name">
            <span className="t-subheading">Message Scroller</span>
            <code className="swatch__name">MessageScroller</code>
          </div>
          <MessageScroller />
          <p className="field__help">
            Menggulir ke pesan terbaru hanya kalau Anda memang sedang di dasar. Gulir ke atas lalu kirim balasan untuk mencobanya.
          </p>
        </div>

        <div className="spec-demo">
          <div className="spec-demo__name">
            <span className="t-subheading">Attachment</span>
            <code className="swatch__name">Attachment</code>
          </div>
          <Attachment />
        </div>

        <div className="spec-demo">
          <div className="spec-demo__name">
            <span className="t-subheading">Questionnaire</span>
            <code className="swatch__name">Questionnaire</code>
          </div>
          <Questionnaire />
        </div>
      </div>
    </div>
  );
}
