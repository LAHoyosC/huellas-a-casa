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
//
// Las fotos viven en Cloudflare R2, no en Supabase: 10 GB gratis y la
// salida de datos no se cobra, asi que verlas no gasta cuota. Las sube
// y las sirve worker/index.js, en el mismo dominio de la pagina.
// En staging van bajo la carpeta "staging/" para no mezclarlas.
// ============================================================

const ENTORNO = import.meta.env.VITE_ENTORNO === "staging" ? "staging" : "prod";

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
// carpeta: "" para fichas (<entorno>/<id>/...), "busquedas" para la foto
// que deja el tutor al buscar (<entorno>/busquedas/<id>/...). Van aparte
// para no mezclarse; el respaldo semanal copia el bucket entero.
export async function subirFoto(archivo, codigo, carpeta = "") {
  const { grande, miniatura } = await comprimir(archivo);
  const sello = Date.now();
  const base = carpeta ? `${ENTORNO}/${carpeta}/${codigo}` : `${ENTORNO}/${codigo}`;

  const rutaGrande = `${base}/${sello}-grande.jpg`;
  const rutaMini = `${base}/${sello}-mini.jpg`;

  const [g, m] = await Promise.all([subir(rutaGrande, grande), subir(rutaMini, miniatura)]);
  return { foto_url: g, foto_thumb_url: m };
}

async function subir(ruta, blob) {
  const r = await fetch(`/api/fotos/${ruta}`, {
    method: "PUT",
    headers: { "content-type": "image/jpeg" },
    body: blob,
  });
  if (!r.ok) throw new Error("No se pudo subir la foto. Revisa la conexión.");
  const { url } = await r.json();
  return url;
}
