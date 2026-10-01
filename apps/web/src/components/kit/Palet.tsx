import * as RDialog from "@radix-ui/react-dialog";
import { Command as Cmdk } from "cmdk";
import type { ReactNode } from "react";
import { Ikon, type DataIkon } from "./Ikon";
import { MagnifyingGlass } from "./ikon";
import { Tuts } from "./Tampilan";

/* =============================================================================
   Palet (Command) — daftar perintah yang bisa dicari.

   Dua bentuk dari isi yang sama: `DaftarPerintah` (di dalam halaman, mis.
   galeri) dan `Palet` (dialog Ctrl/Cmd+K). Pencocokannya milik cmdk:
   potongan kata di mana pun, bukan awalan saja — "bayar" menemukan
   "Terima Pembayaran".
   ============================================================================= */

export interface ButirPerintah {
  label: string;
  ikon?: DataIkon;
  /** Teks tambahan yang ikut dicari tapi tidak ditampilkan. */
  kata?: string;
  ket?: string;
  tuts?: string;
  onPilih: () => void;
}
export interface KelompokPerintah {
  judul: string;
  butir: ButirPerintah[];
}

function Isi({ kelompok, placeholder, kosong }: { kelompok: KelompokPerintah[]; placeholder: string; kosong: ReactNode }) {
  return (
    <Cmdk className="k-palet" loop>
      <div className="k-palet__cari">
        <Ikon ikon={MagnifyingGlass} ukuran={16} />
        <Cmdk.Input className="k-palet__input" placeholder={placeholder} autoFocus />
        <Tuts>Esc</Tuts>
      </div>
      <Cmdk.List className="k-palet__daftar">
        <Cmdk.Empty className="k-palet__kosong">{kosong}</Cmdk.Empty>
        {kelompok
          .filter((k) => k.butir.length > 0)
          .map((k) => (
            <Cmdk.Group key={k.judul} heading={k.judul} className="k-palet__kelompok">
              {k.butir.map((b) => (
                <Cmdk.Item key={`${k.judul}-${b.label}`} value={`${b.label} ${b.kata ?? ""}`} className="k-menu__butir k-palet__butir" onSelect={b.onPilih}>
                  {b.ikon && <Ikon ikon={b.ikon} ukuran={16} />}
                  <span className="k-palet__label">{b.label}</span>
                  {b.ket && <span className="k-palet__ket">{b.ket}</span>}
                  {b.tuts && <Tuts>{b.tuts}</Tuts>}
                </Cmdk.Item>
              ))}
            </Cmdk.Group>
          ))}
      </Cmdk.List>
      <div className="k-palet__kaki" aria-hidden="true">
        <span><Tuts>↑</Tuts><Tuts>↓</Tuts> pilih</span>
        <span><Tuts>Enter</Tuts> buka</span>
      </div>
    </Cmdk>
  );
}

export function DaftarPerintah({
  kelompok,
  placeholder = "Ketik perintah atau cari…",
  kosong = "Tidak ada yang cocok.",
}: {
  kelompok: KelompokPerintah[];
  placeholder?: string;
  kosong?: ReactNode;
}) {
  return (
    <div className="k-palet-wadah">
      <Isi kelompok={kelompok} placeholder={placeholder} kosong={kosong} />
    </div>
  );
}

export function Palet({
  buka,
  onBuka,
  kelompok,
  placeholder = "Cari halaman atau proyek…",
  kosong = "Tidak ada yang cocok.",
}: {
  buka: boolean;
  onBuka: (b: boolean) => void;
  kelompok: KelompokPerintah[];
  placeholder?: string;
  kosong?: ReactNode;
}) {
  return (
    <RDialog.Root open={buka} onOpenChange={onBuka}>
      <RDialog.Portal>
        <RDialog.Overlay className="k-ov__scrim" />
        <RDialog.Content className="k-ov k-dialog k-dialog--palet" aria-label="Perintah cepat">
          <RDialog.Title className="sr-only">Perintah cepat</RDialog.Title>
          <RDialog.Description className="sr-only">Cari halaman atau proyek, lalu tekan Enter untuk membukanya.</RDialog.Description>
          <Isi kelompok={kelompok} placeholder={placeholder} kosong={kosong} />
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
