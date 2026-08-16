# -*- coding: utf-8 -*-
# ============================================================
# Siembra datos de PRUEBA en el entorno de staging.
#
# Crea ~30 fichas inventadas (varios municipios, especies, colores, algunas
# reencontradas, dos "gemelas", un duplicado evidente), unas busquedas
# abiertas, y una imagen generada por ficha subida a R2 bajo staging/.
#
# Uso (requiere `npx supabase login`, `npx wrangler login` y el proyecto
# de staging enlazado con `npx supabase link`):
#
#   python scripts/semilla-staging.py
#
# NUNCA apunta a produccion: usa --linked (staging) y el prefijo staging/.
# ============================================================

import json, os, random, subprocess, sys, tempfile, uuid
from PIL import Image, ImageDraw, ImageFont

random.seed(7)
HOST = "https://huellas-a-casa.huellas-a-casa.workers.dev"
BUCKET = "huellas-fotos"

COLORES = {
    "Blanco": (242, 240, 235), "Negro": (34, 37, 43), "Café": (107, 68, 41),
    "Beige o crema": (220, 196, 155), "Gris": (154, 160, 168), "Naranja": (201, 122, 43),
    "Atigrado": (138, 106, 62), "Tricolor": (122, 92, 66), "Blanco con manchas": (207, 202, 194),
}

def ficha(**k):
    base = dict(
        especie="Perro", tamano="Mediano", color="Café", pelo="Corto", sexo="Macho", edad="Adulto",
        orejas="Caídas", cola="Larga", senas=[], collar_color=None,
        departamento="Risaralda", municipio="Pereira", barrio="Centro",
        fecha_hallazgo="2026-08-10", custodio="Refugio", lugar="Refugio de prueba",
        contacto_nombre="Voluntaria de prueba", contacto_telefono="3000000000", contacto_medio="WhatsApp",
        nota=None, estado="resguardo", verificado=True, lugar_mapa=None, fuente_url=None,
    )
    base.update(k)
    return base

