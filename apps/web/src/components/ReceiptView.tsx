/**
 * Bukti pembayaran yang dibuka klien dari tautan WhatsApp.
 *
 * Halaman PUBLIK: tidak ada login, tidak ada token Supabase, dan tidak boleh
 * menyentuh apa pun di lib/admin. Satu-satunya kredensialnya token di URL,
 * yang ditukar ke endpoint publik /api/v1/receipt/:token.
 */

import { useEffect, useState } from "react";
import { Icon } from "./ui/Icon";

const API = (import.meta.env.PUBLIC_API_BASE_URL ?? "http://localhost:8787").replace(/\/$/, "");

interface Bukti {
  id: string;
  receiptToken: string;
  amount: number;
  kind: string;
  method: string;
  receiver?: string | null;
  paidAt: string;
  projectTitle: string;
  contractValue: number | null;
  studioName: string;
}

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

const tanggalPanjang = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

const LABEL_METODE: Record<string, string> = {
  tunai: "Tunai", transfer: "Transfer", qris: "QRIS", lainnya: "Lainnya",
};
const LABEL_JENIS: Record<string, string> = {
  dp: "DP", termin: "Termin", pelunasan: "Pelunasan",
};

export function ReceiptView() {
  const token = typeof window !== "undefined"
    ? new URLSearchParams(location.search).get("t") ?? ""
    : "";

  const [bukti, setBukti] = useState<Bukti | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    // Bentuk token diperiksa di klien juga, supaya tautan yang terpotong saat
    // disalin dari WhatsApp langsung dijawab tanpa satu permintaan pun.
    if (!/^[0-9a-f]{32}$/.test(token)) {
      setGalat("Tautan bukti tidak lengkap atau salah.");
      return;
    }
    fetch(`${API}/api/v1/receipt/${token}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Bukti pembayaran tidak ditemukan.");
        const isi = await res.json();
        setBukti(isi.data as Bukti);
      })
      .catch((e) => setGalat((e as Error).message));
  }, [token]);

  if (galat) {
    return (
      <div className="struk">
        <div className="struk__kartu struk__kartu--kosong">
          <Icon name="alert" size={28} />
          <p className="struk__kosong-judul">{galat}</p>
          <p className="t-muted">Minta studio mengirim ulang tautannya.</p>
        </div>
      </div>
    );
  }

  if (!bukti) {
    return (
      <div className="struk">
        <div className="struk__kartu struk__kartu--kosong">
          <p className="t-muted">Memuat bukti…</p>
        </div>
      </div>
    );
  }

  const sisa = bukti.contractValue !== null ? Math.max(0, bukti.contractValue - bukti.amount) : null;

  return (
    <div className="struk">
      <p className="struk__studio">
        <Icon name="building" size={20} /> {bukti.studioName}
      </p>

      <div className="struk__kartu">
        <div className="struk__puncak">
          <p className="struk__label">TOTAL DIBAYAR</p>
          <p className="struk__nominal">{rupiah(bukti.amount)}</p>
          <span className="badge badge--success"><span className="badge__dot" />Lunas</span>
        </div>

        <dl className="struk__rinci">
          <div><dt>Proyek</dt><dd>{bukti.projectTitle}</dd></div>
          <div><dt>ID Pembayaran</dt><dd className="t-mono">{bukti.receiptToken.slice(0, 8).toUpperCase()}</dd></div>
          <div><dt>Kategori</dt><dd>{LABEL_JENIS[bukti.kind] ?? bukti.kind}</dd></div>
          <div><dt>Metode</dt><dd>{LABEL_METODE[bukti.method] ?? bukti.method}</dd></div>
          {bukti.receiver && <div><dt>Penerima</dt><dd>{bukti.receiver}</dd></div>}
          <div><dt>Tanggal Bayar</dt><dd>{tanggalPanjang(bukti.paidAt)}</dd></div>
          {bukti.contractValue !== null && (
            <div>
              <dt>Nilai Kontrak</dt>
              <dd>
                {rupiah(bukti.contractValue)}
                {sisa !== null && sisa > 0 && (
                  <span className="struk__sisa"> · sisa {rupiah(sisa)}</span>
                )}
              </dd>
            </div>
          )}
        </dl>

        <p className="struk__catatan">
          Bukti pembayaran ini sah dan dikeluarkan oleh sistem {bukti.studioName}.
        </p>
      </div>

      <p className="struk__kaki">
        Bukti #{bukti.receiptToken.slice(0, 8).toUpperCase()} · {tanggalPanjang(bukti.paidAt)}
      </p>
    </div>
  );
}
