import { useEffect, useState } from "react";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { Tombol } from "../kit/Tombol";
import { Isian } from "../kit/Isian";
import { Ikon } from "../kit/Ikon";
import { ImageSquare } from "../kit/ikon";
import { HalamanSitus, PenandaSimpan, KepalaBagian } from "./situsKit";
import {
  ambilSettings,
  simpanSettings,
  mintaUrlUnggahLogo,
  ZONA_WAKTU,
  bacaCache,
  tulisCache,
  type StudioSettings,
} from "../../lib/admin";
import { useCegahPindah } from "../../lib/cegahPindah";

/* =============================================================================
   Info Studio — nama, kontak, alamat, zona waktu, dan logo studio.

   Dari SettingsForm lama, alasannya tetap:
   - Empat isian WAJIB menahan tombol Simpan selama masih kosong.
   - Hanya kolom yang berubah yang dikirim.
   - Logo diunggah lebih dulu, lalu kuncinya baru berlaku saat Simpan —
     melepas logo juga baru berlaku saat Simpan, jadi masih bisa dibatalkan.
   - Zona waktu tiga pilihan berdampingan, bukan dropdown: pilihannya hanya
     tiga dan tidak akan bertambah.
   - Hanya master admin yang boleh membuka halaman ini.
   ============================================================================= */

type Draf = Partial<StudioSettings>;
type Kunci = keyof StudioSettings;

const TIPE_LOGO = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAKS_LOGO = 2 * 1024 * 1024;
const WAJIB: Kunci[] = ["studioName", "city", "email", "phone"];
const LABEL_WAJIB: Partial<Record<Kunci, string>> = {
  studioName: "nama studio",
  city: "kota",
  email: "email",
  phone: "telepon",
};

