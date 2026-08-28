import * as RSelect from "@radix-ui/react-select";
import { Icon } from "../Icon";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  options: SelectOption[];
  value?: string;
  placeholder?: string;
  onValueChange?: (v: string) => void;
  ariaLabel: string;
  /** Dipakai kalau ada <label htmlFor> yang menunjuk ke sini. */
  id?: string;
  /** Versi sempit selebar isinya, untuk dipasang di dalam baris daftar. */
  ringkas?: boolean;
  disabled?: boolean;
}

/**
 * Select kustom.
 *
 * Native Select tetap ada dan tetap dipakai untuk pilihan sederhana — ia lebih
 * baik di ponsel karena memunculkan pemilih bawaan sistem. Versi ini dipakai
 * saat daftarnya perlu tampil seragam di semua platform atau butuh isi yang
 * lebih dari sekadar teks.
 */
export function Select({
  options, value, placeholder = "Pilih…", onValueChange, ariaLabel, id, ringkas = false, disabled = false,
}: Props) {
  return (
    <RSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RSelect.Trigger
        id={id}
        className={`ov-select-trigger${ringkas ? " ov-select-trigger--ringkas" : ""}`}
        aria-label={ariaLabel}
      >
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon className="ov-select-trigger__icon">
          <Icon name="chevronDown" size={16} />
        </RSelect.Icon>
      </RSelect.Trigger>

      <RSelect.Portal>
        <RSelect.Content className="ov-select-content ov-panel" position="popper" sideOffset={6}>
          <RSelect.Viewport>
            {options.map((o) => (
              <RSelect.Item key={o.value} value={o.value} className="ov-select-item">
                <RSelect.ItemIndicator className="ov-menu__check">
                  <Icon name="check" size={14} />
                </RSelect.ItemIndicator>
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
