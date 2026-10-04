-- Fase 1 dari alur kerja di Excel pemilik ("LIST PROJECT DESIGN — mulai 17 Mei
-- 2025"): fondasi data untuk empat hal yang sampai hari ini cuma hidup di
-- spreadsheet, dan yang di spreadsheet itu sudah saling bertentangan.
--
--   1. Jenis proyek "Coffee shop" — vertikal utama di dokumen strategi (§2.2),
--      yang selama ini tercampur di "Komersial" bersama salon dan kantor.
--   2. Tim per proyek BERDASARKAN PERAN (Leader, Drafter, Render, Estimator),
--      dengan bagian persen dari fee design. Di Excel persennya tertulis di
--      kepala kolom ("DRAFTER (10%)", "RENDER (5%)") dan nominalnya diketik
--      tangan di tiap sheet orang — Weng tercatat Rp12 jt di satu sheet dan
--      Rp8 jt di sheet lain.
--   3. Bayaran tim dua tahap: "dibayarkan 5% dulu, sisa tunggu design
--      selesai". Tahap awal jatuh saat DP klien masuk (jawaban pemilik).
--   4. Kas studio di luar proyek (penjualan PVC, bagi hasil, jajan) dan target
--      pemasukan per semester ("TARGET 1 MILIAR DALAM 6 BULAN").
--
-- SATU berkas karena keempatnya melayani satu alur dan tidak satu pun berguna
-- sendirian. Semuanya ADITIF — tidak ada kolom yang diubah atau dibuang —
-- jadi Worker API yang sedang tayang tidak terganggu saat migrasi ini
-- diterapkan lebih dulu (aturan urutan di CLAUDE.md).

-- ── 1. Coffee shop ─────────────────────────────────────────────────────────
--
-- Nilai enum baru, bukan kolom "jenis" bebas: kategori yang sama dipakai
-- rel /proyek di situs publik, form kontak, dan laporan laba per segmen yang
-- diminta §7 kuartal 4. Teks bebas di tiga tempat itu akan berakhir sebagai
-- "Coffeeshop", "coffee shop", dan "Kafe" untuk hal yang sama.
--
-- `add value` di dalam transaksi diizinkan sejak Postgres 12, asal nilai
-- barunya tidak DIPAKAI di transaksi yang sama — dan berkas ini memang tidak
-- memakainya.
alter type public.project_category add value if not exists 'coffeeshop' after 'commercial';

-- ── 2. Aturan persen studio ───────────────────────────────────────────────
--
-- Tabel sendiri, BUKAN kolom di studio_settings: studio_settings dibaca anon
-- (nama studio, kontak, logo tampil di situs), sedangkan persen bayaran tim
-- adalah urusan dalam yang tidak boleh ikut terbaca siapa pun di luar staf.
--
-- Leader dan Estimator sengaja KOSONG: di Excel kedua kolom itu kosong, dan
-- pemilik menjawab "belum ditentukan, buat bisa disetting nanti". Kosong
-- berarti "belum ditentukan" — bukan nol. Nol berarti orangnya memang tidak
-- dibayar dari proyek, dan dua keadaan itu harus bisa dibedakan.
create table public.studio_fee_settings (
  id                 boolean primary key default true,
  pct_leader         numeric(5, 2) check (pct_leader    is null or pct_leader    between 0 and 100),
  pct_drafter        numeric(5, 2) default 10 check (pct_drafter   is null or pct_drafter   between 0 and 100),
  pct_render         numeric(5, 2) default 5  check (pct_render    is null or pct_render    between 0 and 100),
  pct_estimator      numeric(5, 2) check (pct_estimator is null or pct_estimator between 0 and 100),
  -- "FEE BONUS 10%" di sheet Adji. Pemilik: "1 proyek" — jatah bonus tim
  -- untuk satu proyek, sebagai persen fee design. Disimpan sebagai acuan
  -- pembanding, TIDAK dipakai membatasi: di Excel bagian Drafter 10% dan
  -- Render 5% sudah 15%, melewati jatah 10% itu, dan memutuskan mana yang
  -- benar adalah urusan pemilik, bukan constraint database.
  pool_pct           numeric(5, 2) not null default 10 check (pool_pct between 0 and 100),
  -- Bagian dari hak tiap orang yang dibayar saat DP klien masuk. "Dibayarkan
  -- 5% dulu" pada Drafter 10% = separuh haknya, jadi bawaannya 50.
  first_tranche_pct  numeric(5, 2) not null default 50 check (first_tranche_pct between 0 and 100),
  updated_at         timestamptz not null default now(),
  constraint studio_fee_settings_singleton check (id)
);

insert into public.studio_fee_settings (id) values (true);

create trigger studio_fee_settings_touch_updated_at
  before update on public.studio_fee_settings
  for each row execute function public.touch_updated_at();

alter table public.studio_fee_settings enable row level security;

create policy "staf baca aturan fee"
  on public.studio_fee_settings for select
  to authenticated
  using (public.is_staff());

create policy "staf ubah aturan fee"
  on public.studio_fee_settings for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Satu baris, selamanya: tidak ada insert maupun delete untuk siapa pun
-- selain pemilik database.
revoke all on public.studio_fee_settings from anon, authenticated;
grant select, update on public.studio_fee_settings to authenticated;
grant all            on public.studio_fee_settings to service_role;

-- ── 3. Tim per proyek ─────────────────────────────────────────────────────

create type public.team_role as enum ('leader', 'drafter', 'render', 'estimator');

create table public.project_team (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects (id) on delete cascade,
  -- restrict: anggota tim yang sudah tidak dipakai dinonaktifkan
  -- (team_members.active), bukan dihapus. Menghapusnya akan memutus
  -- riwayat siapa mengerjakan apa.
  team_member_id uuid not null references public.team_members (id) on delete restrict,
  role           public.team_role not null,
  -- Bagian dari fee design, dalam persen.
  --
  -- KOSONG = ikut aturan studio saat ini (studio_fee_settings). Itu yang
  -- membuat Leader dan Estimator — yang persennya belum ditentukan — langsung
  -- terhitung begitu pemilik mengisinya nanti, tanpa menyunting satu per satu
  -- proyek yang sudah ada.
  --
  -- TERISI = persen tetap untuk proyek ini. API mengisinya saat peran yang
  -- persennya sudah ditentukan (Drafter, Render) ditambahkan, supaya
  -- menaikkan persen bawaan bulan depan tidak diam-diam mengubah hak orang
  -- di proyek yang sudah berjalan.
  --
  -- Satu peran boleh dipegang dua orang ("Adji&dany" di Rumah Ade): dua
  -- baris, masing-masing dengan persennya sendiri.
  pct            numeric(5, 2) check (pct is null or pct between 0 and 100),
  note           text check (note is null or length(note) <= 200),
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (project_id, role, team_member_id)
);

create index project_team_orang_idx on public.project_team (team_member_id);

create trigger project_team_touch_updated_at
  before update on public.project_team
  for each row execute function public.touch_updated_at();

alter table public.project_team enable row level security;

create policy "staf kelola tim proyek"
  on public.project_team for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke all on public.project_team from anon, authenticated;
grant select, insert, update, delete on public.project_team to authenticated;
grant all                            on public.project_team to service_role;

-- ── 4. Bayaran tim tercatat sebagai BIAYA PROYEK, bertahap ────────────────
--
-- Tidak ada tabel bayaran terpisah, dan itu disengaja: aturan "Fee menulis,
-- Gaji membaca" (CLAUDE.md) menetapkan bahwa satu bayaran hanya boleh ada di
-- satu tempat, dan tempat itu project_costs — yang sudah dihitung laba per
-- proyek, halaman Fee, dan halaman Gaji. Yang ditambahkan cuma TAUTANNYA:
-- biaya ini adalah tahap ke berapa dari penugasan yang mana.
--
-- Yang bisa dihitung dari situ tanpa satu pun angka kedua:
--   hak      = fee design × persen penugasan
--   dibayar  = jumlah biaya yang tertaut ke penugasan itu
--   terutang = hak − dibayar
create type public.payout_stage as enum ('awal', 'akhir');

alter table public.project_costs
  -- NO ACTION (bawaan), bukan set null maupun cascade:
  --   * penugasan yang sudah dibayar TIDAK BISA dihapus sendirian — uangnya
  --     sudah keluar, dan biaya tanpa penugasan akan kehilangan tahapnya;
  --   * menghapus PROYEK tetap bisa, karena penugasan dan biayanya sama-sama
  --     ikut terhapus oleh cascade dalam statement yang sama, dan NO ACTION
  --     baru diperiksa di ujung statement.
  add column project_team_id uuid references public.project_team (id),
  add column payout_stage    public.payout_stage,
  -- Tahap tanpa penugasan tidak bermakna, dan penugasan tanpa tahap tidak
  -- bisa dibedakan dari bayaran tahap lain.
  add constraint project_costs_tahap_berpasangan
    check ((project_team_id is null) = (payout_stage is null));

-- Satu tahap dibayar SEKALI. Tanpa penjaga ini, tombol "bayar tahap awal"
-- yang ditekan dua kali karena koneksinya lambat menggandakan bayaran
-- seseorang — dan menggandakan beban di laba proyeknya.
create unique index project_costs_tahap_unik
  on public.project_costs (project_team_id, payout_stage)
  where project_team_id is not null;

-- ── 5. Kas studio di luar proyek ──────────────────────────────────────────
--
-- Sheet "KELUAR MASUK" memuat uang yang tidak lahir dari satu proyek desain:
-- cashbon bagi hasil Nordu Garden dengan Reza, penjualan PVC ke Ko Fendy dan
-- Paris, "Jajan Nisa". project_costs tidak bisa menampungnya — project_id-nya
-- wajib — dan tidak ada tabel pemasukan lain selain pembayaran klien.
--
-- Tabel sendiri, BUKAN melonggarkan project_costs.project_id: laba per proyek,
-- halaman Fee, dan rincian biaya proyek semuanya berasumsi tiap biaya punya
-- proyek. Melonggarkannya berarti memeriksa ulang setiap query yang membaca
-- tabel itu, dan yang terlewat akan diam-diam membuang baris tanpa proyek.
--
-- GAJI TIDAK DICATAT DI SINI. Gaji punya tabelnya sendiri (payroll) dan
-- bayaran tim punya project_costs; mencatatnya juga di sini menggandakan
-- beban — kesalahan yang tidak terlihat sampai tutup buku.
create type public.ledger_direction as enum ('masuk', 'keluar');
create type public.ledger_category as enum (
  'penjualan_material', 'bagi_hasil', 'pembelian_material', 'operasional', 'konsumsi', 'lainnya'
);

create table public.studio_ledger (
  id           uuid primary key default gen_random_uuid(),
  direction    public.ledger_direction not null,
  category     public.ledger_category  not null default 'lainnya',
  label        text not null check (length(trim(label)) between 2 and 160),
  -- Kolom "DARI/UNTUK" di Excel. Teks, bukan tautan ke direktori: pembeli PVC
  -- jarang jadi kontak tetap, dan memaksanya masuk direktori dulu hanya
  -- membuat baris kas tidak pernah diisi.
  counterparty text check (counterparty is null or length(trim(counterparty)) between 1 and 120),
  amount       numeric(14, 2) not null check (amount > 0),
  -- Tanggal kejadiannya, bukan tanggal diketik. Di Excel tahunnya sempat
  -- melompat dari 2025 ke 2024 karena diketik tangan; kolom date setidaknya
  -- membuat tanggal yang mustahil tidak bisa disimpan.
  occurred_on  date not null default current_date,
  -- Opsional: penjualan material untuk proyek tertentu. set null — menghapus
  -- proyek tidak boleh menghapus uang yang benar-benar sudah masuk ke studio.
  project_id   uuid references public.projects (id) on delete set null,
  note         text check (note is null or length(note) <= 400),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Kategori harus searah dengan arusnya. "Penjualan material" sebagai uang
  -- KELUAR adalah salah ketik yang membalik tanda labanya.
  constraint studio_ledger_kategori_searah check (
    (direction = 'masuk'  and category in ('penjualan_material', 'bagi_hasil', 'lainnya')) or
    (direction = 'keluar' and category in ('pembelian_material', 'operasional', 'konsumsi', 'lainnya'))
  )
);

create index studio_ledger_tanggal_idx on public.studio_ledger (occurred_on desc, created_at desc);

create trigger studio_ledger_touch_updated_at
  before update on public.studio_ledger
  for each row execute function public.touch_updated_at();

alter table public.studio_ledger enable row level security;

create policy "staf kelola kas studio"
  on public.studio_ledger for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke all on public.studio_ledger from anon, authenticated;
grant select, insert, update, delete on public.studio_ledger to authenticated;
grant all                            on public.studio_ledger to service_role;

-- ── 6. Target pemasukan per semester ──────────────────────────────────────
--
-- Pemilik: "6 bulan itu per semester, target 1 M itu pemasukan" — dan
-- penjualan PVC ikut dihitung. Jadi yang dibandingkan dengan target adalah
-- seluruh uang yang MASUK (pembayaran klien + kas studio arah masuk), bukan
-- laba seperti rumus "KURANG = TARGET − PROFIT" di Excel.
--
-- Satu baris per semester, dikunci di tanggal 1 Januari atau 1 Juli. Semester
-- tanpa baris memakai target semester terakhir sebelumnya (dihitung API),
-- jadi target 1 M tidak perlu diketik ulang tiap enam bulan.
create table public.revenue_targets (
  semester_start date primary key
    check (extract(day from semester_start) = 1 and extract(month from semester_start) in (1, 7)),
  amount         numeric(16, 2) not null check (amount > 0),
  note           text check (note is null or length(note) <= 200),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger revenue_targets_touch_updated_at
  before update on public.revenue_targets
  for each row execute function public.touch_updated_at();

alter table public.revenue_targets enable row level security;

create policy "staf kelola target"
  on public.revenue_targets for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke all on public.revenue_targets from anon, authenticated;
grant select, insert, update, delete on public.revenue_targets to authenticated;
grant all                            on public.revenue_targets to service_role;

-- Target yang disebut pemilik, untuk semester yang sedang berjalan saat
-- migrasi ini ditulis (Juli–Desember 2026).
insert into public.revenue_targets (semester_start, amount, note)
values ('2026-07-01', 1000000000, 'Target 1 miliar per semester');
