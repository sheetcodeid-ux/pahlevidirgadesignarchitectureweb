import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { Icon } from "../ui/Icon";
import { ambilProfil, GagalAuth, hapusSesi, profilTersimpan, sinkronkanProfil, type Profil } from "../../lib/admin";
import { daftarLembar, fiturProfil, fiturUntukJalur, lembarTampil } from "../../lib/navAdmin";
import { FITUR_PEMILIK } from "../../../../api/src/lib/fitur";

const Ctx = createContext<Profil | null>(null);

/**
 * useLayoutEffect di browser, useEffect di server.
 *
 * Bedanya menentukan di sini: useLayoutEffect berjalan SEBELUM paint, jadi
 * profil tersimpan sempat dipasang tanpa skeleton pernah terlihat sekejap
 * pun. useEffect berjalan setelah paint — satu frame skeleton lolos ke layar,
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
export function RequireAuth({ children, masterOnly = false, skeleton }: {
  children: ReactNode;
  masterOnly?: boolean;
  /**
   * Yang ditampilkan selama sesi diperiksa. Tiap panel mengirimkan skeleton
   * halamannya sendiri — bentuk yang sama yang ia pakai saat menunggu
   * datanya — sehingga halaman tersusun SEKALI, bukan spinner dulu lalu
   * skeleton lalu isi. Tanpa ini, hal pertama yang dilihat staf di setiap
   * halaman admin adalah spinner yang sama, dan bentuk halamannya baru
   * muncul belakangan.
   */
  skeleton?: ReactNode;
}) {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [status, setStatus] = useState<"memeriksa" | "siap" | "ditolak">("memeriksa");

  /* Profil yang tersimpan sejak masuk dipakai lebih dulu, dan pemeriksaan ke
   * backend jalan di belakangnya.
   *
   * Sebelumnya setiap halaman admin menunggu satu putaran jaringan penuh
   * sebelum menampilkan apa pun — dan karena situs ini statis tanpa router
   * klien, penantian itu terulang di SETIAP klik menu. Itu yang membuat
   * panelnya terasa lambat, bukan skeleton-nya.
   *
   * Dipromosikan di effect, bukan di nilai awal useState: nilai awal juga
   * dipakai saat Astro merender island ini di server, di mana localStorage
   * tidak ada — dan bedanya akan jadi ketidakcocokan hidrasi. Satu frame
   * skeleton tidak terlihat mata; satu putaran jaringan terlihat jelas.
   *
   * Yang dipercepat cuma tampilannya, bukan haknya: setiap data tetap
   * diambil dengan token yang divalidasi backend, dan pemeriksaan latar di
   * bawah tetap melempar keluar sesi yang sudah dicabut. Menampilkan
   * skeleton panel lebih dulu tidak membocorkan apa pun — situs ini statis,
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
        // Nama atau peran yang diubah dari perangkat lain ikut sampai ke
        // profil tersimpan (dan ke kartu akun di rel) di sini.
        sinkronkanProfil({
          nama: p.nama ?? null, avatarUrl: p.avatarUrl ?? null, role: p.role, isMasterAdmin: p.isMasterAdmin,
          fitur: p.fitur, langganan: p.langganan ?? null,
        });
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
    if (skeleton) {
      return <div className="skeleton--tunda" role="status" aria-busy="true" aria-label="Memuat halaman">{skeleton}</div>;
    }
    return (
      <div className="guard skeleton--tunda" role="status" aria-live="polite">
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

  /* Halaman yang tidak termasuk akses akun ini. Yang menolak sungguhan API
     (requireAkses); di sini halaman tidak dirender sama sekali, supaya tidak
     ada isian kosong dan galat 403 beruntun yang terbaca sebagai panel rusak. */
  const kunci = typeof window === "undefined" ? null : fiturUntukJalur(window.location.pathname);
  const fitur = fiturProfil(profil);
  /* Halaman khusus owner yang dibuka akun lain: kalimatnya "khusus pemilik",
     bukan "sesi berakhir" — sesinya sah, haknya yang tidak ada. */
  if (masterOnly && !profil.isMasterAdmin) {
    return <Terkunci profil={profil} kunci={kunci ?? "pengguna"} fitur={fitur ?? new Set()} pemilik />;
  }
  if (kunci && fitur && !fitur.has(kunci)) return <Terkunci profil={profil} kunci={kunci} fitur={fitur} />;

  return <Ctx.Provider value={profil}>{children}</Ctx.Provider>;
}

/* --- Halaman terkunci ------------------------------------------------------------
   Ungu = upgrade dan fitur berbayar (aturan warna #1). Kalimatnya menyebut
   SEBABNYA — paket, masa aktif, atau khusus pemilik — bukan "akses ditolak". */
function Terkunci({ profil, kunci, fitur, pemilik: paksaPemilik = false }: {
  profil: Profil; kunci: string; fitur: ReadonlySet<string>; pemilik?: boolean;
}) {
  const lembar = daftarLembar().halaman.find((l) => l.fitur === kunci);
  const nama = lembar?.label ?? "Halaman ini";
  const status = profil.langganan?.status;
  const pemilik = paksaPemilik || (FITUR_PEMILIK as readonly string[]).includes(kunci);
  const [judul, isi] = pemilik
    ? ["Khusus pemilik aplikasi", `${nama} hanya bisa dibuka akun owner.`]
    : status === "habis"
      ? ["Masa langganan berakhir", `Langganan ${profil.langganan?.planName ?? ""} berakhir ${profil.langganan?.accessUntil ? new Date(`${profil.langganan.accessUntil}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : ""}. Perpanjang untuk membuka ${nama} lagi.`]
      : status === "belum"
        ? ["Langganan belum aktif", `${nama} terbuka begitu pembayaran langganan diterima.`]
        : [`${nama} tidak termasuk paket Anda`, `Paket ${profil.langganan?.planName ?? "Anda"} belum mencakup lembar ini. Naikkan paket untuk membukanya.`];
  // Jalan keluar: lembar pertama yang memang boleh dibuka.
  const pulang = lembarTampil(fitur)[0];
  return (
    <div className="k-kunci" role="region" aria-labelledby="k-kunci-judul">
      <span className="k-kunci__gembok" aria-hidden="true">
        <Icon name="lock" size={22} />
      </span>
      <p className="k-kunci__kode">{lembar ? `Lembar ${lembar.kode}` : "Lembar terkunci"}</p>
      <h2 id="k-kunci-judul">{judul}</h2>
      <p className="k-kunci__isi">{isi}</p>
      {!pemilik && <p className="k-kunci__paket">Hubungi pemilik aplikasi untuk menaikkan atau memperpanjang paket.</p>}
      {pulang && (
        <a className="k-kunci__pulang" href={pulang.href}>
          Ke {pulang.label}
        </a>
      )}
    </div>
  );
}
