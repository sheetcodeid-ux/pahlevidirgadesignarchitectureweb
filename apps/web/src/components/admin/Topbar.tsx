import { useCallback, useEffect, useRef, useState } from "react";
import * as RPopover from "@radix-ui/react-popover";
import { Command as Cmdk } from "cmdk";
import { Icon } from "../ui/Icon";
import { Avatar } from "../ui/misc/Avatar";
import { ThemeToggle } from "../ui/ThemeToggle";
import { Perintah } from "./Perintah";
import { IsiNotifikasi, TabNotifikasi } from "./NotifikasiPanel";
import { ambilNotifikasi, type BarisNotifikasi } from "../../lib/notifikasi";
import { bukaProyek, setProyekAktif, proyekAktif, onProyekAktif } from "../../lib/proyekAktif";
import {
  ambilSettings, profilTersimpan, hapusSesi, singkatanZona,
  statusTerbit, terbitkanSitus, PERISTIWA_TULIS,
  type Profil, type Proyek, type StudioSettings,
} from "../../lib/admin";

/**
 * Jam yang berdetak, dibaca dalam zona waktu studio.
 *
 * Intl.DateTimeFormat dengan timeZone, bukan menggeser Date dengan selisih
 * jam: pergeseran manual mengasumsikan offsetnya tetap, dan itu asumsi yang
 * runtuh di zona mana pun yang punya daylight saving. Ketiga zona Indonesia
 * memang tidak punya — tapi kode yang benar karena kebetulan tetap salah.
 */
