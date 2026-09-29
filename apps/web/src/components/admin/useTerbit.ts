import { useCallback, useEffect, useState } from "react";
import { statusTerbit, terbitkanSitus, PERISTIWA_TULIS } from "../../lib/admin";

/* =============================================================================
   Logika tombol Terbitkan — dipakai DUA kepala: bilah atas lama (Topbar,
   AdminLayout) dan kepala kit (KepalaKit, KitLayout).

   Dipisah dari tampilannya karena dua kerangka itu hidup berdampingan selama
   halaman dipindah satu per satu (P4). Menyalin logika ini ke kepala kit
   berarti dua salinan polling, dua cara menghitung "belum tayang" — dan yang
   jarang dilihat pasti menyimpang (jebakan #32). Tampilan boleh dua; keadaan
   dan aturannya satu.

   Kenapa tombol ini ada: halaman publik dibekukan saat build (invarian 4 & 5),
   jadi mengubah data di panel TIDAK mengubah situs sampai ada build ulang.
   ============================================================================= */

export type KeadaanKirim = "diam" | "kirim" | "jalan" | "tayang";

/** "3 menit lalu", "2 jam lalu", "kemarin". */
export function sejak(iso: string, kini: Date): string {
  const detik = Math.max(0, (kini.getTime() - new Date(iso).getTime()) / 1000);
  if (detik < 90) return "baru saja";
  const menit = Math.round(detik / 60);
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.round(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.round(jam / 24);
  return hari === 1 ? "kemarin" : `${hari} hari lalu`;
}

/** "10 Sep, 10.04" dalam zona waktu studio — sama dengan jam di topbar. */
export function jamTanggal(iso: string, zona: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: zona,
  }).format(new Date(iso)).replace(/\./g, ".").replace(" pukul ", ", ");
}

export function useTerbit(dibangunPada: string) {
  const [berubahPada, setBerubahPada] = useState<string | null | undefined>(undefined);
  const [kirim, setKirim] = useState<KeadaanKirim>("diam");
  const [galat, setGalat] = useState<string | null>(null);
  /* Stempel build yang BERLAKU sekarang. Berangkat dari yang dipanggang ke
     HTML halaman ini, lalu diperbarui sendiri begitu /cap-build.json berganti.

     Ini yang membuat statusnya berubah tanpa perlu memuat ulang. Sebelumnya
     stempelnya hanya bisa datang dari HTML, dan HTML hanya berganti kalau
     halamannya dimuat ulang — jadi situsnya sudah tayang sementara panelnya
     masih menulis "menunggu", persis yang dilaporkan pemilik. */
  const [capBuild, setCapBuild] = useState(dibangunPada);
  /* Detik sejak tombol ditekan. Bukan hiasan: build yang tidak menunjukkan
     apa pun selama satu setengah menit terbaca sebagai build yang gantung. */
  const [detik, setDetik] = useState(0);
  // Waktu dibaca setelah mount saja: server dan peramban hampir pasti berbeda
  // beberapa detik, dan "3 menit lalu" yang dihitung dua kali dengan hasil
  // berbeda adalah persis ketidakcocokan hidrasi yang dikeluhkan React.
  const [kini, setKini] = useState<Date | null>(null);

  /* Menanyakan stempel build yang sedang tayang. no-store DAN penanda waktu di
     query: satu saja tidak cukup — proxy di tengah jalan mengabaikan header,
     peramban mengabaikan query kalau headernya mengizinkan menyimpan. */
  const periksaBuild = useCallback(async () => {
    try {
      const r = await fetch(`/cap-build.json?t=${Date.now()}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { dibangunPada?: string };
      if (d.dibangunPada) setCapBuild(d.dibangunPada);
    } catch {
      // Jaringan putus sesaat: stempel yang sudah ada tetap dipakai.
    }
  }, []);

  useEffect(() => {
    const perbarui = () => {
      statusTerbit()
        .then((d) => setBerubahPada(d.terakhirBerubah))
        .catch(() => setBerubahPada(null));
      periksaBuild();
    };
    perbarui();
    setKini(new Date());
    const t = setInterval(() => setKini(new Date()), 30_000);

    // Dua kabar, dua alasan berbeda. astro:page-load: staf pindah halaman,
    // dan kepala halaman tidak selalu ikut dipasang ulang (transition:persist
    // di bilah atas lama). PERISTIWA_TULIS: staf menulis sesuatu TANPA pindah
    // halaman — menyimpan tulisan jurnal lalu tetap di editornya, misalnya.
    // Tanpa yang kedua, penandanya baru menyala setelah pindah halaman, dan
    // itu justru saat yang paling salah.
    document.addEventListener("astro:page-load", perbarui);
    window.addEventListener(PERISTIWA_TULIS, perbarui);
    return () => {
      clearInterval(t);
      document.removeEventListener("astro:page-load", perbarui);
      window.removeEventListener(PERISTIWA_TULIS, perbarui);
    };
  }, [periksaBuild]);

  /* Selagi build berjalan, stempelnya ditanya tiap lima detik — bukan tiap
     tiga puluh. Yang ditunggu memang cuma satu menit; menanyakannya jarang
     berarti statusnya baru berubah lama setelah situsnya benar-benar tayang.
     Berhenti sendiri begitu selesai, jadi tidak ada polling yang menganggur. */
  useEffect(() => {
    if (kirim !== "jalan") return;
    const jam = setInterval(() => setDetik((n) => n + 1), 1000);
    const tanya = setInterval(periksaBuild, 5000);
    return () => { clearInterval(jam); clearInterval(tanya); };
  }, [kirim, periksaBuild]);

  /* Stempel berganti = build yang dipicu tadi sudah tayang. */
  useEffect(() => {
    if (capBuild !== dibangunPada && kirim === "jalan") setKirim("tayang");
  }, [capBuild, dibangunPada, kirim]);

  const belumTayang = Boolean(berubahPada && new Date(berubahPada) > new Date(capBuild));
  // "jalan" tetap dihitung belum tayang, dan itu memang benar: build sedang
  // berlangsung, jadi yang tayang masih yang lama. Penandanya padam sendiri
  // begitu halaman ini dimuat ulang dari build yang baru — stempel di HTML-nya
  // ikut baru. Tidak ada keadaan yang perlu disimpan di mana pun.
  const menyala = (belumTayang || kirim === "jalan") && kirim !== "tayang";

  async function terbitkan() {
    setKirim("kirim");
    setGalat(null);
    setDetik(0);
    try {
      await terbitkanSitus();
      setKirim("jalan");
    } catch (e) {
      setGalat((e as Error).message);
      setKirim("diam");
    }
  }

  const jamMundur = `${Math.floor(detik / 60)}:${String(detik % 60).padStart(2, "0")}`;

  /** Satu kalimat status — sama di kedua kepala. */
  const kalimat =
    kirim === "jalan"
      ? "Situs sedang dibangun ulang. Sekitar satu menit lagi perubahannya tampil."
      : kirim === "tayang"
        ? "Selesai — perubahannya sudah tampil di situs publik."
        : menyala
          ? "Ada perubahan yang belum tampil di situs publik."
          : "Situs publik sudah sama dengan data di panel ini.";

  const labelTombol =
    kirim === "kirim" ? "Mengirim…"
      : kirim === "jalan" ? "Sedang dibangun…"
      : kirim === "tayang" ? "Sudah tayang"
      : "Terbitkan sekarang";

  return { berubahPada, kirim, galat, kini, menyala, terbitkan, jamMundur, kalimat, labelTombol };
}
