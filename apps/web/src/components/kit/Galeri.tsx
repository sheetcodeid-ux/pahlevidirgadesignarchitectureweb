import { useState } from "react";
import { Tombol, TombolIkon, type JenisTombol, type UkuranTombol } from "./Tombol";
import { Segmen } from "./Segmen";
import { Ikon } from "./Ikon";
import { Lencana, Angka, Titik, type BentukLencana, type NadaLencana } from "./Lencana";
import { Remah } from "./Remah";
import { Paginasi } from "./Paginasi";
import { Cari, Isian, Centang, Sakelar } from "./Isian";
import { CalendarBlank, CaretDown, ChatTeardropDots, SmileySticker, Paperclip, SEMUA_IKON } from "./ikon";

/* =============================================================================
   Galeri kit — halaman kerja, bukan hiasan.

   Tiap contoh diberi atribut `data-ukur` berisi ANGKA FIGMA-nya, supaya
   pemeriksaan di browser bisa membandingkan sendiri: skrip pengukur membaca
   getBoundingClientRect() lalu mencocokkannya dengan angka di atribut itu.
   Menilai dari melihat tangkapan layar tidak cukup — jebakan yang membuat 145
   ikon terpotong lolos persis itu.
   ============================================================================= */

const UKURAN: UkuranTombol[] = ["small", "medium", "large"];

/* Bujur sangkar. Large radius 19 = setengah sisinya, jadi ia memang lingkaran. */
const SPEK_IKON: Record<"xsmall" | "small" | "medium" | "large", string> = {
  xsmall: "w=24;h=24;r=6;ikon=10",
  small: "w=28;h=28;r=7;ikon=12",
  medium: "w=32;h=32;r=8;ikon=14",
  large: "w=38;h=38;r=19;ikon=16",
};
const JENIS: JenisTombol[] = ["primary", "secondary", "ghost", "transparent"];

/* Spesifikasi KOTAK dari Figma — tinggi, radius, padding, jarak, ikon, font.
   LEBAR sengaja tidak dicantumkan: teks di Figma sudah jadi outline sehingga
   isinya tidak terbaca, jadi 49/59/68 itu lebar kata contoh Coinest, bukan
   ukuran yang harus ditiru oleh label berbahasa Indonesia. */
const SPEK: Record<UkuranTombol, string> = {
  small: "h=28;r=7;pad=8;gap=6;font=10;bobot=500;ikon=12",
  medium: "h=32;r=8;pad=10;gap=6;font=12;bobot=500;ikon=14",
  large: "h=38;r=8;pad=12;gap=6;font=14;bobot=500;ikon=16",
};
const TINGGI_FIGMA: Record<UkuranTombol, number> = { small: 28, medium: 32, large: 38 };

function Baris({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <div className="k-galeri__baris">
      <p className="k-galeri__label">{judul}</p>
      <div className="k-galeri__isi">{children}</div>
    </div>
  );
}

/* Bentuk lencana dan spek kotaknya, dari frame Badges. */
const BENTUK_LENCANA: [BentukLencana, string, string][] = [
  ["garis", "Badge Status", "h=16;r=3.5;pad=6;font=10"],
  ["pejalkecil", "Badge Status v2", "h=17;r=4;pad=6;font=10"],
  ["pejal", "Badge Status Transaction", "h=24;r=6;pad=8;font=12"],
  ["pil", "Badge Status Invoice", "h=24;r=12;pad=10;font=12"],
];
const NADA: [NadaLencana, string][] = [
  ["selesai", "Selesai"],
  ["menunggu", "Menunggu"],
  ["gagal", "Gagal"],
  ["netral", "Belum bayar"],
];

