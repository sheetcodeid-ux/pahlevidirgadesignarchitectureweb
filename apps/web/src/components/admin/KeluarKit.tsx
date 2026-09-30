import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { DialogBiaya } from "./biayaKit";
import { DropdownMenu } from "../ui/overlay/Menu";
import { navigate } from "astro:transitions/client";
import { KepalaSeksi, BarisTransfer, BarisPenyedia } from "../kit/Item";
import { KelompokTab } from "../kit/Segmen";
import { Cari } from "../kit/Isian";
import { Tombol, TombolIkon } from "../kit/Tombol";
import { Ikon, type DataIkon } from "../kit/Ikon";
import { TombolBulat } from "../kit/Item";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import {
  Users,
  House,
  Medal,
  DotsThree,
  Sliders,
  NavReceipt,
  CoinOut,
  SpecialHandshake,
  UserCircleCheck,
  IdentificationBadge,
  Ruler,
} from "../kit/ikon";
import {
  daftarProyek,
  daftarTim,
  semuaBiaya,
  catatBiaya,
  ambilRingkasanKeuangan,
  bacaCache,
  tulisCache,
  LABEL_JENIS_ANGGOTA,
  type Proyek,
  type AnggotaTim,
  type JenisAnggota,
  type BiayaProyek,
  type FinanceOverview,
} from "../../lib/admin";
import { proyekAktif, setProyekAktif, onProyekAktif } from "../../lib/proyekAktif";
import { formatRupiah } from "../../lib/format";

/* =============================================================================
   Catat Pengeluaran — frame Figma "10. Payment".

   Kerangkanya sama persis dengan frame 07 (Terima Pembayaran) dan karena itu
   CSS-nya dipakai bersama lewat `bayar-kit.css`. Yang berbeda isi kolom
   kirinya dan susunan isian di panelnya.

   Pemetaannya:

     Coinest                        Halaman ini
     ----------------------------   ------------------------------------------
     4 tab mode kiri                `cost_category`: freelancer / operasional /
                                    prinsipal / lainnya — PERSIS empat
     Cari penyedia                  cari orang
     Akordeon kategori → penyedia   `member_kind`: partner / inti / proyek /
                                    staf — juga PERSIS empat — berisi orangnya
     Recent Payments (3 kartu)      biaya terbaru lintas proyek
     Payment Account (2 kartu)      nilai kontrak / beban sejauh ini
     Service Provider (2 pemilih)   proyek / dibayar ke
     Virtual Account                keterangan biaya (`label`)
     Amount                         nominal (+ tanggal, lihat di bawah)
     Cancel / Proceed to Payment    Batal / Catat Pengeluaran

   Tiga selisih yang DISENGAJA:

   1. Baris terakhir di framenya SATU isian selebar 756. Di sini ia dipecah
      dua sama besar supaya tanggal punya tempat. `incurred_on` adalah
      "tanggal biaya benar-benar terjadi, bukan kapan diketik" — kolomnya ada
      justru karena staf mengetik nota lama — jadi halaman pencatat biaya
      yang tidak bisa mengisinya akan salah mencatat setiap nota yang tidak
      dimasukkan pada hari yang sama. Bentuk dua-kolomnya bukan karangan:
      frame 07 memakai baris dua-kolom yang sama persis, jadi ia memang
      bahasa visual file ini.
   2. Kartu "Payment Account" di framenya bisa DIPILIH. Di sini keduanya cuma
      angka proyek terpilih: nilai kontrak dan beban yang sudah keluar.
      Gambar kartu kreditnya diganti ubin 56 berikon — kita tidak punya
      gambar kartu, dan menggambarnya sendiri berarti mengarang benda yang
      tidak ada.
   3. Kedua pemilih diberi labelnya sendiri; di framenya satu label
      "Service Provider" memayungi keduanya. "Proyek" dan "Dibayar ke"
      bukan dua sisi satu hal seperti kategori-dan-penyedia di sana.

   Kenapa tab atasnya kategori dan BUKAN navigasi antar-halaman, seperti
   Coinest memakainya (Transfer/Payment = frame 07 dan 10): dengan navigasi,
   `cost_category` tidak punya tempat sama sekali di halaman ini — akordeon
   kirinya sudah dipakai jenis anggota, dan keempat slot isian di panelnya
   sudah terisi. Itu satu-satunya susunan yang memberi setiap kolom database
   sebuah tempat. Kalau pemilik lebih suka tab navigasi, yang harus ikut
   pindah adalah kategorinya, dan itu berarti satu isian tambahan yang tidak
   ada slotnya di framenya.
   ============================================================================= */

