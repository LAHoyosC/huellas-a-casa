import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase, configurado } from "./lib/supabase.js";
import { subirFoto, comprimir } from "./lib/foto.js";
import { entrar, salir, sesionActual, alCambiarSesion, pedirRecuperacion, cambiarClave, llegoParaRecuperar } from "./lib/sesion.js";
import { buscarCoincidencias, posiblesDuplicados, fichasGemelas, empatadosArriba } from "./lib/coincidencia.js";
import { extraerConceptos, etiquetaDe } from "./lib/conceptos.js";
import { sugerirDesdeNota } from "./lib/sugerencias.js";
import {
  ESPECIE, TAMANO, TAMANO_PISTA, COLOR, COLOR_MUESTRA, PELO, SEXO, EDAD,
  OREJAS, COLA, SENAS, SENAS_CON_LUGAR, COLOR_COLLAR, CUSTODIO, MUNICIPIOS, BARRIOS, RAZA, RAZA_INDEFINIDA,
} from "./lib/catalogo.js";

const T = {
  papel: "#F6F4F0", papelHondo: "#EBE7E0", tinta: "#1B2029", tintaSuave: "#5A6272",
  linea: "#D8D2C8", verde: "#2F6F5E", verdeClaro: "#E4EFEA", ambar: "#D9922B",
  ambarClaro: "#FBF0DC", violeta: "#6B4E8F", violetaClaro: "#EFE9F5",
  rojo: "#B03A28", blanco: "#FFFFFF",
};

// Contacto del grupo de voluntarios: dudas, correcciones y retiro de datos.
const CONTACTO_DATOS = "huellasacasa.eje@gmail.com";
const CONTACTO_CELULAR = "+57 301 8009036";
const CONTACTO_WHATSAPP = `https://wa.me/${CONTACTO_CELULAR.replace(/\D/g, "")}`;

// Numero de registro de una busqueda (BUS-7K3MQ). Sin letras/numeros que
// se confundan (0/O, 1/I/L). Lo genera la pagina: el publico no puede leer
// la tabla busquedas, asi que no recibiria un consecutivo de la base.
function nuevoCodigoBusqueda() {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const v = crypto.getRandomValues(new Uint8Array(5));
  return "BUS-" + Array.from(v, (x) => abc[x % abc.length]).join("");
}

// Enlace publico de una ficha. El Worker (worker/index.js) responde en
// esta ruta con la foto y los datos del animal en las etiquetas de
// vista previa, para que al compartir por WhatsApp salga la imagen.
function enlaceFicha(codigo) {
  return `${window.location.origin}/m/${encodeURIComponent(codigo)}`;
}

function textoParaCompartir(r) {
  const raza = r.raza && !RAZA_INDEFINIDA.includes(r.raza) ? ` (${r.raza})` : "";
  const que = `${r.especie} ${r.tamano?.toLowerCase() || ""} ${r.color?.toLowerCase() || ""}${raza}`.replace(/\s+/g, " ").trim();
  const donde = [r.barrio, r.municipio].filter(Boolean).join(", ");
  return `${que} encontrado en ${donde}. ¿Lo reconoces? Ficha ${r.codigo}:`;
}

async function compartirFicha(r) {
  const url = enlaceFicha(r.codigo);
  const texto = textoParaCompartir(r);
  if (navigator.share) {
    try { await navigator.share({ title: `Huellas a Casa — ${r.codigo}`, text: texto, url }); return; } catch { /* cancelado */ return; }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${texto} ${url}`)}`, "_blank", "noopener");
}

const FUENTE = `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

const entradaTexto = {
  width: "100%", maxWidth: 420, padding: "11px 12px", borderRadius: 9,
  border: `1.5px solid ${T.linea}`, background: T.blanco, fontSize: 15,
  color: T.tinta, fontFamily: FUENTE, boxSizing: "border-box",
};

// Medios de contacto. El valor guardado en contacto_telefono es el
// numero, el correo o el usuario segun el medio elegido.
const MEDIOS = ["WhatsApp", "Correo", "Instagram"];
const MEDIO_PISTA = { WhatsApp: "10 dígitos", Correo: "nombre@correo.com", Instagram: "@usuario" };

function enlaceContacto(medio, valor) {
  const v = (valor || "").trim();
  if (medio === "Correo") return `mailto:${v}`;
  if (medio === "Instagram") return `https://instagram.com/${v.replace(/^@/, "")}`;
  return `https://wa.me/57${v.replace(/\D/g, "")}`;
}

// Acepta enlaces de Google Maps (compartir desde la app o el navegador).
function esEnlaceMapa(v) {
  const t = (v || "").trim();
  return /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)\//i.test(t);
}

function CampoContacto({ medio, valor, onMedio, onValor, placeholderNombre }) {
  const m = medio || "WhatsApp";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {MEDIOS.map((o) => <Opcion key={o} activo={m === o} onClick={() => onMedio(o)}>{o}</Opcion>)}
      </div>
      <input style={entradaTexto} inputMode={m === "WhatsApp" ? "tel" : m === "Correo" ? "email" : "text"}
        value={valor || ""} onChange={(e) => onValor(e.target.value)} placeholder={MEDIO_PISTA[m]} />
    </div>
  );
}

// Campos de la ficha que se pueden escribir desde el formulario. Al editar
// solo se envian estos: nunca id, codigo, estado, verificado ni fechas.
const CAMPOS_FICHA = [
  "especie", "tamano", "color", "pelo", "sexo", "edad", "orejas", "cola", "senas", "senas_donde", "collar_color",
  "departamento", "municipio", "barrio", "fecha_hallazgo", "custodio", "lugar", "refugio_id",
  "contacto_nombre", "contacto_telefono", "contacto_medio", "nota", "lugar_mapa", "fuente_url",
];
const soloCampos = (obj) => Object.fromEntries(CAMPOS_FICHA.map((k) => [k, obj[k] ?? null]));

// Campos de un refugio que se escriben desde el panel de voluntarios.
const CAMPOS_REFUGIO = [
  "nombre", "tipo", "departamento", "municipio", "barrio", "direccion", "lugar_mapa",
  "contacto_telefono", "contacto_medio", "responsable", "notas", "activo",
];
const soloCamposRefugio = (obj) => Object.fromEntries(CAMPOS_REFUGIO.map((k) => [k, obj[k] ?? null]));

// Campos de una adopción que el voluntario escribe al marcarla. El contacto
// es opcional: si queda vacío, se pregunta al contacto que la ficha ya muestra.
const CAMPOS_ADOPCION = ["contacto_nombre", "contacto_telefono", "contacto_medio", "notas"];
const soloCamposAdopcion = (obj) => Object.fromEntries(CAMPOS_ADOPCION.map((k) => [k, obj[k] ?? null]));

// Al elegir un refugio, la ficha se llena sola con lo que el refugio ya
// tiene: donde esta, como llegar y a quien escribir. Lo que la persona ya
// habia escrito en la ficha se respeta salvo el sitio mismo.
function fichaDesdeRefugio(reporte, ref) {
  if (!ref) return { ...reporte, refugio_id: null };
  const r = { ...reporte, refugio_id: ref.id, custodio: ref.tipo, lugar: ref.nombre };
  if (ref.departamento) { r.departamento = ref.departamento; }
  if (ref.municipio) { r.municipio = ref.municipio; }
  if (ref.barrio && !reporte.barrio) r.barrio = ref.barrio;
  if (ref.lugar_mapa) r.lugar_mapa = ref.lugar_mapa;
  if (ref.contacto_telefono && !reporte.contacto_telefono) {
    r.contacto_telefono = ref.contacto_telefono;
    r.contacto_medio = ref.contacto_medio || "WhatsApp";
  }
  return r;
}

const botonSecundario = (color) => ({
  background: "transparent", border: `1.5px solid ${color === T.verde ? T.verde : T.linea}`,
  color, padding: "9px 13px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
});

function Entrar({ onListo }) {
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [olvido, setOlvido] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function recuperar(e) {
    e.preventDefault();
    setError("");
    if (!correo) { setError("Escribe tu correo."); return; }
    setCargando(true);
    try { await pedirRecuperacion(correo); setEnviado(true); }
    catch (err) { setError(err.message); }
    finally { setCargando(false); }
  }

  if (olvido) {
    return (
      <form onSubmit={recuperar} style={{
      border: `1px solid ${T.linea}`, borderRadius: 13, background: T.blanco,
      padding: "24px 24px", maxWidth: 460,
    }}>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: ".12em", color: T.verde }}>VOLUNTARIOS</div>
        <h2 style={{ margin: "8px 0 6px", fontSize: 22, fontWeight: 720, letterSpacing: "-.02em" }}>Recuperar contraseña</h2>
        {enviado ? (
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>
            Te enviamos un correo a <strong>{correo}</strong> con un enlace. Ábrelo y te pedirá la
            contraseña nueva. Si no llega en unos minutos, revisa la carpeta de spam.
          </p>
        ) : (
          <>
            <p style={{ margin: "0 0 18px", fontSize: 14.5, color: T.tintaSuave, lineHeight: 1.5 }}>
              Escribe tu correo y te mandamos un enlace para definir una contraseña nueva.
            </p>
            <input style={entradaTexto} type="email" autoComplete="username" placeholder="Correo"
              value={correo} onChange={(e) => setCorreo(e.target.value)} />
            {error && <p style={{ margin: "10px 0 0", fontSize: 14, color: T.rojo }}>{error}</p>}
            <button type="submit" disabled={cargando} style={{
              marginTop: 16, background: cargando ? T.tintaSuave : T.verde, color: T.blanco, border: "none",
              borderRadius: 9, padding: "12px 20px", fontSize: 15, fontWeight: 660, cursor: cargando ? "wait" : "pointer",
            }}>{cargando ? "Enviando…" : "Enviar enlace"}</button>
          </>
        )}
        <p style={{ margin: "16px 0 0", fontSize: 13.5 }}>
          <a href="#" onClick={(e) => { e.preventDefault(); setOlvido(false); setEnviado(false); setError(""); }} style={{ color: T.verde }}>Volver a iniciar sesión</a>
        </p>
      </form>
    );
  }

  async function enviar(e) {
    e.preventDefault();
    setError("");
    if (!correo || !clave) { setError("Escribe el correo y la contraseña."); return; }
    setCargando(true);
    try {
      await entrar(correo, clave);
      onListo();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} style={{
      border: `1px solid ${T.linea}`, borderRadius: 13, background: T.blanco,
      padding: "24px 24px", maxWidth: 460,
    }}>
      <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: ".12em", color: T.verde }}>VOLUNTARIOS</div>
      <h2 style={{ margin: "8px 0 6px", fontSize: 22, fontWeight: 720, letterSpacing: "-.02em" }}>Iniciar sesión</h2>
      <p style={{ margin: "0 0 18px", fontSize: 14.5, color: T.tintaSuave, lineHeight: 1.5 }}>
        Solo para quienes aprueban fichas y confirman reencuentros. Si no tienes cuenta,
        pídela en el grupo de voluntarios.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input style={entradaTexto} type="email" autoComplete="username" placeholder="Correo"
          value={correo} onChange={(e) => setCorreo(e.target.value)} />
        <input style={entradaTexto} type="password" autoComplete="current-password" placeholder="Contraseña"
          value={clave} onChange={(e) => setClave(e.target.value)} />
      </div>
      {error && <p style={{ margin: "10px 0 0", fontSize: 14, color: T.rojo }}>{error}</p>}
      <button type="submit" disabled={cargando} style={{
        marginTop: 16, background: cargando ? T.tintaSuave : T.verde, color: T.blanco, border: "none",
        borderRadius: 9, padding: "12px 20px", fontSize: 15, fontWeight: 660, cursor: cargando ? "wait" : "pointer",
      }}>{cargando ? "Entrando…" : "Entrar"}</button>
      <p style={{ margin: "16px 0 0", fontSize: 13.5 }}>
        <a href="#" onClick={(e) => { e.preventDefault(); setOlvido(true); setError(""); }} style={{ color: T.tintaSuave }}>¿Olvidaste tu contraseña?</a>
      </p>
    </form>
  );
}

function NuevaClave({ onListo }) {
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError("");
    if (clave.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (clave !== clave2) { setError("Las dos contraseñas no coinciden."); return; }
    setCargando(true);
    try { await cambiarClave(clave); onListo(); }
    catch (err) { setError(err.message); }
    finally { setCargando(false); }
  }

  return (
    <form onSubmit={enviar} style={{
      border: `1px solid ${T.linea}`, borderRadius: 13, background: T.blanco,
      padding: "24px 24px", maxWidth: 460,
    }}>
      <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: ".12em", color: T.verde }}>VOLUNTARIOS</div>
      <h2 style={{ margin: "8px 0 6px", fontSize: 22, fontWeight: 720, letterSpacing: "-.02em" }}>Define tu contraseña nueva</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
        <input style={entradaTexto} type="password" autoComplete="new-password" placeholder="Contraseña nueva (mínimo 8)"
          value={clave} onChange={(e) => setClave(e.target.value)} />
        <input style={entradaTexto} type="password" autoComplete="new-password" placeholder="Repítela"
          value={clave2} onChange={(e) => setClave2(e.target.value)} />
      </div>
      {error && <p style={{ margin: "10px 0 0", fontSize: 14, color: T.rojo }}>{error}</p>}
      <button type="submit" disabled={cargando} style={{
        marginTop: 16, background: cargando ? T.tintaSuave : T.verde, color: T.blanco, border: "none",
        borderRadius: 9, padding: "12px 20px", fontSize: 15, fontWeight: 660, cursor: cargando ? "wait" : "pointer",
      }}>{cargando ? "Guardando…" : "Guardar contraseña"}</button>
    </form>
  );
}

function Dato({ etiqueta, valor }) {
  if (!valor) return null;
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".1em", color: T.tintaSuave }}>{etiqueta}</div>
      <div style={{ fontSize: 15, marginTop: 2 }}>{valor}</div>
    </div>
  );
}

