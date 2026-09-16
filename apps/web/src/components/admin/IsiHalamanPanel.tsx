import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { CatatanTerbit, SisiSitus } from "./SisiSitus";
import {
  ambilSettings, simpanSettings, bacaCache, tulisCache, type StudioSettings,
} from "../../lib/admin";

/**
 * Satu panel untuk SEMUA isi halaman publik yang bentuknya sekadar isian
 * teks: tiga angka FAQ, lima keterangan halaman privasi, dan dua tahun di
 * identitas studio.
 *
 * Tiga berkas terpisah yang isinya "muat settings, render isian, PATCH
 * settings" akan menyimpang satu sama lain dalam hitungan bulan — satu dapat
 * penanda perubahan-belum-disimpan, satunya tidak; satu memperlakukan string
 * kosong sebagai null, satunya menyimpan string kosong. Bedanya kecil dan
 * tidak pernah terlihat sampai ada yang bertanya kenapa isian yang dikosongkan
 * di satu halaman tetap tampil di situs.
 *
 * Yang membedakan ketiga halaman cuma daftar isiannya dan BENTUK pratinjaunya,
 * jadi itu yang jadi prop. Sebelum & Sesudah TIDAK memakai ini: isinya unggahan
 * berkas, bukan teks, dan memaksakannya ke sini berarti prop yang cuma dipakai
 * satu pemanggil.
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
   * di kalimat yang benar; sekarang kalimatnya digambar di pratinjau, dengan
   * nilainya yang sedang diketik sudah tersisip di dalamnya.
   */
  kalimat?: string;
  /**
   * Baris di ATAS kalimat di pratinjau: pertanyaan di /faq, atau judul
   * tonggak di garis waktu /studio. Tanpa ini kalimatnya berdiri sendiri
   * tanpa konteks — dan konteks itulah yang membuat pemilik bisa menilai
   * apakah jawabannya benar-benar menjawab.
   */
  tanya?: string;
  /**
   * Judul `<h2>` DI SITUS tempat kalimat ini tinggal — bukan judul kartu
   * isian di panel ini. Keduanya sengaja dipisah: kartu isian dikelompokkan
   * menurut apa yang enak diisi bersamaan, sementara pratinjau harus
   * mengikuti susunan halaman aslinya. Pada /privasi keduanya memang berbeda:
   * "Hukum yang berlaku" enak berdiri sendiri saat diisi, tapi di situs ia
   * satu seksi dengan badan usaha.
   */
  judulSitus?: string;
  /**
   * Kalimatnya menyambung paragraf isian sebelumnya, bukan memulai paragraf
   * baru. Ada karena di /privasi dua isian memang berbagi satu kalimat —
   * badan usaha dan alamatnya, lalu lama simpan pesan dan lama simpan
   * dokumen. Memecahnya jadi dua paragraf membuat pratinjau menampilkan
   * bentuk yang tidak pernah tayang.
   */
  sambung?: boolean;
  /** Judul kartu tempat isian ini dikelompokkan. Tanpa ini, satu kartu saja. */
  grup?: string;
}

/** Field StudioSettings yang boleh diurus panel ini. */
type KunciTeks =
  | "foundedYear" | "firstCommercialYear"
  | "legalEntity" | "legalAddress" | "retentionMessages"
  | "retentionDocuments" | "governingLaw"
  | "faqTarif" | "faqUangMuka" | "faqLamaKerja" | "faqKunjungan";

/**
 * Bentuk pratinjau. Ketiganya meniru potongan halaman publik yang sungguhan,
 * bukan menggambar kotak generik — yang dinilai pemilik adalah tampilan, dan
 * pratinjau yang bentuknya tidak seperti hasilnya tidak menolong sama sekali.
 */
export type BentukPratinjau = "garis-waktu" | "tanya-jawab" | "dokumen";