F = [
    # Pereira: variedad
    ficha(color="Negro", tamano="Grande", pelo="Medio", barrio="Cuba", nota="Muy asustado, se esconde. Tiene el hocico canoso.", senas=["Llevaba collar"], collar_color="Rojo",
          lugar_mapa="https://maps.app.goo.gl/ejemplo1", fuente_url="https://www.instagram.com/p/ejemplo1/"),
    ficha(color="Blanco", tamano="Pequeño", pelo="Largo", sexo="Hembra", edad="Mayor", barrio="Álamos", nota="Cojea de la pata trasera derecha", senas=["Cojea"]),
    ficha(especie="Gato", color="Atigrado", tamano="Pequeño", sexo="Hembra", edad="Joven", orejas="Paradas", barrio="Pinares", nota="Muy cariñosa, ronronea"),
    ficha(especie="Gato", color="Naranja", tamano="Pequeño", sexo="Macho", edad="Adulto", orejas="Paradas", barrio="El Poblado", senas=["Tiene placa"], collar_color="Azul"),
    ficha(color="Beige o crema", tamano="Mediano", edad="Cachorro", barrio="Villa Santana", custodio="Hogar temporal", lugar=None, contacto_nombre="Familia Gómez", nota="Juguetón, come bien"),
    ficha(color="Tricolor", tamano="Mediano", sexo="Hembra", cola="Corta o mocha", barrio="Samaria", verificado=False, nota="Recogida en la vía, muy delgada", senas=["Está herido"]),
    # Gemelas en Pereira (para la alerta al marcar reencuentro)
    ficha(color="Café", tamano="Mediano", pelo="Corto", sexo="Macho", edad="Adulto", orejas="Caídas", cola="Larga", barrio="La Villa", collar_color="Negro", senas=["Llevaba collar"], nota="Manso, hocico blanco"),
    ficha(color="Café", tamano="Mediano", pelo="Corto", sexo="Macho", edad="Adulto", orejas="Caídas", cola="Larga", barrio="Boston", collar_color="Negro", senas=["Llevaba collar"], nota="Tranquilo, canoso"),
    # Reencontrados
    ficha(color="Gris", tamano="Grande", pelo="Corto", barrio="Circunvalar", estado="reencontrado", nota="Volvió con su familia el 12 de agosto"),
    ficha(especie="Gato", color="Negro", tamano="Pequeño", sexo="No sé", edad="Joven", orejas="Paradas", barrio="Los Alpes", estado="reencontrado"),
    # Dosquebradas / Santa Rosa
    ficha(municipio="Dosquebradas", color="Blanco con manchas", tamano="Mediano", sexo="Hembra", barrio="La Pradera", nota="Manchas negras en el lomo", lugar_mapa="https://maps.app.goo.gl/ejemplo2"),
    ficha(municipio="Dosquebradas", especie="Gato", color="Gris", tamano="Pequeño", edad="Cachorro", orejas="Paradas", barrio="Frailes", custodio="Casa de familia", lugar=None, contacto_medio="Instagram", contacto_telefono="@familia.frailes"),
    ficha(municipio="Santa Rosa de Cabal", color="Negro", tamano="Pequeño", pelo="Largo", sexo="Hembra", edad="Mayor", barrio="Centro", custodio="Veterinaria", lugar="Vet. San Francisco", contacto_medio="Correo", contacto_telefono="vet@example.com"),
    ficha(municipio="La Virginia", color="Naranja", tamano="Grande", pelo="Medio", orejas="Paradas", barrio="Balsillas", verificado=False),
    # Quindío
    ficha(departamento="Quindío", municipio="Armenia", color="Café", tamano="Grande", pelo="Largo", sexo="Hembra", barrio="La Castellana", nota="Parece de raza, muy educada", senas=["Tiene chip"]),
    ficha(departamento="Quindío", municipio="Armenia", especie="Gato", color="Blanco", tamano="Pequeño", sexo="Macho", edad="Adulto", orejas="Paradas", barrio="Granada", nota="Ojo izquierdo lagrimoso"),
    ficha(departamento="Quindío", municipio="Calarcá", color="Atigrado", tamano="Mediano", edad="Joven", barrio="Centro", collar_color="Verde", senas=["Llevaba collar"]),
    ficha(departamento="Quindío", municipio="Salento", color="Beige o crema", tamano="Pequeño", pelo="Largo", edad="Cachorro", barrio="Vereda Boquía", custodio="Hogar temporal", lugar=None),
    ficha(departamento="Quindío", municipio="Montenegro", color="Negro", tamano="Mediano", sexo="Hembra", cola="Enroscada", barrio="La Isabela"),
    # Caldas
    ficha(departamento="Caldas", municipio="Manizales", color="Gris", tamano="Mediano", pelo="Medio", orejas="Una de cada una", barrio="Palermo", nota="Una oreja caída y otra parada", lugar_mapa="https://maps.app.goo.gl/ejemplo3"),
    ficha(departamento="Caldas", municipio="Manizales", especie="Gato", color="Tricolor", tamano="Pequeño", sexo="Hembra", edad="Adulto", orejas="Paradas", barrio="Chipre"),
    ficha(departamento="Caldas", municipio="Villamaría", color="Blanco", tamano="Grande", pelo="Corto", edad="Mayor", barrio="Centro", nota="Sordo, hay que acercarse de frente", verificado=False),
    ficha(departamento="Caldas", municipio="Chinchiná", color="Café", tamano="Pequeño", pelo="Corto", sexo="Hembra", edad="Joven", barrio="La Cristalina", estado="reencontrado"),
    ficha(departamento="Caldas", municipio="La Dorada", color="Naranja", tamano="Mediano", pelo="Corto", barrio="Las Ferias"),
    # Valle
    ficha(departamento="Valle del Cauca", municipio="Cartago", color="Negro", tamano="Grande", pelo="Corto", sexo="Macho", edad="Adulto", barrio="El Prado", senas=["Cicatriz visible"], nota="Cicatriz en la pata delantera"),
    ficha(departamento="Valle del Cauca", municipio="Cartago", especie="Gato", color="Beige o crema", tamano="Pequeño", edad="Joven", orejas="Paradas", barrio="Santa Ana"),
    ficha(departamento="Valle del Cauca", municipio="Tuluá", color="Blanco con manchas", tamano="Mediano", pelo="Medio", sexo="Hembra", barrio="Centro", fuente_url="https://www.facebook.com/ejemplo"),
    ficha(departamento="Valle del Cauca", municipio="Zarzal", color="Café", tamano="Mediano", edad="Cachorro", barrio="Centro", custodio="Casa de familia", lugar=None),
    # Otro
    ficha(especie="Otro", color="Blanco", tamano="Pequeño", pelo="Corto", sexo="No sé", edad="Adulto", orejas="Paradas", cola="Corta o mocha", barrio="Cerritos", nota="Conejo blanco, muy manso"),
]

