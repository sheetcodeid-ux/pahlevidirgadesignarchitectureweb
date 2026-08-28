/**
 * Pembuat PDF berkop studio: rincian Biaya (HPP) dan Invoice.
 *
 * Dibuat di browser, bukan di Worker. Alasannya CPU: Workers plan Free
 * memberi 10 ms CPU per permintaan, dan menyusun PDF jauh melewati itu —
 * sementara di browser staf, waktu itu tidak dibatasi siapa pun dan tidak
 * ada yang ikut menunggu.
 *
 * pdf-lib dimuat lewat import dinamis supaya ~350 KB pustakanya baru turun
 * saat tombolnya benar-benar ditekan, bukan di setiap kali panel Keuangan
 * dibuka.
 *
 * Fonta memakai Times dan Helvetica bawaan PDF, bukan Newsreader dan Plus
 * Jakarta Sans dari situs. Itu kompromi yang disengaja: menyematkan fonta
 * asli berarti mengunduh ratusan kilobita TTF tiap kali PDF dibuat, demi
 * berkas yang cuma dicetak dan dikirim ke klien. Times tetap serif dan
 * Helvetica tetap sans, jadi pembagian perannya sama seperti di situs.
 */

import type { PDFDocument, PDFFont, PDFPage } from "pdf-lib";
import { formatRupiah } from "./format";
import { ambilLogoStudio, type StudioSettings } from "./admin";

/* Ukuran A4 dalam titik (1/72 inci) — satuan asli PDF. */
const LEBAR = 595.28;
const TINGGI = 841.89;
const TEPI = 56; // ±2 cm, batas cetak yang aman di printer mana pun

/* Warna. Nilainya sengaja tidak menunjuk token CSS: PDF tidak punya tema,
   dan yang dicetak di atas kertas putih selalu versi terangnya. */
const HITAM = { r: 0.06, g: 0.06, b: 0.06 };
const ABU = { r: 0.42, g: 0.42, b: 0.42 };
const GARIS = { r: 0.80, g: 0.80, b: 0.78 };
const MERAH = { r: 0.81, g: 0.11, b: 0.09 }; // --brand tema terang

export interface BarisPdf {
  label: string;
  /** Kolom tengah: kategori untuk HPP, status untuk invoice. Boleh kosong. */
  keterangan?: string;
  nominal: number;
}

export interface DokumenPdf {
  /** "Rincian Biaya Proyek" / "Daftar Tagihan" */
  judul: string;
  namaProyek: string;
  /** Label kolom tengah di kepala tabel. */
  kolomTengah: string;
  baris: BarisPdf[];
  /** Baris ringkasan di bawah tabel — mis. nilai kontrak, margin. */
  ringkasan?: { label: string; nilai: string; tebal?: boolean }[];
  /** Kalimat kecil di kaki halaman, mis. syarat pembayaran. */
  catatan?: string;
}

/** Nama berkas yang aman dipakai di semua sistem berkas. */
function namaBerkas(bagian: string[]): string {
  return bagian
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) + ".pdf";
}

/** Tanggal panjang berbahasa Indonesia: "28 Agustus 2026". */
function tanggalPanjang(zona: string | undefined): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "long", year: "numeric",
    timeZone: zona || "Asia/Jakarta",
  }).format(new Date());
}

/*
 * Fonta bawaan PDF dikodekan WinAnsi (CP1252). Karakter di luar itu membuat
 * pdf-lib gagal MENYELURUH — bukan cuma jelek satu huruf — jadi satu emoji
 * yang tanpa sengaja tersalin ke label biaya bisa membatalkan seluruh
 * dokumen. Karena itu disaring lebih dulu, bukan dibiarkan meledak.
 *
 * Yang disaring hanya yang benar-benar di luar jangkauan. Tanda pisah em,
 * kutip melengkung, dan elipsis JUSTRU ada di WinAnsi — dan label pemilik
 * memang memakai "Fee Rian — DED", jadi menukarnya jadi tanda hubung biasa
 * akan memiskinkan dokumennya tanpa alasan.
 */
