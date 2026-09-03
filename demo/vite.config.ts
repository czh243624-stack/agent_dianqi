import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["maplibre-gl"],
  },
  worker: {
    format: "es",
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    allowedHosts: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    allowedHosts: true,
    hmr: { overlay: false },
    proxy: {
      "/api/video-jobs": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
});
