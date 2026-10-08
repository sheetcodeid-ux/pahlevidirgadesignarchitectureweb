import { useEffect, useRef, useState, type ReactNode } from "react";
import { gantiTema, temaGelap } from "../../lib/tema";
import { navigate } from "astro:transitions/client";
import { Palet, type ButirPerintah, type KelompokPerintah } from "../kit/Palet";
import { Ikon, type DataIkon } from "../kit/Ikon";
import { Revisi } from "../kit/Nav";
import { Tuts } from "../kit/Tampilan";
import { ArsLampuMeja, ArsOrdner, ArsRevisi, ArsSetGambar, ArsTampakRumah } from "../kit/ikon";
import { daftarLembar, KODE_KELOMPOK, lembarTampil, lembarUntuk, revisiPerLembar, type Lembar } from "../../lib/navAdmin";
import { ikonNav, KunciDenah, zonaDenah } from "./RelKit";
import { daftarProyek, bacaCache, profilTersimpan, type Proyek } from "../../lib/admin";
import { CATEGORY_LABELS } from "../../lib/api";
import { formatRupiah } from "../../lib/format";
import { revisiPerHalaman, TAHAP_PROYEK, type BarisNotifikasi } from "../../lib/notifikasi";
import { kodeProyek } from "../../lib/nomorDokumen";
import { tanggalRevisi } from "./jamStudio";

/* =============================================================================
   Palet perintah panel (Ctrl/Cmd+K, dan kotak "Cari lembar" di kepala) =
   DAFTAR GAMBAR YANG BISA DICARI, dengan PRATINJAU LEMBAR.

   Rancangan dipilih pemilik dari dua sketsa: tabel No. · Judul lembar ·
   Kategori · Rev, dikelompokkan per kotak huruf disiplin seperti rel
   samping, lalu MAP PROYEK dan AKSI; di kanan, lembar yang sedang dipilih
   digambar: kertas berbingkai dengan ikon lembarnya yang ditarik pena dan
   kop kecil bernomor, jalur kategori, urutan di set, revisi yang menunggu,
   dan letaknya di kunci denah. Untuk proyek: foto sampul, klien, tangga
   tahap, nilai kontrak, tenggat final.

   Semuanya data sungguhan dari sumber yang sama dengan rel: nomor dari
   `lembarTampil`, revisi dari `revisiPerLembar(revisiPerHalaman(baris))` —
   butir yang sama dengan segitiga notifikasi di kepala (jebakan #32).
   Daftar proyek diambil saat palet DIBUKA — palet dipasang di setiap
   halaman dan jarang dibuka.
   ============================================================================= */

const URUT_TAHAP = Object.keys(TAHAP_PROYEK);

/** Tangga tahap pipeline — tujuh anak tangga, yang sudah dilewati terisi. */
function Tangga({ tahap, className }: { tahap?: string | null; className?: string }) {
  const ke = tahap ? URUT_TAHAP.indexOf(tahap) : -1;
  return (
    <span
      className={className ? `plp__tangga ${className}` : "plp__tangga"}
      role="img"
      aria-label={ke >= 0 ? `Tahap ${ke + 1} dari ${URUT_TAHAP.length}: ${TAHAP_PROYEK[tahap!]}` : "Tahap belum diisi"}
    >
      {URUT_TAHAP.map((t, i) => (
        <i key={t} className={i <= ke ? "is-lewat" : undefined} />
      ))}
    </span>
  );
}

/* Kertas mini: bingkai cetak ganda, gambar di tengah (ikon yang ditarik pena
   atau foto sampul proyek), kop kecil bernomor di pojok kanan bawah. */
function Kertas({ ikon, foto, kopLabel, kopNilai }: { ikon: DataIkon; foto?: string; kopLabel: string; kopNilai: string }) {
  const [gagal, setGagal] = useState(false);
  return (
    <div className="plp__kertas">
      {foto && !gagal ? (
        <img className="plp__foto" src={foto} alt="" onError={() => setGagal(true)} />
      ) : (
        <span className="plp__gambar" aria-hidden="true">
          <Ikon ikon={ikon} ukuran={58} />
        </span>
      )}
      <span className="plp__kop">
        <small>{kopLabel}</small>
        <b>{kopNilai}</b>
      </span>
    </div>
  );
}

