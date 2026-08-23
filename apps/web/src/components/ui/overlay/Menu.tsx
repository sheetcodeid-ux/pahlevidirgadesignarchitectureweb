import * as RDropdown from "@radix-ui/react-dropdown-menu";
import * as RContext from "@radix-ui/react-context-menu";
import * as RMenubar from "@radix-ui/react-menubar";
import type { ReactNode } from "react";
import { Icon, type IconName } from "../Icon";

/**
 * Keluarga menu: Dropdown, Context, dan Menubar.
 *
 * Ketiganya memakai model item yang sama, jadi menu yang sudah dirancang untuk
 * satu konteks bisa dipindahkan ke konteks lain tanpa ditulis ulang.
 */

export interface MenuEntry {
  label: string;
  icon?: IconName;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

export interface MenuSection {
  label?: string;
  items: MenuEntry[];
}

function isiMenu(sections: MenuSection[], Item: typeof RDropdown.Item, Label: typeof RDropdown.Label, Sep: typeof RDropdown.Separator) {
  return sections.map((sec, i) => (
    <div key={i} role="none">
      {i > 0 && <Sep className="ov-menu__sep" />}
      {sec.label && <Label className="ov-menu__label">{sec.label}</Label>}
      {sec.items.map((it) => (
        <Item
          key={it.label}
          className={`ov-menu__item${it.danger ? " ov-menu__item--danger" : ""}`}
          disabled={it.disabled}
          onSelect={it.onSelect}
        >
          {it.icon && <Icon name={it.icon} size={16} />}
          <span>{it.label}</span>
          {it.shortcut && <kbd className="ov-menu__shortcut">{it.shortcut}</kbd>}
        </Item>
      ))}
    </div>
  ));
}

export function DropdownMenu({ trigger, sections }: { trigger: ReactNode; sections: MenuSection[] }) {
  return (
    <RDropdown.Root>
      <RDropdown.Trigger asChild>{trigger}</RDropdown.Trigger>
      <RDropdown.Portal>
        <RDropdown.Content className="ov-menu ov-panel" sideOffset={6} align="end">
          {isiMenu(sections, RDropdown.Item, RDropdown.Label, RDropdown.Separator)}
        </RDropdown.Content>
      </RDropdown.Portal>
    </RDropdown.Root>
  );
}

/** Menu klik-kanan. Area pemicunya adalah children. */
export function ContextMenu({ children, sections }: { children: ReactNode; sections: MenuSection[] }) {
  return (
    <RContext.Root>
      <RContext.Trigger asChild>{children}</RContext.Trigger>
      <RContext.Portal>
        <RContext.Content className="ov-menu ov-panel">
          {isiMenu(sections, RContext.Item, RContext.Label, RContext.Separator)}
        </RContext.Content>
      </RContext.Portal>
    </RContext.Root>
  );
}

export function Menubar({ menus }: { menus: { label: string; sections: MenuSection[] }[] }) {
  return (
    <RMenubar.Root className="ov-menubar">
      {menus.map((m) => (
        <RMenubar.Menu key={m.label}>
          <RMenubar.Trigger className="ov-menubar__trigger">{m.label}</RMenubar.Trigger>
          <RMenubar.Portal>
            <RMenubar.Content className="ov-menu ov-panel" sideOffset={6} align="start">
              {isiMenu(m.sections, RMenubar.Item, RMenubar.Label, RMenubar.Separator)}
            </RMenubar.Content>
          </RMenubar.Portal>
        </RMenubar.Menu>
      ))}
    </RMenubar.Root>
  );
}
