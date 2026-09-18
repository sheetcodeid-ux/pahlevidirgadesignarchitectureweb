"""Kotak gambar SESUNGGUHNYA untuk path SVG.

Beda dari hull titik kendali: kurva kubik dihitung titik ekstremnya lewat
turunan, jadi kotaknya persis menyentuh gambar. Hull titik kendali SELALU
lebih besar dari gambarnya, dan bedanya tidak simetris — itu yang membuat
pusat hasil hitungan meleset dan sebagian ikon terpotong sebelah.
"""
import re, math

NUM = re.compile(r"-?\d*\.?\d+(?:[eE][-+]?\d+)?")
ARITY = {"M": 2, "L": 2, "C": 6, "H": 1, "V": 1, "Z": 0}


def _kubik_ekstrem(p0, p1, p2, p3):
    """Nilai t di [0,1] tempat turunan kubik bernilai nol, pada satu sumbu."""
    a = -p0 + 3 * p1 - 3 * p2 + p3
    b = 2 * (p0 - 2 * p1 + p2)
    c = p1 - p0
    ts = []
    if abs(a) < 1e-12:
        if abs(b) > 1e-12:
            ts.append(-c / b)
    else:
        d = b * b - 4 * a * c
        if d >= 0:
            r = math.sqrt(d)
            ts += [(-b + r) / (2 * a), (-b - r) / (2 * a)]
    return [t for t in ts if 0 < t < 1]


def _kubik_nilai(p0, p1, p2, p3, t):
    u = 1 - t
    return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3


def bbox(d):
    xs, ys = [], []
    cx = cy = sx = sy = 0.0
    for cmd, args in re.findall(r"([MLCHVZ])([^MLCHVZ]*)", d):
        n = [float(v) for v in NUM.findall(args)]
        k = ARITY[cmd]
        if k == 0:
            cx, cy = sx, sy
            continue
        for i in range(0, len(n) - k + 1, k):
            g = n[i:i + k]
            if cmd == "M":
                cx, cy = g; sx, sy = cx, cy
                xs.append(cx); ys.append(cy)
            elif cmd == "L":
                cx, cy = g; xs.append(cx); ys.append(cy)
            elif cmd == "H":
                cx = g[0]; xs.append(cx); ys.append(cy)
            elif cmd == "V":
                cy = g[0]; xs.append(cx); ys.append(cy)
            elif cmd == "C":
                x1, y1, x2, y2, x3, y3 = g
                xs += [cx, x3]; ys += [cy, y3]
                for t in _kubik_ekstrem(cx, x1, x2, x3):
                    xs.append(_kubik_nilai(cx, x1, x2, x3, t))
                for t in _kubik_ekstrem(cy, y1, y2, y3):
                    ys.append(_kubik_nilai(cy, y1, y2, y3, t))
                cx, cy = x3, y3
    return (min(xs), min(ys), max(xs), max(ys)) if xs else None


def bbox_banyak(ds):
    b = None
    for d in ds:
        q = bbox(d)
        if q is None:
            continue
        b = q if b is None else (min(b[0], q[0]), min(b[1], q[1]), max(b[2], q[2]), max(b[3], q[3]))
    return b
