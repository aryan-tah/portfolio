import { resolve } from "node:path";
import { defineConfig } from "vite";

// Relative base so the build works on GitHub Pages project URLs and on a custom domain.
// Each case study is its own page.
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        forager: resolve(__dirname, "forager/index.html"),
      },
    },
  },
});
