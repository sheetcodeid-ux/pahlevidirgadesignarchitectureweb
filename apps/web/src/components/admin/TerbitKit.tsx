import { Sembul } from "../kit/Overlay";
import { Peringatan, Putar } from "../kit/Tampilan";
import { useEffect, useRef, useState } from "react";
import { Tombol } from "../kit/Tombol";
import { Ikon } from "../kit/Ikon";
import { Globe, NotePencil, CheckCircle, HourglassHigh } from "../kit/ikon";
import { ambilSettings } from "../../lib/admin";
import { useTerbit, sejak, jamTanggal } from "./useTerbit";
import { tanggalRevisi } from "./jamStudio";

/* =============================================================================
   Tombol Terbitkan di kepala halaman kit — STEMPEL REVISI.

   Menerbitkan situs publik = menerbitkan revisi baru set gambar: rel samping
   menulis "REV dd.mm.yy" di sampulnya, dan stempel ini menulis tanggal yang
   sama di kepala halaman, ditambah keadaannya (sudah tayang / ada perubahan /
   sedang terbit). Bentuknya cap karet bercincin rangkap, bukan tombol bulat:
   ia satu-satunya tombol di kepala yang membawa DATA, dan data itu harus
   terbaca tanpa membukanya.

   Keadaannya dari useTerbit yang sama dengan bilah atas lama. Gerak hanya
   karena perbuatan: menekan "Terbitkan sekarang" MENCAP stempelnya, dan
   tanggalnya menggulung ke revisi baru begitu build itu tayang — bukan saat
   halaman dimuat (jebakan #74).
   ============================================================================= */

export function TerbitKit({ dibangunPada }: { dibangunPada: string }) {
  const t = useTerbit(dibangunPada);
  /* Dicap sekali tiap kali staf menekan Terbitkan. Pengatur waktunya di ref:
     render ulang selama build berjalan tidak boleh membatalkannya. */
  const [tercap, setTercap] = useState(0);
  const waktuCap = useRef(0);
  const terbitkan = () => {
    setTercap((n) => n + 1);
    window.clearTimeout(waktuCap.current);
    waktuCap.current = window.setTimeout(() => setTercap(0), 700);
    void t.terbitkan();
  };
  useEffect(() => () => window.clearTimeout(waktuCap.current), []);
  /* Tanggal revisi menggulung hanya saat build yang DIPICU DI SINI tayang. */
  const rev = tanggalRevisi(t.capBuild) ?? "—";
  const gulung = t.kirim === "tayang";
  const keadaan =
    t.kirim === "kirim" ? { ket: "Mengirim…", nada: "jalan" }
      : t.kirim === "jalan" ? { ket: `Terbit ${t.jamMundur}`, nada: "jalan" }
      : t.kirim === "tayang" ? { ket: "Sudah tayang", nada: "tayang" }
      : t.berubahPada === undefined ? { ket: "Memeriksa", nada: "diam" }
      : t.menyala ? { ket: "Ada perubahan", nada: "belum" }
      : { ket: "Sudah tayang", nada: "tayang" };
  /* undefined = settings belum sampai; false = Worker tidak punya tokennya. */
  const [aktif, setAktif] = useState<boolean | undefined>(undefined);
  const [zona, setZona] = useState("Asia/Jakarta");

  useEffect(() => {
    ambilSettings()
      .then((s) => {
        setAktif(s.terbitSitusAktif);
        if (s.timezone) setZona(s.timezone);
      })
      .catch(() => setAktif(undefined));
  }, []);

  return (
    <Sembul
      align="end"
      className="kterbit"
      pemicu={
        <button
          type="button"
          className={`kl__stempel is-${keadaan.nada}${tercap ? " is-tercap" : ""}`}
          aria-label={`Revisi situs ${rev} — ${keadaan.ket.toLowerCase()}. ${t.menyala ? "Terbitkan perubahan yang belum tayang" : "Terbitkan situs"}`}
        >
          <span className="kl__stempelrev">
            Rev{" "}
            <span className="kl__stempeljendela">
              <b key={rev} className={gulung ? "is-gulung" : undefined}>{rev}</b>
            </span>
          </span>
          <span className="kl__stempelket">{keadaan.ket}</span>
        </button>
      }
    >
          <p className="kterbit__judul">Terbitkan perubahan</p>

          <dl className="kterbit__waktu">
            <div>
              <dt><Ikon ikon={Globe} ukuran={14} />Situs dibangun</dt>
              <dd>
                <b>{t.kini ? sejak(dibangunPada, t.kini) : "—"}</b>
                <span>{jamTanggal(dibangunPada, zona)}</span>
              </dd>
            </div>
            <div>
              <dt><Ikon ikon={NotePencil} ukuran={14} />Data diubah</dt>
              <dd>
                {t.berubahPada ? (
                  <>
                    <b>{t.kini ? sejak(t.berubahPada, t.kini) : "—"}</b>
                    <span>{jamTanggal(t.berubahPada, zona)}</span>
                  </>
                ) : (
                  <span>{t.berubahPada === undefined ? "Memuat…" : "Belum tercatat"}</span>
                )}
              </dd>
            </div>
          </dl>

          <p className={t.menyala ? "kterbit__status kterbit__status--belum" : "kterbit__status"}>
            <Ikon ikon={t.menyala ? HourglassHigh : CheckCircle} ukuran={16} />
            {t.kalimat}
          </p>

          {t.kirim === "jalan" && (
            /* Tak bertentu, bukan persentase: yang berjalan GitHub Actions,
               dan panel ini tidak bisa tahu sudah sampai langkah mana. */
            <div className="kterbit__maju">
              <Putar ukuran={14} label="Membangun ulang situs" />
              <span className="kterbit__bar" role="progressbar" aria-label="Membangun ulang situs"><span /></span>
              <span className="kterbit__jam">{t.jamMundur}</span>
            </div>
          )}

          {t.galat && (
            <Peringatan nada="bahaya" judul="Gagal memicu build">
              {t.galat}
            </Peringatan>
          )}

          {aktif === false ? (
            <Peringatan nada="info" judul="Belum bisa dipakai">
              Token build belum dipasang di server.
            </Peringatan>
          ) : (
            <Tombol
              ukuran="large"
              jenis="primary"
              className="kterbit__aksi"
              onClick={terbitkan}
              disabled={t.kirim === "kirim" || t.kirim === "jalan" || aktif === undefined}
            >
              {t.labelTombol}
            </Tombol>
          )}
    </Sembul>
  );
}
