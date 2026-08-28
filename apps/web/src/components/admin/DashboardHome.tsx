import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { RequireAuth } from "./RequireAuth";
import { SkeletonKartu, SkeletonStat, SkeletonTeks } from "../ui/Skeleton";
import { ambilSettings, profilTersimpan, type Profil, bacaCache, tulisCache} from "../../lib/admin";

/** Seberapa cepat sorot mengejar kursor tiap frame. Makin kecil makin lembut. */
const KEJAR = 0.11;

const SALAM = "Selamat Datang.";

/* Irama ketikan, dalam milidetik. Menghapus dibuat dua kali lebih cepat
   daripada mengetik: begitulah orang benar-benar menghapus, dan penghapusan
   selambat pengetikan terasa seperti halaman yang macet. */
const KETIK = 85;
const TAHAN_PENUH = 2000;
const HAPUS = 40;
const TAHAN_KOSONG = 600;

/**
 * Mengetik SALAM huruf demi huruf, menahannya sebentar, menghapusnya, lalu
 * mengulang. Dipakai satu setTimeout berantai, bukan setInterval: tiap tahap
 * punya jeda sendiri, dan interval tunggal tidak bisa menahan lebih lama di
 * ujung tanpa menghitung tick — cara yang mudah meleset satu langkah.
 *
 * Yang meminta gerakan dikurangi langsung mendapat kalimat utuh yang diam.
 */
function useKetikan() {
  const [n, setN] = useState(0);
  const [hapus, setHapus] = useState(false);
  const [diam, setDiam] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setDiam(true);
  }, []);

  useEffect(() => {
    if (diam) return;

    const selesaiKetik = n === SALAM.length;
    const jeda = !hapus ? (selesaiKetik ? TAHAN_PENUH : KETIK) : (n > 0 ? HAPUS : TAHAN_KOSONG);

    const t = setTimeout(() => {
      if (!hapus && !selesaiKetik) setN(n + 1);
      else if (!hapus) setHapus(true);
      else if (n > 0) setN(n - 1);
      else setHapus(false);
    }, jeda);

    return () => clearTimeout(t);
  }, [n, hapus, diam]);

  return diam ? SALAM : SALAM.slice(0, n);
}

/**
 * Kolom kiri dashboard: bidang bertitik dengan sapaan dan kartu identitas
 * studio di tengahnya.
 *
 * Titik-titiknya dua lapis. Lapis dasar selalu terlihat samar supaya bidangnya
 * tidak terbaca sebagai hitam kosong; lapis sorot sedikit lebih besar dan
 * lebih terang, tapi ditutup topeng radial yang mengikuti kursor sehingga
 * hanya muncul di sekitar penunjuk.
 *
 * Dua hal yang tidak sesederhana kelihatannya:
 *
 * 1. Sorotnya MENGEJAR kursor, bukan menempel padanya. Tiap frame posisinya
 *    digeser sebagian jarak ke sasaran, jadi gerakannya menyusul dengan
 *    lembut alih-alih melompat. Transition CSS tidak bisa dipakai di sini:
 *    yang berubah adalah posisi di dalam mask-image, dan properti itu tidak
 *    bisa diinterpolasi browser.
 * 2. Posisinya dikirim lewat custom property, bukan state React. mousemove
 *    menyala puluhan kali per detik dan render ulang sesering itu percuma
 *    untuk sesuatu yang cuma menggeser gradien.
 *
 * Sorot hanya hidup selama kursor ada di dalam kolom ini. Begitu keluar ia
 * dipudarkan lewat CSS (:hover), bukan digeser ke luar layar — menggeser
 * berarti menyeret lingkaran terang melintasi seluruh bidang dulu.
 */
