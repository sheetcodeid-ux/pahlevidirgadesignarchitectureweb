"""Buktikan angka di wireframe masih sama dengan framenya.

    python3 scripts/periksa-wireframe.py

Wireframe-nya digambar dari angka yang saya salin tangan dari ekspor SVG.
Salinan tangan menyimpang — itu bukan kemungkinan, itu kepastian, dan yang
paling berbahaya adalah menyimpang DIAM-DIAM: kerangkanya tetap tergambar
rapi, cuma tidak lagi menggambarkan framenya.

Skrip ini membaca ulang SVG-nya, mencari layer yang namanya disebut di
`buat-wireframe.py`, dan membandingkan keempat angkanya. Toleransi 1px —
Figma menulis setengah piksel di banyak tempat karena garisnya mengangkangi
tepi.

Frame `01. Dashboard (v1)` belum diekspor pemilik, jadi tujuh wilayahnya
memang tidak bisa diperiksa; skrip menyebutnya apa adanya, bukan
melewatkannya diam-diam.
"""
import pathlib
import sys
import xml.etree.ElementTree as ET

AKAR = pathlib.Path(__file__).resolve().parent.parent
INTERFACE = AKAR / "apps/web/src/assets/figma/interface"
Q = "{http://www.w3.org/2000/svg}"

sys.path.insert(0, str(AKAR / "scripts"))
from importlib import import_module
_bb = import_module("bbox-svg").bbox_banyak
_wf = import_module("buat-wireframe")

import re


def _geser(el):
    m = re.match(r"translate\(\s*([-\d.]+)[\s,]+([-\d.]+)", el.get("transform") or "")
    return (float(m.group(1)), float(m.group(2))) if m else (0.0, 0.0)


def kotak(el, dx=0.0, dy=0.0):
    gx, gy = _geser(el)
    dx, dy = dx + gx, dy + gy
    b = None
    if el.tag == Q + "path" and el.get("d"):
        q = _bb([el.get("d")])
        if q:
            b = (q[0] + dx, q[1] + dy, q[2] + dx, q[3] + dy)
    elif el.tag in (Q + "circle", Q + "ellipse"):
        cx, cy = float(el.get("cx", 0)) + dx, float(el.get("cy", 0)) + dy
        rx = float(el.get("rx") or el.get("r") or 0)
        ry = float(el.get("ry") or el.get("r") or 0)
        b = (cx - rx, cy - ry, cx + rx, cy + ry)
    elif el.tag == Q + "rect":
        x, y = float(el.get("x", 0)) + dx, float(el.get("y", 0)) + dy
        b = (x, y, x + float(el.get("width", 0)), y + float(el.get("height", 0)))
    for c in el:
        q = kotak(c, dx, dy)
        if q:
            b = q if b is None else (min(b[0], q[0]), min(b[1], q[1]),
                                     max(b[2], q[2]), max(b[3], q[3]))
    return b


def kotak_layer(akar, nama):
    """Kotak absolut layer bernama `nama`, atau None.

    Kalau layer itu punya <rect> LANGSUNG sebagai anak, rect itulah panelnya
    dan itu yang dipakai. Sebabnya: bbox sebuah grup Figma ikut memuat anak
    yang menjulur keluar panelnya — bayangan, tumpukan kartu hias, kadang
    rect klip selebar bingkai. Tanpa aturan ini, empat panel yang sudah benar
    terbaca "selisih 800px" karena yang terukur bukan panelnya melainkan
    seluruh bingkai.
    """
    jalur = []

    def cari(el, dx, dy):
        gx, gy = _geser(el)
        dx, dy = dx + gx, dy + gy
        for c in el:
            if c.get("id") == nama:
                jalur.append(kotak(c, dx, dy))
                return True
            if cari(c, dx, dy):
                return True
        return False

    def cari2(el, dx, dy):
        gx, gy = _geser(el)
        dx, dy = dx + gx, dy + gy
        for c in el:
            if c.get("id") == nama:
                for a in c:
                    if a.tag == Q + "rect":
                        return kotak(a, dx + _geser(c)[0], dy + _geser(c)[1])
                return kotak(c, dx, dy)
            q = cari2(c, dx, dy)
            if q:
                return q
        return None

    return cari2(akar, 0.0, 0.0)


