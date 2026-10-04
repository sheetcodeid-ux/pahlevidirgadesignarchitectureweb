import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AlertDialog } from "../components/kit/Overlay";

/* =============================================================================
   Pengganti `window.confirm()` — dialog kit, bukan kotak bawaan peramban.

   `confirm()` menggambar kotak abu ber-huruf sistem dengan judul alamat
   situs; pemilik menolak semua tampilan bawaan seperti itu. Fungsi ini
   mengembalikan janji, jadi pemanggil cukup mengganti
   `if (!confirm(x)) return` dengan `if (!(await tanya({...}))) return`.

   Dialognya dipasang di akar React sendiri di <body> dan dibongkar begitu
   dijawab — tidak perlu menaruh komponen apa pun di halaman pemanggil.
   ============================================================================= */

export interface Pertanyaan {
  judul: string;
  isi: string;
  ya?: string;
  tidak?: string;
  bahaya?: boolean;
}

export function tanya(p: Pertanyaan): Promise<boolean> {
  return new Promise((selesai) => {
    const wadah = document.createElement("div");
    document.body.appendChild(wadah);
    const akar = createRoot(wadah);
    let jawab = false;
    function Dialog() {
      const [buka, setBuka] = useState(true);
      return (
        <AlertDialog
          open={buka}
          onOpenChange={(b) => {
            if (b) return;
            setBuka(false);
            // Tunggu animasi tutupnya selesai sebelum membongkar akarnya.
            window.setTimeout(() => {
              akar.unmount();
              wadah.remove();
              selesai(jawab);
            }, 160);
          }}
          title={p.judul}
          description={p.isi}
          confirmLabel={p.ya ?? "Lanjutkan"}
          cancelLabel={p.tidak ?? "Batal"}
          destructive={p.bahaya}
          onConfirm={() => {
            jawab = true;
          }}
        />
      );
    }
    akar.render(<Dialog />);
  });
}
