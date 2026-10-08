import * as RDialog from "@radix-ui/react-dialog";
import { Command as Cmdk, defaultFilter } from "cmdk";
import { useState, type ReactNode } from "react";
import { Ikon, type DataIkon } from "./Ikon";
import { MagnifyingGlass } from "./ikon";
import { Tuts } from "./Tampilan";

/* =============================================================================
   Palet (Command) — DAFTAR GAMBAR yang bisa dicari.

   Satu bentuk, dua wadah: `DaftarPerintah` (di dalam halaman, mis. galeri)
   dan `Palet` (dialog Ctrl/Cmd+K). Bentuknya bahasa set gambar kerja yang
   sama dengan rel samping: kop berisi sel data, kepala tabel No. · Judul ·
   Keterangan · ujung bergaris rangkap, kepala kelompok berkotak huruf
   disiplin, baris bergaris bawah tipis. Kalau pemanggil memberi
   `pratinjau`, butir yang sedang dipilih digambar di kolom kanan.

   Skor pencocokannya skor cmdk (potongan kata di mana pun, bukan awalan
   saja — "bayar" menemukan "Terima Pembayaran"), dihitung dari KATA KUNCI
   butir, bukan `value`-nya: nilai butir boleh berupa id (uuid proyek), dan
   huruf heksadesimal itu tidak boleh ikut tercari. Penyaringan dan
   urutannya milik palet sendiri — lihat `saringKelompok` (jebakan #79).
   ============================================================================= */

export interface ButirPerintah {
  label: string;
  ikon?: DataIkon;
  /** Teks tambahan yang ikut dicari tapi tidak ditampilkan. */
  kata?: string;
  /** Kolom keterangan (kategori, tahap). Ikut dicari. */
  ket?: string;
  tuts?: string;
  /** Kolom pertama — nomor lembar, kode proyek. Ikut dicari. */
  kode?: string;
  /** Kolom terakhir — segitiga revisi, tangga tahap. Bawaan: `tuts`. */
  ekor?: ReactNode;
  /** Kunci unik butir — dipakai pratinjau. Bawaan: judul kelompok + label. */
  nilai?: string;
  onPilih: () => void;
}
export interface KelompokPerintah {
  judul: string;
  /** Huruf disiplin di kotak kepala kelompok, seperti kepala kategori rel. */
  huruf?: string;
  /** Satuan jumlah saat tidak mencari ("lbr", "map"). Bawaan "butir". */
  satuan?: string;
  butir: ButirPerintah[];
}
export interface KopPalet {
  ikon?: DataIkon;
  judul: string;
  /** Sel data kop — tiap sel label kecil + nilai. */
  sel: { label: string; nilai: ReactNode }[];
}

const nilaiButir = (k: KelompokPerintah, b: ButirPerintah) => b.nilai ?? `${k.judul}::${b.label}`;
const kataKunci = (b: ButirPerintah) => [b.label, b.kode, b.ket, b.kata].filter((x): x is string => Boolean(x));

/* PENYARINGAN DAN URUTAN MILIK PALET, bukan cmdk (`shouldFilter={false}`).
   Skornya tetap skor cmdk (`defaultFilter` — potongan kata di mana pun),
   tapi cmdk tidak menyusun ulang KELOMPOK menurut skor: "lampu" memilih
   "Halaman Publik" lebih dulu daripada "Nyalakan lampu meja" karena
   kelompok Pekerjaan memang lebih dulu di rel. Di sini kelompok diurut
   menurut butir terbaiknya dan butir menurut skornya (urutan rel untuk
   skor sama — sort stabil), dan angka "n hasil" serta "n dari N" dihitung
   dari daftar yang SAMA dengan yang digambar. */
