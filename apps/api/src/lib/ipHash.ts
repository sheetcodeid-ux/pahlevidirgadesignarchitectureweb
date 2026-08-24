/**
 * Sidik jari IP untuk deteksi abuse tanpa menyimpan alamat aslinya.
 *
 * HMAC dengan salt rahasia, bukan SHA-256 polos: ruang alamat IPv4 cuma 4
 * miliar kemungkinan, jadi hash tanpa salt bisa dibalik lewat brute force
 * dalam hitungan menit. Tanpa IP_HASH_SALT terisi, kolomnya dikosongkan
 * daripada menyimpan sesuatu yang menyesatkan seolah-olah anonim.
 */
export async function hashIP(ip: string, salt: string | undefined): Promise<string> {
  if (!ip || !salt) return "";

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(salt),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
