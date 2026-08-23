import { useId, useState } from "react";
import { Icon } from "./Icon";

interface Props {
  label: string;
  placeholder?: string;
  help?: string;
  required?: boolean;
  name?: string;
}

/**
 * Field kata sandi dengan tombol perlihatkan/sembunyikan.
 *
 * Tombolnya mengganti `type` alih-alih menampilkan teks di elemen lain,
 * sehingga pengelola kata sandi bawaan browser tetap mengenalinya.
 */
export function PasswordInput({ label, placeholder, help, required, name }: Props) {
  const [terlihat, setTerlihat] = useState(false);
  const id = useId();
  const helpId = `${id}-help`;

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span className="field__req" aria-hidden="true">*</span>}
      </label>

      <div className="input-affix">
        <input
          id={id}
          name={name}
          className="input"
          type={terlihat ? "text" : "password"}
          placeholder={placeholder}
          required={required}
          autoComplete="current-password"
          aria-describedby={help ? helpId : undefined}
        />
        <button
          type="button"
          className="input-affix__action"
          onClick={() => setTerlihat((v) => !v)}
          aria-label={terlihat ? "Sembunyikan kata sandi" : "Perlihatkan kata sandi"}
          aria-pressed={terlihat}
        >
          <Icon name={terlihat ? "lock" : "search"} size={16} />
        </button>
      </div>

      {help && <p className="field__help" id={helpId}>{help}</p>}
    </div>
  );
}
