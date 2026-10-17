import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { RequireAuth } from "./RequireAuth";
import { GagalMuat } from "./gagalMuat";
import { ToastProvider, useToast } from "../kit/Toast";
import { Dialog } from "../kit/Overlay";
import { Cari, Isian } from "../kit/Isian";
import { PilihMenu } from "../kit/Formulir";
import { Tombol } from "../kit/Tombol";
import { Ikon } from "../kit/Ikon";
import { SorotTeks } from "../kit/Tampilan";
import {
  ArrowClockwise,
  CaretLeft,
  CaretRight,
  ChatTeardropDots,
  NavEnvelope,
  NotePencil,
  Phone,
  Plus,
  Trash,
} from "../kit/ikon";
import { geraknya, Hitung } from "./hitung";
import { inisial, kodeProyek } from "../../lib/nomorDokumen";
import { nomorWa } from "../../lib/telepon";
import { tanya } from "../../lib/tanya";
import { TAHAP } from "../../lib/tahap";
import { formatRupiah, formatRupiahRingkas } from "../../lib/format";
import {
  daftarKontak,
  tambahKontak,
  ubahKontak,
  hapusKontak,
  daftarProyek,
  bacaCache,
  tulisCache,
  type KontakDirektori,
  type Proyek,
} from "../../lib/admin";

/* =============================================================================
   Direktori = BUKU REKANAN — map kartu nama studio.

   Di meja studio, klien, kontraktor, dan supplier yang dipakai berulang
   disimpan sebagai KARTU NAMA di map berkantong plastik: sembilan saku per
   halaman, dipisah lembar pembatas per kategori, dan indeks abjad di tepi
   lembarnya. Kartu yang dibutuhkan DITARIK ke meja; catatan tentang orangnya
   ditulis di BALIK kartu — kebiasaan yang memang berlaku untuk kartu nama.

   1. KOP — "Map kartu nama · N kartu", cari, urutan (A–Z / terbaru), dan
      "Kartu baru".
   2. MAP — sampul gelap `--kas-dalam`, cincin di tepi kiri, lembar pembatas
      bertab (Semua / Klien / Kontraktor / Supplier / Lainnya, jumlahnya ikut
      kata cari), lembar plastik 3×3 saku, indeks abjad A–Z di tepi kanan,
      dan kaki halaman. Nomor kartu RK-NN = urutan diselipkan (createdAt) di
      antara SEMUA kartu — nomor yang diturunkan dari data, seperti nomor
      agenda surat masuk. Kartu yang sedang di meja meninggalkan saku kosong
      bergaris putus "Di meja".
   3. MEJA — kartu besar dua muka: muka depan data kartunya, muka BELAKANG
      catatan yang disimpan saat ditinggalkan. Di bawahnya Telepon / WhatsApp
      / Email (mati beralasan), lalu slip "rekanan ini di studio": proyek yang
      mencatat nama ini sebagai klien atau kontraktor (`client`/`contractor`
      proyek, dicocokkan tanpa sapaan), rekanan seperusahaan, dan tanggalnya.

   Bahan kartu menurut kategori (rona, bukan warna makna): klien kertas putih
   bermonogram mint, kontraktor karton hijau tua, supplier kertas mint pucat,
   lainnya kertas putih berbingkai cetak. DESAIN kartunya milik PERUSAHAANNYA
   (`desainKartu`: pita / kepala / logo / garis, diturunkan dari nama kantor)
   — dua orang dari kantor yang sama memegang kartu yang sama rupanya, seperti
   kartu nama sungguhan.

   Kop membawa kelengkapan buku: berapa kartu yang siap di-WhatsApp, yang
   terlibat proyek studio, dan yang bercatatan; menyentuh satu sel menyorot
   kartunya di lembar yang terbuka. Map berpunggung logam dengan tiga cincin,
   saku plastik bertakik jempol dan berlas, lembar pembatas dari karton
   kategorinya, tepi lembar di kanan bawah = lembar yang masih tersisa. Meja
   = ALAS POTONG berskala milimeter: kartu tergambar 85 × 55 mm, lengkap
   dengan penggaris dan garis ukurnya.

   Gerak — hanya karena perbuatan (jebakan #74), seketika bila gerak
   dikurangi: kartu yang dipilih DITARIK naik dari sakunya lalu terbang ke
   meja sementara kartu lama melayang kembali dan TURUN ke sakunya
   (serentak); lembar plastik DIBALIK di cincinnya saat pindah halaman atau
   pembatas (datar, `scaleX` dari punggung — satu-satunya 3D tetap kartu di
   meja yang DIBALIK); angka kop berhitung; kartu baru diselipkan ke sakunya.
   Disentuh tetikus, kartu di saku tertarik sedikit keluar.
   ============================================================================= */

const KATEGORI: Record<string, string> = {
  klien: "Klien",
  kontraktor: "Kontraktor",
  supplier: "Supplier",
  lainnya: "Lainnya",
};
const URUT_KAT = Object.keys(KATEGORI);
const PEMBATAS = ["semua", ...URUT_KAT];
const PER_HAL = 9;
const ABJAD = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const LEMBUT = "cubic-bezier(0.22, 0.7, 0.2, 1)";

const katDari = (c: string) => (KATEGORI[c] ? c : "lainnya");
const tanggal = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};
function umur(iso: string) {
  const n = Math.floor((Date.now() - Date.parse(iso)) / 864e5);
  if (n <= 0) return "hari ini";
  if (n === 1) return "kemarin";
  if (n < 60) return `${n} hari lalu`;
  return tanggal(iso);
}

/* Desain kartu — milik PERUSAHAANNYA (atau orangnya, kalau perorangan):
   kartu dari kantor yang sama selalu bergaya sama. */
const DESAIN = ["pita", "kepala", "logo", "garis"] as const;
type Desain = (typeof DESAIN)[number];
function desainKartu(k: Pick<KontakDirektori, "name" | "company">): Desain {
  const kunci = normal(k.company) || normal(k.name) || "?";
  let h = 5381;
  for (const c of kunci) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return DESAIN[h % DESAIN.length]!;
}
const kelasKartu = (k: Pick<KontakDirektori, "name" | "company" | "category">) =>
  `is-${katDari(k.category)} is-d-${desainKartu(k)}`;

/** Nomor yang bisa dibuka di WhatsApp — seluler (62 8…), bukan nomor kantor. */
function waSeluler(telepon?: string | null) {
  const w = nomorWa(telepon);
  return w && /^628/.test(w) ? w : null;
}

type Sorot = "wa" | "proyek" | "catatan";

/** Nomor kartu RK-NN: urutan diselipkan di antara SEMUA kartu. */
function nomorKartu(semua: readonly KontakDirektori[]) {
  const urut = semua
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id.localeCompare(b.id)));
  return new Map(urut.map((k, i) => [k.id, `RK-${String(i + 1).padStart(2, "0")}`]));
}

/* Nama tanpa sapaan dan bentuk badan usaha — "Bu Ratna Sari" dan "Bu Ratna"
   di kolom klien proyek adalah orang yang sama, begitu juga "CV Karya Bangun"
   dan "Karya Bangun". */
