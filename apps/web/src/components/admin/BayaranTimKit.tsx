import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast } from "../kit/Toast";
import { Avatar } from "../kit/Tampilan";
import { Ikon } from "../kit/Ikon";
import { Segmen } from "../kit/Segmen";
import { Tombol } from "../kit/Tombol";
import { Keterangan, pemberiKet, type KabarKartu } from "../kit/kartuGrafik";
import {
  ArrowClockwise,
  ArrowRight,
  ChatTeardropDots,
  Check,
  FilePdf,
  FileText,
  Hourglass,
  PaperPlaneRight,
  Phone,
  SpecialWarning,
} from "../kit/ikon";
import {
  ambilRiwayatSlip,
  ambilSettings,
  ambilSlip,
  bacaCache,
  daftarTim,
  gajiBulan,
  penugasanOrang,
  ringkasanBayaranTim,
  tulisCache,
  LABEL_JENIS_ANGGOTA,
  LABEL_PERAN,
  type AnggotaTim,
  type BarisGajiBulan,
  type BulanSlip,
  type PenugasanTim,
  type RingkasanBayaranOrang,
  type SlipGaji,
  type TahapBayaran,
} from "../../lib/admin";
import { formatRupiah } from "../../lib/format";
import { keteranganFee, unduhSlipGaji } from "../../lib/pdfProyek";
import { terbilang } from "../../lib/terbilang";
import { BULAN, BULAN_PENDEK } from "./frame25";
import { DialogBayar, SYARAT, type PilihanBayar } from "./timProyekKit";

/* =============================================================================
   Bayaran Tim — MEJA GAJI.

   Pengganti sheet "GAJI ADJI / DANY / RAFFI". Di dunia nyata pekerjaan ini
   dikerjakan di satu meja dengan tiga benda, dan halamannya disusun persis
   begitu:

   1. RAK AMPLOP (kiri) — satu amplop per orang: berapa yang masih terutang,
      dan meteran dibayar / jatuh tempo / belum tempo. Di atasnya jumlah untuk
      seluruh tim dengan meteran yang sama.
   2. BUKU UPAH (tengah) — hak orang terpilih per proyek, tiap proyek satu
      LINTASAN dua ruas (tahap awal saat DP, tahap akhir saat Finish) yang
      lebarnya sebanding nominalnya. Ruas yang jatuh tempo membawa tombol
      Bayar — pencatat yang sama dengan Satu Proyek (`DialogBayar`).
   3. SLIP (kanan) — kertas slip bulan terpilih, atau PESAN WhatsApp yang akan
      terkirim; dua wujud tempat datanya benar-benar sampai ke orangnya.

   Bulan slip dipilih dari RIWAYAT DUA BELAS BULAN di kepala orang — batang
   gaji + fee tiap bulan, dari endpoint yang memakai saringan yang sama dengan
   slip, jadi batang dan total slip tidak bisa berbeda.

   Tidak ada angka yang diketik di sini ("fee menulis, gaji membaca"): gaji
   diketik di halaman Gaji, bayaran tahap dicatat sebagai biaya proyek.
   ============================================================================= */

