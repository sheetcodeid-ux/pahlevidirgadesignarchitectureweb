import { useState } from "react";
import * as RPopover from "@radix-ui/react-popover";
import { Icon } from "../Icon";
import { Calendar } from "./Calendar";

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** Date Picker = Calendar di dalam Popover. Bukan komponen baru, hanya susunan. */
export function DatePicker({ label, minDate }: { label: string; minDate?: Date }) {
  const [nilai, setNilai] = useState<Date | undefined>();
  const [buka, setBuka] = useState(false);

  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <RPopover.Root open={buka} onOpenChange={setBuka}>
        <RPopover.Trigger asChild>
          <button type="button" className="ov-select-trigger" data-placeholder={!nilai || undefined}>
            <span className="row" style={{ gap: "var(--space-3)" }}>
              <Icon name="calendar" size={16} />
              {nilai ? `${nilai.getDate()} ${BULAN[nilai.getMonth()]} ${nilai.getFullYear()}` : "Pilih tanggal"}
            </span>
            <span className="ov-select-trigger__icon"><Icon name="chevronDown" size={16} /></span>
          </button>
        </RPopover.Trigger>
        <RPopover.Portal>
          <RPopover.Content sideOffset={8} collisionPadding={12} style={{ zIndex: 85 }}>
            <Calendar
              value={nilai}
              minDate={minDate}
              onChange={(d) => { setNilai(d); setBuka(false); }}
            />
          </RPopover.Content>
        </RPopover.Portal>
      </RPopover.Root>
    </div>
  );
}
