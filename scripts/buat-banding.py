"""Petik acuan Figma untuk tiap komponen jadi modul TypeScript.

    python3 scripts/buat-banding.py

Hasilnya dipakai halaman /admin/kit untuk menempelkan komponen buatan sendiri
BERSEBELAHAN dengan gambar aslinya dari Figma, pada perbesaran yang sama.

Ini bukan hiasan. Mencocokkan angka yang saya ekstrak sendiri tidak
membuktikan apa-apa kalau ekstraksinya yang salah — dan itu sudah terjadi
sekali, waktu 145 ikon terpotong lolos pemeriksaan angka. Yang menemukannya
gambar sumbernya, ditempel berdampingan.
"""
import pathlib
import re
import sys
from collections import Counter

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from importlib import import_module
_pf = import_module("petik-frame")
petik = _pf.petik

AKAR = pathlib.Path(__file__).resolve().parent.parent
KELUAR = AKAR / "apps/web/src/components/kit/banding/figma.ts"

# (kunci, frame, nama layer). Kunci dipakai komponen galeri untuk memasangkan.
PASANGAN = [
    # --- Tombol -------------------------------------------------------------
    ("btn-small-primary-kiri",   "Button", "Size=small, With Icon=Left, Type=Primary"),
    ("btn-small-secondary-kanan", "Button", "Size=small, With Icon=Right, Type=Secondary"),
    ("btn-small-ghost-kosong",   "Button", "Size=small, With Icon=No Icon, Type=Ghost"),
    ("btn-medium-primary-kiri",  "Button", "Size=Medium, With Icon=Left, Type=Primary"),
    ("btn-medium-secondary-kanan", "Button", "Size=Medium, With Icon=Right, Type=Secondary"),
    ("btn-medium-ghost-kosong",  "Button", "Size=Medium, With Icon=No Icon, Type=Ghost"),
    ("btn-medium-primary-dua",   "Button", "Size=Medium, With Icon=Left & Right, Type=Primary"),
    ("btn-large-primary-kiri",   "Button", "Size=Large, With Icon=Left, Type=Primary"),
    ("btn-large-secondary-kanan", "Button", "Size=Large, With Icon=Right, Type=Secondary"),
    ("btn-large-ghost-kosong",   "Button", "Size=Large, With Icon=No Icon, Type=Ghost"),
    ("btn-large-primary-dua",    "Button", "Size=Large, With Icon=Left & Right, Type=Primary"),
    # --- Tombol ikon --------------------------------------------------------
    ("btnikon-xsmall-primary", "Button", "Size=xSmall, Type=Primary"),
    ("btnikon-small-primary",  "Button", "Size=Small, Type=Primary"),
    ("btnikon-medium-primary", "Button", "Size=Medium, Type=Primary"),
    ("btnikon-medium-ghost",   "Button", "Size=Medium, Type=Ghost"),
    ("btnikon-large-primary",  "Button", "Size=Large, Type=Primary"),
    ("btnikon-large-secondary", "Button", "Size=Large, Type=Secondary"),
    # --- Segmen -------------------------------------------------------------
    ("segmen-2", "Button", "Segmentation=2"),
    ("segmen-3", "Button", "Segmentation=3"),
    ("segmen-4", "Button", "Segmentation=4"),
    # --- Tombol nav ---------------------------------------------------------
    ("nav-aktif",     "Button", "Active=True, Type=Default, Level=Menu, Version=Desktop"),
    ("nav-mati",      "Button", "Active=False, Type=Default, Level=Menu, Version=Desktop"),
    ("nav-sub-aktif", "Button", "Active=True, Type=Default, Level=Submenu, Version=Desktop"),
    # --- Lencana ------------------------------------------------------------
    ("lencana-garis-selesai",  "Badges", "State=Completed"),
    ("lencana-garis-menunggu", "Badges", "State=Pending"),
    ("lencana-garis-gagal",    "Badges", "State=Failed"),
    ("lencana-v2-selesai",     "Badges", "State=Completed_2"),
    ("lencana-pejal-selesai",  "Badges", "State=Completed_3"),
    ("lencana-pejal-gagal",    "Badges", "State=Failed_3"),
    ("lencana-pil-lunas",      "Badges", "State=Paid"),
    ("lencana-pil-telat",      "Badges", "State=Overdue"),
    ("lencana-pil-belum",      "Badges", "State=Unpaid"),
    ("angka-18",  "Badges", "Number=True, Size=Medium"),
    ("angka-13",  "Badges", "Number=True, Size=Default"),
    ("titik-10",  "Badges", "Number=False, Size=Medium"),
    ("titik-8",   "Badges", "Number=False, Size=Default"),
    # --- Remah & paginasi ---------------------------------------------------
    ("remah-2",         "Breadcrumb", "Level=2"),
    ("paginasi-default", "Pagination", "Version=Default"),
    ("paginasi-ponsel",  "Pagination", "Version=Mobile"),
    # --- Isian --------------------------------------------------------------
    ("cari-large",  "Forms", "Size=Large"),
    ("cari-medium", "Forms", "Size=Medium"),
    ("cari-small",  "Forms", "Size=Small"),
    ("isian-large", "Forms", "Size=Large, Type=Default"),
    ("centang-13",  "Forms", "State=Checked, Size=Default"),
    ("centang-17",  "Forms", "State=Checked, Size=Medium"),
    ("centang-23",  "Forms", "State=Checked, Size=Big"),
    ("sakelar-on",  "Forms", "Active=True, Size=Default"),
    ("sakelar-off", "Forms", "Active=False, Size=Default"),
    # --- Kartu ---------------------------------------------------------------
    ("stat-desktop", "Card", "Version=Desktop"),
    ("kas-gelap",    "Card", "Property 1=True"),
    ("kas-terang",   "Card", "Property 1=False"),
]