BUSQUEDAS = [
    dict(especie="Perro", tamano="Mediano", color="Café", pelo="Corto", sexo="Macho", edad="Adulto", departamento="Risaralda", municipio="Pereira", barrio="La Villa", nota="Tiene el hocico blanco, se llama Toby", nombres="Toby", contacto_telefono="3111111111", contacto_medio="WhatsApp", estado="abierta"),
    dict(especie="Gato", tamano="Pequeño", color="Naranja", sexo="Macho", departamento="Risaralda", municipio="Pereira", nombres="Garfield", contacto_telefono="3122222222", contacto_medio="WhatsApp", estado="abierta"),
    dict(especie="Perro", tamano="Grande", color="Negro", departamento="Valle del Cauca", municipio="Cartago", nota="cicatriz en una pata", nombres="Rocky", contacto_telefono="rocky@example.com", contacto_medio="Correo", estado="abierta"),
]

def foto(color, especie, codigo_texto, ruta_salida, ancho):
    rgb = COLORES.get(color, (150, 150, 150))
    img = Image.new("RGB", (ancho, ancho), rgb)
    d = ImageDraw.Draw(img)
    # Silueta simple: cabeza (circulo) + cuerpo (elipse), tono contrastado
    t = tuple(min(255, c + 60) if sum(rgb) < 380 else max(0, c - 60) for c in rgb)
    w = ancho
    d.ellipse([w*0.28, w*0.45, w*0.78, w*0.85], fill=t)
    d.ellipse([w*0.55, w*0.22, w*0.85, w*0.52], fill=t)
    if especie == "Gato":
        d.polygon([(w*0.58, w*0.28), (w*0.62, w*0.14), (w*0.68, w*0.28)], fill=t)
        d.polygon([(w*0.74, w*0.28), (w*0.80, w*0.14), (w*0.84, w*0.28)], fill=t)
    try:
        f = ImageFont.truetype("arial.ttf", int(w * 0.09))
    except Exception:
        f = ImageFont.load_default()
    texto = f"PRUEBA · {codigo_texto}"
    d.rectangle([0, w*0.9, w, w], fill=(0, 0, 0))
    d.text((w*0.03, w*0.915), texto, fill=(255, 255, 255), font=f)
    img.save(ruta_salida, "JPEG", quality=80)

def run(cmd, entrada=None):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, input=entrada, encoding="utf-8")
    if r.returncode != 0:
        print(r.stdout[-800:], r.stderr[-800:]); sys.exit(1)
    return r.stdout

def sql_val(v):
    if v is None: return "null"
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, list): return "array[" + ",".join(sql_val(x) for x in v) + "]::text[]" if v else "'{}'::text[]"
    return "'" + str(v).replace("'", "''") + "'"

def main():
    tmp = tempfile.mkdtemp()
    filas = []
    for i, f in enumerate(F, 1):
        fid = str(uuid.uuid4())
        sello = 1755300000 + i
        etiqueta = f"{f['especie']} {f['color']}"
        urls = {}
        if i % 5 != 0:  # unas pocas quedan sin foto, como en la vida real
            for nombre, ancho in (("grande", 1000), ("mini", 320)):
                ruta = f"staging/{fid}/{sello}-{nombre}.jpg"
                local = os.path.join(tmp, f"{i}-{nombre}.jpg")
                foto(f["color"], f["especie"], etiqueta, local, ancho)
                run(f'npx wrangler r2 object put "{BUCKET}/{ruta}" --remote --file "{local}" --content-type image/jpeg --cache-control "public, max-age=31536000, immutable"')
                urls["foto_url" if nombre == "grande" else "foto_thumb_url"] = f"{HOST}/fotos/{ruta}"
            print(f"foto {i}/{len(F)} subida")
        fila = dict(id=fid, **f, **urls)
        filas.append(fila)

    cols = ["id","especie","tamano","color","pelo","sexo","edad","orejas","cola","senas","collar_color","departamento","municipio","barrio",
            "fecha_hallazgo","custodio","lugar","contacto_nombre","contacto_telefono","contacto_medio","nota","estado","verificado",
            "lugar_mapa","fuente_url","foto_url","foto_thumb_url"]
    values = ",\n".join("(" + ",".join(sql_val(r.get(c)) for c in cols) + ")" for r in filas)
    sql = f"insert into mascotas ({','.join(cols)}) values\n{values};\n"

    bcols = ["especie","tamano","color","pelo","sexo","edad","departamento","municipio","barrio","nota","nombres","contacto_telefono","contacto_medio","estado"]
    bvals = ",\n".join("(" + ",".join(sql_val(b.get(c)) for c in bcols) + ")" for b in BUSQUEDAS)
    sql += f"insert into busquedas ({','.join(bcols)}) values\n{bvals};\n"
    sql += "select count(*) as mascotas from mascotas;"

    ruta_sql = os.path.join(tmp, "semilla.sql")
    open(ruta_sql, "w", encoding="utf-8").write(sql)
    out = run(f'npx supabase db query --linked --file "{ruta_sql}"')
    print(out[-300:])

if __name__ == "__main__":
    main()
