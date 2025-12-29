const API_URL =
  "https://script.google.com/macros/s/AKfycbyAQ-iN-QYbI1UPFyE7ehXIow-hmiLtdJ8hl-gAoDtYXf39vvNecCNtNkaxfXz8VnjH/exec";

const elGrid = document.getElementById("grid");
const elStatus = document.getElementById("status");
const elQ = document.getElementById("q");
const elTipo = document.getElementById("tipo");
const elSolo = document.getElementById("soloDisponibles");
const elRefresh = document.getElementById("refresh");

let allListings = [];

function norm(v) {
  return (v ?? "").toString().trim().toLowerCase();
}

function fmtPrice(p, moneda = "EUR") {
  const n = Number(String(p).replace(",", "."));
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: moneda }).format(n);
}

function extractDriveId(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  const m =
    u.match(/drive\.google\.com\/file\/d\/([^/]+)/) ||
    u.match(/drive\.google\.com\/open\?id=([^&]+)/) ||
    u.match(/[?&]id=([^&]+)/);
  return m && m[1] ? m[1] : "";
}

function driveToDirect(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  const id = extractDriveId(u);
  if (id) return `https://lh3.googleusercontent.com/d/${id}`;
  if (u.includes("googleusercontent.com")) return u;
  return u;
}

function viaImageProxy(url) {
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
}

function getImagesFromRow(o) {
  let raw = "";
  if (o["Fotos"]) raw = String(o["Fotos"] || "");
  if (!raw) {
    const keys = Object.keys(o);
    const k = keys.find(key => {
      const t = key.trim().toLowerCase();
      return t === "fotos" || t.includes("foto") || t.includes("imagen") || t.includes("fotograf");
    });
    raw = k ? String(o[k] || "") : "";
  }
  return raw
    .split(/[\n,]+/)
    .map(s => driveToDirect(s.trim()))
    .filter(Boolean);
}

function pickLoose(obj, patterns) {
  for (const p of patterns) {
    if (typeof p === "string" && obj[p] !== undefined && String(obj[p]).trim() !== "") return obj[p];
  }
  const keys = Object.keys(obj);
  for (const pat of patterns) {
    if (!(pat instanceof RegExp)) continue;
    const k = keys.find(key => pat.test(key.trim().toLowerCase()));
    if (k && String(obj[k]).trim() !== "") return obj[k];
  }
  return "";
}

/* JSONP loader (evita CORS) */
function loadJSONP() {
  return new Promise((resolve, reject) => {
    const cb = "__orea_cb_" + Math.random().toString(16).slice(2);
    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout cargando el API"));
    }, 12000);

    function cleanup() {
      clearTimeout(timeout);
      script.remove();
      delete window[cb];
    }

    window[cb] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("No se pudo cargar el script JSONP"));
    };

    const sep = API_URL.includes("?") ? "&" : "?";
    script.src = `${API_URL}${sep}callback=${cb}`;
    document.body.appendChild(script);
  });
}

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

  const tel = pickLoose(o, ["contacto_telefono", "Teléfono de contacto", /tel/]);
  const email = pickLoose(o, ["contacto_email", "Correo electrónico", /mail/]);
  const nombre = pickLoose(o, ["contacto_nombre", "Nombre de la persona de contacto", /nombre/]);

  const images = getImagesFromRow(o);
  const img = images[0] || "";
  const fallback = img ? viaImageProxy(img) : "";

  const meta1 = [hab ? `${hab} hab` : "", banos ? `${banos} baños` : "", m2 ? `${m2} m²` : ""]
    .filter(Boolean).join(" · ");

  const priceStr = fmtPrice(precio, moneda);
  const wa = tel ? `https://wa.me/${String(tel).replace(/\D/g, "")}` : "";
  const mailto = email ? `mailto:${email}?subject=${encodeURIComponent("Vivienda en Orea: " + (titulo || ""))}` : "";

  const imgHtml = img
    ? `<img class="hero-img"
        src="${img}"
        alt="${titulo || "Vivienda en Orea"}"
        loading="lazy"
        referrerpolicy="no-referrer"
        onerror="this.onerror=null; this.src='${fallback}';" />`
    : "";

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

function applyFilters() {
  const q = norm(elQ.value);
  const tipo = norm(elTipo.value);
  const solo = elSolo.checked;

  const filtered = allListings.filter(o => {
    const texto =
      norm(pickLoose(o, ["titulo", /t[ií]tulo/])) + " " +
      norm(pickLoose(o, ["descripcion", /descrip/])) + " " +
      norm(pickLoose(o, ["direccion_sin_numero", /direc/]));

    const okQ = !q || texto.includes(q);
    const okTipo = !tipo || norm(pickLoose(o, ["tipo", "Tipo de oferta"])) === tipo;
    const okEstado = !solo || norm(pickLoose(o, ["estado", "Estado"])) === "disponible";
    return okQ && okTipo && okEstado;
  });

  elGrid.innerHTML = filtered.map(card).join("");
  elStatus.textContent = filtered.length ? `Mostrando ${filtered.length} anuncio(s).` : "No hay anuncios que coincidan con el filtro.";
}

async function load() {
  elStatus.textContent = "Cargando anuncios…";
  elGrid.innerHTML = "";

  try {
    const data = await loadJSONP();
    allListings = Array.isArray(data.listings) ? data.listings.slice().reverse() : [];
    applyFilters();
  } catch (e) {
    console.error(e);
    elStatus.textContent = `Error cargando anuncios: ${e.message}`;
  }
}

elQ.addEventListener("input", applyFilters);
elTipo.addEventListener("change", applyFilters);
elSolo.addEventListener("change", applyFilters);
elRefresh.addEventListener("click", load);

load();
