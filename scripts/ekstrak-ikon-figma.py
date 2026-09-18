"""Ekstrak tiap grup <g id="Icon/..."> dari ekspor frame Figma jadi SVG 24x24.

Koordinat path TIDAK disentuh sama sekali — yang disetel cuma viewBox-nya,
dipusatkan pada titik tengah gambar. Menulis ulang koordinat berarti
memperkenalkan pembulatan; menggeser viewBox tidak.
"""
import xml.etree.ElementTree as ET, re, pathlib, sys
from collections import Counter

NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)
Q = "{%s}" % NS
NUM = re.compile(r"-?\d*\.?\d+(?:[eE][-+]?\d+)?")
ARITY = {"M": 2, "L": 2, "C": 6, "H": 1, "V": 1, "Z": 0}

def bbox_d(d):
    xs, ys, cx, cy = [], [], 0.0, 0.0
    for cmd, args in re.findall(r"([MLCHVZ])([^MLCHVZ]*)", d):
        n = [float(v) for v in NUM.findall(args)]
        k = ARITY[cmd]
        if k == 0:
            continue
        for i in range(0, len(n) - k + 1, k):
            g = n[i:i + k]
            if cmd in ("M", "L"):
                cx, cy = g[0], g[1]; xs.append(cx); ys.append(cy)
            elif cmd == "C":
                xs += [g[0], g[2], g[4]]; ys += [g[1], g[3], g[5]]; cx, cy = g[4], g[5]
            elif cmd == "H":
                cx = g[0]; xs.append(cx); ys.append(cy)
            elif cmd == "V":
                cy = g[0]; ys.append(cy); xs.append(cx)
    return (min(xs), min(ys), max(xs), max(ys)) if xs else None

def bbox_g(el):
    b = None
    for p in el.iter():
        q = None
        if p.tag == Q + "path" and p.get("d"):
            q = bbox_d(p.get("d"))
        elif p.tag == Q + "rect":
            x, y = float(p.get("x", 0)), float(p.get("y", 0))
            q = (x, y, x + float(p.get("width", 0)), y + float(p.get("height", 0)))
        elif p.tag == Q + "circle":
            x, y, r = float(p.get("cx", 0)), float(p.get("cy", 0)), float(p.get("r", 0))
            q = (x - r, y - r, x + r, y + r)
        if q:
            b = q if b is None else (min(b[0], q[0]), min(b[1], q[1]), max(b[2], q[2]), max(b[3], q[3]))
    return b

KELUAR = pathlib.Path("/home/user/pahlevidirgadesignarchitectureweb/apps/web/src/assets/figma/ikon")
SUMBER = pathlib.Path("/home/user/pahlevidirgadesignarchitectureweb/apps/web/src/assets/figma/style")

terkumpul, lewat, bentrok = {}, [], []

def urutan(p):
    # Element lebih dulu: di sana ikonnya berukuran master.
    return (0 if p.stem == "Element" else 1, p.stem)

for berkas in sorted(SUMBER.glob("*.svg"), key=urutan):
    root = ET.parse(berkas).getroot()
    for el in root.iter():
        i = el.get("id", "")
        if not i.startswith("Icon/") or el.tag != Q + "g":
            continue
        # Buang akhiran _2, _13 yang ditambahkan Figma saat nama berulang.
        nama = re.sub(r"_\d+$", "", i)
        b = bbox_g(el)
        if b is None:
            continue
        w, h = b[2] - b[0], b[3] - b[1]
        # Grup WADAH (mis. "Icon/Navs", "Icon/System") memuat puluhan ikon dan
        # lebarnya ratusan piksel. Ambang 40px memisahkannya dari ikon tunggal
        # tanpa menyentuh ikon terbesar sekalipun (terukur maks 30px).
        if w > 40 or h > 40:
            lewat.append((nama, round(w), round(h)))
            continue
        if nama in terkumpul:
            bentrok.append(nama)
            lama = terkumpul[nama]
            if max(w, h) <= max(lama[4], lama[5]):
                continue  # yang tersimpan sudah lebih besar
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        isi = "".join(ET.tostring(c, encoding="unicode") for c in el)
        isi = re.sub(r'\sxmlns(:\w+)?="[^"]*"', "", isi)
        terkumpul[nama] = (cx, cy, isi, berkas.stem, round(w, 1), round(h, 1))

# Ukuran bingkai: 24x24, angka komponen ikon Coinest. Dibuktikan dari kisi —
# ikon nav berjarak 48px pusat-ke-pusat dengan sumbu tegak yang sama persis.
SISI = 24.0

for nama, (cx, cy, isi, asal, w, h) in sorted(terkumpul.items()):
    # Warna DIGANTI currentColor supaya ikon ikut warna teks di sekitarnya.
    # Yang diganti hanya warna tinta ikon Coinest (hitam, hijau tua, abu);
    # warna lain dibiarkan — itu lambang berwarna, bukan ikon.
    badan = isi
    for warna in ("#242E2C", "#242e2c", "#1E4841", "#1e4841", "#6B7271", "#6b7271"):
        badan = badan.replace(f'fill="{warna}"', 'fill="currentColor"')
        badan = badan.replace(f'stroke="{warna}"', 'stroke="currentColor"')
    vb = f"{cx - SISI/2:g} {cy - SISI/2:g} {SISI:g} {SISI:g}"
    berkas = KELUAR / (nama.replace("Icon/", "").replace("/", "-") + ".svg")
    berkas.write_text(
        f'<svg xmlns="{NS}" width="24" height="24" viewBox="{vb}" fill="none" '
        f'data-figma="{nama}" data-asal="{asal}">{badan}</svg>\n'
    )

print(f"ikon tertulis : {len(terkumpul)}")
print(f"grup wadah dilewati: {len(lewat)} -> {sorted(set(n for n,_,_ in lewat))[:8]}")
print(f"nama berulang dilewati: {len(bentrok)}")
sisa = Counter(v[3] for v in terkumpul.values())
print("asal berkas:", sisa.most_common())
