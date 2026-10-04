import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast } from "../kit/Toast";
import { KepalaSeksi, BarisPantau } from "../kit/Item";
import { Tabel, type KolomTabel } from "../kit/Tabel";
import { Lencana } from "../kit/Lencana";
import { Tombol } from "../kit/Tombol";
import { FilePdf, PaperPlaneRight } from "../kit/ikon";
import {
  ambilSlip,
  bacaCache,
  daftarTim,
  penugasanOrang,
  ringkasanBayaranTim,
  tulisCache,
  LABEL_JENIS_ANGGOTA,
  LABEL_PERAN,
  type AnggotaTim,
  type PenugasanTim,
  type RingkasanBayaranOrang,
  type SlipGaji,
} from "../../lib/admin";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";
import { keteranganFee, unduhSlipGaji } from "../../lib/pdfProyek";
import { BULAN, BULAN_PENDEK, IKON_JENIS, PilihTombol } from "./frame25";
import { DialogBayar, SelTahap, type PilihanBayar } from "./timProyekKit";

/* =============================================================================
   Bayaran Tim — fase 3 alur Excel pemilik: sheet "GAJI ADJI / DANY / RAFFI".

   Dua pertanyaan yang dijawab sheet itu, sekarang dari satu sumber:
   1. "Berapa hak orang ini, berapa yang sudah dibayar, berapa yang masih
      terutang?" — lintas proyek, dari penugasan Tim & Bayaran (H3).
   2. "Slip bulan ini isinya apa?" — gaji pokok + setiap fee yang TERJADI
      bulan itu, dengan proyek, peran, persen, dan tahapnya (H4).

   Tidak ada angka yang diketik di sini. Gaji tetap diketik di halaman Gaji,
   bayaran tahap tetap dicatat sebagai biaya proyek ("fee menulis, gaji
   membaca"); halaman ini cuma membaca dan, lewat tombol Bayar, memanggil
   pencatat yang sama dengan Satu Proyek.
   ============================================================================= */

