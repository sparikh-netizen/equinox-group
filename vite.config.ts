import { defineConfig } from "vite";

export default defineConfig({
  base: "/equinox-group/",
  root: ".",
  publicDir: "web/public",
  build: {
    outDir: "dist-web",
    emptyOutDir: true,
  },
});
