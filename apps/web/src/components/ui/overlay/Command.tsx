import { Command as Cmdk } from "cmdk";
import * as RDialog from "@radix-ui/react-dialog";
import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "../Icon";

export interface CommandEntry {
  label: string;
  icon?: IconName;
  group?: string;
  onSelect?: () => void;
}

/**
 * Command palette.
 *
 * Combobox adalah komponen yang sama dalam wujud inline — keduanya menyaring
 * daftar dari ketikan dan dijelajahi dengan panah — jadi keduanya dibangun di
 * atas primitif yang sama alih-alih ditulis dua kali.
 */
export function CommandPalette({ entries, trigger }: { entries: CommandEntry[]; trigger: ReactNode }) {
  const [buka, setBuka] = useState(false);

  // Ctrl/Cmd+K membuka dari mana saja — pintasan yang sudah jadi kebiasaan
  // umum, jadi tidak perlu diajarkan.
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

  const grup = [...new Set(entries.map((e) => e.group ?? "Umum"))];

  return (
    <>
      <RDialog.Root open={buka} onOpenChange={setBuka}>
        <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>
        <RDialog.Portal>
          <RDialog.Overlay className="ov-scrim" />
          <RDialog.Content className="ov-dialog ov-panel" aria-label="Cari perintah">
            <RDialog.Title className="sr-only">Cari perintah</RDialog.Title>
            <Cmdk className="ov-command" loop>
              <div className="ov-command__search">
                <Icon name="search" size={18} />
                <Cmdk.Input className="ov-command__input" placeholder="Cari proyek atau perintah…" autoFocus />
                <kbd className="ov-menu__shortcut">ESC</kbd>
              </div>

              <Cmdk.List className="ov-command__list">
                <Cmdk.Empty className="ov-command__empty">Tidak ada yang cocok.</Cmdk.Empty>
                {grup.map((g) => (
                  <Cmdk.Group key={g} heading={g} className="ov-command__group">
                    {entries
                      .filter((e) => (e.group ?? "Umum") === g)
                      .map((e) => (
                        <Cmdk.Item
                          key={e.label}
                          className="ov-command__item"
                          onSelect={() => {
                            e.onSelect?.();
                            setBuka(false);
                          }}
                        >
                          {e.icon && <Icon name={e.icon} size={16} />}
                          {e.label}
                        </Cmdk.Item>
                      ))}
                  </Cmdk.Group>
                ))}
              </Cmdk.List>
            </Cmdk>
          </RDialog.Content>
        </RDialog.Portal>
      </RDialog.Root>
    </>
  );
}

/** Combobox: daftar yang sama, tapi menempel di bawah field alih-alih menutupi layar. */
export function Combobox({ entries, placeholder = "Cari…" }: { entries: CommandEntry[]; placeholder?: string }) {
  const [nilai, setNilai] = useState("");
  const [fokus, setFokus] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <Cmdk className="ov-panel" style={{ overflow: "hidden" }} loop>
        <div className="ov-command__search" style={{ padding: "var(--space-3) var(--space-4)" }}>
          <Icon name="search" size={16} />
          <Cmdk.Input
            className="ov-command__input"
            placeholder={placeholder}
            value={nilai}
            onValueChange={setNilai}
            onFocus={() => setFokus(true)}
            onBlur={() => setFokus(false)}
          />
        </div>
        {(fokus || nilai) && (
          <Cmdk.List className="ov-command__list" style={{ maxHeight: "12rem" }}>
            <Cmdk.Empty className="ov-command__empty">Tidak ada yang cocok.</Cmdk.Empty>
            {entries.map((e) => (
              <Cmdk.Item key={e.label} className="ov-command__item" onSelect={() => setNilai(e.label)}>
                {e.icon && <Icon name={e.icon} size={16} />}
                {e.label}
              </Cmdk.Item>
            ))}
          </Cmdk.List>
        )}
      </Cmdk>
    </div>
  );
}
