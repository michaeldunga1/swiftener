# Google sign-in setup (Swiftener)

Google **Error 400: invalid_request** almost always means the **redirect URI** in the app does not exactly match what is registered in Google Cloud Console.

## 1. Check what Swiftener is using

Open (while logged in is not required):

```text
https://swiftener.com/api/auth/providers
```

Note `publicOrigin` and `redirectUris.google`. That exact string must appear in Google Console.

## 2. Google Cloud Console

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. Create **OAuth client ID** → type **Web application** (not Desktop / Android).
3. **Authorized JavaScript origins**
   - `https://swiftener.com`
4. **Authorized redirect URIs** (exact, no trailing slash on path):
   - `https://swiftener.com/auth/google/callback`
5. Copy **Client ID** and **Client secret** into server `~/swiftener/.env`:

```env
FRONTEND_URL=https://swiftener.com
OAUTH_PUBLIC_ORIGIN=https://swiftener.com
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
```

Then: `pm2 reload swiftener --update-env`

## 3. OAuth consent screen

**APIs & Services** → **OAuth consent screen**

- User type: **External**
- App name, support email, developer contact filled in
- **App domain** (recommended): `swiftener.com`
- **Authorized domains**: `swiftener.com`
- **Privacy policy URL** and **Terms** URLs (required if app is not in Testing-only mode)

While **Publishing status** is **Testing**:

- Under **Test users**, add `michaeldunga1@gmail.com` (and any other accounts that should sign in).

To allow anyone to sign in, submit the app for **Verification** (not required for test users only).

## 4. Common mistakes

| Mistake | Fix |
|--------|-----|
| Redirect URI uses `http://` on production | Use `https://swiftener.com/...` |
| Registered `www.swiftener.com` but site is apex | Register apex URI or redirect www → apex |
| `FRONTEND_URL` still `http://localhost:4000` on server | Set to `https://swiftener.com` |
| OAuth client is "Desktop" type | Create **Web application** client |
| User not in Test users (Testing mode) | Add email under Test users |
