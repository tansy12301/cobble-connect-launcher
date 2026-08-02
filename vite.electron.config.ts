// Standalone SPA build used ONLY for the Electron desktop app.
// The normal `vite build` produces an SSR/server bundle with no index.html,
// which Electron cannot load over file://. This config emits a plain static
// app into dist-electron/ with relative asset paths.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "electron/renderer"),
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist-electron"),
    emptyOutDir: true,
  },
});
