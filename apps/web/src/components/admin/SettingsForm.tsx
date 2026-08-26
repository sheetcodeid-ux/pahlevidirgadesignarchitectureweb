import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { ambilSettings, simpanSettings, mintaUrlUnggahLogo, type StudioSettings } from "../../lib/admin";

type Draf = Partial<StudioSettings>;

const TIPE_LOGO_DIIZINKAN = new Set(["image/png", "image/jpeg", "image/webp"]);
const UKURAN_LOGO_MAKS = 2 * 1024 * 1024;

/**
 * Pasangan pendek yang ditampilkan berdampingan — dua kolom di layar lebar.
 * Elemen ketiga menandai field wajib; tandanya bukan sekadar hiasan —
 * WAJIB di bawah menahan tombol Simpan selama masih ada yang kosong.
 */
const PASANGAN: [keyof StudioSettings, string, boolean?][][] = [
  [["studioName", "Nama studio", true], ["city", "Kota", true]],
  [["email", "Email", true], ["phone", "Telepon/WhatsApp", true]],
];

/** Field yang harus terisi sebelum perubahan boleh disimpan. */
const WAJIB: (keyof StudioSettings)[] = ["studioName", "city", "email", "phone"];

/** Field selebar penuh, di bawah pasangan di atas. */
const PENUH: [keyof StudioSettings, string, string?][] = [
  ["tagline", "Tagline", "Ditampilkan sebagai keterangan singkat, kalau diisi."],
  ["address", "Alamat"],
  ["instagramUrl", "URL Instagram"],
];

