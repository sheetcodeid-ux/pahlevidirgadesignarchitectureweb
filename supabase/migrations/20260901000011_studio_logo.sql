-- Logo studio, diunggah lewat panel Info Studio dan disimpan di R2 (bukan
-- Supabase Storage, konsisten dengan seluruh gambar lain di aplikasi ini).
-- Kolom baru di tabel yang sudah ada — GRANT tabel di migrasi
-- 20260826000005 (select untuk anon, select+update untuk authenticated)
-- otomatis mencakupnya, tidak perlu GRANT baru.

alter table public.studio_settings
  add column logo_key text;
