import createNextIntlPlugin from "next-intl/plugin";

/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // The local development database is a real PostgreSQL compiled to WebAssembly. It is imported
    // only on a non-production branch, so it must stay external to the server bundle rather than
    // being traced into a deployment that will never load it.
    // `postgres` is a Node driver: it must stay out of the bundle for the same reason — it has a
    // native-free but Node-only implementation, and the Edge runtime cannot use it.
    serverComponentsExternalPackages: ["@electric-sql/pglite", "postgres"],
  },
  images: {
    // Template artwork is served from Supabase Storage; no wildcard remote hosts.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/**" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
