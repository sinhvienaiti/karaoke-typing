import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: process.env["DEV_HOST"] ?? "127.0.0.1",
    port: 3003,
    strictPort: true,
    allowedHosts: (process.env["DEV_ALLOWED_HOSTS"] ?? "karaoke.typing-game.local")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    hmr: {
      host: process.env["DEV_HMR_HOST"] ?? "karaoke.typing-game.local",
      protocol: (process.env["DEV_HMR_PROTOCOL"] as "ws" | "wss" | undefined) ?? "wss",
      clientPort: Number(process.env["DEV_HMR_CLIENT_PORT"] ?? 443),
    },
  },
});
