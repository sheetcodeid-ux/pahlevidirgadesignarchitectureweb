import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { navigate } from "astro:transitions/client";
import { RequireAuth } from "./RequireAuth";
import { DialogBiaya } from "./biayaKit";
import { PilihMenu, PilihTanggal, keIso } from "../kit/Formulir";
import { DropdownMenu } from "../kit/Overlay";
import { Cari } from "../kit/Isian";
import { Tombol } from "../kit/Tombol";
import { Ikon, type DataIkon } from "../kit/Ikon";
import { TombolBulat } from "../kit/Item";
import { ToastProvider, useToast } from "../kit/Toast";
import {
  Users,
  House,
  Medal,
  DotsThree,
  Sliders,
  CaretDown,
  SpecialHandshake,
  UserCircleCheck,
  IdentificationBadge,
  NavArrowsLeftRight,
  NavCurrencyCircleDollar,
  Wallet,
} from "../kit/ikon";
import {
  daftarProyek,
  daftarTim,
  semuaBiaya,
  catatBiaya,
  ambilRingkasanKeuangan,
  ambilSettings,
  bacaCache,
  tulisCache,
  LABEL_JENIS_ANGGOTA,
  type Proyek,
  type AnggotaTim,
  type JenisAnggota,
  type BiayaProyek,
  type FinanceOverview,
  type StudioSettings,
} from "../../lib/admin";
import { proyekAktif, setProyekAktif, onProyekAktif } from "../../lib/proyekAktif";
import { formatRupiah } from "../../lib/format";
import { terbilang } from "../../lib/terbilang";
import { kodeProyek, inisial } from "../../lib/nomorDokumen";
import { BULAN, BULAN_PENDEK } from "./frame25";

/* =============================================================================
   Catat Pengeluaran — BUKU NOTA PENGELUARAN dan PAKU NOTA.

   Benda dunia nyatanya: di meja studio ada buku nota rangkap untuk mencatat
   uang yang keluar untuk proyek, dan sebatang paku tempat nota yang sudah
   ditulis ditusukkan. Sengaja berbeda dari tetangganya di Keuangan — Gaji
   (buku), Fee (kuitansi), Tagihan (papan jepit), Kas (mesin kas), Semua
   Transaksi (rekening koran).

   Satu papan `--kas-bidang` berjahit, tiga kolom:

   1. RAK CAP — empat cap karet kategori (`cost_category`, PERSIS empat).
      Muka cap membawa jumlah dan banyaknya nota bulan ini; cap yang dipilih
      dibubuhkan di lembar nota. Di bawahnya daftar PENERIMA per jenis anggota
      (`member_kind`, juga empat) dengan cari — memilih orang mengisi
      "Dibayar kepada".
   2. BUKU NOTA — lembar putih teratas buku yang bisa diisi di tempat:
      nomor nota, tanggal, proyek, penerima, keperluan, jumlah + terbilang,
      dan ruang tanda tangan. Tumpukan rangkap mengintip di bawahnya.
   3. PAKU NOTA — biaya terbaru lintas proyek (8), yang terbaru utuh di atas
      tertusuk paku, yang lebih lama menyembul di bawahnya. Di atasnya
      KONTROL PROYEK: nilai kontrak, beban yang sudah keluar, dan beban
      SESUDAH nota yang sedang diketik — bergerak saat jumlahnya diketik.

   SATU-SATUNYA gerak: catatan yang tersimpan DISOBEK dari buku lalu
   DITUSUK ke paku — lembar terangkat dari perforasinya, terbang ke paku, dan
   mendarat di puncak tumpukan. Hanya saat menyimpan; diam bila gerak
   dikurangi. Lembar kosong berikutnya sudah ada di buku saat yang lama
   terbang, seperti buku nota sungguhan.

   Nomor nota `NP-YYMM-NN` diturunkan dari data, bukan nomor karangan: urutan
   biaya dalam bulan terjadinya, menurut tanggal lalu urutan catat — pola yang
   sama dengan nomor bukti Kas Studio.
   ============================================================================= */