export function Galeri() {
  const [segmen, setSegmen] = useState("bulan");
  const [halaman, setHalaman] = useState(3);

  return (
    <div className="k-galeri">
      <section className="k-galeri__seksi">
        <h2 className="k-galeri__judul">Tombol</h2>
        <p className="k-galeri__ket">
          Frame <code>Button</code> · 3 ukuran x 4 jenis x 4 susunan ikon. Yang
          diperiksa KOTAKNYA — tinggi, radius, padding, jarak, ukuran ikon,
          ukuran dan bobot huruf. Lebarnya tidak: label Figma sudah jadi
          outline, jadi 49/59/68 adalah lebar kata contoh Coinest, bukan angka
          yang harus ditiru label berbahasa Indonesia.
        </p>

        {UKURAN.map((u) => (
          <Baris key={u} judul={`${u} — tinggi ${TINGGI_FIGMA[u]}`}>
            {JENIS.map((j) => (
              <div key={j} className="k-galeri__sel">
                <Tombol
                  ukuran={u}
                  jenis={j}
                  data-ukur={SPEK[u]}
                >
                  Label
                </Tombol>
                <Tombol
                  ukuran={u}
                  jenis={j}
                  kiri={CalendarBlank}
                  data-ukur={SPEK[u]}
                >
                  Label
                </Tombol>
                <Tombol
                  ukuran={u}
                  jenis={j}
                  kanan={CaretDown}
                  data-ukur={SPEK[u]}
                >
                  Label
                </Tombol>
                <Tombol
                  ukuran={u}
                  jenis={j}
                  kiri={CalendarBlank}
                  kanan={CaretDown}
                  data-ukur={SPEK[u]}
                >
                  Label
                </Tombol>
                <span className="k-galeri__tanda">{j}</span>
              </div>
            ))}
          </Baris>
        ))}
      </section>

      <section className="k-galeri__seksi">
        <h2 className="k-galeri__judul">Tombol ikon</h2>
        <p className="k-galeri__ket">
          Frame <code>Button Icon</code> · bujur sangkar 24 / 28 / 32 / 38. Yang
          Large BULAT (radius 19 = setengah sisinya); tiga lainnya bersudut.
        </p>
        <Baris judul="xsmall 24 · small 28 · medium 32 · large 38">
          {(["xsmall", "small", "medium", "large"] as const).map((u) => (
            <div key={u} className="k-galeri__sel">
              {JENIS.map((j) => (
                <TombolIkon
                  key={j}
                  ukuran={u}
                  jenis={j}
                  ikon={ChatTeardropDots}
                  judul={`Pesan ${u} ${j}`}
                  data-ukur={SPEK_IKON[u]}
                />
              ))}
              <span className="k-galeri__tanda">{u}</span>
            </div>
          ))}
        </Baris>
      </section>

      <section className="k-galeri__seksi">
        <h2 className="k-galeri__judul">Tombol bersegmen</h2>
        <p className="k-galeri__ket">
          Frame <code>Segmented Button</code> · 313x32, radius 8. Lebarnya sama
          untuk 2, 3, dan 4 segmen — jadi segmennya dibagi rata, bukan mengikuti
          panjang label.
        </p>
        <Baris judul="2 · 3 · 4 segmen">
          {[2, 3, 4].map((n) => (
            <Segmen
              key={n}
              judul={`Contoh ${n} segmen`}
              nilai={segmen}
              onPilih={setSegmen}
              className="k-galeri__segmen"
              data-ukur="h=32;r=8"
              segmen={[
                { nilai: "bulan", label: "Bulan" },
                { nilai: "kuartal", label: "Kuartal" },
                { nilai: "tahun", label: "Tahun" },
                { nilai: "semua", label: "Semua" },
              ].slice(0, n)}
            />
          ))}
        </Baris>
      </section>

      <section className="k-galeri__seksi">
        <h2 className="k-galeri__judul">Lencana</h2>
        <p className="k-galeri__ket">
          Frame <code>Badges</code> · empat bentuk dan empat nada. Nadanya dinamai
          maknanya, bukan warnanya — warna boleh berubah, maknanya tidak.
        </p>
        {BENTUK_LENCANA.map(([bentuk, asal, spek]) => (
          <Baris key={bentuk} judul={asal}>
            {NADA.map(([nada, label]) => (
              <Lencana key={nada} bentuk={bentuk} nada={nada} data-ukur={spek}>
                {label}
              </Lencana>
            ))}
          </Baris>
        ))}
        <Baris judul="Indicator — angka dan titik">
          <Angka jumlah={9} judul="Pesan belum dibaca" data-ukur="h=18;r=9;font=10" />
          <Angka jumlah={128} judul="Pesan belum dibaca" data-ukur="h=18;r=9;font=10" />
          <Angka jumlah={4} kecil judul="Pesan belum dibaca" data-ukur="h=10;r=5" />
          <Titik judul="Ada yang baru" data-ukur="w=10;h=10;r=5" />
          <Titik kecil judul="Ada yang baru" data-ukur="w=8;h=8;r=4" />
        </Baris>
      </section>

      <section className="k-galeri__seksi">
        <h2 className="k-galeri__judul">Remah &amp; paginasi</h2>
        <p className="k-galeri__ket">
          Frame <code>Breadcrumb</code> dan <code>Pagination</code>. Paginasi punya
          dua versi: 28px untuk desktop, 32px untuk ponsel — tinggi yang sama
          dengan tombol small dan Medium, jadi keduanya tetap sebaris.
        </p>
        <Baris judul="Breadcrumb">
          <Remah
            jalur={[
              { label: "Dashboard", href: "/admin" },
              { label: "Proyek", href: "/admin/proyek" },
              { label: "Rumah Kaca" },
            ]}
          />
        </Baris>
        <Baris judul="Default — 28px">
          <Paginasi kini={halaman} total={12} onPindah={setHalaman} />
        </Baris>
        <Baris judul="Mobile — 32px">
          <Paginasi kini={halaman} total={12} onPindah={setHalaman} ponsel />
        </Baris>
      </section>

      <section className="k-galeri__seksi">
        <h2 className="k-galeri__judul">Isian</h2>
        <p className="k-galeri__ket">
          Frame <code>Forms</code>. Semuanya elemen HTML asli yang digambar ulang —
          kotak cari <code>input[type=search]</code>, centang dan sakelar{" "}
          <code>input[type=checkbox]</code> — jadi perilaku bawaannya tidak bisa
          rusak diam-diam. Ikon cari di KANAN, seperti di framenya.
        </p>
        <Baris judul="Input-search — 37 / 31 / 27">
          {(["large", "medium", "small"] as const).map((u) => (
            <Cari
              key={u}
              ukuran={u}
              judul={`Cari ${u}`}
              placeholder="Cari proyek, klien, tagihan…"
              data-ukur={{ large: "h=37", medium: "h=31", small: "h=27" }[u]}
            />
          ))}
        </Baris>
        <Baris judul="Input — kotak 45, radius 7,5">
          <Isian
            label="Nama proyek"
            placeholder="Rumah Kaca"
            kiri={SmileySticker}
            bantu="Dipakai sebagai judul di halaman publik."
            kanan={<Ikon ikon={Paperclip} ukuran={16} />}
          />
        </Baris>
        <Baris judul="Checkbox — 13 / 17 / 23">
          {(["default", "medium", "big"] as const).map((u) => (
            <label key={u} className="k-galeri__sel">
              <Centang ukuran={u} defaultChecked data-ukur={{ default: "w=13;h=13", medium: "w=17;h=17", big: "w=23;h=23" }[u]} />
              <span className="k-galeri__tanda">{u}</span>
            </label>
          ))}
        </Baris>
        <Baris judul="Toggle — 28x16">
          <Sakelar judul="Tampilkan di beranda" defaultChecked data-ukur="w=28;h=16;r=8" />
          <Sakelar judul="Kirim notifikasi" data-ukur="w=28;h=16;r=8" />
        </Baris>
      </section>

      <section className="k-galeri__seksi">
        <h2 className="k-galeri__judul">Ikon — {SEMUA_IKON.length} bentuk</h2>
        <p className="k-galeri__ket">
          Seluruhnya dari frame <code>Element</code>. Bingkai masternya 32; di
          sini digambar pada 24, ukuran yang dipakai Coinest di halaman.
        </p>
        <div className="k-galeri__ikon">
          {SEMUA_IKON.map(([nama, data]) => (
            <figure key={nama}>
              <Ikon ikon={data} ukuran={24} />
              <figcaption>{nama}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
