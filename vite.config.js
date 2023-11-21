import { defineConfig } from "vite";
import glsl from "vite-plugin-glsl";

export default defineConfig(() => {
  return {
    root: "src",
    publicDir: "../public",
    base: "/glsl-shool-task-02/",
    build: {
      outDir: "../dist",
      emptyOutDir: true,
      assetsDir: "assets",
      rollupOptions: {
        input: {
          main: "src/index.html",
        },
      },
    },
    plugins: [glsl()],
    server: {
      host: true,
    },
  };
});
