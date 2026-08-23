import { useRef, useState, type DragEvent } from "react";
import { Icon } from "../Icon";

interface Berkas { nama: string; ukuran: number; }

const format = (b: number) =>
  b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

/**
 * Zona unggah dengan seret-dan-lepas.
 *
 * Tetap memakai <input type="file"> yang disembunyikan, bukan div yang meniru
 * tombol: pemilih berkas bawaan sistem tetap terbuka lewat keyboard, dan
 * seret-lepas hanya menambah satu cara lagi untuk melakukan hal yang sama.
 */
export function Attachment() {
  const [berkas, setBerkas] = useState<Berkas[]>([]);
  const [diAtas, setDiAtas] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function tambah(list: FileList | null) {
    if (!list) return;
    setBerkas((cur) => [...cur, ...[...list].map((f) => ({ nama: f.name, ukuran: f.size }))]);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDiAtas(false);
    tambah(e.dataTransfer.files);
  }

  return (
    <div className="stack">
      <div
        className="dropzone"
        data-over={diAtas || undefined}
        onDragOver={(e) => { e.preventDefault(); setDiAtas(true); }}
        onDragLeave={() => setDiAtas(false)}
        onDrop={onDrop}
      >
        <span className="icon-tile"><Icon name="upload" size={20} /></span>
        <span className="t-subheading">Unggah foto proyek</span>
        <span className="t-muted">Seret ke sini, atau pilih dari perangkat</span>

        <input
          ref={input}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          onChange={(e) => tambah(e.target.files)}
        />
        <button type="button" className="btn btn--secondary" onClick={() => input.current?.click()}>
          Pilih berkas
        </button>

        <div className="dropzone__hint">
          <span>JPG, PNG, WEBP, AVIF</span>
          <span>Maks 5 MB</span>
          <span>Sisi terpanjang 2400px</span>
        </div>
      </div>

      {berkas.map((f, i) => (
        <div className="attachment" key={`${f.nama}-${i}`}>
          <span className="icon-tile icon-tile--sm"><Icon name="image" size={16} /></span>
          <span className="attachment__text">
            <span className="attachment__name">{f.nama}</span>
            <span className="attachment__size">{format(f.ukuran)}</span>
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            aria-label={`Hapus ${f.nama}`}
            onClick={() => setBerkas((cur) => cur.filter((_, k) => k !== i))}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
