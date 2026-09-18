"""Pisahkan tiap ikon Coinest dari ekspor frame Figma jadi SVG tersendiri.

Dijalankan dari akar repo:  python3 scripts/ekstrak-ikon-figma.py

SUMBERNYA apps/web/src/assets/figma/style/*.svg — ekspor frame utuh halaman
"Style & Component" yang dikirim pemilik. Connector Figma TIDAK bisa mengunduh
berkas aset (gateway menolak www.figma.com), jadi ekspor manual itulah satu-
satunya sumber bentuk yang sah. Menggambar ulang dari tangkapan layar tidak
boleh — itu menjiplak, dan tidak akan pernah persis.

Koordinat path TIDAK PERNAH disentuh. Yang disetel hanya viewBox-nya.
Menulis ulang koordinat berarti memperkenalkan pembulatan; menggeser viewBox
tidak.
"""
import re
import sys
import pathlib
import xml.etree.ElementTree as ET
from collections import Counter

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from importlib import import_module
bbox_svg = import_module("bbox-svg")
bbox_banyak = bbox_svg.bbox_banyak

NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)
Q = "{%s}" % NS

AKAR = pathlib.Path(__file__).resolve().parent.parent
SUMBER = AKAR / "apps/web/src/assets/figma/style"
KELUAR = AKAR / "apps/web/src/assets/figma/ikon"

# Sisi bingkai ikon. BUKAN 24 — itu ukuran TAMPIL instance di halaman
# (`size-[24px]` di kode acuan). Master-nya 32, dibuktikan dua cara:
#
#   1. Kisi di frame Element berjarak 48px pusat ke pusat; bingkai 32
#      menyisakan celah 16px, bingkai 24 menyisakan 24px sementara ada
#      gambar selebar 32 yang akan menabrak tetangganya.
#   2. Gambar terlebar terukur 32,01px — persis sisi bingkainya.
#
# Memakai 24 memotong 145 dari 179 ikon, simetris 4px di kiri dan kanan.
SISI = 32.0

# Grup WADAH (kisi berisi puluhan ikon) jauh lebih besar dari ikon tunggal.
# Ambangnya 40: ikon tunggal terbesar 32px, wadah terkecil ratusan piksel.
AMBANG_WADAH = 40

# Warna tinta Coinest diganti currentColor supaya ikon ikut warna teks di
# sekitarnya. Warna lain dibiarkan — itu lambang berwarna, bukan ikon.
TINTA = ("#242E2C", "#1E4841", "#6B7271")


def urutan(p: pathlib.Path):
    """Element.svg lebih dulu: di sana tiap ikon berukuran MASTER.

    Berkas lain memuat instance yang dipakai pada ukuran tampil — caret 14px
    di dalam tombol, panah tren 10px di dalam lencana. Mengambil dari sana
    membuat gambarnya mungil di tengah bingkai.
    """
    return (0 if p.stem == "Element" else 1, p.stem)


def ekstrak():
    terkumpul: dict[str, dict] = {}
    wadah, ulang = [], 0

    for berkas in sorted(SUMBER.glob("*.svg"), key=urutan):
        root = ET.parse(berkas).getroot()
        for el in root.iter():
            ident = el.get("id", "")
            if not ident.startswith("Icon/") or el.tag != Q + "g":
                continue
            # Figma menambah akhiran _2, _13 saat nama layar berulang.
            nama = re.sub(r"_\d+$", "", ident)

            ds = [p.get("d") for p in el.iter() if p.tag == Q + "path" and p.get("d")]
            b = bbox_banyak(ds)
            if b is None:
                continue
            w, h = b[2] - b[0], b[3] - b[1]
            if w > AMBANG_WADAH or h > AMBANG_WADAH:
                wadah.append(nama)
                continue

            lama = terkumpul.get(nama)
            if lama is not None:
                ulang += 1
                # Yang dipakai yang gambarnya paling besar — instance terbesar
                # adalah yang paling dekat ke ukuran master.
                if max(w, h) <= max(lama["w"], lama["h"]):
                    continue

            isi = "".join(ET.tostring(c, encoding="unicode") for c in el)
            isi = re.sub(r'\sxmlns(:\w+)?="[^"]*"', "", isi)
            terkumpul[nama] = {
                "cx": (b[0] + b[2]) / 2, "cy": (b[1] + b[3]) / 2,
                "w": w, "h": h, "isi": isi, "asal": berkas.stem,
            }

    KELUAR.mkdir(parents=True, exist_ok=True)
    for f in KELUAR.glob("*.svg"):
        f.unlink()

    dilebarkan = []
    for nama, d in sorted(terkumpul.items()):
        badan = d["isi"]
        for warna in TINTA:
            for bentuk in (warna, warna.lower()):
                badan = badan.replace(f'fill="{bentuk}"', 'fill="currentColor"')

        # Bingkai dilebarkan HANYA kalau gambarnya memang melampaui 32 —
        # dipotong sedikit pun tidak boleh. Sejauh ini tidak ada yang perlu.
        sisi = SISI
        if max(d["w"], d["h"]) > SISI:
            sisi = max(d["w"], d["h"])
            dilebarkan.append((nama, round(sisi, 2)))

        vb = f'{d["cx"] - sisi/2:g} {d["cy"] - sisi/2:g} {sisi:g} {sisi:g}'
        # width/height SELALU 32 bulat, walau viewBox-nya 32,0005 karena
        # gambarnya melampaui sepersepuluh piksel. Kalau atributnya ikut
        # ditulis "32.0005", `[width="32"]` di CSS tidak cocok dan ikonnya
        # lolos dari penjaga jebakan #7 — dan di lembar uji ia tampil separuh
        # ukuran tetangganya karena penggantinya tidak cocok. Bedanya
        # 0,0016% dan tidak bisa dilihat.
        (KELUAR / (nama.replace("Icon/", "").replace("/", "-") + ".svg")).write_text(
            f'<svg xmlns="{NS}" width="{SISI:g}" height="{SISI:g}" viewBox="{vb}" '
            f'fill="none" data-figma="{nama}" data-asal="{d["asal"]}">{badan}</svg>\n'
        )

    print(f"ikon tertulis        : {len(terkumpul)}")
    print(f"grup wadah dilewati  : {len(wadah)} -> {sorted(set(wadah))}")
    print(f"nama berulang        : {ulang}")
    print(f"asal berkas          : {Counter(d['asal'] for d in terkumpul.values()).most_common()}")
    print(f"bingkai dilebarkan   : {len(dilebarkan)} {dilebarkan}")


if __name__ == "__main__":
    ekstrak()
