import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// import.meta.dirname gives this config file's folder, so the Vite root is web/ regardless
// of where the command runs from. The dev server proxies /api to the Hono API (npm run api).
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:8787" } },
  build: { outDir: "dist", emptyOutDir: true },
});