function Detalle({ r, voluntario, adopcion, onAdopcion, onQuitarAdopcion, onCerrar, onReencontrar, onAprobar, onOcultar, onEditar }) {
  const [copiado, setCopiado] = useState(false);
  const [formAdopcion, setFormAdopcion] = useState(false);
  const reencontrado = r.estado === "reencontrado";
  const senas = r.senas || [];
  // Misma regla que en la tarjeta: foto borrosa al publico hasta que un
  // voluntario apruebe la ficha (control de imagenes).
  const [fotoDestapada, setFotoDestapada] = useState(false);
  const fotoBorrosa = !r.verificado && !voluntario && !fotoDestapada;

  useEffect(() => {
    const tecla = (e) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", tecla);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", tecla); document.body.style.overflow = ""; };
  }, [onCerrar]);

  async function compartir() {
    const url = enlaceFicha(r.codigo);
    const texto = textoParaCompartir(r);
    if (navigator.share) {
      try { await navigator.share({ title: `Huellas a Casa · ${r.codigo}`, text: texto, url }); return; } catch { /* cancelado */ }
    }
    try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { prompt("Copia este enlace:", url); }
  }

  return (
    <div onClick={onCerrar} style={{
      position: "fixed", inset: 0, background: "rgba(27,32,41,.55)", zIndex: 50,
      display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 12px", overflowY: "auto",
    }}>
      <article onClick={(e) => e.stopPropagation()} style={{
        background: T.blanco, borderRadius: 14, maxWidth: 680, width: "100%", overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,.25)",
      }}>
        <div style={{ position: "relative", background: T.papelHondo }}>
          {r.foto_url || r.foto_thumb_url ? (
            <div style={{ position: "relative", overflow: "hidden" }}>
              <img src={r.foto_url || r.foto_thumb_url} alt=""
                style={{
                  width: "100%", maxHeight: "70vh", objectFit: "contain", display: "block", background: "#111",
                  filter: fotoBorrosa ? "blur(22px)" : "none", transform: fotoBorrosa ? "scale(1.1)" : "none",
                }} />
              {fotoBorrosa && (
                <button type="button" onClick={() => setFotoDestapada(true)} style={{
                  position: "absolute", inset: 0, background: "rgba(27,32,41,.35)", border: "none",
                  color: T.blanco, cursor: "pointer", fontSize: 14, fontWeight: 620, lineHeight: 1.4, fontFamily: FUENTE,
                }}>Foto sin revisar por un voluntario<br />Toca para verla</button>
              )}
            </div>
          ) : (
            <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "#B9B2A6", fontFamily: MONO, fontSize: 12 }}>SIN FOTO</div>
          )}
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{
            position: "absolute", top: 10, right: 10, width: 36, height: 36, borderRadius: "50%",
            border: "none", background: "rgba(255,255,255,.92)", fontSize: 18, cursor: "pointer", fontWeight: 700,
          }}>×</button>
        </div>

        <div style={{ padding: "18px 20px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 12, color: T.tintaSuave }}>
                {r.codigo}
                {!r.verificado && <span style={{ marginLeft: 8, color: T.ambar }}>SIN VERIFICAR</span>}
                {reencontrado && <span style={{ marginLeft: 8, color: T.verde }}>REENCONTRADO</span>}
                {adopcion && !reencontrado && <span style={{ marginLeft: 8, color: T.violeta }}>EN ADOPCIÓN</span>}
              </div>
              <h2 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 740, letterSpacing: "-.02em" }}>
                {r.especie} {r.tamano?.toLowerCase()}, {r.color?.toLowerCase()}
              </h2>
            </div>
            <button type="button" onClick={compartir} style={botonSecundario(T.tinta)}>
              {copiado ? "Enlace copiado ✓" : "Compartir"}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginTop: 16 }}>
            <Dato etiqueta="SEXO" valor={r.sexo} />
            <Dato etiqueta="EDAD" valor={r.edad} />
            <Dato etiqueta="PELO" valor={r.pelo} />
            <Dato etiqueta="OREJAS" valor={r.orejas} />
            <Dato etiqueta="COLA" valor={r.cola} />
            <Dato etiqueta="COLLAR" valor={r.collar_color} />
            <Dato etiqueta="RECOGIDO EL" valor={r.fecha_hallazgo} />
            <Dato etiqueta="APARECIÓ EN" valor={[r.barrio, r.municipio, r.departamento].filter(Boolean).join(", ")} />
            <Dato etiqueta="ESTÁ EN" valor={[r.custodio, r.lugar].filter(Boolean).join(" — ")} />
          </div>

          {senas.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
              {senas.map((x) => (
                <span key={x} style={{ fontSize: 12.5, padding: "4px 9px", borderRadius: 20, background: T.ambarClaro, color: "#8A5A12", fontWeight: 560 }}>{x}</span>
              ))}
              {r.senas_donde && <span style={{ fontSize: 13, alignSelf: "center", color: T.tintaSuave }}>{r.senas_donde}</span>}
            </div>
          )}

          {r.nota && (
            <p style={{ margin: "14px 0 0", fontSize: 15, fontStyle: "italic", lineHeight: 1.55 }}>“{r.nota}”</p>
          )}

          {adopcion && !reencontrado && (
            <div style={{ marginTop: 16, padding: "11px 13px", background: T.violetaClaro, borderRadius: 9, fontSize: 13.5, lineHeight: 1.5, color: T.violeta }}>
              <strong style={{ fontWeight: 660 }}>Busca un hogar.</strong> Nadie ha reclamado a este animal
              y está disponible para adopción. Si quieres darle una familia, pregunta por él.
              {adopcion.notas && <> {adopcion.notas}</>}
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: adopcion && !reencontrado ? 12 : 18, alignItems: "center" }}>
            {adopcion && !reencontrado && (
              <a href={enlaceContacto(adopcion.contacto_medio || r.contacto_medio, adopcion.contacto_telefono || r.contacto_telefono)}
                target="_blank" rel="noreferrer" style={{
                  background: T.violeta, color: T.blanco, textDecoration: "none", padding: "10px 15px", borderRadius: 8, fontSize: 14.5, fontWeight: 640,
                }}>
                Preguntar por esta mascota
              </a>
            )}
            {!reencontrado && (
              <a href={enlaceContacto(r.contacto_medio, r.contacto_telefono)} target="_blank" rel="noreferrer" style={{
                background: T.verde, color: T.blanco, textDecoration: "none", padding: "10px 15px", borderRadius: 8, fontSize: 14.5, fontWeight: 640,
              }}>
                {r.contacto_nombre ? `Escribir a ${r.contacto_nombre}` : "Escribir"} por {r.contacto_medio || "WhatsApp"}
              </a>
            )}
            {r.lugar_mapa && (
              <a href={r.lugar_mapa} target="_blank" rel="noreferrer" style={{ ...botonSecundario(T.verde), textDecoration: "none" }}>Cómo llegar</a>
            )}
            {r.fuente_url && /^https?:\/\//i.test(r.fuente_url) && (
              <a href={r.fuente_url} target="_blank" rel="noreferrer noopener" style={{ ...botonSecundario(T.tintaSuave), textDecoration: "none" }}>Publicación original ↗</a>
            )}
          </div>

          {voluntario && !reencontrado && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.linea}` }}>
              {!r.verificado && <button type="button" onClick={() => onAprobar(r)} style={botonSecundario(T.verde)}>Aprobar ficha</button>}
              <button type="button" onClick={() => onEditar(r)} style={botonSecundario(T.tinta)}>Editar ficha</button>
              <button type="button" onClick={() => onReencontrar(r)} style={botonSecundario(T.tintaSuave)}>Marcar como reencontrado</button>
              <button type="button" onClick={() => { onOcultar(r); onCerrar(); }} style={botonSecundario(T.tintaSuave)}>Ocultar</button>
              {adopcion
                ? <button type="button" onClick={() => onQuitarAdopcion(r)} style={botonSecundario(T.tintaSuave)}>Quitar de adopción</button>
                : <button type="button" onClick={() => setFormAdopcion(!formAdopcion)} style={botonSecundario(T.violeta)}>Dar en adopción…</button>}
            </div>
          )}

          {voluntario && !reencontrado && !adopcion && formAdopcion && (
            <FormAdopcion onGuardar={async (datos) => { await onAdopcion(r, datos); setFormAdopcion(null); }}
              onCancelar={() => setFormAdopcion(null)} />
          )}
        </div>
      </article>
    </div>
  );
}

// Mini-formulario para poner en adopción: se usa en la ficha abierta y en las
// tarjetas (listado y panel). Contacto opcional: si queda vacío, el botón
// público usa el contacto que la ficha ya muestra.
function FormAdopcion({ onGuardar, onCancelar }) {
  const [f, setF] = useState({ contacto_medio: "WhatsApp" });
  return (
    <div style={{ marginTop: 12, padding: "12px 13px", background: T.violetaClaro, borderRadius: 9, display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ fontSize: 13.5, color: T.violeta, lineHeight: 1.5 }}>
        La ficha mostrará «En adopción» y un botón para preguntar por el animal. Si no llenas
        el contacto, se usa el que ya tiene la ficha (quien lo aloja). El animal sigue
        cruzando con las búsquedas por si aparece el tutor.
      </div>
      <CampoContacto medio={f.contacto_medio} valor={f.contacto_telefono}
        onMedio={(m) => setF((p) => ({ ...p, contacto_medio: m }))}
        onValor={(v) => setF((p) => ({ ...p, contacto_telefono: v }))} />
      <input style={entradaTexto} value={f.contacto_nombre || ""} placeholder="A quién preguntar (opcional)"
        onChange={(e) => setF((p) => ({ ...p, contacto_nombre: e.target.value }))} />
      <input style={entradaTexto} value={f.notas || ""} placeholder="Nota para quien quiera adoptar (opcional)"
        onChange={(e) => setF((p) => ({ ...p, notas: e.target.value }))} />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => onGuardar(f)}
          style={{ background: T.violeta, color: T.blanco, border: "none", padding: "9px 14px", borderRadius: 8, fontSize: 13.5, fontWeight: 640, cursor: "pointer" }}>
          Poner en adopción
        </button>
        <button type="button" onClick={onCancelar} style={botonSecundario(T.tintaSuave)}>Cancelar</button>
      </div>
    </div>
  );
}

// ------------------------- MIS CAMBIOS (voluntarios) -------------------------
// La tabla `historial` guarda cada cambio con el antes y el después. Aquí el
// voluntario ve sus últimos movimientos y puede deshacer una edición: se
// restauran los valores de ANTES, solo en los campos que se pueden escribir
// (nunca id, código ni fechas). Las creaciones no se deshacen: aquí nada se
// borra (una ficha se oculta, una adopción se quita).

const CAMPOS_DESHACER = {
  mascotas: [...CAMPOS_FICHA, "estado", "verificado"],
  refugios: CAMPOS_REFUGIO,
  adopciones: [...CAMPOS_ADOPCION, "estado"],
};
const TABLA_NOMBRE = { mascotas: "ficha", refugios: "refugio", adopciones: "adopción", busquedas: "búsqueda" };

// Los campos que de verdad cambiaron y se pueden restaurar.
function cambiosDeshacibles(h) {
  const permitidos = CAMPOS_DESHACER[h.tabla];
  if (!permitidos || h.operacion !== "UPDATE" || !h.antes || !h.despues) return null;
  const c = {};
  for (const k of permitidos) {
    if (JSON.stringify(h.antes[k] ?? null) !== JSON.stringify(h.despues[k] ?? null)) c[k] = h.antes[k] ?? null;
  }
  return Object.keys(c).length ? c : null;
}

function MisCambios({ voluntario, onDeshacer, onCerrar }) {
  const [cambios, setCambios] = useState(null);
  const [deshechos, setDeshechos] = useState([]);
  useEffect(() => {
    supabase.from("historial").select("*")
      .eq("hecho_por", voluntario.id)
      .order("hecho_en", { ascending: false }).limit(50)
      .then(({ data }) => setCambios(data || []));
  }, [voluntario.id]);

  const cuando = (t) => new Date(t).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const nombreDe = (h) => (h.despues || h.antes || {}).codigo || (h.despues || h.antes || {}).nombre || "";

  return (
    <div onClick={onCerrar} style={{
      position: "fixed", inset: 0, background: "rgba(27,32,41,.55)", zIndex: 60,
      display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 12px", overflowY: "auto",
    }}>
      <article onClick={(e) => e.stopPropagation()} style={{
        background: T.blanco, borderRadius: 14, maxWidth: 620, width: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,.25)", padding: "18px 20px 20px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 720 }}>Mis últimos cambios</h3>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{
            width: 34, height: 34, borderRadius: "50%", border: "none", background: T.papelHondo, fontSize: 17, cursor: "pointer", fontWeight: 700,
          }}>×</button>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 13.5, color: T.tintaSuave, lineHeight: 1.5 }}>
          «Deshacer» vuelve una edición a como estaba justo antes de ese cambio. Las creaciones no se
          deshacen (aquí nada se borra: una ficha se oculta, una adopción se quita desde su ficha).
        </p>
        {!cambios && <p style={{ margin: 0, color: T.tintaSuave, fontSize: 14 }}>Cargando…</p>}
        {cambios && cambios.length === 0 && <p style={{ margin: 0, color: T.tintaSuave, fontSize: 14 }}>Todavía no has hecho cambios.</p>}
        <div style={{ display: "grid", gap: 8 }}>
          {(cambios || []).map((h) => {
            const c = cambiosDeshacibles(h);
            const hecho = deshechos.includes(h.id);
            return (
              <div key={h.id} style={{ border: `1px solid ${T.linea}`, borderRadius: 9, padding: "9px 12px", display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                <div style={{ fontSize: 13.5, lineHeight: 1.45 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11.5, color: T.tintaSuave }}>{cuando(h.hecho_en)}</span>
                  {" — "}
                  {h.operacion === "INSERT" ? "creaste" : "editaste"} {TABLA_NOMBRE[h.tabla] || h.tabla}
                  {nombreDe(h) && <strong style={{ fontWeight: 640 }}> {nombreDe(h)}</strong>}
                  {c && <span style={{ display: "block", fontSize: 12.5, color: T.tintaSuave }}>Cambió: {Object.keys(c).join(", ")}</span>}
                </div>
                {c && !hecho && (
                  <button type="button" style={botonSecundario(T.tinta)}
                    onClick={async () => { if (await onDeshacer(h, c)) setDeshechos((p) => [...p, h.id]); }}>
                    Deshacer
                  </button>
                )}
                {hecho && <span style={{ fontSize: 12.5, color: T.verde, fontWeight: 620 }}>Deshecho ✓</span>}
              </div>
            );
          })}
        </div>
      </article>
    </div>
  );
}

/* ------------------------------ PIEZAS ----------------------------- */

function Opcion({ activo, onClick, children, muestra }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 13px",
        borderRadius: 9, border: `1.5px solid ${activo ? T.verde : T.linea}`,
        background: activo ? T.verdeClaro : T.blanco, color: activo ? T.verde : T.tinta,
        fontWeight: activo ? 650 : 500, fontSize: 14.5, lineHeight: 1.2,
        cursor: "pointer", textAlign: "left", minHeight: 44,
      }}
    >
      {muestra && (
        <span style={{ width: 15, height: 15, borderRadius: 4, flexShrink: 0, background: muestra, border: "1px solid rgba(0,0,0,.18)" }} />
      )}
      <span>{children}</span>
    </button>
  );
}

function Campo({ numero, titulo, ayuda, children, opcional }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 3, flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONO, fontSize: 11.5, color: T.tintaSuave }}>{numero}</span>
        <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 680, letterSpacing: "-.01em" }}>{titulo}</h3>
        {opcional && <span style={{ fontSize: 12, color: T.tintaSuave }}>opcional</span>}
      </div>
      {ayuda && <p style={{ margin: "0 0 10px 25px", fontSize: 13.5, color: T.tintaSuave, lineHeight: 1.45 }}>{ayuda}</p>}
      <div style={{ marginLeft: 25, display: "flex", flexWrap: "wrap", gap: 8 }}>{children}</div>
    </div>
  );
}

function Sello({ valor }) {
  const tono = valor >= 70 ? T.verde : valor >= 45 ? T.ambar : T.tintaSuave;
  return (
    <div style={{
      width: 62, height: 62, borderRadius: "50%", border: `2.5px solid ${tono}`, color: tono,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      transform: "rotate(-9deg)", flexShrink: 0, fontFamily: MONO, lineHeight: 1,
    }}>
      <span style={{ fontSize: 19, fontWeight: 700 }}>{valor}%</span>
      <span style={{ fontSize: 7.5, letterSpacing: ".14em", marginTop: 3 }}>PARECIDO</span>
    </div>
  );
}

function Ficha({ r, resultado, nombres, voluntario, adopcion, onAdopcion, onQuitarAdopcion, onReencontrar, onAprobar, onOcultar, onMostrar, onVer }) {
  const reencontrado = r.estado === "reencontrado";
  const oculta = r.estado === "oculto";
  const [formAdopcion, setFormAdopcion] = useState(false);
  const senas = r.senas || [];
  // Control de imagenes: hasta que un voluntario apruebe la ficha, la foto
  // se muestra borrosa al publico (quien quiera la destapa tocandola). Asi
  // una imagen indebida no queda al aire sin que nadie la haya visto.
  const [fotoDestapada, setFotoDestapada] = useState(false);
  const fotoBorrosa = !r.verificado && !voluntario && !fotoDestapada;
  return (
    <article style={{
      background: T.blanco, border: `1px solid ${T.linea}`,
      borderLeft: `4px solid ${reencontrado ? T.verde : T.ambar}`,
      borderRadius: 12, overflow: "hidden", opacity: reencontrado ? 0.72 : 1,
    }}>
      <div style={{ display: "flex" }}>
        <div style={{ width: 116, flexShrink: 0, borderRight: `1px solid ${T.linea}`, cursor: onVer ? "pointer" : "default" }}
          onClick={() => onVer && onVer(r)} title="Ver ficha completa">
          {r.foto_thumb_url ? (
            <div style={{ position: "relative", overflow: "hidden" }}>
              <img src={r.foto_thumb_url} alt="" loading="lazy"
                style={{
                  width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block",
                  filter: fotoBorrosa ? "blur(14px)" : "none", transform: fotoBorrosa ? "scale(1.15)" : "none",
                }} />
              {fotoBorrosa && (
                <button type="button" onClick={() => setFotoDestapada(true)} title="La foto aún no la revisa un voluntario. Toca para verla." style={{
                  position: "absolute", inset: 0, background: "rgba(27,32,41,.35)", border: "none",
                  color: T.blanco, cursor: "pointer", fontSize: 11, fontWeight: 620, lineHeight: 1.3,
                  padding: 6, fontFamily: FUENTE,
                }}>Foto sin revisar<br />toca para ver</button>
              )}
            </div>
          ) : (
            <div style={{
              width: "100%", aspectRatio: "1/1", background: T.papelHondo, display: "flex",
              alignItems: "center", justifyContent: "center", color: "#B9B2A6",
              fontSize: 11, fontFamily: MONO,
            }}>SIN FOTO</div>
          )}
        </div>

        <div style={{ flex: 1, padding: "12px 14px", minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: MONO, fontSize: 11, color: T.tintaSuave }}>
                {r.codigo}
                {oculta && (
                  <span style={{ marginLeft: 8, color: T.rojo }}>OCULTA</span>
                )}
                {!r.verificado && (
                  <span style={{ marginLeft: 8, color: T.ambar }}>SIN VERIFICAR</span>
                )}
                {adopcion && !reencontrado && !oculta && (
                  <span style={{ marginLeft: 8, color: T.violeta }}>EN ADOPCIÓN</span>
                )}
              </div>
              <h4 style={{ margin: "2px 0 0", fontSize: 17, fontWeight: 700, letterSpacing: "-.015em" }}>
                {r.especie} {r.tamano?.toLowerCase()}, {r.color?.toLowerCase()}
                {r.raza && !RAZA_INDEFINIDA.includes(r.raza) ? ` · ${r.raza}` : ""}
              </h4>
              <div style={{ fontSize: 13.5, color: T.tintaSuave, marginTop: 3 }}>
                {r.sexo !== "No sé" ? r.sexo : "Sexo sin confirmar"} · {r.edad} · pelo {r.pelo?.toLowerCase()}
                {r.collar_color ? ` · collar ${r.collar_color.toLowerCase()}` : ""}
              </div>
            </div>
            {resultado && <Sello valor={resultado.valor} />}
          </div>

          <div style={{ marginTop: 9, fontSize: 13.5, lineHeight: 1.5 }}>
            <strong style={{ fontWeight: 620 }}>Está en:</strong> {r.custodio}
            {r.lugar ? ` — ${r.lugar}` : ""} · {r.barrio}, {r.municipio}
            <br />
            <strong style={{ fontWeight: 620 }}>Recogido el:</strong> {r.fecha_hallazgo}
          </div>

          {senas.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 9 }}>
              {senas.map((s) => (
                <span key={s} style={{
                  fontSize: 12, padding: "3px 8px", borderRadius: 20,
                  background: T.ambarClaro, color: "#8A5A12", fontWeight: 560,
                }}>{s}</span>
              ))}
              {r.senas_donde && <span style={{ fontSize: 12.5, alignSelf: "center", color: T.tintaSuave }}>{r.senas_donde}</span>}
            </div>
          )}

          {r.nota && (
            <p style={{ margin: "9px 0 0", fontSize: 13.5, fontStyle: "italic", lineHeight: 1.5 }}>
              “{r.nota}”
            </p>
          )}

          {r.fuente_url && /^https?:\/\//i.test(r.fuente_url) && (
            <p style={{ margin: "8px 0 0", fontSize: 13 }}>
              <a href={r.fuente_url} target="_blank" rel="noreferrer noopener" style={{ color: T.tintaSuave }}>
                Ver publicación original ↗
              </a>
            </p>
          )}

          {resultado?.corroborados?.length > 0 && (
            <div style={{ marginTop: 11, padding: "9px 11px", background: T.verdeClaro, borderRadius: 9 }}>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".1em", color: T.verde, marginBottom: 5 }}>
                LO QUE TÚ DIJISTE Y AQUÍ APARECE
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {resultado.corroborados.map((c) => (
                  <span key={c} style={{
                    fontSize: 12.5, padding: "3px 9px", borderRadius: 20,
                    background: T.blanco, color: T.verde, fontWeight: 620,
                  }}>{c}</span>
                ))}
              </div>
            </div>
          )}

          {resultado?.sinConfirmar?.length > 0 && (
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: T.tintaSuave, lineHeight: 1.45 }}>
              Sin confirmar aquí: {resultado.sinConfirmar.join(", ")}. Puede que el voluntario no lo
              haya notado — pregúntalo.
            </p>
          )}

          {resultado?.difieren?.length > 0 && (
            <p style={{ margin: "7px 0 0", fontSize: 12.5, color: T.tintaSuave }}>
              No coincide en: {resultado.difieren.join(", ")}
            </p>
          )}

          {nombres && !reencontrado && (
            <div style={{
              marginTop: 11, padding: "9px 11px", background: T.violetaClaro,
              borderRadius: 9, fontSize: 13, lineHeight: 1.45, color: T.violeta,
            }}>
              <strong style={{ fontWeight: 660 }}>Para confirmar:</strong> pide que lo llamen{" "}
              <strong>{nombres}</strong> y te cuenten si reacciona.
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center" }}>
            {onVer && (
              <button type="button" onClick={() => onVer(r)} style={botonSecundario(T.tinta)}>
                Ver ficha
              </button>
            )}
            {reencontrado ? (
              <span style={{
                fontFamily: MONO, fontSize: 11.5, letterSpacing: ".1em", color: T.verde,
                border: `1.5px solid ${T.verde}`, padding: "5px 10px", borderRadius: 6,
              }}>REENCONTRADO</span>
            ) : (
              <>
                <a
                  href={enlaceContacto(r.contacto_medio, r.contacto_telefono)}
                  target="_blank" rel="noreferrer"
                  style={{
                    background: T.verde, color: T.blanco, textDecoration: "none",
                    padding: "9px 14px", borderRadius: 8, fontSize: 14, fontWeight: 640,
                  }}
                >
                  {r.contacto_nombre ? `Escribir a ${r.contacto_nombre}` : "Escribir"} por {r.contacto_medio || "WhatsApp"}
                </a>
                {r.lugar_mapa && (
                  <a href={r.lugar_mapa} target="_blank" rel="noreferrer" style={{
                    background: "transparent", border: `1.5px solid ${T.verde}`, color: T.verde,
                    textDecoration: "none", padding: "9px 13px", borderRadius: 8, fontSize: 13.5, fontWeight: 600,
                  }}>Cómo llegar</a>
                )}
                <button type="button" onClick={() => compartirFicha(r)} style={botonSecundario(T.verde)}>
                  Compartir
                </button>
                {voluntario && oculta && (
                  <button type="button" onClick={() => onMostrar(r)} style={botonSecundario(T.verde)}>
                    Volver a mostrar
                  </button>
                )}
                {voluntario && !oculta && (
                  <>
                    {!r.verificado && (
                      <button type="button" onClick={() => onAprobar(r)} style={botonSecundario(T.verde)}>
                        Aprobar ficha
                      </button>
                    )}
                    <button type="button" onClick={() => onReencontrar(r)} style={botonSecundario(T.tintaSuave)}>
                      Marcar como reencontrado
                    </button>
                    <button type="button" onClick={() => onOcultar(r)} style={botonSecundario(T.tintaSuave)}>
                      Ocultar
                    </button>
                    {onQuitarAdopcion && adopcion && (
                      <button type="button" onClick={() => onQuitarAdopcion(r)} style={botonSecundario(T.tintaSuave)}>
                        Quitar de adopción
                      </button>
                    )}
                    {onAdopcion && !adopcion && (
                      <button type="button" onClick={() => setFormAdopcion(!formAdopcion)} style={botonSecundario(T.violeta)}>
                        Dar en adopción…
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
          {voluntario && !oculta && !reencontrado && !adopcion && formAdopcion && (
            <FormAdopcion onGuardar={async (datos) => { await onAdopcion(r, datos); setFormAdopcion(false); }}
              onCancelar={() => setFormAdopcion(false)} />
          )}
        </div>
      </div>
    </article>
  );
}

// Panel de uso para voluntarios: cuanto entra, cuanto se busca, que hay
// pendiente. Las busquedas solo las devuelve la base a voluntarios (RLS).
// Refugios en el panel de voluntarios: la lista con cuantas fichas tiene
// cada uno, agregar y editar, y las fichas cuyo sitio quedo escrito a mano
// para asignarlas a un refugio (o crear uno con ese nombre).
function Refugios({ refugios, registros, voluntario, onGuardar, onAsignar, acciones }) {
  const [editando, setEditando] = useState(null);   // null = cerrado; {} = nuevo; {id,...} = editar
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [verSueltas, setVerSueltas] = useState(false);
  const setE = (k, v) => setEditando((p) => ({ ...p, [k]: v }));

  const enResguardo = registros.filter((r) => r.estado === "resguardo");
  const cuenta = (id) => enResguardo.filter((r) => r.refugio_id === id).length;
  // Fichas en resguardo con sitio escrito a mano y sin refugio asignado.
  const sueltas = enResguardo.filter((r) => !r.refugio_id && (r.lugar || "").trim());

  async function guardar() {
    setGuardando(true);
    const e = await onGuardar(editando, editando.id);
    setGuardando(false);
    if (e) { setError(e); return; }
    setError(""); setEditando(null);
  }
  const nuevoDesde = (r) => setEditando({
    nombre: r.lugar.trim(), tipo: r.custodio || "Refugio", departamento: r.departamento, municipio: r.municipio,
    barrio: r.barrio, lugar_mapa: r.lugar_mapa, contacto_telefono: r.contacto_telefono, contacto_medio: r.contacto_medio, activo: true,
  });

  return (
    <div style={{ border: `1px solid ${T.linea}`, borderRadius: 11, background: T.blanco, padding: "14px 16px", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: ".12em", color: T.tintaSuave }}>REFUGIOS · {refugios.length}</div>
        <button type="button" onClick={() => { setEditando({ tipo: "Refugio", contacto_medio: "WhatsApp", activo: true, departamento: "Risaralda" }); setError(""); }}
          style={botonSecundario(T.verde)}>+ Agregar refugio</button>
      </div>
      <p style={{ margin: "-6px 0 0", fontSize: 13.5, color: T.tintaSuave, lineHeight: 1.5 }}>
        Al registrar una mascota se elige el refugio y la ficha se llena sola con lo que esté aquí. Un refugio que cierra se marca inactivo; nada se borra.
      </p>

      {refugios.length === 0 && <p style={{ margin: 0, color: T.tintaSuave, fontSize: 14 }}>Todavía no hay refugios. Agrega el primero.</p>}
      <div style={{ display: "grid", gap: 8 }}>
        {refugios.map((x) => (
          <div key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", border: `1px solid ${T.linea}`, borderRadius: 10, opacity: x.activo ? 1 : 0.55 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 640, fontSize: 15 }}>{x.nombre} {!x.activo && <span style={{ fontFamily: MONO, fontSize: 11, color: T.tintaSuave }}>INACTIVO</span>}</div>
              <div style={{ fontSize: 13, color: T.tintaSuave }}>
                {[x.tipo, x.municipio, x.barrio].filter(Boolean).join(" · ")}
                {x.contacto_telefono ? ` · ${x.contacto_medio || "WhatsApp"}: ${x.contacto_telefono}` : " · sin contacto"}
                {x.lugar_mapa ? " · con mapa" : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, color: T.tintaSuave }}>{cuenta(x.id)} en resguardo</span>
              <button type="button" onClick={() => { setEditando({ ...x }); setError(""); }} style={botonSecundario(T.tinta)}>Editar</button>
            </div>
          </div>
        ))}
      </div>

      {editando && (
        <div style={{ border: `1.5px solid ${T.verde}`, borderRadius: 12, padding: "16px 18px", display: "grid", gap: 12 }}>
          <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: ".12em", color: T.verde }}>{editando.id ? "EDITAR REFUGIO" : "NUEVO REFUGIO"}</div>
          <label style={{ fontSize: 13.5 }}>Nombre
            <input style={entradaTexto} value={editando.nombre || ""} onChange={(e) => setE("nombre", e.target.value)} placeholder="Ej.: Albergue Gestora Social de Risaralda" />
          </label>
          <div>
            <div style={{ fontSize: 13.5, marginBottom: 6 }}>Tipo</div>
            {CUSTODIO.map((o) => <Opcion key={o} activo={editando.tipo === o} onClick={() => setE("tipo", o)}>{o}</Opcion>)}
          </div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <label style={{ fontSize: 13.5 }}>Departamento
              <select style={entradaTexto} value={editando.departamento || ""} onChange={(e) => { setE("departamento", e.target.value); setE("municipio", ""); }}>
                <option value="">—</option>
                {Object.keys(MUNICIPIOS).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 13.5 }}>Municipio
              <select style={entradaTexto} value={editando.municipio || ""} onChange={(e) => setE("municipio", e.target.value)}>
                <option value="">—</option>
                {(MUNICIPIOS[editando.departamento] || []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 13.5 }}>Barrio
              <input style={entradaTexto} value={editando.barrio || ""} onChange={(e) => setE("barrio", e.target.value)} />
            </label>
          </div>
          <label style={{ fontSize: 13.5 }}>Dirección (se muestra en la ficha)
            <input style={entradaTexto} value={editando.direccion || ""} onChange={(e) => setE("direccion", e.target.value)} placeholder="Ej.: Av. Las Américas, Calle 95 lote 1" />
          </label>
          <label style={{ fontSize: 13.5 }}>Enlace de Google Maps (cómo llegar)
            <input style={entradaTexto} inputMode="url" value={editando.lugar_mapa || ""} onChange={(e) => setE("lugar_mapa", e.target.value)} placeholder="https://maps.app.goo.gl/…" />
          </label>
          <div>
            <div style={{ fontSize: 13.5, marginBottom: 6 }}>Contacto público (el que ve el tutor en las fichas de este refugio)</div>
            <CampoContacto medio={editando.contacto_medio || "WhatsApp"} valor={editando.contacto_telefono}
              onMedio={(m) => setE("contacto_medio", m)} onValor={(v) => setE("contacto_telefono", v)} />
          </div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <label style={{ fontSize: 13.5 }}>Responsable (solo voluntarios lo ven aquí)
              <input style={entradaTexto} value={editando.responsable || ""} onChange={(e) => setE("responsable", e.target.value)} />
            </label>
            <label style={{ fontSize: 13.5 }}>Notas
              <input style={entradaTexto} value={editando.notas || ""} onChange={(e) => setE("notas", e.target.value)} maxLength={500} />
            </label>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Opcion activo={editando.activo !== false} onClick={() => setE("activo", true)}>Activo</Opcion>
            <Opcion activo={editando.activo === false} onClick={() => setE("activo", false)}>Inactivo (cerró)</Opcion>
          </div>
          {error && <p style={{ margin: 0, color: T.rojo, fontSize: 14 }}>{error}</p>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={guardar} disabled={guardando} style={{ background: T.verde, color: T.blanco, border: "none", borderRadius: 9, padding: "10px 16px", fontSize: 14.5, fontWeight: 640, cursor: "pointer" }}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" onClick={() => setEditando(null)} style={botonSecundario(T.tinta)}>Cancelar</button>
          </div>
        </div>
      )}

      {sueltas.length > 0 && (
        <div style={{ borderTop: `1px solid ${T.linea}`, paddingTop: 12 }}>
          <button type="button" onClick={() => setVerSueltas((v) => !v)} style={{ ...botonSecundario(T.tinta), width: "100%", textAlign: "left" }}>
            {verSueltas ? "▲" : "▼"} {sueltas.length} ficha{sueltas.length > 1 ? "s" : ""} en resguardo con el sitio escrito a mano (sin refugio asignado)
          </button>
          {verSueltas && (
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {sueltas.map((r) => (
                <div key={r.id} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "8px 10px", border: `1px solid ${T.linea}`, borderRadius: 10, fontSize: 13.5 }}>
                  <span style={{ fontFamily: MONO, fontSize: 12 }}>{r.codigo}</span>
                  <span style={{ flex: 1, minWidth: 160 }}>«{r.lugar}»{r.municipio ? ` · ${r.municipio}` : ""}</span>
                  <select style={{ ...entradaTexto, maxWidth: 240, padding: "8px 10px", minHeight: 38 }} defaultValue=""
                    onChange={(e) => { if (e.target.value) onAsignar(r, e.target.value); }}>
                    <option value="">Asignar a…</option>
                    {refugios.filter((x) => x.activo).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                  </select>
                  <button type="button" onClick={() => { nuevoDesde(r); setError(""); window.scrollTo({ top: window.scrollY, behavior: "smooth" }); }} style={botonSecundario(T.verde)}>Crear refugio con este nombre</button>
                  <button type="button" onClick={() => acciones.onVer(r)} style={botonSecundario(T.tinta)}>Ver ficha</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Panel({ registros, voluntario, acciones, refugios, adopcionDe, onGuardarRefugio, onAsignarRefugio }) {
  const [busquedas, setBusquedas] = useState(null);
  // Que tarjeta esta desplegada (su lista se muestra debajo de las tarjetas).
  const [abierta, setAbierta] = useState(null);
  useEffect(() => {
    supabase.from("busquedas").select("*")
      .order("creado_en", { ascending: false }).limit(2000)
      .then(({ data }) => setBusquedas(data || []));
  }, []);
  async function cambiarEstadoBusqueda(b, estado) {
    const { error } = await supabase.from("busquedas").update({ estado }).eq("id", b.id);
    if (error) { alert("No se pudo cambiar el estado de la búsqueda."); return; }
    setBusquedas((p) => p.map((x) => (x.id === b.id ? { ...x, estado } : x)));
  }

  const hoy = new Date();
  const dias = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(hoy); d.setDate(hoy.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });
  const porDia = (lista) => {
    const c = Object.fromEntries(dias.map((d) => [d, 0]));
    for (const x of lista || []) { const k = (x.creado_en || "").slice(0, 10); if (k in c) c[k]++; }
    return dias.map((d) => c[d]);
  };
  const fichasDia = porDia(registros);
  const busqDia = porDia(busquedas);
  const desde = (h) => Date.now() - h * 3600000;
  const n = (v) => <strong style={{ fontWeight: 700, fontSize: 24, display: "block", lineHeight: 1.1 }}>{v}</strong>;

  const Barras = ({ datos, color, titulo }) => {
    const max = Math.max(1, ...datos);
    return (
      <div>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".1em", color: T.tintaSuave, marginBottom: 6 }}>{titulo}</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 70 }}>
          {datos.map((v, i) => (
            <div key={i} title={`${dias[i]}: ${v}`} style={{ flex: 1, background: color, opacity: v ? 1 : 0.18, height: `${Math.max(4, (v / max) * 100)}%`, borderRadius: 3 }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 10.5, color: T.tintaSuave, marginTop: 4 }}>
          <span>{dias[0].slice(5)}</span><span>hoy · total 14 días: {datos.reduce((a, b) => a + b, 0)}</span>
        </div>
      </div>
    );
  };

  const tarjeta = { border: `1px solid ${T.linea}`, borderRadius: 11, background: T.blanco, padding: "12px 14px", fontSize: 13, color: T.tintaSuave };

  // Cada tarjeta: que cuenta y que lista despliega al tocarla.
  const B = busquedas || [];
  const TARJETAS = [
    { id: "resguardo", texto: "en resguardo", fichas: registros.filter((r) => r.estado === "resguardo") },
    { id: "sin_verificar", texto: "sin verificar", borde: T.ambar, fichas: registros.filter((r) => r.estado === "resguardo" && !r.verificado) },
    { id: "reencontrados", texto: "reencontrados", fichas: registros.filter((r) => r.estado === "reencontrado") },
    { id: "ocultas", texto: "ocultas", fichas: registros.filter((r) => r.estado === "oculto") },
    { id: "en_adopcion", texto: "en adopción", borde: T.violeta, fichas: registros.filter((r) => r.estado === "resguardo" && adopcionDe(r.id)) },
    { id: "fichas_24h", texto: "fichas últimas 24 h", fichas: registros.filter((r) => new Date(r.creado_en) > desde(24)) },
    { id: "busq_abiertas", texto: "búsquedas abiertas", borde: T.verde, busquedas: B.filter((b) => !b.estado || b.estado === "abierta") },
    { id: "busq_24h", texto: "búsquedas últimas 24 h", busquedas: B.filter((b) => new Date(b.creado_en) > desde(24)) },
    { id: "busq_contacto", texto: "abiertas con contacto para avisar", borde: T.verde, busquedas: B.filter((b) => b.contacto_telefono && (!b.estado || b.estado === "abierta")) },
    { id: "busq_resueltas", texto: "búsquedas resueltas u ocultas", busquedas: B.filter((b) => b.estado && b.estado !== "abierta") },
    { id: "sin_foto", texto: "fichas sin foto", fichas: registros.filter((r) => !r.foto_thumb_url) },
  ];
  const activa = TARJETAS.find((t) => t.id === abierta);
  const enResguardo = registros.filter((r) => r.estado === "resguardo");

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {TARJETAS.map((t) => {
          const total = t.busquedas ? (busquedas ? t.busquedas.length : "…") : t.fichas.length;
          const activo = abierta === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setAbierta(activo ? null : t.id)} style={{
              ...tarjeta, textAlign: "left", cursor: "pointer", fontFamily: FUENTE,
              borderColor: activo ? T.tinta : (t.borde || T.linea), borderWidth: activo ? 2 : 1,
              background: activo ? T.papelHondo : T.blanco,
            }}>
              {n(total)}{t.texto}
              <span style={{ display: "block", fontSize: 11, marginTop: 4, color: T.tintaSuave }}>{activo ? "▲ ocultar" : "▼ ver lista"}</span>
            </button>
          );
        })}
      </div>

      {activa && (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: ".12em", color: T.tintaSuave }}>
            {String(activa.texto).toUpperCase()} · {activa.busquedas ? activa.busquedas.length : activa.fichas.length}
          </div>
          {activa.fichas && activa.fichas.length === 0 && <p style={{ margin: 0, color: T.tintaSuave, fontSize: 14 }}>Nada por aquí.</p>}
          {activa.fichas && activa.fichas.map((r) => (
            <Ficha key={r.id} r={r} resultado={null} nombres={null} voluntario={voluntario} adopcion={adopcionDe(r.id)} {...acciones} />
          ))}
          {activa.busquedas && activa.busquedas.length === 0 && <p style={{ margin: 0, color: T.tintaSuave, fontSize: 14 }}>Nada por aquí.</p>}
          {activa.busquedas && activa.busquedas.map((b) => (
            <Busqueda key={b.id} b={b} enResguardo={enResguardo} voluntario={voluntario} acciones={acciones} onEstado={cambiarEstadoBusqueda} />
          ))}
        </div>
      )}
      <Refugios refugios={refugios} registros={registros} voluntario={voluntario}
        onGuardar={onGuardarRefugio} onAsignar={onAsignarRefugio} acciones={acciones} />

      <div style={{ ...tarjeta, display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <Barras datos={fichasDia} color={T.ambar} titulo="FICHAS NUEVAS POR DÍA" />
        <Barras datos={busqDia} color={T.verde} titulo="BÚSQUEDAS POR DÍA" />
      </div>
      <p style={{ margin: 0, fontSize: 13, color: T.tintaSuave, lineHeight: 1.5 }}>
        Las visitas y las peticiones al servidor no se ven aquí: están en el panel de Cloudflare
        (Workers & Pages → huellas-a-casa → Metrics) y en el vigía diario del repositorio (Actions → Vigía).
      </p>
    </section>
  );
}

// Una busqueda guardada, tal como la dejo el tutor, con su contacto y las
// fichas en resguardo que hoy se le parecen (cruce inverso). Solo voluntarios.
// Estado del caso: el tutor consulta su busqueda con el numero de registro.
// Pasa por la funcion consultar_busqueda de la base, que devuelve solo esa
// busqueda, por codigo exacto y SIN el contacto. Se puede abrir con el
// enlace .../#BUS-7K3MQ.
function EstadoCaso({ codigoInicial, registros, voluntario, acciones, onBuscarDeNuevo }) {
  const [codigo, setCodigo] = useState(codigoInicial || "");
  const [caso, setCaso] = useState(null);      // undefined = no existe
  const [cargando, setCargando] = useState(false);
  const [cerrando, setCerrando] = useState(false);

  async function consultar(c) {
    const limpio = (c || "").trim().toUpperCase().replace(/^BUS[\s-]*/, "BUS-");
    if (!limpio) return;
    setCargando(true);
    const { data } = await supabase.rpc("consultar_busqueda", { p_codigo: limpio });
    setCaso(data && data[0] ? data[0] : undefined);
    setCargando(false);
    if (data && data[0]) history.replaceState(null, "", `/#${data[0].codigo}`);
  }
  useEffect(() => { if (codigoInicial) consultar(codigoInicial); }, [codigoInicial]);

  async function cerrar() {
    if (!confirm("¿Confirmas que tu mascota ya apareció? La búsqueda se marca como resuelta.")) return;
    setCerrando(true);
    await supabase.rpc("cerrar_busqueda", { p_codigo: caso.codigo });
    setCaso((c) => ({ ...c, estado: "resuelta" }));
    setCerrando(false);
  }

  const enResguardo = registros.filter((r) => r.estado === "resguardo");
  const parecidas = useMemo(() => (caso ? buscarCoincidencias(caso, enResguardo) : []), [caso, enResguardo]);
  const fecha = caso && new Date(caso.creado_en).toLocaleString("es-CO", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
  const rasgos = caso && [caso.especie, caso.raza && !RAZA_INDEFINIDA.includes(caso.raza) ? caso.raza : null, caso.tamano, caso.color,
    caso.pelo ? `pelo ${caso.pelo.toLowerCase()}` : null, caso.sexo && caso.sexo !== "No sé" ? caso.sexo : null, caso.edad,
    caso.collar_color ? `collar ${caso.collar_color.toLowerCase()}` : null].filter(Boolean).join(" · ");
  const abierta = caso && (!caso.estado || caso.estado === "abierta");

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div style={{ border: `1px solid ${T.linea}`, borderRadius: 13, background: T.blanco, padding: "20px 22px" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 720, letterSpacing: "-.02em" }}>¿Cómo va mi búsqueda?</h2>
        <p style={{ margin: "6px 0 12px", fontSize: 14.5, color: T.tintaSuave, lineHeight: 1.5 }}>
          Escribe el número de registro que te dimos al buscar (empieza por BUS-).
        </p>
        <form onSubmit={(e) => { e.preventDefault(); consultar(codigo); }} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="BUS-7K3MQ" autoCapitalize="characters"
            style={{ ...entradaTexto, maxWidth: 220, fontFamily: MONO, letterSpacing: ".06em" }} />
          <button type="submit" disabled={cargando} style={{
            background: T.verde, color: T.blanco, border: "none", borderRadius: 9, padding: "11px 18px",
            fontSize: 15, fontWeight: 660, cursor: "pointer",
          }}>{cargando ? "Buscando…" : "Consultar"}</button>
        </form>
        {caso === undefined && (
          <p style={{ margin: "12px 0 0", fontSize: 14, color: T.rojo }}>
            No encontramos ese número. Revisa que esté bien escrito (letras y números, sin ceros ni oes).
            Si no lo tienes, puedes <a href="#" onClick={(e) => { e.preventDefault(); onBuscarDeNuevo(); }} style={{ color: T.verde }}>hacer la búsqueda de nuevo</a>.
          </p>
        )}
      </div>

      {caso && (
        <>
          <article style={{ background: T.blanco, border: `1px solid ${T.linea}`, borderLeft: `4px solid ${abierta ? T.ambar : T.verde}`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "baseline" }}>
              <div style={{ fontFamily: MONO, fontSize: 12, color: T.tintaSuave }}>{caso.codigo} · registrada el {fecha}</div>
              <span style={{
                fontFamily: MONO, fontSize: 11.5, letterSpacing: ".1em", padding: "4px 9px", borderRadius: 6,
                border: `1.5px solid ${abierta ? T.ambar : T.verde}`, color: abierta ? "#8A5A12" : T.verde,
              }}>{abierta ? "ABIERTA — SEGUIMOS BUSCANDO" : caso.estado === "resuelta" ? "RESUELTA" : "CERRADA"}</span>
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 6, alignItems: "flex-start" }}>
              {caso.foto_thumb_url && (
                <a href={caso.foto_url || caso.foto_thumb_url} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                  <img src={caso.foto_thumb_url} alt="" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 9, display: "block", border: `1px solid ${T.linea}` }} />
                </a>
              )}
              <div style={{ fontSize: 16.5, fontWeight: 680 }}>
                {caso.nombres ? `${caso.nombres} — ` : ""}{rasgos || "Sin rasgos marcados"}
              </div>
            </div>
            <div style={{ fontSize: 13.5, color: T.tintaSuave, marginTop: 3 }}>
              {[caso.barrio, caso.municipio, caso.departamento].filter(Boolean).join(", ") || "Sin zona"}
              {(caso.senas || []).length ? ` · ${caso.senas.join(", ")}` : ""}{caso.senas_donde ? ` (${caso.senas_donde})` : ""}
            </div>
            {caso.nota && <p style={{ margin: "8px 0 0", fontSize: 13.5, fontStyle: "italic" }}>“{caso.nota}”</p>}
            <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.55 }}>
              {caso.tiene_contacto
                ? <>Dejaste contacto por {caso.contacto_medio || "WhatsApp"}: si un voluntario ve algo parecido, te escribe por ahí. </>
                : <>No dejaste contacto, así que nadie puede avisarte: vuelve a esta página de vez en cuando, o{" "}
                    <a href="#" onClick={(e) => { e.preventDefault(); onBuscarDeNuevo(); }} style={{ color: T.verde }}>haz la búsqueda de nuevo dejando tu WhatsApp</a>. </>}
              El cruce con los animales que llegan lo hacen los voluntarios a mano por ahora.
            </p>
            {abierta && (
              <div style={{ marginTop: 12 }}>
                <button type="button" onClick={cerrar} disabled={cerrando} style={botonSecundario(T.verde)}>
                  {cerrando ? "Guardando…" : "Ya apareció — cerrar mi búsqueda"}
                </button>
              </div>
            )}
          </article>

          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700 }}>
              {parecidas.length === 0 ? "Hoy no hay fichas parecidas" : `${parecidas.length} ficha${parecidas.length > 1 ? "s" : ""} parecida${parecidas.length > 1 ? "s" : ""} hoy`}
            </h3>
            <p style={{ margin: "0 0 12px", fontSize: 13.5, color: T.tintaSuave, lineHeight: 1.5 }}>
              Se recalcula cada vez que entras, con los animales que hay en resguardo ahora. El porcentaje sale de
              los datos, no de la foto: mira siempre la imagen.
            </p>
            <div style={{ display: "grid", gap: 14 }}>
              {parecidas.slice(0, 10).map(({ ficha, resultado }) => (
                <Ficha key={ficha.id} r={ficha} resultado={resultado} nombres={caso.nombres} voluntario={voluntario} {...acciones} />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Busqueda({ b, enResguardo, voluntario, acciones, onEstado }) {
  const [verParecidas, setVerParecidas] = useState(false);
  const abierta = !b.estado || b.estado === "abierta";
  const parecidas = useMemo(() => buscarCoincidencias(b, enResguardo).filter((x) => x.resultado.valor >= 55), [b, enResguardo]);
  const rasgos = [b.especie, b.raza && !RAZA_INDEFINIDA.includes(b.raza) ? b.raza : null, b.tamano, b.color, b.pelo ? `pelo ${b.pelo.toLowerCase()}` : null,
    b.sexo && b.sexo !== "No sé" ? b.sexo : null, b.edad, b.orejas ? `orejas ${b.orejas.toLowerCase()}` : null, b.cola ? `cola ${b.cola.toLowerCase()}` : null,
    b.collar_color ? `collar ${b.collar_color.toLowerCase()}` : null].filter(Boolean).join(" · ");
  const fecha = new Date(b.creado_en).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <article style={{ background: T.blanco, border: `1px solid ${T.linea}`, borderLeft: `4px solid ${T.verde}`, borderRadius: 12, padding: "12px 14px", display: "flex", gap: 14 }}>
      {b.foto_thumb_url && (
        <a href={b.foto_url || b.foto_thumb_url} target="_blank" rel="noreferrer" title="Ver la foto grande" style={{ flexShrink: 0 }}>
          <img src={b.foto_thumb_url} alt="" loading="lazy" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 9, display: "block", border: `1px solid ${T.linea}` }} />
        </a>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: T.tintaSuave }}>
          {b.codigo || "BÚSQUEDA"} · {fecha}
          {!abierta && <span style={{ marginLeft: 8, color: b.estado === "resuelta" ? T.verde : T.rojo }}>{b.estado.toUpperCase()}</span>}
        </div>
        {b.nombres && <div style={{ fontSize: 13.5 }}>Responde a <strong>{b.nombres}</strong></div>}
      </div>
      <div style={{ fontSize: 15.5, fontWeight: 660, marginTop: 4 }}>{rasgos || "Sin rasgos marcados"}</div>
      <div style={{ fontSize: 13.5, color: T.tintaSuave, marginTop: 3 }}>
        {[b.barrio, b.municipio, b.departamento].filter(Boolean).join(", ") || "Sin zona"}
        {(b.senas || []).length ? ` · ${b.senas.join(", ")}` : ""}{b.senas_donde ? ` (${b.senas_donde})` : ""}
      </div>
      {b.nota && <p style={{ margin: "8px 0 0", fontSize: 13.5, fontStyle: "italic" }}>“{b.nota}”</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, alignItems: "center" }}>
        {b.contacto_telefono ? (
          <a href={enlaceContacto(b.contacto_medio, b.contacto_telefono)} target="_blank" rel="noreferrer" style={{
            background: T.verde, color: T.blanco, textDecoration: "none", padding: "8px 13px", borderRadius: 8, fontSize: 13.5, fontWeight: 640,
          }}>Avisar por {b.contacto_medio || "WhatsApp"}: {b.contacto_telefono}</a>
        ) : (
          <span style={{ fontSize: 13, color: T.tintaSuave }}>No dejó contacto</span>
        )}
        <button type="button" onClick={() => setVerParecidas((v) => !v)} style={botonSecundario(parecidas.length ? T.verde : T.tintaSuave)}>
          {parecidas.length ? `${parecidas.length} ficha${parecidas.length > 1 ? "s" : ""} parecida${parecidas.length > 1 ? "s" : ""} hoy` : "Nada parecido hoy"}
          {parecidas.length ? (verParecidas ? " ▲" : " ▼") : ""}
        </button>
        {onEstado && abierta && (
          <>
            <button type="button" onClick={() => onEstado(b, "resuelta")} style={botonSecundario(T.tintaSuave)}>Marcar resuelta</button>
            <button type="button" onClick={() => onEstado(b, "oculta")} style={botonSecundario(T.tintaSuave)}>Ocultar</button>
          </>
        )}
        {onEstado && !abierta && (
          <button type="button" onClick={() => onEstado(b, "abierta")} style={botonSecundario(T.tintaSuave)}>Reabrir</button>
        )}
      </div>
      {verParecidas && parecidas.length > 0 && (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {parecidas.slice(0, 5).map(({ ficha, resultado }) => (
            <Ficha key={ficha.id} r={ficha} resultado={resultado} nombres={b.nombres} voluntario={voluntario} {...acciones} />
          ))}
        </div>
      )}
      </div>
    </article>
  );
}

