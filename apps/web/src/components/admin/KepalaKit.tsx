import { KepalaHalaman, TombolBulat } from "../kit/Item";
import { Cari } from "../kit/Isian";
import { useEffect, useState } from "react";
import { ChatTeardropDots, Bell, ArrowLeft, List } from "../kit/ikon";
import { PERISTIWA_REL, PERISTIWA_REL_KEADAAN, PERISTIWA_PESAN, ID_REL } from "./RelKit";
import { navigate } from "astro:transitions/client";
import { TerbitKit } from "./TerbitKit";
import { Perintah } from "./Perintah";
import { ambilBarisNotifikasi } from "../../lib/notifikasi";
import { TitipanToast } from "../ui/overlay/Toast";

/* Kepala halaman panel admin — `KepalaHalaman` kit dengan isi kanan yang
   sama di seluruh halaman.

   Dibungkus jadi komponen React sendiri, bukan dirangkai di berkas .astro,
   karena JSX di dalam .astro menghasilkan fragmen ASTRO — bukan elemen
   React — jadi ia tidak bisa dioper sebagai prop ke komponen React. Yang
   dioper dari .astro cuma string. */
export function KepalaKit({ judul, kembali, dibangunPada }: {
  judul: string;
  kembali?: string;
  /** Stempel build yang dipanggang ke HTML — lihat useTerbit. */
  dibangunPada: string;
}) {
  /* Keadaan menu geser milik RelKit; di sini cuma cerminnya untuk
     aria-expanded. Kepala ini dipasang ulang tiap halaman, jadi ia bertanya
     sekali saat dipasang. */
  const [menuBuka, setMenuBuka] = useState(false);
  useEffect(() => {
    const dengar = (e: Event) => setMenuBuka(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener(PERISTIWA_REL_KEADAAN, dengar);
    window.dispatchEvent(new CustomEvent(PERISTIWA_REL, { detail: "tanya" }));
    return () => window.removeEventListener(PERISTIWA_REL_KEADAAN, dengar);
  }, []);

  /* Kotak cari, lonceng, dan tombol pesan SEMPAT cuma hiasan: kepala kit
     digambar dari frame, dan ketiganya tidak pernah disambungkan — sementara
     yang dulu mengerjakannya (palet Ctrl/Cmd+K, lonceng berangka) tinggal di
     Topbar kerangka lama yang tidak dipakai halaman kit mana pun.

     Angkanya dari sumber yang SAMA dengan halaman Notifikasi dan "Perlu
     Ditangani" di Dashboard (lib/notifikasi): pekerjaan yang benar-benar
     belum ditangani, jadi ia turun sendiri begitu sumbernya ditangani.
     Diambil sekali tiap halaman — kepala ini dipasang ulang tiap pindah
     halaman, jadi angkanya ikut segar tanpa polling. Membaca saja, tidak
     menulis cache (jebakan #8). */
  const [cariBuka, setCariBuka] = useState(false);
  const [jumlah, setJumlah] = useState({ semua: 0, pesan: 0 });
  useEffect(() => {
    let hidup = true;
    ambilBarisNotifikasi()
      .then((baris) => {
        if (!hidup) return;
        const pesan = baris.filter((b) => b.id.startsWith("pesan-")).length;
        setJumlah({ semua: baris.length, pesan });
        window.dispatchEvent(new CustomEvent(PERISTIWA_PESAN, { detail: pesan }));
      })
      .catch(() => {});
    return () => {
      hidup = false;
    };
  }, []);

  return (
    <KepalaHalaman
      judul={judul}
      /* Hanya tampil di ponsel (CSS .kl__menu). Bulat, bukan kotak seperti
         tombol kembali: di kit, yang bulat membuka panel. */
      kiri={
        <TombolBulat
          className="kl__menu"
          ikon={List}
          judul={menuBuka ? "Tutup menu" : "Buka menu"}
          aria-controls={ID_REL}
          aria-expanded={menuBuka}
          data-kl-rel-tombol=""
          onClick={() => window.dispatchEvent(new CustomEvent(PERISTIWA_REL))}
        />
      }
      /* `kembali` berupa ALAMAT, bukan history.back(): halaman detail bisa
         dibuka langsung dari tautan, dan "kembali" ke halaman sebelumnya
         lalu berarti keluar dari panel. navigate() lewat router sisi klien,
         sama dengan klik menu. */
      onKembali={kembali ? () => navigate(kembali) : undefined}
      ikonKembali={kembali ? ArrowLeft : undefined}
      kanan={
        <>
          {/* Kotak cari membuka palet perintah, bukan menyaring di tempat:
              yang dicari di sini halaman atau proyek, dan hasilnya pindah
              halaman. readOnly + klik/ketik, BUKAN onFocus — Radix
              mengembalikan fokus ke pemicunya saat palet ditutup, dan
              onFocus akan langsung membukanya lagi. */}
          <Cari
            ukuran="medium"
            judul="Cari halaman atau proyek"
            placeholder="Cari di panel"
            readOnly
            aria-haspopup="dialog"
            onClick={() => setCariBuka(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " " || (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey)) {
                e.preventDefault();
                setCariBuka(true);
              }
            }}
          />
          <Perintah
            tanpaTombol
            buka={cariBuka}
            onBuka={(b) => {
              setCariBuka(b);
              /* Palet ini tidak punya pemicu Radix, jadi saat ditutup Radix
                 mengembalikan fokus ke <body> — pemakai papan ketik kehilangan
                 tempatnya. Dikembalikan ke kotak cari, sesudah Radix selesai. */
              if (!b) requestAnimationFrame(() => document.querySelector<HTMLElement>(".k-kepalahal .k-cari__input")?.focus());
            }}
          />
          {/* Konfirmasi dari halaman sebelumnya ("Proyek dihapus") — lihat
              titipToast. Portal ke <body>, jadi tidak menambah apa pun di sini. */}
          <TitipanToast />
          <span className="k-kepalahal__grup">
            <TerbitKit dibangunPada={dibangunPada} />
            <TombolBulat
              ikon={ChatTeardropDots}
              judul={jumlah.pesan > 0 ? `Pesan Masuk, ${jumlah.pesan} belum dibaca` : "Pesan Masuk"}
              tanda={jumlah.pesan > 0}
              onClick={() => navigate("/admin/pesan")}
            />
            <TombolBulat
              ikon={Bell}
              judul={jumlah.semua > 0 ? `Notifikasi, ${jumlah.semua} perlu ditangani` : "Notifikasi"}
              tanda={jumlah.semua > 0}
              onClick={() => navigate("/admin/notifikasi")}
            />
          </span>
        </>
      }
    />
  );
}
