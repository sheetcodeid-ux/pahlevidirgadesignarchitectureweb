import { useEffect, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { Segmen } from "../kit/Segmen";
import { BarisLog } from "../kit/Item";
import { Ikon } from "../kit/Ikon";
import { CaretRight, CheckCircle } from "../kit/ikon";
import { ambilNotifikasi, type IsiNotifikasi } from "../../lib/notifikasi";
import { kepalaHari, waktuButir, ikonButir } from "./linimasaNotif";
import { bacaCache } from "../../lib/admin";

/* =============================================================================
   Notifikasi — seluruh "Perlu Ditangani" dan milestone proyek.

   Dashboard cuma menampilkan butir yang muat di kartunya; halaman ini
   daftar utuhnya, dengan bentuk linimasa yang SAMA (BarisLog, kelompok per
   hari, ikon per sumber dari linimasaNotif.tsx) supaya satu butir tidak
   tampil beda di dua tempat.

   Angka di lonceng tidak punya tombol "tandai sudah dibaca" — keputusan
   pemilik: angkanya turun sendiri begitu sumbernya ditangani.
   ============================================================================= */

type Tab = "notifikasi" | "milestone";

function Isi() {
  const [tab, setTab] = useState<Tab>("notifikasi");
  /* Kunci cache yang sama dengan Dashboard: isinya sama persis. Halaman ini
     cuma MEMBACA — pemilik daftarnya Dashboard (jebakan #8). */
  const [isi, setIsi] = useState<IsiNotifikasi | null>(() => bacaCache<IsiNotifikasi>("dasbor-notif"));

  useEffect(() => {
    ambilNotifikasi()
      .then(setIsi)
      .catch(() => setIsi((l) => l ?? { notifikasi: [], milestone: [], proyekAktif: 0, proyek: [] }));
  }, []);

  const butir = isi ? (tab === "notifikasi" ? isi.notifikasi : isi.milestone) : null;
  /* Terbaru di atas; milestone tidak bertanggal, jadi tetap urutan asalnya. */
  const urut = butir
    ? [...butir].sort((a, b) => (b.tanggal ?? "").localeCompare(a.tanggal ?? ""))
    : null;

  return (
    <section className="kn">
      <Segmen
        judul="Jenis pemberitahuan"
        className="kn__tab"
        nilai={tab}
        onPilih={(v) => setTab(v as Tab)}
        segmen={[
          { nilai: "notifikasi", label: isi ? `Perlu ditangani (${isi.notifikasi.length})` : "Perlu ditangani" },
          { nilai: "milestone", label: isi ? `Milestone (${isi.milestone.length})` : "Milestone" },
        ]}
      />

      {urut === null ? (
        <p className="kn__kosong">Memuat…</p>
      ) : urut.length === 0 ? (
        <p className="kn__kosong kn__kosong--beres">
          <Ikon ikon={CheckCircle} ukuran={18} />
          {tab === "notifikasi"
            ? "Tidak ada yang menunggu. Semua sudah ditangani."
            : "Belum ada proyek yang naik tahap: Deal & Kontrak, DP 50%, Desain, Finish, atau Pelunasan."}
        </p>
      ) : (
        <ol className="kn__daftar">
          {urut.map((n, i) => {
            const kepala = n.tanggal ? kepalaHari(n.tanggal) : null;
            const kepalaLalu = i > 0 && urut[i - 1]!.tanggal ? kepalaHari(urut[i - 1]!.tanggal!) : null;
            const baru = kepala !== null && (i === 0 || kepala !== kepalaLalu);
            const akhir =
              i === urut.length - 1 || (kepala !== null && urut[i + 1]!.tanggal && kepalaHari(urut[i + 1]!.tanggal!) !== kepala);
            return (
              <li key={n.id}>
                {baru && <p className="kn__hari">{kepala}</p>}
                <a className="kn__butir" href={n.ke}>
                  <BarisLog ikon={ikonButir(n)} ikonPx={16} waktu={waktuButir(n) || n.detail} akhir={Boolean(akhir)}>
                    <b>{n.judul}</b>
                    {n.tanggal ? <> — {n.detail}</> : null}
                  </BarisLog>
                  <Ikon ikon={CaretRight} ukuran={16} />
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function NotifikasiKit() {
  return (
    <RequireAuth skeleton={<section className="kn" aria-busy="true" />}>
      <Isi />
    </RequireAuth>
  );
}
