import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// A plain single-page Vite + React app. No backend: the portfolio data is
// static demo content bundled into the page (see src/data.ts).
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
});
