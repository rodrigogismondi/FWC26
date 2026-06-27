import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Set VITE_BASE_PATH=/repo-name/ when deploying to GitHub Pages project site.
// Leave unset (or "/") for Cloudflare Pages, custom domain, or local dev.
const base = process.env.VITE_BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.ico", "favicon-32x32.png", "apple-touch-icon.png"],
      manifest: {
        name: "World Cup 2026 Dashboard",
        short_name: "WC 2026",
        description:
          "FIFA World Cup 2026 — live scores, schedule, group standings, and knockout bracket.",
        theme_color: "#0b1410",
        background_color: "#0b1410",
        display: "standalone",
        orientation: "portrait-primary",
        categories: ["sports", "news"],
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,jpg,webp}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api/, /\.php$/],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    outDir: "dist",
  },
});
