import { defineConfig } from "vitest/config";

export default defineConfig({
  clearScreen: false,
  server: {
    strictPort: true,
    port: 5173
  },
  envPrefix: ["VITE_", "TAURI_"],
  test: {
    exclude: ["e2e/**", "node_modules/**", "dist/**", "src-tauri/**"]
  }
});

