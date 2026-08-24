-- Menutup dua celah yang ditemukan database linter Supabase setelah skema
-- terpasang di project sungguhan.
--
-- 1. is_staff() masih bisa dipanggil anon lewat /rest/v1/rpc/is_staff.
--
--    Migrasi 20260818000002 sudah menulis:
--      revoke execute on function public.is_staff() from anon, authenticated;
--    tapi itu tidak cukup. Postgres memberi EXECUTE kepada PUBLIC untuk setiap
--    fungsi baru, dan mencabut dari role bernama tidak menyentuh pemberian ke
--    PUBLIC. Jadi anon tetap boleh memanggilnya — lewat PUBLIC, bukan lewat
--    anon.
--
--    Ini bentuk yang sama persis dengan invarian keamanan #1 di CLAUDE.md,
--    hanya pindah dari tabel ke fungsi: mencabut dari role yang salah sambil
--    mengira pintunya sudah tertutup.
--
--    Dampaknya kecil — untuk anon, auth.uid() null sehingga fungsinya
--    mengembalikan false. Tapi ini fungsi security definer yang membaca
--    profiles, dan ia terbuka tanpa login. Ditutup.
--
--    Aman: seluruh policy yang memanggil is_staff() adalah `to authenticated`,
--    dan authenticated tetap punya EXECUTE eksplisit di bawah. anon tidak
--    pernah mengevaluasi policy itu.
--
-- 2. touch_updated_at() tidak mengunci search_path.
--
--    Fungsi trigger tanpa search_path tetap bisa dibelokkan kalau ada objek
--    bernama sama di schema lain yang lebih dulu ditemukan. Risikonya rendah
--    karena fungsinya security invoker dan hanya memanggil now(), tapi
--    menguncinya gratis.

revoke execute on function public.is_staff() from public;
grant  execute on function public.is_staff() to authenticated;

alter function public.touch_updated_at() set search_path = pg_catalog;
