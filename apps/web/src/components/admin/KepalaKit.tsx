import { KepalaHalaman, TombolBulat } from "../kit/Item";
import { Cari } from "../kit/Isian";
import { Ikon } from "../kit/Ikon";
import { useEffect, useLayoutEffect, useState } from "react";
import { ArrowLeft, ArsLampuMeja, ArsLembar, ArsSetGambar } from "../kit/ikon";
import { gantiTema, temaGelap, PERISTIWA_TEMA } from "../../lib/tema";
import { PERISTIWA_REL, PERISTIWA_REL_KEADAAN, PERISTIWA_REVISI, ID_REL, ikonNav } from "./RelKit";
import { daftarLembar, lembarTampil, lembarUntuk, posisiLembar } from "../../lib/navAdmin";
import { useFiturAkun } from "./fiturAkun";
import { profilTersimpan } from "../../lib/admin";
import { navigate } from "astro:transitions/client";
import { TerbitKit } from "./TerbitKit";
/* Palet dimuat LANGSUNG, bukan malas: versi malasnya terukur kehilangan
   huruf yang diketik tepat sesudah Ctrl/Cmd+K (paletnya belum terpasang
   saat huruf itu tiba) — demi hemat ±17 KB. */
import { PaletPanel } from "./PaletPanel";
import { ambilBarisNotifikasi, barisNotifikasiTerakhir, revisiPerHalaman, type BarisNotifikasi } from "../../lib/notifikasi";
import { PanelPesan, PanelNotifikasi } from "./panelKabar";
import { TitipanToast } from "../kit/Toast";

/* =============================================================================
   Kepala halaman panel admin = KEPALA LEMBAR set gambar kerja.

   Rel samping adalah daftar gambar satu set; tiap halaman satu LEMBAR di
   set itu. Jadi kepalanya kepala lembar: kotak nomor lembar (ikon lembarnya
   + "P-22"), jalur kategori di atas judul, lalu peralatan meja gambar —
   cari lembar (Ctrl/Cmd+K), STEMPEL REV untuk Terbitkan, LAMPU MEJA untuk
   tema, surat pengantar untuk Pesan, dan segitiga REVISI untuk notifikasi.
   Nomor, ikon, dan jalurnya dari `daftarLembar()` — sumber yang sama dengan
   rel dan palet perintah (jebakan #32).

   Tinggi tetap 38 di y22 (frame 01): jalur 12 + judul 26, jadi badan
   halaman tetap mulai di y80 dan ke-32 halaman tetap satu layar.

   Gerak hanya karena perbuatan (jebakan #74): pindah halaman lewat router
   menggulung nomor lembar dan menggambar ikonnya dengan pena; menekan
   lampu mengayunkan lengannya; Terbitkan mencap stempelnya.

   Dibungkus jadi komponen React sendiri, bukan dirangkai di berkas .astro,
   karena JSX di dalam .astro menghasilkan fragmen ASTRO — bukan elemen
   React — jadi ia tidak bisa dioper sebagai prop ke komponen React. Yang
   dioper dari .astro cuma string.
   ============================================================================= */

/* PINDAH LEMBAR. Kepala ini dipasang ulang tiap halaman, jadi ia tidak
   bisa membandingkan nomor lembar lama dengan yang baru sendiri — dan
   menyalakan gerak sesudah hidrasi berarti nomor barunya sempat tergambar
   diam satu bingkai lalu meloncat. Yang menandainya peristiwa router,
   SEBELUM dokumen baru dipasang: kalau nomornya berganti, <html> dokumen
   baru diberi `data-kl-pindah`, dan CSS menggulung nomornya serta
   menggambar ikonnya sejak bingkai pertama. Muat penuh tidak melewati
   peristiwa ini, jadi tidak ada gerak saat dimuat. Atributnya dilepas
   sesudah geraknya selesai. Modul ini hidup selama sesi router, jadi
   pendengarnya cukup dipasang sekali. */
