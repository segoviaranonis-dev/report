import type { NextConfig } from "next";

/**
 * Imágenes públicas de Supabase Storage (cualquier proyecto *.supabase.co).
 * Solo rutas bajo /storage/v1/object/public/ — no abre otros hosts.
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
