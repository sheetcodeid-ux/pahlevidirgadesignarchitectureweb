-- Isi halaman publik yang selama ini di-hardcode di apps/web/src/lib/menunggu.ts.
--
-- Berkas itu sengaja dibuat sebagai SATU tempat untuk semua yang masih
-- ditunggu dari pemilik: nama staf kedua, foto tim, foto sebelum/sesudah,
-- empat isian halaman privasi, dan empat angka di FAQ. Cara mengisinya
-- adalah menyunting berkas TypeScript di repo — dan pemilik tidak pernah
-- menyentuh repo. Akibatnya bagian-bagian itu sudah berbulan menampilkan
-- penanda "menunggu" di situs yang tayang.
--
-- Alasannya sama persis dengan logo klien dan jurnal, yang sudah lebih dulu
-- dipindah: yang cocok dengan cara kerjanya adalah panel admin, bukan repo.
--
-- Yang TUNGGAL menempel ke studio_settings, bukan tabel sendiri. Tahun
-- berdiri hanya ada satu, alamat resmi hanya ada satu — tabel terpisah untuk
-- nilai yang barisnya tidak akan pernah lebih dari satu cuma menambah join
-- dan tempat baru untuk lupa. Yang BERULANG (anggota tim) baru dapat tabel.

-- ── Identitas studio ──────────────────────────────────────────────────────
alter table public.studio_settings
  -- Dipakai di eyebrow beranda ("SINCE ...") dan tonggak pertama garis waktu
  -- /studio. Batas atasnya longgar dan sengaja: yang dijaga cuma salah ketik
  -- yang tidak masuk akal, bukan menebak umur studio.
  add column founded_year          smallint check (founded_year between 1900 and 2200),
  add column first_commercial_year smallint check (first_commercial_year between 1900 and 2200),

  -- ── Pembanding sebelum/sesudah di /studio ──────────────────────────────
  -- Dua kunci R2 di folder studio/, pola yang sama dengan logo studio.
  -- Keduanya boleh kosong; halaman menampilkan slot berpola selama belum ada.
  add column before_key            text,
  add column after_key             text,

  -- ── Halaman privasi ────────────────────────────────────────────────────
  -- Empat keterangan yang TIDAK boleh dikarang. Halaman privasi yang salah
  -- lebih buruk daripada yang belum lengkap, karena ia berbunyi seperti janji
  -- hukum. Selama kosong, halamannya tetap tayang dan bagian yang belum ada
  -- ditandai apa adanya.
  add column legal_entity          text,
  add column legal_address         text,
  add column retention_messages    text,
  add column retention_documents   text,
  add column governing_law         text,

  -- ── Empat angka di FAQ ─────────────────────────────────────────────────
  -- Jawabannya sudah benar dan sudah tayang; yang belum ada cuma angkanya,
  -- dan halamannya menandainya dengan lencana "FIGURES ON REQUEST". Begitu
  -- salah satu terisi, lencananya padam sendiri untuk pertanyaan itu saja.
  --
  -- Disimpan sebagai teks, bukan angka: jawabannya bukan satu bilangan
  -- melainkan kalimat pendek ("8-12% dari biaya konstruksi", "30% di muka"),
  -- dan memaksanya jadi numeric berarti pemilik tidak bisa menuliskan yang
  -- sebenarnya berlaku.
  add column faq_tarif             text,
  add column faq_uang_muka         text,
  add column faq_lama_kerja        text,
  add column faq_kunjungan         text;

-- ── Tim studio ────────────────────────────────────────────────────────────
--
-- Berulang, jadi tabel. Dua baris hari ini (principal dan koordinator), tapi
-- studio yang tumbuh menambah orang tanpa menyentuh kode.
create table public.studio_team (
  id         uuid primary key default gen_random_uuid(),
  -- Nama boleh KOSONG dan itu disengaja: rancangan yang di-ACC menampilkan
  -- kartu orang beserta perannya walau namanya belum diberikan, dengan
  -- penanda "menunggu". Menghapus kartunya mengubah bentuk halaman setiap
  -- kali seorang staf datang atau pergi.
  name       text check (name is null or length(trim(name)) between 2 and 120),
  role       text not null check (length(trim(role)) between 2 and 120),
  bio        text check (bio is null or length(bio) <= 600),
  -- Potret 4:5 di R2, folder studio/. Kosong = kotak foto tampil sebagai slot.
  photo_key  text,
  -- Label yang tampil di slot foto yang masih kosong ("PRINCIPAL", "STAFF").
  slot_label text not null default 'STAFF' check (length(trim(slot_label)) between 2 and 24),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index studio_team_urutan_idx on public.studio_team (sort_order, created_at);

create trigger studio_team_touch_updated_at
  before update on public.studio_team
  for each row execute function public.touch_updated_at();

-- Ikut mencap content_revision: halaman /studio dibekukan saat build, jadi
-- menambah anggota tim TIDAK mengubah situs sampai ada build ulang — dan
-- tombol Terbitkan harus menyala untuk memberi tahu itu.
create trigger studio_team_cap_isi
  after insert or update or delete on public.studio_team
  for each statement execute function public.touch_content_revision();

alter table public.studio_team enable row level security;

-- Seluruh barisnya memang untuk publik: ia halaman "siapa kami".
create policy "publik baca tim studio"
  on public.studio_team for select
  to anon, authenticated
  using (true);

create policy "staf kelola tim studio"
  on public.studio_team for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke all on public.studio_team from anon, authenticated;
grant select                         on public.studio_team to anon;
grant select, insert, update, delete on public.studio_team to authenticated;
grant all                            on public.studio_team to service_role;

-- Dua baris yang sudah ada di menunggu.ts, dipindahkan apa adanya supaya
-- halaman /studio tidak berubah bentuk pada deploy ini. Nama yang kedua
-- memang belum ada — itu yang masih ditunggu dari pemilik.
insert into public.studio_team (name, role, bio, slot_label, sort_order) values
  ('Pahlevi Dirga', 'Principal architect',
   'Draws the building and answers the phone. Every project on this site passed through this desk.',
   'PRINCIPAL', 0),
  (null, 'Project coordinator',
   'Keeps the client page current — phases, documents, invoices — so that nobody has to ask for a status.',
   'STAFF', 1);