function Jam({ zona }: { zona: string }) {
  const [kini, setKini] = useState<Date | null>(null);

  useEffect(() => {
    setKini(new Date());
    // Didetakkan tiap 10 detik, bukan tiap detik: yang tampil hanya jam dan
    // menit, jadi 59 dari 60 pembaruan per menit tidak mengubah apa pun.
    const t = setInterval(() => setKini(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);

  // Sebelum mount, tidak ada yang dirender: jam server dan jam browser hampir
  // pasti berbeda, dan React akan mengeluh soal hidrasi yang tidak cocok.
  if (!kini) return <span className="topbar__jam" />;

  const jam = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: zona,
  }).format(kini).replace(":", ".");

  return (
    <span className="topbar__jam">
      <span className="topbar__titik" aria-hidden="true" />
      <span className="t-mono">{jam}</span>
      <span className="topbar__zona">{singkatanZona(zona)}</span>
    </span>
  );
}

function Tanggal({ zona }: { zona: string }) {
  const [kini, setKini] = useState<Date | null>(null);

  useEffect(() => {
    setKini(new Date());
    const t = setInterval(() => setKini(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!kini) return <span className="topbar__tanggal" />;

  // Tanpa tahun. Topbar dilihat puluhan kali sehari oleh orang yang tahu
  // sekarang tahun berapa; angka tahun cuma menambah lebar tanpa menambah
  // keterangan. Sesuai referensi pemilik.
  const teks = new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", timeZone: zona,
  }).format(kini);

  return <span className="topbar__tanggal">{teks}</span>;
}

/**
 * Teks yang menggeser sendiri kalau tidak muat, dan diam kalau muat.
 *
 * Overflow tidak bisa dideteksi CSS, jadi diukur sekali setelah render lalu
 * ditandai lewat atribut — animasinya sendiri tetap CSS. Alternatifnya
 * melebarkan daftar mengikuti judul terpanjang, dan itu membuat lebar daftar
 * berubah-ubah mengikuti isi proyek: hal yang tidak bisa diperkirakan
 * siapa pun yang memakainya.
 */
function TeksGeser({ children }: { children: string }) {
  const luar = useRef<HTMLSpanElement>(null);
  const [panjang, setPanjang] = useState(false);

  useEffect(() => {
    const el = luar.current;
    if (!el) return;
    const dalam = el.firstElementChild as HTMLElement | null;
    if (!dalam) return;
    setPanjang(dalam.scrollWidth > el.clientWidth + 1);
  }, [children]);

  return (
    <span className="geser" ref={luar} data-panjang={panjang || undefined} title={children}>
      <span className="geser__isi">{children}</span>
    </span>
  );
}

/** Lonceng dengan badge berangka dan popover berisi daftar yang sama. */
function Lonceng({
  notif, milestone,
}: { notif: BarisNotifikasi[] | null; milestone: BarisNotifikasi[] | null }) {
  const [tab, setTab] = useState<"notifikasi" | "milestone">("notifikasi");
  const jumlah = notif?.length ?? 0;
  const isi = tab === "notifikasi" ? notif : milestone;

  return (
    <RPopover.Root>
      <RPopover.Trigger asChild>
        <button
          type="button"
          className="topbar__lonceng"
          aria-label={jumlah > 0 ? `Notifikasi, ${jumlah} belum dibaca` : "Notifikasi"}
        >
          <Icon name="bell" size={18} />
          {jumlah > 0 && (
            <span className="topbar__badge" aria-hidden="true">{jumlah > 99 ? "99+" : jumlah}</span>
          )}
        </button>
      </RPopover.Trigger>

      {/* Jangkar, bukan tombolnya sendiri. Dengan align="end" pada tombol,
          tepi kanan popover berhenti di tepi kanan lonceng — sementara panel
          akun berhenti di tepi kanan topbar, karena ia segmen terakhir.
          Keduanya jadi tidak sejajar. Jangkar ini menempel ke tepi kanan
          topbar, jadi kedua panel berangkat dari garis yang sama persis. */}
      <RPopover.Anchor asChild>
        <span className="topbar__jangkar" aria-hidden="true" />
      </RPopover.Anchor>

      <RPopover.Portal>
        <RPopover.Content className="notifpop" sideOffset={10} align="end" collisionPadding={12}>
          <div className="notifpop__kepala">
            <span className="t-subheading">Notifikasi</span>
            <p className="t-muted">
              {jumlah === 0 ? "Semua sudah dibaca" : `${jumlah} belum dibaca`}
            </p>
            <TabNotifikasi tab={tab} setTab={setTab} blok />
          </div>

          <div className="notifpop__badan">
            <IsiNotifikasi baris={isi} tab={tab} ringkas />
          </div>

          <a className="notifpop__kaki" href="/admin/notifikasi">
            Buka semua notifikasi<Icon name="chevronRight" size={15} />
          </a>
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}

/** Identitas studio tanpa rectangle; diklik membuka panel akun. */
function Identitas({ settings, profil, zona }: { settings: StudioSettings | null; profil: Profil | null; zona: string }) {
  const nama = settings?.studioName ?? "Studio";
  const peran = profil?.isMasterAdmin ? "Master admin" : "Staf";
  // Sapaan memakai kata pertama nama studio, seperti "Halo, Bintang." di
  // referensi — bukan seluruh namanya, yang di sini panjang dan membuat
  // sapaannya terbaca sebagai judul, bukan sapaan.
  const sapaan = nama.split(" ")[0];

  return (
    <RPopover.Root>
      <RPopover.Trigger asChild>
        {/* Nama studio TIDAK ditulis di sini lagi.
            Sidebar sudah menuliskannya utuh dan permanen 270px di sebelah
            kiri, jadi yang di bilah ini salinan kedua — dan salinan itu
            terpotong jadi "Dirga Pahlevi Archit…" di SETIAP lebar sejak
            bilahnya dibuat, karena ia butuh 194px sementara batasnya 160px.
            Melebarkan batasnya memang memuat namanya, tapi ruangnya diambil
            dari combobox proyek di sebelahnya, yang lalu terpotong jadi
            "Semua Proye" — dan yang itu fungsional, bukan hiasan: ia yang
            memberi tahu proyek mana yang sedang dipilih.
            Yang tersisa justru yang dicari orang saat menekan avatar: akun
            mana yang sedang dipakai. Dengan dua akun penulis, itu satu-
            satunya keterangan di sini yang tidak ada di tempat lain. */}
        <button type="button" className="topbar__id" aria-label={`Menu akun — ${peran}`}>
          <span className="topbar__id-peran">
            <Icon name="crown" size={14} />{peran}
          </span>
          <Icon name="chevronDown" size={15} />
          {/* Avatar SESUDAH labelnya, seperti slot profil Coinest — di sana
              nama duduk di kiri dan potretnya menutup baris di kanan.
              Ukurannya (38px) dan warnanya (mint) diurus CSS, bukan prop:
              ini satu-satunya avatar di panel yang memakai mint. */}
          <Avatar name={nama} src={settings?.logoUrl ?? undefined} brand />
        </button>
      </RPopover.Trigger>

      <RPopover.Portal>
        <RPopover.Content className="akunpop" sideOffset={10} align="end" collisionPadding={12}>
          <div className="akunpop__kepala">
            <span className="akunpop__waktu">
              <Tanggal zona={zona} />
              <Jam zona={zona} />
            </span>
            {/* md, bukan lg: panel ini keterangan akun, bukan halaman profil.
                Avatar sebesar lg mengambil sepertiga tinggi panel untuk
                menyampaikan hal yang sudah disampaikan namanya. */}
            <Avatar name={nama} src={settings?.logoUrl ?? undefined} brand size="md" />
            <span className="akunpop__sapa">Halo, {sapaan}.</span>
            <span className="akunpop__email">
              <Icon name="inquiry" size={14} />
              <span>{profil?.email ?? "—"}</span>
            </span>
            <span className="akunpop__peran">
              <Icon name="crown" size={13} />{peran}
            </span>
          </div>

          <a className="akunpop__aksi" href="/admin/pengaturan">
            <Icon name="settings" size={19} />
            <span className="akunpop__aksi-teks">
              <span className="akunpop__aksi-judul">Pengaturan</span>
              <span className="akunpop__aksi-sub">Kelola akun Anda</span>
            </span>
          </a>

          <button
            type="button"
            className="akunpop__aksi akunpop__aksi--keluar"
            onClick={() => { hapusSesi(); window.location.replace("/admin/masuk"); }}
          >
            <Icon name="logout" size={19} />
            <span className="akunpop__aksi-teks">
              <span className="akunpop__aksi-judul">Keluar</span>
              <span className="akunpop__aksi-sub">Keluar dari akun Anda</span>
            </span>
          </button>
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}

/** Combobox proyek: daftar yang sama dengan halaman Semua Proyek. */
function ComboProyek({ proyek }: { proyek: Proyek[] | null }) {
  const [buka, setBuka] = useState(false);
  const [nilai, setNilai] = useState("");
  const [aktif, setAktif] = useState<string | null>(null);

  // Dibaca setelah mount: HTML yang dikirim server tidak tahu isi
  // localStorage, dan membacanya saat render membuat pass hidrasi pertama
  // berbeda dari HTML-nya.
  useEffect(() => {
    setAktif(proyekAktif());
    return onProyekAktif(setAktif);
  }, []);

  // Kotak ini punya dua pekerjaan: menampilkan proyek yang sedang dibuka, dan
  // mencari yang lain. Judul proyek aktif dipasang sebagai placeholder, bukan
  // sebagai value — kalau jadi value, staf harus menghapusnya dulu setiap
  // kali ingin mencari, padahal mencari justru alasan kotak ini ada.
  const judulAktif = proyek?.find((p) => p.id === aktif)?.title ?? null;

  return (
    <div className="topbar__combo">
      <Cmdk loop shouldFilter>
        <div className="topbar__field">
          <Cmdk.Input
            className="ov-command__input topbar__field-input"
            /* Placeholder judul proyek bukan teks bantuan, melainkan isi —
               jadi ia diberi warna teks penuh, bukan warna redup. */
            /* Tanpa pilihan, yang berlaku memang "Semua" — dan menuliskannya
               jauh lebih jujur daripada "Cari proyek", yang membuat keadaan
               tanpa-pilihan terbaca seperti kotak yang belum diisi. */
            data-terpilih={!nilai ? "" : undefined}
            placeholder={judulAktif ?? "Semua Proyek"}
            title={judulAktif ?? "Semua Proyek"}
            value={nilai}
            onValueChange={setNilai}
            onFocus={() => setBuka(true)}
            // Ditunda satu putaran: klik pada item terjadi SETELAH blur, jadi
            // menutup seketika membuat pilihannya tidak pernah tersampaikan.
            onBlur={() => window.setTimeout(() => setBuka(false), 120)}
          />
          {/* Di sisi KANAN, tempat kaca pembesar duduk di search Coinest.
              Ikonnya di sini ikon proyek, bukan kaca pembesar: kotak ini
              memang mencari, tapi yang pertama dibacanya adalah proyek mana
              yang sedang dibuka. */}
          <Icon name="project" size={18} />
        </div>

        {buka && (
          <Cmdk.List className="topbar__combo-list">
            {proyek === null
              ? <div className="ov-command__empty">Memuat…</div>
              : <Cmdk.Empty className="ov-command__empty">Tidak ada proyek yang cocok.</Cmdk.Empty>}

            {/* "Semua" bukan proyek, jadi ia TIDAK memakai bukaProyek — yang
                dilakukannya justru melepas pilihan. Halaman Keuangan lalu
                menghitung seluruh studio, bukan satu proyek. Ditaruh paling
                atas karena itu keadaan bawaannya. */}
            <Cmdk.Item
              value="Semua proyek seluruh studio"
              className="ov-command__item"
              onSelect={() => { setNilai(""); setBuka(false); setProyekAktif(null); }}
            >
              <Icon name="dashboard" size={15} />
              <TeksGeser>Semua Proyek</TeksGeser>
              <span className="topbar__combo-status">{(proyek ?? []).length}</span>
            </Cmdk.Item>

            {(proyek ?? []).map((p) => (
              <Cmdk.Item
                key={p.id}
                value={`${p.title} ${p.category} ${p.city ?? ""}`}
                className="ov-command__item"
                /* bukaProyek, bukan pindah halaman: kalau sedang berada di
                   salah satu halaman proyek, yang berganti isinya — bukan
                   halamannya. Itu yang membuat combobox ini terasa seperti
                   pengalih konteks, bukan seperti daftar tautan. */
                onSelect={() => {
                  // Kotaknya dikosongkan supaya judul proyek yang baru
                  // dipilih langsung terbaca di placeholder.
                  setNilai("");
                  setBuka(false);
                  bukaProyek(p.id);
                }}
              >
                <Icon name="project" size={15} />
                <TeksGeser>{p.title}</TeksGeser>
                <span className="topbar__combo-status">
                  {p.status === "published" ? "Terbit" : p.status === "draft" ? "Draf" : "Arsip"}
                </span>
              </Cmdk.Item>
            ))}
          </Cmdk.List>
        )}
      </Cmdk>
    </div>
  );
}

/* ── Terbitkan perubahan ─────────────────────────────────────────────────── */

/** "3 menit lalu", "2 jam lalu", "kemarin". Kosong kalau belum ada waktunya. */
function sejak(iso: string, kini: Date): string {
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
function jamTanggal(iso: string, zona: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: zona,
  }).format(new Date(iso)).replace(/\./g, ".").replace(" pukul ", ", ");
}

/**
 * Tombol Terbitkan, beserta alasan keberadaannya.
 *
 * Halaman publik dibekukan saat build (invarian 4 & 5), jadi mengubah data di
 * panel ini TIDAK mengubah situs sampai ada build ulang. Selama ini tidak ada
 * apa pun di panel yang mengatakannya: pemilik mengisi delapan logo klien,
 * membuka situsnya, dan menyimpulkan fiturnya rusak. Datanya benar seluruhnya
 * — yang kurang cuma kalimat ini dan tombol di sebelahnya.
 *
 * Ditaruh di topbar, bukan di editor proyek, karena perubahan yang perlu
 * diterbitkan datang dari mana-mana: jurnal, logo klien, info studio,
 * testimoni. Tombol yang cuma ada di satu halaman berarti staf harus tahu
 * lebih dulu bahwa ia perlu pergi ke halaman itu.
 */
function Terbit({ dibangunPada, aktif, zona }: {
  dibangunPada: string;
  /** undefined = settings belum sampai; false = Worker tidak punya tokennya. */
  aktif: boolean | undefined;
  zona: string;
}) {
  const [berubahPada, setBerubahPada] = useState<string | null | undefined>(undefined);
  const [kirim, setKirim] = useState<"diam" | "kirim" | "jalan" | "tayang">("diam");
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
    // dan topbar tidak ikut dipasang ulang (transition:persist). PERISTIWA_TULIS:
    // staf menulis sesuatu TANPA pindah halaman — menambah logo klien lalu
    // tetap di /admin/klien, misalnya. Tanpa yang kedua, penandanya baru
    // menyala setelah pindah halaman, dan itu justru saat yang paling salah.
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

  return (
    <RPopover.Root>
      <RPopover.Trigger asChild>
        <button
          type="button"
          className="topbar__terbit"
          data-belum={menyala ? "" : undefined}
          aria-label={menyala ? "Terbitkan perubahan yang belum tayang" : "Terbitkan situs"}
        >
          <Icon name="upload" size={18} />
          {menyala && <span className="topbar__terbit-titik" aria-hidden="true" />}
        </button>
      </RPopover.Trigger>

      {/* Jangkar setinggi TOPBAR tapi selebar SEGMEN tombol ini.

          Dua permintaan pemilik yang kelihatannya bertentangan, ternyata
          bicara tentang dua sumbu yang berbeda: "sejajar dengan notifikasi"
          soal garis atas (keduanya turun 10px di bawah topbar), "letak di
          bawah Terbitkan" soal garis samping. Jangkar ini memenuhi keduanya —
          tingginya diambil dari topbar, sisi kanannya dari segmen tombol.

          Tanpa ini, panel menambat ke tombolnya yang cuma 36px dan mulai 15px
          MENIMPA topbar. Terukur: puncaknya 53px sementara panel notifikasi
          78px. */}
      <RPopover.Anchor asChild>
        <span className="topbar__jangkar-segmen" aria-hidden="true" />
      </RPopover.Anchor>

      <RPopover.Portal>
        <RPopover.Content className="terbitpop" sideOffset={10} align="end" collisionPadding={12}>
          <div className="terbitpop__kepala">
            <span className="t-subheading">Terbitkan perubahan</span>
            <p className="t-muted">
              Halaman publik dibekukan saat situs dibangun. Apa pun yang Anda ubah di
              sini baru tampil di situs setelah dibangun ulang.
            </p>
          </div>

          <dl className="terbitpop__waktu">
            <div className="terbitpop__baris">
              <dt><Icon name="globe" size={14} />Situs dibangun</dt>
              <dd>
                <span>{kini ? sejak(dibangunPada, kini) : "—"}</span>
                <span className="terbitpop__jam">{jamTanggal(dibangunPada, zona)}</span>
              </dd>
            </div>
            <div className="terbitpop__baris">
              <dt><Icon name="edit" size={14} />Data diubah</dt>
              <dd>
                {berubahPada
                  ? <>
                      <span>{kini ? sejak(berubahPada, kini) : "—"}</span>
                      <span className="terbitpop__jam">{jamTanggal(berubahPada, zona)}</span>
                    </>
                  : <span className="terbitpop__jam">
                      {berubahPada === undefined ? "Memuat…" : "Belum tercatat"}
                    </span>}
              </dd>
            </div>
          </dl>

          <p className={`terbitpop__status${menyala ? " terbitpop__status--belum" : " terbitpop__status--sama"}`}>
            <Icon name={menyala ? "alert" : "check"} size={15} />
            {kirim === "jalan"
              ? "Situs sedang dibangun ulang. Sekitar satu menit lagi perubahannya tampil."
              : kirim === "tayang"
                ? "Selesai — perubahannya sudah tampil di situs publik."
                : menyala
                  ? "Ada perubahan yang belum tampil di situs publik."
                  : "Situs publik sudah sama dengan data di panel ini."}
          </p>

          {kirim === "jalan" && (
            /* Bar TAK BERTENTU, bukan persentase. Yang berjalan di sini adalah
               GitHub Actions, dan panel ini tidak bisa menanyakan sudah sampai
               langkah mana — persentase apa pun yang saya gambar adalah angka
               karangan. Yang jujur: gerakannya menyatakan "masih jalan", dan
               angka detik di sebelahnya menyatakan sudah berapa lama. */
            <div className="terbitpop__maju">
              <div className="terbitpop__bar" role="progressbar" aria-label="Membangun ulang situs">
                <span />
              </div>
              <span className="terbitpop__maju-jam t-mono">{jamMundur}</span>
            </div>
          )}

          {galat && (
            <p className="terbitpop__galat">
              <Icon name="alert" size={15} />
              {galat}
            </p>
          )}

          {aktif === false ? (
            /* Dikatakan terang-terangan, bukan tombol mati tanpa keterangan:
               yang kurang adalah rahasia GITHUB_DISPATCH_TOKEN di Worker API,
               dan itu hanya bisa dipasang pemiliknya sendiri. */
            <p className="terbitpop__kunci">
              <Icon name="lock" size={15} />
              Tombol ini belum bisa dipakai: Worker API belum punya token GitHub
              untuk memicu build. Sementara itu, situs tetap dibangun ulang otomatis
              setiap kali ada perubahan kode.
            </p>
          ) : (
            <button
              type="button"
              className="btn btn--primary terbitpop__aksi"
              onClick={terbitkan}
              disabled={kirim === "kirim" || kirim === "jalan" || aktif === undefined}
            >
              <Icon name={kirim === "tayang" ? "check" : "upload"} size={16} />
              {kirim === "kirim" ? "Mengirim…"
                : kirim === "jalan" ? "Sedang dibangun…"
                : kirim === "tayang" ? "Sudah tayang"
                : "Terbitkan sekarang"}
            </button>
          )}
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}

export function Topbar({ heading: headingAwal, dibangunPada }: {
  heading: string;
  /** Stempel waktu build, dipanggang ke HTML oleh AdminLayout.astro. */
  dibangunPada: string;
}) {
  /* Topbar memakai transition:persist, jadi prop heading-nya beku di halaman
   * tempat panel pertama kali dibuka. Judulnya dibaca ulang dari
   * data-heading milik <main> setiap kali halaman berganti — satu-satunya
   * sumber yang ikut berganti bersama isinya. */
  const [heading, setHeading] = useState(headingAwal);
  useEffect(() => {
    const perbarui = () => {
      const utama = document.getElementById("konten");
      const judul = utama?.dataset.heading;
      if (judul) setHeading(judul);
    };
    perbarui();
    document.addEventListener("astro:page-load", perbarui);
    return () => document.removeEventListener("astro:page-load", perbarui);
  }, []);

  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [notif, setNotif] = useState<BarisNotifikasi[] | null>(null);
  const [milestone, setMilestone] = useState<BarisNotifikasi[] | null>(null);
  const [proyek, setProyek] = useState<Proyek[] | null>(null);
  const [aktif, setAktif] = useState<number | null>(null);

  useEffect(() => {
    setProfil(profilTersimpan());
    ambilSettings().then(setSettings).catch(() => { /* topbar tetap tampil */ });
    ambilNotifikasi()
      .then((d) => {
        setNotif(d.notifikasi);
        setMilestone(d.milestone);
        setProyek(d.proyek);
        setAktif(d.proyekAktif);
      })
      .catch(() => { setNotif([]); setMilestone([]); setProyek([]); setAktif(0); });
  }, []);

  const zona = settings?.timezone ?? "Asia/Jakarta";

  return (
    <header className="topbar">
      {/* Header Coinest: judul halaman SENDIRIAN di kiri. Baris keterangan
          (tanggal, jam, jumlah proyek) yang sempat ada di bawahnya dibuang —
          framenya tidak punya, dan ketiganya sudah ada di tempat lain: jam
          dan tanggal di panel akun, jumlah proyek di kartu kas. */}
      <p className="topbar__judul">{heading}</p>

      <div className="topbar__kanan">
        {/* Tanpa tombol: tempat kotak carinya sudah dipakai combobox proyek
            di bawah ini. Yang dibawa ke sini cuma pendengar Ctrl/Cmd+K dan
            dialognya — keduanya mati kalau paletnya tidak dipasang sama
            sekali, dan itu yang terjadi begitu kotak cari keluar dari
            sidebar. */}
        <Perintah tanpaTombol />
        <ComboProyek proyek={proyek} />

        {/* Tiga tombol berjarak 10px — jarak tombol ikon Coinest. Tiap
            tombol dibungkus selnya sendiri supaya jangkar popover di
            dalamnya menambat ke TOMBOL itu, bukan ke gerombolnya: tanpa itu
            panel Terbitkan turun di bawah lonceng. */}
        <div className="topbar__alat">
          <span className="topbar__aksi">
            <Terbit dibangunPada={dibangunPada} aktif={settings?.terbitSitusAktif} zona={zona} />
          </span>
          <span className="topbar__aksi"><ThemeToggle /></span>
          <span className="topbar__aksi">
            <Lonceng notif={notif} milestone={milestone} />
          </span>
        </div>

        <Identitas settings={settings} profil={profil} zona={zona} />
      </div>
    </header>
  );
}
