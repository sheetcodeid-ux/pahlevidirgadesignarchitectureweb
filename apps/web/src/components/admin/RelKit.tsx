import { SisiNav, type ItemNav } from "../kit/Nav";
import { SEMUA_IKON } from "../kit/ikon";
import type { DataIkon } from "../kit/Ikon";
import { NAV } from "../../lib/navAdmin";

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

  return (
    <SisiNav
      logo={namaStudio ? <span className="kl__logo">{namaStudio}</span> : undefined}
      item={item}
    />
  );
}
