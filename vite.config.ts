import { defineConfig } from "vite";

// Set VITE_BASE_PATH=/repo-name/ when deploying to GitHub Pages project site.
// Leave unset (or "/") for Cloudflare Pages, custom domain, or local dev.
const base = process.env.VITE_BASE_PATH ?? "/";

export default defineConfig({
  base,
  build: {
    outDir: "dist",
  },
});
