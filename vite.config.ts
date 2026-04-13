import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const repoName = "loadsewa-app";
const isGithubPages = process.env.GITHUB_ACTIONS === "true";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: isGithubPages ? `/${repoName}/` : "/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("@googlemaps/js-api-loader")) {
            return "google-maps";
          }

          if (id.includes("@supabase/")) {
            return "supabase";
          }

          if (id.includes("recharts") || id.includes("framer-motion")) {
            return "visuals";
          }

          if (id.includes("react-router")) {
            return "router";
          }

          if (id.includes("@tanstack/react-query")) {
            return "query";
          }

          if (id.includes("react-hook-form") || id.includes("@hookform/") || id.includes("zod")) {
            return "forms";
          }

          if (id.includes("date-fns") || id.includes("react-day-picker")) {
            return "date-utils";
          }

          if (id.includes("lucide-react")) {
            return "icons";
          }

          if (
            id.includes("embla-carousel-react") ||
            id.includes("cmdk") ||
            id.includes("vaul") ||
            id.includes("sonner") ||
            id.includes("next-themes") ||
            id.includes("input-otp") ||
            id.includes("react-resizable-panels")
          ) {
            return "ui-misc";
          }

          if (id.includes("@radix-ui/")) {
            return "radix-ui";
          }

          return "vendor";
        },
      },
    },
  },
}));