const kunciBulan = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const labelBulan = (k: string) => `${BULAN[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;
const tanggalPendek = (iso: string) => {
  const [t, b, h] = iso.slice(0, 10).split("-").map(Number);
  return `${h} ${BULAN_PENDEK[(b ?? 1) - 1]} ${t}`;
};

/* Dua belas bulan ke belakang — slip yang lebih tua jarang dibuka lagi. */
const DAFTAR_BULAN = (() => {
  const d = new Date();
  d.setDate(1);
  return Array.from({ length: 12 }, (_, i) => {
    const x = new Date(d);
    x.setMonth(d.getMonth() - i);
    const k = kunciBulan(x);
    return { nilai: k, label: labelBulan(k) };
  });
})();

/** Nomor Indonesia untuk wa.me: "0812-3456-7890" / "+62 812…" → "62812…". */
export function nomorWa(telepon: string | null | undefined): string | null {
  const d = (telepon ?? "").replace(/\D/g, "");
  if (d.length < 9) return null;
  if (d.startsWith("62")) return d;
  if (d.startsWith("0")) return `62${d.slice(1)}`;
  if (d.startsWith("8")) return `62${d}`;
  return d;
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

interface Orang {
  id: string;
  nama: string;
  anggota: AnggotaTim | null;
  r: RingkasanBayaranOrang | null;
}

function Isi() {
  const toast = useToast();
  const [tim, setTim] = useState<AnggotaTim[] | null>(() => bacaCache<AnggotaTim[]>("tim"));
  const [ringkas, setRingkas] = useState<RingkasanBayaranOrang[] | null>(() =>
    bacaCache<RingkasanBayaranOrang[]>("bayaran-tim"),
  );
  const [pilih, setPilih] = useState<string | null>(() =>
    typeof location === "undefined" ? null : new URLSearchParams(location.search).get("orang"),
  );
  const [bulan, setBulan] = useState(() => {
    const b = typeof location === "undefined" ? null : new URLSearchParams(location.search).get("bulan");
    return b && /^\d{4}-\d{2}$/.test(b) ? b : kunciBulan(new Date());
  });
  const [slip, setSlip] = useState<SlipGaji | null>(null);
  const [tugas, setTugas] = useState<PenugasanTim[] | null>(null);
  const [bayar, setBayar] = useState<PilihanBayar | null>(null);
  const [membuatPdf, setMembuatPdf] = useState(false);

  function muatRingkas() {
    ringkasanBayaranTim()
      .then((d) => {
        tulisCache("bayaran-tim", d);
        setRingkas(d);
      })
      .catch(() => setRingkas((l) => l ?? []));
  }
  useEffect(() => {
    daftarTim()
      .then(setTim)
      .catch(() => setTim((l) => l ?? []));
    muatRingkas();
  }, []);

  /* Semua anggota aktif ikut terdaftar — orang bergaji tanpa penugasan
     proyek tetap butuh slip. Urutannya: yang punya bayaran jatuh tempo dulu,
     lalu yang terutang terbesar, lalu nama. */
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
     bekerja; replaceState, bukan pushState — memilih orang bukan pindah halaman. */
  useEffect(() => {
    if (!idAktif) return;
    const u = new URL(location.href);
    u.searchParams.set("orang", idAktif);
    u.searchParams.set("bulan", bulan);
    history.replaceState(history.state, "", u);
  }, [idAktif, bulan]);

  function muatOrang() {
    if (!idAktif) return;
    setSlip(null);
    ambilSlip(idAktif, bulan)
      .then(setSlip)
      .catch((e) => toast({ judul: "Slip tidak bisa dimuat", keterangan: (e as Error).message, nada: "gagal" }));
  }
  useEffect(muatOrang, [idAktif, bulan]);
  useEffect(() => {
    if (!idAktif) return;
    setTugas(null);
    penugasanOrang(idAktif)
      .then(setTugas)
      .catch(() => setTugas([]));
  }, [idAktif]);

  function sesudahBayar() {
    muatRingkas();
    muatOrang();
    if (idAktif) penugasanOrang(idAktif).then(setTugas).catch(() => {});
  }

  const total = (ringkas ?? []).reduce(
    (n, r) => ({ hak: n.hak + r.hak, dibayar: n.dibayar + r.dibayar, terutang: n.terutang + r.terutang, tempo: n.tempo + r.jatuhTempo }),
    { hak: 0, dibayar: 0, terutang: 0, tempo: 0 },
  );
  const namaBulan = labelBulan(bulan);
  const wa = nomorWa(slip?.phone ?? aktif?.anggota?.phone);
  const kosongSlip = slip !== null && !slip.salary && slip.fees.length === 0;

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

  /* Tiga kolom, bukan enam: kartu ini berbagi lebar dengan slip, dan dua
     sel tahap berdampingan (152 + 152) tidak pernah muat di sana. Kedua tahap
     ditumpuk di satu sel; terutangnya sudah ada di kepala orang. */
  const kolom: KolomTabel[] = [
    { judul: "Proyek & peran", lebar: 176 },
    { judul: "Hak", lebar: 100, kanan: true },
    { judul: "Tahap bayaran", lebar: 196 },
  ];
  const baris = (tugas ?? []).map((p) => [
    <span className="byt__proyeksel">
      <a className="byt__proyek" href={`/admin/proyek/satu?id=${encodeURIComponent(p.projectId)}`}>
        {p.projectTitle}
      </a>
      <small>
        {LABEL_PERAN[p.role]}
        {p.pctBerlaku !== null ? ` ${p.pctBerlaku.toLocaleString("id-ID")}%` : " · persen belum ditentukan"}
      </small>
    </span>,
    p.hak === null ? <span className="sat__redup" title="Persen peran ini belum ditentukan">—</span> : <b>{formatRupiah(p.hak)}</b>,
    <span className="byt__tahap">
      <span>
        <small>Awal</small>
        <SelTahap p={p} jenis="awal" onBayar={(t) => setBayar({ p, t })} />
      </span>
      <span>
        <small>Akhir</small>
        <SelTahap p={p} jenis="akhir" onBayar={(t) => setBayar({ p, t })} />
      </span>
    </span>,
  ]);

  return (
    <div className="byt">
      {/* ---- Kiri: semua orang, dengan yang masih terutang ------------------ */}
      <article className="fee__w byt__kiri" aria-label="Daftar tim">
        <KepalaSeksi judul="Tim" kanan={<span className="fee__ketkepala">{orang.length} orang</span>} />
        <dl className="byt__total">
          <div>
            <dt>Hak tim</dt>
            <dd>{formatRupiahRingkas(total.hak)}</dd>
          </div>
          <div>
            <dt>Dibayar</dt>
            <dd>{formatRupiahRingkas(total.dibayar)}</dd>
          </div>
          <div>
            <dt>Terutang</dt>
            <dd>{formatRupiahRingkas(total.terutang)}</dd>
          </div>
        </dl>
        {total.tempo > 0 && (
          <p className="byt__tempo">
            <Lencana nada="menunggu">{formatRupiah(total.tempo)} jatuh tempo</Lencana>
          </p>
        )}
        <ul className="byt__daftar">
          {tim === null && ringkas === null ? (
            <li className="fee__kosong">Memuat…</li>
          ) : (
            orang.map((o) => {
              const r = o.r;
              const jenis = o.anggota?.kind ?? r?.teamMemberKind ?? "proyek";
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    className="byt__orang"
                    aria-current={o.id === idAktif ? "true" : undefined}
                    onClick={() => {
                      setPilih(o.id);
                      /* Di layar sempit rinciannya di BAWAH daftar — tanpa ini
                         ketukan tampak tidak berbuat apa-apa. */
                      if (matchMedia("(max-width: 63rem)").matches) {
                        requestAnimationFrame(() =>
                          document.querySelector(".byt__kanan")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                        );
                      }
                    }}
                  >
                    <BarisPantau
                      ikon={IKON_JENIS[jenis]}
                      simbol={o.nama}
                      nama={
                        r
                          ? /* Rp0 karena persennya kosong, bukan karena sudah dibayar —
                               jadi dikatakan, bukan dicap "lunas". */
                            `${r.proyek} proyek${r.belumDitentukan ? " · tanpa persen" : ""}`
                          : (o.anggota?.role ?? LABEL_JENIS_ANGGOTA[jenis])
                      }
                      nilai={
                        <span title={r ? `Terutang ${formatRupiah(r.terutang)}` : undefined}>
                          {r && !(r.belumDitentukan > 0 && r.hak === 0) ? formatRupiahRingkas(r.terutang) : "—"}
                        </span>
                      }
                      tren={
                        !r ? (
                          <span className="k-trenlebar k-trenlebar--netral">tanpa proyek</span>
                        ) : r.jatuhTempo > 0 ? (
                          <span className="k-trenlebar k-trenlebar--tunggu" title={`${formatRupiah(r.jatuhTempo)} jatuh tempo`}>
                            jatuh tempo
                          </span>
                        ) : r.terutang > 0 ? (
                          <span className="k-trenlebar k-trenlebar--netral">belum tempo</span>
                        ) : r.belumDitentukan > 0 && r.hak === 0 ? undefined : (
                          <span className="k-trenlebar">lunas</span>
                        )
                      }
                    />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </article>

      {/* ---- Kanan: orang yang dipilih ------------------------------------ */}
      <section className="byt__kanan" aria-label={aktif ? `Bayaran ${aktif.nama}` : "Bayaran"}>
        <div className="byt__kepala">
          <div className="byt__judul">
            <h2>{aktif?.nama ?? "—"}</h2>
            <p>
              {aktif?.anggota?.role ?? (aktif?.anggota ? LABEL_JENIS_ANGGOTA[aktif.anggota.kind] : "")}
              {aktif?.r && (
                <>
                  {" · "}hak {formatRupiah(aktif.r.hak)} · dibayar {formatRupiah(aktif.r.dibayar)} · terutang{" "}
                  <b>{formatRupiah(aktif.r.terutang)}</b>
                </>
              )}
            </p>
          </div>
          <div className="byt__aksi">
            <PilihTombol judul="Bulan slip" nilai={bulan} opsi={DAFTAR_BULAN} onUbah={setBulan} />
            <Tombol ukuran="medium" jenis="ghost" kiri={FilePdf} onClick={pdf} disabled={!slip || kosongSlip || membuatPdf} memuat={membuatPdf}>
              Unduh slip
            </Tombol>
            <Tombol
              ukuran="medium"
              jenis="primary"
              kiri={PaperPlaneRight}
              onClick={kirimWa}
              disabled={!slip || kosongSlip || !wa}
              title={
                !wa && aktif ? `Nomor WhatsApp ${aktif.nama} belum diisi di Tim & Freelancer` : "Buka WhatsApp dengan slip ini"
              }
            >
              Kirim ke WhatsApp
            </Tombol>
          </div>
        </div>

        <div className="byt__isi">
          {/* ---- Slip bulan terpilih -------------------------------------- */}
          <article className="fee__w byt__slip" aria-label={`Slip ${namaBulan}`}>
            <KepalaSeksi
              judul={`Slip ${namaBulan}`}
              kanan={
                slip?.salary ? (
                  <Lencana nada={slip.salary.paidOn ? "selesai" : "menunggu"}>
                    {slip.salary.paidOn ? `Gaji dibayar ${tanggalPendek(slip.salary.paidOn)}` : "Gaji belum dibayar"}
                  </Lencana>
                ) : undefined
              }
            />
            {slip === null ? (
              <p className="fee__kosong">Memuat slip…</p>
            ) : kosongSlip ? (
              <p className="fee__kosong">
                Tidak ada gaji maupun fee atas nama {slip.name} di {namaBulan}. Gaji diketik di halaman Gaji; fee
                tercatat begitu satu tahap dibayar.
              </p>
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
                          {keteranganFee(f)} · {tanggalPendek(f.incurredOn)}
                        </small>
                      </span>
                      <span className="byt__rp">{formatRupiah(f.amount)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="byt__jumlah">
                  <div>
                    <dt>Gaji pokok</dt>
                    <dd>{formatRupiah(slip.salaryAmount)}</dd>
                  </div>
                  <div>
                    <dt>Fee proyek</dt>
                    <dd>{formatRupiah(slip.feeAmount)}</dd>
                  </div>
                  <div className="byt__grand">
                    <dt>Total</dt>
                    <dd>{formatRupiah(slip.total)}</dd>
                  </div>
                </dl>
                {!wa && (
                  <p className="byt__catatan">
                    WhatsApp belum diisi — <a href="/admin/tim">isi di Tim &amp; Freelancer</a>.
                  </p>
                )}
              </>
            )}
          </article>

          {/* ---- Hak per proyek ------------------------------------------- */}
          <article className="fee__w byt__hak" aria-label="Hak per proyek">
            <KepalaSeksi
              judul="Hak per Proyek"
              kanan={<span className="fee__ketkepala">semua bulan</span>}
            />
            {tugas === null ? (
              <p className="fee__kosong">Memuat…</p>
            ) : tugas.length === 0 ? (
              <p className="fee__kosong">
                {aktif?.nama ?? "Orang ini"} belum ditugaskan di proyek mana pun. Tugaskan dari bagian Tim &amp; Bayaran di
                Satu Proyek, atau saat membuat proyek baru.
              </p>
            ) : (
              <div className="byt__tabel">
                <Tabel kolom={kolom} baris={baris} kepala="mint" pad={12} tinggiKepala={37} tinggiBaris={78} fontBaris={12} />
              </div>
            )}
          </article>
        </div>
      </section>

      <DialogBayar bayar={bayar} onTutup={() => setBayar(null)} onSelesai={sesudahBayar} />
    </div>
  );
}

export function BayaranTimKit() {
  return (
    <RequireAuth skeleton={<div className="byt byt--rangka" />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
