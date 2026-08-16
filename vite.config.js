import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En local, las fotos las atiende el Worker: correr en otra terminal
// `npx wrangler dev` y este proxy le pasa /api y /fotos.
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist" },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
      "/fotos": "http://localhost:8787",
    },
  },
});