function Isi() {
  const toast = useToast();
  const [asli, setAsli] = useState<StudioSettings | null>(() => bacaCache<StudioSettings>("settings"));
  const [draf, setDraf] = useState<Draf>({});
  const [galat, setGalat] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [pratinjau, setPratinjau] = useState<string | null>(null);
  const [mengunggah, setMengunggah] = useState(false);
  const [diseret, setDiseret] = useState(false);

  useEffect(() => {
    ambilSettings()
      .then((d) => {
        tulisCache("settings", d);
        setAsli(d);
      })
      .catch((e) => setGalat((e as Error).message));
  }, []);

  const berubah = (Object.keys(draf) as Kunci[]).filter((k) => draf[k] !== asli?.[k]);
  useCegahPindah(berubah.length > 0);

  const nilai = (k: Kunci) => String((k in draf ? draf[k] : asli?.[k]) ?? "");
  const set = (k: Kunci, v: unknown) => setDraf((d) => ({ ...d, [k]: v }));
  const kosong = WAJIB.filter((k) => !nilai(k).trim());

  async function simpan() {
    if (!asli || berubah.length === 0 || kosong.length) return;
    setMenyimpan(true);
    try {
      const patch: Record<string, unknown> = {};
      for (const k of berubah) patch[k] = draf[k];
      await simpanSettings(patch);
      setAsli({ ...asli, ...draf, ...(pratinjau ? { logoUrl: pratinjau } : {}) } as StudioSettings);
      setDraf({});
      toast({ judul: "Info studio disimpan", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenyimpan(false);
    }
  }

  async function prosesLogo(f: File) {
    if (!TIPE_LOGO.has(f.type)) {
      toast({ judul: "Format tidak didukung", keterangan: "Pakai PNG, JPG, atau WebP.", nada: "gagal" });
      return;
    }
    if (f.size > MAKS_LOGO) {
      toast({ judul: "Berkas terlalu besar", keterangan: "Maksimal 2 MB.", nada: "gagal" });
      return;
    }
    setMengunggah(true);
    try {
      const target = await mintaUrlUnggahLogo(f.type);
      const res = await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": f.type }, body: f });
      if (!res.ok) throw new Error(`Penyimpanan menolak berkas (${res.status})`);
      set("logoKey", target.key);
      setPratinjau((l) => {
        if (l) URL.revokeObjectURL(l);
        return URL.createObjectURL(f);
      });
      toast({ judul: "Logo terunggah", keterangan: "Tekan Simpan untuk memasangnya.", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal mengunggah", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMengunggah(false);
    }
  }

  if (galat) return <p className="pf__kosong">Gagal memuat info studio: {galat}</p>;
  if (!asli) return <div className="pas pas--rangka" aria-busy="true" />;

  const logoDilepas = "logoKey" in draf && draf.logoKey === null;
  const logo = pratinjau ?? (logoDilepas ? null : asli.logoUrl ?? null);
  const zona = nilai("timezone") || "Asia/Jakarta";

  return (
    <HalamanSitus
      lengkap={kosong.length === 0}
      status={kosong.length === 0 ? "Isian wajib lengkap" : `${kosong.length} isian wajib kosong`}
      tautan="/kontak/"
      tautanLabel="Lihat halaman Kontak"
      fakta={[
        { label: "Logo", nilai: logo ? "Terpasang" : "Belum ada" },
        { label: "Zona waktu", nilai: ZONA_WAKTU.find((z) => z.id === zona)?.label ?? "WIB" },
      ]}
      aksi={
        <>
          <Tombol ukuran="large" jenis="primary" disabled={berubah.length === 0 || kosong.length > 0 || menyimpan} onClick={simpan}>
            {menyimpan ? "Menyimpan…" : "Simpan perubahan"}
          </Tombol>
          <PenandaSimpan
            n={kosong.length || berubah.length}
            teks={kosong.length ? `Isi dulu: ${kosong.map((k) => LABEL_WAJIB[k]).join(", ")}.` : undefined}
          />
          {berubah.length > 0 && (
            <button
              type="button"
              className="pf__kosongkan situs__batal"
              onClick={() => {
                setDraf({});
                setPratinjau((l) => {
                  if (l) URL.revokeObjectURL(l);
                  return null;
                });
              }}
            >
              Batalkan perubahan
            </button>
          )}
        </>
      }
    >
      <section className="pf__bagian">
        <KepalaBagian judul="Logo studio" kanan="Tampil di rel samping panel dan di situs" />
        <div className="is-logo">
          <span className="is-logo__kotak">
            {logo ? <img src={logo} alt="Logo studio" /> : <Ikon ikon={ImageSquare} ukuran={32} />}
          </span>
          <label
            className="pf__seret is-logo__seret"
            data-diseret={diseret || undefined}
            onDragOver={(e) => {
              e.preventDefault();
              setDiseret(true);
            }}
            onDragLeave={() => setDiseret(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDiseret(false);
              const f = e.dataTransfer.files?.[0];
              if (f) prosesLogo(f);
            }}
          >
            <b>{mengunggah ? "Mengunggah…" : logo ? "Tarik logo baru ke sini, atau klik untuk mengganti" : "Tarik logo ke sini, atau klik untuk memilih"}</b>
            <small>PNG, JPG, atau WebP · maksimal 2 MB · persegi lebih baik</small>
            <input
              type="file"
              className="sr-only"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Pilih berkas logo studio"
              disabled={mengunggah}
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (f) prosesLogo(f);
              }}
            />
          </label>
        </div>
        {logo && (
          <button
            type="button"
            className="pas__hapus situs__batal"
            onClick={() => {
              setPratinjau((l) => {
                if (l) URL.revokeObjectURL(l);
                return null;
              });
              set("logoKey", null);
              toast({ judul: "Logo dilepas", keterangan: "Tekan Simpan untuk menerapkannya.", nada: "sukses" });
            }}
          >
            Lepas logo
          </button>
        )}
      </section>

      <section className="pf__bagian">
        <KepalaBagian judul="Detail studio" kanan="Bertanda * wajib" />
        <div className="pas__kisi">
          <Isian label="Nama studio *" value={nilai("studioName")} onChange={(e) => set("studioName", e.currentTarget.value)} />
          <Isian label="Kota *" value={nilai("city")} onChange={(e) => set("city", e.currentTarget.value)} />
          <Isian label="Email *" type="email" value={nilai("email")} onChange={(e) => set("email", e.currentTarget.value)} />
          <Isian
            label="Telepon/WhatsApp *"
            type="tel"
            inputMode="tel"
            value={nilai("phone")}
            onChange={(e) => set("phone", e.currentTarget.value)}
          />
          <Isian
            label="Tagline"
            className="pas__lebar"
            value={nilai("tagline")}
            onChange={(e) => set("tagline", e.currentTarget.value)}
            bantu="Keterangan singkat, kalau diisi."
          />
        </div>
        <label className="k-isian pas__lebar">
          <span className="k-isian__label">Alamat</span>
          <textarea className="pas__area" rows={3} value={nilai("address")} onChange={(e) => set("address", e.currentTarget.value)} />
        </label>
        <Isian
          label="URL Instagram"
          type="url"
          placeholder="https://instagram.com/…"
          value={nilai("instagramUrl")}
          onChange={(e) => set("instagramUrl", e.currentTarget.value)}
        />
      </section>

      <section className="pf__bagian">
        <KepalaBagian judul="Zona waktu" kanan="Jam dan tanggal di panel admin" />
        <div className="is-zona" role="radiogroup" aria-label="Zona waktu">
          {ZONA_WAKTU.map((z) => (
            <button
              key={z.id}
              type="button"
              role="radio"
              aria-checked={zona === z.id}
              className="is-zona__b"
              onClick={() => set("timezone", z.id)}
            >
              <b>{z.label}</b>
              <span>{z.nama}</span>
              <small>{z.utc}</small>
            </button>
          ))}
        </div>
      </section>
    </HalamanSitus>
  );
}

export function InfoStudioKit() {
  return (
    <RequireAuth masterOnly skeleton={<div className="pas pas--rangka" />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