const kunciBulan = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const labelBulan = (k: string) => `${BULAN[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;
const tanggalPendek = (iso: string) => {
  const [t, b, h] = iso.slice(0, 10).split("-").map(Number);
  return `${h} ${BULAN_PENDEK[(b ?? 1) - 1]} ${t}`;
};
const tanggalTanpaTahun = (iso: string) => {
  const [, b, h] = iso.slice(0, 10).split("-").map(Number);
  return `${h} ${BULAN_PENDEK[(b ?? 1) - 1]}`;
};
const BULAN_INI = kunciBulan(new Date());

/** Nomor amplop/slip: "GJ-2610-BP" = gaji, tahun-bulan, inisial penerima.
 *  Diturunkan dari data (bulan + nama), bukan nomor urut karangan. */
function nomorAmplop(nama: string, period: string): string {
  const inisial = nama.split(/\s+/).filter(Boolean).slice(0, 2).map((k) => k[0]!.toUpperCase()).join("") || "X";
  return `GJ-${period.slice(2, 4)}${period.slice(5, 7)}-${inisial}`;
}

/** Nomor Indonesia untuk wa.me: "0812-3456-7890" / "+62 812…" → "62812…". */
export function nomorWa(telepon: string | null | undefined): string | null {
  const d = (telepon ?? "").replace(/\D/g, "");
  if (d.length < 9) return null;
  if (d.startsWith("62")) return d;
  if (d.startsWith("0")) return `62${d.slice(1)}`;
  if (d.startsWith("8")) return `62${d}`;
  return d;
}
/** "6281312345678" → "+62 813-1234-5678", untuk dibaca, bukan untuk dikirim. */
function tampilWa(n: string): string {
  const s = n.slice(2);
  return `+62 ${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7)}`;
}

function teksWa(slip: SlipGaji, namaBulan: string): string {
  const baris = [`Slip gaji ${namaBulan} — ${slip.name}`, ""];
  if (slip.salary) baris.push(`Gaji pokok: ${formatRupiah(slip.salary.amount)}`);
  if (slip.fees.length) {
    baris.push("Fee proyek:");
    for (const f of slip.fees) baris.push(`• ${f.projectTitle} — ${keteranganFee(f)} (${tanggalPendek(f.incurredOn)}): ${formatRupiah(f.amount)}`);
  }
  baris.push("", `Total: ${formatRupiah(slip.total)}`);
  return baris.join("\n");
}

/* --- Meteran dibayar / jatuh tempo / belum tempo ---------------------------
   Satu bentuk untuk tim dan untuk tiap orang — membaca satu sama dengan
   membaca yang lain. Lebarnya bagian dari HAK; hak nol = meteran kosong. */
const WARNA = { dibayar: "var(--ramp-1)", tempo: "var(--warn)", belum: "var(--ramp-4)", gaji: "var(--ramp-1)", fee: "var(--ramp-2)" };

interface Bagian { dibayar: number; tempo: number; belum: number }
const bagianDari = (r: { dibayar: number; terutang: number; jatuhTempo: number } | null): Bagian =>
  r ? { dibayar: r.dibayar, tempo: r.jatuhTempo, belum: Math.max(0, r.terutang - r.jatuhTempo) } : { dibayar: 0, tempo: 0, belum: 0 };

function Meteran({ b, label, besar }: { b: Bagian; label: string; besar?: boolean }) {
  const jumlah = b.dibayar + b.tempo + b.belum;
  const pct = (n: number) => (jumlah > 0 ? `${(n / jumlah) * 100}%` : "0%");
  return (
    <span
      className={`byt__meter${besar ? " byt__meter--besar" : ""}`}
      role="img"
      aria-label={`${label}: dibayar ${formatRupiah(b.dibayar)}, jatuh tempo ${formatRupiah(b.tempo)}, belum tempo ${formatRupiah(b.belum)}`}
    >
      <i className="m-bayar" style={{ width: pct(b.dibayar) }} />
      <i className="m-tempo" style={{ width: pct(b.tempo) }} />
      <i className="m-belum" style={{ width: pct(b.belum) }} />
    </span>
  );
}

interface Orang {
  id: string;
  nama: string;
  anggota: AnggotaTim | null;
  r: RingkasanBayaranOrang | null;
}

function Isi() {
  const toast = useToast();
  const kabar: KabarKartu = useRef(null);
  const ket = pemberiKet(kabar);

  const [tim, setTim] = useState<AnggotaTim[] | null>(() => bacaCache<AnggotaTim[]>("tim"));
  const [ringkas, setRingkas] = useState<RingkasanBayaranOrang[] | null>(() =>
    bacaCache<RingkasanBayaranOrang[]>("bayaran-tim"),
  );
  const [galat, setGalat] = useState<string | null>(null);
  const [pilih, setPilih] = useState<string | null>(() =>
    typeof location === "undefined" ? null : new URLSearchParams(location.search).get("orang"),
  );
  const [bulan, setBulan] = useState(() => {
    const b = typeof location === "undefined" ? null : new URLSearchParams(location.search).get("bulan");
    return b && /^\d{4}-\d{2}$/.test(b) && b <= BULAN_INI ? b : BULAN_INI;
  });
  const [slip, setSlip] = useState<SlipGaji | null>(null);
  const [riwayat, setRiwayat] = useState<BulanSlip[] | null>(null);
  const [tugas, setTugas] = useState<PenugasanTim[] | null>(null);
  const [bayar, setBayar] = useState<PilihanBayar | null>(null);
  const [membuatPdf, setMembuatPdf] = useState(false);
  const [wujud, setWujud] = useState<"kertas" | "wa">("kertas");
  /* Gajian bulan berjalan untuk seluruh tim — sumber yang sama dengan
     halaman Gaji (`payroll.bulan()`), dibaca saja. */
  const [gajian, setGajian] = useState<BarisGajiBulan[] | null>(null);
  /* Kop slip: nama studio dari Info Studio. Kunci cache `settings` milik
     Info Studio — di sini cuma dibaca (jebakan #8). */
  const [studio, setStudio] = useState<string | null>(() => bacaCache<{ studioName?: string }>("settings")?.studioName ?? null);

  function muatRingkas() {
    setGalat(null);
    ringkasanBayaranTim()
      .then((d) => {
        tulisCache("bayaran-tim", d);
        setRingkas(d);
      })
      .catch((e) => {
        setGalat((e as Error).message);
        setRingkas((l) => l ?? []);
      });
  }
  function muatTim() {
    daftarTim()
      .then(setTim)
      .catch(() => setTim((l) => l ?? []));
  }
  useEffect(() => {
    muatTim();
    muatRingkas();
    ambilSettings().then((d) => setStudio(d.studioName || null)).catch(() => {});
    gajiBulan(BULAN_INI).then(setGajian).catch(() => setGajian([]));
  }, []);

  /* Ketukan di luar kartu keterangan menutupnya (layar sentuh). */
  useEffect(() => {
    const tutup = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && !(e.target as Element).closest?.("[data-ket]")) kabar.current?.(null);
    };
    document.addEventListener("pointerdown", tutup);
    return () => document.removeEventListener("pointerdown", tutup);
  }, []);

  /* Semua anggota aktif ikut — orang bergaji tanpa penugasan proyek tetap
     butuh slip. Urutannya: jatuh tempo dulu, lalu terutang terbesar, lalu nama. */
  const orang: Orang[] = useMemo(() => {
    const peta = new Map<string, Orang>();
    for (const a of tim ?? []) if (a.active) peta.set(a.id, { id: a.id, nama: a.name, anggota: a, r: null });
    for (const r of ringkas ?? []) {
      const o = peta.get(r.teamMemberId) ?? { id: r.teamMemberId, nama: r.teamMemberName, anggota: null, r: null };
      o.r = r;
      peta.set(r.teamMemberId, o);
    }
    return [...peta.values()].sort(
      (a, b) =>
        (b.r?.jatuhTempo ?? 0) - (a.r?.jatuhTempo ?? 0) ||
        (b.r?.terutang ?? 0) - (a.r?.terutang ?? 0) ||
        a.nama.localeCompare(b.nama),
    );
  }, [tim, ringkas]);

  const aktif = orang.find((o) => o.id === pilih) ?? orang[0] ?? null;
  const idAktif = aktif?.id ?? null;

  /* Alamat mengikuti pilihan supaya tautan dari Gaji dan tombol Kembali
     bekerja; replaceState — memilih orang bukan pindah halaman. */
  useEffect(() => {
    if (!idAktif) return;
    const u = new URL(location.href);
    u.searchParams.set("orang", idAktif);
    u.searchParams.set("bulan", bulan);
    history.replaceState(history.state, "", u);
  }, [idAktif, bulan]);

  function muatSlip() {
    if (!idAktif) return;
    setSlip(null);
    ambilSlip(idAktif, bulan)
      .then(setSlip)
      .catch((e) => toast({ judul: "Slip tidak bisa dimuat", keterangan: (e as Error).message, nada: "gagal" }));
  }
  function muatRiwayat() {
    if (!idAktif) return;
    ambilRiwayatSlip(idAktif, BULAN_INI)
      .then(setRiwayat)
      .catch(() => setRiwayat([]));
  }
  function muatTugas() {
    if (!idAktif) return;
    penugasanOrang(idAktif)
      .then(setTugas)
      .catch(() => setTugas([]));
  }
  useEffect(muatSlip, [idAktif, bulan]);
  useEffect(() => {
    setRiwayat(null);
    setTugas(null);
    muatRiwayat();
    muatTugas();
  }, [idAktif]);

  function sesudahBayar() {
    muatRingkas();
    muatSlip();
    muatRiwayat();
    muatTugas();
  }

  const total = (ringkas ?? []).reduce(
    (n, r) => ({ hak: n.hak + r.hak, dibayar: n.dibayar + r.dibayar, terutang: n.terutang + r.terutang, tempo: n.tempo + r.jatuhTempo }),
    { hak: 0, dibayar: 0, terutang: 0, tempo: 0 },
  );
  const bagTim: Bagian = { dibayar: total.dibayar, tempo: total.tempo, belum: Math.max(0, total.terutang - total.tempo) };
  const namaBulan = labelBulan(bulan);
  const wa = nomorWa(slip?.phone ?? aktif?.anggota?.phone);
  const kosongSlip = slip !== null && !slip.salary && slip.fees.length === 0;
  const memuatAwal = tim === null && ringkas === null;
  const bergaji = (gajian ?? []).filter((g) => (g.salaryAmount ?? 0) > 0);
  const gajiTotal = bergaji.reduce((n, g) => n + (g.salaryAmount ?? 0), 0);
  const gajiLunas = bergaji.filter((g) => g.salaryPaidOn).length;

  async function pdf() {
    if (!slip) return;
    setMembuatPdf(true);
    try {
      const berkas = await unduhSlipGaji(slip, namaBulan);
      toast({ judul: "Slip diunduh", keterangan: berkas, nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal membuat PDF", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMembuatPdf(false);
    }
  }
  function kirimWa() {
    if (!slip || !wa) return;
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(teksWa(slip, namaBulan))}`, "_blank", "noopener");
  }

  /* Buku upah: yang punya ruas jatuh tempo lebih dulu. */
  const buku = useMemo(
    () =>
      [...(tugas ?? [])].sort(
        (a, b) =>
          Number(b.tahap.some((t) => t.keadaan === "jatuh_tempo")) - Number(a.tahap.some((t) => t.keadaan === "jatuh_tempo")) ||
          (b.terutang ?? 0) - (a.terutang ?? 0),
      ),
    [tugas],
  );
  const maksRiwayat = Math.max(1, ...(riwayat ?? []).map((m) => m.total));
  /* Rata-rata dua belas bulan (bulan kosong ikut dihitung — itu memang
     bulan tanpa bayaran). Digambar sebagai garis putus di atas batang. */
  const rataRiwayat = riwayat && riwayat.length ? riwayat.reduce((n, m) => n + m.total, 0) / riwayat.length : 0;
  const ketBagian = (judul: string, b: Bagian) =>
    ket(() => ({
      judul,
      baris: [
        { warna: WARNA.dibayar, label: "Dibayar", nilai: formatRupiah(b.dibayar) },
        { warna: WARNA.tempo, label: "Jatuh tempo", nilai: formatRupiah(b.tempo) },
        { warna: WARNA.belum, label: "Belum tempo", nilai: formatRupiah(b.belum) },
      ],
    }));

  if (memuatAwal) return <Kerangka />;

  return (
    <div className="byt">
      <Keterangan kabar={kabar} />

      {/* ==== 1. Rak amplop ================================================ */}
      <article className="byt__rak" aria-label="Rak amplop tim">
        <header className="byt__rakkepala">
          <h2>Amplop tim</h2>
          <span>{orang.length} orang</span>
        </header>
        <div className="byt__ringkas">
        {/* Gajian bulan berjalan: satu ruas per orang bergaji — hijau sudah
            dibayar, amber belum. */}
        <div className="byt__gajian">
          <p className="byt__gajiankepala">
            <small>Gajian {labelBulan(BULAN_INI)}</small>
            <span>{gajian ? `${gajiLunas} dari ${bergaji.length} dibayar` : ""}</span>
          </p>
          <b>{gajian ? formatRupiah(gajiTotal) : "—"}</b>
          <span className="byt__gajianruas" role="img" aria-label={`Gaji ${labelBulan(BULAN_INI)}: ${gajiLunas} dari ${bergaji.length} orang sudah dibayar`}>
            {bergaji.map((g) => (
              <i
                key={g.teamMemberId}
                className={g.salaryPaidOn ? "is-lunas" : undefined}
                {...ket(() => ({
                  judul: g.name,
                  baris: [
                    {
                      warna: g.salaryPaidOn ? WARNA.dibayar : WARNA.tempo,
                      label: g.salaryPaidOn ? `Dibayar ${tanggalPendek(g.salaryPaidOn)}` : "Belum dibayar",
                      nilai: formatRupiah(g.salaryAmount ?? 0),
                    },
                  ],
                }))}
              />
            ))}
          </span>
        </div>
        <div className="byt__timtotal" {...ketBagian("Fee proyek seluruh tim", bagTim)}>
          <small>Fee proyek terutang</small>
          <b>{formatRupiah(total.terutang)}</b>
          <Meteran b={bagTim} label="Seluruh tim" besar />
          <dl>
            <div>
              <dt><i style={{ background: WARNA.dibayar }} />Dibayar</dt>
              <dd>{formatRupiah(total.dibayar)}</dd>
            </div>
            <div className={total.tempo > 0 ? "is-tempo" : undefined}>
              <dt><i style={{ background: WARNA.tempo }} />Jatuh tempo</dt>
              <dd>{formatRupiah(total.tempo)}</dd>
            </div>
            <div>
              <dt><i style={{ background: WARNA.belum }} />Belum tempo</dt>
              <dd>{formatRupiah(bagTim.belum)}</dd>
            </div>
          </dl>
        </div>
        </div>
        {galat && (
          <p className="byt__galat" role="alert">
            <Ikon ikon={SpecialWarning} ukuran={14} />
            <span>Ringkasan tim tidak bisa dimuat — {galat}</span>
            <button type="button" onClick={() => { muatTim(); muatRingkas(); }}>
              <Ikon ikon={ArrowClockwise} ukuran={12} />
              Coba lagi
            </button>
          </p>
        )}
        <ul className="byt__amplop">
          {orang.map((o) => {
            const r = o.r;
            const tanpaPersen = !!r && r.belumDitentukan > 0 && r.hak === 0;
            const sub = !r
              ? (o.anggota?.role ?? LABEL_JENIS_ANGGOTA[o.anggota?.kind ?? "proyek"])
              : `${r.proyek} proyek${r.belumDitentukan ? " · tanpa persen" : ""}`;
            return (
              <li key={o.id}>
                <button
                  type="button"
                  className={`byt__orang${r && r.jatuhTempo > 0 ? " is-tempo" : ""}`}
                  aria-current={o.id === idAktif ? "true" : undefined}
                  onClick={() => {
                    setPilih(o.id);
                    /* Di layar sempit rinciannya di BAWAH rak — tanpa ini
                       ketukan tampak tidak berbuat apa-apa. */
                    if (matchMedia("(max-width: 63rem)").matches) {
                      requestAnimationFrame(() =>
                        document.querySelector(".byt__orangkepala")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                      );
                    }
                  }}
                >
                  <Avatar nama={o.nama} ukuran="md" hiasan />
                  <span className="byt__orangisi">
                    <b>{o.nama}</b>
                    <small>{sub}</small>
                  </span>
                  <span className="byt__orangkanan">
                    <b>{r && !tanpaPersen ? formatRupiah(r.terutang) : "—"}</b>
                    {/* Nominal jatuh temponya ada di kartu keterangan meteran
                        dan di kepala orang — di sini cukup keadaannya, supaya
                        namanya tidak terpotong. */}
                    {r && !tanpaPersen ? (
                      r.jatuhTempo > 0 ? (
                        <small className="byt__tempo">jatuh tempo</small>
                      ) : r.terutang > 0 ? (
                        <small>belum tempo</small>
                      ) : (
                        <small className="byt__lunas">lunas</small>
                      )
                    ) : !r ? (
                      <small>tanpa proyek</small>
                    ) : null}
                  </span>
                  {r && r.hak > 0 && (
                    <span className="byt__metersel" {...ketBagian(o.nama, bagianDari(r))}>
                      <Meteran b={bagianDari(r)} label={o.nama} />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </article>

      {/* ==== Amplop orang terpilih ===========================================
          Amplop gaji pejal (bidang uang kit, tidak berbalik tema): tutup
          segitiga dengan SEGEL avatar di ujungnya, nama di kiri, ISI AMPLOP
          bulan terpilih di kanan, dan di dasarnya hak/dibayar/terutang serta
          riwayat dua belas bulan yang sekaligus memilih bulan slip. Slip di
          bawahnya keluar dari balik amplop ini. */}
      <section className="byt__orangkepala" aria-label={aktif ? `Amplop gaji ${aktif.nama}` : "Amplop gaji"}>
        <svg className="byt__tutup" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 0 L50 60 L100 0 Z" />
        </svg>
        <div className="byt__amplopatas">
          <div className="byt__identitas">
            <p className="byt__amplopkop">
              Amplop gaji{aktif ? <> · <span className="byt__nomor">No. {nomorAmplop(aktif.nama, bulan)}</span></> : null}
            </p>
            <h2>{aktif?.nama ?? "—"}</h2>
            <p className="byt__kontak">
              <span>{aktif?.anggota?.role ?? (aktif?.anggota ? LABEL_JENIS_ANGGOTA[aktif.anggota.kind] : "")}</span>
              {aktif?.anggota && <span>{LABEL_JENIS_ANGGOTA[aktif.anggota.kind]}</span>}
              {wa ? (
                <span className="byt__wa-nomor"><Ikon ikon={Phone} ukuran={12} />{tampilWa(wa)}</span>
              ) : (
                aktif && <a className="byt__wa-kosong" href="/admin/tim">WhatsApp belum diisi</a>
              )}
            </p>
          </div>
          <span className="byt__segel">
            <Avatar nama={aktif?.nama ?? "?"} ukuran="lg" hiasan />
          </span>
          <div className="byt__isiamplop" aria-live="polite">
            <small>Isi amplop {namaBulan}</small>
            <b>{slip ? formatRupiah(slip.total) : "…"}</b>
            {/* Rincian dan cap sebaris — dua baris di sini membuat amplop
                lebih tinggi dan slip di bawahnya ikut menggulir. */}
            <span className="byt__isibaris">
              <span className="byt__isirinci">
                {slip ? `gaji ${formatRupiah(slip.salaryAmount)} · fee ${formatRupiah(slip.feeAmount)}` : "\u00a0"}
              </span>
              {slip?.salary && (
                <span className={`byt__capkecil${slip.salary.paidOn ? "" : " is-belum"}`}>
                  {slip.salary.paidOn ? `Gaji dibayar ${tanggalTanpaTahun(slip.salary.paidOn)}` : "Gaji belum dibayar"}
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="byt__amplopbawah">
          <div className="byt__hakorang">
            <dl className="byt__angka">
              <div>
                <dt>Hak fee</dt>
                <dd>{aktif?.r ? formatRupiah(aktif.r.hak) : "—"}</dd>
              </div>
              <div>
                <dt>Dibayar</dt>
                <dd>{aktif?.r ? formatRupiah(aktif.r.dibayar) : "—"}</dd>
              </div>
              <div className={aktif?.r && aktif.r.jatuhTempo > 0 ? "is-tempo" : undefined}>
                <dt>{aktif?.r && aktif.r.jatuhTempo > 0 ? `Terutang · ${formatRupiah(aktif.r.jatuhTempo)} jatuh tempo` : "Terutang"}</dt>
                <dd>{aktif?.r ? formatRupiah(aktif.r.terutang) : "—"}</dd>
              </div>
            </dl>
            {aktif?.r && aktif.r.hak > 0 && (
              <span className="byt__metersel" {...ketBagian(aktif.nama, bagianDari(aktif.r))}>
                <Meteran b={bagianDari(aktif.r)} label={aktif.nama} besar />
              </span>
            )}
          </div>

          <div className="byt__riwayat">
            <div className="byt__riwayatkepala">
              <span>12 bulan · rata-rata <b>{riwayat ? formatRupiah(Math.round(rataRiwayat)) : "—"}</b></span>
              <span className="byt__legenda">
                <i className="l-gaji" />Gaji
                <i className="l-fee" />Fee
                <i className="l-rata" />Rata-rata
              </span>
            </div>
            <div
              className="byt__kolom"
              role="group"
              aria-label="Pilih bulan slip"
              style={{ ["--byt-rata" as string]: `${(rataRiwayat / maksRiwayat) * 40}px` }}
            >
              {riwayat && rataRiwayat > 0 && <span className="byt__rata" aria-hidden="true" />}
              {(riwayat ?? Array.from({ length: 12 }, () => null)).map((m, i) => {
                if (!m) return <span key={i} className="byt__bln is-rangka"><span className="byt__batang" /><small>&nbsp;</small></span>;
                const tinggi = (n: number) => `${(n / maksRiwayat) * 100}%`;
                const b = Number(m.period.slice(5, 7)) - 1;
                return (
                  <button
                    key={m.period}
                    type="button"
                    className={`byt__bln${m.total === 0 ? " is-kosong" : ""}`}
                    aria-pressed={m.period === bulan}
                    aria-label={`${labelBulan(m.period)}: total ${formatRupiah(m.total)}`}
                    onClick={() => setBulan(m.period)}
                    {...ket(() => ({
                      judul: labelBulan(m.period),
                      baris: [
                        { warna: WARNA.gaji, label: m.salaryPaid === false ? "Gaji (belum dibayar)" : "Gaji", nilai: formatRupiah(m.salary) },
                        { warna: WARNA.fee, label: `Fee proyek${m.feeCount ? ` · ${m.feeCount} baris` : ""}`, nilai: formatRupiah(m.fee) },
                        { label: "Total", nilai: formatRupiah(m.total) },
                      ],
                    }))}
                  >
                    <span className="byt__batang">
                      {m.salaryPaid === false && <span className="byt__belum" aria-hidden="true" />}
                      <i className="byt__fee" style={{ height: tinggi(m.fee) }} />
                      <i className="byt__gaji" style={{ height: tinggi(m.salary) }} />
                    </span>
                    <small>{BULAN_PENDEK[b]}</small>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ==== 2. Buku upah ================================================== */}
      <article className="byt__buku" aria-label="Hak per proyek">
        <header className="byt__kartukepala">
          <h3>Hak per proyek</h3>
          <span>{tugas ? `${tugas.length} penugasan · tahap awal & akhir` : ""}</span>
        </header>
        {tugas === null ? (
          <ul className="byt__jalurlist">{[0, 1, 2].map((k) => <li key={k} className="byt__jalur is-rangka"><i /><i /></li>)}</ul>
        ) : tugas.length === 0 ? (
          <p className="byt__kosong">
            {aktif?.nama ?? "Orang ini"} belum ditugaskan di proyek mana pun. Tugaskan dari Tim &amp; Bayaran di
            <a href="/admin/proyek/"> Satu Proyek</a>.
          </p>
        ) : (
          <ul className="byt__jalurlist">
            {buku.map((p) => (
              <li key={p.id} className="byt__jalur">
                <div className="byt__jalurkepala">
                  <a className="byt__proyek" href={`/admin/proyek/satu?id=${encodeURIComponent(p.projectId)}`}>
                    {p.projectTitle}
                  </a>
                  <span className="byt__peran">
                    {LABEL_PERAN[p.role]}
                    {p.pctBerlaku !== null ? ` ${p.pctBerlaku.toLocaleString("id-ID")}%` : ""}
                  </span>
                  <span className="byt__hak">{p.hak === null ? "—" : formatRupiah(p.hak)}</span>
                </div>
                {/* Dari mana angka hak itu: fee design proyek × persen peran. */}
                {p.feeDesign !== null && p.pctBerlaku !== null && (
                  <p className="byt__dasar">
                    fee design {formatRupiah(p.feeDesign)} × {p.pctBerlaku.toLocaleString("id-ID")}%
                    {p.dibayar > 0 ? ` · dibayar ${formatRupiah(p.dibayar)}` : ""}
                  </p>
                )}
                <div className="byt__lintas">
                  {(["awal", "akhir"] as const).map((j) => {
                    const t = p.tahap.find((x) => x.tahap === j);
                    return t ? <Ruas key={j} p={p} t={t} onBayar={() => setBayar({ p, t })} /> : null;
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>

      {/* ==== 3. Slip ======================================================== */}
      <article className="byt__slip" aria-label={`Slip ${namaBulan}`}>
        <h3 className="sr-only">Slip {namaBulan}</h3>
        <div className="byt__slipisi">
          {slip === null ? (
            <div className="byt__kertas is-rangka" aria-label="Memuat slip"><i /><i /><i /><i /></div>
          ) : wujud === "kertas" ? (
            <div className="byt__kertas">
              <div className="byt__kop">
                <b>{studio ?? "Slip gaji"}</b>
                <span>No. {nomorAmplop(slip.name, bulan)}</span>
              </div>
              <p className="byt__kopnama">Slip gaji {namaBulan} · {slip.name}</p>
              {kosongSlip ? (
                <p className="byt__kertaskosong">Tidak ada gaji maupun fee atas nama {slip.name} di {namaBulan}.</p>
              ) : (
                <>
                  <ul className="byt__rincian">
                    <li>
                      <span>
                        <b>Gaji pokok</b>
                        <small>{slip.salary?.note ?? (slip.salary ? "Bulanan" : "Tidak ada gaji bulan ini")}</small>
                      </span>
                      <span className="byt__rp">{slip.salary ? formatRupiah(slip.salary.amount) : "—"}</span>
                    </li>
                    {slip.fees.map((f) => (
                      <li key={f.costId}>
                        <span>
                          <b>{f.projectTitle}</b>
                          <small>
                            {keteranganFee(f)} · {tanggalTanpaTahun(f.incurredOn)}
                          </small>
                        </span>
                        <span className="byt__rp">{formatRupiah(f.amount)}</span>
                      </li>
                    ))}
                  </ul>
                  <dl className="byt__jumlah">
                    <div className="byt__grand">
                      <dt>Total diterima</dt>
                      <dd>{formatRupiah(slip.total)}</dd>
                    </div>
                  </dl>
                  {/* Terbilang — seperti kuitansi: angka yang tidak bisa diubah
                      dengan menambah satu digit. */}
                  <p className="byt__terbilang">
                    <span>Terbilang</span> {terbilang(slip.total)}
                  </p>
                  <div className="byt__ttd">
                    <div>
                      <small>Dibayar oleh</small>
                      <i />
                      <b>{studio ?? "Studio"}</b>
                      {/* Cap: keadaan gaji SUNGGUHAN bulan itu, dibubuhkan di
                          atas kolom pembayar seperti cap di slip kertas. */}
                      {slip.salary && (
                        <span className={`byt__cap${slip.salary.paidOn ? "" : " byt__cap--belum"}`}>
                          {slip.salary.paidOn ? `Dibayar ${tanggalTanpaTahun(slip.salary.paidOn)}` : "Belum dibayar"}
                        </span>
                      )}
                    </div>
                    <div>
                      <small>Diterima oleh</small>
                      <i />
                      <b>{slip.name}</b>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="byt__obrolan">
              {wa ? (
                <>
                  <p className="byt__ke">
                    <Ikon ikon={Phone} ukuran={12} />
                    Ke {slip.name} · {tampilWa(wa)}
                  </p>
                  {kosongSlip ? (
                    <p className="byt__kertaskosong">Tidak ada yang dikirim — slip {namaBulan} kosong.</p>
                  ) : (
                    <div className="byt__gelembung">
                      <pre>{teksWa(slip, namaBulan)}</pre>
                      <small>belum dikirim</small>
                    </div>
                  )}
                </>
              ) : (
                <p className="byt__wa-tanpa">
                  <Ikon ikon={SpecialWarning} ukuran={16} />
                  <span>
                    Nomor WhatsApp {slip.name} belum diisi. <a href="/admin/tim">Isi di Tim &amp; Freelancer</a> — sesudah itu
                    slip bisa dikirim dari sini.
                  </span>
                </p>
              )}
            </div>
          )}
        </div>

        <footer className="byt__slipaksi">
          <Segmen
            judul="Wujud slip"
            className="byt__wujud"
            nilai={wujud}
            onPilih={(v) => setWujud(v as "kertas" | "wa")}
            segmen={[
              { nilai: "kertas", label: "Kertas", ikon: FileText },
              { nilai: "wa", label: "WhatsApp", ikon: ChatTeardropDots },
            ]}
          />
          <Tombol ukuran="medium" jenis="ghost" kiri={FilePdf} onClick={pdf} disabled={!slip || kosongSlip || membuatPdf} memuat={membuatPdf}>
            Unduh PDF
          </Tombol>
          <Tombol
            ukuran="medium"
            jenis="primary"
            kiri={PaperPlaneRight}
            onClick={kirimWa}
            disabled={!slip || kosongSlip || !wa}
            title={!wa && aktif ? `Nomor WhatsApp ${aktif.nama} belum diisi di Tim & Freelancer` : "Buka WhatsApp dengan slip ini"}
          >
            Kirim WhatsApp
          </Tombol>
        </footer>
      </article>

      <DialogBayar bayar={bayar} onTutup={() => setBayar(null)} onSelesai={sesudahBayar} />
    </div>
  );
}

/* --- Satu ruas lintasan tahap ----------------------------------------------
   Lebarnya sebanding nominal tahapnya (persen kosong = dua ruas sama lebar),
   dengan lantai di CSS supaya ruas kecil tetap muat label dan tombolnya. */
function Ruas({ p, t, onBayar }: { p: PenugasanTim; t: TahapBayaran; onBayar: () => void }) {
  /* "Awal"/"Akhir", bukan "Tahap awal": ruas sesempit 148px harus muat
     keadaannya juga, dan kepala kartunya sudah menyebut "tahap awal & akhir". */
  const nama = t.tahap === "awal" ? "Awal" : "Akhir";
  const lebar = p.hak && t.nominal !== null ? t.nominal / p.hak : 0.5;
  const gaya = { flexGrow: Math.max(lebar, 0.0001) } as const;
  const nominal = (n: number | null) => (n === null ? "—" : formatRupiah(n));

  if (t.keadaan === "dibayar") {
    return (
      <span className="byt__ruas byt__ruas--dibayar" style={gaya}>
        <Ikon ikon={Check} ukuran={14} />
        <span className="byt__ruasisi">
          <small>{nama} · dibayar {t.dibayarPada ? tanggalTanpaTahun(t.dibayarPada) : ""}</small>
          <b>{nominal(t.dibayar ?? t.nominal)}</b>
        </span>
      </span>
    );
  }
  if (t.keadaan === "jatuh_tempo") {
    return (
      <span className="byt__ruas byt__ruas--tempo" style={gaya}>
        <span className="byt__ruasisi">
          <small>{nama} · jatuh tempo</small>
          <b>{nominal(t.nominal)}</b>
        </span>
        <Tombol ukuran="small" jenis="primary" onClick={onBayar}>
          Bayar
        </Tombol>
      </span>
    );
  }
  if (t.keadaan === "belum_ditentukan") {
    return (
      <a className="byt__ruas byt__ruas--kosong" style={gaya} href="/admin/pengaturan/fee/">
        <Ikon ikon={SpecialWarning} ukuran={14} />
        <span className="byt__ruasisi">
          <small>{nama}</small>
          <b>Persen belum ditentukan</b>
        </span>
        <Ikon ikon={ArrowRight} ukuran={12} />
      </a>
    );
  }
  /* Menunggu syaratnya — tetap bisa dibayar lebih awal (dialog yang sama). */
  return (
    <button type="button" className="byt__ruas byt__ruas--tunggu" style={gaya} onClick={onBayar} title="Bayar lebih awal">
      <Ikon ikon={Hourglass} ukuran={14} />
      <span className="byt__ruasisi">
        <small>
          {nama} · {SYARAT[t.tahap].toLowerCase()}
        </small>
        <b>{nominal(t.nominal)}</b>
      </span>
    </button>
  );
}

/* Kerangka memuat berbentuk meja yang sama: rak, kepala, buku, slip. */
function Kerangka(): ReactNode {
  return (
    <div className="byt byt--rangka" aria-hidden="true">
      <article className="byt__rak">
        <i className="rk rk--a" /><i className="rk rk--b" /><i className="rk rk--c" />
        {[0, 1, 2, 3, 4].map((k) => <i key={k} className="rk rk--baris" />)}
      </article>
      <section className="byt__orangkepala"><i className="rk rk--id" /><i className="rk rk--riwayat" /></section>
      <article className="byt__buku">{[0, 1, 2].map((k) => <i key={k} className="rk rk--jalur" />)}</article>
      <article className="byt__slip"><i className="rk rk--kertas" /></article>
    </div>
  );
}

export function BayaranTimKit() {
  return (
    <RequireAuth skeleton={<Kerangka />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
