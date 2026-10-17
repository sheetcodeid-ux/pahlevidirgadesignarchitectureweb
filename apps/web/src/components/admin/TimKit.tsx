import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as PE } from "react";
import { RequireAuth } from "./RequireAuth";
import { GagalMuat } from "./gagalMuat";
import { ToastProvider, useToast } from "../kit/Toast";
import { Dialog } from "../kit/Overlay";
import { Cari, Isian, Sakelar } from "../kit/Isian";
import { KelompokRadio } from "../kit/Formulir";
import { Tombol } from "../kit/Tombol";
import { Ikon } from "../kit/Ikon";
import { SorotTeks } from "../kit/Tampilan";
import { ArchiveTray, ChatTeardropDots, NotePencil, Phone, Plus, Trash } from "../kit/ikon";
import { geraknya } from "./hitung";
import { inisial } from "../../lib/nomorDokumen";
import { nomorWa } from "../../lib/telepon";
import { tanya } from "../../lib/tanya";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";
import {
  daftarTim,
  tambahAnggotaTim,
  ubahAnggotaTim,
  hapusAnggotaTim,
  ringkasanBayaranTim,
  penugasanOrang,
  daftarTugas,
  ambilSettings,
  bacaCache,
  tulisCache,
  LABEL_JENIS_ANGGOTA,
  LABEL_PERAN,
  type AnggotaTim,
  type JenisAnggota,
  type PenugasanTim,
  type RingkasanBayaranOrang,
  type StudioSettings,
  type Tugas,
} from "../../lib/admin";

/* =============================================================================
   Tim & Freelancer = BAGAN STRUKTUR ORGANISASI + LEMBAR DATA PERSONIL.

   Di dokumen penawaran konsultan perencana, tim selalu disajikan dua kali:
   sebagai BAGAN STRUKTUR ORGANISASI (siapa di bawah siapa, dan dengan ikatan
   apa) dan sebagai LEMBAR DATA PERSONIL per orang. Halaman ini dua benda itu
   di papan hijau berjahit.

   1. BAGAN — kertas tercetak: partner di puncak, lalu tiga kolom menurut
      `kind` yang memang menentukan cara bayarnya (Staf tetap = digaji
      bulanan; Freelancer inti = langganan studio; Freelancer proyek =
      dibayar per proyek lewat fee). Garis lapor di talang, tidak pernah di
      belakang tulisan. Tiap kotak membawa data sungguhan: peran, jumlah
      penugasan proyek (Bayaran Tim), tugas terbuka (Tugas), dan titik amber
      bila ada bayaran jatuh tempo. Kolom kosong tetap tergambar putus-putus.
   2. LACI ARSIP — anggota nonaktif. Tetap disimpan karena namanya harus
      tetap tercetak di fee dan gaji lama; di bagan mereka tidak berdiri.
   3. LEMBAR DATA PERSONIL — kertas putih tetap: cap AKTIF/NONAKTIF, isian
      jenis/dibayar lewat/tarif acuan/telepon, penugasan proyek (persen dan
      haknya), tugas terbuka terdekat, ringkasan bayaran, sakelar aktif.

   `kind` bukan label kosmetik: Fee dan Gaji memakainya untuk memutuskan
   siapa yang digaji bulanan dan siapa yang dibayar per proyek. Menghapus
   orang yang sudah punya riwayat gaji ditolak database; pesannya
   menyarankan menonaktifkan, karena itulah jalan keluarnya.

   Gerak — hanya karena perbuatan, seketika bila gerak dikurangi: kotak yang
   jenisnya diubah BERPINDAH kolom, yang dinonaktifkan turun ke laci (dan
   sebaliknya), personil baru masuk ke kolomnya; lembar data berganti saat
   orang lain dipilih. Disentuh tetikus, GARIS LAPOR orang itu sampai ke
   puncak menyala.
   ============================================================================= */

