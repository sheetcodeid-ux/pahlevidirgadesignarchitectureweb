import { Hono } from "hono";
import type { Env } from "../types";

export const health = new Hono<{ Bindings: Env }>();

// Dipakai sebagai startup/liveness probe. Sengaja tidak menyentuh database
// supaya Worker tetap dianggap sehat saat Supabase free tier sedang
// di-resume dari auto-pause.
health.get("/healthz", (c) => c.json({ status: "ok", env: c.env.APP_ENV }));
