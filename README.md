# World Cup 2026 Dashboard

A free, unofficial fan dashboard for the FIFA World Cup 2026 — schedule, live scores, group standings, and knockout bracket. No API keys, no backend, no cost.

**Live anywhere:** deploy as a static site to GitHub Pages or Cloudflare Pages and open it from any device.

## Features

- **Schedule** — all 104 matches, filter by live / today / upcoming / finished
- **Live** — in-progress matches with auto-refresh (30s when live, 60s otherwise)
- **Groups** — standings for all 12 groups (A–L)
- **Bracket** — Round of 32 through Final

Odds are intentionally excluded — every free odds API requires a sign-up key with usage limits.

## Data sources (100% free, no keys)

| Source | Used for |
|--------|----------|
| [wcup2026.org API](https://wcup2026.org/api/data.php) | Matches, scores, status, flags |
| [worldcup26.ir](https://worldcup26.ir) | Group standings & team names |

Both allow browser access (CORS `*`).

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Live site

After GitHub Pages deploys successfully:

**https://rodrigogismondi.github.io/FWC26/**

If deploy fails with a 404, confirm **Settings → Pages → Source: GitHub Actions**, then re-run the workflow under the **Actions** tab.


### Option A — GitHub Pages (recommended)

1. Push this repo to GitHub.
2. In **Settings → Pages**, set source to **GitHub Actions**.
3. The included workflow deploys automatically on every push to `main`.
4. Your site will be at `https://<username>.github.io/<repo-name>/`

For a **project site** (URL includes repo name), the workflow sets `VITE_BASE_PATH` automatically.

For a **user/org site** (`<username>.github.io` repo), change the workflow env to `VITE_BASE_PATH: /`.

### Option B — Cloudflare Pages

1. Sign up at [pages.cloudflare.com](https://pages.cloudflare.com) (free).
2. Connect your GitHub repo.
3. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variable:** leave `VITE_BASE_PATH` unset (defaults to `/`)
4. Deploy — you get a `*.pages.dev` URL (custom domain optional, also free).

### Option C — Netlify

Same as Cloudflare: connect repo, build command `npm run build`, publish `dist`. Free tier includes a `*.netlify.app` subdomain.

## Why no backend?

All data APIs expose `Access-Control-Allow-Origin: *`, so the browser can fetch them directly. A static site means:

- Zero hosting cost
- No server to maintain
- Works on GitHub Pages, Cloudflare, Netlify, etc.

## Disclaimer

Unofficial fan project. Not affiliated with FIFA. Match data is sourced from community APIs and may lag official feeds.

## License

MIT
