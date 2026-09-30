import { useEffect, useState } from "react";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { Lencana } from "../kit/Lencana";
import { Segmen } from "../kit/Segmen";
import { Ikon } from "../kit/Ikon";
import { CaretLeft, CaretRight, ImageSquare } from "../kit/ikon";
import { HalamanSitus, KepalaBagian } from "./situsKit";
import { ambilSettings, simpanSettings, mintaUrlUnggahStudio, bacaCache, tulisCache, type StudioSettings } from "../../lib/admin";

/* =============================================================================
   Sebelum & Sesudah — pembanding geser di halaman /studio.

   Dari BandingPanel lama, alasannya tetap:
   - Pembanding yang BENAR-BENAR bisa digeser, bukan dua foto berdampingan:
     satu-satunya cara memeriksa apakah kedua foto diambil dari titik dan
     sudut yang sama.
   - <input type=range> asli sebagai penggeser — keyboard dan pembaca layar
     ikut, dan tidak bisa rusak diam-diam.
   - Lapisan atas dipotong dengan clip-path, bukan lebar: dengan lebar,
     gambar di dalamnya ikut menyempit dan yang dibandingkan jadi dua skala.
   ============================================================================= */

const MAKS_BYTE = 6 * 1024 * 1024;
const JENIS_SAH = ["image/png", "image/jpeg", "image/webp"];
type Sisi = "before" | "after";

