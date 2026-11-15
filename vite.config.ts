import { defineConfig } from "vite";

// Relative base so the build works on GitHub Pages project URLs and on a custom domain.
export default defineConfig({
  base: "./",
  build: { target: "es2022" },
});
