import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";

/**
 * Rate limit per-IP lewat KV, bukan in-memory.
 *
 * Ini pengganti limiter Go yang per-instance (jadi longgar karena tiap
 * instance Cloud Run punya hitungannya sendiri). KV tersebar di seluruh
 * edge Cloudflare, jadi hitungannya bersama — lebih ketat, bukan lebih
 * longgar, walau ada trade-off: baca-lalu-tulis di sini tidak atomik dan
 * KV punya latensi propagasi hingga ~60 detik antar lokasi. Diterima
 * dengan alasan yang sama seperti limiter Go sebelumnya: Turnstile adalah
 * penjaga sesungguhnya, ini hanya lapisan kedua.
 */
export function rateLimit(prefix: string, max: number, windowSeconds: number): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
    const key = `${prefix}:${ip}`;

    const raw = await c.env.RATE_LIMIT.get(key);
    const count = raw ? Number.parseInt(raw, 10) : 0;

    if (count >= max) {
      return c.json(
        { error: { status: 429, message: "terlalu banyak percobaan, coba lagi nanti" } },
        429,
      );
    }

    await c.env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: windowSeconds });
    await next();
  };
}
