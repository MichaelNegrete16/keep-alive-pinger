// manage.js — CLI para administrar las URLs guardadas en la base de datos.
//
// Uso (con npm):
//   npm run manage -- add https://mi-app.com
//   npm run manage -- list
//   npm run manage -- remove 3
//   npm run manage -- disable 3
//   npm run manage -- enable 3
//
// O directo:  node --env-file=.env manage.js <comando> [args]

import {
  initDb,
  listUrls,
  addUrl,
  removeUrl,
  setEnabled,
  pool,
} from "./db.js";

const [, , cmd, arg] = process.argv;

function help() {
  console.log(`
Comandos:
  add <url>       Agrega una URL a la lista
  list            Muestra todas las URLs con su id y estado
  remove <id|url> Elimina una URL
  disable <id>    Deja de pingear esa URL (sin borrarla)
  enable <id>     Vuelve a pingear esa URL
`);
}

async function main() {
  await initDb();

  switch (cmd) {
    case "add": {
      if (!arg) return console.log("Falta la URL. Ej: add https://mi-app.com");
      const row = await addUrl(arg);
      console.log(row ? `Agregada [#${row.id}] ${row.url}` : `Ya existía: ${arg}`);
      break;
    }
    case "list": {
      const rows = await listUrls();
      if (rows.length === 0) {
        console.log("No hay URLs todavía. Agrega una con: add <url>");
        break;
      }
      console.log(`\n${rows.length} URL(s):`);
      for (const r of rows) {
        const estado = r.enabled ? "activa  " : "pausada ";
        console.log(`  #${r.id}\t${estado}\t${r.url}`);
      }
      console.log("");
      break;
    }
    case "remove": {
      if (!arg) return console.log("Falta id o url. Ej: remove 3");
      const row = await removeUrl(arg);
      console.log(row ? `Eliminada: ${row.url}` : `No se encontró: ${arg}`);
      break;
    }
    case "disable":
    case "enable": {
      if (!arg) return console.log(`Falta el id. Ej: ${cmd} 3`);
      const row = await setEnabled(arg, cmd === "enable");
      console.log(
        row
          ? `${row.enabled ? "Activada" : "Pausada"}: ${row.url}`
          : `No se encontró id: ${arg}`
      );
      break;
    }
    default:
      help();
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
