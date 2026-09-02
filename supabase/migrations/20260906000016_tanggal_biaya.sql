-- Tanggal biaya benar-benar terjadi, terpisah dari kapan ia diketik.
--
-- Analisis bulanan menjumlahkan biaya per bulan. Tanpa kolom ini yang bisa
-- dipakai cuma created_at — yaitu kapan stafnya MENGETIK, bukan kapan uangnya
-- keluar. Satu sore mengetik nota tiga bulan ke belakang akan menumpuk
-- semuanya ke bulan ini, dan grafiknya berbohong tanpa ada yang tahu.
--
-- Kas masuk tidak butuh kolom baru: invoices.paid_at sudah ada sejak awal.

alter table public.project_costs
  add column incurred_on date not null default current_date;

-- Baris lama memakai tanggal ketiknya sendiri — itu satu-satunya tanggal yang
-- pernah diketahui untuk mereka, dan menebak yang lain lebih buruk daripada
-- memakai yang ada.
update public.project_costs set incurred_on = created_at::date;

comment on column public.project_costs.incurred_on is
  'Tanggal biaya benar-benar terjadi. Dipakai analisis bulanan; created_at hanya mencatat kapan barisnya diketik.';

-- Analisis bulanan menyapu seluruh tabel per rentang tanggal, bukan per proyek.
create index project_costs_incurred_idx on public.project_costs (incurred_on);

-- Kas masuk bulanan menyaring invoice lunas per tanggal bayar.
create index invoices_paid_idx on public.invoices (paid_at) where status = 'lunas';
