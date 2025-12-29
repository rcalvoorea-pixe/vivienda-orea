/*************************************************
 * CONFIGURACIÓN
 *************************************************/
const API_URL =
  "https://script.google.com/macros/s/AKfycbyAQ-iN-QYbI1UPFyE7ehXIow-hmiLtdJ8hl-gAoDtYXf39vvNecCNtNkaxfXz8VnjH/exec";

/*************************************************
 * UTILIDADES
 *************************************************/
function norm(v) {
  return (v ?? "").toString().trim().toLowerCase();
}

function fmtPrice(p, moneda = "EUR") {
  const n = Number(String(p).replace(",", "."));
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: moneda
  }).format(n);
}

/* Extrae ID de Drive si existe */
function extractDriveId(url) {
  const u = String(url || "").trim();
  if (!u) return "";

  const m =
    u.match(/drive\.google\.com\/file\/d\/([^/]+)/) ||
    u.match(/drive\.google\.com\/open\?id=([^&]+)/) ||
    u.match(/[?&]id=([^&]+)/);

  return m && m[1] ? m[1] : "";
}

/* Convierte enlaces de Drive a enlace directo (lh3) */
function driveToDirect(url) {
  const u = String(url || "").trim();
  if (!u) return "";

  const id = extractDriveId(u);
  if (id) return `https://lh3.googleusercontent.com/d/${id}`;

  if (u.includes("googleusercontent.com")) return u; // ya es directo
  return u; // otras URLs
}

/*
 * Fallback para hotlink bloqueado:
 * si Google bloquea la imagen embebida, usamos un proxy ligero.
 * (Sigue siendo gratis; solo lo usa si hace falta.)
 */
function viaImageProxy(url) {
  // images.weserv.nl: proxy de imágenes muy usado para hotlinking
  // Nota: requiere URL codificada.
  const enc = encodeURIComponent(url);
  return `https://images.weserv.nl/?url=${enc}`;
}

/* Obtiene imágenes desde la columna "Fotos" (o similares) */
function getImagesFromRow(o) {
  // 1) Si el API ya trae un array "imagenes"
  if (Array.isArray(o.imagenes) && o.imagenes.length) {
    return o.imagenes.map(driveToDirect).filter(Boolean);
  }

  // 2) Prioridad absoluta: columna "Fotos"
  let raw = "";
  if (o["Fotos"]) raw = String(o["Fotos"] || "");

  // 3) Fallback: cualquier columna que huela a fotos / imágenes
  if (!raw) {
    const keys = Object.keys(o);
    const k = keys.find(key => {
      const t = key.trim().toLowerCase();
      return t === "fotos" || t.includes("foto") || t.includes("imagen");
    });
    raw = k ? String(o[k] || "") : "";
  }

  // 4) Separar por comas o saltos de línea
  return raw
    .split(/[\n,]+/)
    .map(s => driveToDirect(s.trim()))
    .filter(Boolean);
}

/* Obtiene valores aunque el encabezado cambie */
function pickLoose(obj, patterns) {
  for (const p of patterns) {
    if (typeof p === "string" && obj[p] !== undefined && String(obj[p]).trim() !== "") {
      return obj[p];
    }
  }
  const keys = Object.keys(obj);
  for (const pat of patterns) {
    if (!(pat instanceof RegExp)) continue;
    const k = keys.find(key => pat.test(key.trim().toLowerCase()));
    if (k && String(obj[k]).trim() !== "") return obj[k];
  }
  return "";
}

/*************************************************
 * DOM
 *************************************************/
const elGrid = document.getElementById("grid");
const elStatus = document.getElementById("status");
const elQ = document.getElementById("q");
const elTipo = document.getElementById("tipo");
const elSolo = document.getElementById("soloDisponibles");
const elRefresh = document.getElementById("refresh");

let allListings = [];

/*************************************************
 * RENDER TARJETA
 *************************************************/
function card(o) {
  const titulo = pickLoose(o, ["titulo", "Título del anuncio", /t[ií]tulo/]);
  const tipo = norm(pickLoose(o, ["tipo", "Tipo de oferta"]));
  const estado = pickLoose(o, ["estado", "Estado"]);
  const desc = pickLoose(o, ["descripcion", "Descripción de la vivienda", /descrip/]);

  const precio = pickLoose(o, ["precio", "Precio"]);
  const moneda = pickLoose(o, ["moneda", "Moneda"]) || "EUR";

  const hab = pickLoose(o, ["habitaciones", /habit/]);
  const banos = pickLoose(o, ["banos", "baños", /bañ/]);
  const m2 = pickLoose(o, ["m2", "Metros cuadrados aproximados", /metro/]);

  const dir = pickLoose(o, ["direccion_sin_numero", "Dirección (sin número)", /direc/]);

  const nombre = pickLoose(o, ["contacto_nombre", "Nombre de la persona de contacto", /nombre/]);
  const tel = pickLoose(o, ["contacto_telefono", "Teléfono de contacto", /tel/]);
  const email = pickLoose(o, ["contacto_email", "Correo electrónico", /email/]);

  const images = getImagesFromRow(o);
  const img = images[0] || "";

  const meta1 = [
    hab ? `${hab} hab` : "",
    banos ? `${banos} baños` : "",
    m2 ? `${m2} m²` : ""
  ].filter(Boolean).join(" · ");

  const priceStr = fmtPrice(precio, moneda);

  const wa = tel ? `https://wa.me/${String(tel).replace(/\D/g, "")}` : "";
  const mailto = email
    ? `mailto:${email}?subject=${encodeURIComponent("Vivienda en Orea: " + (titulo || ""))}`
    : "";

  // Si es Drive, la versión directa puede ser bloqueada: ponemos fallback con onerror
  const imgHtml = img
    ? `<img class="hero-img"
            src="${img}"
            alt="${titulo || "Vivienda en Orea"}"
            loading="lazy"
            referrerpolicy="no-referrer"
            onerror="this.onerror=null; this.src='${viaImageProxy(img)}';" />`
    : ``;

  return `
    <article class="card">
      ${imgHtml}

      <div class="badges">
        ${tipo ? `<span class="badge tipo">${tipo}</span>` : ``}
        ${estado ? `<span class="badge estado">${estado}</span>` : ``}
      </div>

      <h3 class="title">${titulo || "Sin título"}</h3>
      ${priceStr ? `<p class="price">${priceStr}</p>` : ``}
      ${meta1 ? `<p class="meta">${meta1}</p>` : ``}
      ${dir ? `
