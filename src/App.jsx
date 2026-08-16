import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase, configurado } from "./lib/supabase.js";
import { subirFoto, comprimir } from "./lib/foto.js";
import { entrar, salir, sesionActual, alCambiarSesion } from "./lib/sesion.js";
import { buscarCoincidencias, posiblesDuplicados, fichasGemelas, empatadosArriba } from "./lib/coincidencia.js";
import { extraerConceptos, etiquetaDe } from "./lib/conceptos.js";
import {
  ESPECIE, TAMANO, TAMANO_PISTA, COLOR, COLOR_MUESTRA, PELO, SEXO, EDAD,
  OREJAS, COLA, SENAS, COLOR_COLLAR, CUSTODIO, MUNICIPIOS,
} from "./lib/catalogo.js";

const T = {
  papel: "#F6F4F0", papelHondo: "#EBE7E0", tinta: "#1B2029", tintaSuave: "#5A6272",
  linea: "#D8D2C8", verde: "#2F6F5E", verdeClaro: "#E4EFEA", ambar: "#D9922B",
  ambarClaro: "#FBF0DC", violeta: "#6B4E8F", violetaClaro: "#EFE9F5",
  rojo: "#B03A28", blanco: "#FFFFFF",
};

// Canal para pedir correccion o retiro de datos personales. CAMBIAR por
// el correo o WhatsApp real del grupo de voluntarios antes de difundir.
const CONTACTO_DATOS = "huellasacasa.eje@gmail.com";

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

const botonSecundario = (color) => ({
  background: "transparent", border: `1.5px solid ${color === T.verde ? T.verde : T.linea}`,
  color, padding: "9px 13px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
});

function Entrar({ onListo }) {
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

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
    </form>
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

function Ficha({ r, resultado, nombres, voluntario, onReencontrar, onAprobar, onOcultar }) {
  const reencontrado = r.estado === "reencontrado";
  const senas = r.senas || [];
  return (
    <article style={{
      background: T.blanco, border: `1px solid ${T.linea}`,
      borderLeft: `4px solid ${reencontrado ? T.verde : T.ambar}`,
      borderRadius: 12, overflow: "hidden", opacity: reencontrado ? 0.72 : 1,
    }}>
      <div style={{ display: "flex" }}>
        <div style={{ width: 116, flexShrink: 0, borderRight: `1px solid ${T.linea}` }}>
          {r.foto_thumb_url ? (
            <img src={r.foto_thumb_url} alt="" loading="lazy"
              style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }} />
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
                {!r.verificado && (
                  <span style={{ marginLeft: 8, color: T.ambar }}>SIN VERIFICAR</span>
                )}
              </div>
              <h4 style={{ margin: "2px 0 0", fontSize: 17, fontWeight: 700, letterSpacing: "-.015em" }}>
                {r.especie} {r.tamano?.toLowerCase()}, {r.color?.toLowerCase()}
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
            </div>
          )}

          {r.nota && (
            <p style={{ margin: "9px 0 0", fontSize: 13.5, fontStyle: "italic", lineHeight: 1.5 }}>
              “{r.nota}”
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
                  Escribir a {r.contacto_nombre}{r.contacto_medio && r.contacto_medio !== "WhatsApp" ? ` por ${r.contacto_medio}` : ""}
                </a>
                {r.lugar_mapa && (
                  <a href={r.lugar_mapa} target="_blank" rel="noreferrer" style={{
                    background: "transparent", border: `1.5px solid ${T.verde}`, color: T.verde,
                    textDecoration: "none", padding: "9px 13px", borderRadius: 8, fontSize: 13.5, fontWeight: 600,
                  }}>Cómo llegar</a>
                )}
                {voluntario && (
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
                  </>
                )}
              </>
            )}
          </div>
        </div>
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
            animal, el municipio y barrio, y un nombre y un contacto (WhatsApp, correo o Instagram).</li>
          <li><strong style={{ fontWeight: 660 }}>Para qué:</strong> únicamente para reunir animales
            con sus familias. No los usamos para nada más ni se los pasamos a nadie.</li>
          <li><strong style={{ fontWeight: 660 }}>Quién los ve:</strong> el nombre y WhatsApp de
            quien cuida un animal <em>se publican</em> en su ficha, para que el tutor pueda escribir.
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

function CargarFoto({ archivo, onArchivo }) {
  const ref = useRef(null);
  const [vista, setVista] = useState(null);
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
        <button
          type="button" onClick={() => ref.current?.click()}
          style={{
            padding: "12px 16px", borderRadius: 9, border: `1.5px dashed ${T.linea}`,
            background: T.blanco, fontSize: 14.5, fontWeight: 560, cursor: "pointer",
          }}
        >
          {archivo ? "Cambiar foto" : "Tomar o subir foto"}
        </button>
        <input ref={ref} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={elegir} />
      </div>
      {error && <p style={{ margin: "8px 0 0", fontSize: 13, color: T.rojo }}>{error}</p>}
    </div>
  );
}

