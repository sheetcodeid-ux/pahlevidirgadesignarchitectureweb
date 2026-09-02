import { useEffect, useRef, useState } from "react";
import * as RPopover from "@radix-ui/react-popover";
import { Command as Cmdk } from "cmdk";
import { Icon } from "../ui/Icon";
import { Avatar } from "../ui/misc/Avatar";
import { ThemeToggle } from "../ui/ThemeToggle";
import { IsiNotifikasi, TabNotifikasi } from "./NotifikasiPanel";
import { ambilNotifikasi, type BarisNotifikasi } from "../../lib/notifikasi";
import { bukaProyek, proyekAktif, onProyekAktif } from "../../lib/proyekAktif";
import {
  ambilSettings, profilTersimpan, hapusSesi, singkatanZona,
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
function Identitas({ settings, profil }: { settings: StudioSettings | null; profil: Profil | null }) {
  const nama = settings?.studioName ?? "Studio";
  const peran = profil?.isMasterAdmin ? "Master admin" : "Staf";
  // Sapaan memakai kata pertama nama studio, seperti "Halo, Bintang." di
  // referensi — bukan seluruh namanya, yang di sini panjang dan membuat
  // sapaannya terbaca sebagai judul, bukan sapaan.
  const sapaan = nama.split(" ")[0];

  return (
    <RPopover.Root>
      <RPopover.Trigger asChild>
        <button type="button" className="topbar__id" aria-label="Menu akun">
          <Avatar name={nama} src={settings?.logoUrl ?? undefined} brand size="sm" />
          <span className="topbar__id-teks">
            <span className="topbar__id-nama">{nama}</span>
            <span className="topbar__id-peran">
              <Icon name="crown" size={12} />{peran}
            </span>
          </span>
          <Icon name="chevronDown" size={15} />
        </button>
      </RPopover.Trigger>

      <RPopover.Portal>
        <RPopover.Content className="akunpop" sideOffset={10} align="end" collisionPadding={12}>
          <div className="akunpop__kepala">
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
          <Icon name="project" size={15} />
          <Cmdk.Input
            className="ov-command__input topbar__field-input"
            /* Placeholder judul proyek bukan teks bantuan, melainkan isi —
               jadi ia diberi warna teks penuh, bukan warna redup. */
            data-terpilih={judulAktif && !nilai ? "" : undefined}
            placeholder={judulAktif ?? "Cari proyek"}
            title={judulAktif ?? undefined}
            value={nilai}
            onValueChange={setNilai}
            onFocus={() => setBuka(true)}
            // Ditunda satu putaran: klik pada item terjadi SETELAH blur, jadi
            // menutup seketika membuat pilihannya tidak pernah tersampaikan.
            onBlur={() => window.setTimeout(() => setBuka(false), 120)}
          />
        </div>

        {buka && (
          <Cmdk.List className="topbar__combo-list">
            {proyek === null
              ? <div className="ov-command__empty">Memuat…</div>
              : <Cmdk.Empty className="ov-command__empty">Tidak ada proyek yang cocok.</Cmdk.Empty>}
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

export function Topbar({ heading: headingAwal }: { heading: string }) {
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
      <nav className="breadcrumb topbar__crumb" aria-label="Remah roti">
        <a href="/admin">Admin</a>
        <span className="breadcrumb__sep" aria-hidden="true">/</span>
        <span aria-current="page">{heading}</span>
      </nav>
      <Jam zona={zona} />
      <Tanggal zona={zona} />

      <span className="topbar__hitung">
        <Icon name="project" size={15} />
        <span className="topbar__hitung-label">Proyek :</span>
        <span className="topbar__pil t-mono">{aktif ?? "—"}</span>
      </span>
      <ComboProyek proyek={proyek} />

      {/* Sisi kanan didorong ke ujung; segmen di kiri tetap rapat. */}
      <span className="topbar__dorong" />

      {/* Tombol ikon dibungkus selnya sendiri. Tanpa pembungkus, tombolnya
          ADALAH selnya: lebar tetap 2,25rem sudah termasuk padding, jadi
          lingkarannya menempel rapat ke garis pemisah di kedua sisi sementara
          segmen lain punya napas 12px. Itu yang membuat sisi kanan terbaca
          sesak. */}
      <span className="topbar__aksi"><ThemeToggle /></span>
      {/* Satu-satunya segmen yang masih berbingkai garis. Pemilik memilih
          lonceng, dan itu masuk akal: ia satu-satunya yang isinya berubah
          sendiri tanpa disentuh, jadi ia perlu terbaca sebagai benda, bukan
          sebagai ikon di antara ikon. */}
      <span className="topbar__aksi topbar__aksi--lonceng">
        <Lonceng notif={notif} milestone={milestone} />
      </span>

      <Identitas settings={settings} profil={profil} />
    </header>
  );
}
