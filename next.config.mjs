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
    // `postgres` is a Node driver, and `@node-rs/argon2` ships a native `.node` binary per
    // platform: both must be left out of the bundle. Webpack has no loader for a binary and the
    // build fails with "Module parse failed: Unexpected character" — which is exactly what the
    // first deploy of the auth slice did. `npm run check:native` now fails locally if a dependency
    // like this is ever added without being listed here.
    serverComponentsExternalPackages: ["@electric-sql/pglite", "postgres", "@node-rs/argon2"],
  },
  images: {
    // Template artwork is served from Supabase Storage; no wildcard remote hosts.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/**" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        // A guest's invitation is private and personal: it must never sit in a shared cache, and it
        // must never be indexed. The page also sets `robots` in its metadata and robots.txt
        // disallows the path — three doors, because one of them gets forgotten one day.
        source: "/i/:path*",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
        ],
      },
      { source: "/(.*)", headers: securityHeaders },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
