// ============================================================
// Worker de Cloudflare: guarda y sirve las fotos desde R2.
//
// PUT /api/fotos/<ruta>   sube una foto (JPEG, maximo 2 MB)
// GET /fotos/<ruta>       la devuelve, con cache larga
//
// Todo lo demas lo sirve Cloudflare como archivos estaticos (la pagina).
// No hay borrado: igual que en la base, nada se borra desde la aplicacion.
// ============================================================

const MAXIMO_BYTES = 2 * 1024 * 1024;
const RUTA_VALIDA = /^[a-z0-9-]+\/[A-Z]{3}-\d{4,}\/\d+-(grande|mini)\.jpg$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/fotos/") && request.method === "PUT") {
      const ruta = decodeURIComponent(url.pathname.slice("/api/fotos/".length));
      if (!RUTA_VALIDA.test(ruta)) return texto("Ruta no válida", 400);
      if (!(request.headers.get("content-type") || "").startsWith("image/jpeg")) {
        return texto("Solo se aceptan fotos JPEG", 415);
      }
      const tam = Number(request.headers.get("content-length") || 0);
      if (tam > MAXIMO_BYTES) return texto("La foto es demasiado grande", 413);
      const cuerpo = await request.arrayBuffer();
      if (cuerpo.byteLength > MAXIMO_BYTES) return texto("La foto es demasiado grande", 413);
      if (cuerpo.byteLength === 0) return texto("Foto vacía", 400);

      await env.FOTOS.put(ruta, cuerpo, {
        httpMetadata: { contentType: "image/jpeg", cacheControl: "public, max-age=31536000, immutable" },
      });
      return Response.json({ url: `${url.origin}/fotos/${ruta}` });
    }

    if (url.pathname.startsWith("/fotos/") && (request.method === "GET" || request.method === "HEAD")) {
      const ruta = decodeURIComponent(url.pathname.slice("/fotos/".length));
      const objeto = await env.FOTOS.get(ruta);
      if (!objeto) return texto("No existe", 404);
      const cabeceras = new Headers();
      objeto.writeHttpMetadata(cabeceras);
      cabeceras.set("etag", objeto.httpEtag);
      cabeceras.set("cache-control", "public, max-age=31536000, immutable");
      return new Response(request.method === "HEAD" ? null : objeto.body, { headers: cabeceras });
    }

    return texto("Método no permitido", 405);
  },
};

function texto(mensaje, estado) {
  return new Response(mensaje, { status: estado, headers: { "content-type": "text/plain; charset=utf-8" } });
}