interface Hasil {
  k: KelompokPerintah;
  butir: ButirPerintah[];
}
function saringKelompok(kelompok: KelompokPerintah[], cari: string): Hasil[] {
  const q = cari.trim();
  if (!q) return kelompok.map((k) => ({ k, butir: k.butir }));
  return kelompok
    .map((k) => {
      const skor = k.butir
        .map((b) => [b, defaultFilter(kataKunci(b).join(" "), q)] as const)
        .filter(([, s]) => s > 0)
        .sort((x, y) => y[1] - x[1]);
      return { k, butir: skor.map(([b]) => b), maks: skor[0]?.[1] ?? 0 };
    })
    .filter((h) => h.butir.length > 0)
    .sort((x, y) => y.maks - x.maks);
}

/** Kop bersel set gambar — sel judul + sel data. Dipakai palet dan panel
    Pesan/Notifikasi di kepala halaman, supaya ketiganya satu bentuk. */
export function KopBersel({ kop }: { kop: KopPalet }) {
  return (
    <div className="k-palet__kop">
      <span className="k-palet__kopjudul">
        {kop.ikon && <Ikon ikon={kop.ikon} ukuran={18} />}
        {kop.judul}
      </span>
      {kop.sel.map((s) => (
        <span key={s.label} className="k-palet__kopsel">
          <small>{s.label}</small>
          <b>{s.nilai}</b>
        </span>
      ))}
    </div>
  );
}

function Isi({
  kelompok,
  placeholder,
  kosong,
  kop,
  kolom,
  pratinjau,
}: {
  kelompok: KelompokPerintah[];
  placeholder: string;
  kosong: ReactNode;
  kop?: KopPalet;
  kolom: [string, string, string, string];
  pratinjau?: (nilai: string) => ReactNode;
}) {
  const tampil = kelompok.filter((k) => k.butir.length > 0);
  const total = tampil.reduce((s, k) => s + k.butir.length, 0);
  const [cari, setCari] = useState("");
  const hasil = saringKelompok(tampil, cari);
  const jumlah = hasil.reduce((s, h) => s + h.butir.length, 0);
  /* Pilihan dikendalikan di sini: tiap kali kata cari berganti, butir
     TERBAIK yang dipilih — bukan butir yang kebetulan pertama di DOM. */
  const pertama = hasil[0] ? nilaiButir(hasil[0].k, hasil[0].butir[0]!) : "";
  const [nilai, setNilai] = useState(pertama);
  const [cariLalu, setCariLalu] = useState(cari);
  if (cariLalu !== cari) {
    setCariLalu(cari);
    setNilai(pertama);
  }
  /* Data yang datang belakangan (daftar proyek) bisa menghapus butir yang
     sedang dipilih dari daftar — pilihannya jatuh ke butir terbaik. */
  const ada = hasil.some((h) => h.butir.some((b) => nilaiButir(h.k, b) === nilai));
  const dipilih = ada ? nilai : pertama;
  return (
    <Cmdk className={pratinjau ? "k-palet has-pratinjau" : "k-palet"} loop shouldFilter={false} value={dipilih} onValueChange={setNilai}>
      {kop && <KopBersel kop={kop} />}
      <div className="k-palet__cari">
        <Ikon ikon={MagnifyingGlass} ukuran={16} />
        <Cmdk.Input className="k-palet__input" placeholder={placeholder} autoFocus value={cari} onValueChange={setCari} />
        <Tuts>Esc</Tuts>
      </div>
      <div className="k-palet__badan">
        <div className="k-palet__tabel">
          <div className="k-palet__kepalatabel" aria-hidden="true">
            {kolom.map((k, i) => (
              <span key={i}>{k}</span>
            ))}
          </div>
          <Cmdk.List className="k-palet__daftar">
            {jumlah === 0 && <div className="k-palet__kosong">{kosong}</div>}
            {hasil.map(({ k, butir }) => (
              <Cmdk.Group
                key={k.judul}
                heading={
                  <>
                    {k.huruf && <span className="k-palet__disiplin">{k.huruf}</span>}
                    <span className="k-palet__kelompokteks">{k.judul}</span>
                    <span className="k-palet__kelompokjml">
                      {butir.length} {cari.trim() ? "hasil" : (k.satuan ?? "butir")}
                    </span>
                  </>
                }
                className="k-palet__kelompok"
              >
                {butir.map((b) => (
                  <Cmdk.Item key={nilaiButir(k, b)} value={nilaiButir(k, b)} className="k-palet__butir" onSelect={b.onPilih}>
                    <span className="k-palet__kode">{b.kode}</span>
                    <span className="k-palet__judul">
                      {b.ikon && <Ikon ikon={b.ikon} ukuran={16} />}
                      <span className="k-palet__label">{b.label}</span>
                    </span>
                    <span className="k-palet__ket">{b.ket}</span>
                    <span className="k-palet__ekor">{b.ekor ?? (b.tuts && <Tuts>{b.tuts}</Tuts>)}</span>
                  </Cmdk.Item>
                ))}
              </Cmdk.Group>
            ))}
          </Cmdk.List>
        </div>
        {/* Pratinjau dipasang ulang (kunci = nilai) tiap kali pilihan
            berganti, jadi gerak masuknya — pena yang menggambar ikon —
            berjalan karena perbuatan (panah, ketik, tetikus), bukan saat
            data tiba. */}
        {pratinjau && (
          <aside className="k-palet__pratinjau" aria-label="Pratinjau">
            {dipilih ? (
              <div key={dipilih} className="k-palet__pratinjauisi">
                {pratinjau(dipilih)}
              </div>
            ) : null}
          </aside>
        )}
      </div>
      <div className="k-palet__kaki">
        <span aria-hidden="true">
          <Tuts>↑</Tuts>
          <Tuts>↓</Tuts> pilih
        </span>
        <span aria-hidden="true">
          <Tuts>Enter</Tuts> buka
        </span>
        <span aria-hidden="true">
          <Tuts>Esc</Tuts> tutup
        </span>
        <span className="k-palet__hitung">
          <b>{jumlah}</b> dari {total}
        </span>
      </div>
    </Cmdk>
  );
}