export interface IsiHalamanProps {
  isian: Isian[];
  catatan?: string;
  pratinjau: BentukPratinjau;
  /** Judul kartu pratinjau — menyebut halaman aslinya. */
  pratinjauJudul: string;
  /** Alamat halaman publik yang menampilkan isian-isian ini. */
  tautan: string;
  tautanLabel: string;
}

function Isi({ isian, catatan, pratinjau, pratinjauJudul, tautan, tautanLabel }: IsiHalamanProps) {
  const toast = useToast();
  const [asli, setAsli] = useState<StudioSettings | null>(
    () => bacaCache<StudioSettings>("settings"),
  );
  const [draf, setDraf] = useState<Partial<Record<KunciTeks, string>>>({});
  const [menyimpan, setMenyimpan] = useState(false);
  /**
   * Isian yang sedang difokus. Barisnya ikut menyala di pratinjau, jadi
   * pemilik tidak perlu mencocokkan sendiri kotak mana menulis kalimat mana —
   * pada halaman privasi dengan lima kalimat berbunyi mirip, itu justru
   * pekerjaan yang paling mudah salah.
   */
  const [fokus, setFokus] = useState<KunciTeks | null>(null);

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

  /* --- Pratinjau ---------------------------------------------------------- */

  /** Kalimat dengan nilainya tersisip; kosong jadi penanda "menunggu".
      Teksnya diambil APA ADANYA dari halaman publiknya — pratinjau yang
      memparafrase adalah pratinjau yang berbohong, dan kelas cacat itu sudah
      sekali lolos: tiga kalimat FAQ di sini dulu dikarang, padahal halaman
      /faq tidak pernah menyisipkan angkanya ke dalam kalimat sama sekali. */
  const kalimatJadi = (i: Isian) => {
    const v = nilai(i.kunci).trim();
    if (!i.kalimat) return null;
    return i.kalimat.split("%s").flatMap((bagian, n) => (
      n === 0
        ? [bagian]
        : [
            v
              ? <b key={`v${n}`}>{v}</b>
              : <em className="spv__tunggu" key={`v${n}`}>belum ditetapkan</em>,
            bagian,
          ]
    ));
  };

  const kelasBaris = (i: Isian) =>
    `spv__baris${fokus === i.kunci ? " spv__baris--sorot" : ""}` +
    `${nilai(i.kunci).trim() ? "" : " spv__baris--kosong"}`;

  const isiPratinjau = () => {
    if (pratinjau === "garis-waktu") {
      /* Garis waktu /studio: tahun di kolom kiri, judul tonggak tebal, lalu
         kalimatnya. Tahun yang belum diisi tampil sebagai "TAHUN?" — persis
         TAHUN_BELUM di lib/menunggu, bukan penanda karangan sendiri. */
      return (
        <ol className="spv-waktu">
          {isian.map((i) => {
            const v = nilai(i.kunci).trim();
            return (
              <li className={kelasBaris(i)} key={i.kunci}>
                <span className="spv-waktu__thn">{v || "TAHUN?"}</span>
                <span className="spv-waktu__isi">
                  <b>{i.tanya}</b>
                  {i.kalimat}
                </span>
              </li>
            );
          })}
        </ol>
      );
    }

    if (pratinjau === "tanya-jawab") {
      /* Baris tanya-jawab /faq. Angkanya dicetak SESUDAH jawaban sebagai
         baris "Angkanya" tersendiri — halaman itu sengaja tidak menyisipkannya
         ke dalam kalimat, supaya yang ditulis pemilik tampil apa adanya. Yang
         ditiru di sini persis itu, termasuk bunyi lencananya. */
      return (
        <dl className="spv-tanya">
          {isian.map((i) => {
            const v = nilai(i.kunci).trim();
            return (
              <div className={kelasBaris(i)} key={i.kunci}>
                <dt>
                  {i.tanya}
                  {!v && <span className="spv__lencana">Angka diberikan saat ditanya</span>}
                </dt>
                {/* Selama kosong, halaman /faq TIDAK mencetak apa pun di
                    bawah jawaban — yang tampil cuma lencana di sebelah
                    pertanyaannya. Menambahkan kalimat penjelas di sini akan
                    menampilkan baris yang tidak pernah ada di situs. */}
                {v && (
                  <dd><span className="spv-tanya__l">Angkanya</span><b>{v}</b></dd>
                )}
              </div>
            );
          })}
        </dl>
      );
    }

    /* Dokumen /privasi. Disusun menurut `judulSitus`, bukan menurut kartu
       isian — dan isian ber-`sambung` menempel ke paragraf sebelumnya, karena
       di halaman aslinya dua isian memang berbagi satu kalimat. */
    const seksi: { judul: string; paragraf: Isian[][] }[] = [];
    for (const i of isian) {
      const nama = i.judulSitus ?? "";
      let s = seksi.at(-1);
      if (!s || s.judul !== nama) { s = { judul: nama, paragraf: [] }; seksi.push(s); }
      if (i.sambung && s.paragraf.length) s.paragraf.at(-1)!.push(i);
      else s.paragraf.push([i]);
    }

    return (
      <div className="spv-dok">
        <span className="spv-dok__kop">Kebijakan Privasi</span>
        {seksi.map((s, n) => (
          <section key={s.judul || n}>
            {s.judul && <h3>{s.judul}</h3>}
            {s.paragraf.map((par, m) => (
              <p key={m}>
                {par.map((i) => (
                  <span className={kelasBaris(i)} key={i.kunci}>{kalimatJadi(i)}</span>
                ))}
              </p>
            ))}
          </section>
        ))}
      </div>
    );
  };

  /* --- Isian -------------------------------------------------------------- */

  const satuIsian = (i: Isian) => {
    const v = nilai(i.kunci);
    const kosong = !v.trim();
    const umum = {
      id: `ih-${i.kunci}`,
      placeholder: i.contoh,
      value: v,
      onFocus: () => setFokus(i.kunci),
      onBlur: () => setFokus((f) => (f === i.kunci ? null : f)),
      onChange: (e: { target: { value: string } }) =>
        setDraf((d) => ({ ...d, [i.kunci]: e.target.value })),
    };
    return (
      <div className="field isihal__baris" key={i.kunci}>
        <label className="field__label" htmlFor={`ih-${i.kunci}`}>
          {i.label}
          {kosong
            ? <span className="isihal__tanda isihal__tanda--kosong">belum diisi</span>
            : <span className="isihal__tanda isihal__tanda--isi"><Icon name="check" size={11} />terisi</span>}
        </label>
        {i.jenis === "panjang"
          ? <textarea className="input input--panel input--area" rows={3} {...umum} />
          : <input className="input input--panel"
              inputMode={i.jenis === "tahun" ? "numeric" : undefined} {...umum} />}
        <p className="field__help">{i.bantuan}</p>
      </div>
    );
  };

  return (
    <div className="buatpage buatpage--situs">
      <div className="buatpage__utama">
        <section className="buat-kartu">
          <h2 className="buat-kartu__judul">{pratinjauJudul}</h2>
          <div className={`situs-pratinjau situs-pratinjau--${pratinjau}`}>{isiPratinjau()}</div>
          <p className="field__help" style={{ margin: 0 }}>
            Digambar ulang tiap ketikan — yang terbaca di sini persis yang akan
            terbaca pengunjung. Baris yang sedang Anda isi ikut menyala.
          </p>
        </section>

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
        lengkap={belumTerisi === 0}
        status={belumTerisi === 0 ? "Semua sudah terisi" : `${belumTerisi} belum terisi`}
        tautan={tautan}
        tautanLabel={tautanLabel}
        fakta={[
          { label: "Sudah terisi", nilai: <span className="t-num">{terisi} / {isian.length}</span> },
          {
            label: "Belum tersimpan",
            nilai: adaPerubahan
              ? <span className="badge badge--warn"><span className="t-num">{berubah.length}</span></span>
              : <span className="t-muted">—</span>,
          },
        ]}
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
