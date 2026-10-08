import { Bagi } from "../kit/Bagi";
import { Peringatan } from "../kit/Tampilan";
import { GagalMuat } from "./gagalMuat";
import { useEffect, useMemo, useRef, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { CATEGORY_LABELS } from "../../lib/api";
import { ToastProvider, useToast } from "../kit/Toast";
import { BarisInbox, BarisBeban } from "../kit/Item";
import { Cari, Centang } from "../kit/Isian";
import { TombolIkon } from "../kit/Tombol";
import { PilihMenu } from "../kit/Formulir";
import { DropdownMenu } from "../kit/Overlay";
import { Donat, BarKemajuan } from "../kit/Ukuran";
import { Ikon } from "../kit/Ikon";
import {
  ArchiveTray,
  ArrowClockwise,
  ArrowLeft,
  CaretDown,
  CaretLeft,
  CaretRight,
  DotsThree,
  DotsThreeVertical,
  PaperPlaneRight,
  Sliders,
} from "../kit/ikon";
import {
  daftarPesan,
  ubahStatusPesan,
  ambilSettings,
  bacaCache,
  tulisCache,
  type Pesan, STATUS_PESAN } from "../../lib/admin";

/* =============================================================================
   Pesan Masuk, mengikuti frame Figma "28. Inbox".

   Kiri daftar pesan, kanan isi pesan yang dipilih — persis framenya. Yang
   diisi ke slotnya:

     Coinest                     Halaman ini
     --------------------------  ----------------------------------------------
     judul surel + tanggal       nama pengirim + waktu kirim
     badan surel                 isi pesan dari form kontak, lalu rinciannya
                                 (jenis proyek, anggaran, telepon) sebagai
                                 daftar berpoin — daftar berpoin framenya
     Budget Categories           Jenis Proyek: pesan per jenis, donat + daftar
     Spending Limits             Ditangani: berapa pesan yang sudah bukan "Baru"
     Finance Score               Tingkat Prospek: porsi pesan jadi prospek
     bintang                     tanda PROSPEK — database tidak punya kolom
                                 bintang, dan status "Prospek" memang yang
                                 dicari dengan bintang di kotak masuk
     tombol unduh / hapus        Balas lewat email / Tandai selesai

   Tidak ada tombol hapus, dan itu sengaja: API-nya cuma bisa mengubah
   status, dan pesan calon klien yang terhapus tidak bisa dicari lagi saat
   orangnya menelepon tiga bulan kemudian. "Selesai" menyingkirkannya dari
   pandangan tanpa menghilangkannya.

   Tiga kartu statistik itu duduk DI DALAM badan pesan, karena di situ
   framenya menaruh tiga widgetnya. Isinya tentang seluruh kotak masuk,
   bukan pesan ini — judulnya menyebut itu.
   ============================================================================= */

/* Label status dan jenis dari lib — panel Pesan di kepala halaman memakai
   yang sama, dan dua salinan pasti menyimpang (jebakan #32): salinan lama
   di panel itu tidak mengenal "renovation", jadi jenisnya hilang di sana. */
const STATUS = STATUS_PESAN;
const JENIS: Record<string, string> = CATEGORY_LABELS;

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus",
  "September", "Oktober", "November", "Desember"];
const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const RENTANG = [
  { nilai: "bulan", label: "Bulan ini" },
  { nilai: "3", label: "3 bulan" },
  { nilai: "semua", label: "Semua" },
];

const jam = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;

/** "03.45" untuk hari ini, "21 Sep" untuk yang lebih lama — seperti framenya. */
function waktuDaftar(iso: string): string {
  const d = new Date(iso);
  const k = new Date();
  if (d.toDateString() === k.toDateString()) return jam(d);
  return `${d.getDate()} ${BULAN_PENDEK[d.getMonth()]}${d.getFullYear() === k.getFullYear() ? "" : ` ${d.getFullYear()}`}`;
}

