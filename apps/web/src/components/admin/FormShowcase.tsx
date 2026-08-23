import { useState } from "react";
import { Icon } from "../ui/Icon";
import { InputOTP } from "../ui/InputOTP";
import { PasswordInput } from "../ui/PasswordInput";

/**
 * Bagian interaktif dari galeri Form.
 *
 * Dipisah sebagai island supaya sisa halaman tetap HTML statis — hanya blok
 * ini yang membawa JavaScript ke browser.
 */
export function FormShowcase() {
  const [tab, setTab] = useState("koneksi");
  const [tampilan, setTampilan] = useState("daftar");
  const [aktif, setAktif] = useState(true);
  const [sorot, setSorot] = useState(false);
  const [lebar, setLebar] = useState(320);
  const [kode, setKode] = useState("");

  return (
    <div className="spec-grid">
      <div className="spec-demo">
        <div className="spec-demo__name">
          <span className="t-subheading">Toggle Group</span>
          <code className="swatch__name">.segmented</code>
        </div>
        <div className="spec-demo__stage spec-demo__stage--stack">
          <div className="segmented segmented--block" role="tablist" aria-label="Contoh tab">
            {[
              { id: "koneksi", label: "Koneksi" },
              { id: "otomasi", label: "Otomasi" },
              { id: "log", label: "Log" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className="segmented__opt"
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="segmented" role="group" aria-label="Tampilan daftar">
            {[
              { id: "daftar", label: "Daftar", ikon: "dashboard" as const },
              { id: "petak", label: "Petak", ikon: "component" as const },
            ].map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={tampilan === v.id}
                className="segmented__opt"
                onClick={() => setTampilan(v.id)}
              >
                <Icon name={v.ikon} size={15} />
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="spec-demo">
        <div className="spec-demo__name">
          <span className="t-subheading">Switch &amp; Toggle</span>
          <code className="swatch__name">.switch · .toggle</code>
        </div>
        <div className="spec-demo__stage spec-demo__stage--stack">
          <label className="switch">
            <input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} />
            <span className="switch__label">{aktif ? "Aktif" : "Nonaktif"}</span>
          </label>

          <label className="switch">
            <input type="checkbox" disabled />
            <span className="switch__label">Nonaktif permanen</span>
          </label>

          <button
            type="button"
            className="toggle"
            aria-pressed={sorot}
            onClick={() => setSorot((v) => !v)}
            style={{ alignSelf: "flex-start" }}
          >
            <Icon name="check" size={15} />
            Tandai unggulan
          </button>
        </div>
      </div>

      <div className="spec-demo">
        <div className="spec-demo__name">
          <span className="t-subheading">Slider</span>
          <code className="swatch__name">.slider</code>
        </div>
        <div className="spec-demo__stage spec-demo__stage--stack">
          <label className="field__label" htmlFor="lebar-demo">Lebar gambar</label>
          <div className="slider-row">
            <input
              id="lebar-demo"
              className="slider"
              type="range"
              min={120}
              max={640}
              step={20}
              value={lebar}
              onChange={(e) => setLebar(Number(e.target.value))}
            />
            <span className="slider-row__value">{lebar}</span>
          </div>
        </div>
      </div>

      <div className="spec-demo">
        <div className="spec-demo__name">
          <span className="t-subheading">Input OTP</span>
          <code className="swatch__name">InputOTP</code>
        </div>
        <div className="spec-demo__stage spec-demo__stage--stack">
          <InputOTP onComplete={setKode} />
          <p className="field__help">
            {kode ? `Kode lengkap: ${kode}` : "Tempel kode enam digit — semua kotak terisi sekaligus."}
          </p>
        </div>
      </div>

      <div className="spec-demo">
        <div className="spec-demo__name">
          <span className="t-subheading">Kata sandi</span>
          <code className="swatch__name">PasswordInput</code>
        </div>
        <div className="spec-demo__stage spec-demo__stage--stack">
          <PasswordInput
            label="Kata sandi"
            placeholder="Minimal 8 karakter"
            help="Tombol di kanan mengganti tipe field, bukan menyalin isinya ke tempat lain."
            required
          />
        </div>
      </div>
    </div>
  );
}
