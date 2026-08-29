import { useState } from "react";
import { Icon } from "../ui/Icon";
import { Avatar } from "../ui/misc/Avatar";
import { ToastProvider, useToast } from "../ui/overlay/Toast";
import { RequireAuth, useProfil } from "./RequireAuth";
import { SkeletonKartu, SkeletonIsian } from "../ui/Skeleton";
import { ubahPassword } from "../../lib/admin";

function Isi() {
  const profil = useProfil();
  const toast = useToast();
  const [sandiBaru, setSandiBaru] = useState("");
  const [konfirmasi, setKonfirmasi] = useState("");
  const [mengubah, setMengubah] = useState(false);

  const cocok = sandiBaru.length > 0 && sandiBaru === konfirmasi;

  async function simpan() {
    if (!cocok || sandiBaru.length < 8) return;
    setMengubah(true);
    try {
      await ubahPassword(sandiBaru);
      setSandiBaru("");
      setKonfirmasi("");
      toast({ judul: "Kata sandi diubah", nada: "sukses" });
    } catch (e) {
      toast({ judul: "Gagal mengubah kata sandi", keterangan: (e as Error).message, nada: "gagal" });
    } finally {
      setMengubah(false);
    }
  }

  return (
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div className="card">
        <div className="card__header">
          <Avatar name={profil.email.split("@")[0]} brand />
          <span className="card__titles">
            <span className="t-subheading">{profil.email}</span>
            <span className="t-muted">{profil.isMasterAdmin ? "Master admin" : "Staf"}</span>
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <span className="icon-tile"><Icon name="lock" size={20} /></span>
          <span className="card__titles">
            <span className="t-subheading">Ganti kata sandi</span>
            <span className="t-muted">Berlaku langsung, sesi lain akan diminta masuk ulang.</span>
          </span>
        </div>
        <div className="card__body">
          <div className="stack">
            <div className="field">
              <label className="field__label" htmlFor="ak-baru">Kata sandi baru</label>
              <input id="ak-baru" type="password" className="input" value={sandiBaru}
                onChange={(e) => setSandiBaru(e.target.value)} />
              <p className="field__help">Minimal 8 karakter.</p>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="ak-konfirmasi">Ulangi kata sandi baru</label>
              <input id="ak-konfirmasi" type="password" className="input" value={konfirmasi}
                onChange={(e) => setKonfirmasi(e.target.value)} />
              {konfirmasi.length > 0 && !cocok && (
                <p className="field__error">Belum sama dengan kata sandi baru.</p>
              )}
            </div>
            <div className="row row--end">
              <button type="button" className="btn btn--primary"
                disabled={!cocok || sandiBaru.length < 8 || mengubah} onClick={simpan}>
                {mengubah && <span className="spinner spinner--sm spinner--on-action" />}
                Simpan kata sandi
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AccountPanel() {
  return (
    <RequireAuth skeleton={<SkeletonKartu ikon="user" anak={<SkeletonIsian jumlah={2} />} />}>
      <ToastProvider><Isi /></ToastProvider>
    </RequireAuth>
  );
}
