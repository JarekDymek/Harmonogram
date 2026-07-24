import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const base = mode === "pages" ? "/Harmonogram/" : "/";

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["logo.svg"],
        pwaAssets: {
          preset: "minimal-2023",
          image: "public/logo.svg",
          overrideManifestIcons: true,
        },
        manifest: {
          id: base,
          name: "Harmonogram MOW",
          short_name: "Harmonogram",
          description:
            "Generator sześciotygodniowego harmonogramu pracy wychowawców MOW.",
          theme_color: "#13293a",
          background_color: "#f4f6f7",
          display: "standalone",
          orientation: "any",
          scope: base,
          start_url: base,
          lang: "pl",
          categories: ["productivity", "business"],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          navigateFallback: `${base}index.html`,
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
    ],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      css: true,
    },
  };
});
