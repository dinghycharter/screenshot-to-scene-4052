import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Vite only exposes VITE_* variables to the app. Server code (payments, Supabase admin) reads
  // process.env, so in local development also load the other variables from .env into process.env.
  // Real environment variables (for example on Vercel) always win.
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ""))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    plugins: [
      tanstackStart({ server: { entry: "server" } }),
      nitro(),
      viteReact(),
      tailwindcss(),
    ],
    resolve: { tsconfigPaths: true },
  };
});
