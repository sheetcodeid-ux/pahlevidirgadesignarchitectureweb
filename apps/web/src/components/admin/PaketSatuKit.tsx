import { useEffect, useMemo, useState } from "react";
import { navigate } from "astro:transitions/client";
import { RequireAuth } from "./RequireAuth";
import { ToastProvider, useToast, titipToast } from "../ui/overlay/Toast";
import { AlertDialog } from "../ui/overlay/Dialog";
import { Tombol, TombolIkon } from "../kit/Tombol";
import { Isian, Sakelar } from "../kit/Isian";
import { DotsThree, FacebookLogo, Link as IkonTautan, NotePencil, XLogo } from "../kit/ikon";
import {
  daftarPaket,
  ambilPaket,
  buatPaket,
  ubahPaket,
  hapusPaket,
  bacaCache,
  tulisCache,
  type Paket,
  type PaketInput,
} from "../../lib/admin";
import { KELOMPOK, rentangFee } from "../../lib/tier";

/* =============================================================================
   Satu paket layanan, mengikuti frame Figma "34. Promo Details".

   Framenya halaman BACA: gambar besar, judul, tiga baris info, beberapa
   bagian teks, dua kartu kode voucher, lalu kolom samping berisi tombol
   bagikan dan promo terkait. Halaman ini membacanya persis begitu, lalu
   menambah satu hal yang tidak ada di framenya: tombol "Ubah paket" di
   baris judul, yang menukar bagian utama jadi formulir DI TEMPAT. Formulir
   di halaman terpisah berarti dua halaman yang menampilkan hal yang sama
   dengan dua cara — dan yang jarang dibuka yang tertinggal.

     Coinest               Halaman ini
     --------------------  -------------------------------------------------
     gambar promo          bidang rentang fee, warnanya sama dengan kartunya
                           di daftar (sorot = hijau tua, dihentikan = abu)
     Promo/Usage Period,   Kelompok, Rentang fee, Cocok untuk, Status
     Minimum Transaction
     About / How To /      Ringkasan / isi paket / di mana ia tampil
     Terms / Partners
     dua kartu voucher     dua teks siap salin: kalimat untuk WhatsApp dan
                           tautan ke seksi tarif beranda
     Share                 salin tautan tarif, bagikan ke Facebook dan X
     Related Promos        paket lain di kelompok yang sama
   ============================================================================= */

const SITUS = "https://pahlevidirgaarchitecture.com";
const TAUTAN_TARIF = `${SITUS}/#tarif`;

const kosong = (group: "kafe" | "rumah" = "kafe"): PaketInput => ({
  group,
  slug: "",
  name: "",
  summary: "",
  feeMin: 0,
  feeMax: 0,
  forWhom: "",
  includesHeading: "Yang Anda dapat",
  includes: [],
  highlighted: false,
  active: true,
  sortOrder: 0,
});

/** "Signature" → "signature"; dipakai mengisi kode paket baru otomatis. */
const jadiSlug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

