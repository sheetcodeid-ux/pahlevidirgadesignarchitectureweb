import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as PE } from "react";
import { RequireAuth } from "./RequireAuth";
import { GagalMuat } from "./gagalMuat";
import { ToastProvider, useToast } from "../kit/Toast";
import { Cari, Sakelar } from "../kit/Isian";
import { Ikon } from "../kit/Ikon";
import { SorotTeks } from "../kit/Tampilan";
import { CaretLeft, CaretRight, Trash } from "../kit/ikon";
import { Icon } from "../ui/Icon";
import { geraknya } from "./hitung";
import { tanya } from "../../lib/tanya";
import {
  daftarTestimoni,
  ubahTestimoni,
  hapusTestimoni,
  bacaCache,
  tulisCache,
  type TestimoniAdmin,
} from "../../lib/admin";

/* =============================================================================
   Testimoni = BUKU TAMU + PAPAN PAMERAN.

   Klien menulis kesannya lewat portal proyeknya — di studio itu sama dengan
   mengisi BUKU TAMU di meja depan. Studio membacanya, MENCAP tiap entri
   (disetujui / ditolak / menunggu), lalu memilih mana yang DIPAJANG. Yang
   dipajang adalah seksi "Dari klien" di beranda.

   1. KOP — jumlah entri dan yang menunggu cap, pita saring per status, cari.
   2. BUKU TAMU — dua halaman terbuka, tiga entri per halaman, urut waktu
      ditulis (seperti buku tamu sungguhan). Nomor BT-NN = urutan masuk di
      antara SEMUA entri. Tiap entri: tanggal, nama, proyek, bintang, kutipan,
      dan CAP statusnya di kolom sendiri di tepi kanan.
   3. RAK CAP — tiga cap karet untuk entri yang dipilih (status sebagai
      radiogroup), sakelar "Pajang di beranda", hapus.
   4. PAPAN PAMERAN — tiruan seksi "Dari klien" beranda dengan aturan yang
      SAMA dengan situsnya (`listPublic`: disetujui + dipajang, urut
      terakhir diubah, tiga teratas — index.astro `slice(0, 3)`). Yang
      dipajang tapi tidak muat atau belum disetujui disebut terbuka.

   Gerak — hanya karena perbuatan, seketika bila gerak dikurangi: entri
   yang dicap mendapat cap yang DIBUBUHKAN; entri yang dipajang TERBANG dari
   buku ke slotnya sementara slot lain bergeser; halaman buku bergeser saat
   dibalik. Disentuh tetikus, entri dan slotnya di papan saling menyala.
   ============================================================================= */

const STATUS: { nilai: string; label: string; cap: string }[] = [
  { nilai: "disetujui", label: "Disetujui", cap: "Disetujui" },
  { nilai: "menunggu", label: "Menunggu", cap: "Menunggu" },
  { nilai: "ditolak", label: "Ditolak", cap: "Ditolak" },
];
const LABEL = Object.fromEntries(STATUS.map((s) => [s.nilai, s.label])) as Record<string, string>;
const PER_HAL = 3;
const SLOT = 3;
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const LEMBUT = "cubic-bezier(0.22, 0.7, 0.2, 1)";
const tgl = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
};

function Bintang({ nilai, ukuran = 12 }: { nilai?: number | null; ukuran?: number }) {
  if (!nilai) return <span className="btm__tanpabintang">tanpa bintang</span>;
  return (
    <span className="btm__bintang" role="img" aria-label={`${nilai} dari 5 bintang`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} data-isi={i < nilai || undefined}>
          <Icon name="star" size={ukuran} variant={i < nilai ? "filled" : "stroke"} />
        </span>
      ))}
    </span>
  );
}

/** Aturan beranda — sama dengan listPublic + index.astro. */
function pameran(semua: readonly TestimoniAdmin[]) {
  const tampil = semua
    .filter((t) => t.status === "disetujui" && t.isFeatured)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  return {
    slot: tampil.slice(0, SLOT),
    lebih: tampil.slice(SLOT),
    belumSetuju: semua.filter((t) => t.isFeatured && t.status !== "disetujui"),
  };
}