function Isi() {
  const toast = useToast();
  const [setelan, setSetelan] = useState<StudioSettings | null>(() => bacaCache<StudioSettings>("settings"));
  const [mengunggah, setMengunggah] = useState<Sisi | null>(null);
  const [belah, setBelah] = useState(50);

  function muat() {
    ambilSettings()
      .then((d) => {
        tulisCache("settings", d);
        setSetelan(d);
      })
      .catch(() => setSetelan((s) => s ?? null));
  }
  useEffect(muat, []);

  async function unggah(sisi: Sisi, f: File) {
    if (!JENIS_SAH.includes(f.type)) {
      toast({ judul: "Jenis berkas tidak didukung", keterangan: "PNG, JPG, atau WebP.", nada: "gagal" });
      return;
    }
    if (f.size > MAKS_BYTE) {
      toast({ judul: "Berkas terlalu besar", keterangan: "Maksimal 6 MB.", nada: "gagal" });
      return;
    }
    setMengunggah(sisi);
    try {
      const target = await mintaUrlUnggahStudio(f.type);
      const res = await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": f.type }, body: f });
      if (!res.ok) throw new Error(`Penyimpanan menolak berkas (${res.status})`);
      await simpanSettings(sisi === "before" ? { beforeKey: target.key } : { afterKey: target.key });
      muat();
      toast({ judul: "Foto tersimpan", keterangan: "Tekan Terbitkan supaya tampil di situs.", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal mengunggah", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMengunggah(null);
    }
  }

  async function lepas(sisi: Sisi) {
    try {
      await simpanSettings(sisi === "before" ? { beforeKey: null } : { afterKey: null });
      muat();
    } catch (e) {
      toast({ judul: "Gagal melepas foto", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  const url = (sisi: Sisi) => (sisi === "before" ? setelan?.beforeUrl : setelan?.afterUrl) ?? null;
  const lengkap = Boolean(url("before") && url("after"));
  const ada = (url("before") ? 1 : 0) + (url("after") ? 1 : 0);
  const lencana = (sisi: Sisi) => (
    <Lencana bentuk="pejalkecil" nada={url(sisi) ? "selesai" : "menunggu"}>
      {url(sisi) ? "Ada" : "Kosong"}
    </Lencana>
  );

  const kartu = (sisi: Sisi, no: string, judul: string, bantu: string) => (
    <li className="pf__ubin bd-ubin">
      <span className="bd-ubin__foto">
        {url(sisi) ? <img src={url(sisi)!} alt={judul} /> : <Ikon ikon={ImageSquare} ukuran={28} />}
        <span className="lk-ubin__urut">{no}</span>
      </span>
      <span className="lk-ubin__teks">
        <b>
          {judul} {lencana(sisi)}
        </b>
        <small className="bd-ubin__bantu">{bantu}</small>
      </span>
      <div className="pf__ubinaksi">
        <label className={`k-tombol k-tombol--medium ${url(sisi) ? "k-tombol--secondary" : "k-tombol--primary"} pf__unggah`}>
          {mengunggah === sisi ? "Mengunggah…" : url(sisi) ? "Ganti foto" : "Unggah foto"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label={`Pilih foto ${judul.toLowerCase()}`}
            disabled={mengunggah === sisi}
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (f) unggah(sisi, f);
            }}
          />
        </label>
        {url(sisi) && (
          <button type="button" className="pas__hapus bd-ubin__lepas" onClick={() => lepas(sisi)}>
            Lepas
          </button>
        )}
      </div>
    </li>
  );

  return (
    <HalamanSitus
      lengkap={lengkap}
      status={lengkap ? "Tampil di situs" : ada === 1 ? "Baru satu foto" : "Belum ada foto"}
      tautan="/studio/"
      tautanLabel="Lihat di halaman Studio"
      fakta={[
        { label: "Sebelum", nilai: lencana("before") },
        { label: "Sesudah", nilai: lencana("after") },
        { label: "Batas berkas", nilai: "6 MB per foto" },
      ]}
    >
      <section className="pf__bagian">
        <KepalaBagian judul="Pembanding, seperti di halaman Studio" kanan={lengkap ? `${belah}%` : undefined} />
        {lengkap ? (
          <>
            <div className="ih bd">
              <img className="bd__bawah" src={url("after")!} alt="Sesudah" />
              <span className="bd__atas" style={{ clipPath: `inset(0 ${100 - belah}% 0 0)` }}>
                <img src={url("before")!} alt="Sebelum" />
              </span>
              <span className="bd__garis" style={{ left: `${belah}%` }} aria-hidden="true">
                <i>
                  <Ikon ikon={CaretLeft} ukuran={12} />
                  <Ikon ikon={CaretRight} ukuran={12} />
                </i>
              </span>
              <span className="bd__cap bd__cap--kiri">SEBELUM</span>
              <span className="bd__cap bd__cap--kanan">SESUDAH</span>
              <input
                className="bd__geser"
                type="range"
                min={0}
                max={100}
                step={1}
                value={belah}
                aria-label="Geser pembanding sebelum dan sesudah"
                onChange={(e) => setBelah(Number(e.currentTarget.value))}
              />
            </div>
            {/* Tiga loncatan cepat: memeriksa kesejajaran berarti membandingkan
                ujung ke ujung, dan menyeret sampai mentok dua kali tiap
                pemeriksaan adalah pekerjaan yang tidak perlu ada. */}
            <Segmen
              judul="Loncat ke posisi"
              className="bd__loncat"
              nilai={String(belah)}
              onPilih={(v) => setBelah(Number(v))}
              segmen={[
                { nilai: "0", label: "Sesudah penuh" },
                { nilai: "50", label: "Tengah" },
                { nilai: "100", label: "Sebelum penuh" },
              ]}
            />
            <p className="pf__statusket">
              Geser gagangnya. Kalau garis atap, tepi jalan, atau tiang tidak bertemu saat gagangnya lewat, kedua foto
              diambil dari titik yang berbeda — dan pembandingnya tidak membuktikan apa pun.
            </p>
          </>
        ) : (
          <p className="situs__catatan">
            Pembanding baru bisa digambar setelah kedua foto ada. Selama salah satu kosong, halaman Studio menampilkan dua
            slot berpola — itu keputusan rancangan, bukan kegagalan memuat.
          </p>
        )}
      </section>

      <section className="pf__bagian">
        <KepalaBagian judul="Kedua foto" kanan="Dari titik dan sudut yang sama" />
        <ul className="pf__kisi bd-kisi">
          {kartu("before", "01", "Sebelum", "Lokasi apa adanya sebelum pekerjaan dimulai.")}
          {kartu("after", "02", "Sesudah", "Bangunan yang sudah jadi, dari titik yang sama — idealnya pada jam yang sama.")}
        </ul>
      </section>
    </HalamanSitus>
  );
}

export function BandingKit() {
  return (
    <RequireAuth skeleton={<div className="pas pas--rangka" />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
