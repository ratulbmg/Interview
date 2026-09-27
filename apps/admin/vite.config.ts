import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3002,
    host: true,
  },
  preview: {
    // `vite preview` rejects any Host header it doesn't recognize by
    // default; relaxed for local dev convenience.
    allowedHosts: true,
  },
});
