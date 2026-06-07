import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: [],
    // lib/env.ts validates process.env at import time; provide dummy values so
    // modules that import it (openai, supabase) load under test.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key-0123456789",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-0123456789",
      NEXTAUTH_URL: "http://localhost:3000",
      OPENAI_API_KEY: "sk-test-0123456789abcdef",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
});
