import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // @/* → src/*（tsconfig の paths と必ず揃える）
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
