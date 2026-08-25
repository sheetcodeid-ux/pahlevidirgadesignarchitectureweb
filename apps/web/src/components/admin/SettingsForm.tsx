import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { ambilSettings, simpanSettings, type StudioSettings } from "../../lib/admin";

type Draf = Partial<StudioSettings>;

const FIELDS: [keyof StudioSettings, string, string?][] = [
  ["studioName", "Nama studio"],
  ["tagline", "Tagline", "Ditampilkan sebagai keterangan singkat, kalau diisi."],
  ["email", "Email"],
  ["phone", "Telepon/WhatsApp"],
  ["address", "Alamat"],
  ["city", "Kota"],
  ["instagramUrl", "URL Instagram"],
];

function Isi() {
  const toast = useToast();
  const [asli, setAsli] = useState<StudioSettings | null>(null);
  const [draf, setDraf] = useState<Draf>({});
  const [galat, setGalat] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    ambilSettings().then(setAsli).catch((e) => setGalat((e as Error).message));
  }, []);

  const berubah = Object.keys(draf).filter(
    (k) => draf[k as keyof Draf] !== asli?.[k as keyof StudioSettings],
  );
  const adaPerubahan = berubah.length > 0;

  const nilai = (kunci: keyof StudioSettings): string =>
    String((kunci in draf ? draf[kunci] : asli?.[kunci]) ?? "");

  async function simpan() {
    if (!asli || !adaPerubahan) return;
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

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div className="card">
        <div className="card__body">
          <div className="stack">
            {FIELDS.map(([kunci, label, bantu]) => (
              <div className="field" key={kunci}>
                <label className="field__label" htmlFor={`set-${kunci}`}>{label}</label>
                <input
                  id={`set-${kunci}`}
                  className="input"
                  value={nilai(kunci)}
                  onChange={(e) => setDraf((d) => ({ ...d, [kunci]: e.target.value }))}
                />
                {bantu && <p className="field__help">{bantu}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="row row--between">
        {adaPerubahan && (
          <span className="marker marker--warn"><span className="marker__dot" />{berubah.length} perubahan belum disimpan</span>
        )}
        <button type="button" className="btn btn--primary" disabled={!adaPerubahan || menyimpan} onClick={simpan}>
          {menyimpan && <span className="spinner spinner--sm spinner--on-action" />}
          Simpan
        </button>
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
