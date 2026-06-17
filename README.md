# keep-alive-pinger

Hace ping (GET) a una lista de URLs cada X minutos para mantenerlas "despiertas".
Útil para que los servicios free-tier (Render, etc.) no se duerman por inactividad.

Las URLs se guardan en **PostgreSQL** y se administran con un CLI (`manage.js`),
así puedes tener 100+ URLs y agregar/quitar sin tocar el código.

## 1. Tener una base de datos Postgres (gratis)

Crea una base gratis en **[Neon](https://neon.tech)** o **[Supabase](https://supabase.com)**
y copia la *connection string* (se ve así):

```
postgresql://usuario:password@host/dbname?sslmode=require
```

## 2. Configurar

```bash
cp .env.example .env
```

Abre `.env` y pega tu `DATABASE_URL`. (También puedes ajustar `INTERVAL_MINUTES`.)

```bash
npm install
```

## 3. Administrar las URLs

```bash
npm run manage -- add https://mi-app.onrender.com
npm run manage -- add https://otra-app.com/health
npm run manage -- list
npm run manage -- disable 3     # deja de pingear la #3 sin borrarla
npm run manage -- enable 3
npm run manage -- remove 3      # la borra (también acepta la url exacta)
```

> El `--` es necesario con npm para pasarle los argumentos al script.

## 4. Correr el pinger

```bash
npm start
```

Lee las URLs activas desde la BD **en cada ronda**, así las que agregues entran
solas sin reiniciar. Salida en consola:

```
[2026-06-17T21:40:00.000Z] OK   200  342ms  https://mi-app.onrender.com
[2026-06-17T21:40:00.000Z] FAIL TIMEOUT  30000ms  https://otra-app.com/health
```

## ¿Dónde correrlo para que NO se duerma?

El pinger debe correr en algo encendido 24/7:

- **Tu PC** (mientras esté prendido).
- **Oracle Cloud Always Free** — VM gratis para siempre. Déjalo con `pm2`.
- Hosts en la nube (Render/Koyeb): definen `PORT`, y el pinger levanta un mini
  health server en ese puerto automáticamente.

## Auto-ping (que el server se mantenga despierto a sí mismo)

El pinger puede pingearse a su PROPIA url pública en cada ronda, así no se duerme.

- En **Render**: no configures nada. Render inyecta `RENDER_EXTERNAL_URL` solo y
  el pinger la usa automáticamente.
- En **otros hosts**: define `SELF_URL=https://tu-app.com` en las variables de entorno.

> ⚠️ Debe ser la url PÚBLICA (`https://...`), nunca `localhost`: el reloj de
> inactividad solo se reinicia con tráfico que entra por la url pública.

### Lo más robusto: auto-ping + ping externo

El auto-ping tiene una debilidad: si la app crashea, deja de pingearse a sí misma.
Para blindarlo, agrega además un ping externo gratis que apunte a tu server:

- **cron-job.org** o **UptimeRobot** → configura un GET a `https://tu-app.com`
  cada pocos minutos. Si tu app se cae, este la vuelve a levantar.

Así tienes doble red: el auto-ping mantiene despiertas las demás URLs de tu lista,
y el ping externo garantiza que tu propio server reviva si se cae.

## Estructura

- `db.js` — conexión a Postgres + operaciones sobre la tabla `urls`
- `manage.js` — CLI para add/list/remove/enable/disable
- `pinger.js` — el loop que hace los pings
- `.env` — tu configuración (no se sube a git)