# Nama di wireframe kadang gabungan ("Footer / Pagination") atau bernomor
# ("Card Statistic Invoice 2"). Ini terjemahannya ke id layer Figma.
# Wilayah yang TIDAK punya layer Figma sendiri — angkanya diturunkan dari
# panel di sekitarnya. Dicatat terpisah supaya laporannya jujur: yang tidak
# diperiksa disebut tidak diperiksa, bukan dihitung cocok.
TURUNAN = {
    "Section Spending",   # sisa ruang di bawah Widget Card Details
    "Message",            # panel pesan dikurangi tinggi kepala percakapannya
    "Row 3",              # baris cadangan, belum ada di framenya
}

ALIAS = {
    "Card Statistic Invoice 2": "Card Statistic Invoice_2",
    "Card Statistic Invoice 3": "Card Statistic Invoice_3",
    "Card Statistic 1": "Card Statistic Saving Plans",
    "Card Statistic 2": "Card Statistic Saving Plans_2",
    "Card Statistic 3": "Card Statistic Saving Plans_3",
    "Footer / Section Result": "Section Result",
    "Footer / Pagination": "Pagination",
    "Section My Cards / Header": "Header-Section",
    "Left Section / Transfer List": "Section Transfer List",
    "Row 1": "Row",
    "Row 2": "Row_2",
    "Row 3": "Row_3",
    "Widget Chart": None,          # frame 01 belum diekspor
    # "Transfer Form" dan "Header" masing-masing dipakai DUA kali di framenya
    # — sekali untuk grup luar, sekali untuk isinya. Yang dimaksud wireframe
    # selalu yang dalam.
    "Transfer Form": "Transfer Form_2",
    "Header": "Header_15",
}

BERKAS = {
    "04": "04. Dashboard (v2) - Desktop",
    "07": "07. Transfer - Desktop",
    "10": "10. Payment - Desktop",
    "13": "13. Transactions - Desktop",
    "16": "16. Invoices - Desktop",
    "19": "19. Cards - Desktop",
    "22": "22. Saving Plans - Desktop",
    "25": "25. Investments - Desktop",
    "28": "28. Inbox - Desktop",
    "31": "31. Promos - Desktop",
    "34": "34. Promo Details - Desktop",
    "37": "37. Insights - Desktop",
    "40": "40. Insight Details - Desktop",
}

TOLERANSI = 1.0


def main():
    cocok = beda = lewat = 0
    for h in _wf.HALAMAN:
        berkas = BERKAS.get(h["kunci"])
        if berkas is None:
            print(f"\n## {h['frame']} — TIDAK DIPERIKSA, framenya belum diekspor "
                  f"({len(h['wilayah'])} wilayah)")
            lewat += len(h["wilayah"])
            continue
        akar = ET.parse(INTERFACE / f"{berkas}.svg").getroot()
        print(f"\n## {h['frame']}")
        for nama, x, y, w, hh, _k, _i in h["wilayah"]:
            id_figma = ALIAS.get(nama, nama)
            b = kotak_layer(akar, id_figma) if id_figma else None
            if nama in TURUNAN:
                print(f"  {nama[:38]:38} turunan — tidak ada layer Figma-nya")
                lewat += 1
                continue
            if b is None:
                print(f"  {nama[:38]:38} layer tidak ketemu ({id_figma})")
                lewat += 1
                continue
            fx, fy, fw, fh = b[0], b[1], b[2] - b[0], b[3] - b[1]
            d = [abs(fx - x), abs(fy - y), abs(fw - w), abs(fh - hh)]
            if max(d) <= TOLERANSI:
                cocok += 1
            else:
                beda += 1
                print(f"  {nama[:38]:38} wireframe {x:7.1f},{y:7.1f} {w:7.1f}x{hh:7.1f}"
                      f"   figma {fx:7.1f},{fy:7.1f} {fw:7.1f}x{fh:7.1f}"
                      f"   selisih {max(d):.1f}")
    print(f"\ncocok {cocok}   beda {beda}   tidak bisa diperiksa {lewat}")
    return 1 if beda else 0


if __name__ == "__main__":
    raise SystemExit(main())
