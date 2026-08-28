import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";

/* Pesan suara staf → klien.
 *
 * Dua komponen, karena dua peran yang berbeda: PerekamSuara dipakai staf di
 * panel admin, PemutarSuara dipakai di kedua sisi (staf melihat apa yang
 * sudah dia kirim, klien mendengarkannya di portal).
 *
 * Semuanya bersandar pada MediaRecorder dan elemen <audio> bawaan. Tidak ada
 * pustaka audio: perilaku bawaan browser — pemutaran latar, kontrol media di
 * layar kunci ponsel, penghematan daya — tidak bisa rusak diam-diam, dan
 * itulah alasan yang sama yang membuat Accordion memakai <details>.
 */

const JUMLAH_BATANG = 40;
/** 5 menit. Opus ~24 kbps, jadi rekaman terpanjang pun jauh di bawah 1 MB. */
const MAKS_DURASI_MS = 5 * 60 * 1000;

/** Wadah rekaman berbeda per platform; ambil yang pertama didukung. */
const KANDIDAT_MIME = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

function pilihMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of KANDIDAT_MIME) if (MediaRecorder.isTypeSupported(m)) return m;
  return null;
}

/** "audio/webm;codecs=opus" → "audio/webm": R2 hanya mengenali tipe dasarnya. */
export function mimeDasar(mime: string): string {
  return mime.split(";")[0].trim();
}

export function formatDurasi(ms: number): string {
  const total = Math.round(ms / 1000);
  const menit = Math.floor(total / 60);
  const detik = total % 60;
  return `${menit}:${String(detik).padStart(2, "0")}`;
}

/* ---------------------------------------------------------------- Pemutar */

/**
 * Menghitung puncak gelombang dari audionya sendiri, bukan dari angka acak
 * yang kebetulan terlihat seperti suara. Kalau berkasnya tidak bisa diambil
 * (CORS, jaringan), batangnya tetap rata dan pemutarnya tetap jalan — bentuk
 * gelombang itu hiasan, tombol putar yang tidak.
 */
async function hitungPuncak(url: string): Promise<number[] | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const Ctx: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    const audio = await ctx.decodeAudioData(buf);
    const data = audio.getChannelData(0);
    const per = Math.floor(data.length / JUMLAH_BATANG) || 1;
    const puncak: number[] = [];
    for (let i = 0; i < JUMLAH_BATANG; i++) {
      let maks = 0;
      for (let j = i * per; j < (i + 1) * per && j < data.length; j++) {
        const v = Math.abs(data[j]);
        if (v > maks) maks = v;
      }
      puncak.push(maks);
    }
    void ctx.close();
    // Dinormalkan ke puncak tertinggi supaya rekaman pelan tetap terbaca.
    const tertinggi = Math.max(...puncak, 0.001);
    return puncak.map((p) => p / tertinggi);
  } catch {
    return null;
  }
}

interface PemutarProps {
  url: string;
  /** Durasi dari database — dipakai sebelum metadata audio termuat. */
  durationMs?: number | null;
  label?: string;
}

