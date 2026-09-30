import { useEffect, useState } from "react";
import { SisiNav, type ItemNav } from "../kit/Nav";
import { SEMUA_IKON, NavSignOut } from "../kit/ikon";
import { Ikon, type DataIkon } from "../kit/Ikon";
import { NAV } from "../../lib/navAdmin";
import { hapusSesi } from "../../lib/admin";

/* =============================================================================
   Rel samping panel admin, versi kit.

   Isinya dibaca dari `lib/navAdmin.ts` — daftar yang SAMA dengan yang dipakai
   sidebar lama dan command palette. Dua daftar berisi hal yang sama pasti
   menyimpang, dan berkas navAdmin.ts memang lahir dari cacat itu; membuat
   daftar ketiga di sini akan mengulanginya.

   Yang diterjemahkan di sini cuma kosakata ikonnya: navAdmin menyebut nama
   ikon kit sebagai STRING (`ikonKit`), dan string itu diresolusi ke komponen
   lewat `SEMUA_IKON`. Kalau namanya salah ketik, barisnya tergambar tanpa
   ikon — bukan halaman yang gagal dibangun — jadi ada pemeriksaan di bawah
   yang melaporkannya ke konsol saat dev.
   ============================================================================= */

/* Kunci dicatat DUA kali: apa adanya, dan versi yang dibuang tanda bacanya.
   Sebabnya bukan kerapian — `SEMUA_IKON` memakai "Nav-Coins" sementara nama
   ekspornya `NavCoins`, dan menulis salah satunya di navAdmin.ts membuat
   barisnya tergambar sebagai lingkaran putus-putus TANPA satu pun galat.
   Sudah menggigit sekali, di lima baris menu sekaligus. */
const PETA: Map<string, DataIkon> = new Map();
for (const [nama, d] of SEMUA_IKON) {
  PETA.set(nama, d);
  PETA.set(nama.replace(/[^A-Za-z0-9]/g, ""), d);
}

function ikon(nama: string, konteks: string): DataIkon {
  const d = PETA.get(nama) ?? PETA.get(nama.replace(/[^A-Za-z0-9]/g, ""));
  if (!d) {
    /* Bukan lempar: satu nama yang salah ketik tidak boleh menjatuhkan
       seluruh panel. Tapi juga bukan diam — ikon yang hilang di rel samping
       adalah persis jenis cacat yang lolos berbulan-bulan. */
    /* Diberitahukan juga di build produksi, bukan cuma saat dev: yang
       menemukan cacat ini bukan `npm run dev` melainkan tangkapan layar
       halaman yang sudah dibangun. */
    console.warn(`[RelKit] ikon kit "${nama}" tidak ada (${konteks})`);
    return PETA.get("CircleDashed")!;
  }
  return d;
}

/* Menu geser di ponsel. Tombolnya tinggal di kepala halaman (KepalaKit),
   keadaannya di sini — dua island terpisah, jadi keduanya bicara lewat dua
   peristiwa window, bukan lewat keadaan bersama yang tidak mereka punya.
   Rel ini `transition:persist`, jadi keadaannya hidup lintas halaman;
   kepalanya dipasang ulang tiap halaman dan menanyakan keadaannya lagi. */
export const PERISTIWA_REL = "kit:rel";
export const PERISTIWA_REL_KEADAAN = "kit:rel-keadaan";
export const ID_REL = "kl-rel";

/** Selebar-lebarnya ponsel. Di atas ini rel kembali menempel di kiri. */
const PONSEL = "(max-width: 40rem)";

export interface PropRelKit {
  /** Path halaman yang sedang dibuka — penanda baris aktif. */
  path: string;
  /** Angka merah di baris Pesan Masuk. */
  pesanBelumDibaca?: number;
  /** Baris "UI Component" hanya untuk master admin. */
  master?: boolean;
  /** Nama studio di kepala rel. String, bukan JSX: rel ini dihidrasi, dan
      prop island harus bisa diserialkan. */
  namaStudio?: string;
}

/* Garis miring di ujung dibuang di KEDUA sisi sebelum dibandingkan.
   `Astro.url.pathname` pada situs statis berakhir dengan garis miring
   ("/admin/keuangan/") sementara `navAdmin.ts` menulisnya tanpa
   ("/admin/keuangan"), jadi perbandingan persis TIDAK PERNAH cocok — tidak
   ada baris yang menyala dan submenu tidak pernah terbuka. Tanpa satu pun
   galat, dan tidak kelihatan dari membaca komponennya; yang menjawab
   menghitung "is-aktif" di HTML hasil build. */
