import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3002,
    // Vite defaults to binding localhost only, which Docker's port mapping
    // can't reach from outside the container — see docker-compose.dev.yml.
    host: true,
  },
  preview: {
    // `vite preview` (prod, see docker/Dockerfile.dashboard.prod) rejects
    // any Host header it doesn't recognize by default; this port is never
    // published outside the docker network, so relaxing it here is safe.
    allowedHosts: true,
  },
});
