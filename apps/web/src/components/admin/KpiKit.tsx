import { useEffect, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { KepalaSeksi } from "../kit/Item";
import { KartuStatistikRingkas } from "../kit/Kartu";
import { Lencana, type NadaLencana } from "../kit/Lencana";
import { Tabel, type KolomTabel } from "../kit/Tabel";
import { ChatTeardropDots, CurrencyCircleDollar, Medal, NavSealPercent, Wallet } from "../kit/ikon";
import { ambilKpi, bacaCache, tulisCache, type KpiStrategi } from "../../lib/admin";
import { CATEGORY_LABELS, type ProjectCategory } from "../../lib/api";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";

/* =============================================================================
   KPI Strategi — dokumen STRATEGI_BISNIS §8, fase 4 (H8).

   Lima angka yang dokumen itu tetapkan targetnya, ditambah dua tabel yang
   menjawab "kenapa": proyek yang marginnya di bawah 35%, dan laba per segmen
   (coffee shop sebagai mesin reputasi, rumah tinggal sebagai pilar margin —
   §2). Seluruh angkanya dihitung API dari tabel yang sama dengan halaman
   Keuangan; targetnya konstanta di apps/api/src/repository/kpi.ts.

   Warna status mengikuti aturan situs: hijau = sesuai, amber = belum
   sampai (perlu perhatian, bukan galat). Merah tidak dipakai — angka di
   bawah target bukan perbuatan destruktif.
   ============================================================================= */

const pct = (n: number) => `${n.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;

function status(ok: boolean | null, teksOk: string, teksBelum: string): { nada: NadaLencana; teks: string } {
  if (ok === null) return { nada: "netral", teks: "Belum ada data" };
  return ok ? { nada: "selesai", teks: teksOk } : { nada: "menunggu", teks: teksBelum };
}

function Isi() {
  const [k, setK] = useState<KpiStrategi | null>(() => bacaCache<KpiStrategi>("kpi"));
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    ambilKpi()
      .then((d) => {
        tulisCache("kpi", d);
        setK(d);
      })
      .catch((e) => setGalat((e as Error).message));
  }, []);

  if (!k) {
    return galat ? <p className="kpi__galat">KPI tidak bisa dimuat: {galat}</p> : <div className="kpi kpi--rangka" aria-busy="true" />;
  }

  const t = k.target;
  const sKontrak =
    k.rataKontrak.nilai === null
      ? status(null, "", "")
      : k.rataKontrak.nilai < t.rataKontrakMin
        ? status(false, "", "Di bawah target")
        : status(true, k.rataKontrak.nilai > t.rataKontrakMaks ? "Di atas target" : "Sesuai target", "");
  const sMargin = status(k.margin.rata === null ? null : k.margin.rata >= t.marginMin, "Sesuai target", "Di bawah 35%");
  const sLead = status(k.lead.kuartalIni >= t.leadKuartalMin, "Sesuai target", "Belum sampai");
  const sSig = status(k.signature.jumlah >= t.signatureMin, "Tercapai", `Kurang ${t.signatureMin - k.signature.jumlah}`);
  const sCad = status(k.cadangan.bulan === null ? null : k.cadangan.bulan >= t.cadanganBulan, "Aman", "Belum 6 bulan");

  const kolomMargin: KolomTabel[] = [
    { judul: "Proyek", lebar: 200 },
    { judul: "Kontrak", lebar: 120, kanan: true },
    { judul: "Biaya", lebar: 120, kanan: true },
    { judul: "Margin", lebar: 96, kanan: true },
  ];
  const barisMargin = k.margin.dibawah.map((m) => [
    <a className="kpi__tautan" href={`/admin/proyek/satu?id=${encodeURIComponent(m.projectId)}`}>
      {m.title}
    </a>,
    formatRupiah(m.kontrak),
    formatRupiah(m.biaya),
    <b className={m.margin < 0 ? "kpi__rugi" : "kpi__tipis"}>{pct(m.margin)}</b>,
  ]);

  const kolomSegmen: KolomTabel[] = [
    /* Jumlahnya 500: kartu ini separuh kolom isi (~530 kotak-dalam pada
       1440), dan 610 sebelumnya terpotong di kolom Laba. */
    { judul: "Segmen", lebar: 104 },
    { judul: "Proyek", lebar: 52, kanan: true },
    { judul: "Diterima", lebar: 116, kanan: true },
    { judul: "Biaya", lebar: 112, kanan: true },
    { judul: "Laba kas", lebar: 116, kanan: true },
  ];
  const barisSegmen = [...k.segmen]
    .sort((a, b) => b.laba - a.laba)
    .map((g) => [
      <b>{CATEGORY_LABELS[g.kategori as ProjectCategory] ?? g.kategori}</b>,
      String(g.proyek),
      formatRupiah(g.diterima),
      formatRupiah(g.biaya),
      <b className={g.laba < 0 ? "kpi__rugi" : undefined}>{formatRupiah(g.laba)}</b>,
    ]);

  return (
    <div className="kpi">
      <div className="kpi__angka">
        <KartuStatistikRingkas
          ikon={CurrencyCircleDollar}
          judul="Rata-rata kontrak"
          nilai={k.rataKontrak.nilai === null ? "—" : formatRupiahRingkas(k.rataKontrak.nilai)}
          nilaiPenuh={k.rataKontrak.nilai === null ? undefined : formatRupiah(k.rataKontrak.nilai)}
          tren={<Lencana nada={sKontrak.nada}>{sKontrak.teks}</Lencana>}
          ket={
            <>
              Target <b>Rp50–70 jt</b> · {k.rataKontrak.proyek} proyek
            </>
          }
        />
        <KartuStatistikRingkas
          ikon={NavSealPercent}
          judul="Margin kontrak"
          nilai={k.margin.rata === null ? "—" : pct(k.margin.rata)}
          tren={<Lencana nada={sMargin.nada}>{sMargin.teks}</Lencana>}
          ket={
            <>
              Target <b>≥{t.marginMin}%</b> · {k.margin.proyek} proyek
            </>
          }
        />
        <KartuStatistikRingkas
          ikon={ChatTeardropDots}
          judul={`Lead kuartal ${k.kuartal}`}
          nilai={String(k.lead.kuartalIni)}
          tren={<Lencana nada={sLead.nada}>{sLead.teks}</Lencana>}
          ket={
            <>
              Target <b>
                {t.leadKuartalMin}–{t.leadKuartalMaks}
              </b>{" "}
              · {k.lead.ditindaklanjuti} ditindaklanjuti
            </>
          }
        />
        <KartuStatistikRingkas
          ikon={Medal}
          judul="Signature ke atas"
          nilai={String(k.signature.jumlah)}
          tren={<Lencana nada={sSig.nada}>{sSig.teks}</Lencana>}
          ket={
            <>
              Target <b>≥{t.signatureMin}</b> proyek tahun ini
            </>
          }
        />
        <KartuStatistikRingkas
          ikon={Wallet}
          judul="Cadangan kas"
          nilai={
            k.cadangan.bulan === null
              ? "—"
              : k.cadangan.saldo <= 0
                ? "Saldo minus"
                : `${k.cadangan.bulan.toLocaleString("id-ID", { maximumFractionDigits: 1 })} bln`
          }
          tren={<Lencana nada={sCad.nada}>{sCad.teks}</Lencana>}
          ket={
            <>
              Target <b>{t.cadanganBulan} bulan</b> pengeluaran
            </>
          }
        />
      </div>

      <div className="kpi__bawah">
        <article className="kpi__kartu">
          <KepalaSeksi judul="Margin di Bawah 35%" kanan={<span className="kpi__ket">{k.tahun}</span>} />
          {barisMargin.length ? (
            <div className="kpi__tabel">
              <Tabel kolom={kolomMargin} baris={barisMargin} kepala="mint" pad={12} tinggiKepala={37} tinggiBaris={48} fontBaris={12} />
            </div>
          ) : (
            <p className="kpi__kosong">
              {k.margin.proyek
                ? `Semua ${k.margin.proyek} proyek berkontrak tahun ini di atas ${t.marginMin}%.`
                : "Belum ada proyek berkontrak tahun ini."}
            </p>
          )}
        </article>

        <article className="kpi__kartu">
          <KepalaSeksi judul="Laba per Segmen" kanan={<span className="kpi__ket">{k.tahun}</span>} />
          {barisSegmen.length ? (
            <div className="kpi__tabel">
              <Tabel kolom={kolomSegmen} baris={barisSegmen} kepala="mint" pad={12} tinggiKepala={37} tinggiBaris={48} fontBaris={12} />
            </div>
          ) : (
            <p className="kpi__kosong">Belum ada uang masuk atau keluar proyek tahun ini.</p>
          )}
          <dl className="kpi__cadangan">
            <div>
              <dt>Saldo dari catatan panel</dt>
              <dd>{formatRupiah(k.cadangan.saldo)}</dd>
            </div>
            <div>
              <dt>Rata-rata keluar per bulan</dt>
              <dd>
                {k.cadangan.keluarPerBulan === null ? "—" : formatRupiah(k.cadangan.keluarPerBulan)}
                <small> · {k.cadangan.bulanBerdata} bulan berdata</small>
              </dd>
            </div>
          </dl>
        </article>
      </div>
    </div>
  );
}

export function KpiKit() {
  return (
    <RequireAuth skeleton={<div className="kpi kpi--rangka" />}>
      <Isi />
    </RequireAuth>
  );
}