const SAPAAN = /^(bu|ibu|pak|bapak|bpk|sdr|sdri|saudara|saudari|tn|ny|nn|pt|cv|ud|toko)\s+/;
function normal(s?: string | null) {
  let t = (s ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (let i = 0; i < 2; i++) t = t.replace(SAPAAN, "");
  return t;
}
function sama(a?: string | null, b?: string | null) {
  const x = normal(a);
  const y = normal(b);
  if (x.length < 3 || y.length < 3) return false;
  return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
}
/** "Bu Ratna Sari" → RS, "Toko Kayu Jati Borneo" → KJ. */
function monogram(nama: string) {
  let t = nama.trim();
  for (let i = 0; i < 2; i++) t = t.replace(/^(bu|ibu|pak|bapak|bpk|sdr|sdri|pt|cv|ud|toko)\.?\s+/i, "");
  return inisial(t || nama) || "–";
}

interface Relasi {
  p: Proyek;
  peran: "klien" | "kontraktor";
}
function proyekRekanan(k: KontakDirektori, proyek: readonly Proyek[]): Relasi[] {
  const hasil: Relasi[] = [];
  for (const p of proyek) {
    if (p.client && (sama(p.client, k.name) || sama(p.client, k.company))) hasil.push({ p, peran: "klien" });
    else if (p.contractor && (sama(p.contractor, k.name) || sama(p.contractor, k.company)))
      hasil.push({ p, peran: "kontraktor" });
  }
  return hasil;
}

/* Isi kartu — sama di saku, di meja, dan di pratinjau dialog. Anaknya rata
   (tanpa pembungkus) supaya tiap desain menata letaknya sendiri lewat
   `grid-template-areas` di stylesheet. */
type IsiKartu = Pick<KontakDirektori, "name" | "category" | "company" | "phone" | "email" | "note">;
function KartuNama({
  k,
  nomor,
  cari = "",
  besar = false,
  diselipkan,
  proyekN = 0,
}: {
  k: IsiKartu;
  nomor: string;
  cari?: string;
  besar?: boolean;
  diselipkan?: string;
  proyekN?: number;
}) {
  const kat = katDari(k.category);
  const desain = desainKartu(k);
  const q = cari.trim().toLowerCase();
  const cocokCatatan =
    Boolean(q) &&
    (k.note ?? "").toLowerCase().includes(q) &&
    ![k.name, k.company, k.phone, k.email, nomor].some((v) => (v ?? "").toLowerCase().includes(q));
  const uk = besar ? 13 : 10;
  return (
    <>
      {desain === "garis" && <i className="brk__kgaris" aria-hidden="true" />}
      {/* Bagian atas kartu. Di desain KEPALA ia bidang sewarna kantornya
          (leluhur sungguhan tulisannya); di desain lain `display: contents`. */}
      <span className="brk__katas">
      <span className="brk__mono" aria-hidden="true">
        {monogram(k.name || "?")}
      </span>
      <span className="brk__kkat">
        {cocokCatatan ? <mark>cocok di catatan</mark> : KATEGORI[kat]}
      </span>
      {k.note ? (
        <span className="brk__adacatat" aria-hidden="true">
          <Ikon ikon={NotePencil} ukuran={besar ? 13 : 10} />
        </span>
      ) : null}
      <span className="brk__nomor">
        {nomor}
        {proyekN > 0 && <small className="brk__kjejak">{proyekN} proyek</small>}
      </span>
      <span className="brk__knama">
        <SorotTeks teks={k.name.trim() || "Nama rekanan"} cari={cari} />
      </span>
      <span className={`brk__kpt${k.company ? "" : " is-kosong"}`}>
        {k.company ? <SorotTeks teks={k.company} cari={cari} /> : "—"}
      </span>
      </span>
      <span className="brk__ktel">
        <Ikon ikon={Phone} ukuran={uk} />
        <span>{k.phone ? <SorotTeks teks={k.phone} cari={cari} /> : "—"}</span>
      </span>
      <span className="brk__kmail">
        <Ikon ikon={NavEnvelope} ukuran={uk} />
        <span>{k.email ? <SorotTeks teks={k.email} cari={cari} /> : "—"}</span>
      </span>
      {besar && diselipkan && (
        <span className="brk__kkaki">
          <span>Diselipkan {tanggal(diselipkan)}</span>
          <span className="brk__petunjuk">
            <Ikon ikon={ArrowClockwise} ukuran={12} />
            Balik untuk catatan
          </span>
        </span>
      )}
    </>
  );
}

function labelKartu(k: KontakDirektori, nomor: string) {
  return [nomor, k.name, k.company, KATEGORI[katDari(k.category)], k.note ? "ada catatan di balik kartu" : null]
    .filter(Boolean)
    .join(", ");
}

function Isi() {
  const toast = useToast();
  const [kontak, setKontak] = useState<KontakDirektori[] | null>(() => bacaCache<KontakDirektori[]>("direktori"));
  const [galat, setGalat] = useState<string | null>(null);
  /* Kunci "proyek" milik Semua Proyek — dibaca saja (jebakan #8). */
  const [proyek, setProyek] = useState<Proyek[]>(() => bacaCache<Proyek[]>("proyek") ?? []);
  const [cari, setCari] = useState("");
  const [kat, setKat] = useState("semua");
  const [urut, setUrut] = useState<"az" | "baru">("az");
  const [hal, setHal] = useState(0);
  const [pilihId, setPilihId] = useState<string | null>(() =>
    typeof location === "undefined" ? null : new URLSearchParams(location.search).get("id"),
  );
  const [balik, setBalik] = useState(false);
  const [dialog, setDialog] = useState<null | { mode: "baru" } | { mode: "ubah"; k: KontakDirektori }>(null);
  const [baruId, setBaruId] = useState<string | null>(null);
  /* Sel kop yang sedang disentuh tetikus — kartunya disorot di lembar. */
  const [sorot, setSorot] = useState<Sorot | null>(null);

  const besarRef = useRef<HTMLDivElement>(null);
  const miringRef = useRef<HTMLDivElement>(null);
  const lapisRef = useRef<HTMLDivElement>(null);
  const kantongRef = useRef<HTMLUListElement>(null);
  const lembarRef = useRef<HTMLDivElement>(null);
  const catatanRef = useRef<HTMLTextAreaElement>(null);
  const tambahRef = useRef<HTMLButtonElement>(null);
  const terbang = useRef<{ lama: string | null; salinan: HTMLElement | null } | null>(null);
  const balikRef = useRef<{ arah: number; lama: HTMLElement } | null>(null);
  const fokusKe = useRef<string | null>(null);
  const lompatKe = useRef<string | null>(null);

  function muat() {
    daftarKontak()
      .then((d) => {
        tulisCache("direktori", d);
        setKontak(d);
        setGalat(null);
      })
      .catch((e) => setGalat((e as Error).message));
  }
  useEffect(muat, []);
  useEffect(() => {
    daftarProyek()
      .then(setProyek)
      .catch(() => {});
  }, []);

  const semua = kontak ?? [];
  const nomor = useMemo(() => nomorKartu(semua), [kontak]);
  const q = cari.trim().toLowerCase();
  const hasilCari = useMemo(
    () =>
      semua.filter(
        (k) => !q || [k.name, k.company, k.phone, k.email, k.note, nomor.get(k.id)].some((v) => (v ?? "").toLowerCase().includes(q)),
      ),
    [kontak, q, nomor],
  );
  const perKat = useMemo(() => {
    const m = new Map<string, number>([["semua", hasilCari.length]]);
    for (const k of hasilCari) m.set(katDari(k.category), (m.get(katDari(k.category)) ?? 0) + 1);
    return m;
  }, [hasilCari]);
  const tampak = useMemo(
    () =>
      hasilCari
        .filter((k) => kat === "semua" || katDari(k.category) === kat)
        .sort((a, b) =>
          urut === "az"
            ? a.name.localeCompare(b.name, "id", { sensitivity: "base" })
            : a.createdAt < b.createdAt
              ? 1
              : a.createdAt > b.createdAt
                ? -1
                : 0,
        ),
    [hasilCari, kat, urut],
  );
  const nHal = Math.max(1, Math.ceil(tampak.length / PER_HAL));
  const halKini = Math.min(hal, nHal - 1);
  const isiHal = tampak.slice(halKini * PER_HAL, halKini * PER_HAL + PER_HAL);
  /* Kartu bawaan di meja = yang paling banyak bekerja dengan studio di
     halaman pertama (lalu urutan map) — kartu indeksnya langsung berisi.
     Dihitung dari halaman PERTAMA saja, jadi membalik halaman tidak
     menukar kartu di meja; setiap perbuatan pada satu kartu mengunci
     pilihannya lebih dulu (jebakan #88). */
  const jejakN = (k: KontakDirektori) => proyekRekanan(k, proyek).length;
  const bawaan = useMemo(() => {
    let best: KontakDirektori | null = null;
    for (const k of tampak.slice(0, PER_HAL)) {
      if (!best || (jejakN(k) > jejakN(best))) best = k;
    }
    return best;
  }, [tampak, proyek]);
  const kini = tampak.find((k) => k.id === pilihId) ?? bawaan ?? null;
  const posisi = kini ? tampak.indexOf(kini) : -1;
  const kiniDiHal = kini ? isiHal.includes(kini) : false;

  const huruf = useMemo(() => {
    const m = new Map<string, number>();
    tampak.forEach((k, i) => {
      const h = monogramHuruf(k.name);
      if (h && !m.has(h)) m.set(h, i);
    });
    return m;
  }, [tampak]);
  const hurufHal = new Set(isiHal.map((k) => monogramHuruf(k.name)));
  const hurufKini = kini ? monogramHuruf(kini.name) : null;
  const hurufTab = hurufKini && huruf.has(hurufKini) ? hurufKini : (ABJAD.find((h) => huruf.has(h)) ?? null);

  /* Proyek bersama studio untuk SETIAP kartu — angkanya tercetak di kartu
     ("Klien · 2 proyek") dan di sel kop. */
  const jejak = useMemo(() => new Map(semua.map((k) => [k.id, proyekRekanan(k, proyek)])), [kontak, proyek]);
  const relasi = kini ? (jejak.get(kini.id) ?? []) : [];
  /* Jumlah kontrak bersama baru ditulis kalau ada DUA proyek bernilai atau
     lebih — untuk satu proyek angkanya sudah ada di barisnya sendiri. */
  const bernilai = relasi.filter((r) => r.peran === "klien" && r.p.contractValue);
  const nilaiBersama = bernilai.length > 1 ? bernilai.reduce((a, r) => a + (r.p.contractValue ?? 0), 0) : 0;
  const cocokSorot = (k: KontakDirektori, s: Sorot) =>
    s === "wa" ? Boolean(waSeluler(k.phone)) : s === "proyek" ? (jejak.get(k.id)?.length ?? 0) > 0 : Boolean(k.note?.trim());
  const statistik = useMemo(() => {
    const terlibat = semua.filter((k) => (jejak.get(k.id)?.length ?? 0) > 0);
    return {
      wa: semua.filter((k) => waSeluler(k.phone)).length,
      terlibat: terlibat.length,
      proyekUnik: new Set(terlibat.flatMap((k) => jejak.get(k.id)!.map((r) => r.p.id))).size,
      catatan: semua.filter((k) => k.note?.trim()).length,
    };
  }, [kontak, jejak]);
  const seperusahaan = useMemo(
    () =>
      kini
        ? semua.filter(
            (k) =>
              k.id !== kini.id &&
              ((kini.company && (sama(k.company, kini.company) || sama(k.name, kini.company))) ||
                (k.company && sama(k.company, kini.name))),
          )
        : [],
    [kini, kontak],
  );

  /* ---- Memilih kartu: terbang dari sakunya ke meja ------------------------ */
  function pilih(k: KontakDirektori, opsi: { fokus?: boolean } = {}) {
    if (opsi.fokus) fokusKe.current = k.id;
    if (kini && k.id === kini.id) {
      if (opsi.fokus) setHal(Math.floor(tampak.indexOf(k) / PER_HAL));
      return;
    }
    const i = tampak.indexOf(k);
    if (i >= 0) {
      const tuju = Math.floor(i / PER_HAL);
      if (tuju !== halKini) siapBalik(Math.sign(tuju - halKini));
      setHal(tuju);
    }
    if (geraknya()) {
      let salinan: HTMLElement | null = null;
      const el = besarRef.current;
      const lapis = lapisRef.current;
      if (kini && el && lapis) {
        /* Salinan kartu lama, di lapisan yang tidak pernah dirender React —
           ia kembali ke sakunya sementara kartu baru terbang ke meja. */
        const r = el.getBoundingClientRect();
        salinan = el.cloneNode(true) as HTMLElement;
        salinan.removeAttribute("id");
        salinan.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id"));
        salinan.querySelectorAll(".is-balik").forEach((x) => x.classList.remove("is-balik"));
        salinan.setAttribute("inert", "");
        salinan.classList.add("brk__salinan");
        Object.assign(salinan.style, {
          left: `${r.left}px`,
          top: `${r.top}px`,
          width: `${r.width}px`,
          height: `${r.height}px`,
        });
        lapis.querySelectorAll(".brk__salinan").forEach((x) => x.remove());
        lapis.appendChild(salinan);
      }
      terbang.current = { lama: kini?.id ?? null, salinan };
    }
    setBalik(false);
    setPilihId(k.id);
    history.replaceState(null, "", `?id=${encodeURIComponent(k.id)}`);
  }

  useLayoutEffect(() => {
    const t = terbang.current;
    terbang.current = null;
    if (!t || !kini) return;
    const besar = besarRef.current;
    const asal = document.querySelector<HTMLElement>(`[data-saku="${CSS.escape(kini.id)}"] .brk__kartu`);
    const D = 680;
    if (besar && asal) {
      /* DITARIK dulu: naik sepertiga tinggi kartu dari bibir sakunya, baru
         terbang ke meja sambil membesar. */
      const a = asal.getBoundingClientRect();
      const b = besar.getBoundingClientRect();
      const sk = `scale(${a.width / b.width}, ${a.height / b.height})`;
      const tarik = a.height * 0.34;
      besar.animate(
        [
          { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) ${sk}`, transformOrigin: "0 0", easing: "ease-out" },
          {
            transform: `translate(${a.left - b.left}px, ${a.top - b.top - tarik}px) ${sk}`,
            transformOrigin: "0 0",
            offset: 0.24,
            easing: LEMBUT,
          },
          { transform: "none", transformOrigin: "0 0" },
        ],
        { duration: D },
      );
    } else if (besar) {
      besar.animate([{ transform: "translateY(-14px)", opacity: 0 }, { transform: "none", opacity: 1 }], {
        duration: 420,
        easing: LEMBUT,
      });
    }
    const s = t.salinan;
    if (!s) return;
    const tujuan = t.lama ? document.querySelector<HTMLElement>(`[data-saku="${CSS.escape(t.lama)}"] .brk__kartu`) : null;
    const r = s.getBoundingClientRect();
    if (tujuan) {
      /* Kartu lama melayang di atas sakunya, lalu TURUN masuk. */
      const a = tujuan.getBoundingClientRect();
      tujuan.style.visibility = "hidden";
      const sk = `scale(${a.width / r.width}, ${a.height / r.height})`;
      const anim = s.animate(
        [
          { transform: "none", easing: LEMBUT },
          { transform: `translate(${a.left - r.left}px, ${a.top - r.top - a.height * 0.34}px) ${sk}`, offset: 0.76, easing: "ease-in" },
          { transform: `translate(${a.left - r.left}px, ${a.top - r.top}px) ${sk}` },
        ],
        { duration: D, fill: "forwards" },
      );
      anim.onfinish = anim.oncancel = () => {
        tujuan.style.visibility = "";
        s.remove();
      };
    } else {
      const anim = s.animate(
        [
          { transform: "none", opacity: 1 },
          { transform: "translateY(22px) scale(0.94)", opacity: 0 },
        ],
        { duration: 380, easing: LEMBUT, fill: "forwards" },
      );
      anim.onfinish = anim.oncancel = () => s.remove();
    }
  }, [kini?.id]);

  /* Fokus papan ketik mengikuti kartu yang dipilih di map. */
  useLayoutEffect(() => {
    const id = fokusKe.current;
    if (!id) return;
    fokusKe.current = null;
    document.querySelector<HTMLElement>(`[data-saku="${CSS.escape(id)}"] .brk__kartu`)?.focus();
  });

  /* Kartu baru: halaman map berpindah ke halaman tempat ia diselipkan. */
  useLayoutEffect(() => {
    const id = lompatKe.current;
    if (!id) return;
    const i = tampak.findIndex((k) => k.id === id);
    if (i < 0) return;
    lompatKe.current = null;
    setHal(Math.floor(i / PER_HAL));
  });
  useEffect(() => {
    if (!baruId) return;
    const t = window.setTimeout(() => setBaruId(null), 1400);
    return () => window.clearTimeout(t);
  }, [baruId]);

  /* ---- Halaman map: lembar plastik DIBALIK di cincinnya ----------------------
     Salinan lembar lama diambil SEBELUM halaman berganti, lalu diputar di
     lapisan yang tidak pernah dirender React. Maju = lembar lama terlipat ke
     punggung (ke kiri) dan lembar baru sudah menunggu di bawahnya; mundur =
     lembar sebelumnya datang dari punggung menutupi lembar yang terbuka. */
  function salinLembar() {
    const lb = lembarRef.current;
    if (!lb) return null;
    const r = lb.getBoundingClientRect();
    const el = lb.cloneNode(true) as HTMLElement;
    el.removeAttribute("id");
    el.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id"));
    el.querySelectorAll("[data-saku]").forEach((x) => x.removeAttribute("data-saku"));
    el.setAttribute("inert", "");
    el.classList.add("brk__salinanlembar");
    Object.assign(el.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    return el;
  }
  function siapBalik(arah: number) {
    if (!arah || !geraknya()) return;
    balikRef.current?.lama.remove();
    const lama = salinLembar();
    balikRef.current = lama ? { arah, lama } : null;
  }
  useLayoutEffect(() => {
    const b = balikRef.current;
    balikRef.current = null;
    const lapis = lapisRef.current;
    if (!b || !lapis) return;
    const D = 540;
    const lipat: Keyframe[] = [
      { transform: "none", filter: "brightness(1)" },
      { transform: "scaleX(0.02) skewY(-2deg)", filter: "brightness(0.42)" },
    ];
    if (b.arah > 0) {
      lapis.appendChild(b.lama);
      const a = b.lama.animate(lipat, { duration: D, easing: "cubic-bezier(0.5, 0, 0.75, 0.45)", fill: "forwards" });
      a.onfinish = a.oncancel = () => b.lama.remove();
      return;
    }
    const baru = salinLembar();
    if (!baru) {
      b.lama.remove();
      return;
    }
    lapis.append(b.lama, baru);
    const a = baru.animate([...lipat].reverse(), { duration: D, easing: LEMBUT, fill: "forwards" });
    a.onfinish = a.oncancel = () => {
      b.lama.remove();
      baru.remove();
    };
  }, [halKini, kat]);

  function keHal(n: number) {
    const tuju = Math.max(0, Math.min(nHal - 1, n));
    if (tuju === halKini) return;
    siapBalik(tuju - halKini);
    setHal(tuju);
  }

  function gantiKat(v: string) {
    if (v === kat) return;
    siapBalik(PEMBATAS.indexOf(v) - PEMBATAS.indexOf(kat));
    setKat(v);
    setHal(0);
  }

  function tombolTab(e: KeyboardEvent<HTMLDivElement>) {
    let i = PEMBATAS.indexOf(kat);
    if (e.key === "ArrowRight") i = (i + 1) % PEMBATAS.length;
    else if (e.key === "ArrowLeft") i = (i - 1 + PEMBATAS.length) % PEMBATAS.length;
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = PEMBATAS.length - 1;
    else return;
    e.preventDefault();
    gantiKat(PEMBATAS[i]!);
    document.getElementById(`brk-tab-${PEMBATAS[i]}`)?.focus();
  }

  function tombolMap(e: KeyboardEvent<HTMLUListElement>) {
    const id = (e.target as HTMLElement).closest("[data-saku]")?.getAttribute("data-saku");
    const dari = tampak.findIndex((k) => k.id === id);
    if (dari < 0) return;
    const langkah: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3, PageDown: 9, PageUp: -9 };
    let j: number;
    if (e.key in langkah) j = dari + langkah[e.key]!;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = tampak.length - 1;
    else return;
    e.preventDefault();
    j = Math.max(0, Math.min(tampak.length - 1, j));
    if (j !== dari) pilih(tampak[j]!, { fokus: true });
  }

  function tombolAbjad(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const tombol = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const i = tombol.indexOf(e.target as HTMLButtonElement);
    tombol[Math.max(0, Math.min(tombol.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
  }

  /* Kartu di meja menyusul tetikus — terangkat ke arah kursor, tetikus saja
     (jebakan #9); kotaknya dibaca sekali saat masuk. */
  const kotakMiring = useRef<DOMRect | null>(null);
  function masukMiring(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || !geraknya()) return;
    kotakMiring.current = e.currentTarget.getBoundingClientRect();
  }
  function gerakMiring(e: PointerEvent<HTMLDivElement>) {
    const r = kotakMiring.current;
    const el = miringRef.current;
    if (!r || !el || e.pointerType !== "mouse") return;
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--brk-gx", `${(x * 6).toFixed(2)}px`);
    el.style.setProperty("--brk-gy", `${(y * 4 - 3).toFixed(2)}px`);
  }
  function keluarMiring() {
    kotakMiring.current = null;
    miringRef.current?.style.removeProperty("--brk-gx");
    miringRef.current?.style.removeProperty("--brk-gy");
  }

  function balikKartu(ke: boolean) {
    setBalik(ke);
    if (ke) window.setTimeout(() => catatanRef.current?.focus({ preventScroll: true }), geraknya() ? 320 : 0);
  }

  /* ---- Menulis ---------------------------------------------------------------- */
  async function ubahCatatan(k: KontakDirektori, note: string) {
    if (note === (k.note ?? "")) return;
    setPilihId(k.id);
    const lama = k;
    const kini2 = { ...k, note, updatedAt: new Date().toISOString() };
    setKontak((l) => l?.map((x) => (x.id === k.id ? kini2 : x)) ?? l);
    try {
      await ubahKontak(k.id, { note });
      toast({ judul: "Catatan disimpan", keterangan: `Di balik kartu ${nomor.get(k.id)} · ${k.name}`, nada: "sukses" });
    } catch (e) {
      setKontak((l) => l?.map((x) => (x.id === k.id ? lama : x)) ?? l);
      toast({ judul: "Gagal menyimpan catatan", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  async function simpanKartu(isi: Bentuk, awal: KontakDirektori | null) {
    const bersih = {
      name: isi.name.trim(),
      category: isi.category,
      company: isi.company.trim() || null,
      phone: isi.phone.trim() || null,
      email: isi.email.trim() || null,
    };
    if (awal) {
      setPilihId(awal.id);
      const patch: Partial<KontakDirektori> = {};
      (Object.keys(bersih) as (keyof typeof bersih)[]).forEach((kunci) => {
        if ((bersih[kunci] ?? null) !== (awal[kunci] ?? null)) (patch as Record<string, unknown>)[kunci] = bersih[kunci];
      });
      await ubahKontak(awal.id, patch);
      setKontak((l) => l?.map((x) => (x.id === awal.id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x)) ?? l);
      toast({ judul: "Kartu diubah", keterangan: `${nomor.get(awal.id)} · ${bersih.name}`, nada: "sukses" });
      muat();
      return;
    }
    const { id } = await tambahKontak(bersih);
    const sekarang = new Date().toISOString();
    setKontak((l) => [...(l ?? []), { id, ...bersih, note: null, createdAt: sekarang, updatedAt: sekarang }]);
    setCari("");
    if (kat !== "semua" && kat !== bersih.category) setKat(bersih.category);
    lompatKe.current = id;
    if (geraknya()) setBaruId(id);
    toast({ judul: "Kartu diselipkan", keterangan: `RK-${String(semua.length + 1).padStart(2, "0")} · ${bersih.name}`, nada: "sukses" });
    muat();
  }

  async function hapus(k: KontakDirektori, pemicu: HTMLElement | null) {
    const ya = await tanya({
      judul: `Hapus kartu ${k.name}?`,
      isi: "Kartu ini beserta catatan di baliknya dikeluarkan dari buku rekanan.",
      ya: "Hapus kartu",
      bahaya: true,
    });
    if (!ya) return;
    const i = tampak.indexOf(k);
    const ganti = tampak[i + 1] ?? tampak[i - 1] ?? null;
    try {
      await hapusKontak(k.id);
      setKontak((l) => l?.filter((x) => x.id !== k.id) ?? l);
      setBalik(false);
      setPilihId(ganti?.id ?? null);
      history.replaceState(null, "", ganti ? `?id=${encodeURIComponent(ganti.id)}` : location.pathname);
      if (ganti) setHal(Math.floor(tampak.filter((x) => x.id !== k.id).indexOf(ganti) / PER_HAL));
      toast({ judul: "Kartu dihapus", keterangan: k.name, nada: "sukses" });
      /* Dialog konfirmasi baru dilepas sesudah animasi tutupnya, dan fokus
         balikannya sempat jatuh ke <body> (jebakan #39) — tunggu dialognya
         lenyap, lalu kembalikan ke tombol Hapus kartu berikutnya, atau ke
         "Kartu baru" kalau map sudah kosong. */
      for (let i = 0; i < 60 && document.querySelector("[role=alertdialog]"); i++)
        await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
      if (document.activeElement === document.body || !document.activeElement)
        (pemicu?.isConnected ? pemicu : tambahRef.current)?.focus();
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  if (galat && kontak === null) return <GagalMuat apa="Buku rekanan" galat={galat} />;
  if (kontak === null) return <Rangka />;

  const nomorBaru = `RK-${String(semua.length + 1).padStart(2, "0")}`;
  const awalHal = halKini * PER_HAL;
  const kosongPertama = isiHal.length;
  const tabFokus = kiniDiHal ? kini!.id : isiHal[0]?.id;
  const kat0 = kini ? katDari(kini.category) : "klien";
  const wa = nomorWa(kini?.phone);
  const waNo = waSeluler(kini?.phone);
  const tahap = (v?: string) => TAHAP.find((t) => t.value === v)?.label ?? "Proposal";
  /* Tepi lembar di kanan bawah = lembar yang masih tersisa sesudah halaman ini. */
  const tumpuk = Math.min(4, nHal - 1 - halKini);
  const total = Math.max(1, semua.length);
  const sel: { kunci: Sorot; label: string; n: number; ket?: string }[] = [
    { kunci: "wa", label: "Siap WhatsApp", n: statistik.wa },
    { kunci: "proyek", label: "Terlibat proyek", n: statistik.terlibat, ket: `${statistik.proyekUnik} proyek` },
    { kunci: "catatan", label: "Bercatatan", n: statistik.catatan },
  ];
  const domain = kini?.email?.split("@")[1];

  return (
    <div className="brk">
      <div className="brk__papan">
        {/* ---- Kop ---- */}
        <header className="brk__kop">
          <div className="brk__kopjudul">
            <p>
              Map kartu nama · {semua.length} kartu · {Math.max(1, Math.ceil(semua.length / PER_HAL))} hal.
            </p>
            <h2>Buku rekanan</h2>
          </div>
          <dl className="brk__kopsel" aria-label="Kelengkapan buku rekanan" onPointerLeave={() => setSorot(null)}>
            {sel.map((c) => (
              <div
                key={c.kunci}
                className={`brk__sel${sorot === c.kunci ? " is-sorot" : ""}`}
                style={{ "--brk-isi": `${(c.n / total) * 100}%` } as CSSProperties}
                onPointerEnter={(e) => e.pointerType === "mouse" && setSorot(c.kunci)}
              >
                <dt>{c.label}</dt>
                <dd>
                  <Hitung className="brk__selangka" nilai={c.n} hidup format={(v) => String(Math.round(v))} />
                  <span className="brk__seldari">/ {semua.length}</span>
                  {c.ket && <span className="brk__selket">{c.ket}</span>}
                </dd>
              </div>
            ))}
          </dl>
          <div className="brk__alat">
            <Cari
              className="brk__cari"
              ukuran="medium"
              judul="Cari kartu"
              placeholder="Cari kartu"
              value={cari}
              onChange={(e) => {
                setCari(e.currentTarget.value);
                setHal(0);
              }}
            />
            <div className="brk__urut" role="radiogroup" aria-label="Urutan kartu">
              {(
                [
                  ["az", "A–Z"],
                  ["baru", "Terbaru"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={urut === v}
                  tabIndex={urut === v ? 0 : -1}
                  className={urut === v ? "is-pilih" : ""}
                  onClick={() => {
                    setUrut(v);
                    setHal(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                    e.preventDefault();
                    const lain = v === "az" ? "baru" : "az";
                    setUrut(lain);
                    setHal(0);
                    (e.currentTarget.parentElement?.querySelector(`[data-urut="${lain}"]`) as HTMLElement | null)?.focus();
                  }}
                  data-urut={v}
                >
                  {l}
                </button>
              ))}
            </div>
            <button ref={tambahRef} type="button" className="brk__tambah" onClick={() => setDialog({ mode: "baru" })}>
              <Ikon ikon={Plus} ukuran={16} />
              Kartu baru
            </button>
          </div>
        </header>

        {/* ---- Map ---- */}
        <section className="brk__map" aria-label="Map kartu nama">
          <div className="brk__pembatas" role="tablist" aria-label="Lembar pembatas kategori" onKeyDown={tombolTab}>
            {PEMBATAS.map((v) => (
              <button
                key={v}
                id={`brk-tab-${v}`}
                type="button"
                role="tab"
                aria-selected={kat === v}
                aria-controls="brk-lembar"
                tabIndex={kat === v ? 0 : -1}
                className={`brk__tab is-${v}${kat === v ? " is-pilih" : ""}`}
                onClick={() => gantiKat(v)}
              >
                <span>{v === "semua" ? "Semua" : KATEGORI[v]}</span>
                <b>{perKat.get(v) ?? 0}</b>
              </button>
            ))}
          </div>
          <div className="brk__sampul">
            {/* Punggung logam: pelat berpaku keling dan tiga cincin yang masuk ke
                lubang pons di margin kiri lembar — di luar daerah tulisan. */}
            <span className="brk__mekanik" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <div
              ref={lembarRef}
              className={`brk__lembar is-div-${kat}`}
              id="brk-lembar"
              role="tabpanel"
              aria-labelledby={`brk-tab-${kat}`}
              data-tumpuk={tumpuk > 0 ? tumpuk : undefined}
            >
              <ul
                ref={kantongRef}
                className={`brk__kantong${sorot ? " is-menyorot" : ""}`}
                aria-label={`Halaman ${halKini + 1} dari ${nHal}`}
                onKeyDown={tombolMap}
              >
                {Array.from({ length: PER_HAL }, (_, j) => {
                  const k = isiHal[j];
                  if (!k) {
                    const pertama = j === kosongPertama;
                    return (
                      <li key={`kosong-${j}`} className="brk__ruang">
                        <span className="brk__saku is-kosong">
                          <span className="brk__kartu is-kosong">
                            {pertama && tampak.length === 0 && q ? (
                              <span className="brk__tidakada">
                                Tidak ada kartu yang cocok dengan “{cari.trim()}”
                              </span>
                            ) : pertama && halKini === nHal - 1 ? (
                              <button type="button" className="brk__selip" onClick={() => setDialog({ mode: "baru" })}>
                                <Ikon ikon={Plus} ukuran={14} />
                                Selipkan kartu
                              </button>
                            ) : null}
                          </span>
                        </span>
                      </li>
                    );
                  }
                  const diMeja = kini?.id === k.id;
                  const no = nomor.get(k.id) ?? "RK";
                  return (
                    <li
                      key={k.id}
                      className={`brk__ruang${sorot && cocokSorot(k, sorot) ? " is-sorot" : ""}`}
                      data-saku={k.id}
                    >
                      <span className="brk__saku">
                        <button
                          type="button"
                          className={`brk__kartu ${kelasKartu(k)}${diMeja ? " is-meja" : ""}${baruId === k.id ? " is-baru" : ""}`}
                          tabIndex={k.id === tabFokus ? 0 : -1}
                          aria-pressed={diMeja}
                          aria-label={diMeja ? `${no}, ${k.name}, sedang di meja` : labelKartu(k, no)}
                          onClick={() => pilih(k)}
                        >
                          {diMeja ? (
                            <span className="brk__dimeja" aria-hidden="true">
                              <b>{no}</b>
                              <span>Di meja</span>
                            </span>
                          ) : (
                            <KartuNama k={k} nomor={no} cari={cari} proyekN={jejak.get(k.id)?.length ?? 0} />
                          )}
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <nav className="brk__abjad" aria-label="Indeks abjad" onKeyDown={tombolAbjad}>
                {ABJAD.map((h) => {
                  const i = huruf.get(h);
                  return (
                    <button
                      key={h}
                      type="button"
                      disabled={i === undefined}
                      tabIndex={h === hurufTab ? 0 : -1}
                      className={hurufHal.has(h) ? "is-hal" : ""}
                      aria-label={`Kartu berawalan ${h}`}
                      onClick={() => i !== undefined && pilih(tampak[i]!)}
                    >
                      {h}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
          <div className="brk__kaki">
            <button type="button" className="brk__balikhal" aria-label="Halaman sebelumnya" disabled={halKini === 0} onClick={() => keHal(halKini - 1)}>
              <Ikon ikon={CaretLeft} ukuran={14} />
            </button>
            <span className="brk__hal">
              Hal. <b>{halKini + 1}</b> dari {nHal}
            </span>
            <button
              type="button"
              className="brk__balikhal"
              aria-label="Halaman berikutnya"
              disabled={halKini >= nHal - 1}
              onClick={() => keHal(halKini + 1)}
            >
              <Ikon ikon={CaretRight} ukuran={14} />
            </button>
            {nHal > 1 && nHal <= 12 && (
              <span className="brk__tepi">
                {Array.from({ length: nHal }, (_, n) => (
                  <button
                    key={n}
                    type="button"
                    className={n === halKini ? "is-kini" : ""}
                    aria-label={`Halaman ${n + 1}`}
                    aria-current={n === halKini ? "page" : undefined}
                    onClick={() => keHal(n)}
                  />
                ))}
              </span>
            )}
            <span className="brk__jumlah">
              {tampak.length === 0
                ? "Tidak ada kartu"
                : `Kartu ${awalHal + 1}–${awalHal + isiHal.length} dari ${tampak.length}`}
            </span>
          </div>
        </section>

        {/* ---- Meja ---- */}
        <aside className="brk__meja" aria-label="Kartu di meja">
          {kini ? (
            <>
              <p className="brk__mejajudul">
                <span>Di meja</span>
                <b>{nomor.get(kini.id)}</b>
                {posisi >= 0 && <span>kartu {posisi + 1} dari {tampak.length}</span>}
              </p>
              {/* Alas potong hijau berskala milimeter — kartunya tergambar 85 × 55 mm,
                  lengkap dengan penggaris dan garis ukurnya di margin alas. */}
              <div className="brk__alas">
              <span className="brk__mat" aria-hidden="true" />
              <span className="brk__penggaris brk__penggaris--x" aria-hidden="true">
                {Array.from({ length: 9 }, (_, i) => (
                  <i key={i} style={{ "--i": i } as CSSProperties}>
                    {i}
                  </i>
                ))}
              </span>
              <span className="brk__penggaris brk__penggaris--y" aria-hidden="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <i key={i} style={{ "--i": i } as CSSProperties}>
                    {i}
                  </i>
                ))}
              </span>
              <div
                ref={besarRef}
                className="brk__besar"
                onPointerEnter={masukMiring}
                onPointerMove={gerakMiring}
                onPointerLeave={keluarMiring}
              >
                <div ref={miringRef} className="brk__miring">
                  <div className={`brk__putar${balik ? " is-balik" : ""}`}>
                    <button
                      type="button"
                      className={`brk__muka brk__muka--depan brk__kartu brk__kartu--besar ${kelasKartu(kini)}`}
                      inert={balik}
                      aria-label={`${labelKartu(kini, nomor.get(kini.id) ?? "")}. Balik kartu untuk catatan`}
                      onClick={() => balikKartu(true)}
                    >
                      <KartuNama
                        k={kini}
                        nomor={nomor.get(kini.id) ?? ""}
                        besar
                        diselipkan={kini.createdAt}
                        proyekN={relasi.length}
                      />
                    </button>
                    <div className="brk__muka brk__muka--belakang" inert={!balik}>
                      <p className="brk__bjudul">
                        <span>Catatan di balik kartu</span>
                        <b>{nomor.get(kini.id)}</b>
                      </p>
                      <textarea
                        ref={catatanRef}
                        key={`${kini.id}:${kini.note ?? ""}`}
                        className="brk__catatan"
                        defaultValue={kini.note ?? ""}
                        placeholder="Tulis catatan tentang rekanan ini…"
                        aria-label={`Catatan di balik kartu ${kini.name}`}
                        onBlur={(e) => ubahCatatan(kini, e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.preventDefault();
                            e.currentTarget.blur();
                            balikKartu(false);
                          }
                        }}
                      />
                      <p className="brk__bkaki">
                        <span>Disimpan saat ditinggalkan · diubah {umur(kini.updatedAt)}</span>
                        <button type="button" onClick={() => balikKartu(false)}>
                          <Ikon ikon={ArrowClockwise} ukuran={12} />
                          Muka depan
                        </button>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <span className="brk__ukur brk__ukur--x" aria-hidden="true">
                <b>85 mm</b>
              </span>
              <span className="brk__ukur brk__ukur--y" aria-hidden="true">
                <b>55 mm</b>
              </span>
              </div>

              <div className="brk__hubungi">
                {kini.phone ? (
                  <a className="brk__tuts" href={`tel:${kini.phone.replace(/[^\d+]/g, "")}`}>
                    <Ikon ikon={Phone} ukuran={15} />
                    <span>
                      <b>Telepon</b>
                      <small>{kini.phone}</small>
                    </span>
                  </a>
                ) : (
                  <span className="brk__tuts is-mati" role="link" aria-disabled="true" tabIndex={0} title="Nomor telepon belum diisi">
                    <Ikon ikon={Phone} ukuran={15} />
                    <span>
                      <b>Telepon</b>
                      <small>belum diisi</small>
                    </span>
                  </span>
                )}
                {waNo ? (
                  <a className="brk__tuts" href={`https://wa.me/${waNo}`} target="_blank" rel="noreferrer">
                    <Ikon ikon={ChatTeardropDots} ukuran={15} />
                    <span>
                      <b>WhatsApp</b>
                      <small>nomor seluler</small>
                    </span>
                  </a>
                ) : (
                  <span
                    className="brk__tuts is-mati"
                    role="link"
                    aria-disabled="true"
                    tabIndex={0}
                    title={wa ? "Nomor kantor — bukan nomor WhatsApp" : "Nomor telepon belum diisi"}
                  >
                    <Ikon ikon={ChatTeardropDots} ukuran={15} />
                    <span>
                      <b>WhatsApp</b>
                      <small>{wa ? "nomor kantor" : "belum diisi"}</small>
                    </span>
                  </span>
                )}
                {kini.email ? (
                  <a className="brk__tuts" href={`mailto:${kini.email}`}>
                    <Ikon ikon={NavEnvelope} ukuran={15} />
                    <span>
                      <b>Email</b>
                      <small>{domain ? `@${domain}` : kini.email}</small>
                    </span>
                  </a>
                ) : (
                  <span className="brk__tuts is-mati" role="link" aria-disabled="true" tabIndex={0} title="Email belum diisi">
                    <Ikon ikon={NavEnvelope} ukuran={15} />
                    <span>
                      <b>Email</b>
                      <small>belum diisi</small>
                    </span>
                  </span>
                )}
              </div>

              {/* Bingkai cetak milik kertasnya; yang menggulir isinya, di DALAM
                  bingkai — tulisan tidak pernah lewat di bawah garis bingkai. */}
              <section className="brk__slip" aria-label="Rekanan ini di studio">
                <div className="brk__slipisi">
                <h3>
                  <span>Proyek bersama studio</span>
                  <b>{relasi.length}</b>
                </h3>
                {relasi.length ? (
                  <ul className="brk__proyek">
                    {relasi.map(({ p, peran }) => {
                      const ke = TAHAP.findIndex((t) => t.value === (p.pipelineStage ?? "proposal"));
                      return (
                        <li key={p.id}>
                          <a href={`/admin/proyek/satu?id=${encodeURIComponent(p.id)}`}>
                            <span className="brk__pfoto" aria-hidden="true">
                              {p.coverImageUrl ? <img src={p.coverImageUrl} alt="" loading="lazy" /> : <b>{kodeProyek(p.title)}</b>}
                            </span>
                            <span className="brk__pjudul">{p.title}</span>
                            <small className="brk__pket">
                              {peran === "klien" ? "klien" : "kontraktor"} · {tahap(p.pipelineStage)}
                            </small>
                            <span className="brk__ptangga" aria-hidden="true">
                              {TAHAP.map((t, i) => (
                                <i key={t.value} className={i <= ke ? "is-lewat" : ""} />
                              ))}
                            </span>
                            {peran === "klien" && p.contractValue ? (
                              <span className="brk__pnilai" title={formatRupiah(p.contractValue)}>
                                {formatRupiahRingkas(p.contractValue)}
                              </span>
                            ) : null}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="brk__slipkosong">
                    {kat0 === "klien"
                      ? "Belum ada proyek atas nama ini."
                      : kat0 === "kontraktor"
                        ? "Belum tercatat sebagai kontraktor proyek mana pun."
                        : "Data proyek tidak mencatat supplier dan rekanan lain."}
                  </p>
                )}
                {nilaiBersama > 0 && (
                  <p className="brk__pjumlah">
                    <span>Kontrak bersama</span>
                    <b>{formatRupiah(nilaiBersama)}</b>
                  </p>
                )}
                <h3>
                  <span>Di balik kartu</span>
                  <b>{kini.note ? `${kini.note.trim().split(/\s+/).length} kata` : "kosong"}</b>
                </h3>
                <button type="button" className="brk__intip" onClick={() => balikKartu(true)}>
                  {kini.note ? <q>{kini.note}</q> : <span>Belum ada catatan. Balik kartu untuk menulis.</span>}
                </button>
                <h3>
                  <span>Seperusahaan</span>
                  <b>{seperusahaan.length ? seperusahaan.length : kini.company ? "satu-satunya" : "perorangan"}</b>
                </h3>
                {seperusahaan.length ? (
                  <ul className="brk__rekan">
                    {seperusahaan.map((k) => (
                      <li key={k.id}>
                        <button type="button" onClick={() => pilih(k)} disabled={!tampak.includes(k)}>
                          <span aria-hidden="true">{monogram(k.name)}</span>
                          {k.name}
                          <small>{nomor.get(k.id)}</small>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                </div>
              </section>

              <div className="brk__aksi">
                <button type="button" onClick={() => balikKartu(!balik)} aria-pressed={balik}>
                  <Ikon ikon={ArrowClockwise} ukuran={14} />
                  {balik ? "Muka depan" : "Balik kartu"}
                </button>
                <button type="button" onClick={() => setDialog({ mode: "ubah", k: kini })}>
                  <Ikon ikon={NotePencil} ukuran={14} />
                  Ubah
                </button>
                <button type="button" className="is-bahaya" onClick={(e) => hapus(kini, e.currentTarget)}>
                  <Ikon ikon={Trash} ukuran={14} />
                  Hapus
                </button>
              </div>
            </>
          ) : (
            <div className="brk__mejakosong">
              <p>Meja masih kosong.</p>
              <small>{semua.length ? "Pilih kartu dari map." : "Belum ada kartu di buku rekanan."}</small>
            </div>
          )}
        </aside>
      </div>
      <div ref={lapisRef} className="brk__lapis" aria-hidden="true" />
      <DialogKartu
        buka={dialog !== null}
        awal={dialog?.mode === "ubah" ? dialog.k : null}
        nomor={dialog?.mode === "ubah" ? (nomor.get(dialog.k.id) ?? "") : nomorBaru}
        onTutup={() => setDialog(null)}
        onSimpan={simpanKartu}
      />
    </div>
  );
}

/** Huruf indeks — sama dengan urutan A–Z (nama apa adanya). */
function monogramHuruf(nama: string) {
  const h = nama.trim()[0]?.toUpperCase() ?? "";
  return /[A-Z]/.test(h) ? h : "";
}

interface Bentuk {
  name: string;
  category: string;
  company: string;
  phone: string;
  email: string;
}
const KOSONG: Bentuk = { name: "", category: "klien", company: "", phone: "", email: "" };

function DialogKartu({
  buka,
  awal,
  nomor,
  onTutup,
  onSimpan,
}: {
  buka: boolean;
  awal: KontakDirektori | null;
  nomor: string;
  onTutup: () => void;
  onSimpan: (isi: Bentuk, awal: KontakDirektori | null) => Promise<void>;
}) {
  const toast = useToast();
  const [f, setF] = useState<Bentuk>(KOSONG);
  const [kirim, setKirim] = useState(false);
  useEffect(() => {
    if (!buka) return;
    setF(
      awal
        ? {
            name: awal.name,
            category: katDari(awal.category),
            company: awal.company ?? "",
            phone: awal.phone ?? "",
            email: awal.email ?? "",
          }
        : KOSONG,
    );
  }, [buka, awal?.id]);

  const berubah =
    !awal ||
    f.name.trim() !== awal.name ||
    f.category !== katDari(awal.category) ||
    (f.company.trim() || null) !== (awal.company ?? null) ||
    (f.phone.trim() || null) !== (awal.phone ?? null) ||
    (f.email.trim() || null) !== (awal.email ?? null);
  const alasan = f.name.trim().length < 2 ? "Isi nama dulu, minimal 2 huruf." : !berubah ? "Belum ada yang diubah." : null;
  const ubah = (kunci: keyof Bentuk) => (e: { currentTarget: { value: string } }) => {
    const v = e.currentTarget.value;
    setF((l) => ({ ...l, [kunci]: v }));
  };

  async function simpan() {
    if (alasan) return;
    setKirim(true);
    try {
      await onSimpan(f, awal);
      onTutup();
    } catch (e) {
      toast({ judul: awal ? "Gagal mengubah kartu" : "Gagal menyelipkan kartu", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setKirim(false);
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={(b) => !b && onTutup()}
      title={awal ? `Ubah kartu ${nomor}` : "Kartu baru"}
      footer={
        <div className="kd-form__kaki">
          {alasan && <small className="kd-form__alasan">{alasan}</small>}
          <Tombol memuat={kirim} ukuran="large" jenis="primary" disabled={Boolean(alasan) || kirim} onClick={simpan}>
            {kirim ? "Menyimpan…" : awal ? "Simpan kartu" : "Selipkan ke map"}
          </Tombol>
        </div>
      }
    >
      <div className="kd-form">
        {/* Pratinjau: kartunya persis seperti nanti di saku map. */}
        <div className="brk brk--pratinjau" aria-hidden="true">
          <span className={`brk__kartu ${kelasKartu(f)}`}>
            <KartuNama k={{ ...f, note: awal?.note ?? null }} nomor={nomor} />
          </span>
          <small className="brk__pratinjauket">Desain kartu mengikuti nama perusahaan</small>
        </div>
        <div className="kd-form__dua">
          <Isian label="Nama" placeholder="mis. Bu Ratna Sari" value={f.name} onChange={ubah("name")} />
          <div className="k-isian">
            <label className="k-isian__label" htmlFor="brk-kategori">
              Kategori
            </label>
            <PilihMenu
              id="brk-kategori"
              nilai={f.category}
              onUbah={(v) => setF((l) => ({ ...l, category: v }))}
              opsi={URUT_KAT.map((v) => ({ nilai: v, label: KATEGORI[v]! }))}
            />
          </div>
        </div>
        <Isian label="Perusahaan" placeholder="Opsional" value={f.company} onChange={ubah("company")} />
        <div className="kd-form__dua">
          <Isian label="Telepon" type="tel" inputMode="tel" placeholder="Opsional" value={f.phone} onChange={ubah("phone")} />
          <Isian label="Email" type="email" placeholder="Opsional" value={f.email} onChange={ubah("email")} />
        </div>
      </div>
    </Dialog>
  );
}

/* Kerangka memuat berbentuk papan dan setinggi papan aslinya. */
function Rangka() {
  return (
    <div className="brk" aria-busy="true">
      <div className="brk__papan">
        <div className="brk__kop brk__kop--rangka" />
        <div className="brk__map">
          <div className="brk__pembatas" />
          <div className="brk__sampul">
            <div className="brk__lembar brk__lembar--rangka" />
          </div>
          <div className="brk__kaki" />
        </div>
        <div className="brk__meja">
          <div className="brk__alas">
            <div className="brk__besar brk__besar--rangka" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DirektoriKit() {
  return (
    <RequireAuth skeleton={<Rangka />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
