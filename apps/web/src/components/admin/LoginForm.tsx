import { useState, type FormEvent } from "react";
import { Icon } from "../ui/Icon";
import { masuk } from "../../lib/admin";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [lihat, setLihat] = useState(false);
  const [kirim, setKirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    setKirim(true);

    try {
      await masuk(email.trim(), sandi);
      // Ganti riwayat, bukan menambahnya: tombol kembali setelah masuk tidak
      // boleh mengembalikan orang ke halaman masuk.
      window.location.replace("/admin");
    } catch (err) {
      setGalat((err as Error).message);
      setKirim(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit} noValidate style={{ maxWidth: "24rem" }}>
      {galat && (
        <div className="alert alert--danger" role="alert">
          <span className="alert__icon"><Icon name="alert" size={18} /></span>
          <span className="alert__body"><span className="alert__text">{galat}</span></span>
        </div>
      )}

      <div className="field">
        <label className="field__label" htmlFor="masuk-email">Email</label>
        <input
          id="masuk-email"
          className="input"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="masuk-sandi">Kata sandi</label>
        <div className="input-affix">
          <input
            id="masuk-sandi"
            className="input"
            type={lihat ? "text" : "password"}
            autoComplete="current-password"
            required
            value={sandi}
            onChange={(e) => setSandi(e.target.value)}
          />
          <button
            type="button"
            className="input-affix__action"
            onClick={() => setLihat((v) => !v)}
            aria-label={lihat ? "Sembunyikan kata sandi" : "Perlihatkan kata sandi"}
            aria-pressed={lihat}
          >
            <Icon name={lihat ? "lock" : "search"} size={16} />
          </button>
        </div>
      </div>

      <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={kirim}>
        {kirim && <span className="spinner spinner--sm spinner--on-action" />}
        {kirim ? "Memeriksa…" : "Masuk"}
      </button>

      <p className="field__help">
        Akun dibuatkan oleh master admin lewat dashboard Supabase. Tidak ada pendaftaran mandiri.
      </p>
    </form>
  );
}
