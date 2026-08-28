import { useEffect, useState } from "react";
import { Icon } from "./ui/Icon";
import { PemutarSuara } from "./ui/misc/VoiceNote";
import { Balok, SkeletonKartu, SkeletonIsian, SkeletonDaftar } from "./ui/Skeleton";
import { formatRupiah } from "../lib/format";

const API = (import.meta.env.PUBLIC_API_BASE_URL ?? "http://localhost:8787").replace(/\/$/, "");

const FASE: [string, string][] = [
  ["konsultasi", "Konsultasi"],
  ["konsep", "Konsep"],
  ["ded", "DED"],
  ["perizinan", "Perizinan"],
  ["konstruksi", "Konstruksi"],
  ["selesai", "Selesai"],
];

interface Update {
  id: string;
  title: string;
  note?: string | null;
  photoUrl?: string | null;
  createdAt: string;
}

interface Komentar {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

interface Dokumen {
  id: string;
  title: string;
  fileUrl: string;
  /** 'suara' = pesan suara dari studio; ditampilkan sebagai pemutar, bukan tautan. */
  kind: "berkas" | "suara";
  status: string;
  clientNote?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  durationMs?: number | null;
  comments: Komentar[];
}

interface Tagihan {
  id: string;
  label: string;
  amount: number;
  status: string;
  dueDate?: string | null;
}

interface Brief {
  budgetRange?: string | null;
  timeline?: string | null;
  stylePreference?: string | null;
  requirements?: string | null;
  submittedAt?: string | null;
}

interface View {
  projectTitle: string;
  coverImageUrl?: string | null;
  phase: string;
  updates: Update[];
  documents: Dokumen[];
  invoices: Tagihan[];
  brief: Brief;
}

const BADGE_DOKUMEN: Record<string, string> = {
  draft: "badge--info",
  menunggu_klien: "badge--warn",
  revisi_diminta: "badge--warn",
  disetujui: "badge--success",
  final: "badge--success",
};

const LABEL_DOKUMEN: Record<string, string> = {
  draft: "Draf",
  menunggu_klien: "Menunggu tanggapan Anda",
  revisi_diminta: "Revisi diminta",
  disetujui: "Disetujui",
  final: "Final",
};

const BADGE_TAGIHAN: Record<string, string> = {
  draft: "badge--info",
  terbit: "badge--warn",
  lunas: "badge--success",
};

const LABEL_TAGIHAN: Record<string, string> = {
  draft: "Draf",
  terbit: "Menunggu pembayaran",
  lunas: "Lunas",
};

/** Thread komentar per dokumen — di luar alur setujui/minta-revisi, untuk tanya-jawab bebas. */
function ThreadKomentarKlien({ dokumen, token }: { dokumen: Dokumen; token: string }) {
  const [komentar, setKomentar] = useState<Komentar[]>(dokumen.comments);
  const [isi, setIsi] = useState("");
  const [mengirim, setMengirim] = useState(false);

  async function kirim() {
    const bersih = isi.trim();
    if (bersih.length < 1) return;
    setMengirim(true);
    try {
      const res = await fetch(`${API}/api/v1/progress/${token}/documents/${dokumen.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: bersih }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? "gagal mengirim komentar");
      const { data } = await res.json();
      setKomentar((k) => [...k, { id: data.id, author: "klien", body: bersih, createdAt: new Date().toISOString() }]);
      setIsi("");
    } catch {
      // Diamkan — pengguna bisa coba lagi lewat tombol yang sama.
    } finally {
      setMengirim(false);
    }
  }

  return (
    <details className="collapsible">
      <summary>Komentar{komentar.length > 0 && ` (${komentar.length})`}
        <span className="collapsible__chevron"><Icon name="chevronDown" size={16} /></span>
      </summary>
      <div className="collapsible__body stack" style={{ gap: "var(--space-3)" }}>
        {komentar.length === 0 ? (
          <p className="t-muted">Belum ada komentar.</p>
        ) : (
          <ul className="stack" style={{ gap: "var(--space-2)", listStyle: "none", padding: 0 }}>
            {komentar.map((k) => (
              <li key={k.id}>
                <span className="t-label">{k.author === "staf" ? "Studio" : "Anda"}</span>
                <p>{k.body}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="row" style={{ gap: "var(--space-2)" }}>
          <input className="input" value={isi} onChange={(e) => setIsi(e.target.value)}
            placeholder="Tulis pertanyaan atau catatan..." style={{ flex: 1 }} />
          <button type="button" className="btn btn--secondary btn--sm" disabled={isi.trim().length < 1 || mengirim} onClick={kirim}>
            Kirim
          </button>
        </div>
      </div>
    </details>
  );
}

/** Satu dokumen dengan aksi setujui/minta-revisi — form revisi baru muncul saat ditekan. */
function BarisDokumen({ dokumen, token, onBerubah }: { dokumen: Dokumen; token: string; onBerubah: () => void }) {
  const [formRevisi, setFormRevisi] = useState(false);
  const [catatan, setCatatan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function setujui() {
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch(`${API}/api/v1/progress/${token}/documents/${dokumen.id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? "gagal menyetujui");
      onBerubah();
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  }

  async function kirimRevisi() {
    if (catatan.trim().length < 2) return;
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch(`${API}/api/v1/progress/${token}/documents/${dokumen.id}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: catatan.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? "gagal mengirim catatan revisi");
      setFormRevisi(false);
      setCatatan("");
      onBerubah();
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  }

  return (
    <li className="card">
      <div className="card__body stack" style={{ gap: "var(--space-3)" }}>
        <div className="row row--between" style={{ alignItems: "flex-start" }}>
          <span className="stack" style={{ gap: "var(--space-1)" }}>
            <span className="t-subheading">{dokumen.title}</span>
            {dokumen.kind === "suara" ? (
              <PemutarSuara url={dokumen.fileUrl} durationMs={dokumen.durationMs} label={dokumen.title} />
            ) : (
              <a href={dokumen.fileUrl} target="_blank" rel="noreferrer" className="row" style={{ gap: "var(--space-1)", alignItems: "center" }}>
                <Icon name="document" size={14} />Lihat / unduh
              </a>
            )}
          </span>
          <span className={`badge ${BADGE_DOKUMEN[dokumen.status] ?? "badge--info"}`}>
            <span className="badge__dot" />{LABEL_DOKUMEN[dokumen.status] ?? dokumen.status}
          </span>
        </div>

        {dokumen.status === "revisi_diminta" && dokumen.clientNote && (
          <p className="t-muted">Catatan revisi Anda: {dokumen.clientNote}</p>
        )}

        {dokumen.status === "menunggu_klien" && !formRevisi && (
          <div className="row" style={{ gap: "var(--space-2)" }}>
            <button type="button" className="btn btn--primary btn--sm" disabled={sibuk} onClick={setujui}>
              <Icon name="check" size={14} />Setujui
            </button>
            <button type="button" className="btn btn--secondary btn--sm" disabled={sibuk} onClick={() => setFormRevisi(true)}>
              Minta revisi
            </button>
          </div>
        )}

        {dokumen.status === "menunggu_klien" && formRevisi && (
          <div className="stack" style={{ gap: "var(--space-2)" }}>
            <textarea className="input input--area" value={catatan} onChange={(e) => setCatatan(e.target.value)}
              placeholder="Bagian mana yang perlu direvisi?" />
            <div className="row" style={{ gap: "var(--space-2)" }}>
              <button type="button" className="btn btn--primary btn--sm" disabled={catatan.trim().length < 2 || sibuk}
                onClick={kirimRevisi}>
                Kirim catatan revisi
              </button>
              <button type="button" className="btn btn--ghost btn--sm" disabled={sibuk} onClick={() => setFormRevisi(false)}>
                Batal
              </button>
            </div>
          </div>
        )}

        {galat && <p className="field__error">{galat}</p>}

        <ThreadKomentarKlien dokumen={dokumen} token={token} />
      </div>
    </li>
  );
}

/** Klien mengisi atau memperbarui brief awal proyeknya sendiri. */
function FormBrief({ brief, token }: { brief: Brief; token: string }) {
  const [budgetRange, setBudgetRange] = useState(brief.budgetRange ?? "");
  const [timeline, setTimeline] = useState(brief.timeline ?? "");
  const [stylePreference, setStylePreference] = useState(brief.stylePreference ?? "");
  const [requirements, setRequirements] = useState(brief.requirements ?? "");
  const [sibuk, setSibuk] = useState(false);
  const [terkirim, setTerkirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function kirim() {
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch(`${API}/api/v1/progress/${token}/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetRange, timeline, stylePreference, requirements }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? "gagal mengirim brief");
      setTerkirim(true);
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  }

  return (
    <details className="collapsible" open={!brief.submittedAt}>
      <summary>{brief.submittedAt ? "Ubah kebutuhan awal" : "Ceritakan kebutuhan Anda"}
        <span className="collapsible__chevron"><Icon name="chevronDown" size={16} /></span>
      </summary>
      <div className="collapsible__body stack" style={{ gap: "var(--space-3)" }}>
        <p className="t-muted">
          Semakin lengkap informasinya, semakin cepat studio menyusun konsep awal.
        </p>
        <div className="field">
          <label className="field__label" htmlFor="brief-budget">Kisaran anggaran</label>
          <input id="brief-budget" className="input" value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)}
            placeholder="Contoh: 300-500jt" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="brief-waktu">Target waktu</label>
          <input id="brief-waktu" className="input" value={timeline} onChange={(e) => setTimeline(e.target.value)}
            placeholder="Contoh: mulai konstruksi awal tahun depan" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="brief-gaya">Preferensi gaya</label>
          <input id="brief-gaya" className="input" value={stylePreference} onChange={(e) => setStylePreference(e.target.value)}
            placeholder="Contoh: tropis modern" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="brief-kebutuhan">Kebutuhan ruang/fungsi</label>
          <textarea id="brief-kebutuhan" className="input input--area" value={requirements}
            onChange={(e) => setRequirements(e.target.value)} placeholder="Contoh: 3 kamar tidur, ruang kerja, carport 2 mobil" />
        </div>
        <div className="row" style={{ gap: "var(--space-2)", alignItems: "center" }}>
          <button type="button" className="btn btn--primary btn--sm" disabled={sibuk} onClick={kirim}>
            {sibuk && <span className="spinner spinner--sm spinner--on-action" />}
            Kirim ke studio
          </button>
          {terkirim && <span className="t-muted">Tersimpan.</span>}
        </div>
        {galat && <p className="field__error">{galat}</p>}
      </div>
    </details>
  );
}

