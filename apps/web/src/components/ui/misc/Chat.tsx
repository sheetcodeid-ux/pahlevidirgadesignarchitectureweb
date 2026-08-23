import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";

interface Pesan { dari: string; teks: string; jam: string; sendiri?: boolean; }

const AWAL: Pesan[] = [
  { dari: "Budi Santoso", teks: "Selamat siang, saya ingin konsultasi rumah dua lantai di Pontianak.", jam: "09.12" },
  { dari: "Studio", teks: "Siang Pak Budi. Boleh tahu perkiraan luas tanahnya?", jam: "09.20", sendiri: true },
  { dari: "Budi Santoso", teks: "Sekitar 180 m², menghadap timur.", jam: "09.24" },
];

/**
 * Message Scroller.
 *
 * Menggulir ke pesan terbaru hanya kalau pengguna memang sedang berada di
 * dasar. Kalau ia sedang membaca ke atas, gulirnya dibiarkan — memaksanya
 * turun akan membuat orang kehilangan tempat bacanya.
 */
export function MessageScroller() {
  const [pesan, setPesan] = useState(AWAL);
  const wadah = useRef<HTMLDivElement>(null);
  const diDasar = useRef(true);

  useEffect(() => {
    const el = wadah.current;
    if (el && diDasar.current) el.scrollTop = el.scrollHeight;
  }, [pesan]);

  function onScroll() {
    const el = wadah.current;
    if (!el) return;
    diDasar.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  function balas() {
    const d = new Date();
    setPesan((cur) => [
      ...cur,
      {
        dari: "Studio",
        teks: "Baik, kami siapkan studi awalnya minggu ini.",
        jam: `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`,
        sendiri: true,
      },
    ]);
  }

  return (
    <div className="stack">
      <div className="msg-scroller" ref={wadah} onScroll={onScroll} role="log" aria-label="Percakapan">
        {pesan.map((p, i) => (
          <div className={`msg${p.sendiri ? " msg--sendiri" : ""}`} key={i}>
            <Avatar name={p.dari} size="sm" brand={p.sendiri} />
            <div className="msg__body">
              <div className="bubble">{p.teks}</div>
              <div className="msg__meta">
                <span>{p.dari}</span>
                <span aria-hidden="true">·</span>
                <span>{p.jam}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn--secondary btn--sm" onClick={balas} style={{ alignSelf: "flex-start" }}>
        Kirim balasan
      </button>
    </div>
  );
}
