import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SisiNav, type ItemNav } from "../kit/Nav";
import {
  ArsAkun, ArsAmplopGaji, ArsArahUtara, ArsAwanRevisi, ArsBingkaiFoto, ArsBukuGaji, ArsBukuSketsa, ArsDaftarPeriksa,
  ArsFasad, ArsGarisUkur, ArsGembok, ArsJangka, ArsKartuBayar, ArsKartuIndeks, ArsKertasLubang, ArsKuitansi, ArsKunciRumah,
  ArsKurvaS, ArsLantai, ArsLembar, ArsLencanaKlien, ArsMal, ArsMejaGambar, ArsMesinKas, ArsNotaPaku, ArsOrdner, ArsPeil,
  ArsPintu, ArsRekap, ArsSebelumSesudah, ArsSkalaManusia, ArsStempel, ArsSuratPengantar, ArsTampakRumah, ArsTermin,
  ArsTimStudio, CircleDashed,
} from "../kit/ikon";
import type { DataIkon } from "../kit/Ikon";
import { Avatar } from "../kit/Tampilan";
import { TombolIkon } from "../kit/Tombol";
import { daftarLembar, KODE_KELOMPOK, lembarTampil, NAV, navTampil, posisiLembar, rapiPath, revisiPerLembar, type Lembar } from "../../lib/navAdmin";
import { labelPeran, useFiturAkun } from "./fiturAkun";
import {
  ambilSettings, bacaCache, keluar, namaTampilan, PERISTIWA_PROFIL, profilTersimpan, type Profil, type StudioSettings,
} from "../../lib/admin";
import { barisNotifikasiTerakhir, revisiPerHalaman } from "../../lib/notifikasi";
import { inisial } from "../../lib/nomorDokumen";
import { jamStudio, tanggalRevisi, useJam } from "./jamStudio";

/* =============================================================================
   Rel samping panel admin — DAFTAR GAMBAR satu set gambar kerja.

   Isinya dibaca dari `lib/navAdmin.ts` — daftar yang SAMA dengan palet
   perintah (jebakan #32). Yang dirakit di sini:
   - SAMPUL set gambar: logo + nama studio (Info Studio), jumlah lembar,
     tanggal REVISI panel (= stempel build — kapan panel ini terakhir
     diterbitkan), dan KUNCI DENAH: denah kecil satu ruang per kategori,
     lebarnya sebanding banyaknya lembar, ruang lembar yang dibuka DIARSIR.
     Ruangnya bisa ditunjuk (menyorot kepala kategorinya) dan diklik
     (menggulir daftar ke sana).
   - Kolom REV: segitiga revisi per lembar dari pekerjaan yang menunggu
     (lib/notifikasi — sumber yang sama dengan lonceng).
   - KOP GAMBAR di kaki: akun, lembar yang dibuka (i / N), tanggal + jam
     studio, dan pintu Keluar (simbol pintu denah yang berayun).
   ============================================================================= */

/* Peta ikon menu — ikon ARSITEKTUR buatan sendiri (kit/ikon/arsitektur.ts),
   ditulis satu per satu. `NamaIkonNav` dipakai navAdmin.ts, jadi nama yang
   salah ketik merah di typecheck. */
export const IKON_NAV = {
  ArsAkun, ArsAmplopGaji, ArsArahUtara, ArsAwanRevisi, ArsBingkaiFoto, ArsBukuGaji, ArsBukuSketsa, ArsDaftarPeriksa,
  ArsFasad, ArsGarisUkur, ArsGembok, ArsJangka, ArsKartuBayar, ArsKartuIndeks, ArsKertasLubang, ArsKuitansi, ArsKunciRumah,
  ArsKurvaS, ArsLantai, ArsLembar, ArsLencanaKlien, ArsMal, ArsMejaGambar, ArsMesinKas, ArsNotaPaku, ArsOrdner, ArsPeil,
  ArsRekap, ArsSebelumSesudah, ArsSkalaManusia, ArsStempel, ArsSuratPengantar, ArsTampakRumah, ArsTermin, ArsTimStudio,
} satisfies Record<string, DataIkon>;
export type NamaIkonNav = keyof typeof IKON_NAV;
const PETA = new Map<string, DataIkon>(Object.entries(IKON_NAV));