function Bloque({ titulo, children }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: ".12em", color: T.verde, marginBottom: 6 }}>
        {titulo}
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.6, color: T.tinta }}>{children}</div>
    </div>
  );
}

function Aviso() {
  return (
    <div style={{
      border: `1px solid ${T.linea}`, borderRadius: 13, background: T.blanco,
      padding: "24px 24px", display: "grid", gap: 22,
    }} id="aviso">
      <Bloque titulo="QUIÉNES SOMOS">
        Somos voluntarios, refugios y hogares temporales del Eje Cafetero que nos juntamos para que
        la información de las mascotas perdidas y encontradas quede en un solo lugar y no regada en
        publicaciones sueltas. No somos una empresa ni una entidad oficial: es una herramienta
        comunitaria sostenida por gente que dona su tiempo.
      </Bloque>

      <Bloque titulo="CONTACTO">
        Para dudas, correcciones o para vincular tu refugio:
        <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
          <li>WhatsApp:{" "}
            <a href={CONTACTO_WHATSAPP} target="_blank" rel="noreferrer" style={{ color: T.verde, fontWeight: 620 }}>{CONTACTO_CELULAR}</a></li>
          <li>Correo:{" "}
            <a href={`mailto:${CONTACTO_DATOS}`} style={{ color: T.verde, fontWeight: 620 }}>{CONTACTO_DATOS}</a></li>
        </ul>
      </Bloque>

      <Bloque titulo="ESTO ES GRATUITO">
        Buscar, registrar y confirmar un reencuentro no cuesta nada, ni ahora ni después.{" "}
        <strong style={{ fontWeight: 660 }}>Nadie de esta página pide dinero.</strong> Si alguien te
        pide un pago, una recompensa o una «consignación para el transporte» en nombre de Huellas a
        Casa, es un engaño: no lo hagas y avísanos.
      </Bloque>

      <Bloque titulo="LO QUE ESTA PÁGINA NO HACE">
        Aquí solo se junta información. No verificamos la identidad de quien registra un animal ni de
        quien lo reclama, y el porcentaje de parecido sale de las respuestas del formulario, no de la
        foto: puede equivocarse. La entrega es un acuerdo entre quien cuida al animal y quien lo
        reclama; cada refugio decide qué prueba pide antes de entregar. Hacemos lo posible por que los
        datos estén al día, pero no respondemos por errores en las fichas, por entregas equivocadas
        ni por lo que pase fuera de la página. Si ves algo mal, escríbenos y lo corregimos.
      </Bloque>

      <Bloque titulo="CÓDIGO ABIERTO">
        Todo el código de esta página es público y cualquiera puede revisarlo:{" "}
        <a href="https://github.com/LAHoyosC/huellas-a-casa" target="_blank" rel="noreferrer"
          style={{ color: T.verde }}>github.com/LAHoyosC/huellas-a-casa</a>. Ahí también está explicado
        cómo funciona el cruce y dónde se guardan los datos.
      </Bloque>

      <Bloque titulo="TUS DATOS">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li><strong style={{ fontWeight: 660 }}>Qué guardamos:</strong> los rasgos y la foto del
            animal, el municipio y barrio, y un contacto (WhatsApp, correo o Instagram).</li>
          <li><strong style={{ fontWeight: 660 }}>Para qué:</strong> únicamente para reunir animales
            con sus familias. No los usamos para nada más ni se los pasamos a nadie.</li>
          <li><strong style={{ fontWeight: 660 }}>Quién los ve:</strong> el contacto de
            quien cuida un animal <em>se publica</em> en su ficha, para que el tutor pueda escribir.
            El contacto de quien busca a su mascota <em>no se publica</em>: solo lo ven los
            voluntarios, para avisarle si llega algo parecido.</li>
          <li><strong style={{ fontWeight: 660 }}>Cuánto tiempo:</strong> esta es una iniciativa
            temporal, por la emergencia. Cada tres meses revisamos si sigue haciendo falta. Cuando se
            cierre, <em>borramos todo</em> —la base de datos, las fotos y los respaldos— en máximo
            30 días, y la página queda solo con un aviso de que terminó. Mientras tanto, cuando un
            animal vuelve a casa su ficha deja de mostrarse en el listado.</li>
          <li><strong style={{ fontWeight: 660 }}>Tus derechos:</strong> puedes pedir que corrijamos
            o retiremos tus datos cuando quieras escribiendo a{" "}
            <a href={`mailto:${CONTACTO_DATOS}`} style={{ color: T.verde }}>{CONTACTO_DATOS}</a>.
            Tratamos los datos según la Ley 1581 de 2012 de Colombia.</li>
        </ul>
        <p style={{ margin: "10px 0 0", fontSize: 14, color: T.tintaSuave }}>
          Al guardar una ficha o una búsqueda con tu contacto, autorizas este uso.
        </p>
      </Bloque>
    </div>
  );
}

