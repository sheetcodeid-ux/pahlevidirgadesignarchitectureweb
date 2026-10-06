import { useEffect, useRef, useState } from "react";
import { Dialog } from "../kit/Overlay";
import { Tombol } from "../kit/Tombol";
import { Geser } from "../kit/Formulir";
import { Ikon } from "../kit/Ikon";
import { ArrowsLeftRight, ImageSquare } from "../kit/ikon";

/* =============================================================================
   Potong foto akun — dialog yang muncul sesudah berkas dipilih.

   Foto mentah dari ponsel bisa 4000px dan 6 MB; yang dipakai panel paling
   besar 104px. Jadi berkasnya dipotong PERSEGI dan dikecilkan ke 512px di
   peramban (kanvas) sebelum diunggah — alasan yang sama dengan thumbnail
   foto proyek: Worker tidak pernah memegang berkasnya (presigned PUT), dan
   runtime-nya tidak punya kanvas.

   Geser dengan tetikus/jari, perbesar dengan penggeser atau roda tetikus,
   atau papan ketik (panah menggeser, +/− memperbesar). Di kanan, tiga
   cuplikan TEMPAT fotonya benar-benar muncul: kepala halaman Akun, kartu
   staf, dan kartu akun di rel.
   ============================================================================= */

const V = 264; // sisi bingkai potong, px
const KELUAR = 512; // sisi hasil, px

interface Letak { x: number; y: number; z: number }

function batasi(l: Letak, w: number, h: number): Letak {
  const s = (V / Math.min(w, h)) * l.z;
  const W = w * s;
  const H = h * s;
  return { z: l.z, x: Math.min(0, Math.max(V - W, l.x)), y: Math.min(0, Math.max(V - H, l.y)) };
}

/** Cuplikan seukuran `p` px dari potongan yang sama — ditransformasi, bukan
 *  digambar ulang, jadi ikut bergerak tanpa ongkos kanvas. */
