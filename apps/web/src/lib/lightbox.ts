/**
 * Penampil foto layar penuh, dipakai SELURUH situs.
 *
 * Satu modul untuk panel admin dan halaman publik sekaligus. Itu bukan
 * kebetulan: keduanya memakai sistem CSS yang benar-benar terpisah
 * (publik.css punya --kanvas/--teks/--aksen, panel punya --surface/--text/
 * --brand), jadi komponen bersama yang menaruh gayanya di salah satu
 * stylesheet akan tampil sebagai elemen mentah di sisi yang satunya — tanpa
 * satu pun galat. Itu jebakan nomor 5 di CLAUDE.md, dan sudah menggigit tiga
 * halaman sekaligus.
 *
 * Karena itu gayanya dibawa modul ini sendiri, disuntikkan sekali per
 * dokumen, dan warnanya diambil dari token SISTEM YANG ADA lewat rantai
 * fallback: token publik dulu, token panel berikutnya, baru nilai terakhir.
 * Jadi ia tetap mengikuti tema di kedua dunia.
 *
 * Bangunannya memakai <dialog> asli. Perangkap fokus, Esc, kunci gulir latar,
 * dan lapisan gelap ::backdrop datang dari peramban — bukan ditulis ulang,
 * dan karenanya tidak bisa rusak diam-diam.
 */

export interface FotoLightbox {
  url: string;
  caption?: string | null;
  altText?: string | null;
}

const GAYA = `
.pdlb {
  --lb-teks: var(--teks, var(--text, #fff));
  --lb-redup: var(--teks-2, var(--text-muted, #a1a1aa));
  --lb-garis: var(--garis-2, var(--border-strong, #3f3f46));
  --lb-panel: var(--sel, var(--surface-raised, #27272a));
  width: 100vw;
  max-width: 100vw;
  height: 100dvh;
  max-height: 100dvh;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--lb-teks);
  font-family: var(--tubuh, var(--font-ui, system-ui, sans-serif));
  overflow: hidden;
}
.pdlb::backdrop { background: rgba(0, 0, 0, 0.92); }
.pdlb[open] { display: grid; }

.pdlb__isi {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: 100%;
  gap: 12px;
  padding: 12px clamp(12px, 3vw, 28px) 16px;
}

.pdlb__kop {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 34px;
}
.pdlb__hitung {
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--lb-redup);
  font-variant-numeric: tabular-nums;
}

/* Panggung: gambar dibatasi KOTAKNYA, bukan diberi tinggi tetap — foto tegak
   dan mendatar sama-sama harus muat utuh tanpa terpotong. */
.pdlb__panggung {
  position: relative;
  min-height: 0;
  touch-action: pan-y;
}

/* Gambarnya DIPOSISIKAN MUTLAK memenuhi panggung, bukan diletakkan di tengah
   grid. Bentuk grid + place-items:center membuat max-height:100% menghitung
   diri terhadap kotak yang tingginya justru ditentukan gambar itu sendiri —
   melingkar, jadi diabaikan diam-diam. Terukur: foto 480x120 tergambar
   116x24. Dengan inset:0 dan object-fit:contain, kotaknya punya ukuran pasti
   lebih dulu dan gambarnya memenuhi kotak itu tanpa terpotong. */
.pdlb__gambar {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 10px;
  user-select: none;
  -webkit-user-drag: none;
}

.pdlb__nav {
  position: absolute;
  /* DI ATAS gambar. Gambarnya position:absolute dan berdiri setelah tombol
     ini di DOM, jadi tanpa z-index ia menutupi panah kiri sepenuhnya —
     terlihat di tangkapan layar: panah kanan ada, panah kiri hilang. */
  z-index: 2;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--lb-garis);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  color: var(--lb-teks);
  cursor: pointer;
  transition: background-color .18s ease, transform .18s ease;
}
.pdlb__nav:hover { background: rgba(0, 0, 0, 0.8); transform: translateY(-50%) scale(1.06); }
.pdlb__nav:focus-visible { outline: 2px solid var(--cincin, var(--focus, #34d399)); outline-offset: 2px; }
.pdlb__nav--prev { left: 4px; }
.pdlb__nav--next { right: 4px; }
.pdlb__nav[hidden] { display: none !important; }

.pdlb__tutup {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--lb-garis);
  border-radius: 999px;
  background: transparent;
  color: var(--lb-teks);
  cursor: pointer;
  transition: background-color .18s ease;
}
.pdlb__tutup:hover { background: var(--lb-panel); }
.pdlb__tutup:focus-visible { outline: 2px solid var(--cincin, var(--focus, #34d399)); outline-offset: 2px; }

.pdlb__kaki { display: grid; gap: 10px; justify-items: center; }
.pdlb__ket {
  margin: 0;
  max-width: 68ch;
  text-align: center;
  font-size: 14px;
  color: var(--lb-redup);
}
.pdlb__ket:empty { display: none; }

/* Rel thumbnail. Hanya muncul kalau fotonya lebih dari satu — satu thumbnail
   di bawah satu foto tidak menyampaikan apa pun. */
.pdlb__film {
  display: flex;
  gap: 8px;
  max-width: 100%;
  padding-bottom: 4px;
  overflow-x: auto;
  scrollbar-width: thin;
}
.pdlb__film[hidden] { display: none !important; }
.pdlb__film button {
  flex: none;
  width: 64px;
  height: 44px;
  padding: 0;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 6px;
  background: var(--lb-panel);
  cursor: pointer;
  opacity: .5;
  transition: opacity .18s ease, border-color .18s ease;
}
.pdlb__film button:hover { opacity: .85; }
.pdlb__film button[aria-current="true"] { opacity: 1; border-color: var(--lb-teks); }
.pdlb__film img { width: 100%; height: 100%; object-fit: cover; display: block; }

@media (prefers-reduced-motion: reduce) {
  .pdlb__nav, .pdlb__tutup, .pdlb__film button { transition: none; }
  .pdlb__nav:hover { transform: translateY(-50%); }
}

@media (max-width: 40rem) {
  .pdlb__film button { width: 52px; height: 36px; }
  .pdlb__nav { width: 38px; height: 38px; }
}
`;

