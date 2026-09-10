-- Logo klien untuk marquee "SELECTED CLIENTS" di beranda.
--
-- Sebelumnya nama-namanya di-hardcode di apps/web/src/lib/menunggu.ts sebagai
-- teks. Pemilik mengirim logonya, tapi yang tayang cuma namanya — dan setiap
-- penambahan klien berikutnya berarti mengubah kode. Tabel ini memindahkan
-- daftarnya ke tempat yang bisa dia urus sendiri dari panel admin.
--
-- Berkasnya di R2 lewat folder `klien/`, pola yang sama dengan `studio/` untuk
-- logo studio: dipisah dari `projects/` supaya aset yang bukan milik proyek
-- tidak ikut terhapus saat proyek dibersihkan.

create table public.client_logos (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 1 and 120),
  -- Boleh kosong: pemilik bisa mendaftarkan klien lebih dulu, logonya menyusul.
  -- Marquee menampilkan namanya sebagai teks selama logonya belum ada, jadi
  -- barisnya tidak pernah bolong.
  logo_key   text,
  -- Urutan tampil diatur pemilik, bukan abjad: yang paling dikenal di depan.
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_logos_urutan_idx on public.client_logos (sort_order, created_at);

create trigger client_logos_touch_updated_at
  before update on public.client_logos
  for each row execute function public.touch_updated_at();

alter table public.client_logos enable row level security;

-- Seluruh barisnya memang untuk publik: ia daftar klien yang sengaja
-- dipamerkan di beranda. Tidak ada kolom yang perlu disembunyikan, jadi tidak
-- ada syarat status seperti di testimonials atau journal_posts.
create policy "publik baca logo klien"
  on public.client_logos for select
  to anon, authenticated
  using (true);

create policy "staf kelola logo klien"
  on public.client_logos for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke all on public.client_logos from anon, authenticated;
grant select                         on public.client_logos to anon;
grant select, insert, update, delete on public.client_logos to authenticated;
grant all                            on public.client_logos to service_role;