const TAMBAHAN_WINANSI = "\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d"
  + "\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u017e\u0178";

function aman(teks: string): string {
  let hasil = "";
  for (const ch of teks) {
    // Spasi tak-putus ditukar spasi biasa lebih dulu: ia sah di WinAnsi,
    // tapi lebar teksnya jadi sulit ditebak saat memotong kolom.
    if (ch === "\u00a0") { hasil += " "; continue; }
    const kode = ch.codePointAt(0)!;
    // ASCII yang bisa dicetak, Latin-1 supplement, dan tanda baca CP1252.
    if ((kode >= 0x20 && kode <= 0x7e) || (kode >= 0xa1 && kode <= 0xff) || TAMBAHAN_WINANSI.includes(ch)) {
      hasil += ch;
    }
    // Sisanya dibuang diam-diam, bukan diganti tanda tanya: satu label aneh
    // tidak boleh membuat dokumennya jadi tidak terbaca.
  }
  return hasil;
}

/** Memotong teks yang lebih lebar dari kolomnya, dengan elipsis. */
function potong(teks: string, font: PDFFont, ukuran: number, lebarMaks: number): string {
  if (font.widthOfTextAtSize(teks, ukuran) <= lebarMaks) return teks;
  let hasil = teks;
  while (hasil.length > 1 && font.widthOfTextAtSize(hasil + "...", ukuran) > lebarMaks) {
    hasil = hasil.slice(0, -1);
  }
  return hasil + "...";
}

interface Konteks {
  doc: PDFDocument;
  serif: PDFFont;
  serifTebal: PDFFont;
  sans: PDFFont;
  sansTebal: PDFFont;
  logo: { gambar: Awaited<ReturnType<PDFDocument["embedPng"]>>; lebar: number; tinggi: number } | null;
  studio: StudioSettings;
}

/**
 * Kop surat. Digambar ulang di setiap halaman — dokumen dua halaman yang
 * halaman keduanya polos terbaca seperti lampiran yang tercecer, bukan
 * seperti bagian dari surat yang sama.
 */
function gambarKop(page: PDFPage, ctx: Konteks): number {
  let y = TINGGI - TEPI;
  const { studio } = ctx;

  if (ctx.logo) {
    // Tinggi dikunci 34pt; lebarnya mengikuti rasio asli supaya logo
    // persegi maupun memanjang sama-sama tidak gepeng.
    const tinggiLogo = 34;
    const lebarLogo = (ctx.logo.lebar / ctx.logo.tinggi) * tinggiLogo;
    page.drawImage(ctx.logo.gambar, {
      x: TEPI, y: y - tinggiLogo, width: lebarLogo, height: tinggiLogo,
    });
    y -= tinggiLogo + 12;
  }

  page.drawText(aman(studio.studioName), {
    x: TEPI, y: y - 16, size: 17, font: ctx.serifTebal, color: rgbDari(HITAM),
  });
  y -= 22;

  if (studio.tagline) {
    page.drawText(aman(studio.tagline), {
      x: TEPI, y: y - 10, size: 8.5, font: ctx.sans, color: rgbDari(ABU),
    });
    y -= 14;
  }

  // Blok kontak rata kanan, sejajar dengan nama studio — bentuk kop surat
  // yang sudah dikenali: siapa di kiri, cara menghubungi di kanan.
  const kontak = [
    [studio.address, studio.city].filter(Boolean).join(", "),
    studio.email ?? "",
    studio.phone ?? "",
  ].filter((b) => b.length > 0);

  let yKontak = TINGGI - TEPI - (ctx.logo ? 4 : 0);
  for (const baris of kontak) {
    const teks = aman(baris);
    const lebar = ctx.sans.widthOfTextAtSize(teks, 8.5);
    page.drawText(teks, {
      x: LEBAR - TEPI - lebar, y: yKontak - 9, size: 8.5, font: ctx.sans, color: rgbDari(ABU),
    });
    yKontak -= 12;
  }

  y = Math.min(y, yKontak) - 8;

  // Garis merah tipis: satu-satunya warna di seluruh dokumen. Merah = brand
  // di sistem warna situs, dan di atas kertas ia yang menandai ini surat
  // resmi studio, bukan cetakan tabel biasa.
  page.drawRectangle({ x: TEPI, y, width: LEBAR - TEPI * 2, height: 1.6, color: rgbDari(MERAH) });

  return y - 28;
}

