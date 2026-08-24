import { defineConfig } from "vitest/config";

// Test di sini murni logika (validasi, slug, hash) tanpa binding Workers
// sungguhan — jadi cukup vitest polos, tidak perlu pool Workers yang minta
// wrangler.jsonc lengkap dengan Hyperdrive/KV/R2 yang sudah tersambung.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
