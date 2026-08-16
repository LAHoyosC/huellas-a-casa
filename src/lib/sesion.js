// ============================================================
// Sesion de voluntarios (Supabase Auth, correo y contrasena).
//
// Quien entra tiene que estar ademas en la tabla `voluntarios` con
// activo = true; si no, RLS le niega los cambios igual. La cuenta la
// crea un administrador en Supabase (Authentication > Users) y la
// activa con un insert en `voluntarios` (ver README).
// ============================================================

import { supabase } from "./supabase.js";

export async function entrar(correo, clave) {
  const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave });
  if (error) {
    const m = (error.message || "").toLowerCase();
    if (m.includes("invalid login") || m.includes("invalid credentials")) {
      throw new Error("Correo o contraseña incorrectos.");
    }
    if (m.includes("email not confirmed")) {
      throw new Error("Esa cuenta todavía no está confirmada. Pídele al administrador que la confirme.");
    }
    throw new Error("No se pudo iniciar sesión. Revisa la conexión e intenta de nuevo.");
  }
}

export async function salir() {
  await supabase.auth.signOut();
}

// Devuelve { correo, voluntario } o null si no hay sesion.
// voluntario es null si la cuenta existe pero no esta activada.
export async function sesionActual() {
  const { data } = await supabase.auth.getSession();
  const usuario = data?.session?.user;
  if (!usuario) return null;
  const { data: v } = await supabase
    .from("voluntarios")
    .select("nombre, refugio, activo")
    .eq("id", usuario.id)
    .maybeSingle();
  return { correo: usuario.email, voluntario: v && v.activo ? v : null };
}

export function alCambiarSesion(cb) {
  const { data } = supabase.auth.onAuthStateChange(() => { sesionActual().then(cb); });
  return () => data.subscription.unsubscribe();
}
