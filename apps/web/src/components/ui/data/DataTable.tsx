import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "../Icon";

export interface Kolom<T> {
  kunci: keyof T & string;
  judul: string;
  numerik?: boolean;
  render?: (baris: T) => ReactNode;
}

interface Props<T> {
  kolom: Kolom<T>[];
  data: T[];
  cariPada: (keyof T & string)[];
  kosong?: { judul: string; keterangan: string };
}

/**
 * Tabel dengan pencarian dan pengurutan.
 *
 * Penyaringan dan pengurutan dikerjakan di klien. Itu keputusan sadar untuk
 * skala studio ini — jumlah proyeknya puluhan, bukan puluhan ribu — dan
 * menghindarkan satu perjalanan bolak-balik ke server untuk tiap ketikan.
 * Kalau datanya nanti tumbuh ribuan baris, pemindahannya ke server adalah
 * perubahan di komponen ini saja.
 */
export function DataTable<T extends Record<string, unknown>>({ kolom, data, cariPada, kosong }: Props<T>) {
  const [cari, setCari] = useState("");
  const [urut, setUrut] = useState<{ kunci: string; arah: "asc" | "desc" } | null>(null);

  const hasil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    let out = q
      ? data.filter((b) => cariPada.some((k) => String(b[k] ?? "").toLowerCase().includes(q)))
      : [...data];

    if (urut) {
      out.sort((a, b) => {
        const x = a[urut.kunci];
        const y = b[urut.kunci];
        const n = typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x ?? "").localeCompare(String(y ?? ""), "id");
        return urut.arah === "asc" ? n : -n;
      });
    }
    return out;
  }, [data, cari, urut, cariPada]);

  function toggleUrut(kunci: string) {
    setUrut((cur) =>
      cur?.kunci !== kunci
        ? { kunci, arah: "asc" }
        : cur.arah === "asc"
          ? { kunci, arah: "desc" }
          : null,
    );
  }

  return (
    <div className="dt">
      <div className="dt__toolbar">
        <div className="dt__search">
          <span className="dt__search-icon"><Icon name="search" size={18} /></span>
          <input
            className="input"
            type="search"
            placeholder="Cari proyek, lokasi, atau tahun…"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            aria-label="Cari dalam tabel"
          />
        </div>
        <div className="dt__meta">
          <span className="dt__count">
            Menampilkan <b>{hasil.length}</b> dari <b>{data.length}</b> proyek
          </span>
          <button type="button" className="btn btn--secondary btn--sm">
            <Icon name="upload" size={14} />Ekspor
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {kolom.map((k) => {
                const aktif = urut?.kunci === k.kunci;
                const sort = aktif ? (urut!.arah === "asc" ? "ascending" : "descending") : "none";
                return (
                  <th key={k.kunci} className={k.numerik ? "table__num" : undefined} aria-sort={sort}>
                    <button type="button" className="table__sort" aria-sort={sort} onClick={() => toggleUrut(k.kunci)}>
                      {k.judul}
                      {aktif && (
                        <span className="table__sort-icon"><Icon name="chevronDown" size={13} /></span>
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {hasil.length === 0 ? (
              <tr>
                <td colSpan={kolom.length}>
                  <div className="dt__empty">
                    <span className="icon-tile"><Icon name="search" size={20} /></span>
                    <span className="t-subheading">{kosong?.judul ?? "Tidak ada hasil"}</span>
                    <span className="t-muted">{kosong?.keterangan ?? "Coba kata kunci lain."}</span>
                  </div>
                </td>
              </tr>
            ) : (
              hasil.map((baris, i) => (
                <tr key={i}>
                  {kolom.map((k) => (
                    <td key={k.kunci} className={k.numerik ? "table__num" : undefined}>
                      {k.render ? k.render(baris) : String(baris[k.kunci] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
