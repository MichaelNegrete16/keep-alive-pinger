// db.js — conexión a PostgreSQL y operaciones sobre la lista de URLs.
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error(
    "\nFalta DATABASE_URL. Copia .env.example a .env y pega tu connection string de Postgres.\n" +
      "Puedes crear una base gratis en https://neon.tech o https://supabase.com\n"
  );
  process.exit(1);
}

const isLocal = process.env.DATABASE_URL.includes("localhost") ||
  process.env.DATABASE_URL.includes("127.0.0.1");

// Quitamos "sslmode" de la URL para evitar un warning ruidoso de pg: el SSL ya
// lo controlamos explícitamente con la opción "ssl" de abajo.
const connectionString = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/i, "");

export const pool = new Pool({
  connectionString,
  // Casi todos los Postgres en la nube (Neon, Supabase) exigen SSL.
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

// Crea la tabla si no existe. Se llama una vez al arrancar.
export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS urls (
      id          SERIAL PRIMARY KEY,
      url         TEXT NOT NULL UNIQUE,
      enabled     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

// Devuelve solo las URLs activas (las que se van a pingear).
export async function getEnabledUrls() {
  const { rows } = await pool.query(
    "SELECT url FROM urls WHERE enabled = TRUE ORDER BY id"
  );
  return rows.map((r) => r.url);
}

// Lista todas las URLs (para el CLI). Incluye estado y id.
export async function listUrls() {
  const { rows } = await pool.query(
    "SELECT id, url, enabled, created_at FROM urls ORDER BY id"
  );
  return rows;
}

// Agrega una URL. Si ya existe, no la duplica.
export async function addUrl(url) {
  const { rows } = await pool.query(
    `INSERT INTO urls (url) VALUES ($1)
     ON CONFLICT (url) DO NOTHING
     RETURNING id, url`,
    [url]
  );
  return rows[0] ?? null; // null = ya existía
}

// Elimina por id (numérico) o por url exacta.
export async function removeUrl(idOrUrl) {
  const asNumber = Number(idOrUrl);
  const query = Number.isInteger(asNumber)
    ? { text: "DELETE FROM urls WHERE id = $1 RETURNING url", values: [asNumber] }
    : { text: "DELETE FROM urls WHERE url = $1 RETURNING url", values: [idOrUrl] };
  const { rows } = await pool.query(query);
  return rows[0] ?? null;
}

// Activa/desactiva una URL por id (sin borrarla).
export async function setEnabled(id, enabled) {
  const { rows } = await pool.query(
    "UPDATE urls SET enabled = $2 WHERE id = $1 RETURNING url, enabled",
    [Number(id), enabled]
  );
  return rows[0] ?? null;
}
