"""Ubah 179 SVG hasil ekstraksi jadi satu modul TypeScript.

Dijalankan dari akar repo:  python3 scripts/buat-ikon-ts.py

Tiap ikon jadi `export const` TERSENDIRI, bukan satu objek besar berisi
semuanya. Bedanya menentukan: objek literal tidak bisa di-tree-shake, jadi
halaman yang memakai enam ikon akan tetap mengangkut ketujuh ratus kilobyte
milik seluruh 179. Export terpisah membuat bundler membuang yang tidak
dipakai.

Berkasnya HASIL GENERATE — ubah ekstraksinya, lalu jalankan skrip ini;
jangan menyunting hasilnya.
"""
import re
import pathlib
import xml.etree.ElementTree as ET

AKAR = pathlib.Path(__file__).resolve().parent.parent
MASUK = AKAR / "apps/web/src/assets/figma/ikon"
KELUAR = AKAR / "apps/web/src/components/kit/ikon/daftar.ts"
Q = "{http://www.w3.org/2000/svg}"


def nama_ts(stem: str) -> str:
    """Nav-Coins -> NavCoins. Angka di depan tidak ada, jadi tidak perlu dijaga."""
    return re.sub(r"[^A-Za-z0-9]", "", stem)


def isi_svg(teks: str) -> str:
    """Ambil isi <svg>…</svg> apa adanya, tanpa atribut id yang tidak dipakai."""
    dalam = teks[teks.index(">", teks.index("<svg")) + 1: teks.rindex("</svg>")]
    dalam = re.sub(r'\sid="[^"]*"', "", dalam)
    dalam = re.sub(r"\s+", " ", dalam).strip()
    return dalam


def main():
    KELUAR.parent.mkdir(parents=True, exist_ok=True)
    baris = [
        "/* BERKAS HASIL GENERATE — jangan disunting.",
        " * Sumbernya apps/web/src/assets/figma/ikon/*.svg (ekspor Figma pemilik).",
        " * Buat ulang dengan: python3 scripts/buat-ikon-ts.py",
        " */",
        "",
        "export interface DataIkon {",
        "  /** viewBox asli dari Figma — koordinat path tidak pernah ditulis ulang. */",
        "  readonly vb: string;",
        "  /** Isi <svg> apa adanya. Warna tinta Coinest sudah jadi currentColor. */",
        "  readonly isi: string;",
        "}",
        "",
    ]
    n = 0
    daftar = []
    for f in sorted(MASUK.glob("*.svg")):
        r = ET.parse(f).getroot()
        nama = nama_ts(f.stem)
        isi = isi_svg(f.read_text()).replace("\\", "\\\\").replace('"', '\\"')
        baris.append(f'export const {nama}: DataIkon = {{ vb: "{r.get("viewBox")}", isi: "{isi}" }};')
        daftar.append((nama, f.stem))
        n += 1

    baris += [
        "",
        "/** Seluruh ikon, untuk halaman galeri saja.",
        " * Jangan diimpor dari halaman biasa: menyebut objek ini mematikan",
        " * tree-shaking dan menarik ketujuh ratus kilobyte ikon sekaligus. */",
        "export const SEMUA_IKON: ReadonlyArray<readonly [string, DataIkon]> = [",
    ]
    baris += [f'  ["{asli}", {nama}],' for nama, asli in daftar]
    baris.append("];")
    baris.append("")

    KELUAR.write_text("\n".join(baris))
    print(f"ikon tertulis: {n} -> {KELUAR.relative_to(AKAR)}")
    print(f"ukuran       : {KELUAR.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
