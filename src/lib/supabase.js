import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const llave = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !llave) {
  console.error(
    "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. " +
      "Copia .env.example como .env y pon tus valores."
  );
}

export const supabase = createClient(url, llave);
