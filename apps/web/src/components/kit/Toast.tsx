import * as RToast from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Ikon } from "./Ikon";
import { CheckCircle, Info, WarningOctagon, X } from "./ikon";

/* =============================================================================
   Toast kit — kabar singkat sesudah sebuah perbuatan.

   API-nya SAMA dengan `ui/overlay/Toast` (ToastProvider, useToast,
   titipToast, TitipanToast) supaya halaman cukup mengganti baris impornya,
   dan kunci titipannya juga sama — titipan dari halaman yang belum pindah
   tetap dijemput di halaman yang sudah.

   Warnanya menurut aturan #1: hijau = konfirmasi, merah = gagal, netral =
   keterangan. Toast gagal tinggal lebih lama karena biasanya perlu
   ditindaklanjuti.
   ============================================================================= */

export type NadaToast = "netral" | "sukses" | "gagal";

interface Pesan {
  id: number;
  judul: string;
  keterangan?: string;
  nada: NadaToast;
}

const Ctx = createContext<(p: Omit<Pesan, "id">) => void>(() => {});

export function useToast() {
  return useContext(Ctx);
}

const IKON = { netral: Info, sukses: CheckCircle, gagal: WarningOctagon } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [daftar, setDaftar] = useState<Pesan[]>([]);
  const tampilkan = useCallback((p: Omit<Pesan, "id">) => {
    setDaftar((kini) => [...kini, { ...p, id: Date.now() + Math.random() }]);
  }, []);

  return (
    <Ctx.Provider value={tampilkan}>
      <RToast.Provider swipeDirection="right" duration={5000} label="Pemberitahuan">
        {children}
        {daftar.map((p) => (
          <RToast.Root
            key={p.id}
            className={`k-toast k-toast--${p.nada}`}
            duration={p.nada === "gagal" ? 8000 : 5000}
            onOpenChange={(buka) => {
              if (!buka) setDaftar((kini) => kini.filter((x) => x.id !== p.id));
            }}
          >
            <span className="k-toast__ikon" aria-hidden="true">
              <Ikon ikon={IKON[p.nada]} ukuran={18} />
            </span>
            <div className="k-toast__teks">
              <RToast.Title className="k-toast__judul">{p.judul}</RToast.Title>
              {p.keterangan && <RToast.Description className="k-toast__ket">{p.keterangan}</RToast.Description>}
            </div>
            <RToast.Close asChild>
              <button type="button" className="k-ov__tutup k-toast__tutup" aria-label="Tutup pemberitahuan">
                <Ikon ikon={X} ukuran={14} />
              </button>
            </RToast.Close>
          </RToast.Root>
        ))}
        <RToast.Viewport className="k-toast-wilayah" />
      </RToast.Provider>
    </Ctx.Provider>
  );
}

/* --- Titipan: toast yang harus selamat melewati pindah halaman ------------
   Lihat catatan panjangnya di ui/overlay/Toast (jebakan #40). Kuncinya sama
   dengan versi lama dengan sengaja. */
const KUNCI_TITIPAN = "ov-toast-titipan";

export function titipToast(p: Omit<Pesan, "id">) {
  try {
    sessionStorage.setItem(KUNCI_TITIPAN, JSON.stringify({ ...p, pada: Date.now() }));
  } catch {
    /* Penyimpanan diblokir: konfirmasinya hilang, perbuatannya tetap jadi. */
  }
}

function JemputTitipan() {
  const toast = useToast();
  useEffect(() => {
    let isi: string | null = null;
    try {
      isi = sessionStorage.getItem(KUNCI_TITIPAN);
      sessionStorage.removeItem(KUNCI_TITIPAN);
    } catch {
      return;
    }
    if (!isi) return;
    try {
      const p = JSON.parse(isi) as Omit<Pesan, "id"> & { pada: number };
      if (Date.now() - p.pada < 15_000) toast({ judul: p.judul, keterangan: p.keterangan, nada: p.nada });
    } catch {
      /* Isinya rusak — abaikan. */
    }
  }, [toast]);
  return null;
}

export function TitipanToast() {
  const [siap, setSiap] = useState(false);
  useEffect(() => setSiap(true), []);
  if (!siap) return null;
  return createPortal(
    <ToastProvider>
      <JemputTitipan />
    </ToastProvider>,
    document.body,
  );
}
