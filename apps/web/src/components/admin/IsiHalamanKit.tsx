import { useEffect, useState } from "react";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { Tombol } from "../kit/Tombol";
import { HalamanSitus, PenandaSimpan, KepalaBagian } from "./situsKit";
import { ambilSettings, simpanSettings, bacaCache, tulisCache, type StudioSettings } from "../../lib/admin";

/* =============================================================================
   Isi halaman publik yang bentuknya sekadar isian teks — Angka di FAQ,
   Privasi, dan Identitas Studio — di kerangka kit.

   Logikanya dibawa apa adanya dari IsiHalamanPanel lama, dan alasannya
   tetap berlaku:

   - SATU panel untuk tiga halaman: tiga salinan "muat settings, render
     isian, PATCH settings" pasti menyimpang (satu menyimpan string kosong,
     satunya null — dan halaman publik memeriksa null).
   - Kosong disimpan sebagai NULL, bukan string kosong.
   - Pratinjau digambar ulang tiap ketikan dan meniru potongan halaman
     publiknya — kalimatnya diambil APA ADANYA dari sana, bukan diparafrase.
   - Baris yang sedang diisi ikut menyala di pratinjau.
   ============================================================================= */

export interface Isian {
  kunci: KunciTeks;
  label: string;
  /** Kalimat di bawah isian — DI MANA ia tampil di situs. */
  bantuan: string;
  contoh?: string;
  jenis?: "teks" | "tahun" | "panjang";
  /** Kalimat di situs tempat nilainya disisipkan; `%s` tempatnya. */
  kalimat?: string;
  /** Baris di atas kalimat di pratinjau: pertanyaan /faq, atau judul tonggak. */
  tanya?: string;
  /** Judul seksi DI SITUS — boleh beda dari `grup` kartu isian. */
  judulSitus?: string;
  /** Kalimatnya menyambung paragraf isian sebelumnya. */
  sambung?: boolean;
  grup?: string;
}

type KunciTeks =
  | "foundedYear"
  | "firstCommercialYear"
  | "legalEntity"
  | "legalAddress"
  | "retentionMessages"
  | "retentionDocuments"
  | "governingLaw"
  | "faqTarif"
  | "faqUangMuka"
  | "faqLamaKerja"
  | "faqKunjungan";

export type BentukPratinjau = "garis-waktu" | "tanya-jawab" | "dokumen";

export interface IsiHalamanProps {
  isian: Isian[];
  catatan?: string;
  pratinjau: BentukPratinjau;
  pratinjauJudul: string;
  tautan: string;
  tautanLabel: string;
}

