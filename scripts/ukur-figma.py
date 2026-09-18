"""Ukur satu layer di frame Figma — ukuran, warna, radius, jarak.

Dijalankan dari akar repo:

    python3 scripts/ukur-figma.py Button "Size=Medium, With Icon=Left, Type=Primary"
    python3 scripts/ukur-figma.py Button --pohon 3
    python3 scripts/ukur-figma.py Button --cari "Type=Ghost"

Ini pengganti membaca kode acuan Figma lewat connector, yang kuotanya 20
panggilan SEBULAN. Ekspor SVG-nya memuat SELURUH geometri: `<rect>` memberi
ukuran, radius, dan warna latar apa adanya, sementara teks yang di-outline
tetap bisa diukur kotaknya.

Yang TIDAK bisa dibaca dari sini, dan harus datang dari sumber lain:

  - Isi teks dan nama fontnya — teksnya sudah jadi path.
  - Ukuran font. Yang terukur tinggi huruf besar (cap height); ukuran fontnya
    diperkirakan dari itu, dan perkiraan ditandai "~" supaya tidak dikira
    hasil ukuran.
"""
import re
import sys
import pathlib
import xml.etree.ElementTree as ET

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from importlib import import_module
bbox_banyak = import_module("bbox-svg").bbox_banyak

Q = "{http://www.w3.org/2000/svg}"
AKAR = pathlib.Path(__file__).resolve().parent.parent
STYLE = AKAR / "apps/web/src/assets/figma/style"
IKON = AKAR / "apps/web/src/assets/figma/ikon"

# Urbanist: tinggi huruf besar 0,72 em. Dipakai untuk menerka ukuran font dari
# kotak teks yang sudah di-outline. Huruf berekor bawah (g, y, p) membuat
# kotaknya lebih tinggi, jadi angkanya hanya sah untuk baris tanpa ekor.
CAP = 0.72


def muat(nama):
    f = STYLE / f"{nama}.svg"
    if not f.exists():
        sys.exit(f"tidak ada: {f}\nyang ada: " + ", ".join(sorted(p.stem for p in STYLE.glob('*.svg'))))
    return ET.parse(f).getroot()


def cari(el, nama):
    for c in el.iter():
        if c.get("id") == nama:
            return c
    return None


def kotak(el):
    """Kotak gambar sebuah layer, memperhitungkan rect DAN path."""
    b = bbox_banyak([p.get("d") for p in el.iter() if p.tag == Q + "path" and p.get("d")])
    for r in el.iter():
        if r.tag not in (Q + "rect",):
            continue
        x, y = float(r.get("x", 0)), float(r.get("y", 0))
        w, h = float(r.get("width", 0)), float(r.get("height", 0))
        q = (x, y, x + w, y + h)
        b = q if b is None else (min(b[0], q[0]), min(b[1], q[1]), max(b[2], q[2]), max(b[3], q[3]))
    return b


# Lebar gambar tiap ikon pada ukuran MASTER (bingkai 32), dipakai untuk
# menghitung ukuran tampil sebuah instance: instance/master * 32.
_master = {}
def lebar_master(nama):
    if nama not in _master:
        f = IKON / (nama.replace("Icon/", "").replace("/", "-") + ".svg")
        if not f.exists():
            return None
        r = ET.parse(f).getroot()
        b = bbox_banyak([p.get("d") for p in r.iter() if p.tag == Q + "path" and p.get("d")])
        _master[nama] = None if b is None else b[2] - b[0]
    return _master[nama]


def rapi(v):
    return f"{v:g}"


def lapor(el, asal=None, d=0, out=None):
    """Cetak geometri sebuah layer, beserta anak-anaknya."""
    pad = "  " * d
    ident = el.get("id") or ""

    if el.tag == Q + "rect":
        x, y = float(el.get("x", 0)), float(el.get("y", 0))
        w, h = float(el.get("width", 0)), float(el.get("height", 0))
        bits = [f"{rapi(w)}x{rapi(h)}"]
        if el.get("rx"):
            bits.append(f"radius {el.get('rx')}")
        if el.get("fill") and el.get("fill") != "none":
            bits.append(f"latar {el.get('fill')}")
        if el.get("stroke"):
            bits.append(f"garis {el.get('stroke')} {el.get('stroke-width', '1')}px")
        rel = ""
        if asal:
            rel = f"  [+{rapi(x - asal[0])},+{rapi(y - asal[1])}]"
        print(f"{pad}kotak  {'  '.join(bits)}{rel}")
        return

    if ident.startswith("Icon/"):
        b = kotak(el)
        # Figma menambah akhiran _12 saat nama berulang; buang untuk mencari master.
        polos = re.sub(r"_\d+$", "", ident)
        m = lebar_master(polos)
        ukur = f"{rapi(round((b[2]-b[0]) / m * 32, 2))}px" if m else "?"
        rel = f"  [+{rapi(b[0]-asal[0])},+{rapi(b[1]-asal[1])}]" if asal else ""
        print(f"{pad}ikon   {polos}  tampil ~{ukur}{rel}")
        return

    if ident.startswith("Text") or ident.startswith("Label"):
        b = kotak(el)
        if b:
            h = b[3] - b[1]
            rel = f"  [+{rapi(b[0]-asal[0])},+{rapi(b[1]-asal[1])}]" if asal else ""
            print(f"{pad}teks   lebar {rapi(round(b[2]-b[0],2))}  tinggi-huruf {rapi(round(h,2))}"
                  f"  font ~{rapi(round(h/CAP))}px{rel}")
            return

    if ident:
        b = kotak(el)
        uk = f"  {rapi(round(b[2]-b[0],2))}x{rapi(round(b[3]-b[1],2))}" if b else ""
        print(f"{pad}{ident}{uk}")
        d += 1
    for c in el:
        lapor(c, asal, d)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    frame = sys.argv[1]
    root = muat(frame)

    if len(sys.argv) < 3:
        print(f"{frame}.svg  {root.get('width')}x{root.get('height')}")
        return

    arg = sys.argv[2]
    if arg == "--pohon":
        maks = int(sys.argv[3]) if len(sys.argv) > 3 else 3
        def jalan(el, d=0):
            for c in el:
                i = c.get("id")
                if c.tag == Q + "g" and i:
                    if d < maks:
                        b = kotak(c)
                        uk = f"  {rapi(round(b[2]-b[0],2))}x{rapi(round(b[3]-b[1],2))}" if b else ""
                        print("  " * d + "- " + i + uk)
                    jalan(c, d + 1)
                else:
                    jalan(c, d)
        jalan(root)
        return

    if arg == "--cari":
        pola = sys.argv[3]
        for c in root.iter():
            if c.get("id") and pola in c.get("id"):
                print(c.get("id"))
        return

    el = cari(root, arg)
    if el is None:
        sys.exit(f'tidak ada layer "{arg}" di {frame}.svg — coba --cari')
    b = kotak(el)
    print(f'{arg}   {rapi(round(b[2]-b[0],2))}x{rapi(round(b[3]-b[1],2))}  di ({rapi(b[0])},{rapi(b[1])})')
    lapor(el, asal=b, d=1)


if __name__ == "__main__":
    main()
