-- Menutup EXECUTE yang diberikan Postgres kepada PUBLIC.
--
-- Jebakan yang persis sama sudah tercatat di CLAUDE.md dan pernah menggigit
-- sekali di is_staff(): Postgres memberi `execute` pada fungsi baru kepada
-- **PUBLIC**, bukan kepada `anon`. Mencabut dari `anon` tidak menutup apa
-- pun. Migrasi 20260824000004 memperbaiki is_staff() tapi tidak menyentuh
-- fungsi lain, dan sisanya lolos.
--
-- is_staff() sengaja TIDAK disentuh di sini. Haknya sudah benar (postgres +
-- authenticated saja), dan `authenticated` memang harus bisa memanggilnya:
-- kebijakan RLS-lah yang memanggil fungsi itu.

-- 1. touch_updated_at() — milik kita sendiri --------------------------------
--
-- Fungsi trigger; mengembalikan tipe `trigger`, jadi PostgREST tidak bisa
-- memanggilnya sebagai RPC sama sekali. Tetap dicabut: permukaan yang tidak
-- dipakai siapa pun tidak punya alasan untuk tetap terbuka.
revoke execute on function public.touch_updated_at() from public;
revoke execute on function public.touch_updated_at() from anon, authenticated;

-- 2. rls_auto_enable() — milik platform Supabase ----------------------------
--
-- Bukan buatan kita: Supabase yang membuatnya di proyek terkelola, jadi ia
-- TIDAK ada di database Postgres polos tempat migrasi ini diuji. Karena itu
-- dibungkus pemeriksaan keberadaan — tanpa itu seluruh migrasi gagal di
-- mesin lokal dan bootstrap.sql ikut rusak.
--
-- Yang ditandai advisor: fungsinya SECURITY DEFINER dan terbuka untuk anon
-- lewat /rest/v1/rpc/. Dampak sebenarnya kecil — ia mengembalikan tipe
-- event_trigger dan menolak dijalankan di luar konteks event trigger — tapi
-- aturannya sudah jelas dan ini satu baris.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public';
    execute 'revoke execute on function public.rls_auto_enable() from anon, authenticated';
  end if;
end $$;
