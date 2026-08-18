-- Data contoh untuk development lokal (supabase db reset).
-- Jangan dijalankan di project production.

insert into public.projects
  (slug, title, subtitle, summary, description, category, status,
   location, city, year, client, area_sqm, lead_architect,
   cover_image_key, is_featured, sort_order, published_at)
values
  ('rumah-tepi-sawah',
   'Rumah Tepi Sawah',
   'Hunian dua lantai dengan koridor angin melintang',
   'Rumah keluarga yang membuka diri ke hamparan sawah, dengan selubung bata berpori yang menyaring cahaya sore.',
   'Tapak memanjang utara-selatan memungkinkan seluruh ruang utama menghadap sawah tanpa terpapar matahari barat secara langsung. Selubung bata berpori menurunkan suhu ruang tanpa pendingin mekanis pada sebagian besar hari.',
   'residential', 'published',
   'Canggu', 'Badung', 2024, 'Keluarga Wirawan', 320.00, 'Pahlevi Dirga',
   'projects/rumah-tepi-sawah/cover.jpg', true, 1, now()),

  ('kantor-kayu-bandung',
   'Kantor Kayu Bandung',
   'Ruang kerja untuk 40 orang di bangunan kolonial yang direstorasi',
   'Adaptasi bangunan lama menjadi kantor terbuka dengan struktur kayu sisipan yang bisa dibongkar tanpa merusak bangunan aslinya.',
   'Seluruh elemen baru dirancang sebagai sisipan yang berdiri sendiri, sehingga bangunan cagar budaya ini dapat dikembalikan ke kondisi semula bila diperlukan.',
   'commercial', 'published',
   'Jalan Braga', 'Bandung', 2023, 'PT Rekan Cipta', 780.00, 'Pahlevi Dirga',
   'projects/kantor-kayu-bandung/cover.jpg', true, 2, now()),

  ('renovasi-rumah-menteng',
   'Renovasi Rumah Menteng',
   'Pembaruan hunian 1960-an tanpa mengubah fasad',
   'Penataan ulang denah bagian dalam untuk keluarga muda, dengan tetap mempertahankan proporsi dan detail fasad aslinya.',
   null,
   'renovation', 'draft',
   'Menteng', 'Jakarta Pusat', 2025, null, 240.00, 'Pahlevi Dirga',
   null, false, 3, null);

insert into public.project_images (project_id, storage_key, alt_text, caption, width, height, sort_order)
select id, 'projects/rumah-tepi-sawah/01.jpg',
       'Teras rumah menghadap sawah pada sore hari',
       'Teras timur, pukul 16.00', 2400, 1600, 1
from public.projects where slug = 'rumah-tepi-sawah';
