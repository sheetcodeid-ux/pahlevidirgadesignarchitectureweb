import * as RSelect from "@radix-ui/react-select";
import * as RPopover from "@radix-ui/react-popover";
import { Command as Cmdk } from "cmdk";
import {
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Ikon, type DataIkon } from "./Ikon";
import { CalendarBlank, CaretDown, CaretLeft, CaretRight, Check, FileText, ImageSquare, MagnifyingGlass, Paperclip, X } from "./ikon";

/* =============================================================================
   Formulir kit — semua isian yang bukan `Isian`/`Cari`/`Centang`/`Sakelar`
   (keempatnya tinggal di Isian.tsx, diukur dari frame Coinest).

   Bentuk dasarnya satu: kotak 46 r8 bergaris --border, fokus = garis
   --brand. Yang tidak bisa dikerjakan elemen asli (pilih bergaya, kombo,
   kalender) memakai primitif; yang bisa, memakai elemen asli — perilaku
   bawaan tidak bisa rusak diam-diam.
   ============================================================================= */

const kelas = (...k: (string | false | undefined | null)[]) => k.filter(Boolean).join(" ");

/* --- Label & Bidang -------------------------------------------------------- */

export function Label({ children, htmlFor, wajib }: { children: ReactNode; htmlFor?: string; wajib?: boolean }) {
  return (
    <label className="k-label" htmlFor={htmlFor}>
      {children}
      {wajib && (
        <span className="k-label__wajib" aria-hidden="true">
          {" "}*
        </span>
      )}
    </label>
  );
}

/**
 * Bidang — label + kontrol + bantuan + galat, untuk kontrol APA PUN.
 *
 * `Isian` sudah membawa labelnya sendiri; Bidang untuk sisanya (pilih,
 * textarea, grup radio). Galat menggantikan bantuan, bukan menambah baris:
 * dua baris kecil di bawah satu kotak membuat orang membaca yang salah.
 */
export function Bidang({
  label,
  children,
  bantu,
  galat,
  wajib,
  id,
}: {
  label: string;
  /** Fungsi menerima id kontrol dan id keterangan, supaya keduanya tersambung. */
  children: (p: { id: string; describedBy?: string; invalid?: boolean }) => ReactNode;
  bantu?: string;
  galat?: string;
  wajib?: boolean;
  id?: string;
}) {
  const otomatis = useId();
  const kunci = id ?? otomatis;
  const ket = galat || bantu ? `${kunci}-ket` : undefined;
  return (
    <div className={kelas("k-bidang", galat && "is-galat")}>
      <Label htmlFor={kunci} wajib={wajib}>
        {label}
      </Label>
      {children({ id: kunci, describedBy: ket, invalid: galat ? true : undefined })}
      {(galat || bantu) && (
        <p id={ket} className={galat ? "k-bidang__galat" : "k-bidang__bantu"} role={galat ? "alert" : undefined}>
          {galat || bantu}
        </p>
      )}
    </div>
  );
}

/* --- Textarea ---------------------------------------------------------------- */