const KATEGORI: { nilai: string; label: string; ikon: DataIkon }[] = [
  { nilai: "freelancer", label: "Freelancer", ikon: Users },
  { nilai: "operasional", label: "Operasional", ikon: House },
  { nilai: "prinsipal", label: "Prinsipal", ikon: Medal },
  { nilai: "lainnya", label: "Lainnya", ikon: DotsThree },
];

const LABEL_KATEGORI: Record<string, string> = Object.fromEntries(
  KATEGORI.map((k) => [k.nilai, k.label]),
);

/* Urutan kelompok akordeon mengikuti kedekatan ke studio, bukan abjad:
   partner dulu, staf tetap terakhir. */
const JENIS: { nilai: JenisAnggota; ikon: DataIkon }[] = [
  { nilai: "partner", ikon: SpecialHandshake },
  { nilai: "inti", ikon: UserCircleCheck },
  { nilai: "proyek", ikon: Users },
  { nilai: "staf", ikon: IdentificationBadge },
];

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function tanggalPendek(iso: string): string {
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${BULAN[d.getMonth()]}`;
}

function hariIni(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "12.500.000" / "Rp12.500.000" -> 12500000. */
function keAngka(teks: string): number {
  const bersih = teks.replace(/[^\d]/g, "");
  return bersih ? Number(bersih) : 0;
}

function Isi() {
  const toast = useToast();

  const [proyek, setProyek] = useState<Proyek[] | null>(() => bacaCache<Proyek[]>("proyek"));
  const [tim, setTim] = useState<AnggotaTim[] | null>(() => bacaCache<AnggotaTim[]>("tim"));
  /* Biaya yang sedang dibuka rinciannya (dan bisa dihapus). */
  const [rinci, setRinci] = useState<BiayaProyek | null>(null);
  const [biaya, setBiaya] = useState<BiayaProyek[] | null>(() =>
    bacaCache<BiayaProyek[]>("biaya-semua"),
  );
  const [ringkas, setRingkas] = useState<FinanceOverview | null>(() =>
    bacaCache<FinanceOverview>("keuangan:semua"),
  );

  const [kategori, setKategori] = useState("freelancer");
  const [buka, setBuka] = useState<JenisAnggota | null>("proyek");
  const [cari, setCari] = useState("");
  const [pilihProyekId, setPilihProyekId] = useState<string | null>(() => proyekAktif());
  const [orangId, setOrangId] = useState<string>("");
  const [label, setLabel] = useState("");
  const [nominal, setNominal] = useState("");
  const [tanggal, setTanggal] = useState(hariIni);
  const [kirim, setKirim] = useState(false);

  useEffect(() => onProyekAktif(setPilihProyekId), []);

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
    semuaBiaya()
      .then((d) => {
        tulisCache("biaya-semua", d);
        setBiaya(d);
      })
      .catch(() => setBiaya((l) => l ?? []));
    ambilRingkasanKeuangan(null)
      .then((d) => {
        tulisCache("keuangan:semua", d);
        setRingkas(d);
      })
      .catch(() => {});
  }, []);

  const aktif = useMemo(() => {
    const d = proyek ?? [];
    return d.find((p) => p.id === pilihProyekId) ?? d[0] ?? null;
  }, [proyek, pilihProyekId]);

  /* Angka beban proyek datang dari ringkasan keuangan, bukan dari daftar
     proyek: `daftarProyek` memuat nilai kontrak dan uang masuk, tapi TIDAK
     memuat total biaya. */
  const barisKeu = useMemo(
    () => (ringkas?.proyek ?? []).find((p) => p.projectId === aktif?.id) ?? null,
    [ringkas, aktif?.id],
  );

  const kontrak = aktif?.contractValue ?? barisKeu?.contractValue ?? 0;
  const beban = barisKeu?.costsTotal ?? 0;

  const orangTersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const d = (tim ?? []).filter((a) => a.active);
    if (!q) return d;
    return d.filter(
      (a) => a.name.toLowerCase().includes(q) || (a.role ?? "").toLowerCase().includes(q),
    );
  }, [tim, cari]);

  /* Pencarian membuka sendiri kelompok yang punya hasil. Tanpa itu staf
     mengetik nama yang memang ada dan kolomnya tampak kosong, karena
     kelompoknya kebetulan tertutup. */
  const kelompok = useMemo(
    () =>
      JENIS.map((j) => ({
        ...j,
        orang: orangTersaring.filter((a) => a.kind === j.nilai),
      })),
    [orangTersaring],
  );
  const mencari = cari.trim().length > 0;

  const angka = keAngka(nominal);
  const bisaKirim = Boolean(aktif) && angka > 0 && label.trim().length >= 2 && !kirim;

  async function simpan() {
    if (!aktif || !bisaKirim) return;
    setKirim(true);
    try {
      await catatBiaya({
        projectId: aktif.id,
        label: label.trim(),
        category: kategori,
        amount: angka,
        incurredOn: tanggal || undefined,
        teamMemberId: orangId || null,
      });
      toast({
        judul: "Pengeluaran tercatat",
        keterangan: `${formatRupiah(angka)} — ${LABEL_KATEGORI[kategori]} di ${aktif.title}.`,
        nada: "sukses",
      });
      setLabel("");
      setNominal("");
      /* Daftar biaya DAN ringkasan keuangan ikut disegarkan: strip di kanan
         atas dan kartu "beban sejauh ini" keduanya baru saja berubah. */
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

  return (
    <div className="tr">
      {/* ---- Kolom kiri --------------------------------------------------- */}
      <section className="tr__kiri">
        <KelompokTab
          className="tr__metode"
          judul="Kategori pengeluaran"
          tab={KATEGORI}
          nilai={kategori}
          onPilih={setKategori}
        />

        <div className="tr__cari">
          <Cari
            ukuran="large"
            judul="Cari orang"
            placeholder="Cari orang"
            value={cari}
            onChange={(e) => setCari(e.currentTarget.value)}
          />
          {/* Membawa ke tempat daftar orangnya diurus — sempat tanpa aksi. */}
          <TombolBulat ikon={Sliders} judul="Kelola di Tim & Freelancer" onClick={() => navigate("/admin/tim")} />
        </div>

        <div className="tr__daftar">
          <div className="tr__gulir">
            {kelompok.map((k) => {
              const terbuka = mencari ? k.orang.length > 0 : buka === k.nilai;
              return (
                <div key={k.nilai} className={`tr__akor${terbuka ? " is-terbuka" : ""}`}>
                  <BarisPenyedia
                    ikon={k.ikon}
                    nama={LABEL_JENIS_ANGGOTA[k.nilai]}
                    bentuk="kartu"
                    aria-expanded={terbuka}
                    onClick={() => setBuka(terbuka ? null : k.nilai)}
                  />
                  {terbuka && (
                    <ul className="tr__anak">
                      {k.orang.map((a) => (
                        <li key={a.id}>
                          <BarisPenyedia
                            ikon={k.ikon}
                            nama={a.name}
                            bentuk="rinci"
                            aktif={orangId === a.id}
                            onClick={() => setOrangId(orangId === a.id ? "" : a.id)}
                          />
                        </li>
                      ))}
                      {k.orang.length === 0 && (
                        <li>
                          <p className="tr__kosongkecil">
                            {mencari ? "Tidak ada yang cocok." : "Belum ada orang di kelompok ini."}
                          </p>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              );
            })}
            {tim !== null && tim.length === 0 && (
              <p className="tr__kosong">Belum ada anggota tim terdaftar.</p>
            )}
          </div>
          <span className="tr__tirai" />
        </div>
      </section>

      {/* ---- Kolom kanan -------------------------------------------------- */}
      <section className="tr__kanan">
        <article className="tr__kartu tr__baru">
          <KepalaSeksi
            judul="Biaya Terbaru"
            kanan={
              <Tombol
                ukuran="small"
                jenis="transparent"
                /* Ke Semua Transaksi yang sudah tersaring ke uang KELUAR — dulu
                   ke Ringkasan, yang tidak memuat daftar biaya sama sekali. */
                onClick={() => navigate("/admin/keuangan/transaksi?jenis=keluar")}
              >
                Lihat semua
              </Tombol>
            }
          />
          <div className="tr__strip">
            {(biaya ?? []).slice(0, 8).map((b) => (
              <BarisTransfer
                key={b.id}
                gambar={<Ikon ikon={CoinOut} ukuran={18} />}
                nama={formatRupiah(b.amount)}
                /* Proyek di baris kedua dan kategori di pojok kanan bawah,
                   bukan keduanya disambung: kartu ini 279 tetap, dan
                   "Freelancer · Rumah Tropis Sungai Raya" tidak pernah muat
                   dalam satu baris. */
                rekening={b.projectTitle ?? "tanpa proyek"}
                kananAtas={tanggalPendek(b.incurredOn)}
                kananBawah={LABEL_KATEGORI[b.category] ?? b.category}
                onClick={() => setRinci(b)}
                judul={`Rincian biaya ${b.label}, ${formatRupiah(b.amount)}`}
              />
            ))}
            {(biaya ?? []).length === 0 && (
              <p className="tr__kosong">Belum ada biaya tercatat.</p>
            )}
          </div>
        </article>

        <article className="tr__kartu tr__form">
          <KepalaSeksi
            judul="Catat Pengeluaran"
            kanan={
              /* ⋯ di framenya: sempat hiasan tanpa aksi. Isinya halaman yang
                 wajar dituju sesudah mencatat — bukan aksi baru. */
              <DropdownMenu
                trigger={<TombolIkon ikon={DotsThree} jenis="transparent" judul="Aksi lain" ikonPx={22} />}
                sections={[
                  {
                    label: "Buka",
                    items: ([["Semua transaksi", "list", "/admin/keuangan/transaksi"], ["Fee proyek", "cash", "/admin/fee"], ["Gaji", "bank", "/admin/gaji"]] as const).map(([label, icon, ke]) => ({ label, icon, onSelect: () => navigate(ke) })),
                  },
                ]}
              />
            }
          />

          <div className="tr__panel">
            <div className="tr__grup">
              <p className="tr__label">Ringkasan proyek</p>
              <div className="tr__akun">
                <div className="tr__akunkartu tr__akunkartu--utama">
                  <span className="tr__akunubin">
                    <Ikon ikon={NavReceipt} ukuran={24} />
                  </span>
                  <div className="tr__akunisi">
                    <p className="tr__akunlabel">Nilai kontrak</p>
                    <p className="tr__akunnilai">{formatRupiah(kontrak)}</p>
                    <p className="tr__akunket">{aktif?.title ?? "belum ada proyek"}</p>
                  </div>
                </div>
                <div className="tr__akunkartu tr__akunkartu--sisa">
                  <span className="tr__akunubin">
                    <Ikon ikon={CoinOut} ukuran={24} />
                  </span>
                  <div className="tr__akunisi">
                    <p className="tr__akunlabel">Beban sejauh ini</p>
                    <p className="tr__akunnilai">{formatRupiah(beban)}</p>
                    <p className="tr__akunket">
                      {kontrak > 0
                        ? `${Math.round((beban / kontrak) * 100)}% dari nilai kontrak`
                        : "belum berkontrak"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="tr__duaan">
              <div className="tr__grup">
                <label className="tr__label" htmlFor="kl-proyek">
                  Proyek
                </label>
                <div className="tr__pilih">
                  <span className="tr__pilihubin">
                    <Ikon ikon={Ruler} ukuran={14} />
                  </span>
                  <select
                    id="kl-proyek"
                    value={aktif?.id ?? ""}
                    onChange={(e) => {
                      setProyekAktif(e.currentTarget.value);
                      setPilihProyekId(e.currentTarget.value);
                    }}
                  >
                    {(proyek ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="tr__grup">
                <label className="tr__label" htmlFor="kl-orang">
                  Dibayar ke
                </label>
                <div className="tr__pilih">
                  <span className="tr__pilihubin">
                    <Ikon ikon={Users} ukuran={14} />
                  </span>
                  {/* Boleh KOSONG, dan itu disengaja: biaya operasional memang
                      bukan milik siapa pun. Kolomnya `on delete set null`
                      dengan alasan yang sama. */}
                  <select
                    id="kl-orang"
                    value={orangId}
                    onChange={(e) => setOrangId(e.currentTarget.value)}
                  >
                    <option value="">Tanpa orang</option>
                    {(tim ?? [])
                      .filter((a) => a.active)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="tr__grup">
              <label className="tr__label" htmlFor="kl-label">
                Keterangan biaya
              </label>
              <div className="k-isian__kotak">
                <input
                  id="kl-label"
                  className="k-isian__input"
                  placeholder="mis. Render eksterior 6 frame"
                  value={label}
                  onChange={(e) => setLabel(e.currentTarget.value)}
                />
              </div>
            </div>

            <div className="tr__duaan">
              <div className="tr__grup">
                <label className="tr__label" htmlFor="kl-nominal">
                  Nominal
                </label>
                <div className="k-isian__kotak">
                  <input
                    id="kl-nominal"
                    className="k-isian__input"
                    /* `inputMode`, bukan `type=number`: type=number menolak
                       titik pemisah ribuan dan memunculkan panah naik-turun
                       yang tidak ada gunanya untuk rupiah. */
                    inputMode="numeric"
                    placeholder="0"
                    value={nominal}
                    onChange={(e) => setNominal(e.currentTarget.value)}
                  />
                </div>
              </div>
              <div className="tr__grup">
                <label className="tr__label" htmlFor="kl-tanggal">
                  Tanggal
                </label>
                <div className="k-isian__kotak">
                  <input
                    id="kl-tanggal"
                    className="k-isian__input"
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.currentTarget.value)}
                  />
                </div>
              </div>
            </div>

            <div className="tr__aksi">
              <Tombol
                ukuran="large"
                jenis="secondary"
                onClick={() => {
                  setLabel("");
                  setNominal("");
                  setOrangId("");
                  setTanggal(hariIni());
                }}
              >
                Batal
              </Tombol>
              <Tombol ukuran="large" disabled={!bisaKirim} onClick={simpan}>
                {kirim ? "Menyimpan…" : "Catat Pengeluaran"}
              </Tombol>
            </div>
          </div>
        </article>
      </section>
      <DialogBiaya
        biaya={rinci}
        kategori={rinci ? LABEL_KATEGORI[rinci.category] ?? rinci.category : ""}
        open={rinci !== null}
        onOpenChange={(b) => !b && setRinci(null)}
        onDihapus={() =>
          semuaBiaya()
            .then((d) => {
              tulisCache("biaya-semua", d);
              setBiaya(d);
            })
            .catch(() => {})
        }
      />
    </div>
  );
}

export function KeluarKit() {
  return (
    <ToastProvider>
      <RequireAuth skeleton={<div className="tr tr--rangka" />}>
        <Isi />
      </RequireAuth>
    </ToastProvider>
  );
}
