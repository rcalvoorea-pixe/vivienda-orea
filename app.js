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

/* Convierte enlaces de Google Drive a enlace directo */
function driveToDirect(url) {
  const u = String(url || "").trim();
  if (!u) return "";

  // Captura el ID de Drive desde varios formatos
  const m =
    u.match(/drive\.google\.com\/file\/d\/([^/]+)/) ||
    u.match(/drive\.google\.com\/open\?id=([^&]+)/) ||
    u.match(/[?&]id=([^&]+)/);

  if (m && m[1]) {
    const id = m[1];
    // URL más fiable para <img>
    return `https://lh3.googleusercontent.com/d/${id}`;
  }

  // Si ya viene como googleusercontent
  if (u.includes("googleusercontent.com")) return u;

  return u;
}

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
  // Exactos
  for (const p of patterns) {
    if (typeof p === "string" && obj[p] !== undefined && String(obj[p]).trim() !== "") {
      return obj[p];
    }
  }
  // Flexibles (regex)
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
  const titulo = pickLoose(o, [
    "titulo",
    "Título del anuncio",
    /t[ií]tulo/
  ]);

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
    ? `mailto:${email}?subject=${encodeURIComponent("Vivienda en Orea: " + titulo)}`
    : "";

  return `
    <article class="card">
${img ? `<img class="hero-img" src="${img}" alt="${titulo || "Vivienda en Orea"}" loading="lazy" referrerpolicy="no-referrer">` : ``}

      <div class="badges">
        ${tipo ? `<span class="badge tipo">${tipo}</span>` : ``}
        ${estado ? `<span class="badge estado">${estado}</span>` : ``}
      </div>

      <h3 class="title">${titulo || "Sin título"}</h3>
      ${priceStr ? `<p class="price">${priceStr}</p>` : ``}
      ${meta1 ? `<p class="meta">${meta1}</p>` : ``}
      ${dir ? `<p class="meta2">${dir}</p>` : ``}

      ${desc ? `<p class="desc">${desc}</p>` : ``}

      <div class="actions">
        ${wa ? `<a class="btn primary" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ``}
        ${mailto ? `<a class="btn" href="${mailto}">Email</a>` : ``}
        ${nombre ? `<span class="btn">${nombre}</span>` : ``}
      </div>
    </article>
  `;
}

/*************************************************
 * FILTROS
 *************************************************/
function applyFilters() {
  const q = norm(elQ.value);
  const tipo = norm(elTipo.value);
  const solo = elSolo.checked;

  const filtered = allListings.filter(o => {
    const texto =
      norm(pickLoose(o, ["titulo", /t[ií]tulo/])) +
      " " +
      norm(pickLoose(o, ["descripcion", /descrip/])) +
      " " +
      norm(pickLoose(o, ["direccion_sin_numero", /direc/]));

    const okQ = !q || texto.includes(q);
    const okTipo = !tipo || norm(pickLoose(o, ["tipo", "Tipo de oferta"])) === tipo;
    const okEstado = !solo || norm(pickLoose(o, ["estado", "Estado"])) === "disponible";

    return okQ && okTipo && okEstado;
  });

  elGrid.innerHTML = filtered.map(card).join("");
  elStatus.textContent = filtered.length
    ? `Mostrando ${filtered.length} anuncio(s).`
    : "No hay anuncios que coincidan con el filtro.";
}

/*************************************************
 * CARGA DATOS
 *************************************************/
async function load() {
  elStatus.textContent = "Cargando anuncios…";
  elGrid.innerHTML = "";

  const res = await fetch(API_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar el API.");

  const data = await res.json();
  allListings = Array.isArray(data.listings) ? data.listings.slice().reverse() : [];

  applyFilters();
}

/*************************************************
 * EVENTOS
 *************************************************/
elQ.addEventListener("input", applyFilters);
elTipo.addEventListener("change", applyFilters);
elSolo.addEventListener("change", applyFilters);
elRefresh.addEventListener("click", () =>
  load().catch(err => (elStatus.textContent = err.message))
);

load().catch(err => (elStatus.textContent = err.message));