const PINDAH = "data-kl-pindah";
let waktuPindah = 0;
if (typeof document !== "undefined") {
  document.addEventListener("astro:before-swap", (e) => {
    const baru = (e as unknown as { newDocument: Document }).newDocument;
    const lama = document.querySelector(".kl__lembarno b")?.textContent;
    const kini = baru.querySelector(".kl__lembarno b")?.textContent;
    if (lama && kini && lama !== kini) baru.documentElement.setAttribute(PINDAH, "");
  });
  document.addEventListener("astro:after-swap", () => {
    window.clearTimeout(waktuPindah);
    if (!document.documentElement.hasAttribute(PINDAH)) return;
    waktuPindah = window.setTimeout(() => document.documentElement.removeAttribute(PINDAH), 1300);
  });
}

const LEMBAR = daftarLembar().halaman;

export function KepalaKit({ judul, kembali, dibangunPada, path }: {
  judul: string;
  kembali?: string;
  /** Stempel build yang dipanggang ke HTML — lihat useTerbit. */
  dibangunPada: string;
  /** Path halaman ini — nomor lembar dan jalur kategorinya. */
  path: string;
}) {
  /* Nomor, ikon, dan jalur cuma bergantung pada path, jadi sama di server
     dan klien. "10 / 32" bergantung pada peran (staf tidak menghitung lembar
     master) dan baru ditulis sesudah peran terbaca — sama dengan kop rel. */
  const dibuka = lembarUntuk(path, LEMBAR);
  const fitur = useFiturAkun();
  const keterangan = fitur === undefined ? null : posisiLembar(path, lembarTampil(fitur)).keterangan;

  /* Pintasan palet ditulis menurut mesinnya — sesudah dipasang, karena
     server tidak tahu mesin pengunjung. */
  const [tuts, setTuts] = useState("Ctrl K");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) setTuts("⌘ K");
  }, []);

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
  /* null = belum tiba (panel lonceng menggambar kerangka), [] = kosong. */
  const [baris, setBaris] = useState<BarisNotifikasi[] | null>(null);
  const pesanBaru = (baris ?? []).filter((b) => b.id.startsWith("pesan-")).length;
  /* Angka halaman sebelumnya dipasang SEBELUM paint pertama, bukan sebagai
     nilai awal useState: server merender "belum tahu", dan nilai awal yang
     berbeda di klien membuang pohon saat hidrasi (jebakan #8). */
  useLayoutEffect(() => {
    const kini = barisNotifikasiTerakhir();
    if (kini) setBaris(kini);
  }, []);
  useEffect(() => {
    let hidup = true;
    ambilBarisNotifikasi()
      .then((d) => {
        if (!hidup) return;
        setBaris(d);
        /* Kolom REV rel samping: butir yang sama, dihitung per halaman tujuan. */
        window.dispatchEvent(new CustomEvent(PERISTIWA_REVISI, { detail: revisiPerHalaman(d) }));
      })
      .catch(() => hidup && setBaris([]));
    return () => {
      hidup = false;
    };
  }, []);

  /* Tanggal di bawah judul DIBUANG atas permintaan pemilik ("tanggal …
     hilangkan aja") — kepala satu baris, seperti frame 01. */
  const [gelap, setGelap] = useState(false);
  useEffect(() => {
    setGelap(temaGelap());
    const dengar = () => setGelap(temaGelap());
    window.addEventListener(PERISTIWA_TEMA, dengar);
    return () => window.removeEventListener(PERISTIWA_TEMA, dengar);
  }, []);
  /* Lengan lampu berayun dan cahayanya menyala/padam hanya karena DITEKAN —
     bukan saat tema terbaca sesudah hidrasi (jebakan #74). Lewat Web
     Animations dari penangan klik, bukan kelas: tiap tekanan memulai
     ayunannya dari awal, dan tidak ada keadaan yang bisa tertinggal. Tanpa
     `fill` sesudahnya, jadi tidak ada animasi yang menumpuk (jebakan #72);
     keadaan diamnya milik CSS (`.is-nyala`). */
  const tekanLampu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const nyalaLama = temaGelap();
    const svg = e.currentTarget.querySelector("svg");
    gantiTema();
    if (!svg || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    svg.querySelector(".lengan")?.animate(
      [{ transform: "none" }, { transform: "rotate(-16deg)" }, { transform: "rotate(7deg)" }, { transform: "rotate(-2deg)" }, { transform: "none" }],
      { duration: 860, easing: "cubic-bezier(0.3, 0.6, 0.4, 1)" },
    );
    svg.querySelector(".cahaya")?.animate([{ opacity: nyalaLama ? 1 : 0 }, { opacity: nyalaLama ? 0 : 1 }], {
      duration: 320,
      delay: 160,
      easing: "ease-out",
      fill: "backwards",
    });
  };

  const kelompok = dibuka?.lembar.kelompok;
  const induk = dibuka?.lembar.induk;

  return (
    <KepalaHalaman
      /* Kelas sendiri, bukan `.kl__utama > .k-kepalahal`: kepala ini island,
         dan pembungkus <astro-island> membuat selektor anak langsung tidak
         pernah cocok (jebakan #1). */
      className="kl__kepala"
      judul={judul}
      /* Kotak nomor lembar — ikon lembar di sel kiri, nomornya di sel kanan,
         seperti sel LEMBAR di kop kaki rel. */
      lambang={
        <span className="kl__lembar">
          <span className="kl__lembarikon" aria-hidden="true">
            <Ikon ikon={dibuka ? ikonNav(dibuka.lembar.ikon, dibuka.lembar.label) : ArsLembar} ukuran={18} />
          </span>
          <span className="kl__lembarno">
            <small>Lembar</small>
            <span className="kl__lembarjendela">
              <b>{dibuka?.lembar.kode ?? "—"}</b>
            </span>
          </span>
        </span>
      }
      label={
        <span className="kl__jalur">
          {kelompok ?? "Set gambar"}
          {induk && (
            <>
              {" "}
              <i aria-hidden="true">›</i> {induk}
            </>
          )}
          {keterangan && <span className="kl__jalurket"> · {keterangan}</span>}
        </span>
      }
      /* Hanya tampil di ponsel (CSS .kl__menu). Bulat, bukan kotak seperti
         tombol kembali: di kit, yang bulat membuka panel. */
      kiri={
        <TombolBulat
          className="kl__menu"
          ikon={ArsSetGambar}
          ukuran={18}
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
            className="kl__cari"
            judul="Cari lembar atau proyek"
            placeholder="Cari lembar atau proyek"
            tuts={tuts}
            aria-keyshortcuts="Control+K Meta+K"
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
          <PaletPanel
            buka={cariBuka}
            baris={baris}
            dibangunPada={dibangunPada}
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
            {/* Terbitkan = membangun ulang situs studio pemilik; pelanggan tidak punya urusan di sana. */}
            {!(fitur && profilTersimpan()?.role === "pelanggan") && <TerbitKit dibangunPada={dibangunPada} />}
            {/* Tema terang/gelap = LAMPU MEJA GAMBAR: di tema gelap lampunya
                menyala (malam, lampu meja dinyalakan), di terang padam. */}
            <TombolBulat
              ikon={ArsLampuMeja}
              ukuran={20}
              judul={gelap ? "Ganti ke tema terang" : "Ganti ke tema gelap"}
              aria-pressed={gelap}
              className={gelap ? "kl__tema is-nyala" : "kl__tema"}
              onClick={tekanLampu}
            />
            {/* Panel pratinjau, bukan pindah halaman — lihat panelKabar. */}
            <PanelPesan belumDibaca={pesanBaru} />
            <PanelNotifikasi baris={baris} />
          </span>
        </>
      }
    />
  );
}