const IKON_KIRI = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>`;
const IKON_KANAN = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`;
const IKON_TUTUP = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

let dialog: HTMLDialogElement | null = null;
let daftar: FotoLightbox[] = [];
let ke = 0;

function pasangGaya() {
  if (document.getElementById("pdlb-gaya")) return;
  const el = document.createElement("style");
  el.id = "pdlb-gaya";
  el.textContent = GAYA;
  document.head.appendChild(el);
}

function buat(): HTMLDialogElement {
  pasangGaya();
  const d = document.createElement("dialog");
  d.className = "pdlb";
  d.setAttribute("aria-label", "Penampil foto");
  d.innerHTML = `
    <div class="pdlb__isi">
      <div class="pdlb__kop">
        <span class="pdlb__hitung" role="status" aria-live="polite"></span>
        <button type="button" class="pdlb__tutup" aria-label="Tutup">${IKON_TUTUP}</button>
      </div>
      <div class="pdlb__panggung">
        <button type="button" class="pdlb__nav pdlb__nav--prev" aria-label="Foto sebelumnya">${IKON_KIRI}</button>
        <img class="pdlb__gambar" alt="" decoding="async">
        <button type="button" class="pdlb__nav pdlb__nav--next" aria-label="Foto berikutnya">${IKON_KANAN}</button>
      </div>
      <div class="pdlb__kaki">
        <p class="pdlb__ket"></p>
        <div class="pdlb__film" aria-label="Pilih foto"></div>
      </div>
    </div>`;

  const q = <T extends Element>(s: string) => d.querySelector(s) as T;
  q<HTMLButtonElement>(".pdlb__tutup").addEventListener("click", () => d.close());
  q<HTMLButtonElement>(".pdlb__nav--prev").addEventListener("click", () => geser(-1));
  q<HTMLButtonElement>(".pdlb__nav--next").addEventListener("click", () => geser(1));

  d.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); geser(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); geser(1); }
  });

  /* Klik pada latar gelap menutup. Diukur dari kotak dialognya sendiri:
     ::backdrop tidak bisa menerima listener, dan <dialog> mengisi seluruh
     layar — jadi klik di luar .pdlb__isi berarti klik di latarnya. */
  d.addEventListener("click", (e) => {
    if (e.target === d) d.close();
  });

  /* Geser dengan jari ATAU dengan menyeret tetikus. Pointer Events menangani
     keduanya sekaligus; ambangnya 45px supaya ketukan biasa tidak terbaca
     sebagai gesekan. */
  let mulaiX: number | null = null;
  const panggung = q<HTMLElement>(".pdlb__panggung");
  panggung.addEventListener("pointerdown", (e) => { mulaiX = e.clientX; });
  panggung.addEventListener("pointerup", (e) => {
    if (mulaiX === null) return;
    const jarak = e.clientX - mulaiX;
    mulaiX = null;
    if (Math.abs(jarak) > 45) geser(jarak < 0 ? 1 : -1);
  });
  panggung.addEventListener("pointercancel", () => { mulaiX = null; });

  document.body.appendChild(d);
  return d;
}

