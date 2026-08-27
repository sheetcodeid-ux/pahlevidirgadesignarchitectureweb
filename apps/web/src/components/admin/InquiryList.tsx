import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { Sheet } from "../ui/overlay/Dialog";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth } from "./RequireAuth";
import { daftarPesan, ubahStatusPesan, ambilSettings, type Pesan } from "../../lib/admin";

const STATUS: Record<string, { teks: string; kelas: string }> = {
  new: { teks: "Baru", kelas: "badge--brand" },
  contacted: { teks: "Dihubungi", kelas: "badge--info" },
  qualified: { teks: "Prospek", kelas: "badge--success" },
  closed: { teks: "Selesai", kelas: "" },
};

const JENIS: Record<string, string> = {
  residential: "Hunian", commercial: "Komersial", interior: "Interior",
  landscape: "Lanskap", masterplan: "Masterplan", renovation: "Renovasi",
};

function tanggal(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function Isi() {
  const toast = useToast();
  const [pesan, setPesan] = useState<Pesan[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [saring, setSaring] = useState("");
  // null selama belum diketahui, supaya spanduknya tidak berkedip muncul
  // lalu hilang setiap kali halaman dibuka.
  const [notifAktif, setNotifAktif] = useState<boolean | null>(null);

  async function muat(status: string) {
    try {
      setPesan(await daftarPesan(status));
    } catch (e) {
      setGalat((e as Error).message);
    }
  }

  useEffect(() => { muat(saring); }, [saring]);

  useEffect(() => {
    ambilSettings()
      .then((s) => setNotifAktif(s.notifikasiEmailAktif !== false))
      .catch(() => setNotifAktif(null));
  }, []);

  async function ubah(p: Pesan, status: string) {
    try {
      await ubahStatusPesan(p.id, status);
      setPesan((cur) => cur?.map((x) => (x.id === p.id ? { ...x, status } : x)) ?? null);
      toast({ judul: "Status diperbarui", keterangan: `${p.name} → ${STATUS[status].teks}`, nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal memperbarui", keterangan: (e as Error).message, nada: "gagal" });
    }
  }

  if (galat) {
    return (
      <div className="alert alert--danger" role="alert">
        <span className="alert__icon"><Icon name="alert" size={18} /></span>
        <span className="alert__body">
          <span className="alert__title">Gagal memuat pesan</span>
          <span className="alert__text">{galat}</span>
        </span>
      </div>
    );
  }

  if (!pesan) {
    return <div className="stack">{[0, 1, 2].map((i) => <span key={i} className="skeleton" style={{ height: "4.5rem" }} />)}</div>;
  }

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      {notifAktif === false && (
        <div className="alert alert--warn" role="status">
          <span className="alert__icon"><Icon name="alert" size={18} /></span>
          <span className="alert__body">
            <span className="alert__title">Pemberitahuan email mati</span>
            <span className="alert__text">
              Pesan masuk tetap tersimpan dan tampil di sini, tapi tidak ada email
              yang dikirim ke studio. Setel rahasia Worker RESEND_API_KEY dan
              INQUIRY_NOTIFY_TO untuk menghidupkannya.
            </span>
          </span>
        </div>
      )}

      <div className="segmented" role="group" aria-label="Saring status pesan">
        {[
          { id: "", label: "Semua" },
          { id: "new", label: "Baru" },
          { id: "contacted", label: "Dihubungi" },
          { id: "qualified", label: "Prospek" },
          { id: "closed", label: "Selesai" },
        ].map((s) => (
          <button key={s.id} type="button" className="segmented__opt"
            aria-pressed={saring === s.id} onClick={() => setSaring(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

      {pesan.length === 0 ? (
        <div className="empty">
          <span className="icon-tile"><Icon name="inquiry" size={20} /></span>
          <span className="t-subheading">Belum ada pesan masuk</span>
          <p className="t-muted">Pesan dari form kontak akan muncul di sini, dan salinannya dikirim ke email studio.</p>
        </div>
      ) : (
        <div className="stack" style={{ gap: "var(--space-3)" }}>
          {pesan.map((p) => (
            <div className="card" key={p.id}>
              <div className="card__header">
                <span className="icon-tile"><Icon name="inquiry" size={18} /></span>
                <span className="card__titles">
                  <span className="row" style={{ gap: "var(--space-2)" }}>
                    <span className="t-subheading">{p.name}</span>
                    <span className={`badge ${STATUS[p.status]?.kelas ?? ""}`}>
                      {p.status === "new" && <span className="badge__dot" />}
                      {STATUS[p.status]?.teks ?? p.status}
                    </span>
                  </span>
                  <span className="t-muted">
                    {p.email}
                    {p.projectType ? ` · ${JENIS[p.projectType] ?? p.projectType}` : ""}
                    {` · ${tanggal(p.createdAt)}`}
                  </span>
                </span>

                <Sheet
                  title={p.name}
                  description={`${p.email} · ${tanggal(p.createdAt)}`}
                  trigger={<button type="button" className="btn btn--secondary btn--sm">Buka</button>}
                  footer={
                    <a className="btn btn--primary" href={`mailto:${p.email}?subject=${encodeURIComponent("Balasan dari Studio Dirga Pahlevi Architecture")}`}>
                      Balas lewat email
                    </a>
                  }
                >
                  <div className="stack">
                    <div className="bubble">{p.message}</div>
                    <dl className="stack" style={{ gap: "var(--space-2)" }}>
                      {[
                        ["Telepon", p.phone],
                        ["Jenis proyek", p.projectType ? JENIS[p.projectType] : undefined],
                        ["Anggaran", p.budgetRange],
                      ]
                        .filter(([, v]) => v)
                        .map(([k, v]) => (
                          <div className="row row--between" key={String(k)}>
                            <dt className="t-label" style={{ margin: 0 }}>{k}</dt>
                            <dd className="t-body" style={{ margin: 0 }}>{v}</dd>
                          </div>
                        ))}
                    </dl>

                    <span className="t-label">Ubah status</span>
                    <div className="segmented segmented--block" role="group" aria-label="Ubah status pesan">
                      {Object.entries(STATUS).map(([v, s]) => (
                        <button key={v} type="button" className="segmented__opt"
                          aria-pressed={p.status === v} onClick={() => ubah(p, v)}>
                          {s.teks}
                        </button>
                      ))}
                    </div>
                  </div>
                </Sheet>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function InquiryList() {
  return (
    <RequireAuth>
      <ToastProvider><Isi /></ToastProvider>
    </RequireAuth>
  );
}
