import { useState } from "react";
import { Icon } from "../ui/Icon";
import { Dialog, AlertDialog, Sheet } from "../ui/overlay/Dialog";
import { DropdownMenu, ContextMenu, Menubar, type MenuSection } from "../ui/overlay/Menu";
import { Tooltip, TooltipProvider, Popover, HoverCard } from "../ui/overlay/Floating";
import { Select } from "../ui/overlay/Select";
import { CommandPalette, Combobox } from "../ui/overlay/Command";
import { ToastProvider, useToast } from "../ui/overlay/Toast";

const menuProyek: MenuSection[] = [
  {
    label: "Proyek",
    items: [
      { label: "Sunting", icon: "edit", shortcut: "E" },
      { label: "Duplikat", icon: "copy", shortcut: "D" },
      { label: "Lihat di situs", icon: "external", disabled: true },
    ],
  },
  { items: [{ label: "Hapus proyek", icon: "trash", danger: true, shortcut: "⌫" }] },
];

function TombolToast() {
  const toast = useToast();
  return (
    <div className="spec-demo__stage">
      <button
        type="button"
        className="btn btn--secondary"
        onClick={() => toast({ judul: "Perubahan disimpan", keterangan: "Rumah Tepi Sawah diperbarui.", nada: "sukses" })}
      >
        Sukses
      </button>
      <button
        type="button"
        className="btn btn--secondary"
        onClick={() => toast({ judul: "Gagal mengunggah", keterangan: "Ukuran berkas melebihi 2 MB.", nada: "gagal" })}
      >
        Gagal
      </button>
      <button
        type="button"
        className="btn btn--secondary"
        onClick={() => toast({ judul: "Build sedang berjalan", nada: "netral" })}
      >
        Netral
      </button>
    </div>
  );
}