function geser(arah: -1 | 1) {
  if (daftar.length < 2) return;
  // Berputar: dari foto terakhir maju kembali ke yang pertama. Tombolnya
  // memang tidak pernah dimatikan, jadi jalan buntu akan terasa seperti rusak.
  tampilkan((ke + arah + daftar.length) % daftar.length);
}

function tampilkan(i: number) {
  if (!dialog) return;
  ke = i;
  const f = daftar[i];
  const gambar = dialog.querySelector(".pdlb__gambar") as HTMLImageElement;
  gambar.src = f.url;
  gambar.alt = f.altText ?? f.caption ?? "";
  (dialog.querySelector(".pdlb__hitung") as HTMLElement).textContent =
    `${i + 1} / ${daftar.length}`;
  (dialog.querySelector(".pdlb__ket") as HTMLElement).textContent = f.caption ?? "";

  const film = dialog.querySelector(".pdlb__film") as HTMLElement;
  film.querySelectorAll("button").forEach((b, n) => {
    b.setAttribute("aria-current", n === i ? "true" : "false");
    if (n === i) b.scrollIntoView({ block: "nearest", inline: "center" });
  });

  // Tetangganya diunduh lebih dulu supaya berpindah terasa seketika.
  for (const n of [i + 1, i - 1]) {
    const t = daftar[(n + daftar.length) % daftar.length];
    if (t) new Image().src = t.url;
  }
}

/** Membuka penampil pada foto ke-`mulai`. */
export function bukaLightbox(foto: FotoLightbox[], mulai = 0) {
  const bersih = foto.filter((f) => f && f.url);
  if (bersih.length === 0) return;

  dialog ??= buat();
  daftar = bersih;

  const film = dialog.querySelector(".pdlb__film") as HTMLElement;
  film.innerHTML = "";
  film.hidden = bersih.length < 2;
  bersih.forEach((f, n) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", `Foto ${n + 1}`);
    b.innerHTML = `<img src="${f.url}" alt="" loading="lazy" decoding="async">`;
    b.addEventListener("click", () => tampilkan(n));
    film.appendChild(b);
  });

  const satu = bersih.length < 2;
  (dialog.querySelector(".pdlb__nav--prev") as HTMLElement).hidden = satu;
  (dialog.querySelector(".pdlb__nav--next") as HTMLElement).hidden = satu;

  tampilkan(Math.min(Math.max(mulai, 0), bersih.length - 1));
  if (!dialog.open) dialog.showModal();
}
