import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { Icon } from "../ui/Icon";
import { ambilProfil, GagalAuth, hapusSesi, profilTersimpan, type Profil } from "../../lib/admin";

const Ctx = createContext<Profil | null>(null);

/**
 * useLayoutEffect di browser, useEffect di server.
 *
 * Bedanya menentukan di sini: useLayoutEffect berjalan SEBELUM paint, jadi
 * profil tersimpan sempat dipasang tanpa kerangka pernah terlihat sekejap
 * pun. useEffect berjalan setelah paint — satu frame kerangka lolos ke layar,
 * dan pada halaman yang datanya sudah ada di cache, kedipan itu justru yang
 * paling terlihat.
 *
 * Astro merender island ini di server juga, dan React memperingatkan kalau
 * useLayoutEffect dipakai di sana. Karena itu ditukar, bukan dipaksakan.
 */
const useEfekTataLetak = typeof window === "undefined" ? useEffect : useLayoutEffect;

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

  /* Profil yang tersimpan sejak masuk dipakai lebih dulu, dan pemeriksaan ke
   * backend jalan di belakangnya.
   *
   * Sebelumnya setiap halaman admin menunggu satu putaran jaringan penuh
   * sebelum menampilkan apa pun — dan karena situs ini statis tanpa router
   * klien, penantian itu terulang di SETIAP klik menu. Itu yang membuat
   * panelnya terasa lambat, bukan kerangkanya.
   *
   * Dipromosikan di effect, bukan di nilai awal useState: nilai awal juga
   * dipakai saat Astro merender island ini di server, di mana localStorage
   * tidak ada — dan bedanya akan jadi ketidakcocokan hidrasi. Satu frame
   * kerangka tidak terlihat mata; satu putaran jaringan terlihat jelas.
   *
   * Yang dipercepat cuma tampilannya, bukan haknya: setiap data tetap
   * diambil dengan token yang divalidasi backend, dan pemeriksaan latar di
   * bawah tetap melempar keluar sesi yang sudah dicabut. Menampilkan
   * kerangka panel lebih dulu tidak membocorkan apa pun — situs ini statis,
   * jadi markupnya sudah sampai di browser sebelum pemeriksaan mana pun
   * berjalan. Catatan yang sama sudah ada di CLAUDE.md soal MasterGuard. */
  useEfekTataLetak(() => {
    const tersimpan = profilTersimpan();
    if (tersimpan && (!masterOnly || tersimpan.isMasterAdmin)) {
      setProfil(tersimpan);
      setStatus("siap");
    }
  }, [masterOnly]);

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
        // Jaringan putus sesaat tidak boleh merobohkan panel yang sudah
        // tampil dari profil tersimpan. Yang belum menampilkan apa pun tetap
        // diberi tahu bahwa backend tidak bisa dihubungi.
        setStatus((sekarang) => (sekarang === "siap" ? "siap" : "ditolak"));
      });

    return () => { batal = true; };
  }, [masterOnly]);

  if (status === "memeriksa") {
    // aria-busy, bukan spinner yang dibacakan: pembaca layar diberi tahu
    // bahwa daerah ini sedang diisi, sementara mata melihat bentuk
    // halamannya. Kerangkanya sendiri aria-hidden.
    if (kerangka) {
      return <div className="kerangka-tunda" role="status" aria-busy="true" aria-label="Memuat halaman">{kerangka}</div>;
    }
    return (
      <div className="guard kerangka-tunda" role="status" aria-live="polite">
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