function Isi() {
  const toast = useToast();
  const [asli, setAsli] = useState<StudioSettings | null>(null);
  const [draf, setDraf] = useState<Draf>({});
  const [galat, setGalat] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const [mengunggahLogo, setMengunggahLogo] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileLogo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ambilSettings().then(setAsli).catch((e) => setGalat((e as Error).message));
  }, []);

  const berubah = Object.keys(draf).filter(
    (k) => draf[k as keyof Draf] !== asli?.[k as keyof StudioSettings],
  );
  const adaPerubahan = berubah.length > 0;

  const nilai = (kunci: keyof StudioSettings): string =>
    String((kunci in draf ? draf[kunci] : asli?.[kunci]) ?? "");

  const kosong = (kunci: keyof StudioSettings) =>
    WAJIB.includes(kunci) && nilai(kunci).trim() === "";
  const adaKosong = WAJIB.some(kosong);

  async function simpan() {
    if (!asli || !adaPerubahan || adaKosong) return;
    setMenyimpan(true);
    try {
      const patch: Record<string, unknown> = {};
      berubah.forEach((k) => { patch[k] = draf[k as keyof Draf]; });
      await simpanSettings(patch);
      setAsli({ ...asli, ...draf } as StudioSettings);
      setDraf({});
      toast({ judul: "Info studio disimpan", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenyimpan(false);
    }
  }

  async function prosesLogo(f: File) {
    if (!TIPE_LOGO_DIIZINKAN.has(f.type)) {
      toast({ judul: "Format tidak didukung", keterangan: "Pakai PNG, JPG, atau WEBP.", nada: "gagal" });
      return;
    }
    if (f.size > UKURAN_LOGO_MAKS) {
      toast({ judul: "Berkas terlalu besar", keterangan: "Maksimum 2MB.", nada: "gagal" });
      return;
    }

    setMengunggahLogo(true);
    try {
      const target = await mintaUrlUnggahLogo(f.type);
      const res = await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": f.type }, body: f });
      if (!res.ok) throw new Error(`Penyimpanan menolak berkas (${res.status})`);

      setDraf((d) => ({ ...d, logoKey: target.key }));
      setPreviewLogo((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(f); });
      toast({ judul: "Logo terunggah", keterangan: "Tekan Simpan untuk menerapkannya.", nada: "sukses" });
    } catch (e) {
      toast({
        judul: "Gagal mengunggah",
        keterangan: `${(e as Error).message}. Penyimpanan R2 mungkin belum dikonfigurasi.`,
        nada: "gagal",
      });
    } finally {
      setMengunggahLogo(false);
    }
  }

  if (galat) {
    return (
      <div className="empty">
        <span className="icon-tile"><Icon name="alert" size={20} /></span>
        <span className="t-subheading">{galat}</span>
      </div>
    );
  }

  if (!asli) {
    return <div className="stack">{[0, 1].map((i) => <span key={i} className="skeleton" style={{ height: "4rem" }} />)}</div>;
  }

  const logoSrc = previewLogo ?? asli.logoUrl ?? null;

  return (
    <div className="settings-split">
      <div className="settings-split__logo">
        <div className="row" style={{ gap: "var(--space-3)", alignItems: "flex-start" }}>
          <span className="icon-tile"><Icon name="image" size={20} /></span>
          <span className="card__titles">
            <span className="t-subheading">Logo studio</span>
            <span className="t-muted">Ditampilkan di sidebar admin dan situs publik.</span>
          </span>
        </div>

        <div className="logo-preview">
          {logoSrc ? (
            <img src={logoSrc} alt="Logo studio" />
          ) : (
            <>
              <Icon name="image" size={40} />
              <span className="t-muted" style={{ fontSize: "var(--text-sm)" }}>Belum ada logo</span>
            </>
          )}
        </div>

        <div
          className="logo-dropzone"
          data-dragging={dragging || undefined}
          role="button"
          tabIndex={0}
          aria-label="Upload logo studio"
          onClick={() => fileLogo.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileLogo.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) prosesLogo(f);
          }}
        >
          <span className="logo-dropzone__icon"><Icon name="upload" size={24} /></span>
          <span className="t-subheading" style={{ fontSize: "var(--text-md)" }}>Upload Logo Anda</span>
          <span className="t-muted" style={{ fontSize: "var(--text-sm)" }}>Drag and drop atau klik dan cari logo anda</span>
          <button
            type="button"
            className="btn btn--secondary"
            disabled={mengunggahLogo}
            onClick={(e) => { e.stopPropagation(); fileLogo.current?.click(); }}
          >
            {mengunggahLogo ? <span className="spinner spinner--sm spinner--on-action" /> : <Icon name="upload" size={16} />}
            Pilih File
          </button>
          <div className="logo-dropzone__hints">
            <span>PNG, JPG, WEBP</span>
            <span>Max 2MB</span>
            <span>Persegi lebih baik</span>
          </div>
        </div>

        <input
          ref={fileLogo}
          type="file"
          className="sr-only"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) prosesLogo(f);
            e.target.value = "";
          }}
        />
      </div>

      <div className="settings-split__form">
        <div className="settings-card">
          <div className="settings-card__head">
            <span className="icon-tile icon-tile--sm"><Icon name="info" size={16} /></span>
            <span className="t-subheading">Detail studio</span>
          </div>

          <div className="settings-card__body stack">
            {PASANGAN.map((pasangan, i) => (
              <div className="spec-grid" key={i}>
                {pasangan.map(([kunci, label, wajib]) => (
                  <div className="field" key={kunci} data-invalid={kosong(kunci) || undefined}>
                    <label className="field__label" htmlFor={`set-${kunci}`}>
                      {label}
                      {wajib && <span className="field__req" aria-hidden="true">*</span>}
                    </label>
                    <input
                      id={`set-${kunci}`}
                      className="input input--panel"
                      required={wajib}
                      aria-invalid={kosong(kunci) || undefined}
                      value={nilai(kunci)}
                      onChange={(e) => setDraf((d) => ({ ...d, [kunci]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            ))}

            {PENUH.map(([kunci, label, bantu]) => (
              <div className="field" key={kunci}>
                <label className="field__label" htmlFor={`set-${kunci}`}>{label}</label>
                {kunci === "address" ? (
                  <textarea
                    id={`set-${kunci}`}
                    className="input input--panel input--area"
                    value={nilai(kunci)}
                    onChange={(e) => setDraf((d) => ({ ...d, [kunci]: e.target.value }))}
                  />
                ) : (
                  <input
                    id={`set-${kunci}`}
                    className="input input--panel"
                    value={nilai(kunci)}
                    onChange={(e) => setDraf((d) => ({ ...d, [kunci]: e.target.value }))}
                  />
                )}
                {bantu && <p className="field__help">{bantu}</p>}
              </div>
            ))}
          </div>

          <div className="settings-card__foot">
            {adaKosong ? (
              <span className="marker" style={{ color: "var(--brand)" }}>
                <Icon name="alert" size={14} />Field bertanda * wajib diisi
              </span>
            ) : adaPerubahan ? (
              <span className="marker marker--warn">
                <span className="marker__dot" />{berubah.length} perubahan belum disimpan
              </span>
            ) : (
              <span className="marker marker--success">
                <Icon name="check" size={14} />Perubahan sudah disimpan
              </span>
            )}
            <button type="button" className="btn btn--primary" disabled={!adaPerubahan || adaKosong || menyimpan} onClick={simpan}>
              {menyimpan ? <span className="spinner spinner--sm spinner--on-action" /> : <Icon name="save" size={16} />}
              Simpan Perubahan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsForm() {
  return (
    <RequireAuth masterOnly>
      <ToastProvider><Isi /></ToastProvider>
    </RequireAuth>
  );
}