function Cuplikan({ src, l, w, h, p, label, bentuk }: {
  src: string; l: Letak; w: number; h: number; p: number; label: string; bentuk: "bulat" | "kotak";
}) {
  const s = (V / Math.min(w, h)) * l.z * (p / V);
  return (
    <figure className="pf-cuplik">
      <span className={`pf-cuplik__bingkai pf-cuplik__bingkai--${bentuk}`} style={{ width: p, height: p }}>
        <img src={src} alt="" style={{ width: w * s, height: h * s, transform: `translate(${(l.x * p) / V}px, ${(l.y * p) / V}px)` }} />
      </span>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export function PotongFoto({ berkas, onBatal, onSimpan, menyimpan }: {
  berkas: File | null;
  onBatal: () => void;
  onSimpan: (hasil: Blob) => void;
  menyimpan: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [ukuran, setUkuran] = useState<{ w: number; h: number } | null>(null);
  const [l, setL] = useState<Letak>({ x: 0, y: 0, z: 1 });
  const img = useRef<HTMLImageElement | null>(null);
  const bingkai = useRef<HTMLDivElement>(null);
  const tarik = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!berkas) return;
    const u = URL.createObjectURL(berkas);
    setSrc(u);
    setUkuran(null);
    const el = new Image();
    el.onload = () => {
      img.current = el;
      const w = el.naturalWidth;
      const h = el.naturalHeight;
      const s = V / Math.min(w, h);
      setUkuran({ w, h });
      setL({ z: 1, x: (V - w * s) / 2, y: (V - h * s) / 2 });
    };
    el.src = u;
    return () => URL.revokeObjectURL(u);
  }, [berkas]);

  /** Perbesar dengan titik tengah bingkai tetap di tempatnya. */
  function zoom(zBaru: number, pusat = { x: V / 2, y: V / 2 }) {
    if (!ukuran) return;
    setL((lama) => {
      const z = Math.min(3, Math.max(1, zBaru));
      const s0 = V / Math.min(ukuran.w, ukuran.h);
      const kx = (pusat.x - lama.x) / (s0 * lama.z);
      const ky = (pusat.y - lama.y) / (s0 * lama.z);
      return batasi({ z, x: pusat.x - kx * s0 * z, y: pusat.y - ky * s0 * z }, ukuran.w, ukuran.h);
    });
  }

  // Roda tetikus memperbesar. Pendengar asli ber-passive:false — onWheel
  // milik React pasif, jadi halaman di belakang dialog ikut tergulir.
  useEffect(() => {
    const el = bingkai.current;
    if (!el || !ukuran) return;
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setL((lama) => {
        const z = Math.min(3, Math.max(1, lama.z * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
        const s0 = V / Math.min(ukuran.w, ukuran.h);
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        const kx = (px - lama.x) / (s0 * lama.z);
        const ky = (py - lama.y) / (s0 * lama.z);
        return batasi({ z, x: px - kx * s0 * z, y: py - ky * s0 * z }, ukuran.w, ukuran.h);
      });
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, [ukuran, src]);

  async function simpan() {
    const el = img.current;
    if (!el || !ukuran) return;
    const s = (V / Math.min(ukuran.w, ukuran.h)) * l.z;
    const kanvas = document.createElement("canvas");
    kanvas.width = KELUAR;
    kanvas.height = KELUAR;
    const ctx = kanvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(el, -l.x / s, -l.y / s, V / s, V / s, 0, 0, KELUAR, KELUAR);
    // WebP kalau peramban bisa menyandikannya; Safari lama diam-diam
    // memberi PNG, dan PNG foto 512px jauh lebih berat daripada JPEG.
    const jadi = (tipe: string, mutu: number) => new Promise<Blob | null>((r) => kanvas.toBlob(r, tipe, mutu));
    let hasil = await jadi("image/webp", 0.88);
    if (!hasil || hasil.type !== "image/webp") hasil = await jadi("image/jpeg", 0.9);
    if (hasil) onSimpan(hasil);
  }

  const siap = !!(src && ukuran);
  return (
    <Dialog
      open={!!berkas}
      onOpenChange={(b) => { if (!b && !menyimpan) onBatal(); }}
      title="Atur foto"
      ukuran="lebar"
      footer={
        <>
          <Tombol jenis="ghost" ukuran="medium" onClick={onBatal} disabled={menyimpan}>Batal</Tombol>
          <Tombol jenis="primary" ukuran="medium" memuat={menyimpan} disabled={!siap || menyimpan} onClick={() => void simpan()}>
            Pasang foto
          </Tombol>
        </>
      }
    >
      <div className="pf">
        <div className="pf__kiri">
          <div
            ref={bingkai}
            className="pf__bingkai"
            role="application"
            aria-label="Potongan foto. Seret atau tekan panah untuk menggeser, plus dan minus untuk memperbesar."
            tabIndex={0}
            style={{ width: V, height: V }}
            onPointerDown={(e) => {
              if (!siap) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              tarik.current = { px: e.clientX, py: e.clientY, x: l.x, y: l.y };
            }}
            onPointerMove={(e) => {
              const t = tarik.current;
              if (!t || !ukuran) return;
              setL((lama) => batasi({ z: lama.z, x: t.x + e.clientX - t.px, y: t.y + e.clientY - t.py }, ukuran.w, ukuran.h));
            }}
            onPointerUp={() => { tarik.current = null; }}
            onPointerCancel={() => { tarik.current = null; }}
            onKeyDown={(e) => {
              if (!ukuran) return;
              const d = e.shiftKey ? 24 : 8;
              const geser = { ArrowLeft: [d, 0], ArrowRight: [-d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] }[e.key];
              if (geser) {
                e.preventDefault();
                setL((lama) => batasi({ z: lama.z, x: lama.x + geser[0]!, y: lama.y + geser[1]! }, ukuran.w, ukuran.h));
              } else if (e.key === "+" || e.key === "=") { e.preventDefault(); zoom(l.z + 0.1); }
              else if (e.key === "-") { e.preventDefault(); zoom(l.z - 0.1); }
            }}
          >
            {siap ? (
              <img
                src={src!}
                alt=""
                draggable={false}
                style={{
                  width: ukuran!.w * (V / Math.min(ukuran!.w, ukuran!.h)) * l.z,
                  height: ukuran!.h * (V / Math.min(ukuran!.w, ukuran!.h)) * l.z,
                  transform: `translate(${l.x}px, ${l.y}px)`,
                }}
              />
            ) : (
              <span className="pf__muat"><Ikon ikon={ImageSquare} ukuran={22} />Membaca foto…</span>
            )}
            {/* Lingkaran = bagian yang terlihat di avatar; sudut di luarnya
                tetap tersimpan (kartu staf memakai persegi). Kisi pertigaan
                membantu meletakkan mata. */}
            <span className="pf__topeng" aria-hidden="true" />
            <span className="pf__kisi" aria-hidden="true"><i /><i /><i /><i /></span>
          </div>
          <Geser
            label="Perbesar"
            min={1}
            maks={3}
            langkah={0.01}
            nilai={l.z}
            onUbah={(z) => zoom(z)}
            format={(n) => `${Math.round(n * 100)}%`}
          />
          <p className="pf__petunjuk"><Ikon ikon={ArrowsLeftRight} ukuran={14} />Seret foto untuk menggeser</p>
        </div>
        <div className="pf__kanan">
          <span className="pf__judulcuplik">Tampil di</span>
          {siap && (
            <>
              <Cuplikan src={src!} l={l} w={ukuran!.w} h={ukuran!.h} p={96} label="Kepala halaman Akun" bentuk="bulat" />
              <Cuplikan src={src!} l={l} w={ukuran!.w} h={ukuran!.h} p={68} label="Kartu staf" bentuk="bulat" />
              <Cuplikan src={src!} l={l} w={ukuran!.w} h={ukuran!.h} p={32} label="Kartu akun di menu" bentuk="bulat" />
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
