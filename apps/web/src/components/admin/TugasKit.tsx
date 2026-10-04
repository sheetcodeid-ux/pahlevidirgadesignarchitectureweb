import { KelompokTuas, Kombo, Pilih, Tuas, Bidang } from "../kit/Formulir";
import { IsianTanggal } from "../kit/Formulir";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast } from "../kit/Toast";
import { Dialog } from "../kit/Overlay";
import { SelDua, type KolomTabel } from "../kit/Tabel";
import { Cari, Isian } from "../kit/Isian";
import { Tombol, TombolIkon } from "../kit/Tombol";
import { KartuStatistik } from "../kit/Kartu";
import { Briefcase, Check, Clock, Hourglass, Plus, SpinnerGap, List, GridFour, SpecialCheckSquare } from "../kit/ikon";
import { DaftarKit, PilihTombol, PilihStatus, Inisial, HapusBaris, type NadaStatus } from "./daftarKit";
import {
  daftarTugas,
  tambahTugas,
  ubahTugas,
  hapusTugas,
  daftarProyek,
  daftarTim,
  bacaCache,
  tulisCache,
  type Tugas,
  type Proyek,
  type AnggotaTim,
} from "../../lib/admin";

/* =============================================================================
   Tugas — satu-satunya pintu membuat dan menutup tugas lintas proyek.

   Kerangkanya daftar frame 13 (daftarKit.tsx) dengan tiga kartu statistik
   frame 01 di atasnya. Yang dibawa dari halaman lama tanpa berubah:

   - Tiga angka yang menjawab "apa yang mendesak hari ini" — lewat tenggat,
     sedang berjalan, menunggu klien — bukan jumlah total.
   - Saringan bawaan "yang belum selesai": tugas selesai yang terus menumpuk
     di atas membuat yang mendesak tenggelam.
   - Tanpa tenggat didorong ke BELAKANG saat diurutkan menurut tenggat.
   - Tombol centang satu klik untuk "selesai", yang paling sering dipakai.
   - Proyeknya dipilih di DALAM dialog tambah, seperti Catat Pengeluaran.
   - Tampilan papan per status.
   ============================================================================= */

