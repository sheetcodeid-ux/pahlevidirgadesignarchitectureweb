import { useEffect, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { SkeletonTabel } from "../ui/Skeleton";
import { Avatar } from "../ui/misc/Avatar";
import { Tooltip, TooltipProvider } from "../ui/overlay/Floating";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { DataTable, kolomSkeleton, type Kolom, type Chip } from "../ui/data/DataTable";
import { Dialog, AlertDialog } from "../ui/overlay/Dialog";
import { RequireAuth } from "./RequireAuth";
import {
  daftarTugas, tambahTugas, ubahTugas, hapusTugas, daftarProyek, daftarTim,
  type Tugas, type Proyek, type AnggotaTim,
  bacaCache, tulisCache, jumlahDiingat,
} from "../../lib/admin";
import { Select } from "../ui/overlay/Select";

/* Nilai penanda untuk "belum ditentukan" di dropdown PIC. Select tidak bisa
   memakai string kosong sebagai value — itu nilai yang dipakainya sendiri
   untuk "belum ada yang dipilih". */
const TANPA_PIC = "__tanpa__";
const SEMUA_PROYEK = "semua";

const KOLOM_STATUS: [string, string][] = [
  ["belum_mulai", "Belum mulai"],
  ["berjalan", "Berjalan"],
  ["review_internal", "Review internal"],
  ["menunggu_klien", "Menunggu klien"],
];

const SEMUA_STATUS: [string, string][] = [...KOLOM_STATUS, ["selesai", "Selesai"]];

const LABEL_STATUS: Record<string, string> = Object.fromEntries(SEMUA_STATUS);

const URUTAN: { value: string; label: string }[] = [
  { value: "tenggat", label: "Tenggat terdekat" },
  { value: "proyek", label: "Proyek A–Z" },
  { value: "judul", label: "Judul A–Z" },
];

function formatTanggal(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function Isi() {
  const toast = useToast();
  const [tugas, setTugas] = useState<Tugas[] | null>(() => bacaCache<Tugas[]>("tugas"));
  const [pic, setPic] = useState("semua");
  const [saringProyek, setSaringProyek] = useState(SEMUA_PROYEK);
  const [urut, setUrut] = useState("tenggat");
  const [tampilan, setTampilan] = useState<"tabel" | "kanban">("tabel");
  /* Dipakai dropdown di dialog tambah, dan daftar proyeknya juga jadi
     saringan. Keduanya cuma pelengkap tampilan — halaman tetap berguna
     kalau salah satunya gagal dimuat, jadi galatnya jatuh ke daftar kosong
     dan tidak ada yang dilaporkan ke staf. */
  const [proyek, setProyek] = useState<Proyek[]>([]);
  const [tim, setTim] = useState<AnggotaTim[]>([]);

  function muat() {
    daftarTugas().then((d) => { tulisCache("tugas", d); setTugas(d); }).catch(() => setTugas((l) => l ?? []));
  }

  useEffect(() => {
    muat();
    daftarProyek().then(setProyek).catch(() => setProyek([]));
    daftarTim().then(setTim).catch(() => setTim([]));
  }, []);

  const daftarPic = useMemo(() => {
    if (!tugas) return [];
    const nama = new Set(tugas.map((t) => t.assigneeName).filter((n): n is string => Boolean(n)));
    return Array.from(nama).sort();
  }, [tugas]);

  async function ubahStatus(id: string, status: string) {
    if (!tugas) return;
    const sebelum = tugas;
    setTugas(tugas.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      await ubahTugas(id, { status });
    } catch (e) {
      setTugas(sebelum);
      toast({ judul: "Gagal mengubah status", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function hapus(t: Tugas) {
    if (!tugas) return;
    const sebelum = tugas;
    setTugas(tugas.filter((x) => x.id !== t.id));
    try {
      await hapusTugas(t.id);
      toast({ judul: "Tugas dihapus", nada: "sukses" });
    } catch (e) {
      setTugas(sebelum);
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  const hariIni = new Date().toISOString().slice(0, 10);

  const kolom: Kolom<Tugas>[] = [
    {
      judul: "Tugas",
      render: (t) => (
        <span style={{ minWidth: 0, display: "block" }}>
          <span className="item__title">{t.title}</span>
          <div className="attachment__size">{t.projectTitle}</div>
        </span>
      ),
    },
    {
      judul: "PIC",
      lebar: "6rem",
      render: (t) =>
        t.assigneeName ? (
          <span className="row" style={{ gap: "var(--space-2)", flexWrap: "nowrap" }}>
            <Avatar name={t.assigneeName} size="sm" />
            <span>{t.assigneeName}</span>
          </span>
        ) : "—",
    },
    {
      // Tenggat yang sudah lewat ditandai merah — angka tanggal saja tidak
      // memberi tahu apa pun sampai staf menghitungnya sendiri.
      judul: "Tenggat",
      kelas: "table__num",
      lebar: "5rem",
      render: (t) => {
        const teks = formatTanggal(t.dueDate);
        if (!teks) return "—";
        const lewat = t.status !== "selesai" && t.dueDate! <= hariIni;
        return lewat
          ? <span className="badge badge--brand"><span className="badge__dot" />{teks}</span>
          : teks;
      },
    },
    {
      judul: "Status",
      lebar: "7rem",
      render: (t) => (
        <Select
          ringkas
          ariaLabel={`Ubah status ${t.title}`}
          value={t.status}
          onValueChange={(v) => ubahStatus(t.id, v)}
          options={SEMUA_STATUS.map(([value, label]) => ({ value, label }))}
        />
      ),
    },
    {
      judul: "Aksi",
      kelas: "table__actions",
      lebar: "5rem",
      render: (t) => (
        <span className="table__act">
          <a className="btn btn--secondary btn--icon btn--boxed" href={`/admin/proyek/edit?id=${t.projectId}`}
            aria-label={`Buka proyek ${t.projectTitle}`}>
            <Icon name="project" size={15} />
          </a>
          {/* Menghapus tugas dulu hanya bisa dari tab Tugas di halaman proyek,
              dan tab itu ikut terbuang bersama "Kerja Internal" — jadi
              kemampuannya hilang sama sekali. Dikembalikan di sini, di
              satu-satunya halaman tugas yang tersisa. */}
          <AlertDialog
            destructive
            title="Hapus tugas ini?"
            description={`${t.title}${t.projectTitle ? ` — ${t.projectTitle}` : ""}. Tugas yang dihapus tidak bisa dikembalikan.`}
            confirmLabel="Ya, hapus"
            onConfirm={() => hapus(t)}
            trigger={
              <button type="button" className="btn btn--ghost btn--icon btn--sm btn--hapus"
                aria-label={`Hapus ${t.title}`}>
                <Icon name="trash" size={14} />
              </button>
            }
          />
        </span>
      ),
    },
  ];

  const chips: Chip<Tugas>[] = [
    { id: "aktif", label: "Aktif", cocok: (t) => t.status !== "selesai" },
    ...KOLOM_STATUS.map(([v, l]) => ({ id: v, label: l, cocok: (t: Tugas) => t.status === v })),
    { id: "selesai", label: "Selesai", cocok: (t) => t.status === "selesai" },
  ];

  const tersaring = tugas
    ?.filter((t) => pic === "semua" || t.assigneeName === pic)
    .filter((t) => saringProyek === SEMUA_PROYEK || t.projectId === saringProyek)
    .slice()
    .sort((a, b) => {
      if (urut === "proyek") return (a.projectTitle ?? "").localeCompare(b.projectTitle ?? "", "id");
      if (urut === "judul") return a.title.localeCompare(b.title, "id");
      // Tanpa tenggat berarti tidak mendesak, jadi didorong ke belakang —
      // bukan ke depan, yang akan terjadi kalau null diperlakukan string kosong.
      if (!a.dueDate) return b.dueDate ? 1 : 0;
      if (!b.dueDate) return -1;
      return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
    }) ?? null;

  const pengalih = (
    <div className="viewtoggle" role="group" aria-label="Tampilan daftar">
      <Tooltip label="Tampilan tabel">
        <button type="button" className="viewtoggle__opt"
          aria-pressed={tampilan === "tabel"} aria-label="Tampilan tabel"
          onClick={() => setTampilan("tabel")}>
          <Icon name="list" size={18} />
        </button>
      </Tooltip>
      <Tooltip label="Tampilan kanban">
        <button type="button" className="viewtoggle__opt"
          aria-pressed={tampilan === "kanban"} aria-label="Tampilan kanban"
          onClick={() => setTampilan("kanban")}>
          <Icon name="dashboard" size={18} />
        </button>
      </Tooltip>
    </div>
  );

  function Kanban({ baris }: { baris: Tugas[] }) {
    return (
      <div className="spec-grid" style={{ alignItems: "start" }}>
        {KOLOM_STATUS.map(([nilai, label]) => {
          const isiKolom = baris.filter((t) => t.status === nilai);
          return (
            <div className="card" key={nilai}>
              <div className="card__header">
                <span className="card__titles">
                  <span className="t-subheading">{label}</span>
                  <span className="t-muted">{isiKolom.length} tugas</span>
                </span>
              </div>
              <div className="card__body">
                {isiKolom.length === 0 ? (
                  <p className="t-muted" style={{ margin: 0 }}>Kosong.</p>
                ) : (
                  <ul className="stack" style={{ gap: "var(--space-3)", listStyle: "none", padding: 0 }}>
                    {isiKolom.map((t) => (
                      <li key={t.id} className="tugas-kartu">
                        <span className="t-label" style={{ margin: 0 }}>{t.projectTitle}</span>
                        <span>{t.title}</span>
                        <div className="row row--between">
                          <span className="row" style={{ gap: "var(--space-2)" }}>
                            {t.assigneeName && <Avatar name={t.assigneeName} size="sm" />}
                            {formatTanggal(t.dueDate) && (
                              <span className="t-mono t-muted" style={{ fontSize: "var(--text-xs)" }}>
                                {formatTanggal(t.dueDate)}
                              </span>
                            )}
                          </span>
                          <Select
                            ringkas
                            ariaLabel={`Ubah status ${t.title}`}
                            value={t.status}
                            onValueChange={(v) => ubahStatus(t.id, v)}
                            options={SEMUA_STATUS.map(([value, label]) => ({ value, label }))}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <DataTable
      data={tersaring}
      kunci={(t) => t.id}
      kolom={kolom}
      chips={chips}
      tampilan={pengalih}
      gantiIsi={tampilan === "kanban" ? (baris) => <Kanban baris={baris} /> : undefined}
      cariPada={(t) => [t.title, t.projectTitle, t.assigneeName, LABEL_STATUS[t.status]]}
      placeholderCari="Cari judul tugas, proyek, atau PIC…"
      labelCari="Cari kerjaan"
      satuan="kerjaan"
      barisSkeleton={jumlahDiingat("tugas", 6)}
      bentuk="kartu"
      /* Satu-satunya pintu membuat tugas. Sebelumnya pintunya ada di tab
         Tugas milik tiap halaman proyek — dan tab itu ikut terbuang bersama
         "Kerja Internal", sehingga tugas tidak bisa dibuat sama sekali.
         Proyeknya dipilih di dalam dialog, pola yang sama dengan Catat
         pengeluaran di Keuangan. */
      aksi={<DialogTugas proyek={proyek} tim={tim} onSelesai={muat} />}
      saringan={
        <>
          <div className="field">
            <label className="field__label">Proyek</label>
            {/* Menggantikan tab Tugas per-proyek yang dibuang: pertanyaan
                "apa saja yang belum beres di proyek ini" tetap bisa dijawab,
                tanpa halaman kedua yang isinya sama. */}
            <Select
              ariaLabel="Saring proyek"
              value={saringProyek}
              onValueChange={setSaringProyek}
              options={[
                { value: SEMUA_PROYEK, label: "Semua proyek" },
                ...proyek.map((p) => ({ value: p.id, label: p.title })),
              ]}
            />
          </div>
          <div className="field">
            <label className="field__label">Urutkan</label>
            <Select ariaLabel="Urutkan kerjaan" options={URUTAN} value={urut} onValueChange={setUrut} />
          </div>
          <div className="field">
            <label className="field__label">PIC</label>
            <Select
              ariaLabel="Saring PIC"
              value={pic}
              onValueChange={setPic}
              options={[{ value: "semua", label: "Semua PIC" }, ...daftarPic.map((n) => ({ value: n, label: n }))]}
            />
          </div>
        </>
      }
      bersihkanAktif={urut !== "tenggat" || pic !== "semua" || saringProyek !== SEMUA_PROYEK}
      onBersihkan={() => { setUrut("tenggat"); setPic("semua"); setSaringProyek(SEMUA_PROYEK); }}
      kosong={{
        ikon: "checklist",
        judul: "Belum ada kerjaan",
        /* Kalimat lama menunjuk "tab Tugas di halaman tiap proyek" — tab yang
           sudah tidak ada. Keadaan kosong yang menyuruh membuka halaman
           hantu adalah jalan buntu di tempat yang justru paling butuh arah. */
        keterangan: "Tekan Tambah tugas di atas. Proyeknya dipilih di dalam dialog.",
      }}
    />
  );
}

/* ── Dialog tambah tugas ──────────────────────────────────────────────────
 *
 * Satu-satunya pintu membuat tugas. Sebelum ini pintunya ada di tab Tugas
 * milik tiap halaman proyek; tab itu dibuang bersama "Kerja Internal",
 * dan kemampuannya ikut hilang tanpa penggantinya — halaman Tugas malah
 * masih menyuruh membukanya.
 *
 * Bentuknya sengaja sama persis dengan Catat pengeluaran di Keuangan:
 * proyeknya dipilih DI SINI, bukan ditentukan oleh halaman mana staf
 * kebetulan berada.
 */
function DialogTugas(
  { proyek, tim, onSelesai }: { proyek: Proyek[]; tim: AnggotaTim[]; onSelesai: () => void },
) {
  const toast = useToast();
  const [idProyek, setIdProyek] = useState("");
  const [judul, setJudul] = useState("");
  const [penanggungJawab, setPenanggungJawab] = useState("");
  const [tenggat, setTenggat] = useState("");
  const [kirim, setKirim] = useState(false);
  /* Dialog dikendalikan, bukan dibiarkan Radix yang mengurus sendiri: footer
     `Dialog` dirender apa adanya tanpa RDialog.Close, jadi tombol Simpan
     menyimpan TAPI dialognya tetap terbuka. Akibatnya bukan cuma canggung —
     staf yang mengira belum tersimpan menekan Simpan sekali lagi dan tugasnya
     tercatat dua kali. Pola ini sama dengan Direktori dan Tim. */
  const [buka, setBuka] = useState(false);

  const siap = Boolean(idProyek) && judul.trim().length >= 2;

  async function simpan() {
    if (!siap) return;
    setKirim(true);
    try {
      await tambahTugas(idProyek, {
        title: judul.trim(),
        assigneeId: penanggungJawab || null,
        dueDate: tenggat || null,
      });
      setJudul(""); setPenanggungJawab(""); setTenggat(""); setIdProyek("");
      setBuka(false);
      onSelesai();
      toast({ judul: "Tugas ditambahkan", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menambah tugas", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setKirim(false);
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={setBuka}
      title="Tambah tugas"
      description="Pilih proyeknya di sini — tidak perlu membuka halaman proyeknya dulu."
      trigger={
        <button type="button" className="btn btn--primary btn--lift">
          <Icon name="plus" size={15} />Tambah tugas
        </button>
      }
      footer={
        <button type="button" className="btn btn--primary" disabled={!siap || kirim} onClick={simpan}>
          {kirim && <span className="spinner spinner--sm spinner--on-action" />}Simpan
        </button>
      }
    >
      <div className="stack">
        <div className="field">
          <label className="field__label" htmlFor="tg-proyek">
            Proyek<span className="field__req" aria-hidden="true">*</span>
          </label>
          <Select
            id="tg-proyek"
            ariaLabel="Proyek"
            value={idProyek}
            onValueChange={setIdProyek}
            placeholder="Pilih proyek…"
            options={proyek.map((p) => ({ value: p.id, label: p.title }))}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="tg-judul">
            Tugas<span className="field__req" aria-hidden="true">*</span>
          </label>
          <input id="tg-judul" className="input" value={judul}
            onChange={(e) => setJudul(e.target.value)} placeholder="Contoh: Gambar kerja denah" />
        </div>

        <div className="spec-grid spec-grid--rapat">
          <div className="field">
            <label className="field__label" htmlFor="tg-pic">Penanggung jawab</label>
            <Select
              id="tg-pic"
              ariaLabel="Penanggung jawab"
              value={penanggungJawab || TANPA_PIC}
              onValueChange={(v) => setPenanggungJawab(v === TANPA_PIC ? "" : v)}
              options={[
                { value: TANPA_PIC, label: "Belum ditentukan" },
                /* Yang sudah tidak aktif tidak ditawarkan lagi, tapi namanya
                   tetap tercetak di tugas lama — disembunyikan dari dropdown,
                   bukan dihapus dari riwayat. */
                ...tim.filter((t) => t.active).map((t) => ({
                  value: t.id, label: t.role ? `${t.name} — ${t.role}` : t.name,
                })),
              ]}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="tg-tenggat">Tenggat</label>
            {/* TANPA `max` hari ini, beda dari tanggal biaya: biaya mencatat
                yang sudah terjadi, tenggat menunjuk yang belum. */}
            <input id="tg-tenggat" className="input input--ringkas" type="date" value={tenggat}
              onChange={(e) => setTenggat(e.target.value)} />
            <p className="field__help">Boleh dikosongkan.</p>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

/* "kartu" wajib ikut disebut: bentuk itu tidak punya kolom nomor, dan
   skeleton yang masih memakainya membuat tiap sel bergeser satu kolom saat
   data tiba — seluruh tabel tampak melompat. */
const KOLOM_TIRUAN = kolomSkeleton<Tugas>([
  { judul: "Tugas", render: () => null },
  { judul: "PIC", lebar: "6rem", render: () => null },
  { judul: "Tenggat", kelas: "table__num", lebar: "5rem", render: () => null },
  { judul: "Status", lebar: "7rem", render: () => null },
  { judul: "Aksi", kelas: "table__actions", lebar: "5rem", render: () => null },
], "kartu");

export function TaskBoard() {
  return (
    <RequireAuth
      skeleton={
        <div className="kartudaftar">
          <SkeletonTabel baris={jumlahDiingat("tugas", 6)} kolom={KOLOM_TIRUAN} />
        </div>
      }
    >
      <ToastProvider><TooltipProvider><Isi /></TooltipProvider></ToastProvider>
    </RequireAuth>
  );
}