function Isi({ isian, catatan, pratinjau, pratinjauJudul, tautan, tautanLabel }: IsiHalamanProps) {
  const toast = useToast();
  const [asli, setAsli] = useState<StudioSettings | null>(() => bacaCache<StudioSettings>("settings"));
  const [draf, setDraf] = useState<Partial<Record<KunciTeks, string>>>({});
  const [menyimpan, setMenyimpan] = useState(false);
  const [fokus, setFokus] = useState<KunciTeks | null>(null);

  useEffect(() => {
    ambilSettings()
      .then((d) => {
        tulisCache("settings", d);
        setAsli(d);
      })
      .catch(() => setAsli((s) => s ?? null));
  }, []);

  const nilai = (k: KunciTeks): string => {
    if (draf[k] !== undefined) return draf[k] as string;
    const v = asli?.[k];
    return v === null || v === undefined ? "" : String(v);
  };

  const berubah = (Object.keys(draf) as KunciTeks[]).filter((k) => {
    const v = asli?.[k];
    return draf[k] !== (v === null || v === undefined ? "" : String(v));
  });

  async function simpan() {
    if (berubah.length === 0) return;
    setMenyimpan(true);
    try {
      const patch: Partial<StudioSettings> = {};
      for (const k of berubah) {
        const teks = (draf[k] ?? "").trim();
        const spec = isian.find((i) => i.kunci === k);
        (patch as Record<string, unknown>)[k] = !teks ? null : spec?.jenis === "tahun" ? Number(teks) : teks;
      }
      await simpanSettings(patch);
      setAsli((s) => (s ? { ...s, ...patch } : s));
      setDraf({});
      toast({ judul: "Tersimpan", keterangan: "Tekan Terbitkan di kanan atas supaya tampil di situs.", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenyimpan(false);
    }
  }

  const terisi = isian.filter((i) => nilai(i.kunci).trim()).length;
  const belum = isian.length - terisi;
  const tahunSalah = isian.some((i) => i.jenis === "tahun" && nilai(i.kunci).trim() && !/^\d{4}$/.test(nilai(i.kunci).trim()));

  const grup: { judul: string; isi: Isian[] }[] = [];
  for (const i of isian) {
    const nama = i.grup ?? "";
    const ada = grup.find((g) => g.judul === nama);
    if (ada) ada.isi.push(i);
    else grup.push({ judul: nama, isi: [i] });
  }

  /* --- Pratinjau ------------------------------------------------------------ */
  const kalimatJadi = (i: Isian) => {
    const v = nilai(i.kunci).trim();
    if (!i.kalimat) return null;
    return i.kalimat.split("%s").flatMap((bagian, n) =>
      n === 0
        ? [bagian]
        : [
            v ? (
              <b key={`v${n}`}>{v}</b>
            ) : (
              <em className="ih__tunggu" key={`v${n}`}>
                belum ditetapkan
              </em>
            ),
            bagian,
          ],
    );
  };
  const kelasBaris = (i: Isian) =>
    `ih__baris${fokus === i.kunci ? " ih__baris--sorot" : ""}${nilai(i.kunci).trim() ? "" : " ih__baris--kosong"}`;

  let isiPratinjau: React.ReactNode;
  if (pratinjau === "garis-waktu") {
    isiPratinjau = (
      <ol className="ih-waktu">
        {isian.map((i) => (
          <li className={kelasBaris(i)} key={i.kunci}>
            {/* "TAHUN?" persis penanda situs (TAHUN_BELUM di lib/menunggu). */}
            <span className="ih-waktu__thn">{nilai(i.kunci).trim() || "TAHUN?"}</span>
            <span className="ih-waktu__isi">
              <b>{i.tanya}</b>
              {i.kalimat}
            </span>
          </li>
        ))}
      </ol>
    );
  } else if (pratinjau === "tanya-jawab") {
    /* /faq mencetak angkanya SESUDAH jawaban sebagai baris "Angkanya"
       tersendiri, dan selama kosong cuma lencana di sebelah pertanyaan. */
    isiPratinjau = (
      <dl className="ih-tanya">
        {isian.map((i) => {
          const v = nilai(i.kunci).trim();
          return (
            <div className={kelasBaris(i)} key={i.kunci}>
              <dt>
                {i.tanya}
                {!v && <span className="ih__lencana">Angka diberikan saat ditanya</span>}
              </dt>
              {v && (
                <dd>
                  <span className="ih-tanya__l">Angkanya</span>
                  <b>{v}</b>
                </dd>
              )}
            </div>
          );
        })}
      </dl>
    );
  } else {
    const seksi: { judul: string; paragraf: Isian[][] }[] = [];
    for (const i of isian) {
      const nama = i.judulSitus ?? "";
      let s = seksi.at(-1);
      if (!s || s.judul !== nama) {
        s = { judul: nama, paragraf: [] };
        seksi.push(s);
      }
      if (i.sambung && s.paragraf.length) s.paragraf.at(-1)!.push(i);
      else s.paragraf.push([i]);
    }
    isiPratinjau = (
      <div className="ih-dok">
        <span className="ih-dok__kop">Kebijakan Privasi</span>
        {seksi.map((s, n) => (
          <section key={s.judul || n}>
            {s.judul && <h4>{s.judul}</h4>}
            {s.paragraf.map((par, m) => (
              <p key={m}>
                {par.map((i) => (
                  <span className={kelasBaris(i)} key={i.kunci}>
                    {kalimatJadi(i)}
                  </span>
                ))}
              </p>
            ))}
          </section>
        ))}
      </div>
    );
  }

  const satuIsian = (i: Isian) => {
    const v = nilai(i.kunci);
    const kosong = !v.trim();
    const umum = {
      id: `ih-${i.kunci}`,
      placeholder: i.contoh,
      value: v,
      onFocus: () => setFokus(i.kunci),
      onBlur: () => setFokus((f) => (f === i.kunci ? null : f)),
      onChange: (e: { currentTarget: { value: string } }) => {
        const baru = e.currentTarget.value;
        setDraf((d) => ({ ...d, [i.kunci]: baru }));
      },
    };
    return (
      <div className={`k-isian${i.jenis === "panjang" ? " pas__lebar" : ""}`} key={i.kunci}>
        <label className="k-isian__label ih__label" htmlFor={`ih-${i.kunci}`}>
          {i.label}
          <span className={`ih__tanda${kosong ? "" : " ih__tanda--isi"}`}>{kosong ? "belum diisi" : "terisi"}</span>
        </label>
        {i.jenis === "panjang" ? (
          <textarea className="pas__area" rows={3} {...umum} />
        ) : (
          <div className="k-isian__kotak">
            <input
              className="k-isian__input"
              inputMode={i.jenis === "tahun" ? "numeric" : undefined}
              maxLength={i.jenis === "tahun" ? 4 : undefined}
              {...umum}
            />
          </div>
        )}
        <p className="k-isian__bantu">{i.bantuan}</p>
      </div>
    );
  };

  return (
    <HalamanSitus
      lengkap={belum === 0}
      status={belum === 0 ? "Semua sudah terisi" : `${belum} belum terisi`}
      tautan={tautan}
      tautanLabel={tautanLabel}
      fakta={[{ label: "Sudah terisi", nilai: `${terisi} dari ${isian.length}` }]}
      aksi={
        <>
          <Tombol
            ukuran="large"
            jenis="primary"
            disabled={berubah.length === 0 || menyimpan || tahunSalah}
            onClick={simpan}
          >
            {menyimpan ? "Menyimpan…" : "Simpan perubahan"}
          </Tombol>
          <PenandaSimpan n={berubah.length} teks={tahunSalah ? "Tahun harus empat angka." : undefined} />
          {berubah.length > 0 && (
            <button type="button" className="pf__kosongkan situs__batal" onClick={() => setDraf({})}>
              Batalkan perubahan
            </button>
          )}
        </>
      }
    >
      <section className="pf__bagian">
        <KepalaBagian judul={pratinjauJudul} kanan="Berubah tiap ketikan" />
        <div className={`ih ih--${pratinjau}`}>{isiPratinjau}</div>
        <p className="pf__statusket">
          Yang terbaca di sini persis yang akan terbaca pengunjung. Baris yang sedang Anda isi ikut menyala.
        </p>
      </section>

      {catatan && <p className="situs__catatan">{catatan}</p>}

      {grup.map((g, n) => (
        <section className="pf__bagian" key={g.judul || n}>
          <KepalaBagian judul={g.judul || "Isian"} />
          <div className="pas__kisi">{g.isi.map(satuIsian)}</div>
        </section>
      ))}
    </HalamanSitus>
  );
}

export function IsiHalamanKit(props: IsiHalamanProps) {
  return (
    <RequireAuth skeleton={<div className="pas pas--rangka" />}>
      <ToastProvider>
        <Isi {...props} />
      </ToastProvider>
    </RequireAuth>
  );
}