const KATEGORI: { nilai: string; label: string; ikon: DataIkon }[] = [
  { nilai: "freelancer", label: "Freelancer", ikon: Users },
  { nilai: "operasional", label: "Operasional", ikon: House },
  { nilai: "prinsipal", label: "Prinsipal", ikon: Medal },
  { nilai: "lainnya", label: "Lainnya", ikon: DotsThree },
];
const LABEL_KATEGORI: Record<string, string> = Object.fromEntries(KATEGORI.map((k) => [k.nilai, k.label]));
const IKON_KATEGORI: Record<string, DataIkon> = Object.fromEntries(KATEGORI.map((k) => [k.nilai, k.ikon]));

/* Urutan kelompok mengikuti kedekatan ke studio, bukan abjad. */
const JENIS: { nilai: JenisAnggota; ikon: DataIkon }[] = [
  { nilai: "partner", ikon: SpecialHandshake },
  { nilai: "inti", ikon: UserCircleCheck },
  { nilai: "proyek", ikon: Users },
  { nilai: "staf", ikon: IdentificationBadge },
];

const PAKU = 8;
const TERBANG_MS = 780;

function hariIni(): string {
  return keIso(new Date());
}

/** "12.500.000" / "Rp12.500.000" -> 12500000. */
function keAngka(teks: string): number {
  const bersih = teks.replace(/[^\d]/g, "");
  return bersih ? Number(bersih) : 0;
}

/* `incurred_on` kolom date: dipotong dari string, bukan lewat Date, supaya
   tidak mundur sehari di zona barat GMT. */
const tglPendek = (iso: string) => {
  const [, b, h] = iso.slice(0, 10).split("-");
  return `${Number(h)} ${BULAN_PENDEK[Number(b) - 1] ?? ""}`;
};
const kunciBulan = (iso: string) => iso.slice(2, 4) + iso.slice(5, 7);

/** Nomor nota tiap biaya: urutan dalam bulan terjadinya. Daftar dari API
    terurut tanggal TURUN lalu catat terbaru dulu, jadi dibaca terbalik. */
function nomorSemua(daftar: BiayaProyek[]): Map<string, string> {
  const hitung = new Map<string, number>();
  const hasil = new Map<string, string>();
  for (let i = daftar.length - 1; i >= 0; i--) {
    const b = daftar[i]!;
    const k = kunciBulan(b.incurredOn);
    const n = (hitung.get(k) ?? 0) + 1;
    hitung.set(k, n);
    hasil.set(b.id, `NP-${k}-${String(n).padStart(2, "0")}`);
  }
  return hasil;
}