const botonFoto = {
  padding: "12px 16px", borderRadius: 9, border: `1.5px dashed ${T.linea}`,
  background: T.blanco, fontSize: 14.5, fontWeight: 560, cursor: "pointer",
};

// sinCamara: para quien busca a su mascota, que no la tiene al frente; solo
// tiene sentido elegir una foto guardada.
function CargarFoto({ archivo, onArchivo, actual, sinCamara = false }) {
  const refCamara = useRef(null);
  const refCarrete = useRef(null);
  const [vista, setVista] = useState(actual || null);
  const [error, setError] = useState("");

  const elegir = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");
    try {
      const { vistaPrevia } = await comprimir(f);
      setVista(vistaPrevia);
      onArchivo(f);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {vista && (
          <img src={vista} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 9, border: `1px solid ${T.linea}` }} />
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {!sinCamara && (
            <button type="button" onClick={() => refCamara.current?.click()} style={botonFoto}>
              {archivo ? "Tomar otra" : "Tomar foto"}
            </button>
          )}
          <button type="button" onClick={() => refCarrete.current?.click()} style={botonFoto}>
            {archivo ? "Elegir otra" : sinCamara ? "Elegir una foto guardada" : "Elegir del carrete"}
          </button>
        </div>
        {/* Con capture el celular abre la camara; sin capture, la galeria. */}
        <input ref={refCamara} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={elegir} />
        <input ref={refCarrete} type="file" accept="image/*" style={{ display: "none" }} onChange={elegir} />
      </div>
      {error && <p style={{ margin: "8px 0 0", fontSize: 13, color: T.rojo }}>{error}</p>}
    </div>
  );
}