const KOLOM: { jenis: JenisAnggota; label: string; ket: string }[] = [
  { jenis: "staf", label: "Staf tetap", ket: "Digaji bulanan" },
  { jenis: "inti", label: "Freelancer inti", ket: "Langganan studio · lewat fee" },
  { jenis: "proyek", label: "Freelancer proyek", ket: "Dibayar per proyek" },
];
const JENIS: JenisAnggota[] = ["partner", "staf", "inti", "proyek"];
const KET_JENIS: Record<JenisAnggota, string> = {
  partner: "Ikut memiliki studio",
  inti: "Freelancer langganan studio",
  proyek: "Dibayar per proyek lewat fee",
  staf: "Digaji bulanan",
};
const LEWAT: Record<JenisAnggota, string> = {
  partner: "Gaji bulanan",
  staf: "Gaji bulanan",
  inti: "Fee proyek",
  proyek: "Fee proyek",
};
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN_PANJANG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const LEMBUT = "cubic-bezier(0.22, 0.7, 0.2, 1)";
const tgl = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]}`;
};
function sisaHari(iso?: string | null) {
  if (!iso) return null;
  const n = Math.round((Date.parse(`${iso.slice(0, 10)}T00:00:00`) - new Date(new Date().toDateString()).getTime()) / 864e5);
  return n;
}

interface Info {
  proyek: number;
  tugas: number;
  tempo: boolean;
}

function Kotak({
  t,
  info,
  cari,
  pilih,
  jalur,
  baru,
  onPilih,
  onSorot,
  akar = false,
}: {
  t: AnggotaTim;
  info: Info;
  cari: string;
  pilih: boolean;
  jalur: boolean;
  baru: boolean;
  onPilih: () => void;
  onSorot: (id: string | null) => void;
  akar?: boolean;
}) {
  const q = cari.trim().toLowerCase();
  const cocok =
    q && [t.name, t.role, t.phone, LABEL_JENIS_ANGGOTA[t.kind]].some((v) => (v ?? "").toLowerCase().includes(q));
  const kelas = [
    "sto__kotak",
    akar && "sto__kotak--akar",
    pilih && "is-pilih",
    jalur && "is-jalur",
    baru && "is-baru",
    q && (cocok ? "is-cocok" : "is-redup"),
  ]
    .filter(Boolean)
    .join(" ");
  const label = [
    t.name,
    t.role,
    LABEL_JENIS_ANGGOTA[t.kind],
    `${info.proyek} penugasan proyek`,
    `${info.tugas} tugas terbuka`,
    info.tempo ? "ada bayaran jatuh tempo" : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <button
      type="button"
      data-orang={t.id}
      className={kelas}
      aria-pressed={pilih}
      aria-label={label}
      onClick={onPilih}
      onPointerEnter={(e: PE) => e.pointerType === "mouse" && onSorot(t.id)}
      onPointerLeave={(e: PE) => e.pointerType === "mouse" && onSorot(null)}
      onFocus={() => onSorot(t.id)}
      onBlur={() => onSorot(null)}
    >
      <span className="sto__ava" aria-hidden="true">
        {inisial(t.name) || "?"}
      </span>
      <span className="sto__kisi" aria-hidden="true">
        <b>
          <SorotTeks teks={t.name} cari={cari} />
        </b>
        <small>{t.role ? <SorotTeks teks={t.role} cari={cari} /> : "Peran belum diisi"}</small>
        <i>
          {akar ? "Partner · " : ""}
          {info.proyek} proyek · {info.tugas} tugas
        </i>
      </span>
      {info.tempo && <span className="sto__tempo" aria-hidden="true" />}
    </button>
  );
}

function Isi() {
  const toast = useToast();
  const [tim, setTim] = useState<AnggotaTim[] | null>(() => bacaCache<AnggotaTim[]>("tim"));
  const [galat, setGalat] = useState<string | null>(null);
  /* Kunci milik Bayaran Tim, Tugas, dan Info Studio — dibaca saja (jebakan #8). */
  const [ringkas, setRingkas] = useState<RingkasanBayaranOrang[]>(() => bacaCache<RingkasanBayaranOrang[]>("bayaran-tim") ?? []);
  const [tugas, setTugas] = useState<Tugas[]>(() => bacaCache<Tugas[]>("tugas") ?? []);
  const [setelan, setSetelan] = useState<StudioSettings | null>(() => bacaCache<StudioSettings>("settings"));
  const [penugasan, setPenugasan] = useState<Record<string, PenugasanTim[] | "galat">>({});
  const [cari, setCari] = useState("");
  const [pilihId, setPilihId] = useState<string | null>(() =>
    typeof location === "undefined" ? null : new URLSearchParams(location.search).get("id"),
  );
  const [sorot, setSorot] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | { awal: AnggotaTim | null; jenis?: JenisAnggota }>(null);
  const [baruId, setBaruId] = useState<string | null>(null);
  const posisiLama = useRef<Map<string, DOMRect> | null>(null);
  const lembarRef = useRef<HTMLDivElement>(null);
  const gantiLembar = useRef(false);
  const tambahRef = useRef<HTMLButtonElement>(null);

  function muat() {
    daftarTim()
      .then((d) => {
        tulisCache("tim", d);
        setTim(d);
        setGalat(null);
      })
      .catch((e) => setGalat((e as Error).message));
  }
  function muatBayaran() {
    ringkasanBayaranTim()
      .then(setRingkas)
      .catch(() => {});
  }
  useEffect(muat, []);
  useEffect(() => {
    muatBayaran();
    daftarTugas()
      .then(setTugas)
      .catch(() => {});
    ambilSettings()
      .then(setSetelan)
      .catch(() => {});
  }, []);

  const semua = tim ?? [];
  const aktif = semua.filter((t) => t.active);
  const arsip = semua.filter((t) => !t.active).sort((a, b) => a.name.localeCompare(b.name, "id"));
  const urutNama = (a: AnggotaTim, b: AnggotaTim) => a.name.localeCompare(b.name, "id");
  const partner = aktif.filter((t) => t.kind === "partner").sort(urutNama);
  const perKolom = KOLOM.map((k) => aktif.filter((t) => t.kind === k.jenis).sort(urutNama));
  const kini = semua.find((t) => t.id === pilihId) ?? partner[0] ?? aktif[0] ?? semua[0] ?? null;

  const ringkasPer = useMemo(() => new Map(ringkas.map((r) => [r.teamMemberId, r])), [ringkas]);
  const tugasTerbuka = useMemo(() => {
    const m = new Map<string, Tugas[]>();
    for (const t of tugas) {
      if (!t.assigneeId || t.status === "selesai") continue;
      m.set(t.assigneeId, [...(m.get(t.assigneeId) ?? []), t]);
    }
    for (const l of m.values())
      l.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
    return m;
  }, [tugas]);
  const info = (id: string): Info => ({
    proyek: ringkasPer.get(id)?.proyek ?? 0,
    tugas: tugasTerbuka.get(id)?.length ?? 0,
    tempo: (ringkasPer.get(id)?.jatuhTempo ?? 0) > 0,
  });

  /* Penugasan orang yang dibuka — dimuat saat dibuka, disimpan di memori halaman. */
  useEffect(() => {
    if (!kini || penugasan[kini.id]) return;
    const id = kini.id;
    penugasanOrang(id)
      .then((d) => setPenugasan((m) => ({ ...m, [id]: d })))
      .catch(() => setPenugasan((m) => ({ ...m, [id]: "galat" })));
  }, [kini?.id]);

  /* ---- Gerak: kotak berpindah kolom / ke laci (FLIP) ---------------------- */
  function rekam() {
    if (!geraknya()) return;
    const m = new Map<string, DOMRect>();
    document.querySelectorAll<HTMLElement>("[data-orang]").forEach((el) => m.set(el.dataset.orang!, el.getBoundingClientRect()));
    posisiLama.current = m;
  }
  useLayoutEffect(() => {
    const m = posisiLama.current;
    if (!m) return;
    posisiLama.current = null;
    document.querySelectorAll<HTMLElement>("[data-orang]").forEach((el) => {
      const a = m.get(el.dataset.orang!);
      if (!a) return;
      const b = el.getBoundingClientRect();
      if (Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1 && Math.abs(a.width - b.width) < 1) return;
      el.animate(
        [
          {
            transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`,
            transformOrigin: "0 0",
          },
          { transform: "none", transformOrigin: "0 0" },
        ],
        { duration: 560, easing: LEMBUT },
      );
    });
  }, [tim]);

  function pilih(t: AnggotaTim) {
    if (t.id === kini?.id) return;
    gantiLembar.current = geraknya();
    setPilihId(t.id);
    history.replaceState(null, "", `?id=${encodeURIComponent(t.id)}`);
  }
  useLayoutEffect(() => {
    if (!gantiLembar.current) return;
    gantiLembar.current = false;
    lembarRef.current?.animate(
      [
        { transform: "translateY(18px) rotate(-0.6deg)", opacity: 0.2 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 420, easing: LEMBUT },
    );
  }, [kini?.id]);

  useEffect(() => {
    if (!baruId) return;
    const w = window.setTimeout(() => setBaruId(null), 1200);
    return () => window.clearTimeout(w);
  }, [baruId]);

  /* ---- Menulis ------------------------------------------------------------- */
  async function ubahAktif(t: AnggotaTim, nyala: boolean) {
    rekam();
    setTim((l) => l?.map((x) => (x.id === t.id ? { ...x, active: nyala } : x)) ?? l);
    try {
      await ubahAnggotaTim(t.id, { active: nyala });
      toast({
        judul: nyala ? `${t.name} kembali ke bagan` : `${t.name} masuk laci arsip`,
        keterangan: nyala
          ? "Muncul lagi di pilihan PIC, fee, dan gaji."
          : "Disembunyikan dari pilihan PIC, fee, dan gaji — namanya tetap di catatan lama.",
        nada: "sukses",
      });
    } catch (e) {
      rekam();
      setTim((l) => l?.map((x) => (x.id === t.id ? t : x)) ?? l);
      toast({ judul: "Gagal mengubah status", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function simpan(isi: BentukAnggota, awal: AnggotaTim | null) {
    if (awal) {
      await ubahAnggotaTim(awal.id, isi);
      rekam();
      setTim((l) => l?.map((x) => (x.id === awal.id ? { ...x, ...isi } : x)) ?? l);
      toast({ judul: "Data personil diperbarui", keterangan: isi.name, nada: "sukses" });
    } else {
      const { id } = await tambahAnggotaTim(isi);
      setTim((l) => [...(l ?? []), { id, ...isi }]);
      if (geraknya()) setBaruId(id);
      setPilihId(id);
      history.replaceState(null, "", `?id=${encodeURIComponent(id)}`);
      toast({ judul: "Personil ditambahkan", keterangan: `${isi.name} · ${LABEL_JENIS_ANGGOTA[isi.kind]}`, nada: "sukses" });
    }
    muat();
  }

  async function hapus(t: AnggotaTim, pemicu: HTMLElement | null) {
    const ya = await tanya({
      judul: `Hapus ${t.name}?`,
      isi: "Kalau ia sudah punya riwayat gaji, penghapusan ditolak — masukkan ke laci arsip saja. Biaya proyek yang sudah tercatat tidak ikut terhapus.",
      ya: "Hapus personil",
      bahaya: true,
    });
    if (!ya) return;
    try {
      await hapusAnggotaTim(t.id);
      rekam();
      setTim((l) => l?.filter((x) => x.id !== t.id) ?? l);
      setPilihId(null);
      history.replaceState(null, "", location.pathname);
      toast({ judul: `${t.name} dihapus`, nada: "sukses" });
      muat();
    } catch (e) {
      toast({
        judul: "Tidak bisa dihapus",
        keterangan: `${(e as Error).message}. Kalau ia sudah punya riwayat gaji atau fee, masukkan ke laci arsip — namanya tetap tercetak di catatan lama.`,
        nada: "gagal",
      });
    }
    /* Fokus balikan dialog konfirmasi bisa jatuh ke <body> (jebakan #39). */
    for (let i = 0; i < 60 && document.querySelector("[role=alertdialog]"); i++)
      await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    if (document.activeElement === document.body || !document.activeElement)
      (pemicu?.isConnected ? pemicu : tambahRef.current)?.focus();
  }

  if (galat && tim === null) return <GagalMuat apa="Struktur organisasi" galat={galat} />;
  if (tim === null) return <Rangka />;

  /* ---- Garis lapor yang disorot ---- */
  const orangSorot = sorot ? semua.find((t) => t.id === sorot) : null;
  const kolomSorot = orangSorot ? KOLOM.findIndex((k) => k.jenis === orangSorot.kind) : -1;
  const urutSorot = kolomSorot >= 0 ? perKolom[kolomSorot]!.findIndex((t) => t.id === sorot) : -1;
  const q = cari.trim();
  const nCocok = q
    ? aktif.filter((t) => [t.name, t.role, t.phone, LABEL_JENIS_ANGGOTA[t.kind]].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase()))).length
    : 0;
  const hariIni = new Date();
  const studio = setelan?.studioName || "Studio";

  return (
    <div className="sto">
      <div className="sto__papan">
        {/* ---- Kop ---- */}
        <header className="sto__kop">
          <div className="sto__kopjudul">
            <p>
              Tim &amp; freelancer · {aktif.length} aktif · {arsip.length} di arsip
            </p>
            <h2>Struktur organisasi</h2>
          </div>
          <div className="sto__alat">
            {q && (
              <span className="sto__cocok" aria-live="polite">
                {nCocok} cocok
              </span>
            )}
            <Cari
              className="sto__cari"
              ukuran="medium"
              judul="Cari personil"
              placeholder="Cari personil"
              value={cari}
              onChange={(e) => setCari(e.currentTarget.value)}
            />
            <button ref={tambahRef} type="button" className="sto__tambah" onClick={() => setDialog({ awal: null })}>
              <Ikon ikon={Plus} ukuran={16} />
              Personil baru
            </button>
          </div>
        </header>

        {/* ---- Bagan ---- */}
        <section
          className={`sto__kertas${kolomSorot >= 0 ? ` is-jalur-${kolomSorot}` : ""}${orangSorot?.kind === "partner" ? " is-jalur-akar" : ""}`}
          aria-label="Bagan struktur organisasi"
        >
          <div className="sto__judul">
            <b>{studio}</b>
            <span>
              Bagan struktur organisasi · per {hariIni.getDate()} {BULAN_PANJANG[hariIni.getMonth()]} {hariIni.getFullYear()}
            </span>
          </div>
          <div className="sto__akar">
            <div className="sto__akarisi">
              {partner.length ? (
                partner.map((t) => (
                  <Kotak
                    key={t.id}
                    akar
                    t={t}
                    info={info(t.id)}
                    cari={cari}
                    pilih={kini?.id === t.id}
                    jalur={sorot === t.id}
                    baru={baruId === t.id}
                    onPilih={() => pilih(t)}
                    onSorot={setSorot}
                  />
                ))
              ) : (
                <button type="button" className="sto__kosong sto__kosong--akar" onClick={() => setDialog({ awal: null, jenis: "partner" })}>
                  <Ikon ikon={Plus} ukuran={14} />
                  Belum ada partner
                </button>
              )}
            </div>
          </div>
          <div className="sto__cabang" aria-hidden="true">
            <i className="sto__stem" />
            <i className="sto__bus sto__bus--kiri" />
            <i className="sto__bus sto__bus--kanan" />
          </div>
          <div className="sto__kolom-kolom">
            {KOLOM.map((k, ki) => {
              const isi = perKolom[ki]!;
              return (
                <div key={k.jenis} className={`sto__kolom${kolomSorot === ki ? " is-jalur" : ""}`}>
                  <div className="sto__kepala">
                    <b>{k.label}</b>
                    <span>{k.ket}</span>
                    <i>{isi.length}</i>
                  </div>
                  <ul className="sto__anggota" aria-label={k.label}>
                    {isi.map((t, i) => (
                      <li key={t.id} className={kolomSorot === ki && i <= urutSorot ? "is-jalur" : undefined}>
                        <Kotak
                          t={t}
                          info={info(t.id)}
                          cari={cari}
                          pilih={kini?.id === t.id}
                          jalur={sorot === t.id}
                          baru={baruId === t.id}
                          onPilih={() => pilih(t)}
                          onSorot={setSorot}
                        />
                      </li>
                    ))}
                    {isi.length === 0 && (
                      <li>
                        <button type="button" className="sto__kosong" onClick={() => setDialog({ awal: null, jenis: k.jenis })}>
                          <Ikon ikon={Plus} ukuran={14} />
                          Belum ada {k.label.toLowerCase()}
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
          {/* Kunci bagan — arti tiap tanda, seperti legenda di gambar kerja. */}
          <dl className="sto__kunci" aria-label="Kunci bagan">
            <div>
              <dt aria-hidden="true">
                <i className="sto__kunci-tempo" />
              </dt>
              <dd>Bayaran tahap jatuh tempo</dd>
            </div>
            <div>
              <dt>2 proyek · 3 tugas</dt>
              <dd>Penugasan proyek · tugas terbuka</dd>
            </div>
            <div>
              <dt aria-hidden="true">
                <i className="sto__kunci-garis" />
              </dt>
              <dd>Garis lapor — sentuh kotak untuk menyalakannya</dd>
            </div>
          </dl>
        </section>

        {/* ---- Laci arsip ---- */}
        <section className="sto__laci" aria-label="Laci arsip personil nonaktif">
          <p className="sto__lacijudul">
            <Ikon ikon={ArchiveTray} ukuran={15} />
            <b>Laci arsip</b>
            <span>{arsip.length ? `${arsip.length} nonaktif` : "kosong"}</span>
          </p>
          <div className="sto__laciisi">
            {arsip.length ? (
              arsip.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  data-orang={t.id}
                  className={`sto__map${kini?.id === t.id ? " is-pilih" : ""}`}
                  aria-pressed={kini?.id === t.id}
                  onClick={() => pilih(t)}
                >
                  <span aria-hidden="true">{inisial(t.name)}</span>
                  {t.name}
                  <small>{LABEL_JENIS_ANGGOTA[t.kind]}</small>
                </button>
              ))
            ) : (
              <small className="sto__lacikosong">Personil yang dinonaktifkan disimpan di sini — namanya tetap di catatan lama.</small>
            )}
          </div>
        </section>

        {/* ---- Lembar data personil ---- */}
        <aside className="sto__meja" aria-label="Lembar data personil">
          {kini ? (
            <LembarPersonil
              key="lembar"
              rujuk={lembarRef}
              t={kini}
              bayar={ringkasPer.get(kini.id) ?? null}
              tugas={tugasTerbuka.get(kini.id) ?? []}
              penugasan={penugasan[kini.id]}
              onAktif={(v) => ubahAktif(kini, v)}
              onUbah={() => setDialog({ awal: kini })}
              onHapus={(el) => hapus(kini, el)}
            />
          ) : (
            <div className="sto__lembar sto__lembar--kosong">
              <p>Belum ada personil.</p>
              <small>Yang didaftarkan di sini bisa dipilih sebagai PIC tugas, penerima fee, dan penerima gaji.</small>
            </div>
          )}
        </aside>
      </div>
      <DialogAnggota
        buka={dialog !== null}
        awal={dialog?.awal ?? null}
        jenisAwal={dialog?.jenis}
        onTutup={() => setDialog(null)}
        onSimpan={simpan}
      />
    </div>
  );
}

function LembarPersonil({
  rujuk,
  t,
  bayar,
  tugas,
  penugasan,
  onAktif,
  onUbah,
  onHapus,
}: {
  rujuk: React.RefObject<HTMLDivElement | null>;
  t: AnggotaTim;
  bayar: RingkasanBayaranOrang | null;
  tugas: Tugas[];
  penugasan: PenugasanTim[] | "galat" | undefined;
  onAktif: (v: boolean) => void;
  onUbah: () => void;
  onHapus: (el: HTMLElement) => void;
}) {
  const wa = nomorWa(t.phone);
  const daftar = Array.isArray(penugasan) ? penugasan : [];
  return (
    <div ref={rujuk} className="sto__lembar">
      <div className="sto__lkop">
        <span>Lembar data personil</span>
        <b className={`sto__cap${t.active ? "" : " is-arsip"}`}>{t.active ? "Aktif" : "Nonaktif"}</b>
      </div>
      <div className="sto__identitas">
        <span className="sto__lava" aria-hidden="true">
          {inisial(t.name) || "?"}
        </span>
        <div>
          <h3>{t.name}</h3>
          <p>{t.role || "Peran belum diisi"}</p>
        </div>
      </div>
      <dl className="sto__isian">
        <div>
          <dt>Jenis</dt>
          <dd>
            {LABEL_JENIS_ANGGOTA[t.kind]} <small>· {KET_JENIS[t.kind].toLowerCase()}</small>
          </dd>
        </div>
        <div>
          <dt>Dibayar lewat</dt>
          <dd>{LEWAT[t.kind]}</dd>
        </div>
        <div>
          <dt>Tarif acuan</dt>
          <dd>{t.rate ? formatRupiah(t.rate) : <span className="sto__redup">—</span>}</dd>
        </div>
        <div>
          <dt>Telepon</dt>
          <dd>
            {t.phone ? (
              <>
                <a href={`tel:${t.phone.replace(/[^\d+]/g, "")}`}>
                  <Ikon ikon={Phone} ukuran={12} />
                  {t.phone}
                </a>
                {wa && (
                  <a className="sto__wa" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${t.name}`}>
                    <Ikon ikon={ChatTeardropDots} ukuran={12} />
                    WA
                  </a>
                )}
              </>
            ) : (
              <span className="sto__redup">—</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="sto__lisi">
        <h4>
          <span>Penugasan proyek</span>
          <b>{penugasan === undefined ? "…" : daftar.length}</b>
        </h4>
        {penugasan === undefined ? (
          <p className="sto__lkosong">Memuat penugasan…</p>
        ) : penugasan === "galat" ? (
          <p className="sto__lkosong">Penugasan tidak bisa dimuat.</p>
        ) : daftar.length ? (
          <ul className="sto__tugaskan">
            {daftar.map((p) => (
              <li key={p.id}>
                <a href={`/admin/proyek/satu?id=${encodeURIComponent(p.projectId)}#tim-bayaran`}>
                  <span>{p.projectTitle}</span>
                  <small>
                    {LABEL_PERAN[p.role]} · {p.pctBerlaku === null ? "persen belum ditentukan" : `${String(p.pctBerlaku).replace(".", ",")}%`}
                  </small>
                </a>
                <b className={p.terutang ? "is-utang" : undefined}>
                  {p.hak === null ? "—" : p.terutang ? `sisa ${formatRupiahRingkas(p.terutang)}` : "lunas"}
                </b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="sto__lkosong">Belum ditugaskan di proyek mana pun.</p>
        )}

        <h4>
          <span>Tugas terbuka</span>
          <b>{tugas.length}</b>
        </h4>
        {tugas.length ? (
          <ul className="sto__tugas">
            {tugas.map((x) => {
              const n = sisaHari(x.dueDate);
              return (
                <li key={x.id}>
                  <a href={`/admin/list-kerjaan?tugas=${encodeURIComponent(x.id)}`}>
                    <span>{x.title}</span>
                    <small>{x.projectTitle}</small>
                  </a>
                  <b className={n !== null && n < 0 ? "is-lewat" : undefined}>
                    {n === null ? "tanpa tenggat" : n < 0 ? `lewat ${-n} hr` : n === 0 ? "hari ini" : tgl(x.dueDate!)}
                  </b>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="sto__lkosong">Tidak ada tugas yang menunggu orang ini.</p>
        )}
      </div>

      <div className="sto__bayar">
        <div>
          <small>Hak</small>
          <b>{bayar ? formatRupiahRingkas(bayar.hak) : "—"}</b>
        </div>
        <div>
          <small>Dibayar</small>
          <b>{bayar ? formatRupiahRingkas(bayar.dibayar) : "—"}</b>
        </div>
        <div className={bayar?.jatuhTempo ? "is-tempo" : undefined}>
          <small>{bayar?.jatuhTempo ? "Jatuh tempo" : "Terutang"}</small>
          <b>{bayar ? formatRupiahRingkas(bayar.jatuhTempo || bayar.terutang) : "—"}</b>
        </div>
        <a href={`/admin/gaji/tim?orang=${encodeURIComponent(t.id)}`}>Bayaran Tim</a>
      </div>

      <div className="sto__lkaki">
        <label className="sto__aktif">
          <Sakelar judul={`${t.name} aktif`} checked={t.active} onChange={(e) => onAktif(e.currentTarget.checked)} />
          <span>{t.active ? "Aktif di bagan" : "Di laci arsip"}</span>
        </label>
        <button type="button" onClick={onUbah}>
          <Ikon ikon={NotePencil} ukuran={14} />
          Ubah
        </button>
        <button type="button" className="is-bahaya" onClick={(e) => onHapus(e.currentTarget)} aria-label={`Hapus ${t.name}`}>
          <Ikon ikon={Trash} ukuran={14} />
        </button>
      </div>
    </div>
  );
}

interface BentukAnggota {
  name: string;
  role: string | null;
  kind: JenisAnggota;
  rate: number | null;
  phone: string | null;
  active: boolean;
}

/* Satu dialog untuk tambah DAN ubah — dua dialog berisian sama adalah dua
   tempat yang harus diingat saat salah satunya diperbaiki. */
function DialogAnggota({
  buka,
  awal,
  jenisAwal,
  onTutup,
  onSimpan,
}: {
  buka: boolean;
  awal: AnggotaTim | null;
  jenisAwal?: JenisAnggota;
  onTutup: () => void;
  onSimpan: (isi: BentukAnggota, awal: AnggotaTim | null) => Promise<void>;
}) {
  const toast = useToast();
  const [nama, setNama] = useState("");
  const [peran, setPeran] = useState("");
  const [jenis, setJenis] = useState<JenisAnggota>("proyek");
  const [tarif, setTarif] = useState<number | null>(null);
  const [telepon, setTelepon] = useState("");
  const [aktif, setAktif] = useState(true);
  const [kirim, setKirim] = useState(false);
  /* Disetel ulang tiap dibuka: tanpa ini isian membawa sisa ketikan yang batal. */
  useEffect(() => {
    if (!buka) return;
    setNama(awal?.name ?? "");
    setPeran(awal?.role ?? "");
    setJenis(awal?.kind ?? jenisAwal ?? "proyek");
    setTarif(awal?.rate ?? null);
    setTelepon(awal?.phone ?? "");
    setAktif(awal?.active ?? true);
  }, [buka, awal?.id, jenisAwal]);
  const alasan = nama.trim().length < 2 ? "Isi nama dulu, minimal 2 huruf." : null;
  const tempat = !aktif
    ? "Masuk laci arsip"
    : jenis === "partner"
      ? "Berdiri di puncak bagan"
      : `Masuk kolom ${KOLOM.find((k) => k.jenis === jenis)?.label}`;

  async function simpan() {
    if (alasan) return;
    setKirim(true);
    try {
      await onSimpan(
        { name: nama.trim(), role: peran.trim() || null, kind: jenis, rate: tarif, phone: telepon.trim() || null, active: aktif },
        awal,
      );
      onTutup();
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setKirim(false);
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={(b) => !b && onTutup()}
      title={awal ? `Ubah ${awal.name}` : "Personil baru"}
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
        {/* Pratinjau: kotaknya persis seperti nanti di bagan. */}
        <div className="sto sto--pratinjau" aria-hidden="true">
          <span className={`sto__kotak${jenis === "partner" ? " sto__kotak--akar" : ""}`}>
            <span className="sto__ava">{inisial(nama) || "?"}</span>
            <span className="sto__kisi">
              <b>{nama.trim() || "Nama personil"}</b>
              <small>{peran.trim() || "Peran belum diisi"}</small>
              <i>{tempat}</i>
            </span>
          </span>
        </div>
        <div className="kd-form__dua">
          <Isian label="Nama" placeholder="mis. Rian Saputra" value={nama} onChange={(e) => setNama(e.currentTarget.value)} />
          <Isian label="Peran" placeholder="mis. Drafter DED" value={peran} onChange={(e) => setPeran(e.currentTarget.value)} />
        </div>
        <KelompokRadio
          nama="tm-jenis"
          label="Jenis"
          arah="datar"
          nilai={jenis}
          onUbah={(v) => setJenis(v as JenisAnggota)}
          opsi={JENIS.map((j) => ({ nilai: j, label: LABEL_JENIS_ANGGOTA[j], ket: KET_JENIS[j] }))}
        />
        <div className="kd-form__dua">
          <Isian
            label="Tarif acuan (Rp)"
            inputMode="numeric"
            placeholder="0"
            value={tarif === null ? "" : tarif.toLocaleString("id-ID")}
            onChange={(e) => {
              const angka = e.currentTarget.value.replace(/\D/g, "");
              setTarif(angka ? Number(angka) : null);
            }}
          />
          <Isian label="Telepon" type="tel" inputMode="tel" placeholder="08…" value={telepon} onChange={(e) => setTelepon(e.currentTarget.value)} />
        </div>
        <label className="kd-form__centang">
          <Sakelar judul="Aktif" checked={aktif} onChange={(e) => setAktif(e.currentTarget.checked)} />
          <span>
            <b>Aktif</b>
            <small>Nonaktif = disimpan di laci arsip, tidak muncul di pilihan.</small>
          </span>
        </label>
      </div>
    </Dialog>
  );
}

/* Kerangka memuat berbentuk papan dan setinggi papan aslinya. */
function Rangka() {
  return (
    <div className="sto" aria-busy="true">
      <div className="sto__papan">
        <div className="sto__kop sto__kop--rangka" />
        <div className="sto__kertas sto__kertas--rangka" />
        <div className="sto__laci" />
        <div className="sto__meja">
          <div className="sto__lembar sto__lembar--rangka" />
        </div>
      </div>
    </div>
  );
}

export function TimKit() {
  return (
    <RequireAuth skeleton={<Rangka />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
