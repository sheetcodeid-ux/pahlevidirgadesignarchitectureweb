"""Ubah SVG hasil ekstraksi jadi satu modul TypeScript per ikon.

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
# Satu berkas per ikon. Bundler tidak pernah memecah SATU modul ke beberapa
# chunk: selama seluruh ikon tinggal di daftar.ts, galeri yang menyebut
# SEMUA_IKON membuat seluruh 325 KB-nya jadi chunk bersama yang dimuat SETIAP
# halaman admin yang memakai satu ikon saja. Terukur di build, bukan dugaan.
DATA = AKAR / "apps/web/src/components/kit/ikon/data"
SEMUA = AKAR / "apps/web/src/components/kit/ikon/semua.ts"
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
    DATA.mkdir(parents=True, exist_ok=True)
    for lama in DATA.glob("*.ts"):
        lama.unlink()
    kepala = [
        "/* BERKAS HASIL GENERATE — jangan disunting.",
        " * Sumbernya apps/web/src/assets/figma/ikon/*.svg (ekspor Figma pemilik).",
        " * Buat ulang dengan: python3 scripts/buat-ikon-ts.py",
        " */",
        "",
    ]
    baris = kepala + [
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
        (DATA / f"{nama}.ts").write_text(
            f'import type {{ DataIkon }} from "../daftar";\n'
            f'export const {nama}: DataIkon = {{ vb: "{r.get("viewBox")}", isi: "{isi}" }};\n'
        )
        baris.append(f'export {{ {nama} }} from "./data/{nama}";')
        daftar.append((nama, f.stem))
        n += 1
    baris.append("")
    KELUAR.write_text("\n".join(baris))

    semua = kepala + [
        "/** Seluruh ikon, untuk halaman galeri saja. Sengaja di berkas sendiri:",
        " * menyebut daftar ini menarik semua ikon, dan itu hanya boleh terjadi",
        " * di chunk galeri. */",
        'import type { DataIkon } from "./daftar";',
    ]
    semua += [f'import {{ {nama} }} from "./data/{nama}";' for nama, _ in daftar]
    semua += ["", "export const SEMUA_IKON: ReadonlyArray<readonly [string, DataIkon]> = ["]
    semua += [f'  ["{asli}", {nama}],' for nama, asli in daftar]
    semua += ["];", ""]
    SEMUA.write_text("\n".join(semua))
    print(f"ikon tertulis: {n} -> {DATA.relative_to(AKAR)}/")

if __name__ == "__main__":
    main()
