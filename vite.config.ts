import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  clearScreen: false,
  plugins: [react(), tailwindcss()],
  server: {
    strictPort: true,
    port: 5173,
    watch: {
      ignored: ["**/src-tauri/target/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  test: {
    exclude: ["e2e/**", "node_modules/**", "dist/**", "src-tauri/**", "scripts/**"]
  }
});
