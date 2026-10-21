import { useEffect, useMemo, useState } from "react";
import { PERISTIWA_PROFIL, profilTersimpan, type Profil } from "../../lib/admin";
import { fiturProfil } from "../../lib/navAdmin";

/**
 * Fitur yang boleh dibuka akun yang sedang masuk — untuk rel, kepala
 * halaman, dan palet. SATU hook supaya ketiganya tidak bisa menyimpang.
 *
 * Dibaca sesudah hidrasi (profil ada di penyimpanan peramban, jebakan #8) dan
 * ikut berubah saat /me membawa daftar baru (PERISTIWA_PROFIL) — misalnya
 * owner baru saja menaikkan paket akun ini. `undefined` = belum terbaca.
 */
export function useFiturAkun(): ReadonlySet<string> | undefined {
  const [kunci, setKunci] = useState<string | undefined>(undefined);
  useEffect(() => {
    const pasang = (p: Profil | null) => {
      const f = fiturProfil(p);
      setKunci(f ? [...f].sort().join(",") : undefined);
    };
    pasang(profilTersimpan());
    const dengar = (e: Event) => pasang((e as CustomEvent<Profil>).detail);
    window.addEventListener(PERISTIWA_PROFIL, dengar);
    return () => window.removeEventListener(PERISTIWA_PROFIL, dengar);
  }, []);
  // Set baru hanya saat isinya berubah — aman dipakai sebagai dependensi efek.
  return useMemo(() => (kunci === undefined ? undefined : new Set(kunci ? kunci.split(",") : [])), [kunci]);
}

/** Label peran untuk kop dan kartu akun. */
export function labelPeran(p: Pick<Profil, "role" | "isMasterAdmin">): string {
  if (p.role === "pelanggan") return "Pelanggan";
  return p.isMasterAdmin ? "Owner" : "Staf";
}
