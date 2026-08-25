import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import type { Env } from "./types";
import { health } from "./routes/health";
import { projects } from "./routes/projects";
import { auth } from "./routes/auth";
import { inquiries } from "./routes/inquiries";
import { admin } from "./routes/admin";
import { progress } from "./routes/progress";
import { settings } from "./routes/settings";
import { rateLimit } from "./middleware/rateLimit";

const app = new Hono<{ Bindings: Env }>();

app.use("*", secureHeaders());

// Body kecil: gambar tidak lewat sini, melainkan langsung ke R2 lewat
// presigned URL.
app.use("*", bodyLimit({ maxSize: 1024 * 1024 }));

app.use("*", async (c, next) => {
  const origins = c.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
  return cors({
    origin: origins,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Origin", "Content-Type", "Accept", "Authorization"],
    maxAge: 3600,
  })(c, next);
});

app.route("/", health);

const v1 = new Hono<{ Bindings: Env }>();
v1.route("/", projects);
v1.route("/", settings);

// Login dibatasi lebih ketat daripada form kontak: sepuluh percobaan per IP
// per jam cukup untuk orang yang lupa kata sandinya, tapi tidak cukup untuk
// menebak.
v1.use("/auth/login", rateLimit("login", 10, 3600));
v1.route("/", auth);

// Form kontak dibatasi ketat: 5 submission per IP per jam.
v1.use("/inquiries", rateLimit("inquiry", 5, 3600));
v1.route("/", inquiries);

v1.route("/admin", admin);

// Link progres klien: bukan lewat Turnstile (klien tidak dianggap mengisi
// form), tapi tokennya sendiri 160-bit — rate limit di sini cuma jaga-jaga
// dari percobaan enumerasi kasar, bukan pertahanan utama.
v1.use("/progress/:token", rateLimit("progress", 30, 3600));
v1.use("/progress/:token/documents/:documentId/approve", rateLimit("progress-doc", 20, 3600));
v1.use("/progress/:token/documents/:documentId/revise", rateLimit("progress-doc", 20, 3600));
v1.route("/", progress);

app.route("/api/v1", v1);

app.onError((err, c) => {
  console.error("request gagal", { path: c.req.path, method: c.req.method, error: String(err) });
  const production = c.env.APP_ENV === "production";
  return c.json(
    {
      error: {
        status: 500,
        message: production ? "terjadi kesalahan pada server" : String((err as Error).message ?? err),
      },
    },
    500,
  );
});

app.notFound((c) => c.json({ error: { status: 404, message: "tidak ditemukan" } }, 404));

export default app;
