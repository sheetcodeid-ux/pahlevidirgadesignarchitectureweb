const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Menanyakan ke Cloudflare apakah token dari widget Turnstile valid.
 *
 * Kalau secret belum diisi (mis. saat development), verifikasi dilewati.
 */
export async function verifyTurnstile(secret: string | undefined, token: string, remoteIP: string): Promise<void> {
  if (!secret) return;
  if (!token.trim()) throw new Error("token turnstile kosong");

  const form = new URLSearchParams({ secret, response: token });
  if (remoteIP) form.set("remoteip", remoteIP);

  const res = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const result = (await res.json()) as { success: boolean; "error-codes"?: string[] };
  if (!result.success) {
    throw new Error(`turnstile menolak: ${(result["error-codes"] ?? []).join(", ")}`);
  }
}