function Isi() {
  const toast = useToast();
  const kurangiGerak = useRef(false);
  useEffect(() => {
    kurangiGerak.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const [proyek, setProyek] = useState<Proyek[] | null>(() => bacaCache<Proyek[]>("proyek"));
  const [tim, setTim] = useState<AnggotaTim[] | null>(() => bacaCache<AnggotaTim[]>("tim"));
  const [biaya, setBiaya] = useState<BiayaProyek[] | null>(() => bacaCache<BiayaProyek[]>("biaya-semua"));
  const [ringkas, setRingkas] = useState<FinanceOverview | null>(() => bacaCache<FinanceOverview>("keuangan:semua"));
  /* Nama studio dari Info Studio — kunci `settings` milik halaman itu, jadi
     di sini cuma DIBACA (jebakan #8). */
  const [studio, setStudio] = useState<{ nama: string; kota: string | null }>(() => {
    const s = bacaCache<StudioSettings>("settings");
    return { nama: s?.studioName || "Studio", kota: s?.city ?? null };
  });
  /* Biaya yang sedang dibuka rinciannya (dan bisa dihapus). */
  const [rinci, setRinci] = useState<BiayaProyek | null>(null);

  const [kategori, setKategori] = useState("freelancer");
  const [buka, setBuka] = useState<JenisAnggota | null>("proyek");
  const [cari, setCari] = useState("");
  const [pilihProyekId, setPilihProyekId] = useState<string | null>(() => proyekAktif());
  const [orangId, setOrangId] = useState<string>("");
  const [label, setLabel] = useState("");
  const [nominal, setNominal] = useState("");
  const [tanggal, setTanggal] = useState(hariIni);
  const [kirim, setKirim] = useState(false);

  /* Gerak sobek-dan-tusuk. `terbang` = salinan nota yang sedang terbang
     beserta jaraknya ke paku (dibaca SEKALI saat menyimpan). `tusuk` = id
     nota yang baru mendarat. */
  const [terbang, setTerbang] = useState<{ nota: NotaData; gaya: CSSProperties } | null>(null);
  const [tusuk, setTusuk] = useState<string | null>(null);
  /** Cap yang baru dibubuhkan — "tercap" sekali, hanya saat dipilih. */
  const [capBaru, setCapBaru] = useState<string | null>(null);
  const akarRef = useRef<HTMLDivElement>(null);
  const lembarRef = useRef<HTMLDivElement>(null);
  const pakuRef = useRef<HTMLDivElement>(null);

  useEffect(() => onProyekAktif(setPilihProyekId), []);

  async function muatBiaya() {
    const d = await semuaBiaya();
    tulisCache("biaya-semua", d);
    setBiaya(d);
    return d;
  }

  useEffect(() => {
    daftarProyek()
      .then((d) => {
        tulisCache("proyek", d);
        setProyek(d);
      })
      .catch(() => setProyek((l) => l ?? []));
    daftarTim()
      .then((d) => {
        tulisCache("tim", d);
        setTim(d);
      })
      .catch(() => setTim((l) => l ?? []));
    muatBiaya().catch(() => setBiaya((l) => l ?? []));
    ambilRingkasanKeuangan(null)
      .then((d) => {
        tulisCache("keuangan:semua", d);
        setRingkas(d);
      })
      .catch(() => {});
    ambilSettings()
      .then((d) => setStudio({ nama: d.studioName || "Studio", kota: d.city ?? null }))
      .catch(() => {});
  }, []);

  const aktif = useMemo(() => {
    const d = proyek ?? [];
    return d.find((p) => p.id === pilihProyekId) ?? d[0] ?? null;
  }, [proyek, pilihProyekId]);

  /* Beban proyek dari ringkasan keuangan: daftar proyek memuat nilai kontrak
     tapi TIDAK memuat total biaya. */
  const barisKeu = useMemo(
    () => (ringkas?.proyek ?? []).find((p) => p.projectId === aktif?.id) ?? null,
    [ringkas, aktif?.id],
  );
  const kontrak = aktif?.contractValue ?? barisKeu?.contractValue ?? 0;
  const beban = barisKeu?.costsTotal ?? 0;

  const timAktif = useMemo(() => (tim ?? []).filter((a) => a.active), [tim]);
  const orang = timAktif.find((a) => a.id === orangId) ?? null;

  const kelompok = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const d = q
      ? timAktif.filter((a) => a.name.toLowerCase().includes(q) || (a.role ?? "").toLowerCase().includes(q))
      : timAktif;
    return JENIS.map((j) => ({ ...j, orang: d.filter((a) => a.kind === j.nilai) }));
  }, [timAktif, cari]);
  const mencari = cari.trim().length > 0;

  const semua = biaya ?? [];
  const nomor = useMemo(() => nomorSemua(semua), [semua]);
  const bulanIni = hariIni().slice(0, 7);
  const perKategori = useMemo(() => {
    const m = new Map<string, { jumlah: number; n: number }>();
    for (const b of semua) {
      if (!b.incurredOn.startsWith(bulanIni)) continue;
      const x = m.get(b.category) ?? { jumlah: 0, n: 0 };
      x.jumlah += b.amount;
      x.n += 1;
      m.set(b.category, x);
    }
    return m;
  }, [semua, bulanIni]);
  const notaBulanIni = [...perKategori.values()].reduce((a, x) => a + x.n, 0);

  /* Nomor lembar yang sedang ditulis: sesudah semua biaya bulan itu yang
     tanggalnya tidak lebih baru — nota lama yang diketik belakangan memang
     terselip di urutannya. */
  const nomorBaru = useMemo(() => {
    const k = kunciBulan(tanggal);
    const n = semua.filter((b) => kunciBulan(b.incurredOn) === k && b.incurredOn <= tanggal).length + 1;
    return `NP-${k}-${String(n).padStart(2, "0")}`;
  }, [semua, tanggal]);

  const angka = keAngka(nominal);
  const alasan = !aktif
    ? "Pilih proyeknya dulu"
    : label.trim().length < 2
      ? "Tulis untuk keperluan apa"
      : angka <= 0
        ? "Isi jumlahnya"
        : null;
  const bisaKirim = alasan === null && !kirim;

  function kosongkan() {
    setLabel("");
    setNominal("");
    setOrangId("");
    setTanggal(hariIni());
  }

  async function simpan() {
    if (!aktif || !bisaKirim) return;
    setKirim(true);
    const nota: NotaData = {
      nomor: nomorBaru,
      tanggal,
      proyek: aktif.title,
      kode: kodeProyek(aktif.title),
      orang: orang?.name ?? null,
      label: label.trim(),
      jumlah: angka,
      kategori,
    };
    try {
      const { id } = await catatBiaya({
        projectId: aktif.id,
        label: nota.label,
        category: kategori,
        amount: angka,
        incurredOn: tanggal || undefined,
        teamMemberId: orangId || null,
      });
      toast({
        judul: "Pengeluaran tercatat",
        keterangan: `${nota.nomor} · ${formatRupiah(angka)} — ${LABEL_KATEGORI[kategori]} di ${aktif.title}.`,
        nada: "sukses",
      });

      /* Gerak: jarak lembar → puncak paku dibaca sekali, di sini. */
      const akar = akarRef.current?.getBoundingClientRect();
      const lb = lembarRef.current?.getBoundingClientRect();
      const tujuan = pakuRef.current?.getBoundingClientRect();
      const bergerak = !kurangiGerak.current && akar && lb && tujuan && lb.width > 0;
      if (bergerak) {
        const sk = Math.min(1, tujuan.width / lb.width);
        setTerbang({
          nota,
          gaya: {
            left: lb.left - akar.left,
            top: lb.top - akar.top,
            width: lb.width,
            height: lb.height,
            /* Titik asal transformasinya tepi atas-tengah, jadi cukup
               menyamakan tepi atas-tengah lembar dengan tepi atas-tengah
               puncak paku. */
            ["--npg-dx" as string]: `${tujuan.left + tujuan.width / 2 - (lb.left + lb.width / 2)}px`,
            ["--npg-dy" as string]: `${tujuan.top - lb.top}px`,
            ["--npg-sk" as string]: String(sk),
          },
        });
      }

      /* Nota baru langsung ada di tumpukan (bersembunyi sampai mendarat),
         lalu daftar segar mengganti salinannya. */
      const baru: BiayaProyek = {
        id,
        projectId: aktif.id,
        projectTitle: aktif.title,
        label: nota.label,
        category: kategori,
        amount: angka,
        incurredOn: tanggal,
        teamMemberId: orangId || null,
        teamMemberName: orang?.name ?? null,
      };
      setBiaya((l) => [baru, ...(l ?? [])].sort((a, z) => z.incurredOn.localeCompare(a.incurredOn)));
      setTusuk(id);
      setLabel("");
      setNominal("");
      window.setTimeout(() => setTerbang(null), bergerak ? TERBANG_MS : 0);
      window.setTimeout(() => setTusuk((t) => (t === id ? null : t)), bergerak ? TERBANG_MS + 420 : 0);

      const [b, r] = await Promise.all([semuaBiaya(), ambilRingkasanKeuangan(null)]);
      tulisCache("biaya-semua", b);
      tulisCache("keuangan:semua", r);
      setBiaya(b);
      setRingkas(r);
    } catch (e) {
      toast({
        judul: "Gagal mencatat",
        keterangan: e instanceof Error ? e.message : "Coba lagi.",
        nada: "gagal",
      });
    } finally {
      setKirim(false);
    }
  }

  const paku = semua.slice(0, PAKU);
  const [atas, ...bawah] = paku;
  const menunggu = terbang !== null && atas?.id === tusuk;

  const persen = (n: number) => (kontrak > 0 ? Math.round((n / kontrak) * 100) : 0);
  const skala = Math.max(kontrak, beban + angka, 1);
  const lewat = kontrak > 0 && beban + angka > kontrak;

  return (
    <div className="npg" ref={akarRef}>
      <div className="npg__papan">
        {/* ---- RAK CAP & PENERIMA ------------------------------------------- */}
        <section className="npg__rak" aria-label="Kategori dan penerima">
          <p className="npg__alis">Cap kategori</p>
          <div className="npg__cap-cap" role="group" aria-label="Kategori pengeluaran">
            {KATEGORI.map((k) => {
              const s = perKategori.get(k.nilai);
              return (
                <button
                  key={k.nilai}
                  type="button"
                  className="npg__cap"
                  aria-pressed={kategori === k.nilai}
                  onClick={() => {
                    if (k.nilai === kategori) return;
                    setKategori(k.nilai);
                    setCapBaru(k.nilai);
                  }}
                >
                  <span className="npg__gagang" aria-hidden="true" />
                  <span className="npg__muka">
                    <span className="npg__capnama">
                      <Ikon ikon={k.ikon} ukuran={14} />
                      {k.label}
                    </span>
                    <span className="npg__capangka">{s ? formatRupiah(s.jumlah) : "Rp0"}</span>
                    <small>{s ? `${s.n} nota bulan ini` : "belum ada bulan ini"}</small>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="npg__penerima">
            <p className="npg__alis">Dibayar kepada</p>
            <div className="npg__cari">
              <Cari
                className="npg__carikotak"
                judul="Cari orang"
                placeholder="Cari orang"
                value={cari}
                onChange={(e) => setCari(e.currentTarget.value)}
              />
              <TombolBulat className="npg__bulat" ikon={Sliders} judul="Kelola di Tim & Freelancer" onClick={() => navigate("/admin/tim")} />
            </div>
            <div className="npg__orangwadah">
              <ul className="npg__orang">
                {kelompok.map((k) => {
                  const terbuka = mencari ? k.orang.length > 0 : buka === k.nilai;
                  return (
                    <li key={k.nilai} className={terbuka ? "is-terbuka" : undefined}>
                      <button
                        type="button"
                        className="npg__jenis"
                        aria-expanded={terbuka}
                        onClick={() => setBuka(terbuka ? null : k.nilai)}
                      >
                        <Ikon ikon={k.ikon} ukuran={14} />
                        <span>{LABEL_JENIS_ANGGOTA[k.nilai]}</span>
                        <small>{k.orang.length}</small>
                        <Ikon ikon={CaretDown} ukuran={12} className="npg__caret" />
                      </button>
                      {terbuka && (
                        <ul className="npg__anak">
                          {k.orang.map((a) => (
                            <li key={a.id}>
                              <button
                                type="button"
                                className="npg__siapa"
                                aria-pressed={orangId === a.id}
                                onClick={() => setOrangId(orangId === a.id ? "" : a.id)}
                              >
                                <span className="npg__inisial" aria-hidden="true">{inisial(a.name)}</span>
                                <span className="npg__siapanama">
                                  <b>{a.name}</b>
                                  {a.role && <small>{a.role}</small>}
                                </span>
                              </button>
                            </li>
                          ))}
                          {k.orang.length === 0 && (
                            <li className="npg__kosongkecil">
                              {mencari ? "Tidak ada yang cocok." : "Belum ada orang di kelompok ini."}
                            </li>
                          )}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
              {tim !== null && timAktif.length === 0 && <p className="npg__kosongkecil">Belum ada anggota tim terdaftar.</p>}
            </div>
          </div>
        </section>

        {/* ---- BUKU NOTA ----------------------------------------------------- */}
        <section className="npg__meja" aria-label="Buku nota pengeluaran">
          <div className="npg__mejakop">
            <p className="npg__alis">
              Buku nota pengeluaran · {BULAN[Number(bulanIni.slice(5, 7)) - 1]} · {notaBulanIni} nota
            </p>
            <DropdownMenu
              trigger={
                <button type="button" className="npg__menu" aria-label="Buka halaman lain">
                  <Ikon ikon={DotsThree} ukuran={20} />
                </button>
              }
              sections={[
                {
                  label: "Buka",
                  items: (
                    [
                      ["Semua transaksi", NavArrowsLeftRight, "/admin/keuangan/transaksi"],
                      ["Fee proyek", NavCurrencyCircleDollar, "/admin/fee"],
                      ["Gaji", Wallet, "/admin/gaji"],
                    ] as const
                  ).map(([l, ikon, ke]) => ({ label: l, ikon, onSelect: () => navigate(ke) })),
                },
              ]}
            />
          </div>

          <div className="npg__buku">
            <div className="npg__jilid" aria-hidden="true">
              <span />
              <span />
            </div>
            {/* Sisa sobekan di bawah jilid: satu lapis per nota bulan ini
                (paling banyak enam), seperti buku nota sungguhan. */}
            <div className="npg__sisa" aria-hidden="true">
              {Array.from({ length: Math.min(notaBulanIni, 6) }, (_, i) => (
                <span key={i} style={{ ["--i" as string]: i } as CSSProperties} />
              ))}
            </div>
            <div className="npg__lembar" ref={lembarRef}>
              <header className="npg__kop">
                <div className="npg__studio">
                  <b>{studio.nama}</b>
                  {studio.kota && <small>{studio.kota}</small>}
                </div>
                <div className="npg__judul">
                  <span>Nota</span>
                  <small>
                    pengeluaran proyek · No. <b>{nomorBaru}</b>
                  </small>
                </div>
              </header>

              <div className="npg__isian">
                <div className="npg__baris npg__baris--tgl">
                  <label htmlFor="npg-tanggal">Tanggal</label>
                  <div className="npg__nilai">
                    <PilihTanggal id="npg-tanggal" nilai={tanggal} onUbah={setTanggal} bisaKosong={false} maks={hariIni()} />
                  </div>
                  <span className="npg__capslot">
                    <span
                      key={kategori}
                      className={`npg__capjejak${capBaru === kategori ? " is-tercap" : ""}`}
                      aria-label={`Kategori ${LABEL_KATEGORI[kategori]}`}
                    >
                      <Ikon ikon={IKON_KATEGORI[kategori] ?? DotsThree} ukuran={13} />
                      {LABEL_KATEGORI[kategori]}
                    </span>
                  </span>
                </div>
                <div className="npg__baris">
                  <label htmlFor="npg-proyek">Proyek</label>
                  <div className="npg__nilai">
                    <PilihMenu
                      id="npg-proyek"
                      label="Proyek"
                      nilai={aktif?.id ?? ""}
                      onUbah={(v) => {
                        setProyekAktif(v);
                        setPilihProyekId(v);
                      }}
                      opsi={(proyek ?? []).map((p) => ({ nilai: p.id, label: p.title, ket: kodeProyek(p.title) }))}
                      pemicu={
                        <button type="button" className="npg__tulis">
                          <span>{aktif?.title ?? "Pilih proyek"}</span>
                          {aktif && <small>{kodeProyek(aktif.title)}</small>}
                          <Ikon ikon={CaretDown} ukuran={12} className="npg__tuliscaret" />
                        </button>
                      }
                    />
                  </div>
                </div>
                <div className="npg__baris">
                  <label htmlFor="npg-orang">Dibayar kepada</label>
                  <div className="npg__nilai">
                    {/* Boleh KOSONG: biaya operasional memang bukan milik siapa
                        pun. Kolomnya `on delete set null` dengan alasan sama. */}
                    <PilihMenu
                      id="npg-orang"
                      label="Dibayar kepada"
                      nilai={orangId}
                      onUbah={setOrangId}
                      opsi={[
                        { nilai: "", label: "Tanpa orang" },
                        ...JENIS.flatMap((j) =>
                          timAktif
                            .filter((a) => a.kind === j.nilai)
                            .map((a) => ({ nilai: a.id, label: a.name, kelompok: LABEL_JENIS_ANGGOTA[j.nilai] })),
                        ),
                      ]}
                      pemicu={
                        <button type="button" className={`npg__tulis${orang ? "" : " is-kosong"}`}>
                          <span>{orang?.name ?? "tanpa orang"}</span>
                          {orang?.role && <small>{orang.role}</small>}
                          <Ikon ikon={CaretDown} ukuran={12} className="npg__tuliscaret" />
                        </button>
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Tabel tercetak nota kontan: satu baris diisi, sisanya baris
                  kosong yang memang tercetak di formulirnya. */}
              <div className="npg__tabel">
                <div className="npg__tkepala" aria-hidden="true">
                  <span>Keterangan</span>
                  <span>Jumlah (Rp)</span>
                </div>
                <div className="npg__tbaris">
                  <input
                    id="npg-label"
                    className="npg__ketik"
                    aria-label="Untuk keperluan"
                    placeholder="mis. Render eksterior 6 frame"
                    autoComplete="off"
                    value={label}
                    onChange={(e) => setLabel(e.currentTarget.value)}
                  />
                  {/* `inputMode`, bukan `type=number`: type=number menolak
                      titik pemisah ribuan dan memunculkan panah naik-turun. */}
                  <input
                    id="npg-nominal"
                    className="npg__ketik npg__ketik--rp"
                    aria-label="Jumlah"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    value={nominal}
                    onChange={(e) => setNominal(e.currentTarget.value)}
                  />
                </div>
                <div className="npg__tkosong" aria-hidden="true">
                  <span />
                  <span />
                </div>
                <div className="npg__ttotal">
                  <span>Jumlah Rp</span>
                  <b>{angka > 0 ? angka.toLocaleString("id-ID") : "—"}</b>
                </div>
              </div>
              <p className="npg__terbilang">
                <span>Terbilang</span>
                <i>{angka > 0 ? `# ${terbilang(angka)} #` : ""}</i>
              </p>

              <div className="npg__ttd">
                <div>
                  <span>Penerima</span>
                  <b>{orang?.name ?? "………………"}</b>
                </div>
                <div>
                  <span>Hormat kami</span>
                  <b>{studio.nama}</b>
                </div>
              </div>
            </div>
            <span className="npg__rangkap" aria-hidden="true" />
            <span className="npg__rangkap npg__rangkap--2" aria-hidden="true" />
          </div>

          <div className="npg__aksi">
            <p className={`npg__alasan${alasan ? "" : " is-siap"}`} aria-live="polite">
              {alasan ?? `Siap dicatat ke ${aktif ? kodeProyek(aktif.title) : ""}`}
            </p>
            <Tombol jenis="secondary" onClick={kosongkan}>
              Kosongkan
            </Tombol>
            <Tombol memuat={kirim} disabled={!bisaKirim} onClick={simpan}>
              {kirim ? "Menyimpan…" : "Catat pengeluaran"}
            </Tombol>
          </div>
        </section>

        {/* ---- KONTROL PROYEK & PAKU NOTA ------------------------------------ */}
        <section className="npg__kanan" aria-label="Beban proyek dan nota terbaru">
          <div className={`npg__kontrol${lewat ? " is-lewat" : ""}`}>
            <div className="npg__kontrolkop">
              <span className="npg__alis">Beban {aktif ? kodeProyek(aktif.title) : "proyek"}</span>
              <b>{kontrak > 0 ? `${persen(beban + angka)}%` : "—"}</b>
            </div>
            <div className="npg__meter" aria-hidden="true">
              <span className="npg__meter-beban" style={{ width: `${(beban / skala) * 100}%` }} />
              <span className="npg__meter-baru" style={{ width: `${(angka / skala) * 100}%` }} />
              {kontrak > 0 && kontrak < skala && <i style={{ left: `${(kontrak / skala) * 100}%` }} />}
            </div>
            <dl className="npg__angka">
              <div>
                <dt>Nilai kontrak</dt>
                <dd>{kontrak > 0 ? formatRupiah(kontrak) : "belum berkontrak"}</dd>
              </div>
              <div>
                <dt>Sudah keluar</dt>
                <dd>{formatRupiah(beban)}</dd>
              </div>
              <div className={angka > 0 ? "is-baru" : undefined}>
                <dt>Sesudah nota ini</dt>
                <dd>{angka > 0 ? formatRupiah(beban + angka) : "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="npg__pakukop">
            <p className="npg__alis">Paku nota · {paku.length} terakhir</p>
            <a className="npg__semua" href="/admin/keuangan/transaksi?jenis=keluar">
              Lihat semua
            </a>
          </div>
          <div className={`npg__paku${tusuk && !menunggu ? " is-guncang" : ""}`}>
            <span className="npg__ujung" aria-hidden="true" />
            <div className="npg__tumpuk" ref={pakuRef}>
              {atas ? (
                <button
                  type="button"
                  key={atas.id}
                  className={`npg__slip${menunggu ? " is-menunggu" : ""}${!menunggu && tusuk === atas.id ? " is-tusuk" : ""}`}
                  onClick={() => setRinci(atas)}
                  aria-label={`Rincian ${atas.label}, ${formatRupiah(atas.amount)}`}
                >
                  <span className="npg__lubang" aria-hidden="true" />
                  <span className="npg__slipkop">
                    <span>{nomor.get(atas.id) ?? ""}</span>
                    <span>{tglPendek(atas.incurredOn)}</span>
                  </span>
                  <b className="npg__sliplabel">{atas.label}</b>
                  <span className="npg__slipket">
                    {atas.projectTitle ?? "tanpa proyek"}
                    {atas.teamMemberName ? ` · ${atas.teamMemberName}` : ""}
                  </span>
                  <span className="npg__slipkaki">
                    <span className="npg__capkecil">{LABEL_KATEGORI[atas.category] ?? atas.category}</span>
                    <b>{formatRupiah(atas.amount)}</b>
                  </span>
                </button>
              ) : (
                <p className="npg__slip npg__slip--kosong">{biaya === null ? "Memuat…" : "Paku masih kosong."}</p>
              )}
              <ol className={`npg__sembul${tusuk ? " is-turun" : ""}`}>
                {bawah.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      className="npg__strip"
                      onClick={() => setRinci(b)}
                      aria-label={`Rincian ${b.label}, ${formatRupiah(b.amount)}`}
                    >
                      <span>{tglPendek(b.incurredOn)}</span>
                      <span className="npg__stripket">{b.label}</span>
                      <b>{formatRupiah(b.amount)}</b>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            {/* Batang paku tergambar HANYA di celah antara tumpukan dan alas —
                tidak pernah di belakang kertas (jebakan #70). */}
            <span className="npg__batang" aria-hidden="true" />
            <span className="npg__alas" aria-hidden="true" />
          </div>
        </section>
      </div>

      {terbang && (
        <div className="npg__terbang" style={terbang.gaya} aria-hidden="true">
          <NotaTerbang nota={terbang.nota} studio={studio.nama} />
        </div>
      )}

      <DialogBiaya
        biaya={rinci}
        kategori={rinci ? (LABEL_KATEGORI[rinci.category] ?? rinci.category) : ""}
        open={rinci !== null}
        onOpenChange={(b) => !b && setRinci(null)}
        onDihapus={() => muatBiaya().catch(() => {})}
      />
    </div>
  );
}

interface NotaData {
  nomor: string;
  tanggal: string;
  proyek: string;
  kode: string;
  orang: string | null;
  label: string;
  jumlah: number;
  kategori: string;
}

/** Salinan lembar yang sudah diisi — yang disobek dan terbang ke paku.
    Bukan isian lagi, cuma tulisan di kertas. */
function NotaTerbang({ nota, studio }: { nota: NotaData; studio: string }) {
  const [t, b, h] = nota.tanggal.split("-");
  const rp = nota.jumlah.toLocaleString("id-ID");
  return (
    <div className="npg__lembar npg__lembar--salinan">
      <header className="npg__kop">
        <div className="npg__studio">
          <b>{studio}</b>
        </div>
        <div className="npg__judul">
          <span>Nota</span>
          <small>
            pengeluaran proyek · No. <b>{nota.nomor}</b>
          </small>
        </div>
      </header>
      <div className="npg__isian">
        <div className="npg__baris npg__baris--tgl">
          <span>Tanggal</span>
          <span className="npg__tulis">{`${Number(h)} ${BULAN[Number(b) - 1]} ${t}`}</span>
          <span className="npg__capslot">
            <span className="npg__capjejak">{LABEL_KATEGORI[nota.kategori]}</span>
          </span>
        </div>
        <div className="npg__baris">
          <span>Proyek</span>
          <span className="npg__tulis">{nota.proyek}</span>
        </div>
        <div className="npg__baris">
          <span>Dibayar kepada</span>
          <span className="npg__tulis">{nota.orang ?? "tanpa orang"}</span>
        </div>
      </div>
      <div className="npg__tabel">
        <div className="npg__tkepala">
          <span>Keterangan</span>
          <span>Jumlah (Rp)</span>
        </div>
        <div className="npg__tbaris">
          <span className="npg__ketik">{nota.label}</span>
          <span className="npg__ketik npg__ketik--rp">{rp}</span>
        </div>
        <div className="npg__tkosong">
          <span />
          <span />
        </div>
        <div className="npg__ttotal">
          <span>Jumlah Rp</span>
          <b>{rp}</b>
        </div>
      </div>
      <p className="npg__terbilang">
        <span>Terbilang</span>
        <i>{`# ${terbilang(nota.jumlah)} #`}</i>
      </p>
    </div>
  );
}

export function KeluarKit() {
  return (
    <ToastProvider>
      <RequireAuth skeleton={<div className="npg npg--rangka"><div className="npg__papan" /></div>}>
        <Isi />
      </RequireAuth>
    </ToastProvider>
  );
}
