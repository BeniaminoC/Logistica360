import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pg usa módulos nativos opcionales; se mantiene fuera del bundle del servidor.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
