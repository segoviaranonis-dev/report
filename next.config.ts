import type { NextConfig } from "next";

/**
 * Imágenes públicas de Supabase Storage (cualquier proyecto *.supabase.co).
 * Solo rutas bajo /storage/v1/object/public/ — no abre otros hosts.
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "xlsx"],
  // CSV sdrm ~1–5+ MB vía UI. Next 15.5+ proxy default 1MB trunca el body → import roto en local.
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
};

export default nextConfig;
