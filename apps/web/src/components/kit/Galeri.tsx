import { useEffect, useMemo, useState } from "react";
import { Cari } from "./Isian";
import { Remah } from "./Remah";
import { Ikon, type DataIkon } from "./Ikon";
import { Lencana } from "./Lencana";
import { Kosong } from "./Tampilan";
import { MenuNavigasi } from "./Overlay";
import { ArrowLeft, ArrowRight, IKON_ARSITEKTUR, MagnifyingGlass } from "./ikon";
import { KATALOG, JUMLAH_KOMPONEN, IKON_FOLDER_IKON, type Entri, type Folder } from "./galeri/katalog";
import { halamanRata } from "../../lib/navAdmin";

/* =============================================================================
   Halaman UI Component — pustaka kit sebagai FOLDER.

   Tiga tingkat, masing-masing satu alamat hash supaya tombol Kembali peramban
   dan tautan yang dibagikan bekerja:

     #                       folder-folder
     #formulir               isi satu folder
     #formulir/date-picker   satu komponen, dengan demo hidup

   Hash dibaca sesudah dipasang, bukan saat render: server tidak tahu hash,
   dan nilai awal yang berbeda membuang pohon React saat hidrasi (jebakan #8).

   "Dipakai di" dihitung saat BUILD dari kode sumber (pages/admin/kit.astro),
   bukan ditulis tangan — daftar tangan pasti basi (jebakan #32).
   ============================================================================= */

/* Komponen yang SENGAJA belum dipakai panel, dan kenapa — jujur, bukan
   ditempel paksa ke halaman yang tidak membutuhkannya. */
const BELUM_DIPAKAI: Record<string, string> = {
  "input-otp": "Belum dipakai: panel masuk dengan email + kata sandi, tanpa kode sekali pakai. Tempatnya halaman masuk kalau verifikasi dua langkah dinyalakan.",
  direction: "Belum dipakai: seluruh isi panel berbahasa Indonesia, kiri-ke-kanan. Dipakai kalau suatu saat ada isi berbahasa Arab.",
  questionnaire: "Belum dipakai di panel: tempatnya form kontak situs publik (penyaringan calon klien), yang memakai desain situs, bukan kit panel.",
};

/* Halaman di luar rel (dibuka dari dalam halaman lain) diberi nama di sini —
   tanpa ini chipnya tercetak sebagai alamat mentah "paket / satu". */