function Bidang({ p, besar }: { p: Pick<Paket, "feeMin" | "feeMax" | "highlighted" | "active" | "group">; besar?: boolean }) {
  return (
    <span
      className={[
        "pak__bidang",
        besar && "pak__bidang--besar",
        p.highlighted && p.active && "pak__bidang--sorot",
        !p.active && "pak__bidang--mati",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="pak__kelompok">
        {KELOMPOK.find((k) => k.kunci === p.group)?.tab ?? p.group}
        {p.highlighted && p.active ? " · Paling dipilih" : ""}
        {!p.active ? " · Dihentikan" : ""}
      </span>
      <span className="pak__harga">
        <small>Rp</small>
        <b>{rentangFee(p)}</b>
        <small>juta</small>
      </span>
      {besar && <span className="pak__per">rentang per proyek</span>}
    </span>
  );
}

function KartuSalin({ judul, isi, ket, onSalin }: { judul: string; isi: string; ket: string; onSalin: () => void }) {
  return (
    <section className="pas__salin">
      <h3 className="pas__salinjudul">{judul}</h3>
      <p className="pas__salinisi" title={isi}>
        {isi}
      </p>
      <p className="pas__salinket">{ket}</p>
      <Tombol ukuran="medium" jenis="primary" className="pas__salintombol" onClick={onSalin}>
        Salin
      </Tombol>
    </section>
  );
}

function Isi() {
  const toast = useToast();
  const kueri = typeof location === "undefined" ? new URLSearchParams() : new URLSearchParams(location.search);
  const id = kueri.get("id");
  const baru = !id;

  const [semua, setSemua] = useState<Paket[] | null>(() => bacaCache<Paket[]>("paket"));
  const [paket, setPaket] = useState<Paket | null>(() =>
    id ? (bacaCache<Paket[]>("paket") ?? []).find((p) => p.id === id) ?? null : null,
  );
  const [galat, setGalat] = useState<string | null>(null);
  const [ubah, setUbah] = useState(baru);
  const [form, setForm] = useState<PaketInput>(() =>
    kosong((kueri.get("kelompok") as "kafe" | "rumah" | null) ?? "kafe"),
  );
  const [isiTeks, setIsiTeks] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [slugDisentuh, setSlugDisentuh] = useState(false);

  useEffect(() => {
    daftarPaket()
      .then(setSemua)
      .catch(() => setSemua((l) => l ?? []));
    if (id) {
      ambilPaket(id)
        .then(setPaket)
        .catch((e) => setGalat((e as Error).message));
    }
  }, [id]);

  function mulaiUbah() {
    if (!paket) return;
    const { id: _i, updatedAt: _u, ...isi } = paket;
    setForm(isi);
    setIsiTeks(paket.includes.join("\n"));
    setSlugDisentuh(true);
    setUbah(true);
  }

  const setel = <K extends keyof PaketInput>(k: K, v: PaketInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    const kirim: PaketInput = {
      ...form,
      name: (form.name ?? "").trim(),
      includes: isiTeks
        .split("\n")
        .map((b) => b.trim())
        .filter(Boolean),
    };
    setSibuk(true);
    try {
      if (baru) {
        const { id: idBaru } = await buatPaket(kirim);
        /* Dititipkan — halamannya berganti sebelum toast sempat tergambar. */
        titipToast({ judul: "Paket ditambahkan", keterangan: "Tekan Terbitkan supaya beranda ikut berubah.", nada: "sukses" });
        await navigate(`/admin/paket/satu?id=${encodeURIComponent(idBaru)}`);
        return;
      }
      await ubahPaket(paket!.id, kirim);
      const segar = await ambilPaket(paket!.id);
      setPaket(segar);
      setUbah(false);
      toast({ judul: "Paket disimpan", keterangan: "Tekan Terbitkan supaya beranda ikut berubah.", nada: "sukses" });
    } catch (err) {
      toast({ judul: "Gagal menyimpan", keterangan: (err as Error).message, nada: "gagal" });
    } finally {
      setSibuk(false);
    }
  }

  async function hapus() {
    if (!paket) return;
    try {
      await hapusPaket(paket.id);
      tulisCache("paket", (semua ?? []).filter((p) => p.id !== paket.id));
      titipToast({ judul: `Paket ${paket.name} dihapus`, keterangan: "Tekan Terbitkan supaya beranda ikut berubah.", nada: "sukses" });
      await navigate("/admin/paket");
    } catch (err) {
      toast({ judul: "Gagal menghapus", keterangan: (err as Error).message, nada: "gagal" });
    }
  }

  async function salin(teks: string, apa: string) {
    try {
      await navigator.clipboard.writeText(teks);
      toast({ judul: `${apa} disalin`, nada: "sukses" });
    } catch {
      toast({ judul: "Tidak bisa menyalin", keterangan: "Peramban menolak akses papan klip.", nada: "gagal" });
    }
  }

  const kelompok = paket ? KELOMPOK.find((k) => k.kunci === paket.group) : null;
  const sekelompok = useMemo(
    () =>
      paket
        ? (semua ?? [])
            .filter((p) => p.group === paket.group && p.id !== paket.id)
            .sort((a, b) => Number(b.active) - Number(a.active) || a.sortOrder - b.sortOrder)
            .slice(0, 3)
        : [],
    [semua, paket],
  );
  const aktifSekelompok = paket
    ? (semua ?? []).filter((p) => p.group === paket.group && p.active).sort((a, b) => a.sortOrder - b.sortOrder)
    : [];
  const posisi = paket ? aktifSekelompok.findIndex((p) => p.id === paket.id) : -1;

  const kalimatWa = paket
    ? `Paket ${paket.name} (${kelompok?.tab ?? ""}) — Rp ${rentangFee(paket)} juta per proyek. ` +
      `${paket.includesHeading}: ${paket.includes.join(", ")}. Cocok untuk: ${paket.forWhom}. ` +
      `Rincian semua paket: ${TAUTAN_TARIF}`
    : "";

  if (galat) return <p className="pak__kosong">Gagal memuat paket: {galat}</p>;
  if (!baru && !paket) return <div className="pas pas--rangka" aria-busy="true" />;

  const pratinjau = ubah
    ? {
        feeMin: form.feeMin ?? 0,
        feeMax: form.feeMax ?? 0,
        highlighted: !!form.highlighted,
        active: form.active !== false,
        group: (form.group ?? "kafe") as "kafe" | "rumah",
      }
    : paket!;

  return (
    <div className="pas">
      <Bidang p={pratinjau} besar />

      <div className="pas__badan">
        <div className="pas__utama">
          {ubah ? (
            <form className="pas__form" onSubmit={simpan}>
              <div className="pas__judulbaris">
                <h2 className="pas__judul">{baru ? "Paket baru" : `Ubah ${paket!.name}`}</h2>
              </div>
              <div className="pas__kisi">
                <Isian
                  label="Nama paket"
                  required
                  maxLength={60}
                  value={form.name ?? ""}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    setForm((f) => ({ ...f, name: v, slug: slugDisentuh ? f.slug : jadiSlug(v) }));
                  }}
                />
                <label className="k-isian">
                  <span className="k-isian__label">Kelompok</span>
                  <span className="k-isian__kotak pas__pilih">
                    <select
                      value={form.group}
                      onChange={(e) => setel("group", e.currentTarget.value as "kafe" | "rumah")}
                    >
                      {KELOMPOK.map((k) => (
                        <option key={k.kunci} value={k.kunci}>
                          {k.tab}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
                <Isian
                  label="Fee terendah (juta)"
                  type="number"
                  min={0}
                  step={1}
                  required
                  value={String(form.feeMin ?? 0)}
                  onChange={(e) => setel("feeMin", Number(e.currentTarget.value))}
                />
                <Isian
                  label="Fee tertinggi (juta)"
                  type="number"
                  min={0}
                  step={1}
                  required
                  value={String(form.feeMax ?? 0)}
                  onChange={(e) => setel("feeMax", Number(e.currentTarget.value))}
                  bantu={
                    (form.feeMax ?? 0) < (form.feeMin ?? 0) ? "Tidak boleh lebih kecil dari fee terendah." : undefined
                  }
                />
                <Isian
                  label="Cocok untuk"
                  maxLength={160}
                  className="pas__lebar"
                  value={form.forWhom ?? ""}
                  onChange={(e) => setel("forWhom", e.currentTarget.value)}
                />
              </div>

              <label className="k-isian pas__lebar">
                <span className="k-isian__label">Ringkasan</span>
                <textarea
                  className="pas__area"
                  rows={3}
                  maxLength={240}
                  value={form.summary ?? ""}
                  onChange={(e) => setel("summary", e.currentTarget.value)}
                />
              </label>

              <div className="pas__kisi">
                <Isian
                  label="Judul daftar isi"
                  maxLength={80}
                  className="pas__lebar"
                  value={form.includesHeading ?? ""}
                  onChange={(e) => setel("includesHeading", e.currentTarget.value)}
                  bantu='Mis. "Semua di Starter, ditambah" untuk paket di atas paket dasar.'
                />
              </div>
              <label className="k-isian pas__lebar">
                <span className="k-isian__label">Isi paket — satu butir per baris</span>
                <textarea
                  className="pas__area"
                  rows={6}
                  value={isiTeks}
                  onChange={(e) => setIsiTeks(e.currentTarget.value)}
                />
              </label>

              <div className="pas__kisi">
                <Isian
                  label="Kode paket"
                  required
                  maxLength={40}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  value={form.slug ?? ""}
                  onChange={(e) => {
                    setSlugDisentuh(true);
                    setel("slug", e.currentTarget.value);
                  }}
                  bantu="Huruf kecil, angka, dan tanda hubung. Dipakai sebagai penanda kartunya di beranda."
                />
                <Isian
                  label="Urutan di kelompoknya"
                  type="number"
                  step={1}
                  value={String(form.sortOrder ?? 0)}
                  onChange={(e) => setel("sortOrder", Number(e.currentTarget.value))}
                  bantu="Kecil di kiri. Paket dasar 1, berikutnya 2, dan seterusnya."
                />
              </div>

              <div className="pas__sakelar">
                <label>
                  <Sakelar
                    judul="Tandai paling dipilih"
                    checked={!!form.highlighted}
                    onChange={(e) => setel("highlighted", e.currentTarget.checked)}
                  />
                  <span>
                    <b>Paling dipilih</b>
                    <small>Kartunya berbingkai dan berlencana di beranda. Satu per kelompok.</small>
                  </span>
                </label>
                <label>
                  <Sakelar
                    judul="Tampilkan di beranda"
                    checked={form.active !== false}
                    onChange={(e) => setel("active", e.currentTarget.checked)}
                  />
                  <span>
                    <b>Tampil di beranda</b>
                    <small>Matikan untuk menghentikan paket tanpa menghapus harganya dari arsip.</small>
                  </span>
                </label>
              </div>

              <div className="pas__aksi">
                <Tombol ukuran="large" jenis="primary" tipeHtml="submit" disabled={sibuk}>
                  {sibuk ? "Menyimpan…" : baru ? "Tambah paket" : "Simpan"}
                </Tombol>
                <Tombol
                  ukuran="large"
                  jenis="ghost"
                  disabled={sibuk}
                  onClick={() => (baru ? navigate("/admin/paket") : setUbah(false))}
                >
                  Batal
                </Tombol>
                {!baru && (
                  <AlertDialog
                    destructive
                    title={`Hapus paket ${paket!.name}?`}
                    description="Paket ini hilang dari panel dan, setelah diterbitkan, dari beranda. Kalau cuma ingin berhenti menawarkannya, matikan “Tampil di beranda” — harganya tetap tersimpan sebagai arsip."
                    confirmLabel="Ya, hapus"
                    onConfirm={hapus}
                    trigger={
                      <button type="button" className="pas__hapus">
                        Hapus paket
                      </button>
                    }
                  />
                )}
              </div>
            </form>
          ) : (
            <>
              <div className="pas__judulbaris">
                <h2 className="pas__judul">{paket!.name}</h2>
                <Tombol ukuran="medium" jenis="ghost" kiri={NotePencil} onClick={mulaiUbah}>
                  Ubah paket
                </Tombol>
              </div>
              <dl className="pas__info">
                <div>
                  <dt>Kelompok</dt>
                  <dd>{kelompok?.tab ?? paket!.group}</dd>
                </div>
                <div>
                  <dt>Rentang fee</dt>
                  <dd>Rp {rentangFee(paket!)} juta per proyek</dd>
                </div>
                <div>
                  <dt>Cocok untuk</dt>
                  <dd>{paket!.forWhom || "—"}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{paket!.active ? "Tampil di beranda" : "Dihentikan — tidak tampil di beranda"}</dd>
                </div>
              </dl>

              <section className="pas__bagian">
                <h3>Ringkasan</h3>
                <p>{paket!.summary || "Belum ada ringkasan."}</p>
              </section>
              <section className="pas__bagian">
                <h3>Isi paket</h3>
                <p className="pas__kop">{paket!.includesHeading}</p>
                <ul>
                  {paket!.includes.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                  {paket!.includes.length === 0 && <li>Belum ada isi.</li>}
                </ul>
              </section>
              <section className="pas__bagian">
                <h3>Di beranda</h3>
                <p>
                  {paket!.active
                    ? `Tampil di tab “${kelompok?.tab}”, kartu ke-${posisi + 1} dari ${aktifSekelompok.length}` +
                      (paket!.highlighted ? ", dengan bingkai dan lencana “PALING DIPILIH”." : ".")
                    : "Tidak tampil. Paket ini disimpan sebagai arsip harga."}{" "}
                  Perubahan di sini baru terlihat di beranda setelah Anda menekan Terbitkan di bilah atas.
                </p>
              </section>

              <div className="pas__salinbaris">
                <KartuSalin
                  judul="Kalimat untuk WhatsApp"
                  isi={kalimatWa}
                  ket="Ringkasan paket ini, siap ditempel ke obrolan klien."
                  onSalin={() => salin(kalimatWa, "Kalimat")}
                />
                <KartuSalin
                  judul="Tautan tarif"
                  isi={TAUTAN_TARIF}
                  ket="Seksi tarif di beranda — semua paket berdampingan."
                  onSalin={() => salin(TAUTAN_TARIF, "Tautan")}
                />
              </div>
            </>
          )}
        </div>

        {!baru && paket && (
          <aside className="pas__samping">
            <section className="pas__bagikan">
              <h3 className="pas__sampingjudul">Bagikan</h3>
              <div className="pas__ikon">
                <TombolIkon ikon={IkonTautan} jenis="secondary" ukuran="medium" judul="Salin tautan tarif" onClick={() => salin(TAUTAN_TARIF, "Tautan")} />
                <TombolIkon
                  ikon={FacebookLogo}
                  jenis="secondary"
                  ukuran="medium"
                  judul="Bagikan ke Facebook"
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(TAUTAN_TARIF)}`}
                />
                <TombolIkon
                  ikon={XLogo}
                  jenis="secondary"
                  ukuran="medium"
                  judul="Bagikan ke X"
                  href={`https://x.com/intent/post?url=${encodeURIComponent(TAUTAN_TARIF)}&text=${encodeURIComponent(`Paket ${paket.name} — Rp ${rentangFee(paket)} juta`)}`}
                />
              </div>
            </section>
            <section className="pas__terkait">
              <div className="pas__terkaitkepala">
                <h3 className="pas__sampingjudul">Paket lain</h3>
                <TombolIkon ikon={DotsThree} jenis="transparent" ukuran="xsmall" ikonPx={18} judul="Semua paket" href="/admin/paket" />
              </div>
              {sekelompok.map((p) => (
                <a key={p.id} className="pas__terkaitkartu" href={`/admin/paket/satu?id=${encodeURIComponent(p.id)}`}>
                  <Bidang p={p} />
                  <span className="pas__terkaitlabel">{KELOMPOK.find((k) => k.kunci === p.group)?.tab}</span>
                  <span className="pas__terkaitnama">{p.name}</span>
                </a>
              ))}
              {sekelompok.length === 0 && <p className="pak__kosong">Belum ada paket lain di kelompok ini.</p>}
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}

export function PaketSatuKit() {
  return (
    <RequireAuth skeleton={<div className="pas pas--rangka" />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
