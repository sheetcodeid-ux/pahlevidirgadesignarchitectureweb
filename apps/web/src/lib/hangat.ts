/* =============================================================================
   Menghangatkan halaman tujuan SEBELUM menunya diklik.

   Diukur dengan RTT 120 ms (jaringan wajar), satu klik menu ke halaman yang
   belum pernah dibuka berjalan BERANTAI, tiap mata rantai satu perjalanan:

     1. HTML  /admin/direktori  → dialihkan ke /admin/direktori/
        (Workers Static Assets mengalihkan alamat tanpa garis miring)
     2. CSS halaman itu — router menunggunya sebelum menukar halaman
     3. JS island halaman itu — baru diminta SESUDAH ditukar
     4. JS yang diimpor island itu — baru ketahuan sesudah (3) diurai
     5. Data dari API

   Prefetch bawaan Astro cuma mengambil (1). Modul ini mengerjakan (1)–(4)
   begitu kursor menyentuh tautan, jadi yang tersisa saat klik cuma (5) —
   dan untuk halaman yang pernah dibuka, (5) pun sudah ada di cache sesi.

   Tiga hal yang dikerjakan:
   - Alamat dinormalkan ke garis miring di akhir, baik untuk pemanasan maupun
     untuk navigasi router (`astro:before-preparation`), supaya pengalihan di
     (1) tidak pernah terjadi. Seratus lebih tautan `/admin/...` di kode
     ditulis tanpa garis miring; menormalkannya di SATU tempat lebih aman
     daripada menyunting semuanya dan melewatkan satu.
   - HTML yang sudah diambil diberikan ke router lewat `loader`, jadi router
     tidak mengambilnya lagi.
   - Modul island di-`import()` — itu yang ikut menarik seluruh impornya
     sekaligus. Modul komponen di panel ini tidak punya efek samping di
     tingkat modul (sudah diperiksa), jadi mengevaluasinya lebih awal aman.
   ============================================================================= */

const UMUR_MS = 5 * 60_000;

interface Hangat {
  waktu: number;
  html: Promise<string | null>;
}

const simpanan = new Map<string, Hangat>();
/** Preload CSS per alamat berkas — ditunggu loader sebelum menukar halaman. */
const gaya = new Map<string, Promise<void>>();
let parser: DOMParser | undefined;

/** `/admin/direktori` → `/admin/direktori/`. Berkas (`/cap-build.json`)
    dibiarkan. Mengubah URL yang dioper. */
function normalkan(u: URL): URL {
  if (!u.pathname.endsWith("/") && !/\.[a-z0-9]+$/i.test(u.pathname)) u.pathname += "/";
  return u;
}

function kunci(u: URL) {
  return u.pathname + u.search;
}

function layak(u: URL) {
  return u.origin === location.origin && u.pathname.startsWith("/admin") && kunci(u) !== location.pathname + location.search;
}

function urai(html: string) {
  parser ??= new DOMParser();
  return parser.parseFromString(html, "text/html");
}

/* Dipanggil sekali per alamat: CSS dimuat sebagai preload (router memakai
   kunci yang sama, jadi ia mendapatinya sudah ada), modul island diimpor. */
function siapkanAset(doc: Document) {
  for (const l of doc.querySelectorAll<HTMLLinkElement>("head link[rel=stylesheet][href]")) {
    const href = l.getAttribute("href")!;
    if (gaya.has(href) || document.querySelector(`link[rel=stylesheet][href="${CSS.escape(href)}"]`)) continue;
    const pre = document.createElement("link");
    pre.rel = "preload";
    pre.as = "style";
    pre.href = href;
    gaya.set(
      href,
      new Promise((selesai) => {
        pre.addEventListener("load", () => selesai(), { once: true });
        pre.addEventListener("error", () => selesai(), { once: true });
      }),
    );
    document.head.append(pre);
  }
  const modul = new Set<string>();
  for (const pulau of doc.querySelectorAll("astro-island")) {
    for (const a of ["component-url", "renderer-url", "before-hydration-url"]) {
      const v = pulau.getAttribute(a);
      if (v) modul.add(v);
    }
  }
  for (const m of modul) import(/* @vite-ignore */ m).catch(() => {});
}

export function hangatkan(href: string) {
  let u: URL;
  try {
    u = normalkan(new URL(href, location.href));
  } catch {
    return;
  }
  if (!layak(u)) return;
  const k = kunci(u);
  const ada = simpanan.get(k);
  if (ada && Date.now() - ada.waktu < UMUR_MS) return;
  const html = fetch(u.href, { priority: "low" } as RequestInit)
    .then(async (r) => {
      const jenis = r.headers.get("content-type") ?? "";
      if (!r.ok || r.redirected || !jenis.startsWith("text/html")) return null;
      const teks = await r.text();
      siapkanAset(urai(teks));
      return teks;
    })
    .catch(() => null);
  simpanan.set(k, { waktu: Date.now(), html });
}

function tautan(t: EventTarget | null): HTMLAnchorElement | null {
  const a = (t as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || a.target === "_blank" || a.hasAttribute("download")) return null;
  return a;
}

let tunda: number | undefined;

export function pasangHangat() {
  /* Tetikus: tunggu sebentar supaya kursor yang cuma lewat tidak memicu
     belasan pengambilan. Sentuh dan papan ketik: langsung, karena dari
     sana ke klik jaraknya cuma puluhan milidetik. */
  document.addEventListener(
    "pointerover",
    (e) => {
      const a = tautan(e.target);
      if (!a) return;
      clearTimeout(tunda);
      if (e.pointerType === "mouse") tunda = window.setTimeout(() => hangatkan(a.href), 60);
      else hangatkan(a.href);
    },
    { passive: true },
  );
  document.addEventListener(
    "pointerout",
    (e) => {
      if (tautan(e.target)) clearTimeout(tunda);
    },
    { passive: true },
  );
  document.addEventListener("focusin", (e) => {
    const a = tautan(e.target);
    if (a) hangatkan(a.href);
  });

  document.addEventListener("astro:before-preparation", (ev) => {
    const e = ev as Event & {
      to: URL;
      formData?: FormData;
      loader: () => Promise<void>;
      newDocument: Document;
      defaultPrevented: boolean;
    };
    if (e.defaultPrevented || e.formData || e.to.origin !== location.origin) return;
    normalkan(e.to);
    const ada = simpanan.get(kunci(e.to));
    if (!ada || Date.now() - ada.waktu >= UMUR_MS) return;
    const asli = e.loader;
    e.loader = async () => {
      const teks = await ada.html;
      const doc = teks ? urai(teks) : null;
      /* Halaman tanpa router (mis. halaman publik) harus jatuh ke jalur
         asli, yang tahu cara menolaknya jadi muat penuh. */
      if (!doc?.querySelector('[name="astro-view-transitions-enabled"]')) return asli();
      doc.querySelectorAll("noscript").forEach((n) => n.remove());
      /* CSS sudah di-preload saat menghangatkan; tunggu yang belum selesai
         supaya halaman baru tidak tergambar sekejap tanpa gaya. Yang
         ditunggu preload-nya sendiri, BUKAN fetch() baru: fetch bermode
         cors tidak memakai ulang preload bermode no-cors, dan terukur
         menambah satu perjalanan penuh. */
      const tunggu: Promise<void>[] = [];
      for (const l of doc.querySelectorAll<HTMLLinkElement>("head link[rel=stylesheet][href]")) {
        const g = gaya.get(l.getAttribute("href")!);
        if (g) tunggu.push(g);
      }
      await Promise.all(tunggu);
      e.newDocument = doc;
    };
  });
}
