import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Plain static SPA (no backend). `npm run build` emits to dist/, and
// `npm run preview` serves dist/ for the screenshot step.
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
});
