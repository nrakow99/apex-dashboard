import { defineConfig } from "vitest/config"
import path from "node:path"

// Mirrors tsconfig.json's "@/*": ["./*"] — without this, any lib file that
// imports via "@/..." (most of lib/pa-activation.ts, lib/storage.ts, etc.)
// can't be loaded by Vitest at all, so it silently never gets test coverage.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
})