function gambarKaki(page: PDFPage, ctx: Konteks, halaman: number, total: number) {
  const teks = aman(`${ctx.studio.studioName} — halaman ${halaman} dari ${total}`);
  const lebar = ctx.sans.widthOfTextAtSize(teks, 7.5);
  page.drawText(teks, {
    x: (LEBAR - lebar) / 2, y: TEPI - 18, size: 7.5, font: ctx.sans, color: rgbDari(ABU),
  });
}

/* pdf-lib mengekspor rgb() sebagai fungsi; disimpan saat modul dimuat. */
let rgb: (r: number, g: number, b: number) => ReturnType<typeof import("pdf-lib").rgb>;
function rgbDari(w: { r: number; g: number; b: number }) {
  return rgb(w.r, w.g, w.b);
}

/**
 * Menyusun dokumennya, lalu menyerahkan berkasnya ke browser.
 *
 * Nilai kembalinya nama berkas — dipakai pemanggil untuk memberi tahu staf
 * apa yang barusan turun, karena unduhan di sebagian browser tidak
 * menampilkan apa pun.
 */
export async function unduhPdf(isi: DokumenPdf, studio: StudioSettings): Promise<string> {
  const pdfLib = await import("pdf-lib");
  rgb = pdfLib.rgb;
  const { PDFDocument: Doc, StandardFonts } = pdfLib;

  const doc = await Doc.create();
  doc.setTitle(`${isi.judul} — ${isi.namaProyek}`);
  doc.setAuthor(studio.studioName);
  doc.setCreator(studio.studioName);

  const ctx: Konteks = {
    doc,
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifTebal: await doc.embedFont(StandardFonts.TimesRomanBold),
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansTebal: await doc.embedFont(StandardFonts.HelveticaBold),
    logo: null,
    studio,
  };

  // Logo bersifat pelengkap: gagal mengambilnya tidak boleh menggagalkan
  // PDF-nya. Studio yang belum mengunggah logo tetap dapat kop bertipografi.
  try {
    const berkas = await ambilLogoStudio();
    if (berkas) {
      const gambar = berkas.tipe.includes("png")
        ? await doc.embedPng(berkas.bita)
        : await doc.embedJpg(berkas.bita);
      ctx.logo = { gambar, lebar: gambar.width, tinggi: gambar.height };
    }
  } catch {
    ctx.logo = null;
  }

  const halaman: PDFPage[] = [];
  let page = doc.addPage([LEBAR, TINGGI]);
  halaman.push(page);
  let y = gambarKop(page, ctx);

  // --- Judul dokumen dan identitas proyek ---------------------------------
  page.drawText(aman(isi.judul), { x: TEPI, y, size: 20, font: ctx.serifTebal, color: rgbDari(HITAM) });
  y -= 20;
  page.drawText(aman(isi.namaProyek), { x: TEPI, y, size: 11, font: ctx.sans, color: rgbDari(ABU) });

  const tanggal = aman(tanggalPanjang(studio.timezone));
  const lebarTanggal = ctx.sans.widthOfTextAtSize(tanggal, 9);
  page.drawText(tanggal, {
    x: LEBAR - TEPI - lebarTanggal, y, size: 9, font: ctx.sans, color: rgbDari(ABU),
  });
  y -= 30;

  // --- Tabel ---------------------------------------------------------------
  const xLabel = TEPI;
  const xTengah = TEPI + 250;
  const xNominal = LEBAR - TEPI;
  const lebarLabel = 235;
  const lebarTengah = 130;
  /* Jarak dari tepi kanan tempat label ringkasan berhenti. */
  const LEBAR_NILAI = 130;

  function kepalaTabel(p: PDFPage, atas: number): number {
    p.drawText("URAIAN", { x: xLabel, y: atas, size: 7.5, font: ctx.sansTebal, color: rgbDari(ABU) });
    p.drawText(aman(isi.kolomTengah.toUpperCase()), {
      x: xTengah, y: atas, size: 7.5, font: ctx.sansTebal, color: rgbDari(ABU),
    });
    const t = "NOMINAL";
    p.drawText(t, {
      x: xNominal - ctx.sansTebal.widthOfTextAtSize(t, 7.5), y: atas,
      size: 7.5, font: ctx.sansTebal, color: rgbDari(ABU),
    });
    p.drawRectangle({ x: TEPI, y: atas - 8, width: LEBAR - TEPI * 2, height: 0.8, color: rgbDari(HITAM) });
    return atas - 26;
  }

  y = kepalaTabel(page, y);

  const BATAS_BAWAH = TEPI + 90; // menyisakan ruang untuk ringkasan dan kaki

  for (const baris of isi.baris) {
    if (y < BATAS_BAWAH) {
      page = doc.addPage([LEBAR, TINGGI]);
      halaman.push(page);
      y = kepalaTabel(page, gambarKop(page, ctx));
    }

    page.drawText(potong(aman(baris.label), ctx.sans, 10, lebarLabel), {
      x: xLabel, y, size: 10, font: ctx.sans, color: rgbDari(HITAM),
    });

    if (baris.keterangan) {
      page.drawText(potong(aman(baris.keterangan), ctx.sans, 9, lebarTengah), {
        x: xTengah, y, size: 9, font: ctx.sans, color: rgbDari(ABU),
      });
    }

    const nominal = aman(formatRupiah(baris.nominal));
    page.drawText(nominal, {
      x: xNominal - ctx.sans.widthOfTextAtSize(nominal, 10), y,
      size: 10, font: ctx.sans, color: rgbDari(HITAM),
    });

    page.drawRectangle({ x: TEPI, y: y - 8, width: LEBAR - TEPI * 2, height: 0.4, color: rgbDari(GARIS) });
    y -= 22;
  }

  if (isi.baris.length === 0) {
    page.drawText("Belum ada data.", { x: xLabel, y, size: 10, font: ctx.sans, color: rgbDari(ABU) });
    y -= 22;
  }

  // --- Ringkasan -----------------------------------------------------------
  if (isi.ringkasan && isi.ringkasan.length > 0) {
    y -= 8;
    for (const r of isi.ringkasan) {
      const font = r.tebal ? ctx.sansTebal : ctx.sans;
      const ukuran = r.tebal ? 11 : 10;
      const label = aman(r.label);
      const nilai = aman(r.nilai);
      // Label rata KANAN terhadap kolom nominal, bukan rata kiri halaman:
      // pasangan label-nilai yang saling menempel jauh lebih mudah dibaca
      // daripada dua kolom yang terpisah selebar halaman.
      page.drawText(label, {
        x: xNominal - LEBAR_NILAI - font.widthOfTextAtSize(label, ukuran),
        y, size: ukuran, font, color: rgbDari(r.tebal ? HITAM : ABU),
      });
      page.drawText(nilai, {
        x: xNominal - font.widthOfTextAtSize(nilai, ukuran), y,
        size: ukuran, font, color: rgbDari(HITAM),
      });
      y -= r.tebal ? 20 : 17;
    }
  }

  if (isi.catatan) {
    y -= 10;
    page.drawText(potong(aman(isi.catatan), ctx.sans, 8.5, LEBAR - TEPI * 2), {
      x: TEPI, y, size: 8.5, font: ctx.sans, color: rgbDari(ABU),
    });
  }

  halaman.forEach((p, i) => gambarKaki(p, ctx, i + 1, halaman.length));

  const bita = await doc.save();
  const nama = namaBerkas([isi.judul, isi.namaProyek]);
  // BlobPart butuh ArrayBuffer, bukan ArrayBufferLike dari Uint8Array
  // pdf-lib — disalin supaya TypeScript dan runtime sama-sama puas.
  const blob = new Blob([bita.slice().buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  a.click();
  // Dilepas setelah klik sempat diproses; melepasnya seketika membatalkan
  // unduhan di sebagian browser.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return nama;
}
