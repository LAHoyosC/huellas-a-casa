// ============================================================
// Compresion de fotos en el navegador, antes de subirlas.
//
// Por que importa: una foto de celular sale entre 3 y 5 MB. Comprimida
// queda en 150-250 KB. Es la diferencia entre 250 mascotas y 5.000 en
// el mismo espacio, y entre una pagina que carga y una que no carga
// con datos moviles.
//
// Guardamos dos versiones: una miniatura para el listado (que es lo
// que todo el mundo mira) y la grande para la ficha (que abren pocos).
// Eso baja muchisimo el trafico.
// ============================================================

import { supabase } from "./supabase.js";

const GRANDE = { ancho: 1200, calidad: 0.8 };
const MINIATURA = { ancho: 320, calidad: 0.7 };

function leerImagen(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error("No se pudo leer el archivo."));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo no es una imagen válida."));
      img.onload = () => resolve(img);
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

function aBlob(img, { ancho, calidad }) {
  return new Promise((resolve, reject) => {
    const escala = Math.min(1, ancho / img.width);
    const w = Math.round(img.width * escala);
    const h = Math.round(img.height * escala);

    const lienzo = document.createElement("canvas");
    lienzo.width = w;
    lienzo.height = h;

    const ctx = lienzo.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);

    lienzo.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo comprimir la imagen."))),
      "image/jpeg",
      calidad
    );
  });
}

// Devuelve { grande, miniatura, vistaPrevia } sin subir nada todavia.
export async function comprimir(archivo) {
  const img = await leerImagen(archivo);
  const [grande, miniatura] = await Promise.all([
    aBlob(img, GRANDE),
    aBlob(img, MINIATURA),
  ]);
  return { grande, miniatura, vistaPrevia: URL.createObjectURL(miniatura) };
}

// Sube las dos versiones y devuelve sus direcciones publicas.
export async function subirFoto(archivo, codigo) {
  const { grande, miniatura } = await comprimir(archivo);
  const sello = Date.now();

  const rutaGrande = `${codigo}/${sello}-grande.jpg`;
  const rutaMini = `${codigo}/${sello}-mini.jpg`;

  const subidas = await Promise.all([
    supabase.storage.from("fotos").upload(rutaGrande, grande, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
    }),
    supabase.storage.from("fotos").upload(rutaMini, miniatura, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
    }),
  ]);

  const fallo = subidas.find((s) => s.error);
  if (fallo) throw new Error("No se pudo subir la foto. Revisa la conexión.");

  const { data: pubGrande } = supabase.storage.from("fotos").getPublicUrl(rutaGrande);
  const { data: pubMini } = supabase.storage.from("fotos").getPublicUrl(rutaMini);

  return {
    foto_url: pubGrande.publicUrl,
    foto_thumb_url: pubMini.publicUrl,
  };
}
