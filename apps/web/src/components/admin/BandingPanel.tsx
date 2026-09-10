import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import {
  ambilSettings, simpanSettings, mintaUrlUnggahStudio,
  bacaCache, tulisCache, type StudioSettings,
} from "../../lib/admin";

const MAKS_BYTE = 6 * 1024 * 1024;
const JENIS_SAH = ["image/png", "image/jpeg", "image/webp"];

type Sisi = "before" | "after";

function Isi() {
  const toast = useToast();
  const [setelan, setSetelan] = useState<StudioSettings | null>(
    () => bacaCache<StudioSettings>("settings"),
  );
  const [mengunggah, setMengunggah] = useState<Sisi | null>(null);
  const ref = useRef<Record<Sisi, HTMLInputElement | null>>({ before: null, after: null });

  function muat() {
    ambilSettings()
      .then((d) => { tulisCache("settings", d); setSetelan(d); })
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
      toast({ judul: "Foto tersimpan", keterangan: "Tekan Terbitkan di bilah atas supaya tampil di situs.", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal mengunggah", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMengunggah(null);
    }
  }

  async function hapus(sisi: Sisi) {
    try {
      await simpanSettings(sisi === "before" ? { beforeKey: null } : { afterKey: null });
      muat();
    } catch (e) {
      toast({ judul: "Gagal menghapus", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  const url = (sisi: Sisi) => (sisi === "before" ? setelan?.beforeUrl : setelan?.afterUrl) ?? null;
  const lengkap = Boolean(url("before") && url("after"));

  const kartu = (sisi: Sisi, judul: string, bantu: string) => (
    <div className="banding__kartu">
      <span className="banding__judul">{judul}</span>
      <span className="banding__kotak">
        {url(sisi)
          ? <img src={url(sisi) as string} alt="" />
          : <span className="banding__slot"><Icon name="camera" size={22} /></span>}
      </span>
      <p className="field__help">{bantu}</p>
      <div className="row" style={{ gap: "var(--space-2)" }}>
        <input type="file" accept="image/png,image/jpeg,image/webp" hidden
          ref={(el) => { ref.current[sisi] = el; }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) unggah(sisi, f);
          }} />
        <button type="button" className="btn btn--secondary"
          disabled={mengunggah === sisi}
          onClick={() => ref.current[sisi]?.click()}>
          {mengunggah === sisi && <span className="spinner spinner--sm" />}
          <Icon name="upload" size={15} />
          {url(sisi) ? "Ganti foto" : "Unggah foto"}
        </button>
        {url(sisi) && (
          <button type="button" className="btn btn--ghost btn--danger" onClick={() => hapus(sisi)}>
            <Icon name="trash" size={15} /> Hapus
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="listpage">
      <div className="listpage__pad">
        <p className="t-muted" style={{ maxWidth: "58ch", marginTop: 0 }}>
          Foto lokasi <strong>sebelum dibangun</strong> dan <strong>sesudah jadi</strong>,
          tampil sebagai pembanding geser di halaman Studio. Ambil dari titik dan
          sudut yang sama persis — perbandingan dari dua sudut berbeda tidak
          membuktikan apa pun.
        </p>

        {/* Keduanya harus ada supaya pembandingnya berarti. Kalau cuma satu,
            halaman /studio menampilkan dua slot berpola, bukan satu foto
            sendirian — itu keputusan rancangan, bukan kegagalan memuat. */}
        <p className={`isihal__sisa${lengkap ? " isihal__sisa--penuh" : ""}`}>
          <Icon name={lengkap ? "check" : "alert"} size={15} />
          {lengkap
            ? "Keduanya sudah ada — pembandingnya tampil di halaman Studio."
            : "Keduanya harus ada. Selama salah satu kosong, halaman Studio menampilkan dua slot berpola."}
        </p>

        <div className="banding__grid">
          {kartu("before", "Sebelum", "Lokasi apa adanya sebelum pekerjaan dimulai.")}
          {kartu("after", "Sesudah", "Bangunan yang sudah jadi, dari titik yang sama.")}
        </div>
      </div>
    </div>
  );
}

export function BandingPanel() {
  return (
    <RequireAuth>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