export function IsianPanjang({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={kelas("k-kotak k-teksarea", className)} rows={4} {...p} />;
}

/* --- Input Group: isian dengan tempelan di kiri/kanan (Rp, .com, satuan) --- */

export function KelompokIsian({
  kiri,
  kanan,
  className,
  ...p
}: InputHTMLAttributes<HTMLInputElement> & { kiri?: ReactNode; kanan?: ReactNode }) {
  return (
    <div className={kelas("k-kotak k-kelisian", className)}>
      {kiri && <span className="k-kelisian__tempel">{kiri}</span>}
      <input className="k-kelisian__input" {...p} />
      {kanan && <span className="k-kelisian__tempel">{kanan}</span>}
    </div>
  );
}

/* --- Native select ------------------------------------------------------------
   Elemen <select> asli berkulit kit. Di ponsel ia membuka pemilih sistem —
   persis yang diharapkan orang — dan itu alasan memakainya untuk daftar
   pendek. */

export function PilihAsli({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={kelas("k-pilihasli", className)}>
      <select className="k-kotak k-pilihasli__select" {...p}>
        {children}
      </select>
      <Ikon ikon={CaretDown} ukuran={14} className="k-pilihasli__caret" />
    </span>
  );
}

/* --- Select bergaya (Radix) ---------------------------------------------------
   Untuk pilihan yang butuh keterangan per butir atau ikon — hal yang tidak
   bisa digambar <option>. */

export interface OpsiPilih {
  nilai: string;
  label: string;
  ket?: string;
  ikon?: DataIkon;
  mati?: boolean;
}

export function Pilih({
  opsi,
  nilai,
  onUbah,
  placeholder = "Pilih…",
  label,
  id,
}: {
  opsi: OpsiPilih[];
  nilai?: string;
  onUbah?: (v: string) => void;
  placeholder?: string;
  /** Nama untuk pembaca layar kalau tidak ada <label for>. */
  label?: string;
  id?: string;
}) {
  return (
    <RSelect.Root value={nilai} onValueChange={onUbah}>
      <RSelect.Trigger id={id} className="k-kotak k-pilih" aria-label={label}>
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon asChild>
          <Ikon ikon={CaretDown} ukuran={14} className="k-pilih__caret" />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content className="k-ov k-menu k-pilih__isi" position="popper" sideOffset={6} collisionPadding={12}>
          <RSelect.Viewport>
            {opsi.map((o) => (
              <RSelect.Item key={o.nilai} value={o.nilai} disabled={o.mati} className="k-menu__butir k-pilih__butir">
                {o.ikon && <Ikon ikon={o.ikon} ukuran={16} />}
                <span className="k-pilih__teks">
                  <RSelect.ItemText>{o.label}</RSelect.ItemText>
                  {o.ket && <small>{o.ket}</small>}
                </span>
                <RSelect.ItemIndicator className="k-pilih__tanda">
                  <Ikon ikon={Check} ukuran={14} />
                </RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}

/* --- Combobox: pilih yang bisa dicari ------------------------------------------
   Untuk daftar yang PANJANG (proyek, kontak). Pencariannya milik cmdk —
   mencocokkan potongan kata, bukan awalan saja. */

export function Kombo({
  opsi,
  nilai,
  onUbah,
  placeholder = "Pilih…",
  cariPlaceholder = "Cari…",
  kosong = "Tidak ada yang cocok.",
  label,
  id,
}: {
  opsi: OpsiPilih[];
  nilai?: string;
  onUbah?: (v: string) => void;
  placeholder?: string;
  cariPlaceholder?: string;
  kosong?: string;
  label?: string;
  id?: string;
}) {
  const [buka, setBuka] = useState(false);
  const pilih = opsi.find((o) => o.nilai === nilai);
  /* modal: di dalam Dialog, daftar yang dipotret ke <body> tetap bisa
     digulir dan difokus — penguncian gulir dialog tidak menahannya. */
  return (
    <RPopover.Root open={buka} onOpenChange={setBuka} modal>
      <RPopover.Trigger asChild>
        <button type="button" id={id} className="k-kotak k-pilih" role="combobox" aria-expanded={buka} aria-label={label}>
          <span className={pilih ? undefined : "k-pilih__kosong"}>{pilih?.label ?? placeholder}</span>
          <Ikon ikon={CaretDown} ukuran={14} className="k-pilih__caret" />
        </button>
      </RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content className="k-ov k-menu k-kombo" align="start" sideOffset={6} collisionPadding={12}>
          <Cmdk loop>
            <div className="k-kombo__cari">
              <Ikon ikon={MagnifyingGlass} ukuran={14} />
              <Cmdk.Input className="k-kombo__input" placeholder={cariPlaceholder} autoFocus />
            </div>
            <Cmdk.List className="k-kombo__daftar">
              <Cmdk.Empty className="k-kombo__kosong">{kosong}</Cmdk.Empty>
              {opsi.map((o) => (
                <Cmdk.Item
                  key={o.nilai}
                  value={`${o.label} ${o.ket ?? ""}`}
                  disabled={o.mati}
                  className="k-menu__butir"
                  onSelect={() => {
                    onUbah?.(o.nilai);
                    setBuka(false);
                  }}
                >
                  {o.ikon && <Ikon ikon={o.ikon} ukuran={16} />}
                  <span className="k-pilih__teks">
                    {o.label}
                    {o.ket && <small>{o.ket}</small>}
                  </span>
                  {o.nilai === nilai && <Ikon ikon={Check} ukuran={14} className="k-pilih__tanda" />}
                </Cmdk.Item>
              ))}
            </Cmdk.List>
          </Cmdk>
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}

/* --- Radio Group: elemen asli ---------------------------------------------- */

export function KelompokRadio({
  nama,
  opsi,
  nilai,
  onUbah,
  label,
  arah = "tegak",
}: {
  nama: string;
  opsi: OpsiPilih[];
  nilai?: string;
  onUbah?: (v: string) => void;
  label: string;
  arah?: "tegak" | "datar";
}) {
  return (
    <fieldset className={`k-radio k-radio--${arah}`}>
      <legend className="k-label">{label}</legend>
      {opsi.map((o) => (
        <label key={o.nilai} className={kelas("k-radio__butir", o.mati && "is-mati")}>
          <input
            type="radio"
            name={nama}
            value={o.nilai}
            checked={nilai === undefined ? undefined : nilai === o.nilai}
            disabled={o.mati}
            onChange={() => onUbah?.(o.nilai)}
            className="k-radio__input"
          />
          <span className="k-radio__teks">
            <b>{o.label}</b>
            {o.ket && <small>{o.ket}</small>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/* --- Slider: <input type=range> asli ---------------------------------------
   Isian terisi digambar lewat variabel --isi yang dihitung dari nilainya;
   peramban tidak punya pseudo-elemen lintas-mesin untuk bagian yang terisi. */

export function Geser({
  min = 0,
  maks = 100,
  langkah = 1,
  nilai,
  onUbah,
  label,
  format = (n) => String(n),
}: {
  min?: number;
  maks?: number;
  langkah?: number;
  nilai: number;
  onUbah: (n: number) => void;
  label: string;
  format?: (n: number) => string;
}) {
  const persen = ((nilai - min) / (maks - min || 1)) * 100;
  return (
    <div className="k-geser">
      <div className="k-geser__kepala">
        <span className="k-label">{label}</span>
        <output className="k-geser__nilai">{format(nilai)}</output>
      </div>
      <input
        type="range"
        className="k-geser__input"
        min={min}
        max={maks}
        step={langkah}
        value={nilai}
        aria-label={label}
        aria-valuetext={format(nilai)}
        style={{ ["--isi" as string]: `${persen}%` }}
        onChange={(e) => onUbah(Number(e.target.value))}
      />
    </div>
  );
}

/* --- Input OTP --------------------------------------------------------------
   Tempel satu kode penuh mengisi semua kotak; backspace di kotak kosong
   melompat mundur; panah kiri/kanan berpindah tanpa mengubah isi. */

export function IsianKode({ panjang = 6, onSelesai, label = "Kode" }: { panjang?: number; onSelesai?: (k: string) => void; label?: string }) {
  const [digit, setDigit] = useState<string[]>(() => Array(panjang).fill(""));
  const ref = useRef<(HTMLInputElement | null)[]>([]);
  const fokus = (i: number) => ref.current[Math.max(0, Math.min(panjang - 1, i))]?.focus();
  function terapkan(baru: string[]) {
    setDigit(baru);
    if (!baru.includes("")) onSelesai?.(baru.join(""));
  }
  return (
    <div className="k-kode" role="group" aria-label={`${label}, ${panjang} digit`}>
      {digit.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            ref.current[i] = el;
          }}
          className="k-kotak k-kode__sel"
          data-isi={d ? "" : undefined}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={d}
          aria-label={`Digit ke-${i + 1}`}
          onChange={(e) => {
            const angka = e.target.value.replace(/\D/g, "");
            if (!angka) return;
            const baru = [...digit];
            for (let k = 0; k < angka.length && i + k < panjang; k++) baru[i + k] = angka[k]!;
            terapkan(baru);
            fokus(i + angka.length);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              const baru = [...digit];
              if (baru[i]) baru[i] = "";
              else if (i > 0) {
                baru[i - 1] = "";
                fokus(i - 1);
              }
              setDigit(baru);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              fokus(i - 1);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              fokus(i + 1);
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const angka = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, panjang);
            if (!angka) return;
            const baru = Array(panjang).fill("");
            angka.split("").forEach((c, k) => (baru[k] = c));
            terapkan(baru);
            fokus(angka.length);
          }}
        />
      ))}
    </div>
  );
}

/* --- Lampiran (Attachment) ------------------------------------------------------
   <input type=file> asli di balik zona seret. Berkas yang dipilih tampil
   sebagai keping yang bisa dibuang satu per satu; gambar menampilkan
   pratinjaunya, yang lain ikon jenisnya. */

export function Lampiran({
  terima,
  banyak = false,
  berkas,
  onUbah,
  judul = "Tarik berkas ke sini, atau klik untuk memilih",
  ket,
  mati = false,
  label = "Pilih berkas",
}: {
  terima?: string;
  banyak?: boolean;
  /** Berkas yang sedang dipilih. Kosongkan terus (`[]`) untuk zona yang
      langsung mengunggah begitu berkas dijatuhkan. */
  berkas: File[];
  onUbah: (f: File[]) => void;
  judul?: string;
  ket?: string;
  mati?: boolean;
  label?: string;
}) {
  const [seret, setSeret] = useState(false);
  const masuk = useRef<HTMLInputElement>(null);
  const tambah = (daftar: FileList | null) => {
    if (!daftar?.length) return;
    const baru = Array.from(daftar);
    onUbah(banyak ? [...berkas, ...baru] : baru.slice(0, 1));
  };
  return (
    <div className="k-lampiran">
      <label
        className={kelas("k-lampiran__zona", seret && "is-seret", mati && "is-mati")}
        onDragOver={(e) => {
          e.preventDefault();
          if (!mati) setSeret(true);
        }}
        onDragLeave={() => setSeret(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSeret(false);
          if (!mati) tambah(e.dataTransfer.files);
        }}
      >
        <input
          ref={masuk}
          type="file"
          className="sr-only"
          accept={terima}
          multiple={banyak}
          disabled={mati}
          aria-label={label}
          onChange={(e) => {
            tambah(e.target.files);
            e.target.value = "";
          }}
        />
        <span className="k-lampiran__ubin" aria-hidden="true">
          <Ikon ikon={Paperclip} ukuran={18} />
        </span>
        <b>{judul}</b>
        {ket && <span className="k-lampiran__ket">{ket}</span>}
      </label>
      {berkas.length > 0 && (
        <ul className="k-lampiran__daftar">
          {berkas.map((f, i) => (
            <li key={`${f.name}-${i}`} className="k-lampiran__keping">
              <Ikon ikon={f.type.startsWith("image/") ? ImageSquare : FileText} ukuran={16} />
              <span className="k-lampiran__nama">{f.name}</span>
              <span className="k-lampiran__ukuran">{ukuranBerkas(f.size)}</span>
              <button
                type="button"
                className="k-ov__tutup"
                aria-label={`Buang ${f.name}`}
                onClick={() => onUbah(berkas.filter((_, k) => k !== i))}
              >
                <Ikon ikon={X} ukuran={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ukuranBerkas(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/* --- Toggle & Toggle Group ---------------------------------------------------
   Tombol yang TETAP tertekan (aria-pressed). Bedanya dari Segmen: Segmen
   memilih satu dari beberapa tampilan; Tuas menyalakan/mematikan satu hal,
   dan Kelompok Tuas boleh menyalakan beberapa sekaligus. */

export function Tuas({
  tekan,
  onUbah,
  ikon,
  children,
  className,
  ...p
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & { tekan: boolean; onUbah: (b: boolean) => void; ikon?: DataIkon }) {
  return (
    <button type="button" aria-pressed={tekan} className={kelas("k-tuas", className)} onClick={() => onUbah(!tekan)} {...p}>
      {ikon && <Ikon ikon={ikon} ukuran={14} />}
      {children}
    </button>
  );
}

export function KelompokTuas({
  opsi,
  nilai,
  onUbah,
  banyak = false,
  label,
}: {
  opsi: { nilai: string; label: string; ikon?: DataIkon; judul?: string }[];
  nilai: string[];
  onUbah: (v: string[]) => void;
  /** Boleh lebih dari satu yang menyala. */
  banyak?: boolean;
  label: string;
}) {
  return (
    <div className="k-keltuas" role="group" aria-label={label}>
      {opsi.map((o) => {
        const nyala = nilai.includes(o.nilai);
        return (
          <button
            key={o.nilai}
            type="button"
            aria-pressed={nyala}
            aria-label={o.judul}
            className="k-tuas"
            onClick={() =>
              onUbah(banyak ? (nyala ? nilai.filter((x) => x !== o.nilai) : [...nilai, o.nilai]) : nyala ? [] : [o.nilai])
            }
          >
            {o.ikon && <Ikon ikon={o.ikon} ukuran={14} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* --- Button Group ------------------------------------------------------------
   Tombol-tombol yang menyatu jadi satu bidang. Isinya tombol kit biasa;
   pembungkus ini cuma merapatkan sudut dan garisnya. */

export function KelompokTombol({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="k-keltombol" role="group" aria-label={label}>
      {children}
    </div>
  );
}

/* --- Kalender & Pilih Tanggal ---------------------------------------------------
   Sel tanggalnya bentuk kit yang sudah diukur dari frame Calendar (`.k-tgl`).
   Hari yang tidak bisa dipilih DICORET, bukan sekadar redup — redup mudah
   tertukar dengan "di luar bulan ini". Minggu dimulai hari Senin, seperti
   kalender dinding di Indonesia. */

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"];
const samaHari = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function Kalender({
  nilai,
  onUbah,
  min,
  maks,
  label = "Pilih tanggal",
}: {
  nilai?: Date | null;
  onUbah?: (d: Date) => void;
  min?: Date;
  /** Hari SESUDAH ini dicoret — mis. biaya yang mencatat hal yang sudah terjadi. */
  maks?: Date;
  label?: string;
}) {
  const [tampil, setTampil] = useState(() => {
    const d = nilai ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const hariIni = useMemo(() => new Date(), []);
  const sel = useMemo(() => {
    const geser = (tampil.getDay() + 6) % 7; // Senin = 0
    return Array.from({ length: 42 }, (_, i) => new Date(tampil.getFullYear(), tampil.getMonth(), 1 - geser + i));
  }, [tampil]);
  const pindah = (n: number) => setTampil(new Date(tampil.getFullYear(), tampil.getMonth() + n, 1));

  return (
    <div className="k-kalender" role="group" aria-label={label}>
      <div className="k-kalender__kepala">
        <button type="button" className="k-ov__tutup" onClick={() => pindah(-1)} aria-label="Bulan sebelumnya">
          <Ikon ikon={CaretLeft} ukuran={14} />
        </button>
        <span className="k-kalender__judul" aria-live="polite">
          {BULAN[tampil.getMonth()]} {tampil.getFullYear()}
        </span>
        <button type="button" className="k-ov__tutup" onClick={() => pindah(1)} aria-label="Bulan berikutnya">
          <Ikon ikon={CaretRight} ukuran={14} />
        </button>
      </div>
      <div className="k-kalender__kisi">
        {HARI.map((h) => (
          <span key={h} className="k-hari" aria-hidden="true">
            {h}
          </span>
        ))}
        {sel.map((d) => {
          const luar = d.getMonth() !== tampil.getMonth();
          const mati = (min ? d < min && !samaHari(d, min) : false) || (maks ? d > maks && !samaHari(d, maks) : false);
          const pilih = nilai ? samaHari(d, nilai) : false;
          const kini = samaHari(d, hariIni);
          return (
            <button
              key={d.toISOString()}
              type="button"
              disabled={mati}
              aria-pressed={pilih}
              aria-label={`${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}${kini ? ", hari ini" : ""}`}
              className={kelas("k-tgl", pilih ? "k-tgl--pilih" : kini ? "k-tgl--kini" : luar ? "k-tgl--mati" : "k-tgl--biasa", mati && "is-coret")}
              onClick={() => onUbah?.(d)}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** "2026-10-01" ⇄ Date, tanpa geser zona waktu (Date("2026-10-01") = UTC). */
function keTanggal(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}
export function keIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PilihTanggal({
  nilai,
  onUbah,
  placeholder = "Pilih tanggal",
  min,
  maks,
  id,
  label,
  bisaKosong = true,
}: {
  /** ISO "YYYY-MM-DD", sama dengan nilai <input type=date> — jadi bisa menggantikannya. */
  nilai: string;
  onUbah: (iso: string) => void;
  placeholder?: string;
  min?: string;
  maks?: string;
  id?: string;
  label?: string;
  bisaKosong?: boolean;
}) {
  const [buka, setBuka] = useState(false);
  const d = keTanggal(nilai);
  return (
    <RPopover.Root open={buka} onOpenChange={setBuka} modal>
      <RPopover.Trigger asChild>
        <button type="button" id={id} className="k-kotak k-pilih" aria-label={label}>
          <Ikon ikon={CalendarBlank} ukuran={16} className="k-pilih__ikon" />
          <span className={d ? undefined : "k-pilih__kosong"}>
            {d ? `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}` : placeholder}
          </span>
          <Ikon ikon={CaretDown} ukuran={14} className="k-pilih__caret" />
        </button>
      </RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content className="k-ov k-sembul" align="start" sideOffset={6} collisionPadding={12}>
          <Kalender
            nilai={d}
            min={keTanggal(min) ?? undefined}
            maks={keTanggal(maks) ?? undefined}
            onUbah={(baru) => {
              onUbah(keIso(baru));
              setBuka(false);
            }}
          />
          <div className="k-pilihtgl__kaki">
            <button
              type="button"
              className="k-tombol k-tombol--small k-tombol--transparent"
              disabled={Boolean((min && keIso(new Date()) < min) || (maks && keIso(new Date()) > maks))}
              onClick={() => {
                onUbah(keIso(new Date()));
                setBuka(false);
              }}
            >
              Hari ini
            </button>
            {bisaKosong && nilai && (
              <button type="button" className="k-tombol k-tombol--small k-tombol--transparent" onClick={() => { onUbah(""); setBuka(false); }}>
                Kosongkan
              </button>
            )}
          </div>
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}

/**
 * Isian tanggal berlabel — bentuk `Isian` (label di atas, bantuan di bawah)
 * dengan PilihTanggal sebagai kotaknya. Pengganti langsung
 * `<Isian type="date">`: nilainya ISO yang sama.
 */
export function IsianTanggal({
  label,
  nilai,
  onUbah,
  bantu,
  min,
  maks,
  className,
  bisaKosong = true,
  placeholder,
}: {
  label: string;
  nilai: string;
  onUbah: (iso: string) => void;
  bantu?: string;
  min?: string;
  maks?: string;
  className?: string;
  bisaKosong?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className={kelas("k-isian", className)}>
      <label className="k-isian__label" htmlFor={id}>
        {label}
      </label>
      <PilihTanggal id={id} nilai={nilai} onUbah={onUbah} min={min} maks={maks} bisaKosong={bisaKosong} placeholder={placeholder} />
      {bantu && <p className="k-isian__bantu">{bantu}</p>}
    </div>
  );
}

/**
 * Isian bertempelan berlabel — bentuk `Isian` dengan KelompokIsian sebagai
 * kotaknya. Untuk nominal ("Rp" di depan) dan satuan (m², %).
 */
export function IsianTempel({
  label,
  bantu,
  kiri,
  kanan,
  className,
  id,
  ...p
}: InputHTMLAttributes<HTMLInputElement> & { label: string; bantu?: string; kiri?: ReactNode; kanan?: ReactNode }) {
  const otomatis = useId();
  const kunci = id ?? otomatis;
  return (
    <div className={kelas("k-isian", className)}>
      <label className="k-isian__label" htmlFor={kunci}>
        {label}
      </label>
      <KelompokIsian id={kunci} kiri={kiri} kanan={kanan} aria-describedby={bantu ? `${kunci}-bantu` : undefined} {...p} />
      {bantu && (
        <p id={`${kunci}-bantu`} className="k-isian__bantu">
          {bantu}
        </p>
      )}
    </div>
  );
}
