import { useEffect, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { SkeletonTabel } from "../ui/Skeleton";
import { Avatar } from "../ui/misc/Avatar";
import { Tooltip, TooltipProvider } from "../ui/overlay/Floating";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { DataTable, kolomSkeleton, type Kolom, type Chip } from "../ui/data/DataTable";
import { RequireAuth } from "./RequireAuth";
import { daftarTugas, ubahTugas, type Tugas, bacaCache, tulisCache, jumlahDiingat} from "../../lib/admin";
import { Select } from "../ui/overlay/Select";

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
  const [urut, setUrut] = useState("tenggat");
  const [tampilan, setTampilan] = useState<"tabel" | "kanban">("tabel");

  function muat() {
    daftarTugas().then((d) => { tulisCache("tugas", d); setTugas(d); }).catch(() => setTugas((l) => l ?? []));
  }

  useEffect(muat, []);

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
      lebar: "3.5rem",
      render: (t) => (
        <span className="table__act">
          <a className="btn btn--secondary btn--icon btn--boxed" href={`/admin/proyek/edit?id=${t.projectId}`}
            aria-label={`Buka proyek ${t.projectTitle}`}>
            <Icon name="project" size={15} />
          </a>
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
      saringan={
        <>
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
      bersihkanAktif={urut !== "tenggat" || pic !== "semua"}
      onBersihkan={() => { setUrut("tenggat"); setPic("semua"); }}
      kosong={{
        ikon: "checklist",
        judul: "Belum ada kerjaan",
        keterangan: "Tambah tugas dari tab Tugas di halaman tiap proyek.",
      }}
    />
  );
}

const KOLOM_TIRUAN = kolomSkeleton<Tugas>([
  { judul: "Tugas", render: () => null },
  { judul: "PIC", lebar: "6rem", render: () => null },
  { judul: "Tenggat", kelas: "table__num", lebar: "5rem", render: () => null },
  { judul: "Status", lebar: "7rem", render: () => null },
  { judul: "Aksi", kelas: "table__actions", lebar: "3.5rem", render: () => null },
]);

export function TaskBoard() {
  return (
    <RequireAuth
      skeleton={
        <div className="listpage"><div className="listpage__pad">
          <SkeletonTabel baris={jumlahDiingat("tugas", 6)} kolom={KOLOM_TIRUAN} />
        </div></div>
      }
    >
      <ToastProvider><TooltipProvider><Isi /></TooltipProvider></ToastProvider>
    </RequireAuth>
  );
}