function Kiri() {
  // Nama studio hampir tidak pernah berubah, dan ia satu-satunya alasan
  // kartu sambutan menunggu jaringan. Diambil dari cache dulu.
  const [nama, setNama] = useState<string | null>(
    () => bacaCache<{ studioName?: string }>("settings")?.studioName ?? null,
  );
  const [profil, setProfil] = useState<Profil | null>(null);
  const kolom = useRef<HTMLElement>(null);
  const sasaran = useRef({ x: -999, y: -999 });
  const posisi = useRef({ x: -999, y: -999 });
  const ketikan = useKetikan();

  useEffect(() => {
    setProfil(profilTersimpan());
    ambilSettings()
      .then((s) => { tulisCache("settings", s); setNama(s.studioName); })
      .catch(() => setNama((l) => l ?? "Dirga Pahlevi Architecture"));
  }, []);

  useEffect(() => {
    const el = kolom.current;
    if (!el) return;

    // Yang meminta gerakan dikurangi tidak dapat pengejaran sama sekali:
    // sorotnya menempel langsung di kursor.
    const halus = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let hidup = true;
    let frame = 0;

    function langkah() {
      if (!hidup) return;
      const p = posisi.current;
      const s = sasaran.current;
      if (halus) {
        p.x += (s.x - p.x) * KEJAR;
        p.y += (s.y - p.y) * KEJAR;
      } else {
        p.x = s.x;
        p.y = s.y;
      }
      el!.style.setProperty("--mx", `${p.x}px`);
      el!.style.setProperty("--my", `${p.y}px`);
      frame = requestAnimationFrame(langkah);
    }

    frame = requestAnimationFrame(langkah);
    return () => { hidup = false; cancelAnimationFrame(frame); };
  }, []);

  function titikKursor(e: React.MouseEvent<HTMLElement>) {
    const k = kolom.current!.getBoundingClientRect();
    return { x: e.clientX - k.left, y: e.clientY - k.top };
  }

  return (
    <section
      className="dashsplit__kiri"
      ref={kolom}
      onMouseMove={(e) => { sasaran.current = titikKursor(e); }}
      /* Saat masuk, posisinya disamakan dulu dengan titik masuk. Tanpa ini
         sorotnya meluncur dari tempat kursor terakhir keluar. Tidak terlihat
         karena lapisannya masih tembus pandang saat itu. */
      onMouseEnter={(e) => { const t = titikKursor(e); sasaran.current = t; posisi.current = { ...t }; }}
    >
      <span className="dashdot dashdot--dasar" aria-hidden="true" />
      <span className="dashdot dashdot--sorot" aria-hidden="true" />

      <div className="dashsplit__isi">
        {/* Dua lapis di kotak grid yang sama. Lapis pengukur berisi kalimat
            UTUH dan tak terlihat — ia yang menetapkan lebar h1, jadi lebarnya
            tidak berubah selama diketik. Tanpa itu baris yang rata tengah
            akan bergeser ke kiri setiap satu huruf bertambah, dan seluruh
            kalimat terlihat merayap.

            Teks ketikannya disembunyikan dari pembaca layar dan digantikan
            aria-label: kalimat yang tumbuh huruf demi huruf akan dibacakan
            ulang dari awal setiap kali satu huruf bertambah. */}
        <h1 className="dash-salam" aria-label={SALAM}>
          <span className="dash-salam__ukur" aria-hidden="true">
            {SALAM}
            <span className="dash-salam__caret" />
          </span>
          <span className="dash-salam__isi" aria-hidden="true">
            {ketikan}
            <span className="dash-salam__caret" />
          </span>
        </h1>

        <div className="dash-kartu">
          {/* Sengaja ikon, bukan logo studio: kartu ini menandai "sedang masuk
              sebagai siapa", dan logo studio sudah berdiri sendiri di sidebar.
              Dua tempat menampilkan logo yang sama membuat keduanya berebut
              perhatian. */}
          <span className="dash-kartu__logo">
            <Icon name="building" size={26} />
          </span>

          <span className="dash-kartu__teks">
            <span className="dash-kartu__nama">
              {nama ?? <span className="skeleton" style={{ height: "1.1rem", width: "9rem" }} />}
            </span>
            <span className="dash-kartu__peran">
              Login sebagai <strong>{profil?.isMasterAdmin ? "Master admin" : "Staf"}</strong>
            </span>
          </span>

          <a className="dash-kartu__aksi dash-kartu__aksi--lonceng" href="/admin/notifikasi" aria-label="Notifikasi">
            <Icon name="bell" size={17} />
          </a>
          <a className="dash-kartu__aksi dash-kartu__aksi--gerigi" href="/admin/pengaturan" aria-label="Info Studio">
            <Icon name="settings" size={17} />
          </a>
        </div>
      </div>
    </section>
  );
}

export function DashboardHome() {
  return (
    <RequireAuth kerangka={
      <div className="stack" style={{ gap: "var(--space-6)" }}>
        <SkeletonKartu ikon="dashboard" anak={<SkeletonTeks baris={2} />} />
        <SkeletonStat jumlah={3} />
      </div>
    }>
      <div className="dashsplit">
        <Kiri />
        {/* Kolom kanan sengaja kosong dulu — isinya menyusul. Elemennya tetap
            ada supaya garis pemisahnya punya sisi kanan dan lebar kolom kiri
            tidak berubah begitu isinya datang. */}
        <section className="dashsplit__kanan" />
      </div>
    </RequireAuth>
  );
}
