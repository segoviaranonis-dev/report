import type { NextConfig } from "next";

/**
 * Imágenes públicas de Supabase Storage (cualquier proyecto *.supabase.co).
 * Solo rutas bajo /storage/v1/object/public/ — no abre otros hosts.
 *
 * Body 32mb: Next 15.5 proxy truncaba CSV sdrm >1MB en UI import PE (2.3.1.10.1.7).
 * Keys experimentales aún no tipadas en ExperimentalConfig — cast al final.
 */
const nextConfig = {
  serverExternalPackages: ["pg", "xlsx"],
  experimental: {
    proxyClientMaxBodySize: "32mb",
    middlewareClientMaxBodySize: "32mb",
  },
  serverActions: {
    bodySizeLimit: "32mb",
  },
  async headers() {
    return [
      {
        source: "/tablet-bazzar/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      {
        source: "/api/tablet-bazzar/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
} as NextConfig;

export default nextConfig;
