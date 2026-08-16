import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const llave = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Si faltan las variables, la pagina igual carga (con un aviso en la
// consola y sin datos) en vez de quedarse en blanco.
export const configurado = Boolean(url && llave);

if (!configurado) {
  console.error(
    "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. " +
      "En local: copia .env.example como .env. " +
      "En GitHub Pages: Settings -> Secrets and variables -> Actions -> Variables."
  );
}

export const supabase = createClient(
  url || "https://sin-configurar.supabase.co",
  llave || "sin-configurar"
);
