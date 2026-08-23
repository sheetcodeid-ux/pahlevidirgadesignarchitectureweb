import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { Tabs } from "../ui/misc/Nav";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { daftarProyek, simpanProyek, mintaUrlUnggah, type Proyek } from "../../lib/admin";

const KATEGORI: Record<string, string> = {
  residential: "Hunian", commercial: "Komersial", interior: "Interior",
  landscape: "Lanskap", masterplan: "Masterplan", renovation: "Renovasi",
};

type Draf = Partial<Proyek>;

function Isi() {
  const toast = useToast();
  const [asli, setAsli] = useState<Proyek | null>(null);
  const [draf, setDraf] = useState<Draf>({});
  const [galat, setGalat] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const berkas = useRef<HTMLInputElement>(null);

  const id = typeof window !== "undefined" ? new URLSearchParams(location.search).get("id") : null;

  useEffect(() => {
    if (!id) { setGalat("Tidak ada proyek yang dipilih."); return; }
    daftarProyek()
      .then((semua) => {
        const p = semua.find((x) => x.id === id);
        if (!p) { setGalat("Proyek tidak ditemukan."); return; }
        setAsli(p);
      })
      .catch((e) => setGalat((e as Error).message));
  }, [id]);

  // Hanya field yang benar-benar berubah yang dikirim. Selain lebih hemat, ini
  // menghindarkan dua orang yang menyunting bersamaan saling menimpa kolom
  // yang tidak mereka sentuh.
  const berubah = Object.keys(draf).filter((k) => draf[k as keyof Draf] !== asli?.[k as keyof Proyek]);
  const adaPerubahan = berubah.length > 0;

  function set<K extends keyof Proyek>(kunci: K, nilai: Proyek[K]) {
    setDraf((d) => ({ ...d, [kunci]: nilai }));
  }

  const nilai = <K extends keyof Proyek>(kunci: K): Proyek[K] | undefined =>
    (kunci in draf ? draf[kunci] : asli?.[kunci]) as Proyek[K] | undefined;

  async function simpan() {
    if (!asli || !adaPerubahan) return;
    setMenyimpan(true);
    try {
      const patch: Record<string, unknown> = {};
      berubah.forEach((k) => { patch[k] = draf[k as keyof Draf]; });
      await simpanProyek(asli.id, patch);
      setAsli({ ...asli, ...draf } as Proyek);
      setDraf({});
      toast({ judul: "Perubahan disimpan", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal menyimpan", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMenyimpan(false);
    }
  }

  async function unggah(f: File) {
    if (!asli) return;
    try {
      const target = await mintaUrlUnggah(asli.slug, f.type);
      const res = await fetch(target.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": f.type },
        body: f,
      });
      if (!res.ok) throw new Error(`Penyimpanan menolak berkas (${res.status})`);

      set("coverImageKey" as keyof Proyek, target.key as never);
      toast({ judul: "Gambar terunggah", keterangan: "Tekan Simpan untuk menerapkannya.", nada: "sukses" });
    } catch (e) {
      toast({
        judul: "Gagal mengunggah",
        keterangan: `${(e as Error).message}. Penyimpanan R2 mungkin belum dikonfigurasi.`,
        nada: "gagal",
      });
    }
  }

  if (galat) {
    return (
      <div className="empty">
        <span className="icon-tile"><Icon name="alert" size={20} /></span>
        <span className="t-subheading">{galat}</span>
        <a className="btn btn--secondary" href="/admin/proyek">Kembali ke daftar</a>
      </div>
    );
  }

  if (!asli) {
    return <div className="stack">{[0, 1].map((i) => <span key={i} className="skeleton" style={{ height: "8rem" }} />)}</div>;
  }

  const detail = (
    <div className="stack">
      <div className="field">
        <label className="field__label" htmlFor="ed-judul">Judul</label>
        <input id="ed-judul" className="input" value={String(nilai("title") ?? "")}
          onChange={(e) => set("title", e.target.value)} />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="ed-slug">Slug</label>
        <input id="ed-slug" className="input input--mono" value={String(nilai("slug") ?? "")}
          onChange={(e) => set("slug", e.target.value)} />
        <p className="field__help">
          Mengubah slug memutus tautan lama ke halaman ini.
        </p>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="ed-sub">Subjudul</label>
        <input id="ed-sub" className="input" value={String(nilai("subtitle") ?? "")}
          onChange={(e) => set("subtitle", e.target.value)} />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="ed-ring">Ringkasan</label>
        <textarea id="ed-ring" className="input input--area" value={String(nilai("summary") ?? "")}
          onChange={(e) => set("summary", e.target.value)} />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="ed-desc">Deskripsi</label>
        <textarea id="ed-desc" className="input input--area" style={{ minHeight: "10rem" }}
          value={String(nilai("description") ?? "")} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div className="spec-grid">
        <div className="field">
          <label className="field__label" htmlFor="ed-kota">Kota</label>
          <input id="ed-kota" className="input" value={String(nilai("city") ?? "")}
            onChange={(e) => set("city", e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ed-lok">Lokasi</label>
          <input id="ed-lok" className="input" value={String(nilai("location") ?? "")}
            onChange={(e) => set("location", e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ed-tahun">Tahun</label>
          <input id="ed-tahun" className="input" type="number" value={String(nilai("year") ?? "")}
            onChange={(e) => set("year", Number(e.target.value) as never)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ed-luas">Luas (m²)</label>
          <input id="ed-luas" className="input" type="number" value={String(nilai("areaSqm") ?? "")}
            onChange={(e) => set("areaSqm", Number(e.target.value) as never)} />
        </div>
      </div>
    </div>
  );

  const galeri = (
    <div className="stack">
      {nilai("coverImageUrl") || nilai("coverImageKey" as keyof Proyek) ? (
        <div className="aspect aspect--16-9">
          {nilai("coverImageUrl") ? (
            <img src={String(nilai("coverImageUrl"))} alt={`Cover ${asli.title}`} />
          ) : (
            <div style={{ display: "grid", placeItems: "center", color: "var(--text-faint)" }}>
              Cover baru tersimpan — tekan Simpan untuk menerapkannya
            </div>
          )}
        </div>
      ) : (
        <div className="dropzone">
          <span className="icon-tile"><Icon name="image" size={20} /></span>
          <span className="t-subheading">Belum ada cover</span>
          <span className="t-muted">Proyek tidak bisa diterbitkan tanpa cover.</span>
        </div>
      )}

      <input ref={berkas} type="file" className="sr-only"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) unggah(f); }} />
      <button type="button" className="btn btn--secondary" onClick={() => berkas.current?.click()}>
        <Icon name="upload" size={15} />Unggah cover
      </button>
      <p className="field__help">
        Berkas dikirim langsung ke penyimpanan lewat URL berbatas waktu — tidak melewati server API.
      </p>
    </div>
  );

  const seo = (
    <div className="stack">
      <div className="field">
        <label className="field__label" htmlFor="ed-seot">Judul SEO</label>
        <input id="ed-seot" className="input" value={String(nilai("seoTitle") ?? "")}
          onChange={(e) => set("seoTitle", e.target.value)} />
        <p className="field__help">Kosongkan untuk memakai judul proyek.</p>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="ed-seod">Deskripsi SEO</label>
        <textarea id="ed-seod" className="input input--area" value={String(nilai("seoDescription") ?? "")}
          onChange={(e) => set("seoDescription", e.target.value)} />
      </div>
    </div>
  );

  const bisaTerbit = Boolean(nilai("coverImageUrl") || nilai("coverImageKey" as keyof Proyek));

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div className="row row--between">
        <a className="btn btn--ghost btn--sm" href="/admin/proyek">
          <Icon name="chevronLeft" size={15} />Semua proyek
        </a>
        <span className="row" style={{ gap: "var(--space-2)" }}>
          {adaPerubahan && (
            <span className="marker marker--warn"><span className="marker__dot" />{berubah.length} perubahan belum disimpan</span>
          )}
          <button type="button" className="btn btn--primary" disabled={!adaPerubahan || menyimpan} onClick={simpan}>
            {menyimpan && <span className="spinner spinner--sm spinner--on-action" />}
            Simpan
          </button>
        </span>
      </div>

      <div className="card">
        <div className="card__header">
          <span className="icon-tile"><Icon name="project" size={20} /></span>
          <span className="card__titles">
            <span className="t-subheading">Status terbit</span>
            <span className="t-muted">
              {bisaTerbit ? "Proyek siap diterbitkan." : "Unggah cover dulu sebelum menerbitkan."}
            </span>
          </span>
        </div>
        <div className="card__body">
          <div className="stack" style={{ gap: "var(--space-2)" }}>
            {[
              { v: "draft", t: "Draf", d: "Hanya terlihat oleh staf studio." },
              { v: "published", t: "Terbit", d: "Tampil di situs setelah build berikutnya." },
              { v: "archived", t: "Arsip", d: "Disembunyikan tanpa dihapus." },
            ].map((s) => (
              <label className="radio-card" key={s.v}>
                <input type="radio" name="ed-status" checked={nilai("status") === s.v}
                  disabled={s.v === "published" && !bisaTerbit}
                  onChange={() => set("status", s.v)} />
                <span className="radio-card__mark"><Icon name="check" size={14} /></span>
                <span className="radio-card__body">
                  <span className="radio-card__title">{s.t}</span>
                  <span className="radio-card__desc">{s.d}</span>
                </span>
              </label>
            ))}
            <label className="choice" style={{ marginTop: "var(--space-2)" }}>
              <input type="checkbox" checked={Boolean(nilai("isFeatured"))}
                onChange={(e) => set("isFeatured", e.target.checked)} />
              <span className="choice__text">
                <span>Tampilkan di beranda</span>
                <span className="choice__desc">Proyek unggulan muncul di halaman depan.</span>
              </span>
            </label>
          </div>
        </div>
      </div>

      <Tabs
        items={[
          { id: "detail", label: "Detail", content: detail },
          { id: "galeri", label: "Galeri", content: galeri },
          { id: "seo", label: "SEO", content: seo },
        ]}
      />

      <p className="field__help">
        Kategori: {KATEGORI[String(nilai("category"))] ?? nilai("category")}
      </p>
    </div>
  );
}

export function ProjectEditor() {
  return (
    <RequireAuth>
      <ToastProvider><Isi /></ToastProvider>
    </RequireAuth>
  );
}
