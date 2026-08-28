import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { RequireAuth } from "./RequireAuth";
import { SkeletonDaftar } from "../ui/Skeleton";
import { ambilNotifikasi, type BarisNotifikasi } from "../../lib/notifikasi";

/** Daftar dan keadaan kosong, dipakai halaman ini DAN popover lonceng. */
export function IsiNotifikasi({
  baris, tab, ringkas = false,
}: { baris: BarisNotifikasi[] | null; tab: "notifikasi" | "milestone"; ringkas?: boolean }) {
  if (baris === null) {
    return (
      <div className={ringkas ? "empty empty--sm" : "empty"}>
        <span className="spinner" />
        <p className="t-muted">Memuat…</p>
      </div>
    );
  }

  if (baris.length === 0) {
    return (
      <div className={ringkas ? "empty empty--sm" : "empty"}>
        <span className="icon-tile">
          <Icon name={tab === "notifikasi" ? "bellOff" : "gift"} size={22} />
        </span>
        <h2 className="t-heading">
          {tab === "notifikasi" ? "Tidak ada notifikasi" : "Tidak ada milestone bulan ini"}
        </h2>
        <p className="t-muted">
          {tab === "notifikasi"
            ? "Notifikasi penting akan muncul di sini"
            : "Akan muncul ketika sebuah proyek naik tahap: Deal & Kontrak, DP 50%, Desain, Finish, atau Pelunasan."}
        </p>
      </div>
    );
  }

  return (
    <ul className="notiflist">
      {baris.map((b) => (
        <li key={b.id}>
          <a className="notiflist__baris" href={b.ke}>
            <span className="icon-tile icon-tile--sm"><Icon name={b.ikon} size={16} /></span>
            <span className="notiflist__teks">
              <span className="notiflist__judul">{b.judul}</span>
              <span className="notiflist__detail">{b.detail}</span>
            </span>
            {b.waktu && !ringkas && <span className="notiflist__waktu t-mono">{b.waktu}</span>}
            <Icon name="chevronRight" size={16} />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Kelompok tab Notifikasi/Milestone — bentuknya sama di halaman dan popover. */
export function TabNotifikasi({
  tab, setTab, blok = false,
}: {
  tab: "notifikasi" | "milestone";
  setTab: (t: "notifikasi" | "milestone") => void;
  /** Dua tab dibagi rata selebar wadahnya, bukan mengikuti panjang teksnya. */
  blok?: boolean;
}) {
  return (
    <div className={blok ? "segmented segmented--block" : "segmented"} role="tablist" aria-label="Jenis pemberitahuan">
      {([["notifikasi", "Notifikasi"], ["milestone", "Milestone"]] as const).map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          className="segmented__opt"
          aria-selected={tab === id}
          onClick={() => setTab(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Isi() {
  const [tab, setTab] = useState<"notifikasi" | "milestone">("notifikasi");
  const [notif, setNotif] = useState<BarisNotifikasi[] | null>(null);
  const [milestone, setMilestone] = useState<BarisNotifikasi[] | null>(null);

  useEffect(() => {
    ambilNotifikasi()
      .then((d) => { setNotif(d.notifikasi); setMilestone(d.milestone); })
      .catch(() => { setNotif([]); setMilestone([]); });
  }, []);

  const isi = tab === "notifikasi" ? notif : milestone;

  return (
    <div className="notifpage__isi">
      <TabNotifikasi tab={tab} setTab={setTab} />
      <div className="notifkotak">
        <IsiNotifikasi baris={isi} tab={tab} />
      </div>
    </div>
  );
}

export function NotifikasiPanel() {
  return <RequireAuth kerangka={<SkeletonDaftar jumlah={4} aksi={0} />}><Isi /></RequireAuth>;
}
