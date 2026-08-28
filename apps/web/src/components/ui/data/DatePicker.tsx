import { useState } from "react";
import * as RPopover from "@radix-ui/react-popover";
import { Icon } from "../Icon";
import { Calendar } from "./Calendar";

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/**
 * ISO yyyy-mm-dd -> Date lokal.
 *
 * `new Date("2026-09-01")` diurai sebagai TENGAH MALAM UTC, jadi di zona
 * dengan offset negatif tanggalnya mundur satu hari. Tiga zona Indonesia
 * kebetulan positif, tapi kode yang benar karena kebetulan tetap salah —
 * jadi bagiannya dipisah sendiri dan disusun sebagai tanggal lokal.
 */
function dariIso(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined;
  const [y, b, t] = iso.split("-").map(Number);
  if (!y || !b || !t) return undefined;
  return new Date(y, b - 1, t);
}

/** Date lokal -> ISO yyyy-mm-dd, tanpa lewat UTC karena alasan yang sama. */
function keIso(d: Date | undefined): string | null {
  if (!d) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

interface Props {
  label: string;
  minDate?: Date;
  /** ISO yyyy-mm-dd. Kalau diberikan, komponen jadi terkendali. */
  value?: string | null;
  onChange?: (iso: string | null) => void;
  id?: string;
}

/**
 * Date Picker = Calendar di dalam Popover. Bukan komponen baru, hanya susunan.
 *
 * Dipakai menggantikan <input type="date"> di form: kolom tanggal bawaan
 * digambar sistem operasi dan mengikuti locale BROWSER, jadi staf Indonesia
 * bisa melihat 09/01/2026 untuk 1 September — urutan yang terbaca terbalik.
 * Di sini bulannya ditulis dengan nama, jadi tidak ada yang bisa salah baca.
 */
export function DatePicker({ label, minDate, value, onChange, id }: Props) {
  const terkendali = value !== undefined;
  const [lokal, setLokal] = useState<Date | undefined>();
  const [buka, setBuka] = useState(false);
  const nilai = terkendali ? dariIso(value) : lokal;

  function pilih(d: Date | undefined) {
    if (!terkendali) setLokal(d);
    onChange?.(keIso(d));
    setBuka(false);
  }

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}</label>
      <RPopover.Root open={buka} onOpenChange={setBuka}>
        <RPopover.Trigger asChild>
          <button type="button" id={id} className="ov-select-trigger" data-placeholder={!nilai || undefined}>
            <span className="row" style={{ gap: "var(--space-3)" }}>
              <Icon name="calendar" size={16} />
              {nilai ? `${nilai.getDate()} ${BULAN[nilai.getMonth()]} ${nilai.getFullYear()}` : "Pilih tanggal"}
            </span>
            <span className="ov-select-trigger__icon"><Icon name="chevronDown" size={16} /></span>
          </button>
        </RPopover.Trigger>
        <RPopover.Portal>
          <RPopover.Content sideOffset={8} collisionPadding={12} style={{ zIndex: 85 }}>
            <Calendar value={nilai} minDate={minDate} onChange={pilih} />
          </RPopover.Content>
        </RPopover.Portal>
      </RPopover.Root>
    </div>
  );
}
