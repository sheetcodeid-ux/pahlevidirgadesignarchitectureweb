/* Tipe untuk node:fs, SEBATAS yang dipakai tes.
 *
 * tsconfig.json menyetel `types` ke workers-types + vitest saja, dengan
 * sengaja: kode Worker tidak boleh menyentuh API Node, dan cara paling murah
 * menegakkannya adalah tidak memberi tipenya sama sekali. Menambahkan
 * @types/node akan membatalkan penjagaan itu untuk SELURUH src.
 *
 * Berkas ini menambahkan dua fungsi saja, untuk satu tes yang memang berjalan
 * di Node dan memang harus membaca berkas SQL dari disk. Penjagaan yang
 * sebenarnya tetap ada di tempat yang lebih keras: `wrangler deploy
 * --dry-run` menolak mem-bundle node:fs ke dalam Worker, jadi kalau kode src
 * suatu saat mengimpornya, yang merah adalah perintah itu.
 */
declare module "node:fs" {
  export function existsSync(path: string | URL): boolean;
  export function readFileSync(path: string | URL, encoding: "utf8"): string;
}
