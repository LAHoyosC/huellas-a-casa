import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VITE_BASE la pone el workflow de publicacion en GitHub Pages
// (la pagina vive en /huellas-a-casa/). En local y en Cloudflare
// queda en "/".
//
// En local, las fotos las atiende el Worker: correr en otra terminal
// `npx wrangler dev` y este proxy le pasa /api y /fotos.
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  build: { outDir: "dist" },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
      "/fotos": "http://localhost:8787",
    },
  },
});
