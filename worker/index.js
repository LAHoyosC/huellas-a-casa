// ============================================================
// Worker de Cloudflare: guarda y sirve las fotos desde R2.
//
// PUT /api/fotos/<ruta>   sube una foto (JPEG, maximo 2 MB)
// GET /fotos/<ruta>       la devuelve, con cache larga
// GET /m/<codigo>         la pagina, con la foto y los datos de esa ficha
//                         en las etiquetas de vista previa (WhatsApp,
//                         Instagram, Facebook las leen sin ejecutar la
//                         pagina, por eso hay que ponerlas desde aqui)
//
// Todo lo demas lo sirve Cloudflare como archivos estaticos (la pagina).
// No hay borrado: igual que en la base, nada se borra desde la aplicacion.
// ============================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./entorno.js";

const MAXIMO_BYTES = 2 * 1024 * 1024;
// <entorno>/<id de la ficha>/<sello>-grande.jpg
const RUTA_VALIDA = /^(prod|staging)\/[A-Za-z0-9-]{1,64}\/\d+-(grande|mini)\.jpg$/;

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

    if (url.pathname.startsWith("/m/") && (request.method === "GET" || request.method === "HEAD")) {
      return paginaDeFicha(request, env, url);
    }

    return texto("Método no permitido", 405);
  },
};

// ------------------------------------------------------------
// Vista previa al compartir una ficha.
//
// Toma el index.html compilado y le cambia las etiquetas og:* por las
// del animal. La foto solo va si un voluntario ya aprobo la ficha: asi
// una imagen indebida no se difunde por WhatsApp antes de que alguien
// la revise. Si algo falla (Supabase caido, codigo raro) devuelve la
// pagina normal, que igual sabe abrir la ficha por la ruta.
// ------------------------------------------------------------

const CODIGO_VALIDO = /^[A-Za-z0-9-]{1,32}$/;

async function paginaDeFicha(request, env, url) {
  const codigo = decodeURIComponent(url.pathname.slice("/m/".length)).replace(/\/$/, "");
  const base = await env.ASSETS.fetch(new Request(`${url.origin}/`, { headers: request.headers }));
  if (!CODIGO_VALIDO.test(codigo)) return base;

  let ficha = null;
  try {
    const consulta = new URL(`${SUPABASE_URL}/rest/v1/mascotas`);
    consulta.searchParams.set("codigo", `eq.${codigo}`);
    consulta.searchParams.set("select", "codigo,especie,tamano,color,raza,pelo,sexo,edad,municipio,barrio,custodio,estado,verificado,foto_url,foto_thumb_url");
    consulta.searchParams.set("limit", "1");
    const r = await fetch(consulta, {
      headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (r.ok) ficha = (await r.json())[0] || null;
  } catch { /* se sirve la pagina normal */ }
  if (!ficha || ficha.estado === "oculto") return base;

  const bajo = (v) => (v || "").toLowerCase();
  const raza = ficha.raza && !["Criollo o mestizo", "Otra raza"].includes(ficha.raza) ? ` (${ficha.raza})` : "";
  const titulo = `${ficha.especie} ${bajo(ficha.tamano)} ${bajo(ficha.color)}${raza} — ${ficha.codigo} · Huellas a Casa`.replace(/\s+/g, " ");
  const partes = [
    ficha.estado === "reencontrado" ? "Ya volvió a casa." : "Encontrado, busca a su familia.",
    [ficha.sexo !== "No sé" ? ficha.sexo : "", ficha.edad, ficha.pelo ? `pelo ${bajo(ficha.pelo)}` : ""].filter(Boolean).join(", "),
    [ficha.custodio, ficha.barrio, ficha.municipio].filter(Boolean).join(" · "),
    "¿Lo reconoces? Abre la ficha y escribe a quien lo cuida.",
  ].filter(Boolean);
  const descripcion = partes.join(". ").replace(/\.\./g, ".");
  const foto = ficha.verificado ? await fotoParaVistaPrevia(env, url, ficha) : null;

  const etiquetas = [
    ["og:title", titulo],
    ["og:description", descripcion],
    ["og:url", `${url.origin}/m/${encodeURIComponent(ficha.codigo)}`],
    ["og:type", "article"],
    ...(foto ? [
      ["og:image", foto],
      ["og:image:secure_url", foto],
      ["og:image:type", "image/jpeg"],
      ["og:image:alt", titulo],
      ["twitter:card", "summary_large_image"],
      ["twitter:image", foto],
    ] : []),
  ];

  const html = await base.text();
  const sinViejas = html
    .replace(/<meta property="og:[^"]*"[^>]*>\s*/g, "")
    .replace(/<title>[^<]*<\/title>/, `<title>${escapar(titulo)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escapar(descripcion)}" />`);
  const nuevas = etiquetas.map(([k, v]) => `<meta property="${k}" content="${escapar(v)}" />`).join("\n    ");
  const salida = sinViejas.replace("</head>", `    ${nuevas}\n  </head>`);

  const cabeceras = new Headers(base.headers);
  cabeceras.set("content-type", "text/html; charset=utf-8");
  cabeceras.set("cache-control", "public, max-age=300");
  cabeceras.delete("content-length");
  return new Response(request.method === "HEAD" ? null : salida, { status: 200, headers: cabeceras });
}

// WhatsApp no muestra la vista previa si la imagen pesa mas de unos 300 KB.
// La grande (1200 px) suele pesar 150-300 KB; si se pasa, va la miniatura
// (320 px), que se ve mas pequena pero sale seguro.
const MAXIMO_VISTA_PREVIA = 290 * 1024;

async function fotoParaVistaPrevia(env, url, ficha) {
  const grande = ficha.foto_url || null;
  const mini = ficha.foto_thumb_url || null;
  if (!grande) return mini;
  try {
    const ruta = new URL(grande).pathname;
    if (ruta.startsWith("/fotos/")) {
      const objeto = await env.FOTOS.head(decodeURIComponent(ruta.slice("/fotos/".length)));
      if (objeto && objeto.size > MAXIMO_VISTA_PREVIA) return mini || grande;
    }
  } catch { /* si no se puede medir, se manda la grande */ }
  return grande;
}

function escapar(v) {
  return String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function texto(mensaje, estado) {
  return new Response(mensaje, { status: estado, headers: { "content-type": "text/plain; charset=utf-8" } });
}
