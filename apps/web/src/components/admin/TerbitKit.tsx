import { useEffect, useState } from "react";
import * as RPopover from "@radix-ui/react-popover";
import { TombolBulat } from "../kit/Item";
import { Tombol } from "../kit/Tombol";
import { Ikon } from "../kit/Ikon";
import { Globe, NotePencil, CheckCircle, HourglassHigh, Info } from "../kit/ikon";
import { ambilSettings } from "../../lib/admin";
import { useTerbit, sejak, jamTanggal } from "./useTerbit";

/* =============================================================================
   Tombol Terbitkan di kepala halaman kit.

   Halaman yang sudah pindah ke kerangka kit (KitLayout) tidak memuat bilah
   atas lama, jadi tombolnya ikut hilang — padahal toast di halaman Jurnal dan
   Paket menyuruh "tekan Terbitkan di bilah atas". Yang ini tampilannya kit
   (tombol bulat 38 seperti lonceng di sebelahnya, panel r16), keadaannya dari
   useTerbit yang sama dengan bilah atas lama.

   Ikonnya bola dunia: yang diterbitkan situs publik, dan pustaka ikon Coinest
   tidak punya panah unggah. Menggambarnya sendiri berarti menjiplak — aturan
   yang sama dengan ikon lain di panel ini.
   ============================================================================= */

export function TerbitKit({ dibangunPada }: { dibangunPada: string }) {
  const t = useTerbit(dibangunPada);
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
    <RPopover.Root>
      <RPopover.Trigger asChild>
        <TombolBulat
          ikon={Globe}
          judul={t.menyala ? "Terbitkan perubahan yang belum tayang" : "Terbitkan situs"}
          tanda={t.menyala}
          nadaTanda="amber"
        />
      </RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content className="kterbit" sideOffset={10} align="end" collisionPadding={16}>
          <p className="kterbit__judul">Terbitkan perubahan</p>
          <p className="kterbit__ket">
            Halaman publik dibekukan saat situs dibangun. Apa pun yang Anda ubah di panel baru
            tampil di situs setelah dibangun ulang.
          </p>

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
              <span className="kterbit__bar" role="progressbar" aria-label="Membangun ulang situs"><span /></span>
              <span className="kterbit__jam">{t.jamMundur}</span>
            </div>
          )}

          {t.galat && <p className="kterbit__galat">{t.galat}</p>}

          {aktif === false ? (
            <p className="kterbit__kunci">
              <Ikon ikon={Info} ukuran={16} />
              Tombol ini belum bisa dipakai: Worker API belum punya token GitHub untuk memicu
              build. Sementara itu situs tetap dibangun ulang otomatis setiap kali kodenya berubah.
            </p>
          ) : (
            <Tombol
              ukuran="large"
              jenis="primary"
              className="kterbit__aksi"
              onClick={t.terbitkan}
              disabled={t.kirim === "kirim" || t.kirim === "jalan" || aktif === undefined}
            >
              {t.labelTombol}
            </Tombol>
          )}
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}