function NotaLibre({ valor, onCambio, numero, titulo, ayuda, placeholder, registro, set }) {
  const detectados = extraerConceptos(valor);
  // Lo que la nota sugiere marcar en las casillas. Se propone, no se marca:
  // la persona confirma con un toque (asi la evidencia queda donde cruza).
  const sugerencias = registro && set ? sugerirDesdeNota(valor, registro) : [];
  const aplicar = (sg) => {
    if (sg.campo === "senas") set("senas", [...(registro.senas || []), sg.valor]);
    else set(sg.campo, sg.valor);
  };
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 3, flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONO, fontSize: 11.5, color: T.tintaSuave }}>{numero}</span>
        <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 680, letterSpacing: "-.01em" }}>{titulo}</h3>
        <span style={{ fontSize: 12, color: T.tintaSuave }}>opcional</span>
      </div>
      <p style={{ margin: "0 0 10px 25px", fontSize: 13.5, color: T.tintaSuave, lineHeight: 1.45 }}>{ayuda}</p>
      <div style={{ marginLeft: 25 }}>
        <textarea
          rows={3} maxLength={180} value={valor || ""}
          onChange={(e) => onCambio(e.target.value)} placeholder={placeholder}
          style={{ ...entradaTexto, resize: "vertical", lineHeight: 1.5 }}
        />
        <div style={{ fontSize: 12, color: T.tintaSuave, marginTop: 4, fontFamily: MONO }}>
          {(valor || "").length}/180
        </div>
        {sugerencias.length > 0 && (
          <div style={{ marginTop: 10, padding: "10px 12px", background: T.verdeClaro, borderRadius: 9, maxWidth: 420 }}>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".1em", color: T.verde, marginBottom: 6 }}>
              POR LO QUE ESCRIBISTE, ¿MARCAMOS ESTO?
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {sugerencias.map((sg) => (
                <button key={`${sg.campo}-${sg.valor}`} type="button" onClick={() => aplicar(sg)} style={{
                  fontSize: 12.5, padding: "5px 10px", borderRadius: 20, cursor: "pointer",
                  background: T.blanco, color: T.verde, fontWeight: 620, border: `1.5px solid ${T.verde}`,
                }}>+ {sg.texto}</button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: T.tintaSuave, marginTop: 6 }}>
              Toca para marcarlo arriba. Si no es así, ignóralo.
            </div>
          </div>
        )}
        {detectados.length > 0 && (
          <div style={{ marginTop: 10, padding: "10px 12px", background: T.ambarClaro, borderRadius: 9, maxWidth: 420 }}>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".1em", color: "#8A5A12", marginBottom: 6 }}>
              ENTENDÍ ESTO
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {detectados.map((c) => (
                <span key={c} style={{
                  fontSize: 12.5, padding: "3px 9px", borderRadius: 20,
                  background: T.blanco, color: "#8A5A12", fontWeight: 620,
                }}>{etiquetaDe(c)}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Rasgos({ v, set, desde = 1 }) {
  const n = (i) => String(desde + i).padStart(2, "0");
  const alterna = (s) => {
    const actual = v.senas || [];
    const nuevas = actual.includes(s) ? actual.filter((x) => x !== s) : [...actual, s];
    set("senas", nuevas);
    if (!nuevas.some((x) => SENAS_CON_LUGAR.includes(x))) set("senas_donde", null);
  };
  return (
    <>
      <Campo numero={n(0)} titulo="¿Qué animal es?">
        {ESPECIE.map((o) => <Opcion key={o} activo={v.especie === o} onClick={() => set("especie", o)}>{o}</Opcion>)}
      </Campo>
      {v.especie === "Perro" && (
        <Campo numero={`${n(0)}b`} titulo="Raza" ayuda="Si no estás seguro, elige criollo o déjalo en blanco. Cuando se sabe, es lo que más ayuda a distinguirlo." opcional>
          {RAZA.map((o) => <Opcion key={o} activo={v.raza === o} onClick={() => set("raza", v.raza === o ? undefined : o)}>{o}</Opcion>)}
        </Campo>
      )}
      <Campo numero={n(1)} titulo="Tamaño">
        {TAMANO.map((o) => (
          <Opcion key={o} activo={v.tamano === o} onClick={() => set("tamano", o)}>
            {o} <span style={{ color: T.tintaSuave, fontWeight: 450, fontSize: 12.5 }}>({TAMANO_PISTA[o]})</span>
          </Opcion>
        ))}
      </Campo>
      <Campo numero={n(2)} titulo="Color que más se ve" ayuda="Si tiene varios, elige el que cubre más cuerpo.">
        {COLOR.map((o) => <Opcion key={o} activo={v.color === o} onClick={() => set("color", o)} muestra={COLOR_MUESTRA[o]}>{o}</Opcion>)}
      </Campo>
      <Campo numero={n(3)} titulo="Pelo">
        {PELO.map((o) => <Opcion key={o} activo={v.pelo === o} onClick={() => set("pelo", o)}>{o}</Opcion>)}
      </Campo>
      <Campo numero={n(4)} titulo="Sexo">
        {SEXO.map((o) => <Opcion key={o} activo={v.sexo === o} onClick={() => set("sexo", o)}>{o}</Opcion>)}
      </Campo>
      <Campo numero={n(5)} titulo="Edad aproximada">
        {EDAD.map((o) => <Opcion key={o} activo={v.edad === o} onClick={() => set("edad", o)}>{o}</Opcion>)}
      </Campo>
      <Campo numero={n(6)} titulo="Orejas">
        {OREJAS.map((o) => <Opcion key={o} activo={v.orejas === o} onClick={() => set("orejas", o)}>{o}</Opcion>)}
      </Campo>
      <Campo numero={n(7)} titulo="Cola">
        {COLA.map((o) => <Opcion key={o} activo={v.cola === o} onClick={() => set("cola", o)}>{o}</Opcion>)}
      </Campo>
      <Campo numero={n(8)} titulo="Señas particulares" ayuda="Marca todas las que apliquen." opcional>
        {SENAS.map((o) => <Opcion key={o} activo={(v.senas || []).includes(o)} onClick={() => alterna(o)}>{o}</Opcion>)}
      </Campo>
      {(v.senas || []).some((x) => SENAS_CON_LUGAR.includes(x)) && (
        <Campo numero={`${n(8)}b`} titulo="¿Dónde tiene la cicatriz o el tatuaje?"
          ayuda="Con tus palabras: en qué parte del cuerpo y cómo se ve." opcional>
          <input style={entradaTexto} value={v.senas_donde || ""} maxLength={120}
            onChange={(e) => set("senas_donde", e.target.value)} placeholder="Ej.: cicatriz en la pata trasera derecha, tatuaje en la oreja" />
        </Campo>
      )}
      {(v.senas || []).includes("Llevaba collar") && (
        <Campo numero={`${n(8)}c`} titulo="Color del collar" opcional>
          {COLOR_COLLAR.map((o) => <Opcion key={o} activo={v.collar_color === o} onClick={() => set("collar_color", o)}>{o}</Opcion>)}
        </Campo>
      )}
    </>
  );
}

function Zona({ v, set, numero }) {
  return (
    <>
      <Campo numero={numero} titulo="Departamento">
        {Object.keys(MUNICIPIOS).map((o) => (
          <Opcion key={o} activo={v.departamento === o}
            onClick={() => { set("departamento", o); set("municipio", ""); }}>{o}</Opcion>
        ))}
      </Campo>
      {v.departamento && (
        <Campo numero={`${numero}b`} titulo="Municipio">
          {MUNICIPIOS[v.departamento].map((o) => (
            <Opcion key={o} activo={v.municipio === o} onClick={() => set("municipio", o)}>{o}</Opcion>
          ))}
        </Campo>
      )}
    </>
  );
}

/* ------------------------------- APP ------------------------------- */

export default function App() {
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [modo, setModo] = useState(() => (llegoParaRecuperar() ? "nueva-clave" : "inicio"));

  const [busqueda, setBusqueda] = useState({ senas: [], contacto_medio: "WhatsApp" });
  const [resultados, setResultados] = useState(null);

  const [reporte, setReporte] = useState({ senas: [], contacto_medio: "WhatsApp", fecha_hallazgo: new Date().toISOString().slice(0, 10) });
  const [archivoFoto, setArchivoFoto] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState("");
  const [guardado, setGuardado] = useState(null);
  const [duplicados, setDuplicados] = useState(null);
  const [avisoFoto, setAvisoFoto] = useState("");
  const [detalleId, setDetalleId] = useState(null);

  // Lleva a la politica de datos (el aviso del inicio) desde cualquier parte.
  function irAlAviso(e) {
    if (e) e.preventDefault();
    setDetalleId(null);
    setModo("inicio");
    if (window.location.pathname !== "/") history.replaceState(null, "", "/#aviso");
    setTimeout(() => document.getElementById("aviso")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }
  const [editandoId, setEditandoId] = useState(null);
  const [fueEdicion, setFueEdicion] = useState(false);
  const editando = editandoId ? registros.find((x) => x.id === editandoId) : null;

  function editarFicha(r) {
    setReporte({ ...soloCampos(r), senas: r.senas || [] });
    setSitioOtro(!r.refugio_id && !!(r.lugar || r.custodio));
    setMostrarMapa(!!r.lugar_mapa);
    setArchivoFoto(null);
    setEditandoId(r.id);
    setDetalleId(null);
    setGuardado(null);
    setErrorGuardar("");
    setDuplicados(null);
    setModo("reportar");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setReporte({ senas: [], contacto_medio: "WhatsApp", fecha_hallazgo: new Date().toISOString().slice(0, 10) });
    setMostrarMapa(false);
    setSitioOtro(false);
    setArchivoFoto(null);
    setModo("lista");
  }
  const detalle = detalleId ? registros.find((x) => x.id === detalleId) : null;

  // La ficha abierta se refleja en la ruta (/m/PER-0012): es el enlace que se
  // comparte, y el Worker responde ahi con la foto en la vista previa.
  const verFicha = (r) => { setDetalleId(r.id); history.replaceState(null, "", `/m/${encodeURIComponent(r.codigo)}`); };
  const cerrarFicha = () => { setDetalleId(null); history.replaceState(null, "", "/"); };
  const [mostrarMapa, setMostrarMapa] = useState(false);
  // "¿Dónde está ahora?": nada elegido aún, un refugio de la lista, u «otro
  // sitio» (ahí sí se piden tipo y nombre a mano).
  const [sitioOtro, setSitioOtro] = useState(false);
  const [sesion, setSesion] = useState(null);
  const voluntario = sesion?.voluntario || null;

  const [filtroEspecie, setFiltroEspecie] = useState("");
  const [filtroMuni, setFiltroMuni] = useState("");
  const [filtroRefugio, setFiltroRefugio] = useState("");
  const [filtroAdopcion, setFiltroAdopcion] = useState(false);
  // Refugios: el publico recibe los activos; los voluntarios, todos (RLS).
  const [refugios, setRefugios] = useState([]);
  async function cargarRefugios() {
    const { data } = await supabase.from("refugios").select("*").order("nombre");
    setRefugios(data || []);
  }
  useEffect(() => { cargarRefugios(); }, [voluntario?.id]);
  const refugiosActivos = refugios.filter((x) => x.activo);
  const refugioDe = (id) => refugios.find((x) => x.id === id) || null;

  // Adopciones: el público recibe solo las disponibles; los voluntarios,
  // todas (RLS). Una mascota está «en adopción» si tiene una fila disponible.
  const [adopciones, setAdopciones] = useState([]);
  async function cargarAdopciones() {
    const { data } = await supabase.from("adopciones").select("*");
    setAdopciones(data || []);
  }
  useEffect(() => { cargarAdopciones(); }, [voluntario?.id]);
  const adopcionDe = (mascotaId) => adopciones.find((a) => a.mascota_id === mascotaId && a.estado === "disponible") || null;

  // Poner una mascota en adopción (solo voluntarios, RLS). La ficha no cambia
  // de estado: sigue en resguardo y sigue cruzando con las búsquedas.
  async function ponerEnAdopcion(r, datos) {
    const fila = { ...soloCamposAdopcion(datos || {}), mascota_id: r.id, creado_por: voluntario?.id || null };
    if (!fila.contacto_medio) fila.contacto_medio = "WhatsApp";
    const { error } = await supabase.from("adopciones").insert([fila]);
    if (error) { alert("No se pudo poner en adopción."); return; }
    await cargarAdopciones();
  }
  // Quitarla (p. ej. apareció el tutor o ya se entregó): nada se borra, la
  // fila queda cancelada y la historia se conserva.
  async function quitarDeAdopcion(r) {
    const a = adopcionDe(r.id);
    if (!a) return;
    const { error } = await supabase.from("adopciones").update({ estado: "cancelada" }).eq("id", a.id);
    if (error) { alert("No se pudo quitar de adopción."); return; }
    await cargarAdopciones();
  }

  // «Mis cambios»: deshacer una edición restaurando los valores de antes
  // (solo campos escribibles; el RLS ya limita esto a voluntarios activos).
  const [verMisCambios, setVerMisCambios] = useState(false);
  async function deshacerCambio(h, cambios) {
    const { error } = await supabase.from(h.tabla).update(cambios).eq("id", h.registro_id);
    if (error) { alert("No se pudo deshacer ese cambio."); return false; }
    if (h.tabla === "mascotas") await cargar();
    else if (h.tabla === "refugios") await cargarRefugios();
    else if (h.tabla === "adopciones") await cargarAdopciones();
    return true;
  }

  // Guardar (crear o editar) un refugio desde el panel. Solo voluntarios (RLS).
  async function guardarRefugio(datos, id) {
    const fila = soloCamposRefugio(datos);
    fila.nombre = (fila.nombre || "").trim();
    if (fila.nombre.length < 2) return "Escribe el nombre del refugio.";
    if (fila.lugar_mapa && !esEnlaceMapa(fila.lugar_mapa)) return "El enlace de mapa no parece de Google Maps.";
    if (fila.activo === null) fila.activo = true;
    if (!fila.contacto_medio) fila.contacto_medio = "WhatsApp";
    const q = id ? supabase.from("refugios").update(fila).eq("id", id) : supabase.from("refugios").insert([fila]);
    const { error } = await q;
    if (error) return /idx_refugios_nombre|duplicate/i.test(error.message || "") ? "Ya hay un refugio con ese nombre." : "No se pudo guardar el refugio.";
    await cargarRefugios();
    return "";
  }

  // Un voluntario con refugio propio arranca la ficha nueva ahi (solo si el
  // formulario esta en blanco: no pisa una edicion ni algo ya elegido).
  useEffect(() => {
    if (modo !== "reportar" || editandoId || reporte.refugio_id !== undefined) return;
    const ref = voluntario?.refugio_id ? refugioDe(voluntario.refugio_id) : null;
    if (ref) { setReporte((p) => fichaDesdeRefugio(p, ref)); if (ref.lugar_mapa) setMostrarMapa(true); }
  }, [modo, editandoId, voluntario?.refugio_id, refugios.length]);

  // Asignar una ficha (con el sitio escrito a mano) a un refugio.
  async function asignarRefugio(r, refugioId) {
    const ref = refugioDe(refugioId);
    const cambios = ref ? { refugio_id: ref.id, custodio: ref.tipo, lugar: ref.nombre } : { refugio_id: null };
    const { error } = await supabase.from("mascotas").update(cambios).eq("id", r.id);
    if (error) { alert("No se pudo asignar el refugio."); return; }
    setRegistros((p) => p.map((x) => (x.id === r.id ? { ...x, ...cambios } : x)));
  }
  const [verOcultas, setVerOcultas] = useState(false);

  const setB = (k, v) => setBusqueda((p) => ({ ...p, [k]: v }));
  const setR = (k, v) => setReporte((p) => ({ ...p, [k]: v }));

  async function cargar() {
    setCargando(true);
    // Las ocultas solo las devuelve la base a voluntarios con sesion (RLS);
    // para el publico esta condicion es redundante, pero deja claro el intento.
    // Los voluntarios las reciben para poder revisarlas y volver a mostrarlas.
    let consulta = supabase.from("mascotas").select("*");
    if (!voluntario) consulta = consulta.neq("estado", "oculto");
    const { data, error } = await consulta.order("creado_en", { ascending: false }).limit(1000);

    if (!configurado) setErrorCarga("La página no tiene configurada la conexión a la base de datos. Avisa a quien administra el sitio.");
    else if (error) setErrorCarga("No se pudo cargar el listado. Revisa tu conexión y vuelve a intentar.");
    else {
      setRegistros(data || []);
      setErrorCarga("");
      // Enlace directo a una ficha: /m/PER-0002 (o #PER-0002, enlaces viejos).
      const porRuta = window.location.pathname.match(/^\/m\/([^/]+)\/?$/);
      const codigo = decodeURIComponent(porRuta ? porRuta[1] : window.location.hash.slice(1));
      if (/^BUS-/i.test(codigo)) { setCasoInicial(codigo.toUpperCase()); setModo("caso"); }
      else if (codigo && !detalleId) {
        const f = (data || []).find((x) => x.codigo === codigo);
        if (f) { setDetalleId(f.id); setModo("lista"); }
        else if (porRuta) setErrorCarga(`No encontramos la ficha ${codigo}. Puede que ya no esté publicada.`);
      }
    }
    setCargando(false);
  }

  // Se recarga al entrar o salir un voluntario: cambia lo que la base le deja ver.
  useEffect(() => { cargar(); }, [voluntario?.id]);
  // Si llegan directo a /#aviso (enlace a la politica de datos), desplazarse ahi.
  useEffect(() => { if (window.location.hash === "#aviso") setTimeout(() => irAlAviso(), 300); }, []);
  useEffect(() => {
    sesionActual().then(setSesion);
    return alCambiarSesion(setSesion);
  }, []);

  const enResguardo = registros.filter((r) => r.estado === "resguardo").length;
  const reencontrados = registros.filter((r) => r.estado === "reencontrado").length;
  const ocultas = registros.filter((r) => r.estado === "oculto").length;

  async function marcarReencontrado(r) {
    // Antes de dar de alta, avisar si hay otros animales en resguardo que
    // se parecen mucho: el riesgo es entregar el equivocado.
    const gemelas = fichasGemelas(r, registros);
    let mensaje = `¿Confirmas que ${r.codigo} ya volvió con su familia?`;
    if (gemelas.length) {
      const codigos = gemelas.slice(0, 4).map((g) => `${g.ficha.codigo} (${g.resultado.valor}%)`).join(", ");
      const s = gemelas.length > 1 ? "s" : "";
      mensaje =
        `OJO: hay ${gemelas.length} ficha${s} en resguardo muy parecida${s} a esta: ${codigos}.\n\n` +
        `Verifica el código en la jaula o guacal antes de seguir.\n\n` +
        `¿Seguro que el que se entregó es ${r.codigo}?`;
    }
    if (!confirm(mensaje)) return;
    const { error } = await supabase.from("mascotas").update({ estado: "reencontrado" }).eq("id", r.id);
    if (error) {
      alert("Solo un voluntario con sesión activa puede marcar reencuentros. Escríbele al grupo.");
      return;
    }
    setRegistros((p) => p.map((x) => (x.id === r.id ? { ...x, estado: "reencontrado" } : x)));
  }

  async function aprobar(r) {
    const { error } = await supabase.from("mascotas").update({ verificado: true }).eq("id", r.id);
    if (error) { alert("No se pudo aprobar. ¿Tu cuenta está activada como voluntario?"); return; }
    setRegistros((p) => p.map((x) => (x.id === r.id ? { ...x, verificado: true } : x)));
  }

  async function ocultar(r) {
    if (!confirm(`¿Ocultar la ficha ${r.codigo} del listado? No se borra: queda guardada y se puede volver a mostrar desde la base.`)) return;
    const { error } = await supabase.from("mascotas").update({ estado: "oculto" }).eq("id", r.id);
    if (error) { alert("No se pudo ocultar. ¿Tu cuenta está activada como voluntario?"); return; }
    setRegistros((p) => p.map((x) => (x.id === r.id ? { ...x, estado: "oculto" } : x)));
  }

  async function mostrarDeNuevo(r) {
    const { error } = await supabase.from("mascotas").update({ estado: "resguardo" }).eq("id", r.id);
    if (error) { alert("No se pudo volver a mostrar. ¿Tu cuenta está activada como voluntario?"); return; }
    setRegistros((p) => p.map((x) => (x.id === r.id ? { ...x, estado: "resguardo" } : x)));
  }

  // Numero de registro de la ultima busqueda guardada (null si no se guardo).
  const [registroBusqueda, setRegistroBusqueda] = useState(null);
  // Codigo con el que se abre "¿Como va mi busqueda?" (por enlace #BUS-... o desde el aviso).
  const [casoInicial, setCasoInicial] = useState("");
  // Foto opcional que deja el tutor al buscar (para que los voluntarios cotejen).
  const [fotoBusqueda, setFotoBusqueda] = useState(null);
  const [guardandoBusqueda, setGuardandoBusqueda] = useState(false);

  async function buscar() {
    const activas = registros.filter((r) => r.estado === "resguardo");
    setResultados(buscarCoincidencias(busqueda, activas));
    setRegistroBusqueda(null);
    if (!busqueda.especie) return;
    setGuardandoBusqueda(true);
    try {
      // La foto (si la dejo) se sube antes, a su propia carpeta, y se guarda
      // en el mismo insert: el publico no puede actualizar busquedas.
      const id = crypto.randomUUID();
      let urls = {};
      if (fotoBusqueda) {
        try { urls = await subirFoto(fotoBusqueda, id, "busquedas"); } catch { /* se guarda sin foto */ }
      }
      // Se guarda con un numero de registro para que el tutor sepa que quedo
      // recibida y los voluntarios puedan hacerle seguimiento desde el panel.
      for (let intento = 0; intento < 3; intento++) {
        const codigo = nuevoCodigoBusqueda();
        const { error } = await supabase.from("busquedas").insert([{ id, ...busqueda, ...urls, codigo, estado: "abierta" }]);
        if (!error) { setRegistroBusqueda(codigo); setFotoBusqueda(null); return; }
        if (!/codigo|unique|duplicate/i.test(error.message || "")) return; // otro error: no insistir
      }
    } finally {
      setGuardandoBusqueda(false);
    }
  }

  async function guardarReporte(ignorarDuplicados = false) {
    const obligatorios = ["especie", "tamano", "color", "departamento", "municipio", "contacto_telefono"];
    const faltan = obligatorios.filter((k) => !reporte[k]);
    if (faltan.length) {
      setErrorGuardar("Faltan datos obligatorios. Revisa especie, tamaño, color, ubicación y contacto.");
      return;
    }
    if (reporte.fuente_url && !/^https?:\/\/\S+$/i.test(reporte.fuente_url.trim())) {
      setErrorGuardar("El enlace de la publicación original debe empezar por http:// o https://.");
      return;
    }
    if (reporte.lugar_mapa && !esEnlaceMapa(reporte.lugar_mapa)) {
      setErrorGuardar("El enlace del sitio debe ser de Google Maps (empieza por https://maps.app.goo.gl/ o https://www.google.com/maps/).");
      return;
    }

    if (editandoId) {
      await guardarEdicion();
      return;
    }

    // Antes de guardar, buscar si el mismo animal ya esta registrado
    // (mismo municipio, fechas cercanas, rasgos muy parecidos).
    if (!ignorarDuplicados) {
      const parecidas = posiblesDuplicados(reporte, registros);
      if (parecidas.length) {
        setDuplicados(parecidas);
        return;
      }
    }
    setDuplicados(null);

    setGuardando(true);
    setErrorGuardar("");

    try {
      // La foto se sube ANTES de crear la ficha y se guarda todo en un solo
      // insert. Si se subiera despues, habria que actualizar la ficha, y
      // RLS solo deja actualizar a voluntarios: la URL nunca quedaria.
      const id = crypto.randomUUID();
      let urls = {};
      let fotoFallo = false;
      if (archivoFoto) {
        try {
          urls = await subirFoto(archivoFoto, id);
        } catch {
          fotoFallo = true; // La ficha se guarda igual, sin foto.
        }
      }

      const { data, error } = await supabase
        .from("mascotas")
        .insert([{ id, ...reporte, ...urls, estado: "resguardo", verificado: false }])
        .select()
        .single();
      if (error) throw new Error("No se pudo guardar la ficha. Revisa tu conexión.");
      setAvisoFoto(fotoFallo ? "La ficha quedó guardada, pero la foto no se pudo subir. Un voluntario puede agregarla después." : "");

      setRegistros((p) => [data, ...p]);
      setGuardado(data.codigo);
      setFueEdicion(false);
      setReporte({ senas: [], contacto_medio: "WhatsApp", fecha_hallazgo: new Date().toISOString().slice(0, 10) });
      setSitioOtro(false);
      setMostrarMapa(false);
      setArchivoFoto(null);
    } catch (e) {
      setErrorGuardar(e.message);
    } finally {
      setGuardando(false);
    }
  }

  // Solo voluntarios (RLS lo exige). Foto nueva opcional: se sube bajo el
  // mismo id y reemplaza las URLs.
  async function guardarEdicion() {
    setGuardando(true);
    setErrorGuardar("");
    try {
      let urls = {};
      let fotoFallo = false;
      if (archivoFoto) {
        try { urls = await subirFoto(archivoFoto, editandoId); } catch { fotoFallo = true; }
      }
      const cambios = { ...soloCampos(reporte), ...urls };
      const { data, error } = await supabase
        .from("mascotas")
        .update(cambios)
        .eq("id", editandoId)
        .select()
        .single();
      if (error) throw new Error("No se pudo guardar. Solo un voluntario con sesión activa puede editar fichas.");
      setAvisoFoto(fotoFallo ? "Los datos quedaron guardados, pero la foto nueva no se pudo subir." : "");
      setRegistros((p) => p.map((x) => (x.id === data.id ? data : x)));
      setGuardado(data.codigo);
      setFueEdicion(true);
      setEditandoId(null);
      setReporte({ senas: [], contacto_medio: "WhatsApp", fecha_hallazgo: new Date().toISOString().slice(0, 10) });
      setSitioOtro(false);
      setMostrarMapa(false);
      setArchivoFoto(null);
    } catch (e) {
      setErrorGuardar(e.message);
    } finally {
      setGuardando(false);
    }
  }

  const listaFiltrada = useMemo(
    () => registros.filter((r) =>
      (verOcultas ? r.estado === "oculto" : r.estado !== "oculto") &&
      (!filtroEspecie || r.especie === filtroEspecie) &&
      (!filtroMuni || r.municipio === filtroMuni) &&
      (!filtroRefugio || r.refugio_id === filtroRefugio) &&
      (!filtroAdopcion || adopcionDe(r.id))),
    [registros, adopciones, filtroEspecie, filtroMuni, filtroRefugio, filtroAdopcion, verOcultas]
  );

  const municipiosConRegistro = useMemo(
    () => [...new Set(registros.filter((r) => r.estado !== "oculto").map((r) => r.municipio))].sort(), [registros]
  );

  const btnModo = (id, etiqueta, sub) => (
    <button
      type="button"
      onClick={() => {
        setModo(id); setResultados(null); setGuardado(null); setErrorGuardar(""); setDuplicados(null);
        if (window.location.pathname !== "/") window.history.replaceState(null, "", "/");
      }}
      style={{
        flex: 1, minWidth: 200, textAlign: "left", cursor: "pointer", padding: "18px 20px",
        borderRadius: 13, border: `1.5px solid ${modo === id ? T.verde : T.linea}`,
        background: modo === id ? T.verde : T.blanco, color: modo === id ? T.blanco : T.tinta,
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 690, letterSpacing: "-.015em" }}>{etiqueta}</div>
      <div style={{ fontSize: 13.5, marginTop: 3, opacity: modo === id ? 0.85 : 0.6 }}>{sub}</div>
    </button>
  );

  return (
    <div style={{ background: T.papel, minHeight: "100vh", fontFamily: FUENTE, color: T.tinta }}>
      <style>{`* { box-sizing: border-box; } body { margin: 0; }
        button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible { outline: 3px solid ${T.ambar}; outline-offset: 2px; }`}</style>

      {import.meta.env.VITE_ENTORNO === "staging" && (
        <div style={{ background: T.violeta, color: T.blanco, textAlign: "center", padding: "6px 10px", fontSize: 13, fontWeight: 600 }}>
          ENTORNO DE PRUEBAS — lo que registres aquí no es real y se puede borrar
        </div>
      )}
      <header style={{ borderBottom: `1px solid ${T.linea}`, background: T.blanco }}>
        <div style={{ maxWidth: 940, margin: "0 auto", padding: "20px 20px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: ".18em", color: T.tintaSuave }}>
              EJE CAFETERO · RISARALDA · QUINDÍO · CALDAS · VALLE
            </div>
            <div style={{ fontSize: 13, color: T.tintaSuave }}>
              {sesion ? (
                <>
                  {voluntario ? `Hola, ${voluntario.nombre || sesion.correo}` : sesion.correo}
                  {" · "}
                  <button type="button" onClick={async () => { await salir(); setSesion(null); }}
                    style={{ background: "none", border: "none", padding: 0, color: T.verde, cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>
                    Salir
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setModo("entrar")}
                  style={{ background: "none", border: "none", padding: 0, color: T.tintaSuave, cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>
                  Voluntarios
                </button>
              )}
            </div>
          </div>
          <h1 style={{ margin: "6px 0 0", fontSize: 31, fontWeight: 760, letterSpacing: "-.03em", lineHeight: 1.05 }}>
            Huellas a Casa
          </h1>
          <p style={{ margin: "5px 0 0", fontSize: 18, fontWeight: 620, color: T.ambar, letterSpacing: "-.01em" }}>
            Mascotas perdidas · terremoto 10 de agosto
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 15.5, color: T.tintaSuave, maxWidth: 560, lineHeight: 1.5 }}>
            Un solo lugar para registrar y buscar las mascotas que quedaron sin su casa.
          </p>
          <div style={{ display: "flex", gap: 22, marginTop: 16, fontFamily: MONO, fontSize: 12.5 }}>
            <div>
              <div style={{ fontSize: 25, fontWeight: 700, color: T.ambar, lineHeight: 1 }}>{enResguardo}</div>
              <div style={{ color: T.tintaSuave, marginTop: 4 }}>EN RESGUARDO</div>
            </div>
            <div>
              <div style={{ fontSize: 25, fontWeight: 700, color: T.verde, lineHeight: 1 }}>{reencontrados}</div>
              <div style={{ color: T.tintaSuave, marginTop: 4 }}>REENCONTRADOS</div>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 940, margin: "0 auto", padding: "22px 20px 70px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 26 }}>
          {btnModo("buscar", "Busco a mi mascota", "Responde y te muestro los parecidos")}
          {btnModo("reportar", "Encontré una mascota", "Para refugios, hogares y voluntarios")}
          {btnModo("lista", "Ver todos los registros", cargando ? "Cargando…" : `${registros.length - ocultas} fichas`)}
          {voluntario && btnModo("panel", "Panel", "Uso y pendientes")}
        </div>

        {errorCarga && (
          <div style={{
            border: `1.5px solid ${T.rojo}`, borderRadius: 11, padding: "14px 16px",
            marginBottom: 20, fontSize: 14.5, color: T.rojo,
          }}>
            {errorCarga}{" "}
            <button type="button" onClick={cargar} style={{
              background: "transparent", border: "none", color: T.rojo,
              textDecoration: "underline", cursor: "pointer", fontSize: 14.5, padding: 0,
            }}>Reintentar</button>
          </div>
        )}

        {modo === "nueva-clave" && (
          sesion ? (
            <NuevaClave onListo={() => { history.replaceState(null, "", window.location.pathname); setModo("lista"); }} />
          ) : (
            <div style={{ border: `1px solid ${T.linea}`, borderRadius: 13, background: T.blanco, padding: "22px 24px", fontSize: 15, lineHeight: 1.6 }}>
              Verificando el enlace… Si esto no cambia en unos segundos, el enlace venció o ya se usó:
              vuelve a <a href="#" onClick={(e) => { e.preventDefault(); setModo("entrar"); }} style={{ color: T.verde }}>iniciar sesión</a> y pide otro.
            </div>
          )
        )}
        {modo === "entrar" && !sesion && <Entrar onListo={() => setModo("lista")} />}
        {modo === "entrar" && sesion && (
          <div style={{ border: `1px solid ${T.linea}`, borderRadius: 13, background: T.blanco, padding: "22px 24px", fontSize: 15, lineHeight: 1.6 }}>
            Ya tienes la sesión iniciada. Ve a <a href="#" onClick={(e) => { e.preventDefault(); setModo("lista"); }} style={{ color: T.verde }}>Ver todos los registros</a>.
          </div>
        )}
        {sesion && !voluntario && modo !== "entrar" && modo !== "nueva-clave" && (
          <div style={{
            border: `1.5px solid ${T.ambar}`, background: T.ambarClaro, borderRadius: 11,
            padding: "12px 15px", marginBottom: 18, fontSize: 14.5, lineHeight: 1.5,
          }}>
            Tu cuenta ({sesion.correo}) todavía no está activada como voluntario. Pídele a un
            administrador que la active; mientras tanto puedes usar la página como cualquier persona.
          </div>
        )}
        {modo === "inicio" && (
          <div style={{
            border: `1px solid ${T.linea}`, borderRadius: 13, background: T.blanco,
            padding: "26px 24px", fontSize: 15.5, lineHeight: 1.6, color: T.tintaSuave,
          }}>
            <p style={{ margin: 0 }}>
              Elige arriba qué necesitas hacer. Casi todo se responde tocando opciones. Solo hay un
              espacio para escribir libre, al final, y ahí puedes contar con tus palabras lo que no
              cabe en las casillas.
            </p>
          </div>
        )}
        {modo === "inicio" && <div style={{ marginTop: 18 }}><Aviso /></div>}

        {modo === "buscar" && !resultados && (
          <section>
            <div style={{
              display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 14px",
              border: `1.5px solid ${T.verde}`, background: T.blanco, borderRadius: 11,
              padding: "12px 16px", marginBottom: 14,
            }}>
              <span style={{ fontSize: 15, flex: 1, minWidth: 200 }}>
                <strong style={{ fontWeight: 660 }}>¿Ya buscaste antes?</strong> Con tu número BUS-… puedes ver cómo va.
              </span>
              <button type="button" onClick={() => { setCasoInicial(""); setModo("caso"); }} style={{
                background: T.verde, color: T.blanco, border: "none", borderRadius: 9,
                padding: "11px 16px", fontSize: 15, fontWeight: 660, cursor: "pointer",
              }}>Consultar mi búsqueda</button>
            </div>
            <div style={{
              background: T.ambarClaro, border: "1px solid #EBD9B4", borderRadius: 11,
              padding: "14px 16px", marginBottom: 24, fontSize: 14.5, lineHeight: 1.5,
            }}>
              Responde solo lo que recuerdes con seguridad. Lo que dejes en blanco no te quita coincidencias.
            </div>

            <Zona v={busqueda} set={setB} numero="01" />
            <Rasgos v={busqueda} set={setB} desde={2} />

            <NotaLibre
              numero="11" titulo="Cuéntanos algo más de tu mascota"
              ayuda="Con tus palabras. No importa cómo lo escribas: entiendo lo mismo si dices cojea, renquea o camina mal."
              valor={busqueda.nota} onCambio={(v) => setB("nota", v)} registro={busqueda} set={setB}
              placeholder="Ej.: renquea de una pata de atrás, tiene una manchita blanca en el pecho"
            />

            <Campo numero="11b" titulo="Foto de tu mascota"
              ayuda="El algoritmo no la usa para buscar (el cruce es por los datos), pero los voluntarios sí: la comparan a ojo con los animales que llegan. Solo la ven ellos y tú con tu número de registro." opcional>
              <CargarFoto archivo={fotoBusqueda} onArchivo={setFotoBusqueda} sinCamara />
            </Campo>

            <Campo numero="12" titulo="¿A qué nombre responde?"
              ayuda="No se usa para buscar. Sirve para que el refugio lo llame y confirme." opcional>
              <input style={entradaTexto} value={busqueda.nombres || ""}
                onChange={(e) => setB("nombres", e.target.value)} placeholder="Ej.: Luna, Lunita" />
            </Campo>

            <Campo numero="13" titulo="¿Por dónde te avisamos?"
              ayuda="No se publica: solo lo ven los voluntarios. Si llega una mascota parecida, te avisan sin que tengas que volver a entrar." opcional>
              <CampoContacto medio={busqueda.contacto_medio} valor={busqueda.contacto_telefono}
                onMedio={(m) => setB("contacto_medio", m)} onValor={(v) => setB("contacto_telefono", v)} />
            </Campo>

            <p style={{ margin: "0 0 12px 25px", fontSize: 13, color: T.tintaSuave, lineHeight: 1.5 }}>
              Si dejas un contacto, autorizas que los voluntarios lo usen solo para avisarte.{" "}
              <a href="/#aviso" onClick={irAlAviso} style={{ color: T.verde }}>Cómo cuidamos tus datos</a>
            </p>
            <button type="button" onClick={buscar} disabled={guardandoBusqueda} style={{
              background: guardandoBusqueda ? T.tintaSuave : T.verde, color: T.blanco, border: "none", borderRadius: 10,
              padding: "16px 26px", fontSize: 17, fontWeight: 680, cursor: guardandoBusqueda ? "wait" : "pointer",
              marginLeft: 25, marginTop: 6,
            }}>{guardandoBusqueda ? "Guardando…" : "Buscar coincidencias"}</button>
          </section>
        )}

        {modo === "buscar" && resultados && (
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 21, fontWeight: 720, letterSpacing: "-.02em" }}>
                {resultados.length === 0 ? "Todavía no hay nada parecido" : `${resultados.length} para revisar`}
              </h2>
              <button type="button" onClick={() => setResultados(null)} style={{
                background: "transparent", border: `1.5px solid ${T.linea}`, borderRadius: 8,
                padding: "9px 14px", fontSize: 14, cursor: "pointer", fontWeight: 560,
              }}>Cambiar respuestas</button>
            </div>

            {registroBusqueda && (
              <div style={{
                border: `1.5px solid ${T.verde}`, background: T.verdeClaro, borderRadius: 12,
                padding: "14px 16px", marginBottom: 16, fontSize: 14.5, lineHeight: 1.55,
              }}>
                <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".12em", color: T.verde, marginBottom: 4 }}>
                  TU BÚSQUEDA QUEDÓ REGISTRADA
                </div>
                Número de registro: <strong style={{ fontFamily: MONO, fontSize: 16 }}>{registroBusqueda}</strong>.
                Guárdalo. El equipo de voluntarios revisa las búsquedas y las cruza con cada animal que
                llega; por ahora ese seguimiento se hace a mano y estamos trabajando para automatizarlo.
                {busqueda.contacto_telefono ? (
                  <> Si aparece algo parecido, te escribimos por {busqueda.contacto_medio || "WhatsApp"}.</>
                ) : (
                  <> <strong>No dejaste contacto:</strong> si quieres que te avisemos,{" "}
                    <a href="#" onClick={(e) => { e.preventDefault(); setResultados(null); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }} style={{ color: T.verde }}>
                      vuelve y agrega tu WhatsApp
                    </a>.</>
                )}
                {" "}Si escribes al grupo, menciona este número. Y cuando quieras ver cómo va,{" "}
                <a href={`/#${registroBusqueda}`} onClick={(e) => { e.preventDefault(); setCasoInicial(registroBusqueda); setModo("caso"); }} style={{ color: T.verde, fontWeight: 620 }}>
                  consulta tu búsqueda aquí
                </a>{" "}(guarda ese enlace).
              </div>
            )}
            {resultados.length === 0 ? (
              <div style={{
                border: `1px solid ${T.linea}`, borderRadius: 12, background: T.blanco,
                padding: "24px 22px", fontSize: 15, lineHeight: 1.6, color: T.tintaSuave,
              }}>
                Ningún registro coincide lo suficiente por ahora. Tu búsqueda quedó guardada: si dejaste
                contacto, los voluntarios te avisan cuando llegue algo parecido.
              </div>
            ) : (
              <>
                <p style={{ margin: "0 0 16px", fontSize: 14, color: T.tintaSuave, lineHeight: 1.5 }}>
                  Ordenadas por parecido. El porcentaje viene de los datos, no de la foto: mira siempre
                  la imagen antes de escribir.
                </p>
                {resultados[0].resultado.confianza < 0.85 && (
                  <div style={{
                    border: `1px solid ${T.linea}`, background: T.blanco, borderRadius: 11,
                    padding: "12px 15px", marginBottom: 16, fontSize: 14.5, lineHeight: 1.5,
                  }}>
                    <strong style={{ fontWeight: 660 }}>Respondiste pocas preguntas</strong>, así que el
                    parecido no puede pasar de un nivel moderado. Si recuerdas la raza, el pelo, la edad o
                    las orejas,{" "}
                    <a href="#" onClick={(e) => { e.preventDefault(); setResultados(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ color: T.verde }}>agrégalos</a>{" "}
                    y la lista se afina.
                  </div>
                )}
                {empatadosArriba(resultados).length > 1 && (
                  <div style={{
                    border: `1.5px solid ${T.ambar}`, background: T.ambarClaro, borderRadius: 11,
                    padding: "12px 15px", marginBottom: 16, fontSize: 14.5, lineHeight: 1.5,
                  }}>
                    <strong style={{ fontWeight: 660 }}>Hay {empatadosArriba(resultados).length} fichas casi
                    empatadas.</strong> Se parecen mucho entre sí. Compara las fotos con calma y, cuando
                    escribas, menciona el código de la ficha para que no se confundan.
                  </div>
                )}
                <div style={{ display: "grid", gap: 14 }}>
                  {resultados.map(({ ficha, resultado }) => (
                    <Ficha key={ficha.id} r={ficha} resultado={resultado}
                      nombres={busqueda.nombres} voluntario={voluntario} adopcion={adopcionDe(ficha.id)} onAdopcion={ponerEnAdopcion} onQuitarAdopcion={quitarDeAdopcion} onReencontrar={marcarReencontrado} onAprobar={aprobar} onOcultar={ocultar} onMostrar={mostrarDeNuevo} onVer={verFicha} />
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {modo === "reportar" && guardado && (
          <section style={{ border: `1.5px solid ${T.verde}`, background: T.verdeClaro, borderRadius: 13, padding: "26px 24px" }}>
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: ".12em", color: T.verde }}>{fueEdicion ? "FICHA ACTUALIZADA" : "FICHA CREADA"}</div>
            <h2 style={{ margin: "8px 0 6px", fontSize: 26, fontWeight: 740, letterSpacing: "-.02em" }}>{guardado}</h2>
            <p style={{ margin: "0 0 18px", fontSize: 15, color: T.tintaSuave, lineHeight: 1.55 }}>
              {fueEdicion ? "Los cambios ya se ven en el listado." : "Anota este código en la jaula o el guacal. Es el que se usa para confirmar la entrega."}
            </p>
            {avisoFoto && (
              <p style={{ margin: "-8px 0 18px", fontSize: 14.5, color: T.rojo, lineHeight: 1.5 }}>{avisoFoto}</p>
            )}
            <button type="button" onClick={() => { setGuardado(null); if (fueEdicion) setModo("lista"); }} style={{
              background: T.verde, color: T.blanco, border: "none", borderRadius: 9,
              padding: "13px 20px", fontSize: 15.5, fontWeight: 660, cursor: "pointer",
            }}>{fueEdicion ? "Volver al listado" : "Registrar la siguiente mascota"}</button>
          </section>
        )}

        {modo === "reportar" && !guardado && (
          <section>
            {editando ? (
              <div style={{
                background: T.violetaClaro, border: `1px solid ${T.violeta}`, borderRadius: 11,
                padding: "14px 16px", marginBottom: 24, fontSize: 14.5, lineHeight: 1.5,
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
              }}>
                <span><strong style={{ fontWeight: 660 }}>Editando {editando.codigo}.</strong> Cambia lo que haga falta y guarda. Si subes una foto nueva, reemplaza la actual.</span>
                <button type="button" onClick={cancelarEdicion} style={botonSecundario(T.violeta)}>Cancelar</button>
              </div>
            ) : (
              <div style={{
                background: T.verdeClaro, border: "1px solid #CBE0D6", borderRadius: 11,
                padding: "14px 16px", marginBottom: 24, fontSize: 14.5, lineHeight: 1.5,
              }}>
                Una ficha por animal. La foto es para que el tutor reconozca: tómala con luz y de cuerpo entero.
              </div>
            )}

            <Campo numero="00" titulo="Foto de la mascota">
              <CargarFoto key={editandoId || "nueva"} archivo={archivoFoto} onArchivo={setArchivoFoto} actual={editando?.foto_thumb_url} />
            </Campo>

            <Zona v={reporte} set={setR} numero="01" />

            <Campo numero="02" titulo="Barrio o vereda donde apareció">
              <input style={entradaTexto} value={reporte.barrio || ""} list="barrios-sugeridos"
                onChange={(e) => setR("barrio", e.target.value)} placeholder="Ej.: Cuba" />
              {BARRIOS[reporte.municipio] && (
                <datalist id="barrios-sugeridos">
                  {BARRIOS[reporte.municipio].map((b) => <option key={b} value={b} />)}
                </datalist>
              )}
            </Campo>

            <Rasgos v={reporte} set={setR} desde={3} />

            <Campo numero="12" titulo="Fecha en que lo recogieron">
              <input type="date" style={{ ...entradaTexto, maxWidth: 210 }}
                value={reporte.fecha_hallazgo || ""} onChange={(e) => setR("fecha_hallazgo", e.target.value)} />
            </Campo>

            <Campo numero="13" titulo="¿Dónde está ahora?"
              ayuda={refugiosActivos.length ? "Si está en un refugio de la lista, elígelo: la ficha se llena sola con el municipio, cómo llegar y el contacto. Si está en otra parte (una casa, una veterinaria, la calle), toca «No está en un refugio»." : undefined}>
              {refugiosActivos.length > 0 && (
                <>
                  <select value={reporte.refugio_id || (sitioOtro ? "otro" : "")} style={{ ...entradaTexto, marginBottom: 10 }}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "otro") { setSitioOtro(true); setReporte((p) => fichaDesdeRefugio(p, null)); return; }
                      const ref = refugioDe(v);
                      setSitioOtro(false);
                      setReporte((p) => fichaDesdeRefugio(p, ref));
                      if (ref?.lugar_mapa) setMostrarMapa(true);
                    }}>
                    <option value="">Elige el refugio o sitio…</option>
                    {refugiosActivos.map((x) => (
                      <option key={x.id} value={x.id}>{x.nombre}{x.municipio ? ` — ${x.municipio}` : ""}</option>
                    ))}
                    <option value="otro">Otro sitio (no está en la lista)</option>
                  </select>
                  {/* El mismo camino que «Otro sitio» del desplegable, pero a la
                      vista: mucha gente no abre la lista si su sitio no es un refugio. */}
                  {!sitioOtro && !reporte.refugio_id && (
                    <div style={{ marginBottom: 10 }}>
                      <Opcion activo={false} onClick={() => { setSitioOtro(true); setReporte((p) => fichaDesdeRefugio(p, null)); }}>
                        No está en un refugio
                      </Opcion>
                    </div>
                  )}
                </>
              )}
              {reporte.refugio_id && (
                <p style={{ margin: "0 0 4px", fontSize: 13.5, color: T.tintaSuave, lineHeight: 1.5 }}>
                  {refugioDe(reporte.refugio_id)?.tipo}
                  {refugioDe(reporte.refugio_id)?.direccion ? ` · ${refugioDe(reporte.refugio_id).direccion}` : ""}
                  {" "}— se llenó lo que el refugio ya tiene; puedes ajustar lo que haga falta.
                </p>
              )}
              {(sitioOtro || refugiosActivos.length === 0) && (
                CUSTODIO.map((o) => <Opcion key={o} activo={reporte.custodio === o} onClick={() => setR("custodio", o)}>{o}</Opcion>)
              )}
            </Campo>

            {(sitioOtro || refugiosActivos.length === 0) && (
              <Campo numero="14" titulo="Nombre del refugio o del sitio" opcional
                ayuda="Escríbelo como se llame. Un voluntario puede después convertirlo en refugio de la lista.">
                <input style={entradaTexto} value={reporte.lugar || ""}
                  onChange={(e) => setR("lugar", e.target.value)} placeholder="Ej.: Albergue Huellas de Esperanza" />
              </Campo>
            )}

            <Campo numero="14b" titulo="¿Mostrar cómo llegar al sitio?" opcional
              ayuda="Solo si quieres que la ubicación del refugio o del sitio quede visible en la ficha. En Google Maps busca el lugar, toca Compartir y copia el enlace.">
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <Opcion activo={!mostrarMapa} onClick={() => { setMostrarMapa(false); setR("lugar_mapa", null); }}>No mostrar</Opcion>
                  <Opcion activo={mostrarMapa} onClick={() => setMostrarMapa(true)}>Sí, mostrar</Opcion>
                </div>
                {mostrarMapa && (
                  <>
                    <input style={entradaTexto} inputMode="url" value={reporte.lugar_mapa || ""}
                      onChange={(e) => setR("lugar_mapa", e.target.value)} placeholder="https://maps.app.goo.gl/…" />
                    {reporte.lugar_mapa && !esEnlaceMapa(reporte.lugar_mapa) && (
                      <span style={{ fontSize: 13, color: T.rojo }}>Ese no parece un enlace de Google Maps.</span>
                    )}
                  </>
                )}
              </div>
            </Campo>

            <Campo numero="15" titulo="Contacto para el tutor"
              ayuda="Se publica en la ficha para que el tutor escriba. Pon el del refugio o uno que puedas mostrar; no uses uno personal si no quieres que quede visible.">
              <CampoContacto medio={reporte.contacto_medio} valor={reporte.contacto_telefono}
                onMedio={(m) => setR("contacto_medio", m)} onValor={(v) => setR("contacto_telefono", v)} />
            </Campo>

            <NotaLibre
              numero="16" titulo="Qué observaste del animal"
              ayuda="Escríbelo como te salga. Sirve para cruzar con lo que cuente el tutor."
              valor={reporte.nota} onCambio={(v) => setR("nota", v)} registro={reporte} set={setR}
              placeholder="Ej.: muy asustadito, se esconde. Tiene el hocico canoso."
            />

            <Campo numero="17" titulo="Enlace de la publicación original" opcional
              ayuda="Si esta información viene de Instagram, Facebook u otra página, pega aquí el enlace. Así se puede volver a la fuente.">
              <input style={entradaTexto} inputMode="url" value={reporte.fuente_url || ""}
                onChange={(e) => setR("fuente_url", e.target.value)} placeholder="https://www.instagram.com/p/…" />
              {reporte.fuente_url && !/^https?:\/\/\S+$/i.test(reporte.fuente_url.trim()) && (
                <span style={{ display: "block", marginTop: 6, fontSize: 13, color: T.rojo }}>Debe empezar por http:// o https://</span>
              )}
            </Campo>

            {duplicados && (
              <section style={{
                border: `1.5px solid ${T.ambar}`, background: T.ambarClaro, borderRadius: 13,
                padding: "20px 22px", margin: "0 0 18px 25px",
              }}>
                <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: ".12em", color: "#8A5A12" }}>
                  ¿YA ESTÁ REGISTRADA?
                </div>
                <p style={{ margin: "8px 0 14px", fontSize: 15, lineHeight: 1.55 }}>
                  {duplicados.length === 1 ? "Hay una ficha" : `Hay ${duplicados.length} fichas`} del mismo
                  municipio, de fechas cercanas y muy parecida{duplicados.length > 1 ? "s" : ""} a la que vas a
                  guardar. Mira la foto: si es el mismo animal, no la repitas.
                </p>
                <div style={{ display: "grid", gap: 12 }}>
                  {duplicados.map(({ ficha, resultado }) => (
                    <Ficha key={ficha.id} r={ficha} resultado={resultado} nombres={null} voluntario={voluntario} adopcion={adopcionDe(ficha.id)} onAdopcion={ponerEnAdopcion} onQuitarAdopcion={quitarDeAdopcion} onReencontrar={marcarReencontrado} onAprobar={aprobar} onOcultar={ocultar} onMostrar={mostrarDeNuevo} onVer={verFicha} />
                  ))}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
                  <button type="button" onClick={() => {
                    setDuplicados(null);
                    setReporte({ senas: [], contacto_medio: "WhatsApp", fecha_hallazgo: new Date().toISOString().slice(0, 10) });
                    setSitioOtro(false);
      setSitioOtro(false);
      setMostrarMapa(false);
                    setArchivoFoto(null);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }} style={{
                    background: T.verde, color: T.blanco, border: "none", borderRadius: 9,
                    padding: "12px 18px", fontSize: 15, fontWeight: 660, cursor: "pointer",
                  }}>Es una de estas, no guardar</button>
                  <button type="button" onClick={() => guardarReporte(true)} disabled={guardando} style={{
                    background: "transparent", border: `1.5px solid ${T.linea}`, borderRadius: 9,
                    padding: "12px 18px", fontSize: 15, fontWeight: 560, cursor: "pointer", color: T.tinta,
                  }}>{guardando ? "Guardando…" : "No, es otro animal — guardar"}</button>
                </div>
              </section>
            )}

            {errorGuardar && (
              <p style={{ margin: "0 0 12px 25px", fontSize: 14, color: T.rojo }}>{errorGuardar}</p>
            )}

            <button type="button" onClick={() => guardarReporte(false)} disabled={guardando} style={{
              background: guardando ? T.tintaSuave : T.verde, color: T.blanco, border: "none",
              borderRadius: 10, padding: "16px 26px", fontSize: 17, fontWeight: 680,
              cursor: guardando ? "wait" : "pointer", marginLeft: 25, marginTop: 6,
            }}>{guardando ? "Guardando…" : editando ? "Guardar cambios" : "Guardar ficha"}</button>
            <p style={{ margin: "12px 0 0 25px", fontSize: 13, color: T.tintaSuave, lineHeight: 1.5 }}>
              Al guardar, autorizas que el contacto se publique en la ficha, solo para
              reunir al animal con su familia.{" "}
              <a href="/#aviso" onClick={irAlAviso} style={{ color: T.verde }}>Cómo cuidamos tus datos</a>
            </p>
          </section>
        )}

        {modo === "caso" && (
          <EstadoCaso codigoInicial={casoInicial} registros={registros} voluntario={voluntario}
            acciones={{ onAdopcion: ponerEnAdopcion, onQuitarAdopcion: quitarDeAdopcion, onReencontrar: marcarReencontrado, onAprobar: aprobar, onOcultar: ocultar, onMostrar: mostrarDeNuevo, onVer: verFicha }}
            onBuscarDeNuevo={() => { setResultados(null); setModo("buscar"); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        )}

        {modo === "panel" && voluntario && (
          <Panel registros={registros} voluntario={voluntario} refugios={refugios} adopcionDe={adopcionDe}
            onGuardarRefugio={guardarRefugio} onAsignarRefugio={asignarRefugio}
            acciones={{ onAdopcion: ponerEnAdopcion, onQuitarAdopcion: quitarDeAdopcion, onReencontrar: marcarReencontrado, onAprobar: aprobar, onOcultar: ocultar, onMostrar: mostrarDeNuevo, onVer: verFicha }} />
        )}

        {modo === "lista" && (
          <section>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18, alignItems: "center" }}>
              <span style={{ fontFamily: MONO, fontSize: 11.5, color: T.tintaSuave, marginRight: 4 }}>FILTRAR</span>
              <select value={filtroEspecie} onChange={(e) => setFiltroEspecie(e.target.value)}
                style={{ ...entradaTexto, maxWidth: 190, padding: "10px 12px", minHeight: 44 }}>
                <option value="">Todos los animales</option>
                {ESPECIE.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <Opcion activo={filtroAdopcion} onClick={() => setFiltroAdopcion((v) => !v)}>
                En adopción
              </Opcion>
              <select value={filtroMuni} onChange={(e) => setFiltroMuni(e.target.value)}
                style={{ ...entradaTexto, maxWidth: 210, padding: "10px 12px", minHeight: 44 }}>
                <option value="">Todos los municipios</option>
                {municipiosConRegistro.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              {refugios.some((x) => registros.some((r) => r.refugio_id === x.id)) && (
                <select value={filtroRefugio} onChange={(e) => setFiltroRefugio(e.target.value)}
                  style={{ ...entradaTexto, maxWidth: 260, padding: "10px 12px", minHeight: 44 }}>
                  <option value="">Todos los refugios</option>
                  {refugios.filter((x) => registros.some((r) => r.refugio_id === x.id)).map((x) => (
                    <option key={x.id} value={x.id}>{x.nombre}</option>
                  ))}
                </select>
              )}
              {voluntario && (
                <Opcion activo={verOcultas} onClick={() => setVerOcultas((v) => !v)}>
                  Ocultas ({ocultas})
                </Opcion>
              )}
            </div>
            {verOcultas && (
              <p style={{ margin: "-6px 0 14px", fontSize: 13.5, color: T.tintaSuave, lineHeight: 1.5 }}>
                Estas fichas solo las ven los voluntarios. El público no las encuentra ni en el listado, ni en la
                búsqueda, ni por enlace compartido.
              </p>
            )}

            <div style={{ display: "grid", gap: 14 }}>
              {cargando && <p style={{ color: T.tintaSuave, fontSize: 15 }}>Cargando fichas…</p>}
              {!cargando && listaFiltrada.map((r) => (
                <Ficha key={r.id} r={r} resultado={null} nombres={null} voluntario={voluntario} adopcion={adopcionDe(r.id)} onAdopcion={ponerEnAdopcion} onQuitarAdopcion={quitarDeAdopcion} onReencontrar={marcarReencontrado} onAprobar={aprobar} onOcultar={ocultar} onMostrar={mostrarDeNuevo} onVer={verFicha} />
              ))}
              {!cargando && listaFiltrada.length === 0 && (
                <div style={{
                  border: `1px solid ${T.linea}`, borderRadius: 12, background: T.blanco,
                  padding: "24px 22px", color: T.tintaSuave, fontSize: 15,
                }}>
                  No hay fichas con esos filtros. Quita alguno para ver más.
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <footer style={{ borderTop: `1px solid ${T.linea}`, background: T.blanco }}>
        <div style={{
          maxWidth: 940, margin: "0 auto", padding: "18px 20px 26px", fontSize: 14,
          color: T.tintaSuave, lineHeight: 1.6, display: "flex", flexWrap: "wrap", gap: "6px 22px",
        }}>
          <span style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: ".12em", alignSelf: "center" }}>CONTACTO</span>
          <a href={CONTACTO_WHATSAPP} target="_blank" rel="noreferrer" style={{ color: T.verde, fontWeight: 620 }}>{CONTACTO_CELULAR}</a>
          <a href={`mailto:${CONTACTO_DATOS}`} style={{ color: T.verde, fontWeight: 620 }}>{CONTACTO_DATOS}</a>
          <a href="/#aviso" onClick={irAlAviso} style={{ color: T.tintaSuave, textDecoration: "underline" }}>Política de datos y quiénes somos</a>
        </div>
      </footer>
      {detalle && (
        <Detalle r={detalle} voluntario={voluntario} adopcion={adopcionDe(detalle.id)} onCerrar={cerrarFicha}
          onAdopcion={ponerEnAdopcion} onQuitarAdopcion={quitarDeAdopcion}
          onReencontrar={marcarReencontrado} onAprobar={aprobar} onOcultar={ocultar} onEditar={editarFicha} />
      )}
      {voluntario && (
        <button type="button" onClick={() => setVerMisCambios(true)} title="Mis últimos cambios" style={{
          position: "fixed", right: 16, bottom: 16, zIndex: 40,
          background: T.blanco, border: `1.5px solid ${T.linea}`, borderRadius: 24,
          padding: "10px 15px", fontSize: 13.5, fontWeight: 620, color: T.tinta, cursor: "pointer",
          boxShadow: "0 4px 14px rgba(0,0,0,.12)", fontFamily: FUENTE,
        }}>⟲ Mis cambios</button>
      )}
      {voluntario && verMisCambios && (
        <MisCambios voluntario={voluntario} onDeshacer={deshacerCambio} onCerrar={() => setVerMisCambios(false)} />
      )}
    </div>
  );
}
