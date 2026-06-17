// keep-alive-pinger
// Hace ping a las URLs guardadas en PostgreSQL cada X minutos para mantenerlas
// despiertas. Lee la lista desde la BD en cada ronda, así las URLs que agregues
// con manage.js entran sin reiniciar.

import http from "node:http";
import { initDb, getEnabledUrls, pool } from "./db.js";

const intervalMs = (Number(process.env.INTERVAL_MINUTES) || 2) * 60 * 1000;
const timeoutMs = (Number(process.env.TIMEOUT_SECONDS) || 30) * 1000;

// Auto-ping: la URL PÚBLICA de este mismo server, para mantenerse despierto.
// Render la inyecta sola en RENDER_EXTERNAL_URL. En otros hosts define SELF_URL.
// OJO: debe ser la url pública (https://...), NO localhost, o no cuenta.
const selfUrl = process.env.SELF_URL || process.env.RENDER_EXTERNAL_URL || null;

function now() {
  return new Date().toISOString();
}

async function pingUrl(url) {
  const start = Date.now();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "keep-alive-pinger" },
    });
    const ms = Date.now() - start;
    console.log(`[${now()}] OK   ${res.status}  ${ms}ms  ${url}`);
  } catch (err) {
    const ms = Date.now() - start;
    const reason = err.name === "AbortError" ? "TIMEOUT" : err.message;
    console.log(`[${now()}] FAIL ${reason}  ${ms}ms  ${url}`);
  } finally {
    clearTimeout(t);
  }
}

async function pingAll() {
  let urls = [];
  try {
    urls = await getEnabledUrls();
  } catch (err) {
    // No cortamos: aunque la BD falle, el auto-ping debe correr igual para
    // mantener el server despierto.
    console.log(`[${now()}] No se pudo leer la BD: ${err.message}`);
  }
  // Incluye el auto-ping a sí mismo (si está configurado y no está ya en la lista).
  if (selfUrl && !urls.includes(selfUrl)) {
    urls = [selfUrl, ...urls];
  }
  if (urls.length === 0) {
    console.log(`[${now()}] No hay URLs activas. Agrega con: npm run manage -- add <url>`);
    return;
  }
  console.log(`[${now()}] --- Ronda de ping (${urls.length} URLs) ---`);
  await Promise.all(urls.map(pingUrl));
}

// Arranque
try {
  await initDb();
} catch (err) {
  // No tumbamos el proceso: el auto-ping debe seguir manteniendo el server
  // despierto aunque la BD esté caída. pingAll() reintentará leerla cada ronda.
  console.log(`[${now()}] Aviso: no se pudo inicializar la BD (${err.message}). Sigo igual.`);
}
console.log(`Pinger iniciado. Cada ${intervalMs / 60000} min. Leyendo URLs desde la BD.`);
if (selfUrl) console.log(`Auto-ping activado hacia: ${selfUrl}`);
await pingAll();
setInterval(pingAll, intervalMs);

// Cierre limpio de la conexión a la BD
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    console.log(`\n${sig} recibido. Cerrando...`);
    await pool.end();
    process.exit(0);
  });
}

// Mini servidor HTTP: necesario si lo subes a un host como Render/Koyeb
// (esperan que la app "escuche" un puerto). En tu PC no hace falta, por eso
// solo arranca si existe la variable de entorno PORT, y si el puerto está
// ocupado solo avisa: nunca tumba los pings.
if (process.env.PORT) {
  const PORT = process.env.PORT;
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("keep-alive-pinger vivo\n");
  });
  server.on("error", (err) => {
    console.log(`[${now()}] Health server no pudo arrancar (${err.code}). Los pings siguen igual.`);
  });
  server.listen(PORT, () => console.log(`Health server en puerto ${PORT}`));
}
