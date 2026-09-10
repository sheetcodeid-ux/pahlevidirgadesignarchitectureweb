/**
 * Satu stempel waktu untuk SELURUH build.
 *
 * Dipakai dua tempat yang harus sepakat: AdminLayout memanggangnya ke HTML
 * panel, dan endpoint /cap-build.json menyajikannya sebagai berkas statis.
 * Panel membandingkan keduanya untuk tahu apakah situs sudah dibangun ulang
 * sejak halaman ini dimuat — satu-satunya cara ia bisa tahu, karena panel
 * admin adalah hasil build yang sama dengan situs publiknya.
 *
 * HARUS satu modul bersama, bukan `new Date()` di dua berkas: dua panggilan
 * terpisah dalam satu build berbeda beberapa milidetik, dan beda sekecil apa
 * pun akan terbaca sebagai "sudah ada build baru" pada muat pertama.
 */
export const CAP_BUILD = new Date().toISOString();
