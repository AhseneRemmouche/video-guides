import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev server proxies /api to the Hono API (pnpm api), so the React app can call fetch("/api/research").
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:8788" } },
  build: { outDir: "dist", emptyOutDir: true },
});