export function OverlayShowcase() {
  const [kategori, setKategori] = useState("residential");

  return (
    <ToastProvider>
      <TooltipProvider>
        <div className="spec-grid">
          <div className="spec-demo">
            <div className="spec-demo__name">
              <span className="t-subheading">Dialog</span>
              <code className="swatch__name">Dialog</code>
            </div>
            <div className="spec-demo__stage">
              <Dialog
                trigger={<button type="button" className="btn btn--secondary">Buka dialog</button>}
                title="Ganti cover proyek"
                description="Gambar ini tampil di grid portfolio dan sebagai pratinjau saat dibagikan."
                footer={
                  <>
                    <button type="button" className="btn btn--secondary">Batal</button>
                    <button type="button" className="btn btn--primary">Simpan</button>
                  </>
                }
              >
                <div className="field">
                  <label className="field__label" htmlFor="ov-alt">Teks alternatif</label>
                  <input id="ov-alt" className="input" placeholder="Teras timur pada pukul 16.00" />
                  <p className="field__help">Dibaca oleh pembaca layar dan mesin pencari.</p>
                </div>
              </Dialog>
            </div>
          </div>

          <div className="spec-demo">
            <div className="spec-demo__name">
              <span className="t-subheading">Alert Dialog</span>
              <code className="swatch__name">AlertDialog</code>
            </div>
            <div className="spec-demo__stage spec-demo__stage--stack">
              <AlertDialog
                trigger={<button type="button" className="btn btn--danger" style={{ alignSelf: "flex-start" }}>Hapus proyek</button>}
                title="Hapus Rumah Tepi Sawah?"
                description="Seluruh gambar proyek ini ikut terhapus dan tidak bisa dikembalikan."
                confirmLabel="Ya, hapus"
                destructive
              />
              <p className="field__help">
                Tidak bisa ditutup dengan mengklik latar — penghapusan tidak boleh terjadi karena salah klik.
              </p>
            </div>
          </div>

          <div className="spec-demo">
            <div className="spec-demo__name">
              <span className="t-subheading">Sheet &amp; Drawer</span>
              <code className="swatch__name">Sheet</code>
            </div>
            <div className="spec-demo__stage">
              <Sheet
                trigger={<button type="button" className="btn btn--secondary">Dari kanan</button>}
                title="Detail pesan"
                description="Budi Santoso · 23 Agu 2026"
                footer={<button type="button" className="btn btn--primary">Balas lewat email</button>}
              >
                <p className="t-body">Saya ingin konsultasi desain rumah tinggal dua lantai di Pontianak.</p>
              </Sheet>
              <Sheet
                side="bottom"
                trigger={<button type="button" className="btn btn--secondary">Dari bawah</button>}
                title="Saring proyek"
              >
                <p className="t-muted">Bentuk yang sama, hanya berbeda sisi.</p>
              </Sheet>
            </div>
          </div>

          <div className="spec-demo">
            <div className="spec-demo__name">
              <span className="t-subheading">Dropdown &amp; Context Menu</span>
              <code className="swatch__name">DropdownMenu</code>
            </div>
            <div className="spec-demo__stage spec-demo__stage--stack">
              <DropdownMenu
                sections={menuProyek}
                trigger={
                  <button type="button" className="btn btn--secondary" style={{ alignSelf: "flex-start" }}>
                    Aksi<Icon name="chevronDown" size={15} />
                  </button>
                }
              />
              <ContextMenu sections={menuProyek}>
                <div
                  className="item item--bordered"
                  style={{ justifyContent: "center", color: "var(--text-muted)" }}
                >
                  Klik kanan di area ini
                </div>
              </ContextMenu>
            </div>
          </div>

          <div className="spec-demo">
            <div className="spec-demo__name">
              <span className="t-subheading">Menubar</span>
              <code className="swatch__name">Menubar</code>
            </div>
            <div className="spec-demo__stage">
              <Menubar
                menus={[
                  { label: "Berkas", sections: [{ items: [{ label: "Proyek baru", icon: "plus", shortcut: "⌘N" }, { label: "Impor", icon: "upload" }] }] },
                  { label: "Tampilan", sections: [{ items: [{ label: "Daftar", icon: "dashboard" }, { label: "Petak", icon: "component" }] }] },
                ]}
              />
            </div>
          </div>

          <div className="spec-demo">
            <div className="spec-demo__name">
              <span className="t-subheading">Tooltip · Popover · Hover Card</span>
              <code className="swatch__name">Floating</code>
            </div>
            <div className="spec-demo__stage">
              <Tooltip label="Sempitkan sidebar">
                <button type="button" className="btn btn--secondary btn--icon" aria-label="Sempitkan sidebar">
                  <Icon name="chevronLeft" size={16} />
                </button>
              </Tooltip>

              <Popover
                title="Filter"
                trigger={<button type="button" className="btn btn--secondary"><Icon name="filter" size={15} />Popover</button>}
              >
                <label className="choice"><input type="checkbox" defaultChecked /><span className="choice__text"><span>Hanya terbit</span></span></label>
              </Popover>

              <HoverCard trigger={<a href="#galeri" className="t-body">Rumah Tepi Sawah</a>}>
                <span className="t-subheading">Rumah Tepi Sawah</span>
                <p className="t-muted" style={{ margin: "0.35rem 0 0" }}>Canggu, Badung · 2024 · 320 m²</p>
              </HoverCard>
            </div>
          </div>

          <div className="spec-demo">
            <div className="spec-demo__name">
              <span className="t-subheading">Select</span>
              <code className="swatch__name">Select</code>
            </div>
            <div className="spec-demo__stage spec-demo__stage--stack">
              <Select
                ariaLabel="Kategori proyek"
                value={kategori}
                onValueChange={setKategori}
                options={[
                  { value: "residential", label: "Hunian" },
                  { value: "commercial", label: "Komersial" },
                  { value: "interior", label: "Interior" },
                  { value: "renovation", label: "Renovasi" },
                ]}
              />
              <p className="field__help">
                Native Select tetap dipakai untuk pilihan sederhana — di ponsel ia memunculkan pemilih bawaan sistem.
              </p>
            </div>
          </div>

          <div className="spec-demo">
            <div className="spec-demo__name">
              <span className="t-subheading">Command &amp; Combobox</span>
              <code className="swatch__name">CommandPalette</code>
            </div>
            <div className="spec-demo__stage spec-demo__stage--stack">
              <CommandPalette
                trigger={
                  <button type="button" className="btn btn--secondary" style={{ alignSelf: "flex-start" }}>
                    <Icon name="search" size={15} />Cari<kbd className="ov-menu__shortcut">⌘K</kbd>
                  </button>
                }
                entries={[
                  { label: "Proyek baru", icon: "plus", group: "Tindakan" },
                  { label: "Unggah gambar", icon: "upload", group: "Tindakan" },
                  { label: "Rumah Tepi Sawah", icon: "project", group: "Proyek" },
                  { label: "Kantor Kayu Bandung", icon: "project", group: "Proyek" },
                ]}
              />
              <Combobox
                placeholder="Cari proyek…"
                entries={[
                  { label: "Rumah Tepi Sawah", icon: "project" },
                  { label: "Kantor Kayu Bandung", icon: "project" },
                  { label: "Renovasi Rumah Menteng", icon: "project" },
                ]}
              />
            </div>
          </div>

          <div className="spec-demo">
            <div className="spec-demo__name">
              <span className="t-subheading">Toast</span>
              <code className="swatch__name">useToast</code>
            </div>
            <TombolToast />
            <p className="field__help">
              Toast gagal bertahan lebih lama karena biasanya perlu ditindaklanjuti.
            </p>
          </div>
        </div>
      </TooltipProvider>
    </ToastProvider>
  );
}