const STATUS: [string, string, NadaStatus][] = [
  ["belum_mulai", "Belum mulai", "netral"],
  ["berjalan", "Berjalan", "jalan"],
  ["review_internal", "Review internal", "jalan"],
  ["menunggu_klien", "Menunggu klien", "tunggu"],
  ["selesai", "Selesai", "beres"],
];
const LABEL = Object.fromEntries(STATUS.map(([v, l]) => [v, l]));
const NADA = Object.fromEntries(STATUS.map(([v, , n]) => [v, n])) as Record<string, NadaStatus>;
const OPSI_STATUS = STATUS.map(([nilai, label]) => ({ nilai, label }));

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function tanggal(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${BULAN[(m ?? 1) - 1]} ${y}`;
}

function Isi() {
  const toast = useToast();
  const [tugas, setTugas] = useState<Tugas[] | null>(() => bacaCache<Tugas[]>("tugas"));
  /* Dipakai dialog tambah dan saringan. Pelengkap — halaman tetap berguna
     kalau salah satunya gagal, jadi galatnya jatuh ke daftar kosong. */
  const [proyek, setProyek] = useState<Proyek[]>([]);
  const [tim, setTim] = useState<AnggotaTim[]>([]);
  const [cari, setCari] = useState("");
  /* Tuas "lewat tenggat": satu klik untuk pertanyaan yang paling sering —
     apa yang sudah terlambat — tanpa mengubah saringan lain. */
  const [hanyaLewat, setHanyaLewat] = useState(false);
  const [status, setStatus] = useState("aktif");
  const [saringProyek, setSaringProyek] = useState("semua");
  const [pic, setPic] = useState("semua");
  const [urut, setUrut] = useState("tenggat");
  const [tampilan, setTampilan] = useState("tabel");

  function muat() {
    daftarTugas()
      .then((d) => {
        tulisCache("tugas", d);
        setTugas(d);
      })
      .catch(() => setTugas((l) => l ?? []));
  }
  useEffect(() => {
    muat();
    daftarProyek()
      .then(setProyek)
      .catch(() => setProyek([]));
    daftarTim()
      .then(setTim)
      .catch(() => setTim([]));
  }, []);

  const hariIni = new Date().toISOString().slice(0, 10);
  const lewat = (t: Tugas) => t.status !== "selesai" && Boolean(t.dueDate) && t.dueDate!.slice(0, 10) <= hariIni;

  async function ubahStatus(t: Tugas, baru: string) {
    if (baru === t.status) return;
    setTugas((l) => l?.map((x) => (x.id === t.id ? { ...x, status: baru } : x)) ?? l);
    try {
      await ubahTugas(t.id, { status: baru });
      if (baru === "selesai") toast({ judul: "Tugas selesai", keterangan: t.title, nada: "sukses" });
    } catch (e) {
      setTugas((l) => l?.map((x) => (x.id === t.id ? t : x)) ?? l);
      toast({
        judul: "Gagal mengubah status",
        keterangan: (e as Error).message,
        nada: "gagal",
      });
    }
  }

  async function hapus(t: Tugas) {
    setTugas((l) => l?.filter((x) => x.id !== t.id) ?? l);
    try {
      await hapusTugas(t.id);
      toast({ judul: "Tugas dihapus", keterangan: t.title, nada: "sukses" });
    } catch (e) {
      muat();
      toast({
        judul: "Gagal menghapus",
        keterangan: (e as Error).message,
        nada: "gagal",
      });
    }
  }

  const angka = useMemo(() => {
    const belum = (tugas ?? []).filter((t) => t.status !== "selesai");
    return {
      lewat: belum.filter(lewat).length,
      berjalan: belum.filter((t) => t.status === "berjalan").length,
      klien: belum.filter((t) => t.status === "menunggu_klien").length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tugas]);

  const daftarPic = useMemo(
    () => [...new Set((tugas ?? []).map((t) => t.assigneeName).filter((n): n is string => Boolean(n)))].sort(),
    [tugas],
  );

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (tugas ?? [])
      .filter((t) => (status === "aktif" ? t.status !== "selesai" : status === "semua" ? true : t.status === status))
      .filter((t) => !hanyaLewat || lewat(t))
      .filter((t) => saringProyek === "semua" || t.projectId === saringProyek)
      .filter((t) => pic === "semua" || (pic === "tanpa" ? !t.assigneeName : t.assigneeName === pic))
      .filter(
        (t) =>
          !q ||
          [t.title, t.projectTitle, t.assigneeName, LABEL[t.status]].some((v) => (v ?? "").toLowerCase().includes(q)),
      )
      .sort((a, b) => {
        if (urut === "proyek") return (a.projectTitle ?? "").localeCompare(b.projectTitle ?? "", "id");
        if (urut === "judul") return a.title.localeCompare(b.title, "id");
        if (!a.dueDate) return b.dueDate ? 1 : 0;
        if (!b.dueDate) return -1;
        return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
      });
  }, [tugas, cari, status, saringProyek, pic, urut, hanyaLewat]);

  const kolom: KolomTabel[] = [
    { judul: "Tugas", lebar: 460 },
    { judul: "PIC", lebar: 190 },
    { judul: "Tenggat", lebar: 150 },
    { judul: "Status", lebar: 200 },
    { judul: "", lebar: 160 },
  ];

  const tenggatSel = (t: Tugas) =>
    !t.dueDate ? (
      <span className="kd__redup">—</span>
    ) : lewat(t) ? (
      /* Yang lewat ditandai merah DAN kata "lewat" — warna saja tidak
         cukup untuk yang tidak membedakan merah. */
      <span className="kd__lewat">
        <span aria-hidden="true" />
        {tanggal(t.dueDate)} · lewat
      </span>
    ) : (
      tanggal(t.dueDate)
    );

  const baris = tersaring.map((t) => [
    <SelDua atas={t.title} bawah={t.projectTitle ?? "—"} />,
    t.assigneeName ? (
      <div className="kd__sel">
        <Inisial nama={t.assigneeName} />
        <span>{t.assigneeName}</span>
      </div>
    ) : (
      <span className="kd__redup">Belum ditentukan</span>
    ),
    tenggatSel(t),
    <PilihStatus
      judul={`Status ${t.title}`}
      nilai={t.status}
      nada={NADA[t.status] ?? "netral"}
      opsi={OPSI_STATUS}
      onPilih={(v) => ubahStatus(t, v)}
    />,
    <div className="kd__aksi">
      {t.status !== "selesai" && (
        <TombolIkon
          ikon={Check}
          ukuran="small"
          jenis="secondary"
          judul={`Tandai ${t.title} selesai`}
          onClick={() => ubahStatus(t, "selesai")}
        />
      )}
      <TombolIkon
        ikon={Briefcase}
        ukuran="small"
        jenis="ghost"
        judul={`Buka proyek ${t.projectTitle ?? ""}`.trim()}
        href={`/admin/proyek/edit?id=${encodeURIComponent(t.projectId)}`}
      />
      <HapusBaris
        judul="Hapus tugas ini?"
        keterangan={`${t.title}${t.projectTitle ? ` — ${t.projectTitle}` : ""}. Tugas yang dihapus tidak bisa dikembalikan.`}
        label={`Hapus ${t.title}`}
        onHapus={() => hapus(t)}
      />
    </div>,
  ]);

  const papan = (
    <div className="kd-papan">
      {STATUS.filter(([v]) => v !== "selesai").map(([nilai, label, nada]) => {
        const isi = tersaring.filter((t) => t.status === nilai);
        return (
          <section key={nilai} className="kd-papan__kolom" aria-label={label}>
            <header className="kd-papan__kepala">
              <span className="kd-status__titik" data-nada={nada} aria-hidden="true" />
              {label}
              <span className="kd-papan__jumlah">{isi.length}</span>
            </header>
            {isi.length === 0 ? (
              <p className="kd-papan__kosong">Kosong.</p>
            ) : (
              isi.map((t) => (
                <article key={t.id} className="kd-papan__kartu">
                  <span className="kd-papan__proyek">{t.projectTitle}</span>
                  <b>{t.title}</b>
                  <div className="kd-papan__kaki">
                    {t.assigneeName ? <Inisial nama={t.assigneeName} /> : null}
                    <span className="kd-papan__tgl">{tenggatSel(t)}</span>
                    <PilihStatus
                      judul={`Status ${t.title}`}
                      nilai={t.status}
                      nada={NADA[t.status] ?? "netral"}
                      opsi={OPSI_STATUS}
                      onPilih={(v) => ubahStatus(t, v)}
                    />
                  </div>
                </article>
              ))
            )}
          </section>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="kd-angka">
        <KartuStatistik ikon={Clock} judul="Lewat tenggat" nilai={tugas ? angka.lewat : "—"} />
        <KartuStatistik ikon={SpinnerGap} judul="Sedang berjalan" nilai={tugas ? angka.berjalan : "—"} />
        <KartuStatistik ikon={Hourglass} judul="Menunggu klien" nilai={tugas ? angka.klien : "—"} />
      </div>
      <DaftarKit
        kunciSaring={`${cari}|${status}|${saringProyek}|${pic}|${urut}|${hanyaLewat}`}
        kiri={
          <>
            <Cari
              ukuran="medium"
              judul="Cari tugas"
              placeholder="Cari tugas"
              value={cari}
              onChange={(e) => setCari(e.currentTarget.value)}
            />
            <PilihTombol
              judul="Saring status"
              nilai={status}
              onPilih={setStatus}
              opsi={[
                { nilai: "aktif", label: "Belum selesai" },
                ...OPSI_STATUS,
                { nilai: "semua", label: "Semua status" },
              ]}
            />
            <PilihTombol
              judul="Saring proyek"
              nilai={saringProyek}
              onPilih={setSaringProyek}
              opsi={[
                { nilai: "semua", label: "Semua proyek" },
                ...proyek.map((p) => ({ nilai: p.id, label: p.title })),
              ]}
            />
            <PilihTombol
              judul="Saring PIC"
              nilai={pic}
              onPilih={setPic}
              opsi={[
                { nilai: "semua", label: "Semua PIC" },
                ...daftarPic.map((n) => ({ nilai: n, label: n })),
                { nilai: "tanpa", label: "Belum ditentukan" },
              ]}
            />
            <Tuas tekan={hanyaLewat} onUbah={setHanyaLewat} ikon={Clock} className="tg__lewat">
              Lewat tenggat{tugas ? ` (${tugas.filter(lewat).length})` : ""}
            </Tuas>
            <PilihTombol
              judul="Urutkan tugas"
              nilai={urut}
              onPilih={setUrut}
              opsi={[
                { nilai: "tenggat", label: "Tenggat terdekat" },
                { nilai: "proyek", label: "Proyek A–Z" },
                { nilai: "judul", label: "Judul A–Z" },
              ]}
            />
          </>
        }
        kanan={
          <>
            {/* Kelompok Tuas, bukan Segmen: dua tampilan dari isi yang sama,
                dan ikonnya terbaca sebelum labelnya. Selalu tepat satu yang
                menyala — klik pada yang sudah menyala tidak mematikannya. */}
            <KelompokTuas
              label="Tampilan"
              nilai={[tampilan]}
              onUbah={(v) => v[0] && setTampilan(v[0] as typeof tampilan)}
              opsi={[
                { nilai: "tabel", label: "Tabel", ikon: List },
                { nilai: "papan", label: "Papan", ikon: GridFour },
              ]}
            />
            <DialogTugas proyek={proyek} tim={tim} onSelesai={muat} />
          </>
        }
        kolom={kolom}
        baris={baris}
        kunci={tersaring.map((t) => t.id)}
        memuat={tugas === null}
        teksMemuat="Memuat tugas…"
        kosong={tugas && tugas.length > 0 ? "Tidak ada tugas pada saringan ini" : "Belum ada tugas"}
        ketKosong={
          tugas && tugas.length > 0
            ? "Ganti saringan proyek atau PIC di atas."
            : "Tekan Tambah tugas — proyeknya dipilih di dalam dialog."
        }
        ikonKosong={tugas && tugas.length > 0 ? undefined : SpecialCheckSquare}
        satuan="tugas"
        ganti={tampilan === "papan" ? papan : undefined}
      />
    </>
  );
}

/* Satu-satunya pintu membuat tugas. Proyeknya dipilih DI SINI, bukan
   ditentukan oleh halaman mana staf kebetulan berada — bentuk yang sama
   dengan Catat Pengeluaran. */
function DialogTugas({ proyek, tim, onSelesai }: { proyek: Proyek[]; tim: AnggotaTim[]; onSelesai: () => void }) {
  const toast = useToast();
  const [buka, setBuka] = useState(false);
  const [idProyek, setIdProyek] = useState("");
  const [judul, setJudul] = useState("");
  const [orang, setOrang] = useState("");
  const [tenggat, setTenggat] = useState("");
  const [kirim, setKirim] = useState(false);
  const alasan = !idProyek
    ? "Pilih proyeknya dulu."
    : judul.trim().length < 2
      ? "Isi judul tugas, minimal 2 huruf."
      : null;

  function saatBuka(b: boolean) {
    setBuka(b);
    if (b) {
      setIdProyek("");
      setJudul("");
      setOrang("");
      setTenggat("");
    }
  }

  async function simpan() {
    if (alasan) return;
    setKirim(true);
    try {
      await tambahTugas(idProyek, {
        title: judul.trim(),
        assigneeId: orang || null,
        dueDate: tenggat || null,
      });
      setBuka(false);
      onSelesai();
      toast({
        judul: "Tugas ditambahkan",
        keterangan: judul.trim(),
        nada: "sukses",
      });
    } catch (e) {
      toast({
        judul: "Gagal menambah tugas",
        keterangan: (e as Error).message,
        nada: "gagal",
      });
    } finally {
      setKirim(false);
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={saatBuka}
      title="Tambah tugas"
      trigger={
        <Tombol ukuran="medium" jenis="primary" kiri={Plus}>
          Tambah tugas
        </Tombol>
      }
      footer={
        <div className="kd-form__kaki">
          {alasan && <small className="kd-form__alasan">{alasan}</small>}
          <Tombol memuat={kirim} ukuran="large" jenis="primary" disabled={Boolean(alasan) || kirim} onClick={simpan}>
            {kirim ? "Menyimpan…" : "Simpan"}
          </Tombol>
        </div>
      }
    >
      <div className="kd-form">
        <Bidang label="Proyek">
          {(b) => (
            <Kombo
              id={b.id}
              opsi={proyek.map((p) => ({
                nilai: p.id,
                label: p.title,
                ket: p.client || undefined,
              }))}
              nilai={idProyek || undefined}
              onUbah={setIdProyek}
              placeholder="Pilih proyek…"
              cariPlaceholder="Cari proyek atau klien…"
            />
          )}
        </Bidang>
        <Isian
          label="Tugas"
          placeholder="mis. Gambar kerja denah"
          maxLength={200}
          value={judul}
          onChange={(e) => setJudul(e.currentTarget.value)}
        />
        <div className="kd-form__dua">
          {/* Yang nonaktif tidak ditawarkan lagi, tapi namanya tetap
              tercetak di tugas lama. Select kit: perannya tampil sebagai
              keterangan di bawah nama, bukan disambung tanda pisah. */}
          <Bidang label="Penanggung jawab">
            {(b) => (
              <Pilih
                id={b.id}
                nilai={orang || "-"}
                onUbah={(v) => setOrang(v === "-" ? "" : v)}
                opsi={[
                  { nilai: "-", label: "Belum ditentukan" },
                  ...tim
                    .filter((t) => t.active)
                    .map((t) => ({
                      nilai: t.id,
                      label: t.name,
                      ket: t.role || undefined,
                    })),
                ]}
              />
            )}
          </Bidang>
          {/* TANPA batas maksimum hari ini, beda dari tanggal biaya: biaya
              mencatat yang sudah terjadi, tenggat menunjuk yang belum. */}
          <IsianTanggal
            label="Tenggat"
            nilai={tenggat}
            onUbah={setTenggat}
            placeholder="Tanpa tenggat"
          />
        </div>
      </div>
    </Dialog>
  );
}

export function TugasKit() {
  return (
    <RequireAuth skeleton={<div className="kd" aria-busy="true" />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