function NotaLibre({ valor, onCambio, numero, titulo, ayuda, placeholder }) {
  const detectados = extraerConceptos(valor);
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
    set("senas", actual.includes(s) ? actual.filter((x) => x !== s) : [...actual, s]);
  };
  return (
    <>
      <Campo numero={n(0)} titulo="¿Qué animal es?">
        {ESPECIE.map((o) => <Opcion key={o} activo={v.especie === o} onClick={() => set("especie", o)}>{o}</Opcion>)}
      </Campo>
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
      {(v.senas || []).includes("Llevaba collar") && (
        <Campo numero={`${n(8)}b`} titulo="Color del collar" opcional>
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
  const [modo, setModo] = useState("inicio");

  const [busqueda, setBusqueda] = useState({ senas: [], contacto_medio: "WhatsApp" });
  const [resultados, setResultados] = useState(null);

  const [reporte, setReporte] = useState({ senas: [], contacto_medio: "WhatsApp", fecha_hallazgo: new Date().toISOString().slice(0, 10) });
  const [archivoFoto, setArchivoFoto] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState("");
  const [guardado, setGuardado] = useState(null);
  const [duplicados, setDuplicados] = useState(null);
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const [sesion, setSesion] = useState(null);
  const voluntario = sesion?.voluntario || null;

  const [filtroEspecie, setFiltroEspecie] = useState("");
  const [filtroMuni, setFiltroMuni] = useState("");

  const setB = (k, v) => setBusqueda((p) => ({ ...p, [k]: v }));
  const setR = (k, v) => setReporte((p) => ({ ...p, [k]: v }));

  async function cargar() {
    setCargando(true);
    const { data, error } = await supabase
      .from("mascotas")
      .select("*")
      .neq("estado", "oculto")
      .order("creado_en", { ascending: false })
      .limit(1000);

    if (!configurado) setErrorCarga("La página no tiene configurada la conexión a la base de datos. Avisa a quien administra el sitio.");
    else if (error) setErrorCarga("No se pudo cargar el listado. Revisa tu conexión y vuelve a intentar.");
    else { setRegistros(data || []); setErrorCarga(""); }
    setCargando(false);
  }

  useEffect(() => { cargar(); }, []);
  useEffect(() => {
    sesionActual().then(setSesion);
    return alCambiarSesion(setSesion);
  }, []);

  const enResguardo = registros.filter((r) => r.estado === "resguardo").length;
  const reencontrados = registros.filter((r) => r.estado === "reencontrado").length;

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
    setRegistros((p) => p.filter((x) => x.id !== r.id));
  }

  function buscar() {
    const activas = registros.filter((r) => r.estado === "resguardo");
    setResultados(buscarCoincidencias(busqueda, activas));
    if (busqueda.especie) {
      supabase.from("busquedas").insert([{ ...busqueda, estado: "abierta" }]).then(() => {});
    }
  }

  async function guardarReporte(ignorarDuplicados = false) {
    const obligatorios = ["especie", "tamano", "color", "departamento", "municipio", "contacto_nombre", "contacto_telefono"];
    const faltan = obligatorios.filter((k) => !reporte[k]);
    if (faltan.length) {
      setErrorGuardar("Faltan datos obligatorios. Revisa especie, tamaño, color, ubicación y contacto.");
      return;
    }
    if (reporte.lugar_mapa && !esEnlaceMapa(reporte.lugar_mapa)) {
      setErrorGuardar("El enlace del sitio debe ser de Google Maps (empieza por https://maps.app.goo.gl/ o https://www.google.com/maps/).");
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
      const { data, error } = await supabase
        .from("mascotas")
        .insert([{ ...reporte, estado: "resguardo", verificado: false }])
        .select()
        .single();
      if (error) throw new Error("No se pudo guardar la ficha. Revisa tu conexión.");

      if (archivoFoto) {
        try {
          const urls = await subirFoto(archivoFoto, data.codigo);
          await supabase.from("mascotas").update(urls).eq("id", data.id);
          Object.assign(data, urls);
        } catch {
          // La ficha ya quedó guardada. La foto se puede agregar después.
        }
      }

      setRegistros((p) => [data, ...p]);
      setGuardado(data.codigo);
      setReporte({ senas: [], contacto_medio: "WhatsApp", fecha_hallazgo: new Date().toISOString().slice(0, 10) });
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
      (!filtroEspecie || r.especie === filtroEspecie) &&
      (!filtroMuni || r.municipio === filtroMuni)),
    [registros, filtroEspecie, filtroMuni]
  );

  const municipiosConRegistro = useMemo(
    () => [...new Set(registros.map((r) => r.municipio))].sort(), [registros]
  );

  const btnModo = (id, etiqueta, sub) => (
    <button
      type="button"
      onClick={() => { setModo(id); setResultados(null); setGuardado(null); setErrorGuardar(""); setDuplicados(null); }}
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
          <p style={{ margin: "7px 0 0", fontSize: 15.5, color: T.tintaSuave, maxWidth: 560, lineHeight: 1.5 }}>
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
          {btnModo("lista", "Ver todos los registros", cargando ? "Cargando…" : `${registros.length} fichas`)}
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

        {modo === "entrar" && !sesion && <Entrar onListo={() => setModo("lista")} />}
        {modo === "entrar" && sesion && (
          <div style={{ border: `1px solid ${T.linea}`, borderRadius: 13, background: T.blanco, padding: "22px 24px", fontSize: 15, lineHeight: 1.6 }}>
            Ya tienes la sesión iniciada. Ve a <a href="#" onClick={(e) => { e.preventDefault(); setModo("lista"); }} style={{ color: T.verde }}>Ver todos los registros</a>.
          </div>
        )}
        {sesion && !voluntario && modo !== "entrar" && (
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
              valor={busqueda.nota} onCambio={(v) => setB("nota", v)}
              placeholder="Ej.: renquea de una pata de atrás, tiene una manchita blanca en el pecho"
            />

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
              <a href="#aviso" onClick={() => setModo("inicio")} style={{ color: T.verde }}>Cómo cuidamos tus datos</a>
            </p>
            <button type="button" onClick={buscar} style={{
              background: T.verde, color: T.blanco, border: "none", borderRadius: 10,
              padding: "16px 26px", fontSize: 17, fontWeight: 680, cursor: "pointer",
              marginLeft: 25, marginTop: 6,
            }}>Buscar coincidencias</button>
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

            {resultados.length === 0 ? (
              <div style={{
                border: `1px solid ${T.linea}`, borderRadius: 12, background: T.blanco,
                padding: "24px 22px", fontSize: 15, lineHeight: 1.6, color: T.tintaSuave,
              }}>
                Ningún registro coincide lo suficiente por ahora. Guardamos tu búsqueda: si dejaste
                WhatsApp, los voluntarios te avisan cuando llegue algo parecido.
              </div>
            ) : (
              <>
                <p style={{ margin: "0 0 16px", fontSize: 14, color: T.tintaSuave, lineHeight: 1.5 }}>
                  Ordenadas por parecido. El porcentaje viene de los datos, no de la foto: mira siempre
                  la imagen antes de escribir.
                </p>
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
                      nombres={busqueda.nombres} voluntario={voluntario} onReencontrar={marcarReencontrado} onAprobar={aprobar} onOcultar={ocultar} />
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {modo === "reportar" && guardado && (
          <section style={{ border: `1.5px solid ${T.verde}`, background: T.verdeClaro, borderRadius: 13, padding: "26px 24px" }}>
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: ".12em", color: T.verde }}>FICHA CREADA</div>
            <h2 style={{ margin: "8px 0 6px", fontSize: 26, fontWeight: 740, letterSpacing: "-.02em" }}>{guardado}</h2>
            <p style={{ margin: "0 0 18px", fontSize: 15, color: T.tintaSuave, lineHeight: 1.55 }}>
              Anota este código en la jaula o el guacal. Es el que se usa para confirmar la entrega.
            </p>
            <button type="button" onClick={() => setGuardado(null)} style={{
              background: T.verde, color: T.blanco, border: "none", borderRadius: 9,
              padding: "13px 20px", fontSize: 15.5, fontWeight: 660, cursor: "pointer",
            }}>Registrar la siguiente mascota</button>
          </section>
        )}

        {modo === "reportar" && !guardado && (
          <section>
            <div style={{
              background: T.verdeClaro, border: "1px solid #CBE0D6", borderRadius: 11,
              padding: "14px 16px", marginBottom: 24, fontSize: 14.5, lineHeight: 1.5,
            }}>
              Una ficha por animal. La foto es para que el tutor reconozca: tómala con luz y de cuerpo entero.
            </div>

            <Campo numero="00" titulo="Foto de la mascota">
              <CargarFoto archivo={archivoFoto} onArchivo={setArchivoFoto} />
            </Campo>

            <Zona v={reporte} set={setR} numero="01" />

            <Campo numero="02" titulo="Barrio o vereda donde apareció">
              <input style={entradaTexto} value={reporte.barrio || ""}
                onChange={(e) => setR("barrio", e.target.value)} placeholder="Ej.: Cuba" />
            </Campo>

            <Rasgos v={reporte} set={setR} desde={3} />

            <Campo numero="12" titulo="Fecha en que lo recogieron">
              <input type="date" style={{ ...entradaTexto, maxWidth: 210 }}
                value={reporte.fecha_hallazgo || ""} onChange={(e) => setR("fecha_hallazgo", e.target.value)} />
            </Campo>

            <Campo numero="13" titulo="¿Dónde está ahora?">
              {CUSTODIO.map((o) => <Opcion key={o} activo={reporte.custodio === o} onClick={() => setR("custodio", o)}>{o}</Opcion>)}
            </Campo>

            <Campo numero="14" titulo="Nombre del refugio o del sitio" opcional>
              <input style={entradaTexto} value={reporte.lugar || ""}
                onChange={(e) => setR("lugar", e.target.value)} placeholder="Ej.: Albergue Huellas de Esperanza" />
            </Campo>

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

            <Campo numero="15" titulo="Quién responde y por dónde"
              ayuda="Este nombre y contacto se publican en la ficha para que el tutor escriba. Pon el del refugio o un número que puedas mostrar; no uses uno personal si no quieres que quede visible.">
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <input style={entradaTexto} value={reporte.contacto_nombre || ""}
                  onChange={(e) => setR("contacto_nombre", e.target.value)} placeholder="Nombre de quien atiende" />
                <CampoContacto medio={reporte.contacto_medio} valor={reporte.contacto_telefono}
                  onMedio={(m) => setR("contacto_medio", m)} onValor={(v) => setR("contacto_telefono", v)} />
              </div>
            </Campo>

            <NotaLibre
              numero="16" titulo="Qué observaste del animal"
              ayuda="Escríbelo como te salga. Sirve para cruzar con lo que cuente el tutor."
              valor={reporte.nota} onCambio={(v) => setR("nota", v)}
              placeholder="Ej.: muy asustadito, se esconde. Tiene el hocico canoso."
            />

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
                    <Ficha key={ficha.id} r={ficha} resultado={resultado} nombres={null} voluntario={voluntario} onReencontrar={marcarReencontrado} onAprobar={aprobar} onOcultar={ocultar} />
                  ))}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
                  <button type="button" onClick={() => {
                    setDuplicados(null);
                    setReporte({ senas: [], contacto_medio: "WhatsApp", fecha_hallazgo: new Date().toISOString().slice(0, 10) });
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
            }}>{guardando ? "Guardando…" : "Guardar ficha"}</button>
            <p style={{ margin: "12px 0 0 25px", fontSize: 13, color: T.tintaSuave, lineHeight: 1.5 }}>
              Al guardar, autorizas que el nombre y el contacto se publiquen en la ficha, solo para
              reunir al animal con su familia.{" "}
              <a href="#aviso" onClick={() => setModo("inicio")} style={{ color: T.verde }}>Cómo cuidamos tus datos</a>
            </p>
          </section>
        )}

        {modo === "lista" && (
          <section>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18, alignItems: "center" }}>
              <span style={{ fontFamily: MONO, fontSize: 11.5, color: T.tintaSuave, marginRight: 4 }}>FILTRAR</span>
              <Opcion activo={!filtroEspecie} onClick={() => setFiltroEspecie("")}>Todas</Opcion>
              {ESPECIE.map((o) => <Opcion key={o} activo={filtroEspecie === o} onClick={() => setFiltroEspecie(o)}>{o}</Opcion>)}
              <select value={filtroMuni} onChange={(e) => setFiltroMuni(e.target.value)}
                style={{ ...entradaTexto, maxWidth: 210, padding: "10px 12px", minHeight: 44 }}>
                <option value="">Todos los municipios</option>
                {municipiosConRegistro.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              {cargando && <p style={{ color: T.tintaSuave, fontSize: 15 }}>Cargando fichas…</p>}
              {!cargando && listaFiltrada.map((r) => (
                <Ficha key={r.id} r={r} resultado={null} nombres={null} voluntario={voluntario} onReencontrar={marcarReencontrado} onAprobar={aprobar} onOcultar={ocultar} />
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
    </div>
  );
}
