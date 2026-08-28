import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Icon } from "../ui/Icon";
import { ambilProfil, GagalAuth, hapusSesi, type Profil } from "../../lib/admin";

const Ctx = createContext<Profil | null>(null);

/** Profil staf yang sedang masuk. Hanya bisa dipanggil di dalam RequireAuth. */
export function useProfil() {
  const p = useContext(Ctx);
  if (!p) throw new Error("useProfil dipanggil di luar RequireAuth");
  return p;
}

/**
 * Memastikan halaman hanya dirender untuk staf yang sesinya masih sah.
 *
 * Pemeriksaannya memanggil backend, bukan sekadar membaca localStorage — token
 * yang sudah dicabut harus ditolak, dan hanya backend yang tahu. Yang gagal
 * diarahkan ke halaman masuk beserta tujuan semula, supaya setelah masuk ia
 * kembali ke tempat yang ia tuju.
 */
export function RequireAuth({ children, masterOnly = false, kerangka }: {
  children: ReactNode;
  masterOnly?: boolean;
  /**
   * Yang ditampilkan selama sesi diperiksa. Tiap panel mengirimkan kerangka
   * halamannya sendiri — bentuk yang sama yang ia pakai saat menunggu
   * datanya — sehingga halaman tersusun SEKALI, bukan spinner dulu lalu
   * kerangka lalu isi. Tanpa ini, hal pertama yang dilihat staf di setiap
   * halaman admin adalah spinner yang sama, dan bentuk halamannya baru
   * muncul belakangan.
   */
  kerangka?: ReactNode;
}) {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [status, setStatus] = useState<"memeriksa" | "siap" | "ditolak">("memeriksa");

  useEffect(() => {
    let batal = false;

    ambilProfil()
      .then((p) => {
        if (batal) return;
        if (masterOnly && !p.isMasterAdmin) {
          setStatus("ditolak");
          return;
        }
        setProfil(p);
        setStatus("siap");
      })
      .catch((err) => {
        if (batal) return;
        if (err instanceof GagalAuth) {
          hapusSesi();
          window.location.replace(`/admin/masuk?dari=${encodeURIComponent(location.pathname + location.search)}`);
          return;
        }
        setStatus("ditolak");
      });

    return () => { batal = true; };
  }, [masterOnly]);

  if (status === "memeriksa") {
    // aria-busy, bukan spinner yang dibacakan: pembaca layar diberi tahu
    // bahwa daerah ini sedang diisi, sementara mata melihat bentuk
    // halamannya. Kerangkanya sendiri aria-hidden.
    if (kerangka) {
      return <div role="status" aria-busy="true" aria-label="Memuat halaman">{kerangka}</div>;
    }
    return (
      <div className="guard" role="status" aria-live="polite">
        <span className="spinner" />
        <p className="t-muted">Memeriksa sesi…</p>
      </div>
    );
  }

  if (status === "ditolak" || !profil) {
    return (
      <div className="guard guard--locked">
        <span className="icon-tile"><Icon name="lock" size={22} /></span>
        <h2 className="t-heading">Tidak bisa memuat panel</h2>
        <p className="t-muted">
          Sesi Anda mungkin sudah berakhir, akun ini tidak berhak, atau backend sedang tidak bisa dihubungi.
        </p>
        <a className="btn btn--primary" href="/admin/masuk">Masuk kembali</a>
      </div>
    );
  }

  return <Ctx.Provider value={profil}>{children}</Ctx.Provider>;
}
