const API_URL = "https://script.google.com/macros/s/AKfycbyAQ-iN-QYbI1UPFyE7ehXIow-hmiLtdJ8hl-gAoDtYXf39vvNecCNtNkaxfXz8VnjH/exec";

let allListings = [];

const elGrid = document.getElementById("grid");
const elStatus = document.getElementById("status");
const elQ = document.getElementById("q");
const elTipo = document.getElementById("tipo");
const elSolo = document.getElementById("soloDisponibles");
const elRefresh = document.getElementById("refresh");

function norm(s) {
  return (s ?? "").toString().trim().toLowerCase();
}

function fmtPrice(p, moneda = "EUR") {
  const n = Number(String(p).replace(",", "."));
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: moneda }).format(n);
}

// Intenta detectar claves aunque el formulario haya creado nombres distintos
function pick(obj, candidates) {
  for (const k of candidates) {
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") return obj[k];
  }
  return "";
}

function pickLoose(obj, patterns) {
  // 1) intenta claves exactas (por si acaso)
  for (const p of patterns) {
    if (typeof p === "string" && obj[p] !== undefined && String(obj[p]).trim() !== "") return obj[p];
  }
  // 2) intenta por coincidencia “flexible” en nombres de columnas
  const keys = Object.keys(obj);
  for (const pat of patterns) {
    const re = pat instanceof RegExp ? pat : null;
    if (!re) continue;
    const k = keys.find(key => re.test(key.trim().toLowerCase()));
    if (k && String(obj[k]).trim() !== "") return obj[k];
  }
  return "";
}

function card(o) {
  const titulo = pickLoose(o, [
  "titulo",
  "Título del anuncio",
  /t[ií]tulo.*anuncio/,
  /^t[ií]tulo$/
]);
  const tipo = norm(pick(o, ["tipo", "Tipo de oferta"]));
  const desc = pick(o, ["descripcion", "Descripción de la vivienda", "Descripción"]);
  const precio = pick(o, ["precio", "Precio"]);
  const moneda = pick(o, ["moneda", "Moneda"]) || "EUR";
  const hab = pick(o, ["habitaciones", "Número de habitaciones"]);
  const banos = pick(o, ["banos", "Número de baños", "Baños"]);
  const m2 = pick(o, ["m2", "Metros cuadrados aproximados", "Metros cuadrados"]);
  const dir = pick(o, ["direccion_sin_numero", "Dirección (sin número)", "Dirección"]);
  const estado = pick(o, ["estado", "Estado"]);

  const nombre = pick(o, ["contacto_nombre", "Nombre de la persona de contacto", "Nombre de contacto"]);
  const tel = pick(o, ["contacto_telefono", "Teléfono de contacto", "Teléfono"]);
  const email = pick(o, ["contacto_email", "Correo electrónico", "Email"]);

  const images = Array.isArray(o.imagenes) ? o.imagenes : [];
  const img = images[0] || "";

  const meta1 = [
    hab ? `${hab} hab` : "",
    banos ? `${banos} baños` : "",
    m2 ? `${m2} m²` : ""
  ].filter(Boolean).join(" · ");

  const meta2 = [dir].filter(Boolean).join(" · ");

  const priceStr = fmtPrice(precio, moneda);

  const wa = tel ? `https://wa.me/${String(tel).replace(/\D/g, "")}` : "";
  const mailto = email ? `mailto:${email}?subject=${encodeURIComponent("Vivienda en Orea: " + (titulo || ""))}` : "";

  return `
    <article class="card">
      ${img ? `<img class="hero" src="${img}" alt="${titulo}">` : ``}

      <div class="badges">
        ${tipo ? `<span class="badge">${tipo}</span>` : ``}
        ${estado ? `<span class="badge">${estado}</span>` : ``}
      </div>

      <h3 class="title">${titulo || "Sin título"}</h3>
      ${priceStr ? `<p class="price">${priceStr}</p>` : ``}
      ${meta1 ? `<p class="meta">${meta1}</p>` : ``}
      ${meta2 ? `<p class="meta2">${meta2}</p>` : ``}
      ${desc ? `<p class="desc">${desc}</p>` : ``}

      <div class="actions">
        ${wa ? `<a class="btn" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ``}
        ${mailto ? `<a class="btn" href="${mailto}">Email</a>` : ``}
        ${nombre ? `<button class="btn" onclick="alert('Contacto: ${String(nombre).replace(/'/g,"\\'")}')">Ver contacto</button>` : ``}
      </div>
    </article>
  `;
}

function applyFilters() {
  const q = norm(elQ.value);
  const tipo = norm(elTipo.value);
  const solo = elSolo.checked;

  const filtered = allListings.filter(o => {
    const titulo = norm(pick(o, ["titulo", "Título del anuncio", "Título"]));
    const desc = norm(pick(o, ["descripcion", "Descripción de la vivienda", "Descripción"]));
    const dir = norm(pick(o, ["direccion_sin_numero", "Dirección (sin número)", "Dirección"]));
    const text = `${titulo} ${desc} ${dir}`;

    const okQ = !q || text.includes(q);
    const okTipo = !tipo || norm(pick(o, ["tipo", "Tipo de oferta"])) === tipo;
    const okEstado = !solo || norm(pick(o, ["estado", "Estado"])) === "disponible";

    return okQ && okTipo && okEstado;
  });

  elGrid.innerHTML = filtered.map(card).join("");
  elStatus.textContent = filtered.length
    ? `Mostrando ${filtered.length} anuncio(s).`
    : `No hay anuncios que coincidan con el filtro.`;
}

async function load() {
  elStatus.textContent = "Cargando anuncios…";
  elGrid.innerHTML = "";

  const res = await fetch(API_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar el API.");
  const data = await res.json();

  allListings = Array.isArray(data.listings) ? data.listings.slice().reverse() : [];
  applyFilters();
}

elQ.addEventListener("input", applyFilters);
elTipo.addEventListener("change", applyFilters);
elSolo.addEventListener("change", applyFilters);
elRefresh.addEventListener("click", () => load().catch(err => elStatus.textContent = err.message));

load().catch(err => elStatus.textContent = err.message);