function waktuPenuh(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}, ${jam(d)}`;
}

/** Tombol ikon yang membuka menu aksi — mengubah status, bukan memilih nilai. */
function PilihIkon({
  ikon,
  judul,
  opsi,
  onPilih,
  disabled,
  ukuran = "xsmall",
  jenis = "ghost",
  ikonPx,
}: {
  ikon: Parameters<typeof TombolIkon>[0]["ikon"];
  judul: string;
  opsi: { nilai: string; label: string }[];
  onPilih: (v: string) => void;
  disabled?: boolean;
  ukuran?: "xsmall" | "small" | "medium";
  jenis?: "ghost" | "transparent";
  ikonPx?: number;
}) {
  const tombol = <TombolIkon ikon={ikon} jenis={jenis} ukuran={ukuran} ikonPx={ikonPx} judul={judul} disabled={disabled} />;
  if (disabled) return tombol;
  return (
    <DropdownMenu
      trigger={tombol}
      sections={[{ label: judul, items: opsi.map((o) => ({ label: o.label, onSelect: () => onPilih(o.nilai) })) }]}
    />
  );
}

function PilihTeks({
  judul,
  nilai,
  opsi,
  onUbah,
}: {
  judul: string;
  nilai: string;
  opsi: { nilai: string; label: string }[];
  onUbah: (v: string) => void;
}) {
  return (
    <PilihMenu
      label={judul}
      nilai={nilai}
      opsi={opsi}
      onUbah={onUbah}
      align="end"
      pemicu={
        <button type="button" className="pes__pilihteks">
          <span>{opsi.find((o) => o.nilai === nilai)?.label ?? judul}</span>
          <Ikon ikon={CaretDown} ukuran={12} />
        </button>
      }
    />
  );
}

function Isi() {
  const toast = useToast();
  const [pesan, setPesan] = useState<Pesan[] | null>(() => bacaCache<Pesan[]>("pesan:"));
  const [galat, setGalat] = useState<string | null>(null);
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState("semua");
  const [pilihId, setPilihId] = useState<string | null>(() =>
    typeof location === "undefined" ? null : new URLSearchParams(location.search).get("id"),
  );
  const [centang, setCentang] = useState<string[]>([]);
  const [rentang, setRentang] = useState("semua");
  /* Di layar sempit daftar dan isi pesan tidak muat berdampingan; yang
     tampil ditentukan ini. Di layar lebar keduanya selalu tampil. */
  const [tampil, setTampil] = useState<"daftar" | "isi">("daftar");
  const [notifAktif, setNotifAktif] = useState<boolean | null>(null);
  const daftarRef = useRef<HTMLDivElement>(null);

  function muat() {
    daftarPesan()
      .then((d) => {
        tulisCache("pesan:", d);
        setPesan(d);
        setGalat(null);
      })
      .catch((e) => setGalat((e as Error).message));
  }

  useEffect(muat, []);
  useEffect(() => {
    ambilSettings()
      .then((s) => setNotifAktif(s.notifikasiEmailAktif !== false))
      .catch(() => setNotifAktif(null));
  }, []);

  const terurut = useMemo(
    () => (pesan ?? []).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)),
    [pesan],
  );

  const tampak = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return terurut.filter(
      (p) =>
        (saring === "semua" || p.status === saring) &&
        (!q ||
          [p.name, p.email, p.phone, p.message, p.budgetRange, p.projectType && JENIS[p.projectType]]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))),
    );
  }, [terurut, cari, saring]);

  /* Yang dipilih harus ada di daftar yang TAMPAK — kalau saringan
     menyembunyikannya, panel kanan pindah ke pesan pertama yang tampak,
     bukan menampilkan pesan yang tidak bisa ditemukan di kirinya. */
  const indeks = tampak.findIndex((p) => p.id === pilihId);
  const kini = indeks >= 0 ? tampak[indeks]! : tampak[0] ?? null;
  const posisi = indeks >= 0 ? indeks : 0;

  function pilih(p: Pesan) {
    setPilihId(p.id);
    setTampil("isi");
    history.replaceState(null, "", `?id=${encodeURIComponent(p.id)}`);
  }

  async function ubah(ids: string[], status: string) {
    const target = (pesan ?? []).filter((p) => ids.includes(p.id) && p.status !== status);
    if (target.length === 0) return;
    const hasil = await Promise.allSettled(target.map((p) => ubahStatusPesan(p.id, status)));
    const berhasil = target.filter((_, i) => hasil[i]!.status === "fulfilled").map((p) => p.id);
    setPesan((cur) => cur?.map((x) => (berhasil.includes(x.id) ? { ...x, status } : x)) ?? null);
    if (berhasil.length === target.length) {
      toast({
        judul: "Status diperbarui",
        keterangan:
          target.length === 1 ? `${target[0]!.name} → ${STATUS[status]}` : `${target.length} pesan → ${STATUS[status]}`,
        nada: "sukses",
      });
    } else {
      toast({
        judul: "Sebagian gagal diperbarui",
        keterangan: `${target.length - berhasil.length} dari ${target.length} pesan tidak berubah. Coba lagi.`,
        nada: "gagal",
      });
    }
  }

  /* ---- Tiga kartu di badan pesan ---------------------------------------- */
  const statJenis = useMemo(() => {
    const k = new Date();
    const batas =
      rentang === "bulan"
        ? new Date(k.getFullYear(), k.getMonth(), 1)
        : rentang === "3"
          ? new Date(k.getFullYear(), k.getMonth() - 2, 1)
          : null;
    const dalam = (pesan ?? []).filter((p) => !batas || new Date(p.createdAt) >= batas);
    const per = new Map<string, number>();
    for (const p of dalam) {
      const j = p.projectType ?? "lain";
      per.set(j, (per.get(j) ?? 0) + 1);
    }
    const urut = [...per.entries()].sort((a, b) => b[1] - a[1]);
    /* Lima baris: framenya lima kategori, dan tangga warnanya berhenti di
       `--ramp-5`. Sisanya digabung — donat yang irisannya tidak berjumlah
       sama dengan angka di tengahnya adalah gambar yang berbohong. */
    const atas = urut.slice(0, urut.length > 5 ? 4 : 5).map(([j, n]) => ({
      kunci: j,
      label: j === "lain" ? "Tanpa jenis" : JENIS[j] ?? j,
      n,
    }));
    if (urut.length > 5) {
      atas.push({ kunci: "sisa", label: "Lainnya", n: urut.slice(4).reduce((a, [, n]) => a + n, 0) });
    }
    return { total: dalam.length, baris: atas.map((b, i) => ({ ...b, ramp: i + 1 })) };
  }, [pesan, rentang]);

  const semua = pesan ?? [];
  const ditangani = semua.filter((p) => p.status !== "new").length;
  const pDitangani = semua.length ? (ditangani / semua.length) * 100 : 0;
  const prospek = semua.filter((p) => p.status === "qualified").length;
  const pProspek = semua.length ? (prospek / semua.length) * 100 : 0;

  const paragraf = (kini?.message ?? "")
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const rincian = kini
    ? ([
        ["Jenis proyek", kini.projectType ? JENIS[kini.projectType] ?? kini.projectType : null],
        ["Anggaran", kini.budgetRange || null],
        ["Telepon", kini.phone || null],
      ].filter(([, v]) => v) as [string, string][])
    : [];

  const semuaTercentang = tampak.length > 0 && tampak.every((p) => centang.includes(p.id));

  if (galat && pesan === null) {
    return (
      <GagalMuat apa="Pesan masuk" galat={galat} />
    );
  }
  if (pesan === null) return <div className="pes pes--rangka" aria-busy="true" />;

  return (
    <>
      {notifAktif === false && (
        <div className="pes__peringatan">
          <Peringatan nada="awas" judul="Pemberitahuan email mati">
            Pesan tetap tersimpan, tapi email ke studio tidak terkirim.
          </Peringatan>
        </div>
      )}
      <div className={`pes pes--${tampil}`}>
        {/* Bagi kit: garis di antara daftar dan isi pesan bisa diseret (atau
            difokus lalu digeser dengan panah) — pesan panjang bisa dibaca
            lebih lebar. Mulai 338px, lebar daftar di frame Inbox. Di ponsel
            keduanya bertumpuk dan garisnya disembunyikan (pesan-kit.css). */}
        <Bagi
          awalKiri={338}
          minKiri={280}
          minKanan="40%"
          label="Geser untuk mengubah lebar daftar pesan"
          kiri={
        <section className="pes__kiri" aria-label="Daftar pesan">
          <div className="pes__atas">
            <Cari
              ukuran="large"
              judul="Cari pesan"
              placeholder="Cari pesan"
              className="pes__cari"
              value={cari}
              onChange={(e) => setCari(e.currentTarget.value)}
            />
            <PilihMenu
              label="Saring status"
              nilai={saring}
              onUbah={setSaring}
              align="end"
              opsi={[{ nilai: "semua", label: "Semua status" }, ...Object.entries(STATUS).map(([v, l]) => ({ nilai: v, label: l }))]}
              pemicu={
                <TombolIkon
                  ikon={Sliders}
                  jenis={saring === "semua" ? "ghost" : "secondary"}
                  ukuran="large"
                  judul="Saring status"
                  className="pes__saring"
                />
              }
            />
          </div>

          <div className="pes__kepaladaftar">
            <span className="pes__semua">
              <Centang
                aria-label="Pilih semua pesan yang tampak"
                checked={semuaTercentang}
                onChange={() => setCentang(semuaTercentang ? [] : tampak.map((p) => p.id))}
              />
              <DropdownMenu
                align="start"
                trigger={
                  <button type="button" className="pes__caret" aria-label="Pilih berdasarkan status">
                    <Ikon ikon={CaretDown} ukuran={10} />
                  </button>
                }
                sections={[
                  {
                    label: "Pilih",
                    items: [
                      { label: "Semua", onSelect: () => setCentang(tampak.map((p) => p.id)) },
                      { label: "Tidak ada", onSelect: () => setCentang([]) },
                      ...Object.entries(STATUS).map(([v, l]) => ({
                        label: `Yang ${l.toLowerCase()}`,
                        onSelect: () => setCentang(tampak.filter((p) => p.status === v).map((p) => p.id)),
                      })),
                    ],
                  },
                ]}
              />
              {centang.length > 0 && <span className="pes__jumlahpilih">{centang.length} dipilih</span>}
            </span>
            <span className="pes__aksidaftar">
              <TombolIkon ikon={ArrowClockwise} jenis="ghost" ukuran="xsmall" judul="Muat ulang" onClick={muat} />
              <PilihIkon
                ikon={DotsThreeVertical}
                judul={centang.length ? `Ubah status ${centang.length} pesan` : "Centang pesan dulu untuk mengubah statusnya"}
                disabled={centang.length === 0}
                opsi={Object.entries(STATUS).map(([v, l]) => ({ nilai: v, label: `Tandai ${l.toLowerCase()}` }))}
                onPilih={(v) => ubah(centang, v).then(() => setCentang([]))}
              />
            </span>
          </div>

          <div className="pes__daftar" ref={daftarRef}>
            {tampak.map((p) => (
              <BarisInbox
                key={p.id}
                className={[
                  "pes__baris",
                  kini?.id === p.id && "is-aktif",
                  p.status === "new" && "is-baru",
                ]
                  .filter(Boolean)
                  .join(" ")}
                dipilih={centang.includes(p.id)}
                onPilih={(v) => setCentang((c) => (v ? [...c, p.id] : c.filter((x) => x !== p.id)))}
                pengirim={
                  /* Tombol peregang: ::after-nya menutup seluruh baris, jadi
                     baris bisa diklik di mana pun tanpa membungkus kotak
                     centang dan bintang di dalam <button> — yang tidak sah. */
                  <button
                    type="button"
                    className="pes__buka"
                    aria-current={kini?.id === p.id ? "true" : undefined}
                    onClick={() => pilih(p)}
                  >
                    {p.name}
                  </button>
                }
                waktu={<time dateTime={p.createdAt}>{waktuDaftar(p.createdAt)}</time>}
                dibintangi={p.status === "qualified"}
                onBintang={() => ubah([p.id], p.status === "qualified" ? "contacted" : "qualified")}
              >
                {p.message}
              </BarisInbox>
            ))}
            {tampak.length === 0 && (
              <p className="pes__kosong">
                {semua.length === 0
                  ? "Belum ada pesan masuk. Pesan dari form kontak akan muncul di sini, dan salinannya dikirim ke email studio."
                  : "Tidak ada pesan yang cocok dengan pencarian atau saringan ini."}
              </p>
            )}
          </div>
        </section>
          }
          kanan={
        <section className="pes__kanan" aria-label="Isi pesan">
          <div className="pes__alat">
            <span className="pes__alatkiri">
              <TombolIkon
                ikon={ArrowLeft}
                jenis="transparent"
                judul="Kembali ke daftar"
                ikonPx={22}
                className="pes__kembali"
                onClick={() => {
                  setTampil("daftar");
                  daftarRef.current?.querySelector<HTMLElement>(".is-aktif .pes__buka")?.focus();
                }}
              />
              <span className="pes__alattengah">
                <TombolIkon
                  ikon={PaperPlaneRight}
                  jenis="transparent"
                  judul="Balas lewat email"
                  ikonPx={22}
                  href={
                    kini
                      ? `mailto:${kini.email}?subject=${encodeURIComponent("Balasan dari Studio Dirga Pahlevi Architecture")}`
                      : undefined
                  }
                  disabled={!kini}
                />
                <TombolIkon
                  ikon={ArchiveTray}
                  jenis="transparent"
                  judul="Tandai selesai"
                  ikonPx={22}
                  disabled={!kini || kini.status === "closed"}
                  onClick={() => kini && ubah([kini.id], "closed")}
                />
                <PilihIkon
                  ikon={DotsThreeVertical}
                  judul="Ubah status pesan ini"
                  jenis="transparent"
                  ikonPx={22}
                  disabled={!kini}
                  opsi={Object.entries(STATUS).map(([v, l]) => ({ nilai: v, label: l }))}
                  onPilih={(v) => kini && ubah([kini.id], v)}
                />
              </span>
            </span>
            <span className="pes__alatkanan">
              <span className="pes__posisi">
                {tampak.length ? `${posisi + 1} dari ${tampak.length}` : "0 dari 0"}
              </span>
              <TombolIkon
                ikon={CaretLeft}
                jenis="transparent"
                judul="Pesan sebelumnya"
                ikonPx={24}
                disabled={posisi <= 0}
                onClick={() => tampak[posisi - 1] && pilih(tampak[posisi - 1]!)}
              />
              <TombolIkon
                ikon={CaretRight}
                jenis="transparent"
                judul="Pesan berikutnya"
                ikonPx={24}
                disabled={posisi >= tampak.length - 1}
                onClick={() => tampak[posisi + 1] && pilih(tampak[posisi + 1]!)}
              />
            </span>
          </div>

          {kini ? (
            <article className="pes__surat">
              <header className="pes__kepala">
                <h2 className="pes__judul">{kini.name}</h2>
                <p className="pes__waktu">
                  <time dateTime={kini.createdAt}>{waktuPenuh(kini.createdAt)}</time>
                  <span className="pes__status">{STATUS[kini.status] ?? kini.status}</span>
                </p>
              </header>
              <div className="pes__badan">
                {paragraf.map((t, i) => (
                  <p key={i}>{t}</p>
                ))}
                {rincian.length > 0 && (
                  <ul className="pes__poin">
                    {rincian.map(([k, v]) => (
                      <li key={k}>
                        {k}: {v}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="pes__fitur">
                  <section className="pes__jenis">
                    <div className="pes__jeniskiri">
                      <h3 className="pes__kartujudul">Jenis Proyek</h3>
                      <Donat
                        className="pes__donat"
                        label="Total pesan"
                        nilai={statJenis.total}
                        iris={statJenis.baris.map((b) => ({ nilai: b.n, warna: `var(--ramp-${b.ramp})`, label: b.label, ket: `${b.n} pesan` }))}
                      />
                    </div>
                    <div className="pes__jeniskanan">
                      <PilihTeks judul="Rentang jenis proyek" nilai={rentang} opsi={RENTANG} onUbah={setRentang} />
                      <div className="pes__jenisdaftar">
                        {statJenis.baris.map((b) => (
                          <BarisBeban
                            key={b.kunci}
                            warna={`var(--ramp-${b.ramp})`}
                            tinta={`var(--ramp-${b.ramp}-ink)`}
                            persen={`${Math.round((b.n / (statJenis.total || 1)) * 100)}%`}
                            kategori={b.label}
                            nominal={`${b.n} pesan`}
                          />
                        ))}
                        {statJenis.baris.length === 0 && <p className="pes__kosong">Belum ada pesan pada rentang ini.</p>}
                      </div>
                    </div>
                  </section>

                  <div className="pes__fiturkanan">
                    <section className="pes__mint pes__tangani">
                      <div className="pes__mintkepala">
                        <h3 className="pes__kartujudul">Sudah Ditangani</h3>
                        <TombolIkon
                          ikon={DotsThreeVertical}
                          jenis="transparent"
                          ukuran="xsmall"
                          judul="Tampilkan yang belum ditangani"
                          onClick={() => {
                            setSaring("new");
                            setTampil("daftar");
                          }}
                        />
                      </div>
                      <BarKemajuan
                        className="pes__bar"
                        persen={pDitangani}
                        tinggi={20}
                        celah={6}
                        judul="Pesan yang sudah ditangani"
                      />
                      <p className="pes__barket">
                        <span>
                          <b>{ditangani} pesan</b> dari {semua.length}
                        </span>
                        <span>{Math.round(pDitangani)}%</span>
                      </p>
                    </section>

                    <section className="pes__mint pes__prospek">
                      <div className="pes__mintkepala">
                        <h3 className="pes__kartujudul">Tingkat Prospek</h3>
                        <TombolIkon
                          ikon={DotsThree}
                          jenis="transparent"
                          ukuran="xsmall"
                          judul="Tampilkan prospek"
                          ikonPx={18}
                          onClick={() => {
                            setSaring("qualified");
                            setTampil("daftar");
                          }}
                        />
                      </div>
                      <p className="pes__skorlabel">Pesan yang jadi prospek</p>
                      <p className="pes__skorbaris">
                        <b>{pProspek >= 30 ? "Tinggi" : pProspek >= 15 ? "Sedang" : "Rendah"}</b>
                        <span>{Math.round(pProspek)}%</span>
                      </p>
                      <BarKemajuan
                        className="pes__bar"
                        persen={pProspek}
                        tinggi={25}
                        celah={6}
                        judul="Porsi pesan yang jadi prospek"
                      />
                    </section>
                  </div>
                </div>

                <p className="pes__kaki">
                  Dikirim lewat form kontak situs oleh {kini.name}.
                  <br />
                  <a href={`mailto:${kini.email}`}>{kini.email}</a>
                  {kini.phone ? ` · ${kini.phone}` : ""}
                </p>
              </div>
            </article>
          ) : (
            <p className="pes__kosong pes__kosong--isi">Pilih pesan di kiri untuk membacanya.</p>
          )}
        </section>
          }
        />
      </div>
    </>
  );
}

export function PesanKit() {
  return (
    <RequireAuth skeleton={<div className="pes pes--rangka" />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
