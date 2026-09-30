import { Icon } from "../ui/Icon";
import { Tombol } from "./Tombol";
import {
  usePemutarSuara,
  useRekamSuara,
  BATANG_SUARA,
  formatDurasi,
  type PerekamProps,
} from "../ui/misc/VoiceNote";

/* =============================================================================
   Pesan suara — kulit kit di atas logika VoiceNote.

   Coinest tidak punya komponen audio, jadi yang di sini BUKAN tiruan frame
   melainkan kulit yang dirakit dari bahasa kit: bidang bergaris 1px ber-
   radius 12 seperti isian, tombol bulat sewarna tombol utama, dan batang
   gelombang yang bagian lewatnya bertinta brand.

   Logikanya tidak disalin: `usePemutarSuara` dan `useRekamSuara` sama
   persis dengan yang dipakai panel lama — pendekodean gelombang, durasi
   Infinity dari MediaRecorder, batas lima menit, pelepasan mikrofon.

   Ikon putar/jeda/mikrofon/henti diambil dari Icon.tsx milik situs sendiri,
   karena pustaka ikon Coinest tidak punya satu pun dari keempatnya —
   menggambarnya ulang berarti menjiplak. Bentuknya diisi penuh lewat CSS
   supaya sebahasa dengan ikon Coinest, yang juga bentuk isi.
   ============================================================================= */

export function PemutarSuaraKit({
  url,
  durationMs,
  label = "pesan suara",
  className,
}: {
  url: string;
  durationMs?: number | null;
  label?: string;
  className?: string;
}) {
  const p = usePemutarSuara(url, durationMs);
  return (
    <div className={["k-suara", className].filter(Boolean).join(" ")} data-main={p.main || undefined}>
      <button
        type="button"
        className="k-suara__putar"
        aria-label={p.main ? `Jeda ${label}` : `Putar ${label}`}
        onClick={p.alih}
      >
        <Icon name={p.main ? "pause" : "play"} size={14} />
      </button>
      <Gelombang tinggi={p.batang} rasio={p.rasio} />
      <span className="k-suara__waktu">{p.waktu}</span>
      <audio {...p.propAudio} />
    </div>
  );
}

function Gelombang({ tinggi, rasio, semuaLewat }: { tinggi: number[]; rasio?: number; semuaLewat?: boolean }) {
  return (
    <span className="k-suara__gelombang" aria-hidden="true">
      {tinggi.map((t, i) => (
        <span
          key={i}
          className="k-suara__batang"
          /* `<` dan rasio > 0: dengan `<=`, batang pertama sudah
              bertanda "lewat" sebelum tombol putar disentuh. */
          data-lewat={semuaLewat || ((rasio ?? 0) > 0 && i / BATANG_SUARA < (rasio ?? 0)) || undefined}
          style={{ height: `${Math.max(12, t * 100)}%` }}
        />
      ))}
    </span>
  );
}

export function PerekamSuaraKit({ onKirim, disabled }: PerekamProps) {
  const r = useRekamSuara(onKirim);

  if (r.fase === "ditolak") {
    return (
      <div className="k-rekam k-rekam--tolak" role="status">
        <span className="k-rekam__teks">
          <b>Mikrofon tidak bisa dipakai</b>
          <small>Izinkan akses mikrofon di setelan peramban, lalu muat ulang halaman ini.</small>
        </span>
      </div>
    );
  }

  if (r.fase === "pratinjau" && r.hasil) {
    return (
      <div className="k-rekam">
        <PemutarSuaraKit url={r.hasil.url} durationMs={r.hasil.ms} label="rekaman baru" className="k-rekam__pemutar" />
        <span className="k-rekam__aksi">
          <Tombol ukuran="medium" jenis="ghost" onClick={r.buang} disabled={r.mengirim}>
            Ulangi
          </Tombol>
          <Tombol ukuran="medium" jenis="primary" onClick={r.kirim} disabled={r.mengirim}>
            {r.mengirim ? "Mengirim…" : "Kirim ke klien"}
          </Tombol>
        </span>
      </div>
    );
  }

  if (r.fase === "merekam") {
    return (
      <div className="k-rekam k-rekam--aktif">
        <span className="k-rekam__titik" aria-hidden="true" />
        <span className="k-suara__waktu" role="timer" aria-label={`Merekam ${formatDurasi(r.ms)}`}>
          {formatDurasi(r.ms)}
        </span>
        <Gelombang tinggi={Array.from({ length: BATANG_SUARA }, (_, i) => r.level[i] ?? 0)} semuaLewat />
        <button type="button" className="k-suara__putar k-suara__henti" aria-label="Selesai merekam" onClick={r.selesai}>
          <Icon name="stop" size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="k-rekam">
      <span className="k-rekam__teks">
        <b>Pesan suara</b>
        <small>Rekam penjelasan singkat, paling lama 5 menit — klien mendengarnya di portal.</small>
      </span>
      {/* Ikon kiri ditempel tangan, bukan lewat prop `kiri` — prop itu cuma
          menerima ikon Coinest. Kelasnya sama, jadi paddingnya ikut. */}
      <Tombol
        ukuran="medium"
        jenis="secondary"
        onClick={r.mulaiRekam}
        disabled={disabled}
        className="k-tombol--ikonkiri k-rekam__mulai"
      >
        <Icon name="mic" size={14} className="k-tombol__ikonkiri" />
        Rekam
      </Tombol>
    </div>
  );
}