/** Data ikon menu menurut namanya — rel dan kepala halaman. */
export function ikonNav(nama: string, konteks: string): DataIkon {
  const d = PETA.get(nama);
  if (!d) {
    /* Bukan lempar: satu nama yang salah ketik tidak boleh menjatuhkan
       seluruh panel — tapi juga bukan diam. */
    console.warn(`[RelKit] ikon kit "${nama}" tidak ada (${konteks})`);
    return CircleDashed;
  }
  return d;
}

/* Menu geser di ponsel. Tombolnya tinggal di kepala halaman (KepalaKit),
   keadaannya di sini — dua island, jadi keduanya bicara lewat peristiwa
   window. Rel ini `transition:persist`, jadi keadaannya hidup lintas
   halaman; kepalanya dipasang ulang tiap halaman dan menanyakannya lagi. */
export const PERISTIWA_REL = "kit:rel";
export const PERISTIWA_REL_KEADAAN = "kit:rel-keadaan";
/** Butir notifikasi per halaman tujuan (`revisiPerHalaman`), dikabarkan
    kepala kit sesudah ia mengambil notifikasi — kolom REV. Rel ini tidak
    mengambil data itu sendiri: dua pengambilan untuk angka yang sama berarti
    dua angka yang suatu saat tidak sepakat. */
export const PERISTIWA_REVISI = "kit:revisi";
export const ID_REL = "kl-rel";

/** Di bawah ini rel jadi menu geser. Harus sama dengan titik-patah menu geser
    di KitLayout — 56rem. */
const PONSEL = "(max-width: 56rem)";

export interface PropRelKit {
  /** Path halaman yang sedang dibuka — penanda baris aktif. */
  path: string;
  /** Nama studio cadangan sebelum Info Studio terbaca. */
  namaStudio?: string;
  /** Stempel build (ISO) — tanggal REVISI di sampul. */
  revisi?: string;
}

const rapi = rapiPath;
const useEfekTataLetak = typeof window === "undefined" ? useEffect : useLayoutEffect;

/* Nomor lembar dihitung sekali — NAV tidak berubah selama halaman hidup. */
const LEMBAR = daftarLembar();
const KODE_HALAMAN = new Map(LEMBAR.halaman.map((l) => [rapi(l.href), l.kode]));
const KELOMPOK = [...new Set(NAV.map((n) => n.group))];

const gerakBoleh = () => typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Ruang kunci denah: satu per kategori yang punya lembar TAMPIL, urut rel. */
export function zonaDenah(tampil: Lembar[]): { nama: string; kode: string; jumlah: number }[] {
  const per = new Map<string, number>();
  for (const l of tampil) per.set(l.kelompok, (per.get(l.kelompok) ?? 0) + 1);
  return KELOMPOK.map((g) => ({ nama: g, kode: KODE_KELOMPOK[g] ?? g.slice(0, 1), jumlah: per.get(g) ?? 0 })).filter((z) => z.jumlah > 0);
}

/* KUNCI DENAH — denah kecil di sampul: satu ruang per kategori, lebarnya
   sebanding banyaknya lembar, ruang lembar yang dibuka diarsir. Arsirnya
   satu elemen yang BERPINDAH ruang saat kategori berganti. Tulisan huruf
   ruang ada DI BAWAH denah, tidak pernah di atas arsir (jebakan #70).

   Dipakai juga pratinjau palet perintah (letak lembar yang sedang dipilih
   di set gambar) — di sana DIAM: tanpa `onPilih` ruangnya bukan tombol,
   dan `className` memberinya tinta kertas, bukan tinta sampul. */
