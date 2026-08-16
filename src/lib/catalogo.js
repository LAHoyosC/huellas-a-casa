// Vocabulario cerrado de toda la aplicacion.
// Si cambias algo aqui, revisa tambien los CHECK de supabase/schema.sql.

export const ESPECIE = ["Perro", "Gato", "Otro"];

export const TAMANO = ["Pequeño", "Mediano", "Grande"];
export const TAMANO_PISTA = {
  Pequeño: "hasta 10 kg",
  Mediano: "10 a 25 kg",
  Grande: "más de 25 kg",
};

export const COLOR = [
  "Blanco",
  "Negro",
  "Café",
  "Beige o crema",
  "Gris",
  "Naranja",
  "Atigrado",
  "Tricolor",
  "Blanco con manchas",
];

export const COLOR_MUESTRA = {
  Blanco: "#F2F0EB",
  Negro: "#22252B",
  Café: "#6B4429",
  "Beige o crema": "#DCC49B",
  Gris: "#9AA0A8",
  Naranja: "#C97A2B",
  Atigrado: "#8A6A3E",
  Tricolor: "#7A5C42",
  "Blanco con manchas": "#CFCAC2",
};

// Colores que la gente confunde entre si. Suman parcial, no cero.
export const COLOR_VECINO = {
  Blanco: ["Beige o crema", "Blanco con manchas"],
  "Beige o crema": ["Blanco", "Café", "Naranja"],
  Café: ["Atigrado", "Beige o crema", "Negro"],
  Atigrado: ["Café", "Gris", "Naranja"],
  Gris: ["Negro", "Atigrado"],
  Negro: ["Gris", "Café"],
  Naranja: ["Beige o crema", "Atigrado"],
  Tricolor: ["Blanco con manchas", "Café"],
  "Blanco con manchas": ["Blanco", "Tricolor"],
};

export const PELO = ["Corto", "Medio", "Largo"];
export const SEXO = ["Macho", "Hembra", "No sé"];
export const EDAD = ["Cachorro", "Joven", "Adulto", "Mayor"];
export const OREJAS = ["Paradas", "Caídas", "Una de cada una"];
export const COLA = ["Larga", "Corta o mocha", "Enroscada"];

export const SENAS = [
  "Llevaba collar",
  "Tiene placa",
  "Tiene chip",
  "Cicatriz visible",
  "Cojea",
  "Está herido",
  "Ojos claros",
  "Esterilizado",
  "Está preñada o lactando",
  "Muy asustado",
];

export const COLOR_COLLAR = ["Rojo", "Azul", "Negro", "Verde", "Rosado", "Café", "Otro color"];

export const CUSTODIO = ["Refugio", "Hogar temporal", "Casa de familia", "Veterinaria"];

export const MUNICIPIOS = {
  Risaralda: [
    "Pereira", "Dosquebradas", "Santa Rosa de Cabal", "La Virginia", "Marsella",
    "Belén de Umbría", "Apía", "Santuario", "Quinchía", "Guática", "Balboa",
    "La Celia", "Mistrató", "Pueblo Rico",
  ],
  Quindío: [
    "Armenia", "Calarcá", "Circasia", "La Tebaida", "Montenegro", "Quimbaya",
    "Filandia", "Salento", "Córdoba", "Buenavista", "Pijao", "Génova",
  ],
  Caldas: [
    "Manizales", "Villamaría", "Chinchiná", "Palestina", "Neira", "Anserma",
    "Riosucio", "La Dorada", "Manzanares", "Salamina", "Aguadas",
  ],
  "Valle del Cauca": [
    "Cali", "Cartago", "Tuluá", "Buga", "Palmira", "Zarzal", "La Unión",
    "Sevilla", "Caicedonia", "Roldanillo", "Obando",
  ],
};
