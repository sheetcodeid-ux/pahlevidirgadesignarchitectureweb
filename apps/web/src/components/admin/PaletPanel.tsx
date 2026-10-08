import { useEffect, useRef, useState } from "react";
import { gantiTema } from "../../lib/tema";
import { navigate } from "astro:transitions/client";
import { Palet, type KelompokPerintah } from "../kit/Palet";
import { Bell, Plus, Ruler, Sliders } from "../kit/ikon";
import { daftarLembar, NAV } from "../../lib/navAdmin";
import { IKON_NAV } from "./RelKit";
import { daftarProyek, bacaCache, profilTersimpan, type Proyek } from "../../lib/admin";
import { CATEGORY_LABELS } from "../../lib/api";

/* Nomor lembar tiap halaman — sumber yang sama dengan rel samping. */
const KODE = new Map(daftarLembar().halaman.map((l) => [l.href, l.kode]));

/* =============================================================================
   Palet perintah panel (Ctrl/Cmd+K, dan kotak "Cari di panel" di kepala).

   Versi kit dari `Perintah` lama: daftar halamannya tetap diturunkan dari
   navAdmin.ts (satu daftar, jebakan #32), ikonnya ikon menu yang SAMA dengan
   rel samping, dan proyeknya dibuka di Satu Proyek. Daftar proyek diambil
   saat palet DIBUKA — palet dipasang di setiap halaman dan jarang dibuka.
   ============================================================================= */

export function PaletPanel({ buka, onBuka }: { buka: boolean; onBuka: (b: boolean) => void }) {
  const [proyek, setProyek] = useState<Proyek[] | null>(null);
  const [master, setMaster] = useState(false);
  const kini = useRef({ buka, onBuka });
  kini.current = { buka, onBuka };

  useEffect(() => {
    setMaster(Boolean(profilTersimpan()?.isMasterAdmin));
    const tekan = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        kini.current.onBuka(!kini.current.buka);
      }
    };
    document.addEventListener("keydown", tekan);
    return () => document.removeEventListener("keydown", tekan);
  }, []);

  useEffect(() => {
    if (!buka) return;
    setProyek((l) => l ?? bacaCache<Proyek[]>("proyek"));
    daftarProyek().then(setProyek).catch(() => {});
  }, [buka]);

  const pergi = (ke: string) => () => {
    onBuka(false);
    navigate(ke);
  };

  /* Nomor lembar sama dengan rel (daftar gambar) — tampil di keterangan dan
     ikut dicari, jadi "P-22" menemukan Terima Pembayaran. */
  const halaman = NAV.filter((n) => master || !n.masterOnly).flatMap((n) =>
    n.children
      ? n.children.map((c) => {
          const kode = KODE.get(c.href);
          return { label: c.label, ket: kode ? `${kode} · ${n.label}` : n.label, ikon: IKON_NAV[c.ikonKit], kata: `${n.label} ${kode ?? ""}`, onPilih: pergi(c.href) };
        })
      : [{ label: n.label, ket: KODE.get(n.href!), ikon: IKON_NAV[n.ikonKit], kata: KODE.get(n.href!), onPilih: pergi(n.href!) }],
  );

  const kelompok: KelompokPerintah[] = [
    { judul: "Halaman", butir: [...halaman, { label: "Notifikasi", ikon: Bell, onPilih: pergi("/admin/notifikasi") }] },
    {
      judul: "Proyek",
      butir: (proyek ?? []).map((p) => ({
        label: p.title,
        ikon: Ruler,
        ket: CATEGORY_LABELS[p.category as keyof typeof CATEGORY_LABELS] ?? p.category,
        kata: `${p.client ?? ""} ${p.city ?? p.location ?? ""}`,
        onPilih: pergi(`/admin/proyek/satu?id=${encodeURIComponent(p.id)}`),
      })),
    },
    {
      judul: "Aksi",
      butir: [
        { label: "Proyek baru", ikon: Plus, onPilih: pergi("/admin/proyek/baru") },
        {
          label: "Ganti tema terang / gelap",
          ikon: Sliders,
          kata: "gelap terang mode",
          onPilih: () => {
            gantiTema();
            onBuka(false);
          },
        },
      ],
    },
  ];

  return <Palet buka={buka} onBuka={onBuka} kelompok={kelompok} />;
}