export function KunciDenah({
  zona,
  aktif,
  sorot = null,
  onSorot,
  onPilih,
  className,
}: {
  zona: { nama: string; kode: string; jumlah: number }[];
  aktif: string | null;
  sorot?: string | null;
  onSorot?: (n: string | null) => void;
  onPilih?: (n: string) => void;
  className?: string;
}) {
  const total = zona.reduce((s, z) => s + z.jumlah, 0) || 1;
  let kiri = 0;
  const letak = zona.map((z) => {
    const l = { kiri: (kiri / total) * 100, lebar: (z.jumlah / total) * 100 };
    kiri += z.jumlah;
    return l;
  });
  const i = zona.findIndex((z) => z.nama === aktif);
  const kelasRuang = (z: { nama: string }) =>
    ["kl__ruang", z.nama === aktif && "is-aktif", z.nama === sorot && "is-sorot"].filter(Boolean).join(" ");
  return (
    <div className={className ? `kl__denah ${className}` : "kl__denah"}>
      <div
        className="kl__denahruang"
        role={onPilih ? "group" : "img"}
        aria-label={onPilih ? "Kunci denah — lompat ke kategori" : `Kunci denah — ${aktif ?? "di luar daftar"}`}
      >
        {zona.map((z) =>
          onPilih ? (
            <button
              key={z.nama}
              type="button"
              className={kelasRuang(z)}
              style={{ flexGrow: z.jumlah }}
              aria-label={`${z.nama}, ${z.jumlah} lembar`}
              aria-current={z.nama === aktif ? "true" : undefined}
              title={`${z.nama} · ${z.jumlah} lembar`}
              onClick={() => onPilih(z.nama)}
              onPointerEnter={(e) => e.pointerType === "mouse" && onSorot?.(z.nama)}
              onPointerLeave={(e) => e.pointerType === "mouse" && onSorot?.(null)}
              onFocus={() => onSorot?.(z.nama)}
              onBlur={() => onSorot?.(null)}
            />
          ) : (
            <span key={z.nama} className={kelasRuang(z)} style={{ flexGrow: z.jumlah }} />
          ),
        )}
        {i >= 0 && (
          <span
            className="kl__arsir"
            aria-hidden="true"
            style={{ left: `calc(${letak[i]!.kiri}% + 3px)`, width: `calc(${letak[i]!.lebar}% - 6px)` }}
          />
        )}
      </div>
      <div className="kl__denahhuruf" aria-hidden="true">
        {zona.map((z) => (
          <span key={z.nama} style={{ flexGrow: z.jumlah }} className={z.nama === aktif ? "is-aktif" : z.nama === sorot ? "is-sorot" : undefined}>
            {z.kode}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RelKit({ path, namaStudio, revisi: capBuild }: PropRelKit) {
  const kini = rapi(path);
  /* Peran, akun, dan angka revisi datang SESUDAH hidrasi: rel ini dirender
     statis. Dibaca di efek, bukan saat render (jebakan #8). */
  const fitur = useFiturAkun();
  const [akun, setAkun] = useState<{ nama: string; email: string; peran: string; foto: string | null } | null>(null);
  const [revisi, setRevisi] = useState<Record<string, number>>({});
  useEffect(() => {
    const p = profilTersimpan();
    const pasangAkun = (q: Profil | null) => {
      if (q) setAkun({ nama: namaTampilan(q), email: q.email, peran: labelPeran(q), foto: q.avatarUrl ?? null });
    };
    pasangAkun(p);
    const awal = barisNotifikasiTerakhir();
    if (awal) setRevisi(revisiPerHalaman(awal));
    /* Peran ikut profil yang disegarkan /me — bukan cuma kartu akunnya. Tanpa
       itu kop menulis "Staf" sementara daftar masih memuat lembar master. */
    const dengarProfil = (e: Event) => {
      const q = (e as CustomEvent<Profil>).detail;
      pasangAkun(q);
    };
    const dengarRevisi = (e: Event) => setRevisi((e as CustomEvent<Record<string, number>>).detail);
    window.addEventListener(PERISTIWA_REVISI, dengarRevisi);
    window.addEventListener(PERISTIWA_PROFIL, dengarProfil);
    return () => {
      window.removeEventListener(PERISTIWA_REVISI, dengarRevisi);
      window.removeEventListener(PERISTIWA_PROFIL, dengarProfil);
    };
  }, []);
  /* Halaman "<daftar>/satu" menyalakan daftarnya. Persis, bukan startsWith:
     "/admin/pengaturan" awalan dari "/admin/pengaturan/akun". */
  const cocok = (href: string) => rapi(href) === kini || `${rapi(href)}/satu` === kini;

  /* Kelompok yang terbuka: bawaannya kelompok halaman yang dibuka (dihitung
     dari `path`, jadi server dan klien sepakat), sesudahnya pilihan staf —
     bertahan lintas halaman karena rel ini `transition:persist`. */
  const grupAktif = NAV.find((n) => n.children?.some((c) => cocok(c.href)))?.label;
  const [terbuka, setTerbuka] = useState<string[]>(() => (grupAktif ? [grupAktif] : []));
  useEffect(() => {
    if (grupAktif) setTerbuka((t) => (t.includes(grupAktif) ? t : [...t, grupAktif]));
  }, [grupAktif]);
  /* Baris yang menyala dibawa ke dalam pandangan daftar tiap pindah halaman —
     hanya sejauh perlu. Bukan scrollIntoView: itu ikut menggulir setiap
     leluhur, termasuk laci ponsel. `master` ikut: baris khusus master baru
     muncul sesudah peran dibaca dan mendorong baris di bawahnya. */
  useEffect(() => {
    const baris = document.querySelector<HTMLElement>(`#${ID_REL} .k-nav[aria-current="page"]`);
    const daftar = baris?.closest<HTMLElement>(".k-sisi__daftar");
    if (!baris || !daftar || daftar.scrollHeight <= daftar.clientHeight) return;
    const b = baris.getBoundingClientRect();
    const d = daftar.getBoundingClientRect();
    if (b.top < d.top) daftar.scrollTop -= d.top - b.top + 8;
    else if (b.bottom > d.bottom) daftar.scrollTop += b.bottom - d.bottom + 8;
  }, [kini, fitur]);
  const lipat = (label: string) => setTerbuka((t) => (t.includes(label) ? t.filter((x) => x !== label) : [...t, label]));

  /* Lembar yang TAMPIL untuk peran ini; nomornya tetap dari NAV lengkap. */
  const tampil = lembarTampil(fitur);
  const perKelompok = new Map<string, number>();
  for (const l of tampil) perKelompok.set(l.kelompok, (perKelompok.get(l.kelompok) ?? 0) + 1);

  /* REV per nomor lembar: halaman tujuan tiap butir notifikasi dipetakan ke
     lembarnya (persis, atau awalan terpanjang — "/admin/proyek/edit" milik
     Semua Proyek). */
  const revKode = revisiPerLembar(revisi);

  const item: ItemNav[] = navTampil(fitur).map((n) => {
    const anak = n.children?.map((c) => {
      const kode = KODE_HALAMAN.get(rapi(c.href));
      return {
        ikon: ikonNav(c.ikonKit, c.label),
        label: c.label,
        href: c.href,
        aktif: cocok(c.href),
        kode,
        jumlah: kode ? revKode.get(kode) : undefined,
        jumlahJudul: "perlu ditangani",
      };
    });
    const terbukaIni = anak ? terbuka.includes(n.label) : undefined;
    const kode = n.href ? KODE_HALAMAN.get(rapi(n.href)) : LEMBAR.induk.get(n.label);
    return {
      ikon: ikonNav(n.ikonKit, n.label),
      label: n.label,
      href: n.href,
      aktif: n.href ? cocok(n.href) : false,
      anak,
      terbuka: terbukaIni,
      onLipat: anak ? () => lipat(n.label) : undefined,
      /* Induk tertutup memikul revisi seluruh serinya; yang terbuka tidak —
         anak-anaknya sudah menuliskannya sendiri. */
      jumlah: anak ? (terbukaIni ? undefined : anak.reduce((s, a) => s + (a.jumlah ?? 0), 0)) : kode ? revKode.get(kode) : undefined,
      jumlahJudul: "perlu ditangani",
      kelompok: n.group,
      kode,
      kelompokKode: KODE_KELOMPOK[n.group],
      kelompokJumlah: perKelompok.get(n.group) ?? 0,
      indukAktif: Boolean(anak?.some((a) => a.aktif)) && !terbukaIni,
    };
  });

  /* Lembar yang dibuka — kop dan kunci denah. */
  const { dibuka, keterangan } = posisiLembar(kini, tampil);
  const jam = useJam(true);
  const [studio, setStudio] = useState<Pick<StudioSettings, "timezone" | "logoUrl" | "studioName"> | null>(null);
  useEffect(() => {
    /* Kunci `settings` milik Info Studio — di sini cuma DIBACA (jebakan #8);
       kalau belum ada, diambil sekali per muat penuh. */
    const tersimpan = bacaCache<StudioSettings>("settings");
    if (tersimpan) {
      setStudio(tersimpan);
      return;
    }
    let hidup = true;
    ambilSettings()
      .then((st) => hidup && setStudio(st))
      .catch(() => {});
    return () => {
      hidup = false;
    };
  }, []);
  const waktu = jam ? jamStudio(jam, studio?.timezone) : null;
  const [logoGagal, setLogoGagal] = useState(false);
  const nama = studio?.studioName || namaStudio || "Studio";
  const rev = tanggalRevisi(capBuild);

  /* Nomor kop menggulung masuk hanya saat PINDAH HALAMAN — bukan saat peran
     terbaca dan baris khusus master muncul (jebakan #74). Disetel sebelum
     dicat supaya nomor barunya tidak sempat tergambar diam satu bingkai. */
  const kodeDibuka = dibuka?.lembar.kode ?? "-";
  const lalu = useRef({ path: kini, kode: kodeDibuka });
  const [gulung, setGulung] = useState<string | null>(null);
  useEfekTataLetak(() => {
    const l = lalu.current;
    if (l.kode === kodeDibuka) return;
    lalu.current = { path: kini, kode: kodeDibuka };
    if (l.path !== kini) setGulung(kodeDibuka);
  }, [kodeDibuka, kini]);

  /* Kunci denah ↔ daftar: ruang yang ditunjuk menyorot kepala kategorinya;
     ruang yang diklik menggulir daftar ke sana dan mengedipkan kepalanya. */
  const [sorot, setSorot] = useState<string | null>(null);
  const [kedip, setKedip] = useState<string | null>(null);
  const kedipWaktu = useRef(0);
  const lompat = (kelompok: string) => {
    const kepala = document.querySelector<HTMLElement>(`#${ID_REL} .k-sisi__kelompok[data-kelompok="${kelompok}"]`);
    const daftar = kepala?.closest<HTMLElement>(".k-sisi__daftar");
    if (!kepala || !daftar) return;
    /* Di laci ponsel yang bergulir relnya, bukan daftarnya. */
    const penggulir = daftar.scrollHeight > daftar.clientHeight + 1 ? daftar : document.getElementById(ID_REL);
    if (penggulir) {
      const top = kepala.getBoundingClientRect().top - penggulir.getBoundingClientRect().top + penggulir.scrollTop - 6;
      penggulir.scrollTo({ top, behavior: gerakBoleh() ? "smooth" : "auto" });
    }
    setKedip(kelompok);
    window.clearTimeout(kedipWaktu.current);
    kedipWaktu.current = window.setTimeout(() => setKedip(null), 1200);
  };
  useEffect(() => () => window.clearTimeout(kedipWaktu.current), []);
  const zona = zonaDenah(tampil);

  const [buka, setBuka] = useState(false);
  useEffect(() => {
    const ubah = (e: Event) => {
      const d = (e as CustomEvent<boolean | undefined>).detail;
      setBuka((b) => (typeof d === "boolean" ? d : !b));
    };
    const tanya = () => window.dispatchEvent(new CustomEvent(PERISTIWA_REL_KEADAAN, { detail: bukaRef.v }));
    const ubahAtauTanya = (e: Event) => ((e as CustomEvent).detail === "tanya" ? tanya() : ubah(e));
    /* Menutup saat pindah halaman — di before-preparation, supaya menutupnya
       terasa seketika saat menu diklik. */
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
    /* Gulir badan dikunci selama menu terbuka dan fokus pindah ke menu;
       Esc menutup dan mengembalikan fokus ke tombol yang membukanya. */
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
        kelompokSorot={sorot ?? kedip}
        sampul={
          <div className="kl__sampul">
            <div className="kl__sampulatas">
              {studio?.logoUrl && !logoGagal ? (
                <img className="kl__logostudio" src={studio.logoUrl} alt="" decoding="async" onError={() => setLogoGagal(true)} />
              ) : (
                <span className="kl__monogram" aria-hidden="true">
                  {inisial(nama)}
                </span>
              )}
              <b className="kl__logo">{nama}</b>
            </div>
            <p className="kl__sampulket">
              <span>Set gambar · {tampil.length} lembar</span>
              {rev && (
                <span title="Tanggal panel ini terakhir diterbitkan">
                  Rev <b>{rev}</b>
                </span>
              )}
            </p>
            <KunciDenah zona={zona} aktif={dibuka?.lembar.kelompok ?? null} sorot={sorot ?? kedip} onSorot={setSorot} onPilih={lompat} />
          </div>
        }
        item={item}
        kaki={
          <div className="kl__kop">
            <div className="kl__akun">
              {akun ? <Avatar nama={akun.nama} src={akun.foto} ukuran="sm" hiasan /> : <span className="kl__akunkosong" aria-hidden="true" />}
              <span className="kl__akunteks">
                <small className="kl__akunperan">Digambar · {akun?.peran ?? " "}</small>
                <b className="kl__akunnama" title={akun?.email}>
                  {akun?.nama ?? " "}
                </b>
              </span>
              {/* Keluar — simbol pintu denah; daunnya berayun saat disentuh.
                  Sesi DAN cache data dibuang, sesinya dicabut di Supabase,
                  lalu riwayat diganti supaya Kembali tidak membuka panel. */}
              <TombolIkon
                ikon={ArsPintu}
                judul="Keluar"
                jenis="ghost"
                className="kl__keluar"
                onClick={async () => {
                  await keluar();
                  window.location.replace("/admin/masuk");
                }}
              />
            </div>
            {/* Jam baru tergambar sesudah dipasang — waktu build bukan waktu
                pengunjung (jebakan #8). */}
            <dl className="kl__kopsel">
              <div>
                <dt>Lembar</dt>
                <dd>
                  {/* Jendela sebaris: nomor yang menggulung masuk tidak lewat
                      di atas "i / N" di bawahnya. */}
                  <b>
                    <span key={kodeDibuka} className={gulung === kodeDibuka ? "is-gulung" : undefined}>
                      {dibuka?.lembar.kode ?? "—"}
                    </span>
                  </b>
                  <small>{keterangan}</small>
                </dd>
              </div>
              <div>
                <dt>Tanggal</dt>
                <dd>
                  <b>{waktu?.tanggalPendek ?? " "}</b>
                  <small>{waktu?.jam ?? " "}</small>
                </dd>
              </div>
            </dl>
          </div>
        }
      />
      {buka && <div className="k-ov__scrim kl__tirai" data-state="open" aria-hidden="true" onClick={() => setBuka(false)} />}
    </>
  );
}

/* Nilai terakhir, untuk menjawab "tanya" dari luar render. */
const bukaRef = { v: false };
