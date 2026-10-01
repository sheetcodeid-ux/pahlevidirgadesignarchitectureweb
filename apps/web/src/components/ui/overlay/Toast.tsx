import * as RToast from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Icon } from "../Icon";

type Nada = "netral" | "sukses" | "gagal";

interface Pesan {
  id: number;
  judul: string;
  keterangan?: string;
  nada: Nada;
}

const Ctx = createContext<(p: Omit<Pesan, "id">) => void>(() => {});

/** Dipakai komponen mana pun di bawah ToastProvider untuk memunculkan toast. */
export function useToast() {
  return useContext(Ctx);
}

const IKON = { netral: "info", sukses: "check", gagal: "alert" } as const;
const KELAS: Record<Nada, string> = { netral: "", sukses: " ov-toast--success", gagal: " ov-toast--danger" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [daftar, setDaftar] = useState<Pesan[]>([]);

  const tampilkan = useCallback((p: Omit<Pesan, "id">) => {
    setDaftar((cur) => [...cur, { ...p, id: Date.now() + Math.random() }]);
  }, []);

  return (
    <Ctx.Provider value={tampilkan}>
      {/* Durasi cukup panjang untuk dibaca tanpa terburu-buru; toast gagal
          sengaja lebih lama karena biasanya perlu ditindaklanjuti. */}
      <RToast.Provider swipeDirection="right" duration={5000}>
        {children}

        {daftar.map((p) => (
          <RToast.Root
            key={p.id}
            className={`ov-toast${KELAS[p.nada]}`}
            duration={p.nada === "gagal" ? 8000 : 5000}
            onOpenChange={(buka) => {
              if (!buka) setDaftar((cur) => cur.filter((x) => x.id !== p.id));
            }}
          >
            <span className="ov-toast__icon" aria-hidden="true">
              <Icon name={IKON[p.nada]} size={18} />
            </span>
            <div className="ov-toast__text">
              <RToast.Title className="ov-toast__title">{p.judul}</RToast.Title>
              {p.keterangan && (
                <RToast.Description className="ov-toast__desc">{p.keterangan}</RToast.Description>
              )}
            </div>
            <RToast.Close asChild>
              <button type="button" className="btn btn--ghost btn--icon" aria-label="Tutup notifikasi">
                <Icon name="close" size={16} />
              </button>
            </RToast.Close>
          </RToast.Root>
        ))}

        <RToast.Viewport className="ov-toast-region" />
      </RToast.Provider>
    </Ctx.Provider>
  );
}
