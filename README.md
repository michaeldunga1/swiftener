# Swiftener Blog Module

Full-stack blogging platform for Swiftener: Express API + vanilla HTML/CSS/JS
frontend on one origin. SQLite (`better-sqlite3`) + JWT-in-cookie auth.

## Setup

```
npm install
cp .env.example .env   # fill in JWT_SECRET, SMTP creds (SQLite path is local by default)
npm run seed:admin     # optional: admin@swiftener.local / changeme123
npm run dev
```

Open **http://localhost:4000** — that is the app home (not `/api/health`).

Production: replaces `~/swiftener` on the VPS; live at **https://swiftener.com**. See [DEPLOYMENT.md](./DEPLOYMENT.md) — `./deploy.sh YOUR_VPS_IP dunga`.

The database file is created automatically at `SQLITE_PATH` (default
`./data/swiftener.db`). No separate database server is required.

## Frontend routes

| Path | Purpose |
|------|---------|
| `/` | Post index + search/filters |
| `/posts/:slug` | Article, engagement, comments |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` | Auth |
| `/profile`, `/profile/saved`, `/profile/liked`, `/profile/bookmarked`, `/profile/notifications` | Account |
| `/admin`, `/admin/database`, `/admin/errors`, `/admin/analytics`, `/admin/drafts`, `/admin/posts/new`, `/admin/users`, `/admin/reports` | Admin (role `admin`) |
| `/about`, `/contact`, `/privacy`, `/terms` | Static site pages |
| `/newsletter` | Subscribe |

Mount the routers under your existing app, or run `app.js` standalone and
reverse-proxy it via Nginx at e.g. `swiftener.com/blog/api/*`. If you already
have an Express app instance, just copy the `app.use('/api/...', ...)` lines
into it instead of running this app.js separately.

## Design decisions worth knowing about

- **Likes / saves / bookmarks** are one `Interaction` model (`type` field),
  not three collections — same shape, avoids duplicated toggle logic. Each
  still has its own endpoint and its own counter on the Post.
- **Only admins can create/edit/delete/publish posts** — enforced in
  `postRoutes.js` via `requireAdmin`, not just hidden in the UI.
- **Suspended vs blocked** are different: blocked users can't log in at all;
  suspended users can log in and read, but `requireActiveForEngagement`
  blocks them from liking/commenting/saving/etc. Suspension can be temporary
  (`suspendedUntil`) or indefinite.
- **Unique views** are computed from a `View` log (IP hash + user ID),
  deduped over a rolling window (`VIEW_DEDUPE_WINDOW_HOURS`, default 12h) —
  not just an incrementing counter, so refreshes don't inflate it. Call
  `POST /api/posts/:postId/view` once per page load from the frontend.
- **Comment reports** auto-hide a comment after 5 reports pending admin
  review (`REPORT_HIDE_THRESHOLD` in `commentController.js`) rather than
  requiring an admin to catch every report manually.
- **Markdown** is rendered server-side with `marked` and sanitized with
  `sanitize-html` before being sent to clients — defends readers even if
  an admin account is ever compromised.
- Passwords are never returned from queries (`select: false` on the schema);
  reset/verify tokens are hashed at rest.

## What you'll still need to build

- A scheduled job if you want actual newsletter *sending* (this only
  manages subscribe/verify/unsubscribe + gives you the subscriber list —
  wire it to your mailer or a batch job).
- Image upload handling for `coverImage` / `avatar` (currently just accepts
  a URL string — hook up S3, Cloudinary, or local disk storage as needed).
- Rate limiting on comment/report endpoints if spam becomes an issue
  (auth endpoints already have it via `express-rate-limit`).

## API reference

### Auth — `/api/auth`
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/providers` | — | `{ google, github }` configured flags |
| GET | `/google` | — | Redirect to Google OAuth |
| GET | `/google/callback` | — | OAuth return (sets session cookie) |
| GET | `/github` | — | Redirect to GitHub OAuth |
| GET | `/github/callback` | — | OAuth return |
| POST | `/register` | — | |
| GET | `/verify-email?token=` | — | |
| POST | `/login` | — | |
| POST | `/logout` | — | |
| POST | `/forgot-password` | — | always returns generic message |
| POST | `/reset-password` | — | `{ token, newPassword }` |

### Posts — `/api/posts`
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | — | `?page&limit&category&tag&q` |
| GET | `/:slug` | optional | includes `viewerState` if logged in |
| GET | `/admin/drafts` | admin | |
| POST | `/` | admin | create (draft by default) |
| PUT | `/:id` | admin | |
| DELETE | `/:id` | admin | |

### Engagement — `/api/posts/:postId/...`
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/like` | user (active) | toggles |
| POST | `/save` | user (active) | toggles |
| POST | `/bookmark` | user (active) | toggles |
| POST | `/share` | — | returns share links + increments counter |
| POST | `/view` | optional | dedupe-aware unique view tracking |

### Comments — `/api/comments`
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/:postId` | — | |
| POST | `/:postId` | user (active) | `{ body, parentComment? }` |
| DELETE | `/:id` | owner or admin | soft delete |
| POST | `/:id/report` | user (active) | `{ reason }` |

### Users / profile — `/api/users`
| Method | Path | Auth |
|---|---|---|
| GET | `/me` | user |
| PUT | `/me` | user |
| PUT | `/me/password` | user |
| GET | `/me/analytics` | user |
| GET | `/me/save` \| `/me/bookmark` \| `/me/like` | user |
| POST | `/invite` | user |
| GET | `/:id` | — public profile |
| GET | `/analytics/post/:postId` | user (endpoint is admin-relevant; lock down further if needed) |

### Admin — `/api/admin` (all admin-only)
`GET /dashboard`, `GET /users`, `POST /users/:id/make-admin`,
`/revoke-admin`, `/block`, `/unblock`, `/suspend`, `/unsuspend`,
`DELETE /users/:id`, `POST /users/invite`, `GET /reports`,
`POST /reports/:id/resolve`, `GET /analytics`, `GET /errors`,
`GET /db/tables`, `GET /db/tables/:name`

### Notifications — `/api/notifications`
`GET /`, `POST /:id/read`, `POST /read-all`

### Newsletter — `/api/newsletter`
`POST /subscribe`, `GET /verify`, `GET /unsubscribe`, `GET /subscribers` (admin)
