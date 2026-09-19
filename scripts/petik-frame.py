"""Petik satu layer dari frame Figma jadi SVG berdiri sendiri.

    python3 scripts/petik-frame.py Button "Size=Medium, With Icon=Left, Type=Primary" keluar.svg

Dipakai untuk MEMBANDINGKAN, bukan untuk dipakai di kode: hasilnya ditempel
bersebelahan dengan komponen buatan sendiri pada perbesaran yang sama.

Alasannya satu, dan sudah pernah menggigit: mencocokkan angka yang saya
ekstrak sendiri tidak membuktikan apa-apa kalau ekstraksinya yang salah.
Yang membuktikan cuma gambar sumbernya, ditempel berdampingan. Itu yang
akhirnya menemukan 145 ikon terpotong.

Koordinat path tidak disentuh — yang disetel cuma viewBox-nya, sama seperti
ekstraksi ikon.
"""
import re
import sys
import pathlib
import xml.etree.ElementTree as ET

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from importlib import import_module
bbox_banyak = import_module("bbox-svg").bbox_banyak

NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)
Q = "{%s}" % NS
AKAR = pathlib.Path(__file__).resolve().parent.parent
STYLE = AKAR / "apps/web/src/assets/figma/style"


def _geser(el):
    """Nilai translate() pada sebuah simpul, (0,0) kalau tidak ada."""
    m = re.match(r"translate\(\s*([-\d.]+)[\s,]+([-\d.]+)", el.get("transform") or "")
    return (float(m.group(1)), float(m.group(2))) if m else (0.0, 0.0)


def kotak(el, dx=0.0, dy=0.0):
    """Kotak gambar sebuah layer — rect ikut dihitung, bukan cuma path.

    `transform="translate(...)"` WAJIB diikutkan. Figma memakainya untuk
    menempatkan rect latar alih-alih atribut x dan y, dan mengabaikannya
    membuat panel rel samping terbaca di (0,0) padahal isinya di x68 — jadi
    isinya seolah berada DI LUAR panelnya sendiri. Gambarnya sendiri tetap
    benar karena transform-nya ikut tersalin; yang salah cuma viewBox yang
    dihitung dari kotak ini, dan akibatnya potongannya meleset tanpa satu
    pun tanda. Terukur: rel samping terpotong jadi 228x1110 padahal 192x1034.
    """
    gx, gy = _geser(el)
    dx, dy = dx + gx, dy + gy
    b = None
    if el.tag == Q + "path" and el.get("d"):
        q = bbox_banyak([el.get("d")])
        if q:
            b = (q[0] + dx, q[1] + dy, q[2] + dx, q[3] + dy)
    elif el.tag in (Q + "circle", Q + "ellipse"):
        # <circle> dan <ellipse> sempat tidak dihitung sama sekali, dan itu
        # tidak menimbulkan galat apa pun — kotaknya cuma mengecil diam-diam.
        # Terukur: sel tanggal terpotong jadi 13,04x8,79 (tinta angkanya
        # saja) padahal bulatan latarnya 24x24, jadi perbandingannya
        # melaporkan 57% berbeda untuk komponen yang sebenarnya benar.
        cx, cy = float(el.get("cx", 0)) + dx, float(el.get("cy", 0)) + dy
        rx = float(el.get("rx") or el.get("r") or 0)
        ry = float(el.get("ry") or el.get("r") or 0)
        t = float(el.get("stroke-width", 1)) / 2 if el.get("stroke") else 0
        b = (cx - rx - t, cy - ry - t, cx + rx + t, cy + ry + t)
    elif el.tag == Q + "rect":
        x, y = float(el.get("x", 0)) + dx, float(el.get("y", 0)) + dy
        w, h = float(el.get("width", 0)), float(el.get("height", 0))
        # Garis Figma berpusat di tepi, jadi setengahnya menonjol keluar rect.
        # Bawaan stroke-width di SVG adalah 1, BUKAN 0. Memakai 0 sebagai
        # nilai bawaan membuat kotak varian Ghost terbaca 1px lebih kecil
        # daripada yang benar-benar tergambar, dan selisih itu lalu
        # tampak seperti cacat di komponennya.
        t = float(el.get("stroke-width", 1)) / 2 if el.get("stroke") else 0
        b = (x - t, y - t, x + w + t, y + h + t)
    for c in el:
        q = kotak(c, dx, dy)
        if q:
            b = q if b is None else (min(b[0], q[0]), min(b[1], q[1]), max(b[2], q[2]), max(b[3], q[3]))
    return b


def petik(frame: str, layer: str):
    root = ET.parse(STYLE / f"{frame}.svg").getroot()
    el = next((c for c in root.iter() if c.get("id") == layer), None)
    if el is None:
        sys.exit(f'tidak ada layer "{layer}" di {frame}.svg')
    b = kotak(el)
    isi = "".join(ET.tostring(c, encoding="unicode") for c in el)
    isi = re.sub(r'\sxmlns(:\w+)?="[^"]*"', "", isi)
    w, h = b[2] - b[0], b[3] - b[1]
    return (
        f'<svg xmlns="{NS}" width="{w:g}" height="{h:g}" '
        f'viewBox="{b[0]:g} {b[1]:g} {w:g} {h:g}" fill="none">{isi}</svg>',
        w, h,
    )


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    svg, w, h = petik(sys.argv[1], sys.argv[2])
    tujuan = sys.argv[3] if len(sys.argv) > 3 else None
    if tujuan:
        pathlib.Path(tujuan).write_text(svg)
        print(f"{tujuan}  {w:g}x{h:g}")
    else:
        print(svg)
