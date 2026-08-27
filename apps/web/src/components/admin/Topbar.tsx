import { useEffect, useState } from "react";
import * as RPopover from "@radix-ui/react-popover";
import { Command as Cmdk } from "cmdk";
import * as RDialog from "@radix-ui/react-dialog";
import { Icon } from "../ui/Icon";
import { Avatar } from "../ui/misc/Avatar";
import { ThemeToggle } from "../ui/ThemeToggle";
import { IsiNotifikasi, TabNotifikasi } from "./NotifikasiPanel";
import { ambilNotifikasi, type BarisNotifikasi } from "../../lib/notifikasi";
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

  const teks = new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric", timeZone: zona,
  }).format(kini);

  return <span className="topbar__tanggal">{teks}</span>;
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

      <RPopover.Portal>
        <RPopover.Content className="notifpop" sideOffset={10} align="end" collisionPadding={12}>
          <div className="notifpop__kepala">
            <span className="t-subheading">Notifikasi</span>
            <p className="t-muted">
              {jumlah === 0 ? "Semua sudah dibaca" : `${jumlah} belum dibaca`}
            </p>
            <TabNotifikasi tab={tab} setTab={setTab} />
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
            <Avatar name={nama} src={settings?.logoUrl ?? undefined} brand size="lg" />
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

  return (
    <div className="topbar__combo">
      <Cmdk loop shouldFilter>
        <div className="topbar__combo-field">
          <Icon name="project" size={15} />
          <Cmdk.Input
            className="topbar__combo-input"
            placeholder="Buka proyek…"
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
                onSelect={() => { window.location.href = `/admin/proyek/edit?id=${p.id}`; }}
              >
                <Icon name="project" size={15} />
                <span className="topbar__combo-judul">{p.title}</span>
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

/** Command palette: perintah cepat, dibuka lewat tombol atau Ctrl/Cmd+K. */
function Perintah({ proyek }: { proyek: Proyek[] | null }) {
  const [buka, setBuka] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setBuka((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const halaman: { label: string; ikon: Parameters<typeof Icon>[0]["name"]; ke: string }[] = [
    { label: "Dashboard", ikon: "dashboard", ke: "/admin" },
    { label: "Semua Proyek", ikon: "project", ke: "/admin/proyek" },
    { label: "Tambah Proyek", ikon: "projectPlus", ke: "/admin/proyek/baru" },
    { label: "List Kerjaan", ikon: "checklist", ke: "/admin/list-kerjaan" },
    { label: "Keuangan", ikon: "finance", ke: "/admin/keuangan" },
    { label: "Pesan Masuk", ikon: "inquiry", ke: "/admin/pesan" },
    { label: "Tim & Freelancer", ikon: "team", ke: "/admin/tim" },
    { label: "Direktori", ikon: "directory", ke: "/admin/direktori" },
    { label: "Testimoni", ikon: "quote", ke: "/admin/testimoni" },
    { label: "Notifikasi", ikon: "bell", ke: "/admin/notifikasi" },
    { label: "Info Studio", ikon: "settings", ke: "/admin/pengaturan" },
  ];

  return (
    <RDialog.Root open={buka} onOpenChange={setBuka}>
      <RDialog.Trigger asChild>
        <button type="button" className="topbar__perintah" aria-label="Perintah cepat">
          <Icon name="terminal" size={16} />
          <span className="topbar__perintah-label">Perintah</span>
          <kbd className="topbar__kbd">⌘K</kbd>
        </button>
      </RDialog.Trigger>

      <RDialog.Portal>
        <RDialog.Overlay className="ov-scrim" />
        <RDialog.Content className="ov-dialog ov-panel" aria-label="Perintah cepat">
          <RDialog.Title className="sr-only">Perintah cepat</RDialog.Title>
          <Cmdk className="ov-command" loop>
            <div className="ov-command__search">
              <Icon name="search" size={18} />
              <Cmdk.Input className="ov-command__input" placeholder="Cari halaman atau proyek…" autoFocus />
              <kbd className="ov-menu__shortcut">ESC</kbd>
            </div>

            <Cmdk.List className="ov-command__list">
              <Cmdk.Empty className="ov-command__empty">Tidak ada yang cocok.</Cmdk.Empty>

              <Cmdk.Group heading="Halaman" className="ov-command__group">
                {halaman.map((h) => (
                  <Cmdk.Item key={h.ke} className="ov-command__item"
                    onSelect={() => { window.location.href = h.ke; }}>
                    <Icon name={h.ikon} size={16} />{h.label}
                  </Cmdk.Item>
                ))}
              </Cmdk.Group>

              {(proyek ?? []).length > 0 && (
                <Cmdk.Group heading="Proyek" className="ov-command__group">
                  {(proyek ?? []).map((p) => (
                    <Cmdk.Item key={p.id} value={`${p.title} ${p.category}`} className="ov-command__item"
                      onSelect={() => { window.location.href = `/admin/proyek/edit?id=${p.id}`; }}>
                      <Icon name="project" size={16} />{p.title}
                    </Cmdk.Item>
                  ))}
                </Cmdk.Group>
              )}
            </Cmdk.List>
          </Cmdk>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

export function Topbar({ heading }: { heading: string }) {
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
        <span className="topbar__hitung-label">Proyek aktif</span>
        <span className="topbar__pil t-mono">{aktif ?? "—"}</span>
      </span>
      <ComboProyek proyek={proyek} />
      <Perintah proyek={proyek} />

      {/* Sisi kanan didorong ke ujung; segmen di kiri tetap rapat. */}
      <span className="topbar__dorong" />
      <ThemeToggle />
      <Lonceng notif={notif} milestone={milestone} />
      <Identitas settings={settings} profil={profil} />
    </header>
  );
}
