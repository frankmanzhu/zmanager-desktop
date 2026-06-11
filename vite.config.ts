import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: {
    strictPort: true,
    port: 5173
  },
  envPrefix: ["VITE_", "TAURI_"]
});