export function PemutarSuara({ url, durationMs, label = "Pesan suara" }: PemutarProps) {
  const audio = useRef<HTMLAudioElement>(null);
  const [main, setMain] = useState(false);
  const [posisi, setPosisi] = useState(0);
  const [durasi, setDurasi] = useState(durationMs ? durationMs / 1000 : 0);
  const [puncak, setPuncak] = useState<number[] | null>(null);

  useEffect(() => {
    let batal = false;
    hitungPuncak(url).then((p) => { if (!batal) setPuncak(p); });
    return () => { batal = true; };
  }, [url]);

  const rasio = durasi > 0 ? Math.min(1, posisi / durasi) : 0;
  const batang = puncak ?? Array.from({ length: JUMLAH_BATANG }, () => 0.35);

  return (
    <div className="vn" data-main={main || undefined}>
      <button
        type="button"
        className="vn__tombol"
        aria-label={main ? `Jeda ${label}` : `Putar ${label}`}
        onClick={() => {
          const el = audio.current;
          if (!el) return;
          if (el.paused) void el.play();
          else el.pause();
        }}
      >
        <Icon name={main ? "pause" : "play"} size={16} />
      </button>

      <div className="vn__gelombang" aria-hidden="true">
        {batang.map((tinggi, i) => (
          <span
            key={i}
            className="vn__batang"
            data-lewat={i / JUMLAH_BATANG <= rasio || undefined}
            style={{ height: `${Math.max(12, tinggi * 100)}%` }}
          />
        ))}
      </div>

      <span className="vn__waktu mono">
        {formatDurasi((main || posisi > 0 ? posisi : durasi) * 1000)}
      </span>

      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onPlay={() => setMain(true)}
        onPause={() => setMain(false)}
        onEnded={() => { setMain(false); setPosisi(0); }}
        onTimeUpdate={(e) => setPosisi(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          // Rekaman MediaRecorder kerap melaporkan Infinity sampai diputar
          // sampai habis; durasi dari database yang menyelamatkan tampilan.
          if (Number.isFinite(d) && d > 0) setDurasi(d);
        }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- Perekam */

type Fase = "diam" | "merekam" | "pratinjau" | "ditolak";

interface PerekamProps {
  /** Dipanggil saat staf menekan Kirim. Komponen tidak tahu apa-apa soal unggahan. */
  onKirim: (blob: Blob, durasiMs: number, mime: string) => Promise<void> | void;
  disabled?: boolean;
}

export function PerekamSuara({ onKirim, disabled }: PerekamProps) {
  const [fase, setFase] = useState<Fase>("diam");
  const [ms, setMs] = useState(0);
  const [level, setLevel] = useState<number[]>([]);
  const [hasil, setHasil] = useState<{ blob: Blob; url: string; mime: string; ms: number } | null>(null);
  const [mengirim, setMengirim] = useState(false);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const frame = useRef<number>(0);
  const jam = useRef<number>(0);
  const mulai = useRef<number>(0);

  function bereskan() {
    cancelAnimationFrame(frame.current);
    clearInterval(jam.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void ctx.current?.close();
    ctx.current = null;
  }

  // Melepas mikrofon saat komponen hilang. Tanpa ini lampu "sedang merekam"
  // di browser tetap menyala walau panelnya sudah ditutup.
  useEffect(() => () => { bereskan(); if (hasil) URL.revokeObjectURL(hasil.url); }, []);

  async function mulaiRekam() {
    const mime = pilihMime();
    if (!mime || !navigator.mediaDevices?.getUserMedia) { setFase("ditolak"); return; }

    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;

      const Ctx: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = new Ctx();
      ctx.current = ac;
      const analyser = ac.createAnalyser();
      analyser.fftSize = 1024;
      ac.createMediaStreamSource(s).connect(analyser);
      const sampel = new Uint8Array(analyser.fftSize);

      // Batang bergerak dibaca dari sinyal sungguhan, bukan animasi hiasan:
      // staf harus bisa melihat mikrofonnya memang menangkap suara sebelum
      // menghabiskan satu menit bicara ke perangkat yang bisu.
      const gambar = () => {
        analyser.getByteTimeDomainData(sampel);
        let jumlah = 0;
        for (const v of sampel) { const n = (v - 128) / 128; jumlah += n * n; }
        const rms = Math.sqrt(jumlah / sampel.length);
        setLevel((cur) => [...cur, Math.min(1, rms * 3)].slice(-JUMLAH_BATANG));
        frame.current = requestAnimationFrame(gambar);
      };
      frame.current = requestAnimationFrame(gambar);

      const potongan: Blob[] = [];
      const rec = new MediaRecorder(s, { mimeType: mime });
      rec.ondataavailable = (e) => { if (e.data.size > 0) potongan.push(e.data); };
      rec.onstop = () => {
        const durasi = Date.now() - mulai.current;
        const blob = new Blob(potongan, { type: mimeDasar(mime) });
        bereskan();
        if (durasi < 700) { setFase("diam"); setLevel([]); return; }
        setHasil({ blob, url: URL.createObjectURL(blob), mime: mimeDasar(mime), ms: durasi });
        setFase("pratinjau");
      };

      recorder.current = rec;
      mulai.current = Date.now();
      setMs(0);
      setLevel([]);
      rec.start();
      setFase("merekam");

      jam.current = window.setInterval(() => {
        const lewat = Date.now() - mulai.current;
        setMs(lewat);
        if (lewat >= MAKS_DURASI_MS) rec.stop();
      }, 100);
    } catch {
      bereskan();
      setFase("ditolak");
    }
  }

  function buang() {
    if (hasil) URL.revokeObjectURL(hasil.url);
    setHasil(null);
    setLevel([]);
    setMs(0);
    setFase("diam");
  }

  async function kirim() {
    if (!hasil) return;
    setMengirim(true);
    try {
      await onKirim(hasil.blob, hasil.ms, hasil.mime);
      buang();
    } finally {
      setMengirim(false);
    }
  }

  if (fase === "ditolak") {
    return (
      <div className="vn-rekam vn-rekam--tolak">
        <span className="icon-tile"><Icon name="micOff" size={18} /></span>
        <span className="stack" style={{ gap: 2 }}>
          <span className="t-subheading">Mikrofon tidak bisa dipakai</span>
          <span className="t-muted">
            Izinkan akses mikrofon di setelan browser, lalu muat ulang halaman ini.
          </span>
        </span>
      </div>
    );
  }

  if (fase === "pratinjau" && hasil) {
    return (
      <div className="vn-rekam">
        <PemutarSuara url={hasil.url} durationMs={hasil.ms} label="rekaman baru" />
        <div className="vn-rekam__aksi">
          <button type="button" className="btn btn--ghost" onClick={buang} disabled={mengirim}>
            Ulangi
          </button>
          <button type="button" className="btn btn--primary" onClick={kirim} disabled={mengirim}>
            {mengirim && <span className="spinner spinner--sm spinner--on-action" />}
            Kirim ke klien
          </button>
        </div>
      </div>
    );
  }

  if (fase === "merekam") {
    return (
      <div className="vn-rekam vn-rekam--aktif">
        <span className="vn-rekam__titik" aria-hidden="true" />
        <span className="vn__waktu mono">{formatDurasi(ms)}</span>
        <div className="vn__gelombang" aria-hidden="true">
          {Array.from({ length: JUMLAH_BATANG }, (_, i) => (
            <span key={i} className="vn__batang" data-lewat
              style={{ height: `${Math.max(12, (level[i] ?? 0) * 100)}%` }} />
          ))}
        </div>
        <button type="button" className="btn btn--danger btn--icon" aria-label="Selesai merekam"
          onClick={() => recorder.current?.stop()}>
          <Icon name="stop" size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="vn-rekam">
      <span className="icon-tile"><Icon name="mic" size={18} /></span>
      <span className="stack" style={{ gap: 2, flex: 1, minWidth: 0 }}>
        <span className="t-subheading">Pesan suara</span>
        <span className="t-muted">Rekam penjelasan singkat — klien mendengarnya di portal.</span>
      </span>
      <button type="button" className="btn btn--secondary" onClick={mulaiRekam} disabled={disabled}>
        <Icon name="mic" size={15} />Rekam
      </button>
    </div>
  );
}
