import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["pdfkit"],
  // The PDFs (lib/pdf-brand.ts) read fonts and the logo from assets/ at runtime, also inside server actions.
  outputFileTracingIncludes: { "/**": ["./assets/**"] },
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  // The privacy policy lives on the institutional site; old links (App Store, Google Play, older app builds) keep working.
  async redirects() {
    return [{ source: "/privacidade", destination: "https://www.anuntech.com/privacy", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/pagar/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        // Tutorial videos of the help center: the name carries the file's hash (lib/help/tutorials.ts).
        source: "/ajuda/videos/:file",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            // Kept to what cannot break the app: no plugins, no base hijack, no framing.
            key: "Content-Security-Policy",
            value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
          },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            // The microphone only for the Console itself: dictation in the assistant and in tickets (lib/voice).
            value: "camera=(), microphone=(self), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default nextConfig;