/** Bintang rating yang bisa diklik, 1-5. */
function PemilihBintang({ nilai, onUbah }: { nilai: number; onUbah: (n: number) => void }) {
  return (
    <div className="row" style={{ gap: "var(--space-1)" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className="btn btn--ghost btn--icon" aria-label={`${n} bintang`}
          onClick={() => onUbah(n)} style={{ color: n <= nilai ? "var(--text-strong)" : "var(--text-faint)" }}>
          <Icon name="star" size={18} variant={n <= nilai ? "filled" : "stroke"} />
        </button>
      ))}
    </div>
  );
}

/** Klien mengirim testimoni — selalu masuk sebagai "menunggu" moderasi studio. */
function FormTestimoni({ token }: { token: string }) {
  const [nama, setNama] = useState("");
  const [kutipan, setKutipan] = useState("");
  const [rating, setRating] = useState(0);
  const [sibuk, setSibuk] = useState(false);
  const [terkirim, setTerkirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function kirim() {
    if (nama.trim().length < 2 || kutipan.trim().length < 2) return;
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch(`${API}/api/v1/progress/${token}/testimonial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName: nama.trim(), quote: kutipan.trim(), rating: rating || null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? "gagal mengirim testimoni");
      setTerkirim(true);
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  }

  if (terkirim) {
    return (
      <div className="empty empty--sm">
        <span className="icon-tile"><Icon name="quote" size={20} /></span>
        <span className="t-subheading">Terima kasih!</span>
        <p className="t-muted">Testimoni Anda akan tampil di situs setelah ditinjau studio.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card__header">
        <span className="icon-tile"><Icon name="quote" size={20} /></span>
        <span className="card__titles">
          <span className="t-subheading">Bagikan pengalaman Anda</span>
          <span className="t-muted">Testimoni ditinjau studio dulu sebelum tampil di situs.</span>
        </span>
      </div>
      <div className="card__body stack">
        <PemilihBintang nilai={rating} onUbah={setRating} />
        <div className="field">
          <label className="field__label" htmlFor="test-nama">Nama Anda</label>
          <input id="test-nama" className="input" value={nama} onChange={(e) => setNama(e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="test-kutipan">Testimoni</label>
          <textarea id="test-kutipan" className="input input--area" value={kutipan}
            onChange={(e) => setKutipan(e.target.value)} placeholder="Bagaimana pengalaman Anda bekerja sama dengan studio?" />
        </div>
        <div className="row row--end">
          <button type="button" className="btn btn--primary" disabled={nama.trim().length < 2 || kutipan.trim().length < 2 || sibuk}
            onClick={kirim}>
            {sibuk && <span className="spinner spinner--sm spinner--on-action" />}
            Kirim testimoni
          </button>
        </div>
        {galat && <p className="field__error">{galat}</p>}
      </div>
    </div>
  );
}

type Status = "memuat" | "siap" | "tidak-ditemukan";

/**
 * Dilihat klien lewat link token, tanpa login — bukan panel admin, jadi
 * fetch langsung ke API publik, bukan lewat lib/admin.ts yang mengharuskan
 * token sesi staf.
 */
export function ClientProgressView() {
  const [status, setStatus] = useState<Status>("memuat");
  const [data, setData] = useState<View | null>(null);
  const token = typeof window !== "undefined" ? new URLSearchParams(location.search).get("t") ?? "" : "";

  function muat() {
    if (!token) { setStatus("tidak-ditemukan"); return; }

    fetch(`${API}/api/v1/progress/${token}`, { headers: { Accept: "application/json" } })
      .then(async (res) => {
        if (!res.ok) { setStatus("tidak-ditemukan"); return; }
        const body = await res.json();
        setData(body.data as View);
        setStatus("siap");
      })
      .catch(() => setStatus("tidak-ditemukan"));
  }

  useEffect(muat, []);

  if (status === "memuat") {
    return (
      /* Mengikuti urutan halaman sungguhannya: judul proyek, form brief,
         stepper fase, lalu kartu dokumen. Klien melihat kerangka halaman
         yang sama persis dengan yang sebentar lagi terisi. */
      <div className="stack" style={{ gap: "var(--space-7)" }}>
        <div className="stack" style={{ gap: "var(--space-2)" }}>
          <Balok lebar="8rem" tinggi="0.7rem" />
          <Balok lebar="70%" tinggi="2.5rem" />
        </div>
        <SkeletonKartu ikon="quote" anak={<SkeletonIsian jumlah={4} />} />
        <Balok tinggi="3rem" style={{ borderRadius: "var(--radius-pill)" }} />
        <SkeletonKartu ikon="document" anak={<SkeletonDaftar jumlah={2} aksi={0} />} />
      </div>
    );
  }

  if (status === "tidak-ditemukan" || !data) {
    return (
      <div className="empty">
        <span className="icon-tile"><Icon name="lock" size={22} /></span>
        <span className="t-subheading">Link tidak ditemukan</span>
        <p className="t-muted">
          Link ini mungkin sudah tidak berlaku. Hubungi studio untuk mendapatkan link progres terbaru.
        </p>
        <a className="btn btn--primary" href="/kontak">Hubungi studio</a>
      </div>
    );
  }

  const indeksFase = FASE.findIndex(([nilai]) => nilai === data.phase);

  return (
    <div className="stack" style={{ gap: "var(--space-7)" }}>
      <div>
        {data.coverImageUrl && (
          <div className="aspect aspect--16-9" style={{ marginBottom: "var(--space-5)" }}>
            <img src={data.coverImageUrl} alt={data.projectTitle} />
          </div>
        )}
        <p className="eyebrow">Progres proyek</p>
        <h1>{data.projectTitle}</h1>
      </div>

      <FormBrief brief={data.brief} token={token} />

      <ol className="progres-stepper">
        {FASE.map(([nilai, label], i) => (
          <li
            key={nilai}
            className="progres-stepper__step"
            data-done={i < indeksFase || undefined}
            data-current={i === indeksFase || undefined}
          >
            <span className="progres-stepper__dot" aria-hidden="true">
              {i < indeksFase ? <Icon name="check" size={12} /> : null}
            </span>
            <span className="progres-stepper__label">{label}</span>
          </li>
        ))}
      </ol>

      <div>
        <p className="eyebrow">Linimasa</p>
        {data.updates.length === 0 ? (
          <p className="t-muted">Belum ada catatan progres.</p>
        ) : (
          <ol className="progres-timeline">
            {data.updates.map((u) => (
              <li key={u.id} className="progres-timeline__item">
                <span className="progres-timeline__dot" aria-hidden="true" />
                <div className="progres-timeline__body">
                  <span className="t-mono t-muted progres-timeline__date">
                    {new Date(u.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                  <span className="t-subheading">{u.title}</span>
                  {u.note && <p className="t-muted">{u.note}</p>}
                  {u.photoUrl && (
                    <div className="aspect aspect--16-9 progres-timeline__photo">
                      <img src={u.photoUrl} alt={u.title} loading="lazy" />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {data.documents.length > 0 && (
        <div>
          <p className="eyebrow">Dokumen</p>
          <ul className="stack" style={{ gap: "var(--space-3)", listStyle: "none", padding: 0 }}>
            {data.documents.map((d) => (
              <BarisDokumen key={d.id} dokumen={d} token={token} onBerubah={muat} />
            ))}
          </ul>
        </div>
      )}

      {data.invoices.length > 0 && (
        <div>
          <p className="eyebrow">Tagihan</p>
          <ul className="stack" style={{ gap: "var(--space-2)", listStyle: "none", padding: 0 }}>
            {data.invoices.map((i) => (
              <li key={i.id} className="item item--bordered">
                <span className="item__text">
                  <span className="item__title">{i.label}</span>
                  <span className="item__desc t-mono">{formatRupiah(i.amount)}</span>
                </span>
                <span className={`badge ${BADGE_TAGIHAN[i.status] ?? "badge--info"}`}>
                  <span className="badge__dot" />{LABEL_TAGIHAN[i.status] ?? i.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <FormTestimoni token={token} />
    </div>
  );
}