function Fakta({ isi }: { isi: [string, ReactNode][] }) {
  return (
    <dl className="plp__fakta">
      {isi.map(([dt, dd]) => (
        <div key={dt}>
          <dt>{dt}</dt>
          <dd>{dd}</dd>
        </div>
      ))}
    </dl>
  );
}

function Buka({ label, onPilih }: { label: string; onPilih: () => void }) {
  return (
    <button type="button" className="plp__buka" onClick={onPilih}>
      {label}
      <Tuts>Enter</Tuts>
    </button>
  );
}

const tanggalPendek = (iso: string) =>
  new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

type IsiPratinjau =
  | { jenis: "lembar"; lembar: Lembar; urut: number; jumlah: number; rev: BarisNotifikasi[] }
  | { jenis: "proyek"; p: Proyek }
  | { jenis: "aksi"; ikon: DataIkon; label: string; kopLabel: string; kopNilai: string; jalur: string; ket: string };

export function PaletPanel({
  buka,
  onBuka,
  baris,
  dibangunPada,
}: {
  buka: boolean;
  onBuka: (b: boolean) => void;
  /** Butir notifikasi dari kepala — kolom REV dan revisi di pratinjau. */
  baris: BarisNotifikasi[] | null;
  /** Stempel build — sel REV di kop, sama dengan sampul rel. */
  dibangunPada: string;
}) {
  const [proyek, setProyek] = useState<Proyek[] | null>(null);
  const [master, setMaster] = useState(false);
  const [gelap, setGelap] = useState(false);
  const kini = useRef({ buka, onBuka });
  kini.current = { buka, onBuka };

  useEffect(() => {
    setMaster(Boolean(profilTersimpan()?.isMasterAdmin));
    const tekan = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        kini.current.onBuka(!kini.current.buka);
      }
    };
    document.addEventListener("keydown", tekan);
    return () => document.removeEventListener("keydown", tekan);
  }, []);

  useEffect(() => {
    if (!buka) return;
    setGelap(temaGelap());
    setProyek((l) => l ?? bacaCache<Proyek[]>("proyek"));
    daftarProyek().then(setProyek).catch(() => {});
  }, [buka]);

  const pergi = (ke: string) => () => {
    onBuka(false);
    navigate(ke);
  };

  const tampil = lembarTampil(master);
  const rev = revisiPerLembar(revisiPerHalaman(baris ?? []));
  const semua = daftarLembar().halaman;
  const zona = zonaDenah(tampil);
  const peta = new Map<string, { isi: IsiPratinjau; onPilih: () => void }>();

  /* Lembar per kategori, urut rel — satu kelompok per kotak huruf disiplin. */
  const kelompok: KelompokPerintah[] = [];
  tampil.forEach((l, i) => {
    let k = kelompok.find((x) => x.judul === l.kelompok);
    if (!k) {
      k = { judul: l.kelompok, huruf: KODE_KELOMPOK[l.kelompok], satuan: "lbr", butir: [] };
      kelompok.push(k);
    }
    const nilai = `lembar:${l.href}`;
    const n = rev.get(l.kode) ?? 0;
    const onPilih = pergi(l.href);
    /* Butir revisi milik lembar ini — pemetaan path yang sama dengan
       `revisiPerLembar`, jadi daftar dan angkanya tidak bisa berbeda. */
    const milik = (baris ?? []).filter((b) => lembarUntuk(b.ke.split(/[?#]/)[0]!, semua)?.lembar.kode === l.kode);
    peta.set(nilai, { isi: { jenis: "lembar", lembar: l, urut: i + 1, jumlah: tampil.length, rev: milik }, onPilih });
    k.butir.push({
      nilai,
      kode: l.kode,
      label: l.label,
      ikon: ikonNav(l.ikon, l.label),
      ket: l.induk ?? l.kelompok,
      kata: l.kelompok,
      ekor: n > 0 ? <Revisi jumlah={n} judul="Perlu ditangani" /> : <span className="plp__strip" aria-hidden="true">—</span>,
      onPilih,
    });
  });
  const butirProyek: ButirPerintah[] = (proyek ?? []).map((p) => {
    const nilai = `proyek:${p.id}`;
    const onPilih = pergi(`/admin/proyek/satu?id=${encodeURIComponent(p.id)}`);
    peta.set(nilai, { isi: { jenis: "proyek", p }, onPilih });
    return {
      nilai,
      kode: kodeProyek(p.title),
      label: p.title,
      ikon: ArsOrdner,
      ket: (p.pipelineStage && TAHAP_PROYEK[p.pipelineStage]) || "Tanpa tahap",
      kata: [p.client, p.city ?? p.location, CATEGORY_LABELS[p.category as keyof typeof CATEGORY_LABELS] ?? p.category].filter(Boolean).join(" "),
      ekor: <Tangga tahap={p.pipelineStage} className="plp__tangga--baris" />,
      onPilih,
    };
  });
  kelompok.push({ judul: "Map proyek", huruf: "M", satuan: "map", butir: butirProyek });

  const baru = lembarUntuk("/admin/proyek/baru", tampil);
  const aksiBaru = pergi("/admin/proyek/baru");
  const aksiTema = () => {
    gantiTema();
    onBuka(false);
  };
  peta.set("aksi:baru", {
    isi: { jenis: "aksi", ikon: ArsTampakRumah, label: "Proyek baru", kopLabel: "Lampiran", kopNilai: baru ? baru.lembar.kode : "—", jalur: baru ? `Lampiran ${baru.lembar.kode} · ${baru.lembar.label}` : "Aksi", ket: "Formulir pekerjaan baru: klien, jenis, lingkup, fee design, tenggat, dan tim per peran." },
    onPilih: aksiBaru,
  });
  peta.set("aksi:tema", {
    isi: { jenis: "aksi", ikon: ArsLampuMeja, label: gelap ? "Padamkan lampu meja" : "Nyalakan lampu meja", kopLabel: "Tema", kopNilai: gelap ? "Gelap" : "Terang", jalur: "Aksi · tema panel", ket: gelap ? "Kembali ke tema terang." : "Pindah ke tema gelap." },
    onPilih: aksiTema,
  });
  /* Notifikasi bukan lembar di daftar gambar — ia daftar revisinya, jadi
     tidak bernomor dan tidak ikut dihitung "N lbr" kategori mana pun. */
  const jumlahNotif = baris?.length ?? 0;
  const aksiNotif = pergi("/admin/notifikasi");
  peta.set("aksi:notifikasi", {
    isi: { jenis: "aksi", ikon: ArsRevisi, label: "Notifikasi", kopLabel: "Revisi", kopNilai: String(jumlahNotif), jalur: "Set gambar · di luar daftar", ket: jumlahNotif > 0 ? `${jumlahNotif} revisi terbuka di seluruh set gambar.` : "Tidak ada revisi yang terbuka." },
    onPilih: aksiNotif,
  });
  kelompok.push({
    judul: "Aksi",
    huruf: "A",
    satuan: "butir",
    butir: [
      {
        nilai: "aksi:notifikasi",
        label: "Notifikasi",
        ikon: ArsRevisi,
        ket: "di luar daftar",
        kata: "revisi lonceng",
        ekor: jumlahNotif > 0 ? <Revisi jumlah={jumlahNotif} judul="Notifikasi" /> : <span className="plp__strip" aria-hidden="true">—</span>,
        onPilih: aksiNotif,
      },
      { nilai: "aksi:baru", label: "Proyek baru", ikon: ArsTampakRumah, ket: baru ? `lampiran ${baru.lembar.kode}` : "aksi", kata: "tambah buat", onPilih: aksiBaru },
      {
        nilai: "aksi:tema",
        label: gelap ? "Padamkan lampu meja" : "Nyalakan lampu meja",
        ikon: ArsLampuMeja,
        ket: gelap ? "tema terang" : "tema gelap",
        kata: "ganti tema gelap terang mode lampu",
        onPilih: aksiTema,
      },
    ],
  });

  const gambar = (nilai: string): ReactNode => {
    const ada = peta.get(nilai);
    if (!ada) return null;
    const { isi, onPilih } = ada;
    if (isi.jenis === "lembar") {
      const l = isi.lembar;
      return (
        <>
          <Kertas ikon={ikonNav(l.ikon, l.label)} kopLabel="Lembar" kopNilai={l.kode} />
          <p className="plp__jalur">
            {l.kelompok}
            {l.induk && <> <i aria-hidden="true">›</i> {l.induk}</>}
          </p>
          <p className="plp__judul">{l.label}</p>
          <Fakta
            isi={[
              ["Urutan", `${isi.urut} / ${isi.jumlah}`],
              ["Revisi", isi.rev.length > 0 ? <span className="plp__rev"><Revisi jumlah={isi.rev.length} judul="Perlu ditangani" />terbuka</span> : "Bersih"],
            ]}
          />
          {isi.rev.length > 0 && (
            <ul className="plp__revisi" aria-label="Revisi terbuka di lembar ini">
              {isi.rev.slice(0, 3).map((b) => {
                /* "Hendra Wijaya — Komersial": nama di depan, sisanya di
                   belakang. Judul butir ("Pesan baru belum dibaca") sama
                   untuk semua butir satu lembar, jadi tidak diulang. */
                const [nama, ...sisa] = b.detail.split(" — ");
                return (
                  <li key={b.id}>
                    <b>{nama}</b>
                    <span>{sisa.join(" — ") || b.judul}</span>
                  </li>
                );
              })}
              {isi.rev.length > 3 && <li className="plp__revisilagi">+{isi.rev.length - 3} lagi</li>}
            </ul>
          )}
          <KunciDenah zona={zona} aktif={l.kelompok} className="plp__denah" />
          <Buka label={`Buka ${l.kode}`} onPilih={onPilih} />
        </>
      );
    }
    if (isi.jenis === "proyek") {
      const p = isi.p;
      const jenis = CATEGORY_LABELS[p.category as keyof typeof CATEGORY_LABELS] ?? p.category;
      const kode = kodeProyek(p.title);
      return (
        <>
          <Kertas ikon={ArsOrdner} foto={p.coverImageUrl} kopLabel="Map" kopNilai={kode} />
          <p className="plp__jalur">Map proyek <i aria-hidden="true">›</i> {jenis}</p>
          <p className="plp__judul">{p.title}</p>
          <p className="plp__sub">{[p.client, p.city ?? p.location].filter(Boolean).join(" · ") || "Klien belum diisi"}</p>
          <div className="plp__tahap">
            <Tangga tahap={p.pipelineStage} />
            <span>{(p.pipelineStage && TAHAP_PROYEK[p.pipelineStage]) || "Tanpa tahap"}</span>
          </div>
          <Fakta
            isi={[
              ["Nilai kontrak", p.contractValue ? formatRupiah(p.contractValue) : "—"],
              ["Tenggat final", p.deadlineFinal ? tanggalPendek(p.deadlineFinal) : "—"],
            ]}
          />
          <Buka label={`Buka map ${kode}`} onPilih={onPilih} />
        </>
      );
    }
    return (
      <>
        <Kertas ikon={isi.ikon} kopLabel={isi.kopLabel} kopNilai={isi.kopNilai} />
        <p className="plp__jalur">{isi.jalur}</p>
        <p className="plp__judul">{isi.label}</p>
        <p className="plp__sub plp__sub--panjang">{isi.ket}</p>
        <Buka label={isi.label} onPilih={onPilih} />
      </>
    );
  };

  const revSet = tanggalRevisi(dibangunPada);
  return (
    <Palet
      buka={buka}
      onBuka={onBuka}
      kelompok={kelompok}
      placeholder="Cari lembar atau proyek…"
      kosong="Tidak ada lembar atau map yang cocok."
      kolom={["No.", "Judul lembar", "Kategori", "Rev"]}
      kop={{
        ikon: ArsSetGambar,
        judul: "Cari lembar",
        sel: [
          { label: "Set gambar", nilai: `${tampil.length} lembar` },
          { label: "Map proyek", nilai: proyek ? `${proyek.length} map` : "—" },
          { label: "Revisi", nilai: revSet ?? "—" },
        ],
      }}
      pratinjau={gambar}
    />
  );
}