const KOLOM: [string, string, string, string] = ["No.", "Judul", "Keterangan", ""];

export function DaftarPerintah({
  kelompok,
  placeholder = "Ketik perintah atau cari…",
  kosong = "Tidak ada yang cocok.",
  kop,
  kolom = KOLOM,
  pratinjau,
}: {
  kelompok: KelompokPerintah[];
  placeholder?: string;
  kosong?: ReactNode;
  kop?: KopPalet;
  kolom?: [string, string, string, string];
  pratinjau?: (nilai: string) => ReactNode;
}) {
  return (
    <div className="k-palet-wadah">
      <Isi kelompok={kelompok} placeholder={placeholder} kosong={kosong} kop={kop} kolom={kolom} pratinjau={pratinjau} />
    </div>
  );
}

export function Palet({
  buka,
  onBuka,
  kelompok,
  placeholder = "Cari halaman atau proyek…",
  kosong = "Tidak ada yang cocok.",
  kop,
  kolom = KOLOM,
  pratinjau,
}: {
  buka: boolean;
  onBuka: (b: boolean) => void;
  kelompok: KelompokPerintah[];
  placeholder?: string;
  kosong?: ReactNode;
  kop?: KopPalet;
  kolom?: [string, string, string, string];
  pratinjau?: (nilai: string) => ReactNode;
}) {
  return (
    <RDialog.Root open={buka} onOpenChange={onBuka}>
      <RDialog.Portal>
        <RDialog.Overlay className="k-ov__scrim" />
        <RDialog.Content
          className={pratinjau ? "k-ov k-dialog k-dialog--palet has-pratinjau" : "k-ov k-dialog k-dialog--palet"}
          aria-label={kop?.judul ?? "Perintah cepat"}
        >
          <RDialog.Title className="sr-only">{kop?.judul ?? "Perintah cepat"}</RDialog.Title>
          <RDialog.Description className="sr-only">Cari, lalu tekan Enter untuk membukanya.</RDialog.Description>
          <Isi kelompok={kelompok} placeholder={placeholder} kosong={kosong} kop={kop} kolom={kolom} pratinjau={pratinjau} />
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
