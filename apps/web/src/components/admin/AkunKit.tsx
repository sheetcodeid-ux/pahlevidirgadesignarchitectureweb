import { Butir, Teks } from "../kit/Tampilan";
import { useState } from "react";
import { ToastProvider, useToast } from "../kit/Toast";
import { RequireAuth, useProfil } from "./RequireAuth";
import { Tombol } from "../kit/Tombol";
import { Isian } from "../kit/Isian";
import { Lencana } from "../kit/Lencana";
import { KepalaBagian, PenandaSimpan } from "./situsKit";
import { Inisial } from "./daftarKit";
import { ubahPassword } from "../../lib/admin";

/* =============================================================================
   Akun — siapa yang sedang masuk, dan ganti kata sandi.

   Aturan kata sandinya aturan SUPABASE proyek ini, bukan karangan panel:
   minimal 12 karakter, dengan huruf besar, huruf kecil, angka, dan simbol
   (lihat CLAUDE.md — pengganti proteksi kata sandi bocor yang tidak ada di
   plan Free). Halaman lama menyebut "minimal 8 karakter", jadi kata sandi
   8–11 karakter lolos dari formulir lalu ditolak server dengan pesan yang
   tidak menyebut aturan mana yang dilanggar.
   ============================================================================= */

const SYARAT: [string, (s: string) => boolean][] = [
  ["Minimal 12 karakter", (s) => s.length >= 12],
  ["Huruf besar", (s) => /[A-Z]/.test(s)],
  ["Huruf kecil", (s) => /[a-z]/.test(s)],
  ["Angka", (s) => /\d/.test(s)],
  ["Simbol", (s) => /[^A-Za-z0-9]/.test(s)],
];

function Isi() {
  const profil = useProfil();
  const toast = useToast();
  const [baru, setBaru] = useState("");
  const [ulang, setUlang] = useState("");
  const [kirim, setKirim] = useState(false);

  const kurang = SYARAT.filter(([, uji]) => !uji(baru));
  const cocok = baru.length > 0 && baru === ulang;
  const siap = kurang.length === 0 && cocok;
  const alasan = !baru
    ? "Ketik kata sandi baru."
    : kurang.length
      ? `Masih kurang: ${kurang.map(([l]) => l.toLowerCase()).join(", ")}.`
      : !cocok
        ? "Ulangannya belum sama."
        : null;

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    if (!siap) return;
    setKirim(true);
    try {
      await ubahPassword(baru);
      setBaru("");
      setUlang("");
      toast({ judul: "Kata sandi diubah", keterangan: "Sesi di perangkat lain akan diminta masuk ulang.", nada: "sukses" });
    } catch (err) {
      toast({ judul: "Gagal mengubah kata sandi", keterangan: (err as Error).message, nada: "gagal" });
    } finally {
      setKirim(false);
    }
  }

  return (
    <div className="pas situs">
      <div className="pas__badan">
        <div className="pas__utama pf__utama">
          <section className="pf__bagian">
            <KepalaBagian judul="Akun yang sedang masuk" />
            <div className="ak-profil">
              <Butir
                media={<Inisial nama={profil.email.split("@")[0]!.replace(/[._-]+/g, " ")} />}
                judul={profil.email}
                ket={profil.isMasterAdmin ? "Bisa membuka seluruh panel, termasuk Info Studio dan UI Component" : "Bisa mengelola proyek, keuangan, dan isi situs"}
                kanan={
                  <Lencana bentuk="pejalkecil" nada={profil.isMasterAdmin ? "selesai" : "netral"}>
                    {profil.isMasterAdmin ? "Master admin" : "Staf"}
                  </Lencana>
                }
              />
            </div>
          </section>

          <form className="pf__bagian" onSubmit={simpan}>
            <KepalaBagian judul="Ganti kata sandi" kanan="Berlaku langsung" />
            <div className="pas__kisi">
              <Isian
                label="Kata sandi baru"
                type="password"
                autoComplete="new-password"
                value={baru}
                onChange={(e) => setBaru(e.currentTarget.value)}
              />
              <Isian
                label="Ulangi kata sandi baru"
                type="password"
                autoComplete="new-password"
                value={ulang}
                onChange={(e) => setUlang(e.currentTarget.value)}
              />
            </div>
            {/* Daftar syarat yang menyala satu per satu — lebih cepat dibaca
                daripada satu kalimat galat sesudah menekan Simpan. */}
            <ul className="ak-syarat" aria-label="Syarat kata sandi">
              {SYARAT.map(([label, uji]) => (
                <li key={label} data-ok={uji(baru) || undefined}>
                  <span aria-hidden="true" />
                  {label}
                  <span className="sr-only">{uji(baru) ? " — terpenuhi" : " — belum"}</span>
                </li>
              ))}
            </ul>
            <div className="pas__aksi">
              <Tombol memuat={kirim} ukuran="large" jenis="primary" tipeHtml="submit" disabled={!siap || kirim}>
                {kirim ? "Menyimpan…" : "Simpan kata sandi"}
              </Tombol>
              <PenandaSimpan n={siap ? 0 : 1} teks={alasan ?? "Siap disimpan."} />
            </div>
          </form>
        </div>
        <aside className="pf__samping" aria-label="Keterangan akun">
          <div className="pf__info">
            <p className="pas__sampingjudul">Keamanan</p>
            <Teks tingkat="kecil">Sesi di perangkat lain diminta masuk ulang.</Teks>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function AkunKit() {
  return (
    <RequireAuth skeleton={<div className="pas pas--rangka" />}>
      <ToastProvider>
        <Isi />
      </ToastProvider>
    </RequireAuth>
  );
}
