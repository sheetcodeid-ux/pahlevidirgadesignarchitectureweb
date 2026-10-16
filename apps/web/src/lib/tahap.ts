/* Tahap pipeline proyek — nilai enum `pipeline_stage` di database dan
   labelnya. Satu daftar untuk rak Semua Proyek, Jadwal Pelaksanaan, dan
   surat perjanjian Proyek Baru (jebakan #32): nilainya disimpan di
   database, jadi mengubah satu kata di sini berarti tahap lama tidak lagi
   punya label. Hidup di lib, bukan di komponen halaman, supaya halaman yang
   cuma butuh labelnya tidak ikut memuat seluruh rak ordner. */
export const TAHAP: { value: string; label: string }[] = [
  { value: "proposal", label: "Proposal" },
  { value: "deal_kontrak", label: "Deal Kontrak" },
  { value: "dp_50", label: "DP 50%" },
  { value: "desain_1", label: "Desain 1" },
  { value: "desain_2", label: "Desain 2" },
  { value: "finish", label: "Finish" },
  { value: "pelunasan", label: "Pelunasan" },
];
