-- Fase 4 alur Excel pemilik (H7): proyek tertaut ke PAKET LAYANAN.
--
-- Dokumen strategi §3.3: "tiap 3 proyek selesai pada satu tier, harga naik
-- 10–15% untuk klien baru". Tanpa tautan ini panel tidak pernah bisa
-- menghitung berapa proyek Starter yang sudah selesai, dan KPI "proyek tier
-- Signature ke atas" (§8) tidak punya sumber.
--
-- Boleh kosong: proyek lama tidak punya paket, dan tidak setiap pekerjaan
-- dijual sebagai paket (renovasi kecil, konsultasi lepas).
-- `on delete set null`, bukan cascade: menghapus paket yang sudah dihentikan
-- tidak boleh menghapus proyeknya. (Paket yang dihentikan memang
-- disembunyikan, bukan dihapus — ini cuma jaring pengaman.)
--
-- ADITIF: Worker API yang sedang tayang tidak menyebut kolom ini. GRANT
-- berlaku per tabel, jadi hak atas kolom ikut public.projects; API publik
-- memilih kolomnya satu per satu dan tidak menyebut tier_id.

alter table public.projects
  add column tier_id uuid references public.service_tiers (id) on delete set null;

create index projects_tier_id_idx on public.projects (tier_id) where tier_id is not null;

-- Kapan HARGA paket terakhir diubah. `updated_at` tidak bisa dipakai: ia ikut
-- bergeser saat ringkasan atau isi paket disunting, padahal yang dihitung
-- §3.3 adalah proyek yang dijual dengan harga SEKARANG. Panel menghitung
-- proyek berpaket ini yang dibuat sesudah stempel ini dan sudah selesai;
-- begitu tiga, ia mengingatkan untuk menaikkan harga.
alter table public.service_tiers
  add column price_changed_at timestamptz not null default now();

create function public.service_tiers_harga_berubah()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.fee_min is distinct from old.fee_min or new.fee_max is distinct from old.fee_max then
    new.price_changed_at := now();
  end if;
  return new;
end;
$$;

-- Fungsi trigger tidak untuk dipanggil siapa pun; Postgres memberi EXECUTE ke
-- PUBLIC secara bawaan (invarian keamanan #1), jadi dicabut dari sana.
revoke execute on function public.service_tiers_harga_berubah() from public;
revoke execute on function public.service_tiers_harga_berubah() from anon, authenticated;

create trigger service_tiers_harga_berubah
  before update on public.service_tiers
  for each row execute function public.service_tiers_harga_berubah();
