import { AwsClient } from "aws4fetch";

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "application/pdf": ".pdf",
  /* Voice note dari staf ke klien. Empat tipe karena tiap platform merekam
     dengan wadah berbeda: Safari/iOS mengirim audio/mp4, Chrome dan Firefox
     audio/webm, perekam bawaan Android sering audio/ogg, dan berkas yang
     diambil dari galeri biasanya audio/mpeg. Menerima satu saja berarti
     menolak sebagian pengguna tanpa alasan yang bisa mereka pahami. */
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
};

export interface UploadTarget {
  key: string;
  uploadUrl: string;
  expiresAt: string;
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

/**
 * Membuat URL PUT presigned berumur pendek untuk satu file, lewat tanda
 * tangan S3-compatible (aws4fetch) — R2 tidak beda dari S3 di sisi protokol
 * ini, jadi presigned URL yang sama dipakai browser untuk upload langsung.
 *
 * Key dibentuk di server dari folder (sudah disanitasi pemanggil) + suffix
 * acak, bukan dari nama file kiriman klien, supaya tidak ada path traversal
 * dan tidak ada file yang saling menimpa saat dua orang meng-upload
 * "render-1.jpg".
 */
export async function presignUpload(
  cfg: R2Config,
  folder: string,
  contentType: string,
): Promise<UploadTarget> {
  const ext = ALLOWED_CONTENT_TYPES[contentType];
  if (!ext) throw new Error(`tipe file "${contentType}" tidak diizinkan`);

  const suffix = [...crypto.getRandomValues(new Uint8Array(8))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const key = `${folder}/${suffix}${ext}`;

  const client = new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    region: "auto",
    service: "s3",
  });

  const expirySeconds = 15 * 60;
  const url = new URL(`https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}/${key}`);
  url.searchParams.set("X-Amz-Expires", String(expirySeconds));

  const signed = await client.sign(new Request(url, { method: "PUT" }), {
    aws: { signQuery: true },
    headers: { "content-type": contentType },
  });

  return {
    key,
    uploadUrl: signed.url,
    expiresAt: new Date(Date.now() + expirySeconds * 1000).toISOString(),
  };
}

export function sanitizeSlug(slug: string): string {
  let cleaned = "";
  for (const ch of slug) {
    if (/[a-z0-9-]/.test(ch)) cleaned += ch;
    else if (/[A-Z]/.test(ch)) cleaned += ch.toLowerCase();
    else cleaned += "-";
  }
  cleaned = cleaned.replace(/^-+|-+$/g, "");
  if (!cleaned) return "untitled";
  return cleaned.slice(0, 80);
}
