import { useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { buatProyek, simpanProyek, mintaUrlUnggah, type Proyek } from "../../lib/admin";

const KATEGORI: Record<string, string> = {
  residential: "Hunian", commercial: "Komersial", interior: "Interior",
  landscape: "Lanskap", masterplan: "Masterplan", renovation: "Renovasi",
};

/** Mengubah judul jadi slug: huruf kecil, tanpa aksen, dipisah tanda hubung. */
function keSlug(judul: string) {
  return judul
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

const KOSONG = {
  title: "", slug: "", category: "residential",
  subtitle: "", summary: "", city: "", year: "", client: "", areaSqm: "",
};

function Isi() {
  const toast = useToast();
  const [f, setF] = useState({ ...KOSONG });
  const [slugDisunting, setSlugDisunting] = useState(false);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [coverPratinjau, setCoverPratinjau] = useState<string | null>(null);
  const [mengunggah, setMengunggah] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const berkas = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof KOSONG, v: string) => setF((x) => ({ ...x, [k]: v }));
  const judulSah = f.title.trim().length >= 2;
  const slugSah = f.slug.trim().length >= 2;
  const bisaSimpan = judulSah && slugSah && !menyimpan;

  function ubahJudul(v: string) {
    setF((x) => ({ ...x, title: v, slug: slugDisunting ? x.slug : keSlug(v) }));
  }

  function reset() {
    setF({ ...KOSONG });
    setSlugDisunting(false);
    setCoverKey(null);
    setCoverPratinjau((p) => { if (p) URL.revokeObjectURL(p); return null; });
  }

  async function unggahCover(berkasFoto: File) {
    // Cover butuh slug karena kunci penyimpanannya dikelompokkan per proyek.
    const slug = f.slug.trim() || keSlug(f.title) || "tanpa-slug";
    setMengunggah(true);
    try {
      const target = await mintaUrlUnggah(slug, berkasFoto.type);
      const res = await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": berkasFoto.type }, body: berkasFoto });
      if (!res.ok) throw new Error(`Penyimpanan menolak berkas (${res.status})`);
      setCoverKey(target.key);
      setCoverPratinjau((p) => { if (p) URL.revokeObjectURL(p); return URL.createObjectURL(berkasFoto); });
    } catch (e) {
      toast({ judul: "Gagal mengunggah cover", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMengunggah(false);
    }
  }

  async function simpan() {
    if (!bisaSimpan) return;
    setMenyimpan(true);
    try {
      const { id } = await buatProyek(f.slug.trim(), f.title.trim(), f.category);

      // Endpoint pembuatan hanya menerima slug, judul, dan kategori. Sisanya
      // dikirim sebagai satu patch susulan — dan hanya yang benar-benar diisi,
      // supaya kolom kosong tidak ikut ditimpa string kosong.
      const patch: Partial<Proyek> = {};
      if (f.subtitle.trim()) patch.subtitle = f.subtitle.trim();
      if (f.summary.trim()) patch.summary = f.summary.trim();
      if (f.city.trim()) patch.city = f.city.trim();
      if (f.client.trim()) patch.client = f.client.trim();
      if (f.year.trim()) patch.year = Number(f.year);
      if (f.areaSqm.trim()) patch.areaSqm = Number(f.areaSqm);
      if (coverKey) (patch as Record<string, unknown>).coverImageKey = coverKey;

      if (Object.keys(patch).length > 0) {
        // Proyeknya sudah terbuat. Kalau patch gagal, jangan buang yang sudah
        // jadi — cukup beri tahu dan tetap lanjut ke editornya.
        try {
          await simpanProyek(id, patch);
        } catch (e) {
          toast({ judul: "Proyek dibuat, sebagian detail gagal disimpan", keterangan: (e as Error).message, nada: "gagal" });
        }
      }

      window.location.href = `/admin/proyek/edit?id=${id}`;
    } catch (e) {
      toast({ judul: "Gagal membuat proyek", keterangan: (e as Error).message, nada: "gagal" });
      setMenyimpan(false);
    }
  }

  return (
    <div className="buatpage">
      <div className="buatpage__utama">
        <section className="buat-kartu">
          <h2 className="buat-kartu__judul">Identitas proyek</h2>

          <div className="row" style={{ gap: "var(--space-4)", alignItems: "center" }}>
            <button type="button" className="buat-cover" onClick={() => berkas.current?.click()}
              aria-label="Unggah gambar sampul">
              {coverPratinjau
                ? <img src={coverPratinjau} alt="" />
                : mengunggah ? <span className="spinner spinner--sm" /> : <Icon name="image" size={22} />}
            </button>
            <span className="card__titles">
              <span className="t-subheading">Gambar sampul <span className="t-muted">(opsional)</span></span>
              <span className="t-muted" style={{ fontSize: "var(--text-sm)" }}>
                Klik kotak untuk memilih berkas. Bisa diganti kapan saja setelah proyek dibuat.
              </span>
            </span>
          </div>

          <input ref={berkas} type="file" className="sr-only"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(e) => { const b = e.target.files?.[0]; if (b) unggahCover(b); e.target.value = ""; }} />

          <div className="field">
            <label className="field__label" htmlFor="b-judul">
              Judul proyek<span className="field__req" aria-hidden="true">*</span>
            </label>
            <input id="b-judul" className="input" value={f.title} placeholder="mis. Rumah Kaca"
              onChange={(e) => ubahJudul(e.target.value)} />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="b-slug">
              Slug<span className="field__req" aria-hidden="true">*</span>
            </label>
            <input id="b-slug" className="input input--mono" value={f.slug}
              onChange={(e) => { setSlugDisunting(true); set("slug", e.target.value); }} />
            <p className="field__help">Muncul di URL: /proyek/{f.slug || "…"}</p>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="b-kat">Kategori</label>
            <span className="select">
              <select id="b-kat" className="input" value={f.category} onChange={(e) => set("category", e.target.value)}>
                {Object.entries(KATEGORI).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <span className="select__chevron"><Icon name="chevronDown" size={16} /></span>
            </span>
          </div>
        </section>

        <section className="buat-kartu">
          <h2 className="buat-kartu__judul">Detail proyek</h2>
          <p className="t-muted" style={{ margin: 0, fontSize: "var(--text-sm)" }}>
            Semuanya opsional dan bisa diisi belakangan. Yang terisi langsung tampil di halaman publik.
          </p>

          <div className="spec-grid">
            <div className="field">
              <label className="field__label" htmlFor="b-kota">Kota</label>
              <input id="b-kota" className="input" value={f.city} placeholder="mis. Pontianak"
                onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="b-tahun">Tahun</label>
              <input id="b-tahun" className="input input--mono" type="number" inputMode="numeric"
                min={1900} max={2200} value={f.year} placeholder="2026"
                onChange={(e) => set("year", e.target.value)} />
            </div>
          </div>

          <div className="spec-grid">
            <div className="field">
              <label className="field__label" htmlFor="b-klien">Klien</label>
              <input id="b-klien" className="input" value={f.client} placeholder="mis. Keluarga Wijaya"
                onChange={(e) => set("client", e.target.value)} />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="b-luas">Luas (m²)</label>
              <input id="b-luas" className="input input--mono" type="number" inputMode="numeric"
                min={0} value={f.areaSqm} placeholder="240"
                onChange={(e) => set("areaSqm", e.target.value)} />
            </div>
          </div>
        </section>

        <section className="buat-kartu">
          <h2 className="buat-kartu__judul">Ringkasan</h2>

          <div className="field">
            <label className="field__label" htmlFor="b-sub">Subjudul</label>
            <input id="b-sub" className="input" value={f.subtitle} placeholder="Satu baris penjelas di bawah judul"
              onChange={(e) => set("subtitle", e.target.value)} />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="b-ring">Ringkasan singkat</label>
            <textarea id="b-ring" className="input input--area" value={f.summary}
              placeholder="Dua sampai tiga kalimat yang muncul di kartu proyek."
              onChange={(e) => set("summary", e.target.value)} />
          </div>
        </section>
      </div>

      {/* Panel aksi menempel saat halaman digulir — di form panjang, tombol
          simpan yang ikut hilang ke bawah memaksa staf menggulir balik. */}
      <aside className="buatpage__aksi">
        <button type="button" className="btn btn--primary btn--lg btn--lift buat-aksi__utama"
          disabled={!bisaSimpan} onClick={simpan}>
          {menyimpan ? <span className="spinner spinner--sm spinner--on-action" /> : <Icon name="projectPlus" size={18} />}
          Tambah Proyek
        </button>

        <a className="btn btn--secondary btn--lg buat-aksi__utama" href="/admin/proyek">
          <Icon name="close" size={16} />Batal
        </a>

        <button type="button" className="btn btn--ghost btn--sm buat-aksi__reset" onClick={reset}>
          <Icon name="clock" size={14} />Reset form
        </button>

        {!judulSah && <p className="field__help buat-aksi__catatan">Judul minimal 2 huruf.</p>}
      </aside>
    </div>
  );
}

export function ProjectCreate() {
  return (
    <RequireAuth>
      <ToastProvider><Isi /></ToastProvider>
    </RequireAuth>
  );
}
