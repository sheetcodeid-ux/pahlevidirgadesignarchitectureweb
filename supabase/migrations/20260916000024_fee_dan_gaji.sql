-- Fee proyek per orang, dan gaji bulanan.
--
-- Dua halaman baru yang diminta pemilik — "pembagian fee untuk arsitek" dan
-- "gaji" — tidak bisa dibangun di atas skema yang ada, dan itu temuan yang
-- mengubah rencananya:
--
--   * `project_costs` menyimpan label, kategori, nominal, dan tanggal, tapi
--     TIDAK menyimpan siapa yang dibayar. Kategori 'freelancer' sudah ada
--     sejak awal, isinya teks bebas. Jadi pertanyaan "orang ini tahun ini
--     sudah terima berapa dari semua proyek" tidak pernah bisa dijawab —
--     datanya memang tidak direkam.
--   * `team_members` cuma punya nama dan peran. Tidak ada rate, dan tidak ada
--     pembedaan core freelancer / project freelancer yang diminta §5.2
--     dokumen strategi.
--
-- SATU berkas, bukan tiga, walau rencananya menyebut tiga perubahan: ketiganya
-- melayani satu fitur dan halaman Fee tidak berarti apa-apa tanpa kolom
-- penautnya. Migrasi yang separuh diterapkan pada tabel uang adalah keadaan
-- yang tidak boleh ada sama sekali.

-- ── 1. Biaya tahu siapa yang dibayar ──────────────────────────────────────
--
-- BOLEH KOSONG, dan itu disengaja dua kali:
--   * biaya operasional (sewa, cetak, perizinan) memang bukan milik siapa pun
--   * puluhan baris lama tidak punya nama, dan menautkannya satu per satu
--     memakan waktu pemilik untuk angka yang sudah lewat. Halaman Fee
--     menghitung yang tertaut saja, dan menyebut sisanya apa adanya.
--
-- `on delete set null`, BUKAN cascade: menghapus seorang freelancer tidak
-- boleh ikut menghapus biaya yang sudah dikeluarkan studio. Uangnya tetap
-- keluar; yang hilang cuma namanya.
alter table public.project_costs
  add column team_member_id uuid references public.team_members (id) on delete set null;

create index project_costs_orang_idx
  on public.project_costs (team_member_id, incurred_on desc)
  where team_member_id is not null;

-- ── 2. Tim tahu jenis dan tarifnya ────────────────────────────────────────

-- Empat jenis, diturunkan dari §5.2 dan §5.3 dokumen strategi:
--   partner — Dirga dan Adji. Digaji bulanan DAN bisa menerima fee proyek.
--   inti    — core freelancer (3-5 orang): rate lebih tinggi, prioritas
--             proyek, komitmen jangka panjang.
--   proyek  — project freelancer, dipanggil sesuai kebutuhan.
--   staf    — karyawan tetap. Belum ada satu pun hari ini; §5.3 menyebut
--             junior arsitek atau drafter sebagai hire pertama, dan enum ini
--             sudah menampungnya supaya penambahannya nanti tidak butuh
--             migrasi lagi.
create type public.member_kind as enum ('partner', 'inti', 'proyek', 'staf');

alter table public.team_members
  add column kind   public.member_kind not null default 'proyek',
  -- Tarif acuan, bukan nominal yang mengikat. Yang benar-benar dibayar tetap
  -- diketik per proyek di halaman Fee — tarif di sini cuma supaya tidak
  -- perlu diingat-ingat saat mengisi. Boleh kosong.
  add column rate   numeric(14, 2) check (rate is null or rate > 0),
  add column phone  text,
  -- Freelancer yang sudah tidak dipakai lagi disembunyikan dari dropdown,
  -- BUKAN dihapus: menghapusnya memutus namanya dari biaya yang sudah
  -- tercatat, dan riwayat pembayaran adalah hal terakhir yang boleh hilang.
  add column active boolean not null default true,
  add column updated_at timestamptz not null default now();

create trigger team_members_touch_updated_at
  before update on public.team_members
  for each row execute function public.touch_updated_at();

-- ── 3. Gaji bulanan ───────────────────────────────────────────────────────
--
-- HANYA untuk bayaran yang tidak lahir dari sebuah proyek. Bayaran freelancer
-- TIDAK dicatat di sini — ia sudah tercatat sebagai biaya proyek, dan halaman
-- Gaji menjumlahkannya dari sana.
--
-- Aturannya satu kalimat: satu nominal hanya boleh diketik di satu tempat.
-- Kalau seorang freelancer diketik di sini DAN di biaya proyek, beban studio
-- tercatat dua kali dan laba bersihnya salah — kesalahan yang tidak terlihat
-- sampai tutup buku.
--
-- §6.1 dokumen strategi: "Dirga dan Adji harus menerima gaji bulanan yang
-- wajar untuk pekerjaan operasional, terpisah dari dividen tahunan."
-- Tabel ini gaji operasionalnya. Dividen 70-20-10 TIDAK ada di sini dan
-- sengaja belum dibuatkan apa pun.
create table public.payroll (
  id             uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references public.team_members (id) on delete restrict,
  -- Tanggal 1 bulan yang bersangkutan. Disimpan sebagai date, bukan teks
  -- 'YYYY-MM': date bisa diurutkan, disaring per rentang, dan dibandingkan
  -- dengan incurred_on milik biaya proyek tanpa satu pun konversi.
  period         date not null check (extract(day from period) = 1),
  amount         numeric(14, 2) not null check (amount > 0),
  -- Kosong = belum dibayar. SATU kolom, bukan kolom status terpisah: dua
  -- kolom yang menjelaskan hal sama bisa berselisih, dan yang paling sering
  -- terjadi adalah status 'dibayar' tanpa tanggal.
  paid_on        date,
  note           text check (note is null or length(note) <= 400),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Satu orang, satu baris gaji per bulan. Tanpa ini, gaji yang diketik dua
  -- kali karena ragu adalah cara paling mudah menggandakan beban.
  unique (team_member_id, period)
);

create index payroll_periode_idx on public.payroll (period desc, team_member_id);

create trigger payroll_touch_updated_at
  before update on public.payroll
  for each row execute function public.touch_updated_at();

alter table public.payroll enable row level security;

-- Gaji tidak pernah dilihat pengunjung maupun klien. Hanya staf.
create policy "staf kelola gaji"
  on public.payroll for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Bawaan Supabase memberi `all` kepada anon untuk tabel baru lewat default
-- privileges; migrasi 20260824000003 sudah membalik bawaannya, dan revoke di
-- bawah ini tetap ditulis supaya tabel ini tertutup walau bawaannya berubah.
revoke all on public.payroll from anon, authenticated;
grant select, insert, update, delete on public.payroll to authenticated;
grant all                            on public.payroll to service_role;
