-- Nomor WhatsApp klien per proyek, dan catatan pembayaran yang benar-benar
-- diterima (DP / pelunasan) berikut nomor bukti yang bisa dibuka publik.
--
-- Kenapa TABEL BARU dan bukan kolom tambahan di invoices: invoice adalah
-- TAGIHAN (janji), pembayaran adalah UANG YANG MASUK. Satu tagihan bisa
-- dilunasi dua kali (DP lalu sisanya), dan pemilik sudah memutuskan sejak
-- awal bahwa laba dihitung dari kas yang benar-benar diterima. Menumpuk
-- metode/penerima/tanggal-bayar ke invoices akan memaksa satu baris mewakili
-- dua peristiwa yang berbeda.

alter table public.projects
  add column client_whatsapp text
    check (client_whatsapp is null or client_whatsapp ~ '^[0-9]{8,15}$');

comment on column public.projects.client_whatsapp is
  'Nomor WhatsApp klien, format internasional tanpa + dan tanpa spasi '
  '(mis. 628123456789). Dipakai tombol WA di bukti pembayaran.';

create type public.payment_method as enum ('tunai', 'transfer', 'qris', 'lainnya');

-- 'termin' ada supaya pembayaran ketiga dan seterusnya tidak dipaksa masuk
-- salah satu dari dua kategori yang maknanya sudah terpakai.
create type public.payment_kind as enum ('dp', 'termin', 'pelunasan');

create table public.project_payments (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete set null,
  amount     numeric(14, 2) not null check (amount > 0),
  kind       public.payment_kind   not null default 'dp',
  method     public.payment_method not null default 'tunai',
  receiver   text check (receiver is null or length(trim(receiver)) between 2 and 120),
  note       text,
  paid_at    timestamptz not null default now(),

  -- Token acak 16-byte (32 karakter hex) untuk URL bukti publik
  -- /bukti?t=<token>. Sengaja BUKAN id barisnya: id itu tebakan yang sah
  -- dari mana saja di API admin, sementara token ini satu-satunya kunci
  -- yang boleh beredar lewat WhatsApp.
  receipt_token text not null unique default encode(gen_random_bytes(16), 'hex'),

  created_at timestamptz not null default now()
);

create index project_payments_project_idx on public.project_payments (project_id, paid_at desc);

alter table public.project_payments enable row level security;

-- Tidak ada policy anon. Bukti pembayaran dibaca lewat Worker API dengan
-- service_role, yang mencocokkan token di klausa WHERE — pola yang sama
-- dengan portal klien /progres, dan alasannya sama: token itu tidak boleh
-- ikut terbaca lewat select biasa atas tabel ini.
create policy "staf kelola pembayaran"
  on public.project_payments for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- GRANT eksplisit. Default privileges sudah dibalik di 20260824000003, jadi
-- tabel baru tertutup sampai baris ini ditulis — RLS saja tidak memberi akses.
revoke all on public.project_payments from anon, authenticated;
grant select, insert, update, delete on public.project_payments to authenticated;
grant all on public.project_payments to service_role;
