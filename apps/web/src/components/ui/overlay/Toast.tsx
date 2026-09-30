import * as RToast from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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

/* -----------------------------------------------------------------------------
   Toast TITIPAN — yang harus selamat melewati pindah halaman.

   Toast hidup di dalam island halaman, dan pindah halaman membuang island
   itu. Jadi "Proyek dihapus" yang dipanggil tepat sebelum navigate() tidak
   pernah terlihat: halamannya sudah berganti sebelum toastnya sempat
   tergambar. Terukur di lima alur — hapus proyek, hapus tulisan, hapus
   paket, tambah tulisan, tambah paket — yang semuanya berakhir di halaman
   lain tanpa satu kata pun bahwa perbuatannya berhasil.

   Pesannya dititipkan di sessionStorage dan diambil SEKALI oleh
   <TitipanToast/> di halaman tujuan (dipasang di kepala halaman kit, yang
   ada di setiap halaman). Berumur 15 detik: titipan yang tidak pernah
   dijemput tidak boleh muncul belakangan di halaman yang tidak ada
   hubungannya.
   -------------------------------------------------------------------------- */
const KUNCI_TITIPAN = "ov-toast-titipan";

/** Titipkan toast untuk halaman BERIKUTNYA. Panggil tepat sebelum navigate(). */
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

/**
 * Penjemput titipan. Dirender lewat PORTAL ke <body> dan baru sesudah
 * dipasang: region toast milik ToastProvider adalah elemen sungguhan, dan
 * kalau ia jatuh di dalam kepala halaman yang ber-flex ia ikut menjadi
 * anak flex — menggeser tata letak yang sudah diukur piksel demi piksel.
 * Render server dan render pertama klien sama-sama null, jadi hidrasinya
 * tidak bisa menyimpang.
 */
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
