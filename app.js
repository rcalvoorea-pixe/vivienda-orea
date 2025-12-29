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
  // Proxy gratis
