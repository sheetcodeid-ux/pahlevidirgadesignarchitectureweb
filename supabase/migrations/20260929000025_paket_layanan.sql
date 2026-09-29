-- Paket layanan (tier) — enam paket di seksi tarif beranda.
--
-- Sebelumnya ditulis di apps/web/src/lib/tier.ts, jadi setiap kenaikan harga
-- — dokumen strategi menetapkan aturannya: tiap 3 proyek selesai pada satu
-- tier, naik 10–15% untuk klien baru — berarti mengubah kode. Pemilik
-- memilih memindahkannya ke tempat yang bisa dia urus sendiri dari panel,
-- pola yang sama dengan logo klien dan jurnal.
--
-- Kelompoknya (coffee shop / rumah tinggal) TETAP di kode: dua kelompok itu
-- adalah positioning studio, bukan daftar yang berubah tiap kuartal, dan
-- menambah kelompok ketiga berarti menambah tab dan kalimat pengantarnya di
-- beranda — pekerjaan desain, bukan isian formulir.

create table public.service_tiers (
  id               uuid primary key default gen_random_uuid(),
  group_key        text not null check (group_key in ('kafe', 'rumah')),
  -- Dipakai sebagai id tab/kartu di beranda. Huruf kecil dan tanda hubung
  -- saja, supaya aman di atribut HTML dan di URL panel.
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 40),
  name             text not null check (length(trim(name)) between 1 and 60),
  summary          text not null default '' check (length(summary) <= 240),
  -- Rentang fee dalam JUTA rupiah, bilangan bulat. Dua angka, bukan satu
  -- string "15–25": panel perlu mengurutkan dan memeriksa bahwa batas atasnya
  -- tidak lebih kecil dari batas bawah, dan beranda mencetaknya sendiri.
  fee_min          integer not null check (fee_min >= 0),
  fee_max          integer not null,
  for_whom         text not null default '' check (length(for_whom) <= 160),
  includes_heading text not null default 'Yang Anda dapat' check (length(includes_heading) <= 80),
  -- Isi paket, SATU BUTIR PER BARIS. Teks, bukan text[] atau jsonb: Worker
  -- menyambung dengan `fetch_types: false` (wajib untuk Hyperdrive), dan
  -- postgres.js dalam setelan itu tidak bisa mengirim array sebagai parameter
  -- — jebakan #16 di CLAUDE.md, yang sudah dua kali memerahkan deploy.
  includes         text not null default '' check (length(includes) <= 2000),
  -- Satu per kelompok yang diberi bingkai dan lencana di beranda. Tidak
  -- dijaga unik di sini: saat memindah sorotan dari satu paket ke paket lain,
  -- ada saat keduanya menyala, dan beranda cukup memakai yang pertama.
  is_highlighted   boolean not null default false,
  -- Paket yang dihentikan disembunyikan, bukan dihapus: harga lama masih
  -- berguna saat klien lama bertanya "dulu saya bayar berapa".
  is_active        boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (fee_max >= fee_min)
);

create index service_tiers_urutan_idx on public.service_tiers (group_key, sort_order, created_at);

create trigger service_tiers_touch_updated_at
  before update on public.service_tiers
  for each row execute function public.touch_updated_at();

-- Beranda membaca tabel ini saat build, jadi mengubahnya harus menyalakan
-- tombol Terbitkan — sama seperti enam tabel di 20260910000020.
create trigger service_tiers_cap_isi
  after insert or update or delete on public.service_tiers
  for each statement execute function public.touch_content_revision();

alter table public.service_tiers enable row level security;

-- Publik hanya melihat paket yang AKTIF. Paket yang dihentikan tetap di
-- tabel untuk arsip panel, dan tidak boleh bocor ke siapa pun di luar staf.
create policy "publik baca paket aktif"
  on public.service_tiers for select
  to anon, authenticated
  using (is_active);

create policy "staf kelola paket"
  on public.service_tiers for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke all on public.service_tiers from anon, authenticated;
grant select                         on public.service_tiers to anon;
grant select, insert, update, delete on public.service_tiers to authenticated;
grant all                            on public.service_tiers to service_role;

-- Isi awal: enam paket yang sampai hari ini tayang di beranda, apa adanya
-- dari lib/tier.ts — supaya beranda tidak berubah sedikit pun saat sumbernya
-- pindah.
insert into public.service_tiers
  (group_key, slug, name, summary, fee_min, fee_max, for_whom, includes_heading, includes, is_highlighted, sort_order)
values
  ('kafe', 'starter', 'Starter',
   'Untuk coffee shop pertama, dengan anggaran yang apa adanya.',
   15, 25, 'Coffee shop pertama, budget terbatas', 'Yang Anda dapat',
   E'Konsep desain\nDenah dan tata ruang\nVisualisasi 3D dasar', false, 1),
  ('kafe', 'signature', 'Signature',
   'Untuk pemilik yang sudah punya gambaran jelas soal ruang yang ingin dikenang.',
   45, 80, 'Visi kuat, target ikonik', 'Semua di Starter, ditambah',
   E'Gambar kerja lengkap (DED)\nBranding ruang dan palet material\nPengarahan dan pendampingan kontraktor\nPerencanaan alur bar dan dapur', true, 2),
  ('kafe', 'flagship', 'Flagship',
   'Layanan penuh, dari sketsa pertama sampai foto pembukaan.',
   100, 180, 'Grup F&B yang siap membuka cabang', 'Semua di Signature, ditambah',
   E'Supervisi konstruksi\nDesain furnitur custom\nDokumentasi foto profesional', false, 3),
  ('rumah', 'konsultasi', 'Konsultasi',
   'Untuk pemilik yang akan membangun sendiri bersama tukangnya.',
   10, 20, 'Membangun sendiri, dengan tukang', 'Yang Anda dapat',
   E'Konsep desain\nDenah skematik\nSaran orientasi dan ventilasi', false, 1),
  ('rumah', 'standar', 'Standar',
   'Dari konsep sampai gambar yang bisa dibangun kontraktor tanpa menelepon kami.',
   35, 70, '100–200 m², budget bangun Rp 500 juta–1,5 miliar', 'Semua di Konsultasi, ditambah',
   E'Gambar kerja lengkap (DED)\nGambar kerja siap kontraktor\nDaftar material dan finishing', true, 2),
  ('rumah', 'premium', 'Premium',
   'Rumahnya, isinya, dan tanah tempat ia berdiri — diurus sebagai satu proyek.',
   80, 200, 'Di atas 200 m², budget bangun di atas Rp 2 miliar', 'Semua di Standar, ditambah',
   E'Supervisi konstruksi\nDesain interior\nDesain lanskap\nDokumentasi foto saat serah terima', false, 3);
