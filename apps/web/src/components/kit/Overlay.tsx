import * as RDialog from "@radix-ui/react-dialog";
import * as RAlert from "@radix-ui/react-alert-dialog";
import * as RPopover from "@radix-ui/react-popover";
import * as RHover from "@radix-ui/react-hover-card";
import * as RTooltip from "@radix-ui/react-tooltip";
import * as RDropdown from "@radix-ui/react-dropdown-menu";
import * as RContext from "@radix-ui/react-context-menu";
import * as RMenubar from "@radix-ui/react-menubar";
import * as RNav from "@radix-ui/react-navigation-menu";
import type { ReactNode } from "react";
import { Ikon, type DataIkon } from "./Ikon";
import { CaretDown, SpecialWarning, X } from "./ikon";

/* =============================================================================
   Overlay kit — semua yang melayang di atas halaman.

   Perilakunya (perangkap fokus, Esc, kembali-fokus ke pemicu, penempatan,
   penguncian gulir) milik Radix; seluruh tampilannya ditulis di sini dengan
   bahasa kit. Menggantikan `ui/overlay/*` di halaman kit: komponen lama itu
   memakai kelas `.btn` panel lama, dan stylesheet-nya tidak dimuat KitLayout —
   tombol "Batal" dan "Ya, hapus" di dialog konfirmasi hapus tergambar sebagai
   tombol abu bawaan peramban (jebakan #5, ketahuan saat pustaka ini dibuat).

   API-nya sengaja SAMA dengan versi lama (title/description/footer/trigger,
   MenuSection) supaya pindahnya cuma mengganti baris impor.
   ============================================================================= */

function TombolTutup() {
  return (
    <button type="button" className="k-ov__tutup" aria-label="Tutup">
      <Ikon ikon={X} ukuran={16} />
    </button>
  );
}

/* --- Dialog ----------------------------------------------------------------- */

export interface PropDialog {
  /** Opsional — dialog yang dibuka dari hasil langkah sebelumnya tidak punya pemicu. */
  trigger?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Lebar panel. `lebar` untuk formulir dua kolom. */
  ukuran?: "sedang" | "lebar";
}

