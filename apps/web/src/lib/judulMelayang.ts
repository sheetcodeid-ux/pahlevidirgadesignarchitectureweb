/* =============================================================================
   Keterangan melayang untuk atribut `title` — pengganti tooltip bawaan
   peramban.

   Tooltip bawaan (kotak kuning/abu ber-huruf sistem, muncul sesudah ±1 detik,
   bentuknya beda di tiap OS) adalah salah satu "tampilan default" yang
   ditolak pemilik. Panel memakai `title` di ±900 tempat — nama lengkap yang
   terpotong elipsis, nominal penuh di balik angka ringkas, alasan tombol
   mati — dan menulis ulang semuanya jadi `<Petunjuk>` berarti ratusan
   pembungkus Radix. Jadi satu pendengar di dokumen yang mengurusnya:

   - saat kursor (atau fokus papan ketik) masuk ke elemen ber-`title`,
     isinya dipindah ke `data-judul` supaya peramban tidak ikut menggambar
     kotaknya sendiri, lalu kotak `.k-petunjuk` yang sama dengan Petunjuk
     kit ditampilkan di atas elemennya;
   - elemen tanpa teks dan tanpa `aria-label` diberi `aria-label` dari
     judulnya, supaya pembaca layar tidak kehilangan nama yang dulu datang
     dari `title`.

   Dipasang SEKALI per dokumen (router sisi klien tidak memuat ulang skrip).
   Kotaknya dibuat ulang kalau hilang: penukaran halaman membuang anak
   <body> yang tidak ber-persist.
   ============================================================================= */

const JEDA = 350;

let kotak: HTMLDivElement | null = null;
let sasaran: Element | null = null;
let pewaktu: number | undefined;

function ambilKotak(): HTMLDivElement {
  if (!kotak || !kotak.isConnected) {
    kotak = document.createElement("div");
    kotak.className = "k-petunjuk k-petunjuk--melayang";
    kotak.setAttribute("role", "tooltip");
    kotak.hidden = true;
    document.body.appendChild(kotak);
  }
  return kotak;
}

function judulDari(el: Element): string | null {
  const t = el.getAttribute("title");
  if (t !== null) {
    el.removeAttribute("title");
    if (t.trim()) {
      el.setAttribute("data-judul", t);
      const punyaNama = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.textContent?.trim();
      if (!punyaNama) el.setAttribute("aria-label", t);
    }
  }
  return el.getAttribute("data-judul");
}

function cari(dari: EventTarget | null): Element | null {
  if (!(dari instanceof Element)) return null;
  // SVG <title> bukan atribut — tidak memunculkan kotak peramban di HTML.
  return dari.closest("[title], [data-judul]");
}

function sembunyi() {
  window.clearTimeout(pewaktu);
  sasaran = null;
  if (kotak) kotak.hidden = true;
}

function tampil(el: Element) {
  const isi = judulDari(el);
  if (!isi) return;
  const k = ambilKotak();
  k.textContent = isi;
  k.hidden = false;
  const r = el.getBoundingClientRect();
  const kk = k.getBoundingClientRect();
  const atas = r.top - kk.height - 8;
  const top = atas >= 8 ? atas : r.bottom + 8;
  const left = Math.min(Math.max(8, r.left + r.width / 2 - kk.width / 2), window.innerWidth - kk.width - 8);
  k.style.top = `${Math.round(top)}px`;
  k.style.left = `${Math.round(left)}px`;
}

function jadwalkan(el: Element) {
  if (el === sasaran) return;
  sembunyi();
  // Pindahkan judulnya SEKARANG — kalau menunggu jeda, peramban sudah
  // keburu menjadwalkan kotak bawaannya sendiri.
  if (!judulDari(el)) return;
  sasaran = el;
  pewaktu = window.setTimeout(() => {
    if (sasaran === el && el.isConnected) tampil(el);
  }, JEDA);
}

/** Pindahkan `title` di elemen ini dan seluruh keturunannya ke `data-judul`. */
function sapu(akar: ParentNode) {
  if (akar instanceof Element && akar.hasAttribute("title")) judulDari(akar);
  akar.querySelectorAll?.("[title]").forEach((el) => judulDari(el));
}

export function pasangJudulMelayang() {
  const w = window as unknown as { __judulMelayang?: boolean };
  if (w.__judulMelayang) return;
  w.__judulMelayang = true;

  /* `title` dipindah BEGITU muncul, bukan baru saat disentuh: peramban
     menjadwalkan kotaknya sendiri pada gerakan tetikus pertama, dan
     memindahkannya di peristiwa yang sama tidak selalu menang. Pengamat ini
     juga menangkap `title` yang dipasang React belakangan (isi yang dimuat
     dari API, baris tabel baru). */
  sapu(document);
  new MutationObserver((daftar) => {
    for (const m of daftar) {
      if (m.type === "attributes" && m.target instanceof Element) judulDari(m.target);
      else m.addedNodes.forEach((n) => n instanceof Element && sapu(n));
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["title"] });

  document.addEventListener(
    "pointerover",
    (e) => {
      if (e.pointerType !== "mouse") return;
      const el = cari(e.target);
      if (el) jadwalkan(el);
      else sembunyi();
    },
    { passive: true },
  );
  document.addEventListener("focusin", (e) => {
    const el = cari(e.target);
    if (el && (e.target as Element).matches?.(":focus-visible")) jadwalkan(el);
    else sembunyi();
  });
  document.addEventListener("pointerdown", sembunyi, { passive: true });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") sembunyi();
  });
  document.addEventListener("scroll", sembunyi, { passive: true, capture: true });
  document.addEventListener("astro:before-swap", sembunyi);
}
