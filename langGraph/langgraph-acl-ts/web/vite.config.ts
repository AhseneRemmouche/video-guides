import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  server: {
    port: 5173,
    // The browser talks to Vite only; Vite forwards /api to the agent server, so no CORS setup is needed.
    proxy: { "/api": "http://localhost:8787" },
  },
});
