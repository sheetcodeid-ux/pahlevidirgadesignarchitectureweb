import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { CatatanTerbit, SisiSitus } from "./SisiSitus";
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
  /* Posisi gagang pembanding, 0–100. Dipegang di sini, bukan di DOM, supaya
     kedua lapisan foto dan gagangnya digambar dari satu angka yang sama. */
  const [belah, setBelah] = useState(50);
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
    <div className="buatpage buatpage--situs">
      <div className="buatpage__utama">
        {/* Pembanding geser yang BENAR-BENAR bisa digeser, bukan dua foto
            berdampingan. Ini satu-satunya cara memeriksa hal yang menentukan
            apakah pembandingnya berarti: apakah kedua foto diambil dari titik
            dan sudut yang sama. Dua kotak berdampingan tidak pernah bisa
            menjawab itu — garis atap yang meleset setengah meter terlihat
            wajar sampai keduanya ditumpuk.

            Dipakai <input type=range> asli, bukan penyeret buatan sendiri:
            ia sudah bisa dipakai keyboard, sudah dibacakan pembaca layar,
            dan perilakunya tidak bisa rusak diam-diam. */}
        <section className="buat-kartu">
          <h2 className="buat-kartu__judul">Pembanding, seperti di halaman Studio</h2>

          {lengkap ? (
            <>
              <div className="situs-pratinjau bandinguji">
                <img className="bandinguji__bawah" src={url("after") as string} alt="Sesudah" />
                {/* clip-path, BUKAN lebar + overflow:hidden. Dengan lebar,
                    gambar di dalamnya ikut menyempit saat gagangnya digeser —
                    "100%" jadi 100% dari lapisan yang sudah menyempit — dan
                    yang dibandingkan berubah jadi dua gambar berbeda skala.
                    clip-path memotong tanpa menyentuh tata letak isinya. */}
                <span className="bandinguji__atas"
                  style={{ clipPath: `inset(0 ${100 - belah}% 0 0)` }}>
                  <img src={url("before") as string} alt="Sebelum" />
                </span>
                <span className="bandinguji__garis" style={{ left: `${belah}%` }} aria-hidden="true">
                  <i><Icon name="chevronLeft" size={12} /><Icon name="chevronRight" size={12} /></i>
                </span>
                <span className="bandinguji__cap bandinguji__cap--kiri">SEBELUM</span>
                <span className="bandinguji__cap bandinguji__cap--kanan">SESUDAH</span>
                <input
                  className="bandinguji__geser"
                  type="range" min={0} max={100} step={1} value={belah}
                  aria-label="Geser pembanding sebelum dan sesudah"
                  onChange={(e) => setBelah(Number(e.target.value))}
                />
              </div>
              <p className="field__help" style={{ margin: 0 }}>
                Geser gagangnya. Kalau garis atap, tepi jalan, atau tiang tidak
                bertemu saat gagangnya lewat, kedua foto diambil dari titik yang
                berbeda — dan pembandingnya tidak membuktikan apa pun.
              </p>
            </>
          ) : (
            <div className="empty empty--sm">
              <span className="icon-tile"><Icon name="camera" size={20} /></span>
              <span className="t-subheading">Pembanding belum bisa ditampilkan</span>
              <p className="t-muted">
                Keduanya harus ada. Selama salah satu kosong, halaman Studio
                menampilkan dua slot berpola — itu keputusan rancangan, bukan
                kegagalan memuat.
              </p>
            </div>
          )}
        </section>

        <section className="buat-kartu">
          <h2 className="buat-kartu__judul">Kedua foto</h2>
          <p className="field__help" style={{ margin: 0 }}>
            Ambil dari titik dan sudut yang sama persis, idealnya pada jam yang
            sama — perbandingan dari dua sudut berbeda tidak membuktikan apa pun.
          </p>
          <div className="banding__grid">
            {kartu("before", "Sebelum", "Lokasi apa adanya sebelum pekerjaan dimulai.")}
            {kartu("after", "Sesudah", "Bangunan yang sudah jadi, dari titik yang sama.")}
          </div>
        </section>
      </div>

      <SisiSitus
        judul="Sebelum & sesudah"
        letak="Pembanding geser di halaman Studio"
        ikon="camera"
        lengkap={lengkap}
        status={
          lengkap ? "Tampil di situs"
            : url("before") || url("after") ? "Baru satu foto" : "Belum ada foto"
        }
        fakta={[
          { label: "Sebelum", nilai: url("before")
            ? <span className="badge badge--success">Ada</span>
            : <span className="badge badge--warn">Kosong</span> },
          { label: "Sesudah", nilai: url("after")
            ? <span className="badge badge--success">Ada</span>
            : <span className="badge badge--warn">Kosong</span> },
          { label: "Batas berkas", nilai: <span className="t-num">6 MB</span> },
        ]}
        tautan="/studio/"
        tautanLabel="Lihat di halaman Studio"
      >
        <CatatanTerbit />
      </SisiSitus>
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