function rapi(p: string): string {
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

export function RelKit({ path, pesanBelumDibaca, master, namaStudio }: PropRelKit) {
  const kini = rapi(path);
  /* Halaman detail "<daftar>/satu" (Satu Proyek, Detail Paket) tidak punya
     baris sendiri di menu; yang menyala daftarnya. Tetap bukan startsWith —
     cuma akhiran "/satu" yang persis itu. */
  const cocok = (href: string) => rapi(href) === kini || `${rapi(href)}/satu` === kini;
  const item: ItemNav[] = NAV.filter((n) => !n.masterOnly || master).map((n) => {
    const anak = n.children?.map((c) => ({
      ikon: ikon(c.ikonKit, c.label),
      label: c.label,
      href: c.href,
      /* Cocok PERSIS, bukan `startsWith`. "/admin/pengaturan" adalah awalan
         dari "/admin/pengaturan/akun", jadi startsWith menyalakan dua baris
         sekaligus dan yang terbaca aktif jadi dua halaman berbeda. */
      aktif: cocok(c.href),
    }));
    return {
      ikon: ikon(n.ikonKit, n.label),
      label: n.label,
      href: n.href,
      aktif: n.href ? cocok(n.href) : false,
      anak,
      /* Submenu terbuka kalau salah satu anaknya yang sedang dibuka. Tidak
         ada tombol buka-tutup: rel ini dirender di server, dan menambah
         keadaan internal berarti seluruh rel harus dihidrasi cuma untuk itu. */
      terbuka: anak?.some((a) => a.aktif),
      jumlah: n.lencana === "pesan" ? pesanBelumDibaca : undefined,
      jumlahJudul: n.lencana === "pesan" ? "pesan belum dibaca" : undefined,
    };
  });

  const [buka, setBuka] = useState(false);

  useEffect(() => {
    const ubah = (e: Event) => {
      const d = (e as CustomEvent<boolean | undefined>).detail;
      setBuka((b) => (typeof d === "boolean" ? d : !b));
    };
    /* Kepala halaman yang baru dipasang menanyakan keadaan lewat detail
       "tanya" — jawabannya ikut dikirim lewat efek di bawah. */
    const tanya = () => window.dispatchEvent(new CustomEvent(PERISTIWA_REL_KEADAAN, { detail: bukaRef.v }));
    const ubahAtauTanya = (e: Event) =>
      (e as CustomEvent).detail === "tanya" ? tanya() : ubah(e);
    /* Menutup saat pindah halaman — di before-preparation, bukan page-load,
       supaya menutupnya terasa seketika saat menu diklik. Pola yang sama
       dengan sidebar lama. */
    const tutup = () => setBuka(false);
    const mq = window.matchMedia(PONSEL);
    const lebar = () => !mq.matches && setBuka(false);
    window.addEventListener(PERISTIWA_REL, ubahAtauTanya);
    document.addEventListener("astro:before-preparation", tutup);
    mq.addEventListener("change", lebar);
    return () => {
      window.removeEventListener(PERISTIWA_REL, ubahAtauTanya);
      document.removeEventListener("astro:before-preparation", tutup);
      mq.removeEventListener("change", lebar);
    };
  }, []);

  useEffect(() => {
    bukaRef.v = buka;
    window.dispatchEvent(new CustomEvent(PERISTIWA_REL_KEADAAN, { detail: buka }));
    if (!buka) return;
    /* Gulir badan dikunci selama menu terbuka, dan fokus pindah ke menu —
       tanpa itu Tab dari tombol menu berjalan ke isi halaman DI BELAKANG
       tirai. Esc satu-satunya jalan keluar lewat keyboard, dan fokus kembali
       ke tombol yang membukanya. */
    document.body.style.overflow = "hidden";
    document.querySelector<HTMLElement>(`#${ID_REL} .k-nav`)?.focus();
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setBuka(false);
      document.querySelector<HTMLElement>("[data-kl-rel-tombol]")?.focus();
    };
    document.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", esc);
    };
  }, [buka]);

  return (
    <>
      <SisiNav
        id={ID_REL}
        className={buka ? "is-buka" : undefined}
        logo={namaStudio ? <span className="kl__logo">{namaStudio}</span> : undefined}
        item={item}
        /* Keluar tinggal di kaki rel — slot yang di Coinest berisi banner
           promo, dengan ikon Nav-SignOut dari pustaka ikon Coinest sendiri.
           Sempat HILANG dari seluruh panel: satu-satunya tombol Keluar ada
           di Topbar kerangka lama, dan halaman terakhir yang memakainya
           (Info Studio, Akun) pindah ke kit di run #134. Perilakunya sama
           dengan tombol lama: sesi DAN cache data dibuang (hapusSesi),
           lalu ganti riwayat supaya tombol Kembali tidak membuka panel. */
        kaki={
          <button
            type="button"
            className="k-nav kl__keluar"
            onClick={() => {
              hapusSesi();
              window.location.replace("/admin/masuk");
            }}
          >
            <Ikon ikon={NavSignOut} ukuran={24} />
            <span className="k-sisi__label">Keluar</span>
          </button>
        }
      />
      {buka && <div className="ov-scrim kl__tirai" data-state="open" aria-hidden="true" onClick={() => setBuka(false)} />}
    </>
  );
}

/* Nilai terakhir, untuk menjawab "tanya" dari luar render. Satu objek
   modul, bukan useRef: pendengar peristiwanya dipasang sekali. */
const bukaRef = { v: false };
