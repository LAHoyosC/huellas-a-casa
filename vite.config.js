import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VITE_BASE la pone el workflow de publicacion en GitHub Pages
// (la pagina vive en /huellas-a-casa/). En local y en Cloudflare
// Pages queda en "/".
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  build: { outDir: "dist" },
});