def warna_layer(svg: str):
    """Warna yang dipakai sebuah potongan frame, urut dari yang paling sering.

    Diambil dari atribut fill dan stroke apa adanya. "none" dan warna anotasi
    Figma (#9747FF, yang dipakai untuk menandai batas komponen dan bukan
    bagian dari desainnya) dibuang.
    """
    ANOTASI = {"#9747FF"}
    hitung = Counter()
    for m in re.finditer(r'(?:fill|stroke)="([^"]+)"', svg):
        v = m.group(1)
        if v == "none" or v.startswith("url"):
            continue
        v = v.upper() if v.startswith("#") else v
        if v in ANOTASI:
            continue
        hitung[v] += 1
    return [c for c, _ in hitung.most_common()]


def main():
    KELUAR.parent.mkdir(parents=True, exist_ok=True)
    baris = [
        "/* BERKAS HASIL GENERATE — jangan disunting.",
        " * Potongan frame Figma untuk pembanding berdampingan di /admin/kit.",
        " * Buat ulang dengan: python3 scripts/buat-banding.py",
        " */",
        "",
        "export interface AcuanFigma {",
        "  readonly layer: string;",
        "  readonly w: number;",
        "  readonly h: number;",
        "  /** Warna yang benar-benar dipakai layer ini, urut dari yang paling",
        "   *  sering muncul. Dipakai untuk mencocokkan warna, bukan cuma ukuran. */",
        "  readonly warna: readonly string[];",
        "  readonly svg: string;",
        "}",
        "",
        "export const ACUAN: Record<string, AcuanFigma> = {",
    ]
    for kunci, frame, layer in PASANGAN:
        svg, w, h = petik(frame, layer)
        aman = svg.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
        warna = ", ".join(f'"{c}"' for c in warna_layer(svg))
        baris.append(
            f'  "{kunci}": {{ layer: "{frame} / {layer}", w: {w:g}, h: {h:g}, '
            f"warna: [{warna}], svg: `{aman}` }},")
    baris += ["};", ""]
    KELUAR.write_text("\n".join(baris))
    print(f"pasangan: {len(PASANGAN)}  ->  {KELUAR.relative_to(AKAR)}  ({KELUAR.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