const LABEL_HALAMAN = new Map<string, string>([
  ...halamanRata().map((h): [string, string] => [h.href.replace(/\/$/, ""), h.label]),
  ["/admin/proyek/satu", "Proyek — Satu Proyek"],
  ["/admin/proyek/baru", "Proyek — Proyek Baru"],
  ["/admin/proyek/edit", "Proyek — Ubah Proyek"],
  ["/admin/notifikasi", "Notifikasi"],
]);
const labelHalaman = (r: string) => LABEL_HALAMAN.get(r) ?? r.replace(/^\/admin\/?/, "").replace(/\//g, " / ") ?? r;

function bacaHash(): string[] {
  return decodeURIComponent(location.hash.replace(/^#/, ""))
    .split("/")
    .filter(Boolean);
}

export function Galeri({ pakai = {} }: { pakai?: Record<string, string[]> }) {
  const [jalur, setJalur] = useState<string[]>([]);
  const [cari, setCari] = useState("");

  useEffect(() => {
    const baca = () => setJalur(bacaHash());
    baca();
    /* popstate juga: tombol Kembali di antara entri pushState(null) tidak
       memicu hashchange. Router Astro mengabaikan entri ber-state null. */
    window.addEventListener("hashchange", baca);
    window.addEventListener("popstate", baca);
    return () => {
      window.removeEventListener("hashchange", baca);
      window.removeEventListener("popstate", baca);
    };
  }, []);

  const ke = (...j: string[]) => {
    const h = j.length ? `#${j.join("/")}` : location.pathname;
    /* state null dengan sengaja: router Astro mengabaikan popstate ber-state
       null, jadi Kembali di antara folder tidak memicu muat-ulang halaman. */
    history.pushState(null, "", h);
    setJalur(j);
    setCari("");
    document.getElementById("konten")?.scrollIntoView({ block: "start" });
  };

  const folder = KATALOG.find((f) => f.id === jalur[0]);
  const entri = folder?.isi.find((e) => e.id === jalur[1]);
  const folderIkon = jalur[0] === "ikon";

  const hasilCari = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return null;
    return KATALOG.flatMap((f) => f.isi.map((e) => ({ f, e }))).filter(({ f, e }) =>
      `${e.nama} ${e.kit} ${e.ket} ${f.nama}`.toLowerCase().includes(q),
    );
  }, [cari]);

  const dipakai = KATALOG.flatMap((f) => f.isi).filter((e) => (pakai[e.id]?.length ?? 0) > 0).length;

  /* Tautan "#…" di dalam galeri (remah, contoh tautan di demo) ditangani di
     sini — router sisi klien memindahkan hash lewat pushState TANPA memicu
     hashchange, dan untuk href="#" bahkan memuat ulang halamannya. */
  const tangkapTautan = (e: React.MouseEvent) => {
    const a = (e.target as Element).closest?.("a[href^='#']");
    if (!a || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    ke(...decodeURIComponent(a.getAttribute("href")!.slice(1)).split("/").filter(Boolean));
  };

  return (
    <div className="gal" onClickCapture={tangkapTautan}>
      <div className="gal-atas">
        <Remah
          jalur={[
            { label: "UI Component", href: jalur.length ? "#" : undefined },
            ...(folder ? [{ label: folder.nama, href: entri ? `#${folder.id}` : undefined }] : []),
            ...(folderIkon ? [{ label: "Ikon" }] : []),
            ...(entri ? [{ label: entri.nama }] : []),
          ]}
        />
        {!entri && (
          <Cari
            judul="Cari komponen"
            placeholder="Cari komponen"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            ukuran="medium"
          />
        )}
      </div>

      {/* Menu navigasi: lompat langsung ke komponen mana pun dari folder mana
          pun — 62 komponen terlalu banyak untuk selalu lewat folder. */}
      {!entri && !hasilCari && (
        <MenuNavigasi
          label="Folder komponen"
          butir={KATALOG.map((f) => ({
            label: f.nama,
            anak: f.isi.map((e) => ({ label: e.nama, href: `#${f.id}/${e.id}`, ket: e.kit })),
          }))}
        />
      )}

      {/* Di layar laptop yang memuat satu layar, isi di bawah menu navigasi
          digulir di dalam wadah ini; di lebar lain ia display: contents. */}
      <div className="gal-gulir">
        {hasilCari ? (
          <HasilCari hasil={hasilCari} pakai={pakai} onBuka={(f, e) => ke(f.id, e.id)} />
        ) : entri && folder ? (
          <Detail folder={folder} entri={entri} pakai={pakai[entri.id] ?? []} onKe={ke} />
        ) : folder ? (
          <IsiFolder folder={folder} pakai={pakai} onBuka={(e) => ke(folder.id, e.id)} />
        ) : folderIkon ? (
          <FolderIkon />
        ) : (
          <>
            <p className="gal-ringkas">
              <b>{JUMLAH_KOMPONEN}</b> komponen dalam <b>{KATALOG.length}</b> folder · <b>{dipakai}</b> sudah dipakai di halaman panel
            </p>
            <div className="gal-folderkisi">
              {KATALOG.map((f) => (
                <KartuFolder
                  key={f.id}
                  ikon={f.ikon}
                  nama={f.nama}
                  ket={f.ket}
                  jumlah={f.isi.length}
                  dipakai={f.isi.filter((e) => (pakai[e.id]?.length ?? 0) > 0).length}
                  cuplik={f.isi.map((e) => e.nama)}
                  onBuka={() => ke(f.id)}
                />
              ))}
              <KartuFolder ikon={IKON_FOLDER_IKON} nama="Ikon" ket={`Bahan semua komponen — ${IKON_ARSITEKTUR.length} bentuk arsitektur buatan studio + 179 dari Coinest.`} jumlah={IKON_ARSITEKTUR.length + 179} cuplik={[]} onBuka={() => ke("ikon")} satuan="bentuk" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function KartuFolder({
  ikon,
  nama,
  ket,
  jumlah,
  dipakai,
  cuplik,
  onBuka,
  satuan = "komponen",
}: {
  ikon: DataIkon;
  nama: string;
  ket: string;
  jumlah: number;
  dipakai?: number;
  cuplik: string[];
  onBuka: () => void;
  satuan?: string;
}) {
  return (
    <button type="button" className="gal-folder" onClick={onBuka}>
      <span className="gal-folder__tab" aria-hidden="true" />
      <span className="gal-folder__badan">
        <span className="gal-folder__kepala">
          <span className="gal-folder__ubin" aria-hidden="true">
            <Ikon ikon={ikon} ukuran={20} />
          </span>
          <span className="gal-folder__jumlah">
            {jumlah} {satuan}
          </span>
        </span>
        <b className="gal-folder__nama">{nama}</b>
        <span className="gal-folder__ket">{ket}</span>
        {cuplik.length > 0 && <span className="gal-folder__cuplik">{cuplik.join(" · ")}</span>}
        {dipakai !== undefined && (
          <span className="gal-folder__meter" aria-label={`${dipakai} dari ${jumlah} dipakai di halaman`}>
            <span className="gal-folder__rel">
              <span style={{ width: `${(dipakai / jumlah) * 100}%` }} />
            </span>
            {dipakai}/{jumlah} dipakai
          </span>
        )}
      </span>
    </button>
  );
}

function ChipPakai({ n }: { n: number }) {
  return n > 0 ? (
    <Lencana bentuk="pejalkecil" nada="selesai">
      {n} halaman
    </Lencana>
  ) : (
    <Lencana bentuk="pejalkecil" nada="menunggu">
      Galeri saja
    </Lencana>
  );
}

function KartuKomponen({ e, n, onBuka, folder }: { e: Entri; n: number; onBuka: () => void; folder?: string }) {
  return (
    <button type="button" className="gal-komp" onClick={onBuka}>
      <span className="gal-komp__kepala">
        <b>{e.nama}</b>
        <ChipPakai n={n} />
      </span>
      <code className="gal-komp__kit">{e.kit}</code>
      <span className="gal-komp__ket">{e.ket}</span>
      {folder && <span className="gal-komp__folder">{folder}</span>}
    </button>
  );
}

function IsiFolder({ folder, pakai, onBuka }: { folder: Folder; pakai: Record<string, string[]>; onBuka: (e: Entri) => void }) {
  return (
    <>
      <div className="gal-judulfolder">
        <span className="gal-folder__ubin" aria-hidden="true">
          <Ikon ikon={folder.ikon} ukuran={20} />
        </span>
        <div>
          <h2 className="gal-h2">{folder.nama}</h2>
          <p className="gal-ket">
            {folder.ket} {folder.isi.length} komponen.
          </p>
        </div>
      </div>
      <div className="gal-kompkisi">
        {folder.isi.map((e) => (
          <KartuKomponen key={e.id} e={e} n={pakai[e.id]?.length ?? 0} onBuka={() => onBuka(e)} />
        ))}
      </div>
    </>
  );
}

function HasilCari({ hasil, pakai, onBuka }: { hasil: { f: Folder; e: Entri }[]; pakai: Record<string, string[]>; onBuka: (f: Folder, e: Entri) => void }) {
  if (!hasil.length)
    return (
      <Kosong ikon={MagnifyingGlass} judul="Tidak ada komponen yang cocok">
        Coba nama lain — misalnya “dialog”, “tanggal”, atau “tabel”.
      </Kosong>
    );
  return (
    <div className="gal-kompkisi">
      {hasil.map(({ f, e }) => (
        <KartuKomponen key={e.id} e={e} n={pakai[e.id]?.length ?? 0} folder={f.nama} onBuka={() => onBuka(f, e)} />
      ))}
    </div>
  );
}

function Detail({ folder, entri, pakai, onKe }: { folder: Folder; entri: Entri; pakai: string[]; onKe: (...j: string[]) => void }) {
  const i = folder.isi.indexOf(entri);
  const lalu = folder.isi[i - 1];
  const lanjut = folder.isi[i + 1];
  const { Demo } = entri;
  const berkas = entri.modul.replace(/^kit\//, "../kit/").replace(/^admin\//, "./");
  return (
    <article className="gal-detail">
      <header className="gal-detail__kepala">
        <div>
          <h2 className="gal-h1">{entri.nama}</h2>
          <p className="gal-ket gal-detail__ket">{entri.ket}</p>
        </div>
        <div className="gal-detail__pindah">
          <button type="button" className="k-ov__tutup" disabled={!lalu} onClick={() => lalu && onKe(folder.id, lalu.id)} aria-label={lalu ? `Sebelumnya: ${lalu.nama}` : "Tidak ada sebelumnya"}>
            <Ikon ikon={ArrowLeft} ukuran={14} />
          </button>
          <span className="gal-ket">
            {i + 1} / {folder.isi.length}
          </span>
          <button type="button" className="k-ov__tutup" disabled={!lanjut} onClick={() => lanjut && onKe(folder.id, lanjut.id)} aria-label={lanjut ? `Berikutnya: ${lanjut.nama}` : "Tidak ada berikutnya"}>
            <Ikon ikon={ArrowRight} ukuran={14} />
          </button>
        </div>
      </header>

      <section className="gal-panggung" aria-label={`Contoh ${entri.nama}`}>
        <Demo />
      </section>

      <div className="gal-detail__info">
        <section>
          <h3 className="gal-h3">Dipakai di</h3>
          <p className="gal-ket gal-detail__catatan">Halaman yang memuat komponen ini — sebagian hanya tampil pada keadaan tertentu (memuat, kosong, galat).</p>
          {pakai.length ? (
            <ul className="gal-chips">
              {pakai.map((r) => (
                <li key={r}>
                  <a className="gal-chip" href={r}>
                    {labelHalaman(r)}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="gal-ket">{BELUM_DIPAKAI[entri.id] ?? "Belum dipakai halaman panel mana pun — komponen ini tersedia untuk fitur berikutnya."}</p>
          )}
        </section>
        <section>
          <h3 className="gal-h3">Cara pakai</h3>
          <pre className="gal-kode">
            <code>{`import { ${entri.ekspor[0]} } from "${berkas}";`}</code>
          </pre>
          <p className="gal-ket">
            Nama di kode: <code>{entri.kit}</code>
          </p>
        </section>
      </div>
    </article>
  );
}

function FolderIkon() {
  const [ikon, setIkon] = useState<ReadonlyArray<readonly [string, DataIkon]> | null>(null);
  const [cari, setCari] = useState("");
  /* Dimuat saat folder dibuka: 179 ikon = ±320 KB, dan tidak ada alasan
     membawanya ke delapan folder lain. */
  useEffect(() => {
    let hidup = true;
    import("./ikon/semua").then((m) => hidup && setIkon(m.SEMUA_IKON));
    return () => {
      hidup = false;
    };
  }, []);
  const saring = (d: ReadonlyArray<readonly [string, DataIkon]>) => d.filter(([n]) => n.toLowerCase().includes(cari.toLowerCase()));
  const ars = saring(IKON_ARSITEKTUR);
  const coinest = saring(ikon ?? []);
  const kisi = (d: ReadonlyArray<readonly [string, DataIkon]>) => (
    <div className="gal-ikonkisi">
      {d.map(([nama, data]) => (
        <figure key={nama}>
          <Ikon ikon={data} ukuran={24} />
          <figcaption>{nama}</figcaption>
        </figure>
      ))}
    </div>
  );
  return (
    <>
      <div className="gal-atas gal-atas--dalam">
        <h2 className="gal-h2">Ikon — {IKON_ARSITEKTUR.length + (ikon?.length ?? 179)} bentuk</h2>
        <Cari judul="Cari ikon" placeholder="Cari nama ikon" value={cari} onChange={(e) => setCari(e.target.value)} ukuran="small" />
      </div>
      {/* Ikon arsitektur buatan sendiri — rel samping dan palet perintah.
          Garisnya digambar pena saat lembarnya dibuka. */}
      <h3 className="gal-h3">Arsitektur — {IKON_ARSITEKTUR.length} bentuk</h3>
      {kisi(ars)}
      <h3 className="gal-h3">Coinest — {ikon?.length ?? 179} bentuk</h3>
      {kisi(coinest)}
    </>
  );
}