export function Dialog({ trigger, title, description, children, footer, open, onOpenChange, ukuran = "sedang" }: PropDialog) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>}
      <RDialog.Portal>
        <RDialog.Overlay className="k-ov__scrim" />
        <RDialog.Content className={`k-ov k-dialog k-dialog--${ukuran}`}>
          <div className="k-dialog__kepala">
            <div className="k-dialog__judul">
              <RDialog.Title className="k-dialog__title">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="k-dialog__desc">{description}</RDialog.Description>
              ) : (
                /* Tanpa ini Radix memperingatkan di konsol tiap kali dibuka. */
                <RDialog.Description className="sr-only">{title}</RDialog.Description>
              )}
            </div>
            <RDialog.Close asChild>
              <TombolTutup />
            </RDialog.Close>
          </div>
          {children && <div className="k-dialog__badan">{children}</div>}
          {footer && <div className="k-dialog__kaki">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/* --- Konfirmasi (Alert Dialog) ---------------------------------------------
   Tidak bisa ditutup dengan klik latar: penghapusan tidak boleh terjadi —
   atau batal — karena salah klik. Tombol aksinya MERAH kalau destruktif
   (aturan warna #1), dan fokus awalnya di "Batal", bukan di aksinya. */

export interface PropKonfirmasi {
  trigger?: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AlertDialog({
  trigger,
  title,
  description,
  confirmLabel = "Lanjutkan",
  cancelLabel = "Batal",
  destructive = false,
  onConfirm,
  open,
  onOpenChange,
}: PropKonfirmasi) {
  return (
    <RAlert.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RAlert.Trigger asChild>{trigger}</RAlert.Trigger>}
      <RAlert.Portal>
        <RAlert.Overlay className="k-ov__scrim" />
        <RAlert.Content className="k-ov k-dialog k-dialog--kecil">
          <div className="k-dialog__kepala">
            {destructive && (
              <span className="k-konfirmasi__ubin" aria-hidden="true">
                <Ikon ikon={SpecialWarning} ukuran={18} />
              </span>
            )}
            <div className="k-dialog__judul">
              <RAlert.Title className="k-dialog__title">{title}</RAlert.Title>
              <RAlert.Description className="k-dialog__desc">{description}</RAlert.Description>
            </div>
          </div>
          <div className="k-dialog__kaki">
            <RAlert.Cancel asChild>
              <button type="button" className="k-tombol k-tombol--medium k-tombol--ghost">
                {cancelLabel}
              </button>
            </RAlert.Cancel>
            <RAlert.Action asChild>
              <button
                type="button"
                className={`k-tombol k-tombol--medium ${destructive ? "k-tombol--bahaya" : "k-tombol--primary"}`}
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
            </RAlert.Action>
          </div>
        </RAlert.Content>
      </RAlert.Portal>
    </RAlert.Root>
  );
}
export { AlertDialog as Konfirmasi };

/* --- Laci (Sheet / Drawer) --------------------------------------------------
   Satu komponen, sisinya yang membedakan. Kanan = panel rincian di desktop;
   bawah = laci di ponsel (dengan pegangan, karena orang memang menariknya). */

export interface PropLaci extends Omit<PropDialog, "ukuran"> {
  side?: "right" | "left" | "bottom";
}

export function Sheet({ trigger, title, description, side = "right", children, footer, open, onOpenChange }: PropLaci) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>}
      <RDialog.Portal>
        <RDialog.Overlay className="k-ov__scrim" />
        <RDialog.Content className="k-laci" data-sisi={side}>
          {side === "bottom" && <span className="k-laci__pegangan" aria-hidden="true" />}
          <div className="k-dialog__kepala">
            <div className="k-dialog__judul">
              <RDialog.Title className="k-dialog__title">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="k-dialog__desc">{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{title}</RDialog.Description>
              )}
            </div>
            <RDialog.Close asChild>
              <TombolTutup />
            </RDialog.Close>
          </div>
          {children && <div className="k-dialog__badan k-laci__badan">{children}</div>}
          {footer && <div className="k-dialog__kaki">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
export { Sheet as Laci };

/* --- Sembul (Popover) ------------------------------------------------------ */

export function Sembul({
  pemicu,
  children,
  judul,
  align = "start",
  open,
  onOpenChange,
  className,
}: {
  pemicu: ReactNode;
  children: ReactNode;
  /** Judul kecil di kepala panel. Opsional. */
  judul?: string;
  align?: "start" | "center" | "end";
  open?: boolean;
  onOpenChange?: (b: boolean) => void;
  className?: string;
}) {
  return (
    <RPopover.Root open={open} onOpenChange={onOpenChange}>
      <RPopover.Trigger asChild>{pemicu}</RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content className={["k-ov k-sembul", className].filter(Boolean).join(" ")} align={align} sideOffset={8} collisionPadding={12}>
          {judul && <p className="k-sembul__judul">{judul}</p>}
          {children}
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}

/* --- Kartu Melayang (Hover Card) --------------------------------------------
   Pratinjau yang muncul saat kursor DIAM di atas tautan. Bukan satu-satunya
   jalan ke isinya: di layar sentuh ia tidak pernah muncul, jadi tautannya
   sendiri tetap harus menuju halaman yang memuat hal yang sama. */

export function KartuMelayang({ pemicu, children }: { pemicu: ReactNode; children: ReactNode }) {
  return (
    <RHover.Root openDelay={350} closeDelay={120}>
      <RHover.Trigger asChild>{pemicu}</RHover.Trigger>
      <RHover.Portal>
        <RHover.Content className="k-ov k-melayang" sideOffset={8} collisionPadding={12}>
          {children}
        </RHover.Content>
      </RHover.Portal>
    </RHover.Root>
  );
}

/* --- Petunjuk (Tooltip) -----------------------------------------------------
   Untuk tombol ikon: nama yang tidak tertulis. Penyedia dipasang sendiri di
   tiap petunjuk supaya pemakai tidak perlu membungkus halamannya — Radix
   membolehkan penyedia bersarang, dan jedanya disetel sama di semuanya. */

export function Petunjuk({
  isi,
  children,
  sisi = "top",
}: {
  isi: ReactNode;
  children: ReactNode;
  sisi?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <RTooltip.Provider delayDuration={300} skipDelayDuration={200}>
      <RTooltip.Root>
        <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
        <RTooltip.Portal>
          <RTooltip.Content className="k-petunjuk" side={sisi} sideOffset={6} collisionPadding={8}>
            {isi}
          </RTooltip.Content>
        </RTooltip.Portal>
      </RTooltip.Root>
    </RTooltip.Provider>
  );
}

/* --- Menu: Dropdown, Konteks, Bilah ----------------------------------------
   Ketiganya memakai model butir yang sama, jadi menu yang dirancang untuk
   satu tempat bisa dipindah ke tempat lain tanpa ditulis ulang. */

export interface MenuEntry {
  label: string;
  ikon?: DataIkon;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

export interface MenuSection {
  label?: string;
  items: MenuEntry[];
}

type Bagian = {
  Item: typeof RDropdown.Item;
  Label: typeof RDropdown.Label;
  Separator: typeof RDropdown.Separator;
};

function isiMenu(sections: MenuSection[], { Item, Label, Separator }: Bagian) {
  return sections.map((sec, i) => (
    <div key={i} role="none">
      {i > 0 && <Separator className="k-menu__pisah" />}
      {sec.label && <Label className="k-menu__label">{sec.label}</Label>}
      {sec.items.map((it) => (
        <Item
          key={it.label}
          className={it.danger ? "k-menu__butir k-menu__butir--bahaya" : "k-menu__butir"}
          disabled={it.disabled}
          onSelect={it.onSelect}
        >
          {it.ikon && <Ikon ikon={it.ikon} ukuran={16} />}
          <span>{it.label}</span>
          {it.shortcut && <kbd className="k-tuts k-menu__tuts">{it.shortcut}</kbd>}
        </Item>
      ))}
    </div>
  ));
}

export function DropdownMenu({
  trigger,
  sections,
  align = "end",
}: {
  trigger: ReactNode;
  sections: MenuSection[];
  align?: "start" | "center" | "end";
}) {
  return (
    <RDropdown.Root>
      <RDropdown.Trigger asChild>{trigger}</RDropdown.Trigger>
      <RDropdown.Portal>
        <RDropdown.Content className="k-ov k-menu" sideOffset={6} align={align} collisionPadding={12}>
          {isiMenu(sections, RDropdown)}
        </RDropdown.Content>
      </RDropdown.Portal>
    </RDropdown.Root>
  );
}
export { DropdownMenu as MenuTarik };

/** Menu klik-kanan (dan tekan-lama di layar sentuh). Area pemicunya `children`. */
export function ContextMenu({ children, sections }: { children: ReactNode; sections: MenuSection[] }) {
  return (
    <RContext.Root>
      <RContext.Trigger asChild>{children}</RContext.Trigger>
      <RContext.Portal>
        <RContext.Content className="k-ov k-menu" collisionPadding={12}>
          {isiMenu(sections, RContext as unknown as Bagian)}
        </RContext.Content>
      </RContext.Portal>
    </RContext.Root>
  );
}
export { ContextMenu as MenuKonteks };

export function Menubar({ menus, label = "Menu" }: { menus: { label: string; sections: MenuSection[] }[]; label?: string }) {
  return (
    <RMenubar.Root className="k-bilahmenu" aria-label={label}>
      {menus.map((m) => (
        <RMenubar.Menu key={m.label}>
          <RMenubar.Trigger className="k-bilahmenu__pemicu">{m.label}</RMenubar.Trigger>
          <RMenubar.Portal>
            <RMenubar.Content className="k-ov k-menu" sideOffset={6} align="start" collisionPadding={12}>
              {isiMenu(m.sections, RMenubar as unknown as Bagian)}
            </RMenubar.Content>
          </RMenubar.Portal>
        </RMenubar.Menu>
      ))}
    </RMenubar.Root>
  );
}
export { Menubar as BilahMenu };

/* --- Menu Navigasi (Navigation Menu) ----------------------------------------
   Bilah tautan dengan panel turun berisi tautan-tautan anak — untuk situs
   publik atau bagian dengan banyak halaman sejajar. Panelnya tautan biasa,
   jadi tetap bekerja dengan router sisi klien dan dengan pembaca layar. */

export interface ButirNavigasi {
  label: string;
  href?: string;
  anak?: { label: string; href: string; ket?: string }[];
}

export function MenuNavigasi({ butir, label = "Navigasi" }: { butir: ButirNavigasi[]; label?: string }) {
  return (
    <RNav.Root className="k-navmenu" aria-label={label}>
      <RNav.List className="k-navmenu__daftar">
        {butir.map((b) =>
          b.anak ? (
            <RNav.Item key={b.label}>
              <RNav.Trigger className="k-navmenu__pemicu">
                {b.label}
                <Ikon ikon={CaretDown} ukuran={12} className="k-navmenu__caret" />
              </RNav.Trigger>
              <RNav.Content className="k-navmenu__isi">
                <ul className="k-navmenu__anak">
                  {b.anak.map((a) => (
                    <li key={a.href}>
                      <RNav.Link asChild>
                        <a className="k-navmenu__tautan" href={a.href}>
                          <b>{a.label}</b>
                          {a.ket && <span>{a.ket}</span>}
                        </a>
                      </RNav.Link>
                    </li>
                  ))}
                </ul>
              </RNav.Content>
            </RNav.Item>
          ) : (
            <RNav.Item key={b.label}>
              <RNav.Link asChild>
                <a className="k-navmenu__pemicu" href={b.href}>
                  {b.label}
                </a>
              </RNav.Link>
            </RNav.Item>
          ),
        )}
      </RNav.List>
      <div className="k-navmenu__wadah">
        <RNav.Viewport className="k-ov k-navmenu__viewport" />
      </div>
    </RNav.Root>
  );
}
