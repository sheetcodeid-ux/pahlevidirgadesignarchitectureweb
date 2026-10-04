import { PilihMenu } from "../kit/Formulir";
import { GagalMuat } from "./gagalMuat";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "./RequireAuth";
import { Cari } from "../kit/Isian";
import { Tombol } from "../kit/Tombol";
import { CaretDown, Funnel, Sliders } from "../kit/ikon";
import { daftarPaket, pemakaianPaket, bacaCache, tulisCache, type Paket, type PemakaianPaket } from "../../lib/admin";
import { KELOMPOK, rentangFee } from "../../lib/tier";

/* =============================================================================
   Paket Layanan, mengikuti frame Figma "31. Promos".

   Kartu promo Coinest dipetakan ke paket layanan studio:

     Coinest                 Halaman ini
     ----------------------  ---------------------------------------------------
     gambar promo            bidang rentang fee — paket tidak punya gambar, dan
                             angka yang tayang di beranda adalah hal pertama
                             yang dicari di halaman ini. Paket yang disorot di
                             beranda bidangnya hijau tua; yang dihentikan abu
                             tua, seperti kartu terakhir framenya
     judul + deskripsi       nama paket + ringkasannya
     "Valid from: tanggal"   "Selesai di harga ini: N dari 3 proyek" — aturan
                             §3.3: tiap tiga proyek selesai, harga naik. Begitu
                             tiga, labelnya jadi amber "saatnya naik 10–15%".
                             Tanggal harga terakhir diubah ada di title-nya
     Filter / Sort By        kelompok (coffee shop / rumah / dihentikan) dan
                             urutan (beranda / fee / terakhir diubah)
     Add Promo               Tambah Paket

   Mengubah paket TIDAK langsung mengubah beranda: situsnya dibekukan saat
   build. Tombol Terbitkan di bilah atas menyala sendiri lewat trigger cap
   isi di database.
   ============================================================================= */

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const tanggal = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};

const SARING = [
  { nilai: "semua", label: "Semua" },
  ...KELOMPOK.map((k) => ({ nilai: k.kunci, label: k.tab })),
  { nilai: "mati", label: "Dihentikan" },
];
const URUT = [
  { nilai: "beranda", label: "Urutan beranda" },
  { nilai: "murah", label: "Fee terendah" },
  { nilai: "mahal", label: "Fee tertinggi" },
  { nilai: "baru", label: "Terakhir diubah" },
];

/** Tombol kit yang membuka dropdown kit — `.k-pilihtombol`. */
function Pilih({
  judul,
  label,
  ikon,
  nilai,
  opsi,
  onUbah,
}: {
  judul: string;
  label: string;
  ikon: typeof Sliders;
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
      pemicu={
        <Tombol ukuran="medium" jenis="ghost" kiri={ikon} kanan={CaretDown} className="k-pilihtombol">
          {label}
        </Tombol>
      }
    />
  );
}

