import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import type { IconName } from "../ui/Icon";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { CatatanTerbit, SisiSitus } from "./SisiSitus";
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
  /**
   * Kalimat di situs tempat nilainya disisipkan; `%s` adalah tempatnya.
   *
   * Ini bagian yang membuat halaman ini berhenti jadi kotak isian tanpa
   * konteks. Sebelumnya pemilik harus percaya bahwa "12 bulan" akan mendarat
   * di kalimat yang benar; sekarang kalimatnya dicetak di bawah isian, dengan
   * nilainya yang sedang diketik sudah tersisip di dalamnya.
   */
  kalimat?: string;
  /** Judul kartu tempat isian ini dikelompokkan. Tanpa ini, satu kartu saja. */
  grup?: string;
}

/** Field StudioSettings yang boleh diurus panel ini. */
type KunciTeks =
  | "foundedYear" | "firstCommercialYear"
  | "legalEntity" | "legalAddress" | "retentionMessages"
  | "retentionDocuments" | "governingLaw"
  | "faqTarif" | "faqUangMuka" | "faqLamaKerja" | "faqKunjungan";

export interface IsiHalamanProps {
  isian: Isian[];
  catatan?: string;
  /** Untuk panel kanan: bagian situs yang diurus halaman ini. */
  situs: { judul: string; letak: string; ikon: IconName; tautan: string; tautanLabel: string };
}

function Isi({ isian, catatan, situs }: IsiHalamanProps) {
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

  const terisi = isian.filter((i) => nilai(i.kunci).trim()).length;
  const belumTerisi = isian.length - terisi;

  /* Kelompokkan menurut `grup`, dengan urutan kemunculan pertama dipertahankan.
     Isian tanpa grup jatuh ke satu kartu tanpa nama di paling atas. */
  const grup: { judul: string; isi: Isian[] }[] = [];
  for (const i of isian) {
    const nama = i.grup ?? "";
    const ada = grup.find((g) => g.judul === nama);
    if (ada) ada.isi.push(i);
    else grup.push({ judul: nama, isi: [i] });
  }

  const satuIsian = (i: Isian) => {
    const v = nilai(i.kunci);
    const kosong = !v.trim();
    return (
      <div className="isihal__baris" key={i.kunci}>
        <div className="field">
          <label className="field__label" htmlFor={`ih-${i.kunci}`}>
            {i.label}
            {kosong && <span className="isihal__tanda">belum diisi</span>}
          </label>
          {i.jenis === "panjang" ? (
            <textarea
              id={`ih-${i.kunci}`}
              className="input input--panel input--area"
              rows={3}
              placeholder={i.contoh}
              value={v}
              onChange={(e) => setDraf((d) => ({ ...d, [i.kunci]: e.target.value }))}
            />
          ) : (
            <input
              id={`ih-${i.kunci}`}
              className="input input--panel"
              inputMode={i.jenis === "tahun" ? "numeric" : undefined}
              placeholder={i.contoh}
              value={v}
              onChange={(e) => setDraf((d) => ({ ...d, [i.kunci]: e.target.value }))}
            />
          )}
          <p className="field__help">{i.bantuan}</p>
        </div>

        {/* Kalimat di situs, dengan nilainya sudah tersisip. Digambar ulang
            tiap ketikan, jadi yang terbaca di sini persis yang akan terbaca
            pengunjung. Selama kosong, yang ditunjukkan adalah penanda
            "menunggu" yang memang tampil di situs — bukan tempat kosong. */}
        {i.kalimat && (
          <figure className={`isihal__situs${kosong ? " isihal__situs--kosong" : ""}`}>
            <figcaption>Di situs berbunyi</figcaption>
            <blockquote>
              {i.kalimat.split("%s").flatMap((bagian, n) => (
                n === 0
                  ? [bagian]
                  : [
                      kosong
                        ? <em className="isihal__tunggu" key={`v${n}`}>belum ditetapkan</em>
                        : <strong key={`v${n}`}>{v.trim()}</strong>,
                      bagian,
                    ]
              ))}
            </blockquote>
          </figure>
        )}
      </div>
    );
  };

  return (
    <div className="buatpage buatpage--situs">
      <div className="buatpage__utama">
        {catatan && (
          <section className="buat-kartu isihal__catatan">
            <span className="icon-tile"><Icon name="info" size={18} /></span>
            <p className="t-muted" style={{ margin: 0 }}>{catatan}</p>
          </section>
        )}

        {grup.map((g, n) => (
          <section className="buat-kartu" key={g.judul || n}>
            <h2 className="buat-kartu__judul">{g.judul || "Isian"}</h2>
            <div className="isihal__grid">{g.isi.map(satuIsian)}</div>
          </section>
        ))}
      </div>

      <SisiSitus
        judul={situs.judul}
        letak={situs.letak}
        ikon={situs.ikon}
        lengkap={belumTerisi === 0}
        status={belumTerisi === 0 ? "Semua sudah terisi" : `${belumTerisi} belum terisi`}
        fakta={[
          { label: "Sudah terisi", nilai: <span className="t-num">{terisi} / {isian.length}</span> },
          {
            label: "Belum tersimpan",
            nilai: adaPerubahan
              ? <span className="badge badge--warn"><span className="t-num">{berubah.length}</span></span>
              : <span className="t-muted">—</span>,
          },
        ]}
        tautan={situs.tautan}
        tautanLabel={situs.tautanLabel}
      >
        <button type="button" className="btn btn--primary btn--lift buat-aksi__utama"
          disabled={!adaPerubahan || menyimpan} onClick={simpan}>
          {menyimpan && <span className="spinner spinner--sm spinner--on-action" />}
          <Icon name="save" size={15} />
          {adaPerubahan ? `Simpan ${berubah.length} perubahan` : "Simpan"}
        </button>
        {adaPerubahan && (
          <button type="button" className="btn btn--ghost btn--sm buat-aksi__reset"
            onClick={() => setDraf({})}>
            Batalkan perubahan
          </button>
        )}
        <CatatanTerbit />
      </SisiSitus>
    </div>
  );
}

export function IsiHalamanPanel(props: IsiHalamanProps) {
  return (
    <RequireAuth>
      <ToastProvider>
        <Isi {...props} />
      </ToastProvider>
    </RequireAuth>
  );
}
