# Deploy Swiftener (apex site)

This app **replaces** `~/swiftener` on the VPS. Public URL: **https://swiftener.com** (no subdomain). Existing nginx should proxy the apex to **port 3000**.

## Deploy from your machine

```bash
cd ~/swiftener
chmod +x deploy.sh
./deploy.sh YOUR_VPS_IP dunga
```

What it does:

- `rsync --delete` into `~/swiftener` (keeps remote `data/` and `.env`)
- `npm install --omit=dev`
- Stops old PM2 apps (`swiftener`, tool sub-apps from the previous layout)
- Starts PM2 process `swiftener` on port **3000**

## First time on the server

```bash
ssh dunga@YOUR_VPS_IP
cd ~/swiftener
nano .env
# FRONTEND_URL=https://swiftener.com
# JWT_SECRET=<long random string>
npm run seed:admin
```

Nginx: use [`nginx.conf.example`](nginx.conf.example) if the apex vhost is not already pointing at `:3000`.

## Health

```bash
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/healthz
```

## Production env

| Variable | Production value |
|----------|------------------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` (set by PM2 `env_production`) |
| `FRONTEND_URL` | `https://swiftener.com` |
| `SQLITE_PATH` | `./data/swiftener.db` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google login |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Optional GitHub login |

OAuth redirect URIs (must match `FRONTEND_URL`):

- `https://swiftener.com/auth/google/callback`
- `https://swiftener.com/auth/github/callback`

## Updates

Re-run `./deploy.sh` — PM2 restarts the app; SQLite in `data/` is preserved.