function Isi() {
  const [paket, setPaket] = useState<Paket[] | null>(() => bacaCache<Paket[]>("paket"));
  const [galat, setGalat] = useState<string | null>(null);
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState("semua");
  const [urut, setUrut] = useState("beranda");
  /* Pemakaian tiap paket — pengingat §3.3 dokumen strategi. Gagal memuatnya
     tidak boleh menahan daftar paket, jadi galatnya ditelan. */
  const [pakai, setPakai] = useState<Map<string, PemakaianPaket>>(new Map());

  useEffect(() => {
    pemakaianPaket()
      .then((d) => setPakai(new Map(d.map((u) => [u.tierId, u]))))
      .catch(() => {});
    daftarPaket()
      .then((d) => {
        tulisCache("paket", d);
        setPaket(d);
      })
      .catch((e) => setGalat((e as Error).message));
  }, []);

  const tampak = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const urutKelompok = (p: Paket) => KELOMPOK.findIndex((k) => k.kunci === p.group);
    return (paket ?? [])
      .filter((p) =>
        saring === "semua" ? true : saring === "mati" ? !p.active : p.group === saring && p.active,
      )
      .filter(
        (p) =>
          !q ||
          [p.name, p.summary, p.forWhom, ...p.includes].some((v) => v.toLowerCase().includes(q)),
      )
      .sort((a, b) => {
        if (urut === "murah") return a.feeMin - b.feeMin || a.feeMax - b.feeMax;
        if (urut === "mahal") return b.feeMax - a.feeMax || b.feeMin - a.feeMin;
        if (urut === "baru") return b.updatedAt.localeCompare(a.updatedAt);
        /* Urutan beranda: yang aktif dulu, per kelompok, per sort_order. */
        return (
          Number(b.active) - Number(a.active) ||
          urutKelompok(a) - urutKelompok(b) ||
          a.sortOrder - b.sortOrder
        );
      });
  }, [paket, cari, saring, urut]);

  if (galat && paket === null) {
    return <GagalMuat apa="Paket layanan" galat={galat} />;
  }
  if (paket === null) return <div className="pak pak--rangka" aria-busy="true" />;

  return (
    <div className="pak">
      <div className="pak__alat">
        <div className="pak__alatkiri">
          <Cari
            ukuran="medium"
            judul="Cari paket"
            placeholder="Cari paket"
            className="pak__cari"
            value={cari}
            onChange={(e) => setCari(e.currentTarget.value)}
          />
          <Pilih
            judul="Saring kelompok paket"
            label={saring === "semua" ? "Saring" : SARING.find((o) => o.nilai === saring)!.label}
            ikon={Sliders}
            nilai={saring}
            opsi={SARING}
            onUbah={setSaring}
          />
          <Pilih
            judul="Urutkan paket"
            label={urut === "beranda" ? "Urutkan" : URUT.find((o) => o.nilai === urut)!.label}
            ikon={Funnel}
            nilai={urut}
            opsi={URUT}
            onUbah={setUrut}
          />
        </div>
        <a className="k-tombol k-tombol--medium k-tombol--primary pak__tambah" href="/admin/paket/satu?baru=1">
          Tambah Paket
        </a>
      </div>

      <div className="pak__grid">
        {tampak.map((p) => (
          <a
            key={p.id}
            className={["pak__kartu", !p.active && "is-mati"].filter(Boolean).join(" ")}
            href={`/admin/paket/satu?id=${encodeURIComponent(p.id)}`}
          >
            <span
              className={[
                "pak__bidang",
                p.highlighted && p.active && "pak__bidang--sorot",
                !p.active && "pak__bidang--mati",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="pak__kelompok">
                {KELOMPOK.find((k) => k.kunci === p.group)?.tab ?? p.group}
                {p.highlighted && p.active ? " · Paling dipilih" : ""}
                {!p.active ? " · Dihentikan" : ""}
              </span>
              <span className="pak__harga">
                <small>Rp</small>
                <b>{rentangFee(p)}</b>
                <small>juta</small>
              </span>
            </span>
            <span className="pak__info">
              <span className="pak__nama">{p.name}</span>
              <span className="pak__ringkas">{p.summary || "Belum ada ringkasan."}</span>
              {/* "Valid until" milik frame 31 jadi pengingat §3.3: tiap 3
                  proyek selesai di harga ini, harga naik 10–15% untuk klien
                  baru. "Di harga ini" = proyek yang dibuat sesudah fee
                  paketnya terakhir diubah. */}
              {pakai.get(p.id)?.saatnyaNaik ? (
                <span className="pak__label pak__label--naik" title={`Harga terakhir diubah ${tanggal(pakai.get(p.id)!.priceChangedAt)}`}>
                  <b>{pakai.get(p.id)!.selesaiSejakHarga} selesai — saatnya naik 10–15%</b>
                </span>
              ) : (
                <span
                  className="pak__label"
                  title={pakai.get(p.id) ? `Harga terakhir diubah ${tanggal(pakai.get(p.id)!.priceChangedAt)}` : undefined}
                >
                  <span>Selesai di harga ini:</span>
                  <b>{pakai.get(p.id)?.selesaiSejakHarga ?? 0} dari 3 proyek</b>
                </span>
              )}
            </span>
          </a>
        ))}
        {tampak.length === 0 && (
          <p className="pak__kosong">
            {paket.length === 0
              ? "Belum ada paket. Tambahkan paket pertama, lalu terbitkan supaya muncul di beranda."
              : "Tidak ada paket yang cocok dengan pencarian atau saringan ini."}
          </p>
        )}
      </div>
    </div>
  );
}

export function PaketKit() {
  return (
    <RequireAuth skeleton={<div className="pak pak--rangka" />}>
      <Isi />
    </RequireAuth>
  );
}
