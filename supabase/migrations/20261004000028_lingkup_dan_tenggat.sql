-- Fase 2 alur Excel pemilik: kolom "SCOPE OF WORK" dan "DEADLINE DATE" di
-- sheet LIST PROJECT.
--
-- Lingkup kerja TIDAK disimpan di project_briefs.requirements: kolom itu milik
-- KLIEN — ia mengisinya sendiri dari portal /progres, dan ditampilkan kembali
-- di sana. Lingkup kerja adalah kesepakatan studio tentang apa yang dikerjakan
-- ("Design Interior berkonsep Pop Art, studio berisi layanan nail art…"), dan
-- menaruhnya di tempat yang bisa ditimpa klien berarti kesepakatannya bisa
-- berubah tanpa studio tahu.
--
-- Tenggat dua tanggal, persis kebiasaan di Excel ("24 Mei preview, 26 Mei
-- Final Design"): preview untuk klien dan desain final. Kolom date, bukan
-- teks — teks tidak bisa diurutkan, tidak bisa dibandingkan dengan hari ini,
-- dan di Excel tahunnya sudah sempat salah ketik.
--
-- ADITIF dan boleh kosong: proyek lama tidak punya lingkup maupun tenggat,
-- dan Worker API yang sedang tayang tidak menyebut kolom ini sama sekali.
--
-- Catatan akses: GRANT di Postgres berlaku per tabel, jadi kolom baru ikut
-- hak yang sudah ada pada public.projects. API PUBLIK memilih kolomnya satu
-- per satu (repository/projects.ts) dan tidak menyebut ketiganya, jadi
-- pengunjung situs tidak pernah menerimanya.

alter table public.projects
  add column scope_of_work    text check (scope_of_work is null or length(scope_of_work) <= 2000),
  add column deadline_preview date,
  add column deadline_final   date,
  -- Final sebelum preview hampir pasti salah ketik — dan di Excel tahunnya
  -- memang sempat melompat mundur.
  add constraint projects_tenggat_urut
    check (deadline_preview is null or deadline_final is null or deadline_final >= deadline_preview);
