import type { NextConfig } from "next";

// ── Security Headers (OWASP Recomendado) ──────────────────────────────────────
const securityHeaders = [
  // Previne clickjacking
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Previne MIME type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Controla informações de referência
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Habilita HSTS (force HTTPS)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Restringe permissões de recursos do browser
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // XSS Protection legado (browsers antigos)
  { key: "X-XSS-Protection", value: "1; mode=block" },
]

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ncorntmwslmcdwejwkmc.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      {
        // Aplicar em todas as rotas
        source: "/(.*)",
        headers: securityHeaders,
      },
    ]
  },
};

export default nextConfig;
