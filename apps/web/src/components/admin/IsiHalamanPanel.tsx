import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import {
  ambilSettings, simpanSettings, bacaCache, tulisCache, type StudioSettings,
} from "../../lib/admin";

/**
 * Satu panel untuk SEMUA isi halaman publik yang bentuknya sekadar isian
 * teks: empat angka FAQ, lima keterangan halaman privasi, dan dua tahun di
 * identitas studio.
 *
 * Tiga berkas terpisah yang isinya "muat settings, render isian, PATCH
 * settings" akan menyimpang satu sama lain dalam hitungan bulan — satu dapat
 * penanda perubahan-belum-disimpan, satunya tidak; satu memperlakukan string
 * kosong sebagai null, satunya menyimpan string kosong. Bedanya kecil dan
 * tidak pernah terlihat sampai ada yang bertanya kenapa isian yang dikosongkan
 * di satu halaman tetap tampil di situs.
 *
 * Yang membedakan ketiga halaman cuma daftar isiannya, jadi itu yang jadi
 * prop. Sebelum & Sesudah TIDAK memakai ini: isinya unggahan berkas, bukan
 * teks, dan memaksakannya ke sini berarti prop yang cuma dipakai satu
 * pemanggil.
 */
export interface Isian {
  /** Nama field di StudioSettings. Hanya yang bertipe teks atau angka. */
  kunci: KunciTeks;
  label: string;
  /** Kalimat di bawah isian. Menjelaskan DI MANA ia tampil di situs. */
  bantuan: string;
  /** Contoh isian — placeholder, bukan nilai bawaan. */
  contoh?: string;
  /** `tahun` memakai input angka dan disimpan sebagai bilangan. */
  jenis?: "teks" | "tahun" | "panjang";
}

/** Field StudioSettings yang boleh diurus panel ini. */
type KunciTeks =
  | "foundedYear" | "firstCommercialYear"
  | "legalEntity" | "legalAddress" | "retentionMessages"
  | "retentionDocuments" | "governingLaw"
  | "faqTarif" | "faqUangMuka" | "faqLamaKerja" | "faqKunjungan";

function Isi({ isian, catatan }: { isian: Isian[]; catatan?: string }) {
  const toast = useToast();
  const [asli, setAsli] = useState<StudioSettings | null>(
    () => bacaCache<StudioSettings>("settings"),
  );
  const [draf, setDraf] = useState<Partial<Record<KunciTeks, string>>>({});
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    ambilSettings()
      .then((d) => { tulisCache("settings", d); setAsli(d); })
      .catch(() => setAsli((s) => s ?? null));
  }, []);

  /** Nilai yang sedang diketik kalau ada, kalau tidak nilai dari server. */
  const nilai = (k: KunciTeks): string => {
    if (draf[k] !== undefined) return draf[k] as string;
    const v = asli?.[k];
    return v === null || v === undefined ? "" : String(v);
  };

  const berubah = (Object.keys(draf) as KunciTeks[]).filter((k) => {
    const v = asli?.[k];
    const semula = v === null || v === undefined ? "" : String(v);
    return draf[k] !== semula;
  });
  const adaPerubahan = berubah.length > 0;

  async function simpan() {
    if (!adaPerubahan) return;
    setMenyimpan(true);
    try {
      const patch: Partial<StudioSettings> = {};
      for (const k of berubah) {
        const teks = (draf[k] ?? "").trim();
        const spec = isian.find((i) => i.kunci === k);
        // Kosong disimpan sebagai null, BUKAN string kosong. Halaman publik
        // memeriksa null untuk memutuskan menampilkan penanda "menunggu";
        // string kosong lolos pemeriksaan itu dan yang tampil adalah celah
        // tanpa keterangan apa pun.
        if (!teks) { (patch as Record<string, unknown>)[k] = null; continue; }
        (patch as Record<string, unknown>)[k] =
          spec?.jenis === "tahun" ? Number(teks) : teks;
      }
      await simpanSettings(patch);
      setAsli((s) => (s ? { ...s, ...patch } : s));
      setDraf({});
      toast({ judul: "Tersimpan", keterangan: "Tekan Terbitkan di bilah atas supaya tampil di situs.", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenyimpan(false);
    }
  }

  const belumTerisi = isian.filter((i) => !nilai(i.kunci).trim()).length;

  return (
    <div className="listpage">
      <div className="listpage__pad">
        {catatan && <p className="t-muted" style={{ maxWidth: "58ch", marginTop: 0 }}>{catatan}</p>}

        {/* Penanda berapa yang masih kosong. Bukan hiasan: seluruh halaman ini
            ada karena bagian-bagian itu sudah berbulan menampilkan "menunggu"
            di situs tanpa ada yang mengingatkan. */}
        <p className={`isihal__sisa${belumTerisi === 0 ? " isihal__sisa--penuh" : ""}`}>
          <Icon name={belumTerisi === 0 ? "check" : "alert"} size={15} />
          {belumTerisi === 0
            ? "Semua sudah terisi."
            : `${belumTerisi} dari ${isian.length} belum terisi — bagian itu tampil bertanda "menunggu" di situs.`}
        </p>

        <div className="isihal__grid">
          {isian.map((i) => (
            <div className="field" key={i.kunci}>
              <label className="field__label" htmlFor={`ih-${i.kunci}`}>{i.label}</label>
              {i.jenis === "panjang" ? (
                <textarea
                  id={`ih-${i.kunci}`}
                  className="input input--panel input--area"
                  rows={3}
                  placeholder={i.contoh}
                  value={nilai(i.kunci)}
                  onChange={(e) => setDraf((d) => ({ ...d, [i.kunci]: e.target.value }))}
                />
              ) : (
                <input
                  id={`ih-${i.kunci}`}
                  className="input input--panel"
                  inputMode={i.jenis === "tahun" ? "numeric" : undefined}
                  placeholder={i.contoh}
                  value={nilai(i.kunci)}
                  onChange={(e) => setDraf((d) => ({ ...d, [i.kunci]: e.target.value }))}
                />
              )}
              <p className="field__help">{i.bantuan}</p>
            </div>
          ))}
        </div>

        <div className="isihal__kaki">
          <button type="button" className="btn btn--primary"
            disabled={!adaPerubahan || menyimpan} onClick={simpan}>
            {menyimpan && <span className="spinner spinner--sm spinner--on-action" />}
            <Icon name="save" size={15} />
            {adaPerubahan ? `Simpan ${berubah.length} perubahan` : "Simpan"}
          </button>
          {adaPerubahan && (
            <span className="t-muted">Belum tersimpan.</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function IsiHalamanPanel({ isian, catatan }: { isian: Isian[]; catatan?: string }) {
  return (
    <RequireAuth>
      <ToastProvider>
        <Isi isian={isian} catatan={catatan} />
      </ToastProvider>
    </RequireAuth>
  );
}