function Isi() {
  const toast = useToast();
  const [data, setData] = useState<TestimoniAdmin[] | null>(() => bacaCache<TestimoniAdmin[]>("testimoni"));
  const [galat, setGalat] = useState<string | null>(null);
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState("semua");
  const [spread, setSpread] = useState<number | null>(null);
  const [pilihId, setPilihId] = useState<string | null>(() =>
    typeof location === "undefined" ? null : new URLSearchParams(location.search).get("id"),
  );
  const [sorot, setSorot] = useState<string | null>(null);
  const [tercap, setTercap] = useState<string | null>(null);
  const halRef = useRef<HTMLDivElement>(null);
  const lapisRef = useRef<HTMLDivElement>(null);
  const geser = useRef(0);
  const fokusKe = useRef<string | null>(null);
  const posisi = useRef<{ slot: Map<string, DOMRect>; entri: Map<string, DOMRect> } | null>(null);
  const hapusRef = useRef<HTMLButtonElement>(null);

  function muat() {
    daftarTestimoni()
      .then((d) => {
        tulisCache("testimoni", d);
        setData(d);
        setGalat(null);
      })
      .catch((e) => setGalat((e as Error).message));
  }
  useEffect(muat, []);
  useEffect(() => {
    if (!tercap) return;
    const w = window.setTimeout(() => setTercap(null), 700);
    return () => window.clearTimeout(w);
  }, [tercap]);

  const semua = data ?? [];
  const urutBuku = useMemo(
    () => semua.slice().sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id.localeCompare(b.id))),
    [data],
  );
  const nomor = useMemo(() => new Map(urutBuku.map((t, i) => [t.id, `BT-${String(i + 1).padStart(2, "0")}`])), [urutBuku]);
  const q = cari.trim().toLowerCase();
  const hitung = (s: string) => semua.filter((t) => s === "semua" || t.status === s).length;
  const tampak = urutBuku.filter(
    (t) =>
      (saring === "semua" || t.status === saring) &&
      (!q || [t.clientName, t.projectTitle, t.quote, nomor.get(t.id)].some((v) => (v ?? "").toLowerCase().includes(q))),
  );
  const perSpread = PER_HAL * 2;
  const nSpread = Math.max(1, Math.ceil(tampak.length / perSpread));
  /* Yang dibuka bawaan: entri tertua yang masih menunggu cap — antrean
     dikerjakan dari yang paling lama — lalu entri terbaru. */
  const bawaan = tampak.find((t) => t.status === "menunggu") ?? tampak[tampak.length - 1] ?? null;
  const kini = tampak.find((t) => t.id === pilihId) ?? bawaan;
  const iKini = kini ? tampak.indexOf(kini) : -1;
  const spreadKini = Math.min(spread ?? (iKini >= 0 ? Math.floor(iKini / perSpread) : nSpread - 1), nSpread - 1);
  const isiSpread = tampak.slice(spreadKini * perSpread, spreadKini * perSpread + perSpread);
  const papan = useMemo(() => pameran(semua), [data]);
  const slotSorot = sorot && papan.slot.some((t) => t.id === sorot) ? sorot : null;

  /* ---- Gerak: slot bergeser, entri terbang ke papan -------------------- */
  function rekam() {
    if (!geraknya()) return;
    const slot = new Map<string, DOMRect>();
    const entri = new Map<string, DOMRect>();
    document.querySelectorAll<HTMLElement>("[data-slot]").forEach((el) => slot.set(el.dataset.slot!, el.getBoundingClientRect()));
    document.querySelectorAll<HTMLElement>("[data-entri]").forEach((el) => entri.set(el.dataset.entri!, el.getBoundingClientRect()));
    /* Slot yang akan lenyap disalin dulu — sesudah render ia sudah tidak ada. */
    const lapis = lapisRef.current;
    if (lapis) {
      lapis.replaceChildren();
      document.querySelectorAll<HTMLElement>("[data-slot]").forEach((el) => {
        const r = el.getBoundingClientRect();
        const s = el.cloneNode(true) as HTMLElement;
        s.removeAttribute("data-slot");
        s.dataset.bekas = el.dataset.slot!;
        s.setAttribute("inert", "");
        s.classList.add("btm__salinan");
        Object.assign(s.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, visibility: "hidden" });
        lapis.appendChild(s);
      });
    }
    posisi.current = { slot, entri };
  }
  useLayoutEffect(() => {
    const p = posisi.current;
    if (!p) return;
    posisi.current = null;
    const kini2 = new Set<string>();
    document.querySelectorAll<HTMLElement>("[data-slot]").forEach((el) => {
      const id = el.dataset.slot!;
      kini2.add(id);
      const b = el.getBoundingClientRect();
      const a = p.slot.get(id) ?? p.entri.get(id);
      if (!a) return;
      if (Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1) return;
      const dariBuku = !p.slot.has(id);
      el.animate(
        [
          {
            transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`,
            transformOrigin: "0 0",
            opacity: dariBuku ? 0.4 : 1,
          },
          { transform: "none", transformOrigin: "0 0", opacity: 1 },
        ],
        { duration: dariBuku ? 640 : 480, easing: LEMBUT },
      );
    });
    /* Slot yang dilepas: salinannya jatuh dari papan dan memudar. */
    lapisRef.current?.querySelectorAll<HTMLElement>("[data-bekas]").forEach((s) => {
      if (kini2.has(s.dataset.bekas!)) {
        s.remove();
        return;
      }
      s.style.visibility = "";
      const a = s.animate(
        [
          { transform: "none", opacity: 1 },
          { transform: "translateY(26px) rotate(-3deg)", opacity: 0 },
        ],
        { duration: 420, easing: LEMBUT, fill: "forwards" },
      );
      a.onfinish = a.oncancel = () => s.remove();
    });
  }, [data]);

  function keSpread(n: number) {
    const tuju = Math.max(0, Math.min(nSpread - 1, n));
    if (tuju === spreadKini) return;
    if (geraknya()) geser.current = tuju > spreadKini ? 1 : -1;
    setSpread(tuju);
  }
  useLayoutEffect(() => {
    const g = geser.current;
    geser.current = 0;
    if (!g) return;
    halRef.current?.animate(
      [
        { transform: `translateX(${g * 30}px)`, opacity: 0.2 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 340, easing: LEMBUT },
    );
  }, [spreadKini]);

  function pilih(t: TestimoniAdmin, fokus = false) {
    const i = tampak.indexOf(t);
    if (i >= 0) {
      const s = Math.floor(i / perSpread);
      if (s !== spreadKini) keSpread(s);
    }
    if (fokus) fokusKe.current = t.id;
    setPilihId(t.id);
    history.replaceState(null, "", `?id=${encodeURIComponent(t.id)}`);
  }
  useLayoutEffect(() => {
    const id = fokusKe.current;
    if (!id) return;
    fokusKe.current = null;
    document.querySelector<HTMLElement>(`[data-entri="${CSS.escape(id)}"]`)?.focus();
  });

  function tombolBuku(e: KeyboardEvent<HTMLDivElement>) {
    const id = (e.target as HTMLElement).closest("[data-entri]")?.getAttribute("data-entri");
    const dari = tampak.findIndex((t) => t.id === id);
    if (dari < 0) return;
    const langkah: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, ArrowRight: PER_HAL, ArrowLeft: -PER_HAL, PageDown: perSpread, PageUp: -perSpread };
    let j: number;
    if (e.key in langkah) j = dari + langkah[e.key]!;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = tampak.length - 1;
    else return;
    e.preventDefault();
    j = Math.max(0, Math.min(tampak.length - 1, j));
    if (j !== dari) pilih(tampak[j]!, true);
  }

  /* ---- Menulis ------------------------------------------------------------- */
  async function ubah(t: TestimoniAdmin, patch: Partial<TestimoniAdmin>, gagal: string) {
    /* Kunci pilihan dan bentangnya ke entri ini SEBELUM datanya berubah:
       pilihan bawaan dihitung dari status, jadi mencap entri bawaan akan
       melompatkan buku ke entri lain (jebakan #88). */
    setPilihId(t.id);
    setSpread(spreadKini);
    rekam();
    const sekarang = new Date().toISOString();
    setData((l) => l?.map((x) => (x.id === t.id ? { ...x, ...patch, updatedAt: sekarang } : x)) ?? l);
    try {
      await ubahTestimoni(t.id, patch);
    } catch (e) {
      rekam();
      setData((l) => l?.map((x) => (x.id === t.id ? t : x)) ?? l);
      toast({ judul: gagal, keterangan: (e as Error).message, nada: "gagal" });
      return false;
    }
    return true;
  }

  async function cap(t: TestimoniAdmin, status: string) {
    if (t.status === status) return;
    if (geraknya()) setTercap(t.id);
    if (await ubah(t, { status }, "Gagal mengubah status"))
      toast({
        judul: `${nomor.get(t.id)} dicap ${LABEL[status]?.toLowerCase()}`,
        keterangan:
          status === "disetujui"
            ? t.isFeatured
              ? "Sudah dipajang — tampil di beranda sesudah Terbitkan."
              : "Pajang di beranda kalau ingin ditampilkan."
            : t.isFeatured && t.status === "disetujui"
              ? "Turun dari papan pameran beranda."
              : t.clientName,
        nada: "sukses",
      });
  }

  async function pajang(t: TestimoniAdmin, ya: boolean) {
    if (await ubah(t, { isFeatured: ya }, "Gagal mengubah pajangan beranda"))
      toast({
        judul: ya ? "Dipajang di beranda" : "Diturunkan dari beranda",
        keterangan: ya
          ? t.status === "disetujui"
            ? "Tampil paling kiri sesudah Terbitkan."
            : "Tampil sesudah disetujui dan Terbitkan."
          : t.clientName,
        nada: "sukses",
      });
  }

  async function hapus(t: TestimoniAdmin) {
    const ya = await tanya({
      judul: `Hapus entri ${nomor.get(t.id)}?`,
      isi: `Testimoni dari ${t.clientName} dihapus permanen dan tidak lagi tampil di beranda.`,
      ya: "Hapus entri",
      bahaya: true,
    });
    if (!ya) return;
    const i = tampak.indexOf(t);
    const ganti = tampak[i + 1] ?? tampak[i - 1] ?? null;
    try {
      await hapusTestimoni(t.id);
      rekam();
      setData((l) => l?.filter((x) => x.id !== t.id) ?? l);
      setPilihId(ganti?.id ?? null);
      history.replaceState(null, "", ganti ? `?id=${encodeURIComponent(ganti.id)}` : location.pathname);
      toast({ judul: "Entri dihapus", keterangan: t.clientName, nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
    /* Fokus balikan dialog konfirmasi bisa jatuh ke <body> (jebakan #39). */
    for (let k = 0; k < 60 && document.querySelector("[role=alertdialog]"); k++)
      await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    if (document.activeElement === document.body || !document.activeElement) {
      const el = ganti ? document.querySelector<HTMLElement>(`[data-entri="${CSS.escape(ganti.id)}"]`) : null;
      (el ?? hapusRef.current)?.focus();
    }
  }

  if (galat && data === null) return <GagalMuat apa="Buku tamu" galat={galat} />;
  if (data === null) return <Rangka />;

  const menunggu = hitung("menunggu");
  const sorotEntri = (id: string | null) => (e: PE) => e.pointerType === "mouse" && setSorot(id);
  const halaman = [isiSpread.slice(0, PER_HAL), isiSpread.slice(PER_HAL)];
  const tabFokus = kini && isiSpread.includes(kini) ? kini.id : isiSpread[0]?.id;

  return (
    <div className="btm">
      <div className="btm__papan">
        {/* ---- Kop ---- */}
        <header className="btm__kop">
          <div className="btm__kopjudul">
            <p>
              Buku tamu studio · {semua.length} entri · {menunggu} menunggu cap
            </p>
            <h2>Buku tamu</h2>
          </div>
          <div className="btm__alat">
            <div className="btm__saring" role="radiogroup" aria-label="Saring status">
              {["semua", "menunggu", "disetujui", "ditolak"].map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={saring === s}
                  className={`is-${s}${saring === s ? " is-pilih" : ""}`}
                  onClick={() => {
                    setSaring(s);
                    setSpread(null);
                  }}
                >
                  {s === "semua" ? "Semua" : LABEL[s]}
                  <b>{hitung(s)}</b>
                </button>
              ))}
            </div>
            <Cari
              className="btm__cari"
              ukuran="medium"
              judul="Cari entri"
              placeholder="Cari entri"
              value={cari}
              onChange={(e) => {
                setCari(e.currentTarget.value);
                setSpread(null);
              }}
            />
          </div>
        </header>

        {/* ---- Buku tamu ---- */}
        <section className="btm__buku" aria-label="Buku tamu">
          <div className="btm__spread" ref={halRef} onKeyDown={tombolBuku}>
            {halaman.map((isi, h) => (
              <div key={h} className={`btm__hal btm__hal--${h ? "kanan" : "kiri"}`}>
                <p className="btm__halkop">
                  <span>Buku tamu</span>
                  <b>hal. {spreadKini * 2 + h + 1}</b>
                </p>
                <ol className="btm__entri-entri">
                  {isi.map((t) => {
                    const terpajang = t.isFeatured;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          data-entri={t.id}
                          className={[
                            "btm__entri",
                            kini?.id === t.id && "is-pilih",
                            sorot === t.id && "is-sorot",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          tabIndex={t.id === tabFokus ? 0 : -1}
                          aria-pressed={kini?.id === t.id}
                          aria-label={`${nomor.get(t.id)}, ${t.clientName}, ${t.projectTitle ?? "tanpa proyek"}, ${LABEL[t.status] ?? t.status}${terpajang ? ", dipajang di beranda" : ""}`}
                          onClick={() => pilih(t)}
                          onPointerEnter={sorotEntri(t.id)}
                          onPointerLeave={sorotEntri(null)}
                        >
                          <span className="btm__no" aria-hidden="true">
                            <b>{nomor.get(t.id)}</b>
                            <small>{tgl(t.createdAt)}</small>
                          </span>
                          <span className="btm__tulis" aria-hidden="true">
                            <span className="btm__siapa">
                              <b>
                                <SorotTeks teks={t.clientName} cari={cari} />
                              </b>
                              <small>{t.projectTitle ? <SorotTeks teks={t.projectTitle} cari={cari} /> : "Tanpa proyek"}</small>
                            </span>
                            <Bintang nilai={t.rating} />
                            <q>
                              <SorotTeks teks={t.quote} cari={cari} />
                            </q>
                          </span>
                          <span className="btm__capkolom" aria-hidden="true">
                            <span className={`btm__cap is-${t.status}${tercap === t.id ? " is-tercap" : ""}`}>
                              {LABEL[t.status] ?? t.status}
                            </span>
                            {terpajang && (
                              <span className={`btm__paku${t.status === "disetujui" ? "" : " is-tunda"}`}>
                                {t.status === "disetujui" ? "di beranda" : "dipajang"}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {isi.length === 0 && h === 0 && (
                    <li className="btm__halkosong">
                      {semua.length === 0
                        ? "Buku tamu masih kosong — klien menulis lewat portal proyeknya."
                        : q
                          ? `Tidak ada entri yang cocok dengan “${cari.trim()}”.`
                          : "Tidak ada entri dengan status ini."}
                    </li>
                  )}
                </ol>
              </div>
            ))}
          </div>
          <div className="btm__bukukaki">
            <button type="button" aria-label="Halaman sebelumnya" disabled={spreadKini === 0} onClick={() => keSpread(spreadKini - 1)}>
              <Ikon ikon={CaretLeft} ukuran={14} />
            </button>
            <span>
              Hal. <b>{spreadKini * 2 + 1}–{spreadKini * 2 + 2}</b> dari {nSpread * 2}
            </span>
            <button type="button" aria-label="Halaman berikutnya" disabled={spreadKini >= nSpread - 1} onClick={() => keSpread(spreadKini + 1)}>
              <Ikon ikon={CaretRight} ukuran={14} />
            </button>
            <small>
              {tampak.length ? `Entri ${spreadKini * perSpread + 1}–${spreadKini * perSpread + isiSpread.length} dari ${tampak.length}` : "Tidak ada entri"}
            </small>
          </div>
        </section>

        {/* ---- Rak cap ---- */}
        <aside className="btm__rak" aria-label="Rak cap moderasi">
          <p className="btm__rakjudul">Cap moderasi</p>
          {kini ? (
            <>
              <p className="btm__sasaran">
                <b>{nomor.get(kini.id)}</b>
                <span>{kini.clientName}</span>
              </p>
              <div
                className="btm__cap-cap"
                role="radiogroup"
                aria-label={`Status ${nomor.get(kini.id)}`}
                onKeyDown={(e) => {
                  const i = STATUS.findIndex((s) => s.nilai === kini.status);
                  let j = i;
                  if (e.key === "ArrowDown" || e.key === "ArrowRight") j = (i + 1) % STATUS.length;
                  else if (e.key === "ArrowUp" || e.key === "ArrowLeft") j = (i - 1 + STATUS.length) % STATUS.length;
                  else return;
                  e.preventDefault();
                  cap(kini, STATUS[j]!.nilai);
                  (e.currentTarget.querySelector(`[data-cap="${STATUS[j]!.nilai}"]`) as HTMLElement | null)?.focus();
                }}
              >
                {STATUS.map((s) => (
                  <button
                    key={s.nilai}
                    type="button"
                    role="radio"
                    data-cap={s.nilai}
                    aria-checked={kini.status === s.nilai}
                    tabIndex={kini.status === s.nilai ? 0 : -1}
                    className={`btm__stempel is-${s.nilai}${kini.status === s.nilai ? " is-pakai" : ""}`}
                    onClick={() => cap(kini, s.nilai)}
                  >
                    <span className="btm__gagang" aria-hidden="true" />
                    <span className="btm__karet">{s.cap}</span>
                  </button>
                ))}
              </div>
              <label className="btm__pajang">
                <Sakelar
                  judul={`Pajang ${nomor.get(kini.id)} di beranda`}
                  checked={kini.isFeatured}
                  onChange={(e) => pajang(kini, e.currentTarget.checked)}
                />
                <span>
                  <b>Pajang di beranda</b>
                  <small>
                    {kini.isFeatured
                      ? kini.status === "disetujui"
                        ? papan.slot.some((x) => x.id === kini.id)
                          ? `Slot ${papan.slot.findIndex((x) => x.id === kini.id) + 1} dari ${SLOT}`
                          : "Terpajang, tidak muat"
                        : "Tampil sesudah disetujui"
                      : "Belum dipajang"}
                  </small>
                </span>
              </label>
              <dl className="btm__fakta">
                <div>
                  <dt>Proyek</dt>
                  <dd>
                    {kini.projectId ? (
                      <a href={`/admin/proyek/satu?id=${encodeURIComponent(kini.projectId)}`}>{kini.projectTitle ?? "Buka proyek"}</a>
                    ) : (
                      "Tanpa proyek"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Ditulis</dt>
                  <dd>{tgl(kini.createdAt)} · portal klien</dd>
                </div>
                <div>
                  <dt>Dicap</dt>
                  <dd>{kini.status === "menunggu" ? "belum" : tgl(kini.updatedAt)}</dd>
                </div>
              </dl>
              <button ref={hapusRef} type="button" className="btm__hapus" onClick={() => hapus(kini)}>
                <Ikon ikon={Trash} ukuran={14} />
                Hapus entri
              </button>
            </>
          ) : (
            <p className="btm__rakkosong">Pilih entri di buku tamu.</p>
          )}
        </aside>

        {/* ---- Papan pameran ---- */}
        <section className="btm__pameran" aria-label="Papan pameran — seksi Dari klien di beranda">
          <div className="btm__pamkop">
            <p>Papan pameran</p>
            <h3>Beranda · Dari klien</h3>
            <small>
              {papan.slot.length} dari {SLOT} slot terisi · urut terakhir diubah
            </small>
            {(papan.lebih.length > 0 || papan.belumSetuju.length > 0) && (
              <small className="btm__pamcatat">
                {[
                  papan.lebih.length ? `+${papan.lebih.length} terpajang, tidak muat` : null,
                  papan.belumSetuju.length ? `${papan.belumSetuju.length} terpajang, belum disetujui` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            )}
            <small className="btm__pamterbit">Tayang sesudah Terbitkan</small>
          </div>
          <div className="btm__situs">
            <span className="btm__situslabel">Dari klien</span>
            <ol className="btm__slot-slot">
              {Array.from({ length: SLOT }, (_, i) => {
                const t = papan.slot[i];
                if (!t)
                  return (
                    <li key={`kosong-${i}`} className="btm__slot is-kosong">
                      <span>Slot {i + 1} kosong</span>
                    </li>
                  );
                return (
                  <li
                    key={t.id}
                    data-slot={t.id}
                    className={`btm__slot${slotSorot === t.id ? " is-sorot" : ""}${kini?.id === t.id ? " is-pilih" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => pilih(t)}
                      onPointerEnter={sorotEntri(t.id)}
                      onPointerLeave={sorotEntri(null)}
                      aria-label={`Slot ${i + 1}: ${t.clientName} — buka ${nomor.get(t.id)} di buku tamu`}
                    >
                      <span className="btm__pin" aria-hidden="true" />
                      <q>{t.quote}</q>
                      <b>{t.clientName}</b>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      </div>
      <div ref={lapisRef} className="btm__lapis" aria-hidden="true" />
    </div>
  );
}

/* Kerangka memuat berbentuk papan dan setinggi papan aslinya. */
function Rangka() {
  return (
    <div className="btm" aria-busy="true">
      <div className="btm__papan">
        <div className="btm__kop btm__kop--rangka" />
        <div className="btm__buku btm__buku--rangka" />
        <div className="btm__rak" />
        <div className="btm__pameran btm__pameran--rangka" />
      </div>
    </div>
  );
}

export function TestimoniKit() {
  return (
    <RequireAuth skeleton={<Rangka />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
